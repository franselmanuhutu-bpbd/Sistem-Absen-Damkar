import asyncio
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi import HTTPException, Request

from routers.audit import audit_log
from routers.employees import list_employees, import_employees
from routers.users import update_user
from routers.calendar import calendar_view
from routers.recap import recap_monthly, recap_period
from routers.auth import login, check_rate_limit, record_failed_attempt, reset_attempts, _LOGIN_ATTEMPTS
from routers.exports import sanitize_excel_cell
from services.notifications import delete_push_subscription
from models import UserIn, LoginIn


def test_cors_configuration():
    """Verify CORS configuration strictly allows the Vercel domain and avoids insecure wildcard."""
    from server import ALLOWED_ORIGINS
    assert "https://sistem-absen-damkar.vercel.app" in ALLOWED_ORIGINS
    assert "*" not in ALLOWED_ORIGINS
    assert "http://localhost:3000" in ALLOWED_ORIGINS


def test_audit_log_capped_limit():
    asyncio.run(_test_audit_log_capped_limit())


async def _test_audit_log_capped_limit():
    """Verify limit parameter in audit log is capped between 1 and 500 to prevent DoS."""
    mock_db = MagicMock()
    mock_builder = MagicMock()
    mock_builder.select.return_value.order.return_value.limit.return_value.execute = AsyncMock(
        return_value=MagicMock(data=[])
    )
    mock_db.table.return_value = mock_builder

    with patch("routers.audit.get_db", AsyncMock(return_value=mock_db)):
        admin_user = {"id": "admin-1", "role": "admin"}
        # Test excessively high limit
        await audit_log(limit=999999, user=admin_user)
        # Verify limit was capped to 500
        mock_builder.select.return_value.order.return_value.limit.assert_called_with(500)

        # Test negative or zero limit
        await audit_log(limit=-10, user=admin_user)
        mock_builder.select.return_value.order.return_value.limit.assert_called_with(1)


def test_employee_search_postgrest_sanitization():
    asyncio.run(_test_employee_search_postgrest_sanitization())


async def _test_employee_search_postgrest_sanitization():
    """Verify search parameter is sanitized against PostgREST injection characters."""
    mock_db = MagicMock()
    mock_query = MagicMock()
    mock_query.or_.return_value = mock_query
    mock_query.execute = AsyncMock(return_value=MagicMock(data=[]))
    mock_query.order.return_value.limit.return_value.execute = AsyncMock(
        return_value=MagicMock(data=[])
    )
    mock_db.table.return_value.select.return_value = mock_query

    with patch("routers.employees.get_db", AsyncMock(return_value=mock_db)), \
         patch("routers.employees.resolve_teams_for_date", AsyncMock(return_value={})), \
         patch("routers.employees.get_active_kasubid_ids", AsyncMock(return_value=set())):
        # Inject dangerous PostgREST filter syntax: commas, parentheses, colons, quotes
        dangerous_search = 'foo,status.eq.INACTIVE):"hack%'
        user = {"id": "user-1", "role": "operator"}
        await list_employees(search=dangerous_search, user=user)

        # Ensure query.or_ received only the cleaned string without PostgREST syntax characters
        mock_query.or_.assert_called_once()
        filter_arg = mock_query.or_.call_args[0][0]
        assert "(" not in filter_arg
        assert ")" not in filter_arg
        assert '"' not in filter_arg
        assert ":" not in filter_arg
        # Filter is formatted as 'nama.ilike.%clean%,nip.ilike.%clean%'
        # Ensure 'status.eq.INACTIVE' was not injected as a standalone clause
        assert "status.eq.INACTIVE" not in filter_arg


def test_import_employees_file_validation():
    asyncio.run(_test_import_employees_file_validation())


async def _test_import_employees_file_validation():
    """Verify Excel import rejects invalid file types and oversized files."""
    admin_user = {"id": "admin-1", "role": "admin"}

    # 1. Invalid extension
    bad_file = MagicMock()
    bad_file.filename = "malicious_script.sh"
    bad_file.read = AsyncMock(return_value=b"echo hack")

    try:
        await import_employees(file=bad_file, user=admin_user)
        assert False, "Should have raised HTTPException"
    except HTTPException as exc:
        assert exc.status_code == 400
        assert "Excel" in exc.detail

    # 2. Oversized file (> 5 MB)
    large_file = MagicMock()
    large_file.filename = "huge_data.xlsx"
    large_file.read = AsyncMock(return_value=b"A" * (6 * 1024 * 1024))

    try:
        await import_employees(file=large_file, user=admin_user)
        assert False, "Should have raised HTTPException"
    except HTTPException as exc:
        assert exc.status_code == 400
        assert "5 MB" in exc.detail


def test_user_management_self_lockout_and_role_validation():
    asyncio.run(_test_user_management_self_lockout_and_role_validation())


async def _test_user_management_self_lockout_and_role_validation():
    """Verify admin cannot demote/deactivate their own account, and cannot assign invalid roles."""
    admin_user = {"id": "admin-99", "email": "admin@damkar.go.id", "role": "admin"}

    # 1. Invalid role
    invalid_role_body = UserIn(
        name="Test",
        email="test@damkar.go.id",
        role="super_hacker",
        status="ACTIVE"
    )
    try:
        await update_user("target-1", invalid_role_body, user=admin_user)
        assert False, "Should have raised HTTPException"
    except HTTPException as exc:
        assert exc.status_code == 400
        assert "Role tidak valid" in exc.detail

    # 2. Self deactivation
    self_deactivate_body = UserIn(
        name="Admin",
        email="admin@damkar.go.id",
        role="admin",
        status="INACTIVE"
    )
    try:
        await update_user("admin-99", self_deactivate_body, user=admin_user)
        assert False, "Should have raised HTTPException"
    except HTTPException as exc:
        assert exc.status_code == 400
        assert "akun Anda sendiri" in exc.detail

    # 3. Self demotion
    self_demote_body = UserIn(
        name="Admin",
        email="admin@damkar.go.id",
        role="viewer",
        status="ACTIVE"
    )
    try:
        await update_user("admin-99", self_demote_body, user=admin_user)
        assert False, "Should have raised HTTPException"
    except HTTPException as exc:
        assert exc.status_code == 400
        assert "akun Anda sendiri" in exc.detail


def test_user_management_duplicate_email():
    asyncio.run(_test_user_management_duplicate_email())


async def _test_user_management_duplicate_email():
    """Verify updating a user's email to an existing email belonging to another user is rejected."""
    admin_user = {"id": "admin-99", "role": "admin"}
    body = UserIn(
        name="User Dua",
        email="existing@damkar.go.id",
        role="operator",
        status="ACTIVE"
    )

    mock_db = MagicMock()
    # Return duplicate record with different ID
    mock_db.table.return_value.select.return_value.eq.return_value.execute = AsyncMock(
        return_value=MagicMock(data=[{"id": "user-2"}])
    )
    mock_db.table.return_value.select.return_value.eq.return_value.neq.return_value.execute = AsyncMock(
        return_value=MagicMock(data=[{"id": "user-other"}])
    )

    with patch("routers.users.get_db", AsyncMock(return_value=mock_db)):
        try:
            await update_user("user-2", body, user=admin_user)
            assert False, "Should have raised HTTPException"
        except HTTPException as exc:
            assert exc.status_code == 400
            assert "Email sudah terdaftar" in exc.detail


def test_date_and_month_validation():
    asyncio.run(_test_date_and_month_validation())


async def _test_date_and_month_validation():
    """Verify invalid month or date strings fail with 400 Bad Request instead of 500 error."""
    user = {"id": "user-1", "role": "operator"}

    # Calendar: invalid format
    try:
        await calendar_view(month="invalid-month", user=user)
        assert False, "Should have raised HTTPException"
    except HTTPException as exc:
        assert exc.status_code == 400
        assert "YYYY-MM" in exc.detail

    # Calendar: month out of range
    try:
        await calendar_view(month="2026-13", user=user)
        assert False, "Should have raised HTTPException"
    except HTTPException as exc:
        assert exc.status_code == 400

    # Recap monthly: invalid
    try:
        await recap_monthly(month="2026/10", user=user)
        assert False, "Should have raised HTTPException"
    except HTTPException as exc:
        assert exc.status_code == 400

    # Recap period: start > end
    try:
        await recap_period(start="2026-10", end="2026-05", user=user)
        assert False, "Should have raised HTTPException"
    except HTTPException as exc:
        assert exc.status_code == 400


def test_delete_push_subscription_ownership():
    asyncio.run(_test_delete_push_subscription_ownership())


async def _test_delete_push_subscription_ownership():
    """Verify push unsubscribe queries by user_id to prevent unauthorized deletion."""
    mock_db = MagicMock()
    mock_query = MagicMock()
    mock_query.eq.return_value = mock_query
    mock_query.execute = AsyncMock(return_value=MagicMock(data=[]))
    mock_db.table.return_value.delete.return_value = mock_query

    with patch("services.notifications.get_db", AsyncMock(return_value=mock_db)), \
         patch("services.notifications._delete_local_sub"):
        await delete_push_subscription("https://push.endpoint/123", user_id="user-owner")
        # Check that eq was called with user_id
        eq_calls = mock_query.eq.call_args_list
        assert any(call[0] == ("user_id", "user-owner") for call in eq_calls)
        assert any(call[0] == ("endpoint", "https://push.endpoint/123") for call in eq_calls)


def test_formula_injection_sanitization():
    """Verify CSV / Formula injection characters are neutralized with a leading single quote."""
    # Dangerous formula prefixes
    assert sanitize_excel_cell("=1+1") == "'=1+1"
    assert sanitize_excel_cell("@SUM(A1:A10)") == "'@SUM(A1:A10)"
    assert sanitize_excel_cell("+cmd|' /C calc'!A0") == "'+cmd|' /C calc'!A0"
    assert sanitize_excel_cell("-2+3*4") == "'-2+3*4"
    assert sanitize_excel_cell("\tDDE") == "'\tDDE"

    # Benign normal values
    assert sanitize_excel_cell("Daud Pali") == "Daud Pali"
    assert sanitize_excel_cell("198101152006051004") == "198101152006051004"
    assert sanitize_excel_cell(42) == 42
    assert sanitize_excel_cell(None) is None


def test_login_brute_force_rate_limiter():
    asyncio.run(_test_login_brute_force_rate_limiter())


async def _test_login_brute_force_rate_limiter():
    """Verify 5 failed login attempts trigger HTTP 429 Too Many Requests."""
    reset_attempts("192.168.1.100")
    mock_request = MagicMock(spec=Request)
    mock_request.client.host = "192.168.1.100"
    mock_request.headers.get.return_value = None

    mock_db = MagicMock()
    # Always return no user found -> failed login
    mock_db.table.return_value.select.return_value.eq.return_value.execute = AsyncMock(
        return_value=MagicMock(data=[])
    )

    with patch("routers.auth.get_db", AsyncMock(return_value=mock_db)):
        login_body = LoginIn(email="wrong@damkar.go.id", password="badpassword")

        # 5 failed attempts
        for _ in range(5):
            try:
                await login(request=mock_request, body=login_body)
                assert False, "Should fail with 401"
            except HTTPException as exc:
                assert exc.status_code == 401

        # 6th attempt must be blocked by rate limiter with 429
        try:
            await login(request=mock_request, body=login_body)
            assert False, "Should fail with 429"
        except HTTPException as exc:
            assert exc.status_code == 429
            assert "Terlalu banyak percobaan" in exc.detail

    reset_attempts("192.168.1.100")

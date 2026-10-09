import asyncio
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi import HTTPException
from models import ChangePasswordIn
from auth import hash_password
from routers.auth import change_password


def test_change_password_success():
    asyncio.run(_async_test_change_password_success())


def test_change_password_wrong_old():
    asyncio.run(_async_test_change_password_wrong_old())


def test_change_password_too_short():
    asyncio.run(_async_test_change_password_too_short())


def test_change_password_same_as_old():
    asyncio.run(_async_test_change_password_same_as_old())


async def _async_test_change_password_success():
    mock_db = MagicMock()
    hashed = hash_password("oldpassword123")
    user_row = [{"id": "user-1", "email": "staff@damkar.go.id", "password_hash": hashed}]

    updated_fields = {}

    def mock_table(name):
        tbl = MagicMock()
        if name == "users":
            tbl.select.return_value.eq.return_value.execute = AsyncMock(return_value=MagicMock(data=user_row))
            def mock_update(d):
                updated_fields.update(d)
                return MagicMock(eq=lambda f, v: MagicMock(execute=AsyncMock()))
            tbl.update = mock_update
        return tbl

    mock_db.table.side_effect = mock_table
    current_user = {"id": "user-1", "email": "staff@damkar.go.id", "role": "operator"}

    with patch("routers.auth.get_db", AsyncMock(return_value=mock_db)), \
         patch("routers.auth.write_audit", AsyncMock()), \
         patch("routers.auth.invalidate_user_cache") as mock_inv:

        body = ChangePasswordIn(current_password="oldpassword123", new_password="newsecretpassword456")
        res = await change_password(body, user=current_user)
        assert res["ok"] is True
        assert "password_hash" in updated_fields
        mock_inv.assert_called_with("user-1")


async def _async_test_change_password_wrong_old():
    mock_db = MagicMock()
    hashed = hash_password("correctpassword")
    user_row = [{"id": "user-1", "email": "staff@damkar.go.id", "password_hash": hashed}]

    tbl = MagicMock()
    tbl.select.return_value.eq.return_value.execute = AsyncMock(return_value=MagicMock(data=user_row))
    mock_db.table.return_value = tbl
    current_user = {"id": "user-1", "email": "staff@damkar.go.id", "role": "operator"}

    with patch("routers.auth.get_db", AsyncMock(return_value=mock_db)):
        body = ChangePasswordIn(current_password="wrongpassword", new_password="newpassword123")
        try:
            await change_password(body, user=current_user)
            assert False, "Should have raised 400"
        except HTTPException as e:
            assert e.status_code == 400
            assert "Password lama tidak sesuai" in e.detail


async def _async_test_change_password_too_short():
    mock_db = MagicMock()
    hashed = hash_password("correctpassword")
    user_row = [{"id": "user-1", "email": "staff@damkar.go.id", "password_hash": hashed}]

    tbl = MagicMock()
    tbl.select.return_value.eq.return_value.execute = AsyncMock(return_value=MagicMock(data=user_row))
    mock_db.table.return_value = tbl
    current_user = {"id": "user-1", "email": "staff@damkar.go.id", "role": "operator"}

    with patch("routers.auth.get_db", AsyncMock(return_value=mock_db)):
        body = ChangePasswordIn(current_password="correctpassword", new_password="123")
        try:
            await change_password(body, user=current_user)
            assert False, "Should have raised 400"
        except HTTPException as e:
            assert e.status_code == 400
            assert "minimal 6 karakter" in e.detail


async def _async_test_change_password_same_as_old():
    mock_db = MagicMock()
    hashed = hash_password("samepassword123")
    user_row = [{"id": "user-1", "email": "staff@damkar.go.id", "password_hash": hashed}]

    tbl = MagicMock()
    tbl.select.return_value.eq.return_value.execute = AsyncMock(return_value=MagicMock(data=user_row))
    mock_db.table.return_value = tbl
    current_user = {"id": "user-1", "email": "staff@damkar.go.id", "role": "operator"}

    with patch("routers.auth.get_db", AsyncMock(return_value=mock_db)):
        body = ChangePasswordIn(current_password="samepassword123", new_password="samepassword123")
        try:
            await change_password(body, user=current_user)
            assert False, "Should have raised 400"
        except HTTPException as e:
            assert e.status_code == 400
            assert "tidak boleh sama" in e.detail

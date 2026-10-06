"""Comprehensive backend API tests for DAMKAR Mimika attendance app."""
import os
import io
import pytest
import requests
from datetime import date

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://damkar-absensi.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "fransel.manuhutu@gmail.com", "password": "Damkar2026!"}
OPERATOR = {"email": "operator@damkar.go.id", "password": "Damkar2026!"}
VIEWER = {"email": "kepala@damkar.go.id", "password": "Damkar2026!"}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, f"Login failed {creds['email']}: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def admin_token():
    return _login(ADMIN)


@pytest.fixture(scope="session")
def operator_token():
    return _login(OPERATOR)


@pytest.fixture(scope="session")
def viewer_token():
    return _login(VIEWER)


def hdr(tok):
    return {"Authorization": f"Bearer {tok}"}


# ---------- Auth ----------
class TestAuth:
    def test_admin_login(self):
        r = requests.post(f"{API}/auth/login", json=ADMIN)
        assert r.status_code == 200
        data = r.json()
        assert "access_token" in data and data["user"]["role"] == "admin"

    def test_operator_login(self):
        r = requests.post(f"{API}/auth/login", json=OPERATOR)
        assert r.status_code == 200
        assert r.json()["user"]["role"] == "operator"

    def test_viewer_login(self):
        r = requests.post(f"{API}/auth/login", json=VIEWER)
        assert r.status_code == 200
        assert r.json()["user"]["role"] == "viewer"

    def test_bad_password(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN["email"], "password": "wrong"})
        assert r.status_code == 401

    def test_me(self, admin_token):
        r = requests.get(f"{API}/auth/me", headers=hdr(admin_token))
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN["email"]

    def test_me_no_token(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code in (401, 403)


# ---------- RBAC ----------
class TestRBAC:
    def test_viewer_cannot_list_users(self, viewer_token):
        r = requests.get(f"{API}/users", headers=hdr(viewer_token))
        assert r.status_code == 403

    def test_operator_cannot_list_users(self, operator_token):
        r = requests.get(f"{API}/users", headers=hdr(operator_token))
        assert r.status_code == 403

    def test_admin_can_list_users(self, admin_token):
        r = requests.get(f"{API}/users", headers=hdr(admin_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_viewer_cannot_batch_attendance(self, viewer_token):
        r = requests.post(f"{API}/attendance/batch", headers=hdr(viewer_token),
                          json={"date": "2026-03-15", "employee_ids": [], "status": "HDR"})
        assert r.status_code == 403

    def test_viewer_cannot_create_employee(self, viewer_token):
        r = requests.post(f"{API}/employees", headers=hdr(viewer_token),
                          json={"nip": "X", "nama": "X", "jabatan": "X"})
        assert r.status_code == 403


# ---------- Teams & Employees ----------
class TestTeamsEmployees:
    def test_list_teams(self, admin_token):
        r = requests.get(f"{API}/teams", headers=hdr(admin_token))
        assert r.status_code == 200
        teams = r.json()
        assert len(teams) == 6, f"Expected 6 regu, got {len(teams)}"

    def test_list_employees(self, admin_token):
        r = requests.get(f"{API}/employees", headers=hdr(admin_token))
        assert r.status_code == 200
        emps = r.json()
        # 54 seeded
        active = [e for e in emps if e.get("status") == "ACTIVE"]
        assert len(active) >= 54, f"Expected >=54 active employees, got {len(active)}"
        # no mongo _id leak
        for e in emps[:5]:
            assert "_id" not in e

    def test_team_members(self, admin_token):
        teams = requests.get(f"{API}/teams", headers=hdr(admin_token)).json()
        t = teams[0]
        r = requests.get(f"{API}/teams/{t['id']}/members?date=2026-03-15", headers=hdr(admin_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ---------- Dashboard & Recap ----------
class TestDashboardRecap:
    def test_dashboard(self, viewer_token):
        r = requests.get(f"{API}/dashboard?date=2026-03-15", headers=hdr(viewer_token))
        assert r.status_code == 200
        d = r.json()
        assert "total_employees" in d or "total" in d or "per_team" in d or "teams" in d

    def test_monthly_recap(self, viewer_token):
        r = requests.get(f"{API}/recap/monthly?month=2026-03", headers=hdr(viewer_token))
        assert r.status_code == 200

    def test_period_recap(self, viewer_token):
        r = requests.get(f"{API}/recap/period?start=2026-01&end=2026-03", headers=hdr(viewer_token))
        assert r.status_code == 200

    def test_calendar(self, viewer_token):
        r = requests.get(f"{API}/calendar?month=2026-03", headers=hdr(viewer_token))
        assert r.status_code == 200

    def test_attendance_day(self, viewer_token):
        r = requests.get(f"{API}/attendance/day?date=2026-03-15", headers=hdr(viewer_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ---------- Roster & Batch Attendance ----------
class TestAttendance:
    def test_roster_and_batch(self, operator_token):
        teams = requests.get(f"{API}/teams", headers=hdr(operator_token)).json()
        t = teams[0]
        d = "2026-10-15"
        r = requests.get(f"{API}/attendance/roster?date={d}&team_id={t['id']}", headers=hdr(operator_token))
        assert r.status_code == 200
        roster = r.json()
        assert isinstance(roster, list) and len(roster) > 0
        ids = [e["id"] for e in roster[:3]]
        # Save original statuses so we restore
        orig = {e["id"]: e.get("status") for e in roster[:3]}
        # Set to SKT
        r = requests.post(f"{API}/attendance/batch", headers=hdr(operator_token),
                          json={"date": d, "employee_ids": ids, "status": "SKT"})
        assert r.status_code == 200
        # Verify
        r2 = requests.get(f"{API}/attendance/roster?date={d}&team_id={t['id']}", headers=hdr(operator_token))
        new = {e["id"]: e.get("status") for e in r2.json()}
        for eid in ids:
            assert new[eid] == "SKT"
        # Restore
        for eid in ids:
            if orig[eid]:
                requests.post(f"{API}/attendance/batch", headers=hdr(operator_token),
                              json={"date": d, "employee_ids": [eid], "status": orig[eid]})


# ---------- Rolling integrity ----------
class TestRollingIntegrity:
    def test_rolling_preserves_history(self, admin_token):
        emps = requests.get(f"{API}/employees", headers=hdr(admin_token)).json()
        teams = requests.get(f"{API}/teams", headers=hdr(admin_token)).json()
        # pick an active employee currently in regu 1
        t1 = teams[0]["id"]
        t3 = teams[2]["id"]
        members = requests.get(f"{API}/teams/{t1}/members?date=2026-03-15", headers=hdr(admin_token)).json()
        if not members:
            pytest.skip("No members in team1 on 2026-03-15")
        emp = members[0]
        eid = emp["id"]

        # Record attendance in March (team1 period)
        requests.post(f"{API}/attendance/batch", headers=hdr(admin_token),
                      json={"date": "2026-03-10", "employee_ids": [eid], "status": "HDR"})

        # Roll to team3 starting 2026-05-01
        r = requests.post(f"{API}/assignments", headers=hdr(admin_token),
                         json={"employee_id": eid, "team_id": t3, "start_date": "2026-05-01"})
        assert r.status_code == 200, r.text

        # Verify historical day still shows team1 team membership
        day = requests.get(f"{API}/attendance/day?date=2026-03-10", headers=hdr(admin_token)).json()
        found = [x for x in day if x.get("employee_id") == eid or x.get("nip") == emp.get("nip")]
        if found:
            # Could use team name match
            assert found[0]["regu"] == teams[0]["name"], f"History changed! Expected {teams[0]['name']}, got {found[0]['regu']}"

        # Verify future date resolves to team3
        mem_t3 = requests.get(f"{API}/teams/{t3}/members?date=2026-06-15", headers=hdr(admin_token)).json()
        assert any(m["id"] == eid for m in mem_t3), "Employee not showing in new team after rolling start date"

        # Rollback: re-roll to team1 starting much later than historical, then clean up by re-assigning from original start
        # Simplest cleanup: assign back to t1 start 2026-10-01 so demo attendance in Jan-Jun unaffected
        requests.post(f"{API}/assignments", headers=hdr(admin_token),
                     json={"employee_id": eid, "team_id": t1, "start_date": "2026-10-01"})


# ---------- Export / Backup ----------
class TestExportBackup:
    def test_export_excel(self, viewer_token):
        r = requests.get(f"{API}/export/excel?start=2026-03-01&end=2026-03-31", headers=hdr(viewer_token), timeout=60)
        assert r.status_code == 200
        assert "spreadsheetml" in r.headers.get("content-type", "") or r.headers.get("content-type", "").startswith("application/")
        assert len(r.content) > 1000

    def test_export_pdf(self, viewer_token):
        r = requests.get(f"{API}/export/pdf?start=2026-03-01&end=2026-03-31", headers=hdr(viewer_token), timeout=60)
        assert r.status_code == 200
        assert r.content[:4] == b"%PDF", "Response is not PDF"

    def test_backup_admin_only(self, admin_token, viewer_token):
        r = requests.get(f"{API}/backup", headers=hdr(admin_token), timeout=60)
        assert r.status_code == 200
        rv = requests.get(f"{API}/backup", headers=hdr(viewer_token))
        assert rv.status_code == 403


# ---------- Audit ----------
class TestAudit:
    def test_audit_list(self, admin_token):
        r = requests.get(f"{API}/audit", headers=hdr(admin_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ---------- User management CRUD ----------
class TestUserCRUD:
    def test_create_update_deactivate(self, admin_token):
        payload = {"name": "TEST_User", "email": "test_user_damkar@example.com",
                   "password": "Password123!", "role": "viewer", "status": "ACTIVE"}
        # Clean up if existed: reactivate + update password, or just use PUT if present
        users = requests.get(f"{API}/users", headers=hdr(admin_token)).json()
        existing = next((u for u in users if u["email"] == payload["email"]), None)
        if existing:
            uid = existing["id"]
            # Reset via PUT
            r2 = requests.put(f"{API}/users/{uid}", headers=hdr(admin_token), json=payload)
            assert r2.status_code == 200
        else:
            r = requests.post(f"{API}/users", headers=hdr(admin_token), json=payload)
            assert r.status_code == 200, r.text
            uid = r.json()["id"]
        # Update
        payload["name"] = "TEST_UserUpdated"
        r2 = requests.put(f"{API}/users/{uid}", headers=hdr(admin_token), json=payload)
        assert r2.status_code == 200
        # Verify login works
        tok = _login({"email": payload["email"], "password": "Password123!"})
        assert tok
        # Deactivate
        r3 = requests.delete(f"{API}/users/{uid}", headers=hdr(admin_token))
        assert r3.status_code == 200
        # Login should fail
        r4 = requests.post(f"{API}/auth/login", json={"email": payload["email"], "password": "Password123!"})
        assert r4.status_code in (401, 403)

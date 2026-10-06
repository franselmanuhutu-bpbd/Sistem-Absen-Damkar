"""Tests for Kasubid position management, vacate, roster, recap category, exports."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://damkar-absensi.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "fransel.manuhutu@gmail.com", "password": "Damkar2026!"}
OPERATOR = {"email": "operator@damkar.go.id", "password": "Damkar2026!"}
VIEWER = {"email": "kepala@damkar.go.id", "password": "Damkar2026!"}
STAFF = {"email": "staff@damkar.go.id", "password": "Damkar2026!"}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def hdr(t):
    return {"Authorization": f"Bearer {t}"}


@pytest.fixture(scope="module")
def admin_t():
    return _login(ADMIN)


@pytest.fixture(scope="module")
def operator_t():
    return _login(OPERATOR)


@pytest.fixture(scope="module")
def staff_t():
    return _login(STAFF)


# -------- Kasubid info / status --------
class TestKasubidInfo:
    def test_kasubid_list_has_status(self, admin_t):
        r = requests.get(f"{API}/kasubid", headers=hdr(admin_t))
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 2
        for k in data:
            assert k["position_id"] in ("KASUBID1", "KASUBID2")
            assert k["status"] in ("Aktif", "Kosong")
            assert "history" in k

    def test_kasubid_roster_date(self, admin_t):
        r = requests.get(f"{API}/kasubid/roster?date=2026-06-10", headers=hdr(admin_t))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_org_structure_has_kasubid_status(self, admin_t):
        r = requests.get(f"{API}/org-structure?date=2026-06-10", headers=hdr(admin_t))
        assert r.status_code == 200
        d = r.json()
        assert "kasubid" in d and len(d["kasubid"]) == 2
        for k in d["kasubid"]:
            assert k["status"] in ("Aktif", "Kosong")


# -------- Set / Vacate / Replacement --------
class TestKasubidSetVacate:
    def test_set_duplicate_same_person_rejected(self, admin_t):
        # Use a specific date and read K1 holder on that date, then try setting K2 to same person same date
        d = "2026-09-01"
        info = requests.get(f"{API}/kasubid?date={d}", headers=hdr(admin_t)).json()
        k1 = next(k for k in info if k["position_id"] == "KASUBID1")
        if not k1.get("employee_id"):
            pytest.skip("K1 not filled on test date")
        r = requests.post(f"{API}/kasubid", headers=hdr(admin_t), json={
            "position_id": "KASUBID2", "employee_id": k1["employee_id"], "start_date": d
        })
        assert r.status_code == 400, f"Expected 400, got {r.status_code}: {r.text}"
        assert "sama" in r.text.lower()

    def test_replacement_preserves_history_and_audit(self, admin_t):
        emps = requests.get(f"{API}/employees", headers=hdr(admin_t)).json()
        # exclude anyone who ever held a kasubid position (clean pool)
        info = requests.get(f"{API}/kasubid", headers=hdr(admin_t)).json()
        historical_ids = set()
        for k in info:
            for h in k.get("history", []):
                historical_ids.add(h["employee_id"])
        pool = [e for e in emps if e["status"] == "ACTIVE" and e["id"] not in historical_ids]
        assert len(pool) >= 2
        emp_a, emp_b = pool[0], pool[1]

        # Set A on 2026-04-02 for K2
        r1 = requests.post(f"{API}/kasubid", headers=hdr(admin_t), json={
            "position_id": "KASUBID2", "employee_id": emp_a["id"], "start_date": "2026-04-02"
        })
        assert r1.status_code == 200, r1.text

        # Record attendance on 2026-04-10 -> A is K2 on that date
        requests.post(f"{API}/attendance/batch", headers=hdr(admin_t), json={
            "date": "2026-04-10", "employee_ids": [emp_a["id"]], "status": "HDR"
        })

        # Replace with B on 2026-07-02
        r2 = requests.post(f"{API}/kasubid", headers=hdr(admin_t), json={
            "position_id": "KASUBID2", "employee_id": emp_b["id"], "start_date": "2026-07-02"
        })
        assert r2.status_code == 200, r2.text

        # Roster BEFORE replacement should resolve A
        rb = requests.get(f"{API}/kasubid/roster?date=2026-04-10", headers=hdr(admin_t)).json()
        ids_before = [x["id"] for x in rb if x["position_id"] == "KASUBID2"]
        assert emp_a["id"] in ids_before, f"Expected {emp_a['id']} in {ids_before}"

        # Roster AFTER replacement should resolve B
        ra = requests.get(f"{API}/kasubid/roster?date=2026-08-02", headers=hdr(admin_t)).json()
        ids_after = [x["id"] for x in ra if x["position_id"] == "KASUBID2"]
        assert emp_b["id"] in ids_after, f"Expected {emp_b['id']} in {ids_after}"

        # Audit log contains 'Pergantian pejabat'
        audit = requests.get(f"{API}/audit", headers=hdr(admin_t)).json()
        found = [a for a in audit if "Pergantian pejabat" in a.get("action", "")]
        assert len(found) >= 1

    def test_vacate_position(self, admin_t):
        # Vacate K2 effective 2026-11-01 (should succeed as it's currently filled from prev test)
        info = requests.get(f"{API}/kasubid", headers=hdr(admin_t)).json()
        k2 = next(k for k in info if k["position_id"] == "KASUBID2")
        if not k2.get("employee_id"):
            pytest.skip("K2 not filled")
        r = requests.post(f"{API}/kasubid/vacate", headers=hdr(admin_t), json={
            "position_id": "KASUBID2", "employee_id": "ignored", "start_date": "2026-11-01"
        })
        assert r.status_code == 200, r.text
        # Verify roster on 2026-11-15 excludes K2
        rost = requests.get(f"{API}/kasubid/roster?date=2026-11-15", headers=hdr(admin_t)).json()
        assert all(x["position_id"] != "KASUBID2" for x in rost)
        # Status on that date
        info2 = requests.get(f"{API}/kasubid?date=2026-11-15", headers=hdr(admin_t)).json()
        k2b = next(k for k in info2 if k["position_id"] == "KASUBID2")
        assert k2b["status"] == "Kosong"


# -------- Recap category filter --------
class TestRecapCategory:
    def test_recap_monthly_semua(self, admin_t):
        r = requests.get(f"{API}/recap/monthly?month=2026-06", headers=hdr(admin_t))
        assert r.status_code == 200
        rows = r.json()["rows"]
        cats = {row["category"] for row in rows}
        assert "Staff" in cats
        # kasubid rows ordered first when present
        if "Kasubid" in cats:
            first_cat = rows[0]["category"]
            assert first_cat == "Kasubid"

    def test_recap_monthly_kasubid_only(self, admin_t):
        r = requests.get(f"{API}/recap/monthly?month=2026-06&category=Kasubid", headers=hdr(admin_t))
        assert r.status_code == 200
        rows = r.json()["rows"]
        for row in rows:
            assert row["category"] == "Kasubid"

    def test_recap_monthly_staff_only(self, admin_t):
        r = requests.get(f"{API}/recap/monthly?month=2026-06&category=Staff", headers=hdr(admin_t))
        assert r.status_code == 200
        rows = r.json()["rows"]
        for row in rows:
            assert row["category"] == "Staff"

    def test_recap_period_category(self, admin_t):
        r = requests.get(f"{API}/recap/period?start=2026-04&end=2026-06&category=Kasubid",
                         headers=hdr(admin_t))
        assert r.status_code == 200


# -------- Exports with category --------
class TestExports:
    def test_excel_semua(self, admin_t):
        r = requests.get(f"{API}/export/excel?start=2026-06-01&end=2026-06-30",
                         headers=hdr(admin_t), timeout=60)
        assert r.status_code == 200
        assert len(r.content) > 1000

    def test_excel_kasubid(self, admin_t):
        r = requests.get(f"{API}/export/excel?start=2026-06-01&end=2026-06-30&category=Kasubid",
                         headers=hdr(admin_t), timeout=60)
        assert r.status_code == 200
        assert len(r.content) > 500

    def test_pdf_staff(self, admin_t):
        r = requests.get(f"{API}/export/pdf?start=2026-06-01&end=2026-06-30&category=Staff",
                         headers=hdr(admin_t), timeout=60)
        assert r.status_code == 200
        assert r.content[:4] == b"%PDF"


# -------- RBAC --------
class TestKasubidRBAC:
    def test_operator_cannot_set_kasubid(self, operator_t):
        emps = requests.get(f"{API}/employees", headers=hdr(operator_t))
        # operator may not list employees; try anyway via admin-only POST
        r = requests.post(f"{API}/kasubid", headers=hdr(operator_t),
                          json={"position_id": "KASUBID1", "employee_id": "x", "start_date": "2026-07-01"})
        assert r.status_code == 403

    def test_operator_can_see_roster(self, operator_t):
        r = requests.get(f"{API}/kasubid/roster?date=2026-06-10", headers=hdr(operator_t))
        assert r.status_code == 200

    def test_staff_cannot_set_kasubid(self, staff_t):
        r = requests.post(f"{API}/kasubid", headers=hdr(staff_t),
                          json={"position_id": "KASUBID1", "employee_id": "x", "start_date": "2026-07-01"})
        assert r.status_code == 403

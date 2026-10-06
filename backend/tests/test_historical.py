"""Tests for historical structure: rolling, commander, kasubid, rename, self-service, kasubid recap."""
import os
import requests
import pytest
from datetime import date

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://damkar-absensi.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "fransel.manuhutu@gmail.com", "password": "Damkar2026!"}
STAFF = {"email": "staff@damkar.go.id", "password": "Damkar2026!"}
KASUBID = {"email": "kasubid@damkar.go.id", "password": "Damkar2026!"}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def hdr(t): return {"Authorization": f"Bearer {t}"}


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN)


@pytest.fixture(scope="module")
def staff_token():
    return _login(STAFF)


@pytest.fixture(scope="module")
def kasubid_token():
    return _login(KASUBID)


# -------------------- Historical rolling + period recap label --------------------
class TestHistoricalRolling:
    def test_rolling_historical_months(self, admin_token):
        teams = requests.get(f"{API}/teams", headers=hdr(admin_token)).json()
        t1 = teams[0]; t3 = teams[2]
        # pick a clean employee from t1 at 2026-02-15 that only has 1 assignment
        members = requests.get(f"{API}/teams/{t1['id']}/members?date=2026-02-15",
                               headers=hdr(admin_token)).json()
        chosen = None
        for m in members:
            ar = requests.get(f"{API}/employees/{m['id']}/assignments",
                              headers=hdr(admin_token)).json()
            if len(ar) == 1 and ar[0]["team_id"] == t1["id"]:
                chosen = m
                break
        if not chosen:
            pytest.skip("No clean employee available")
        eid = chosen["id"]
        start = "2026-07-01"

        # Record attendance BEFORE roll (Feb) and will record AFTER (Aug)
        requests.post(f"{API}/attendance/batch", headers=hdr(admin_token),
                      json={"date": "2026-02-10", "employee_ids": [eid], "status": "HDR"})

        # Roll to t3 on 2026-07-01
        r = requests.post(f"{API}/assignments", headers=hdr(admin_token),
                          json={"employee_id": eid, "team_id": t3["id"], "start_date": start})
        assert r.status_code == 200, r.text

        # Attendance after roll
        requests.post(f"{API}/attendance/batch", headers=hdr(admin_token),
                      json={"date": "2026-08-10", "employee_ids": [eid], "status": "HDR"})

        # Feb recap -> old regu
        feb = requests.get(f"{API}/recap/monthly?month=2026-02",
                           headers=hdr(admin_token)).json()
        row = next((x for x in feb["rows"] if x["employee_id"] == eid), None)
        assert row is not None, "Employee missing in Feb recap"
        assert row["regu"] == t1["name"], f"Feb regu wrong: {row['regu']} (expected {t1['name']})"

        # Aug recap -> new regu
        aug = requests.get(f"{API}/recap/monthly?month=2026-08",
                           headers=hdr(admin_token)).json()
        row2 = next((x for x in aug["rows"] if x["employee_id"] == eid), None)
        assert row2 is not None, "Employee missing in Aug recap"
        assert row2["regu"] == t3["name"], f"Aug regu wrong: {row2['regu']}"

        # Period recap Feb..Aug -> label 'Old → New' and breakdown rows per month with correct regu
        per = requests.get(f"{API}/recap/period?start=2026-02&end=2026-08",
                          headers=hdr(admin_token)).json()
        prow = next((x for x in per["rows"] if x["employee_id"] == eid), None)
        assert prow is not None
        assert "→" in prow["regu"], f"Period label missing arrow: {prow['regu']}"
        assert t1["name"] in prow["regu"] and t3["name"] in prow["regu"]

        br = [b for b in per["breakdown"] if b["employee_id"] == eid]
        assert any(b["month"] == "2026-02" and b["regu"] == t1["name"] for b in br), f"Feb breakdown missing: {br}"
        assert any(b["month"] == "2026-08" and b["regu"] == t3["name"] for b in br), f"Aug breakdown missing: {br}"

        # OVERLAP: new start inside the closed historical interval of t1
        # (t1 interval was auto-closed on 2026-06-30 when the roll happened)
        bad = requests.post(f"{API}/assignments", headers=hdr(admin_token),
                            json={"employee_id": eid, "team_id": teams[1]["id"],
                                  "start_date": "2026-04-01"})
        assert bad.status_code == 400, f"Expected overlap error, got {bad.status_code}: {bad.text}"
        assert "bertabrakan" in bad.text.lower() or "overlap" in bad.text.lower()


# -------------------- Rename team --------------------
class TestRenameTeam:
    def test_rename_and_restore(self, admin_token):
        teams = requests.get(f"{API}/teams", headers=hdr(admin_token)).json()
        t = teams[-1]  # pick last team
        orig = t["name"]
        new_name = f"{orig} TEST"
        r = requests.put(f"{API}/teams/{t['id']}/rename", headers=hdr(admin_token),
                         json={"name": new_name})
        assert r.status_code == 200, r.text
        t2 = next(x for x in requests.get(f"{API}/teams", headers=hdr(admin_token)).json() if x["id"] == t["id"])
        assert t2["name"] == new_name
        # restore
        requests.put(f"{API}/teams/{t['id']}/rename", headers=hdr(admin_token),
                     json={"name": orig})


# -------------------- Commander history --------------------
class TestCommander:
    def test_set_commander_historical(self, admin_token):
        teams = requests.get(f"{API}/teams", headers=hdr(admin_token)).json()
        t = teams[0]
        # list current members on 2026-02-01 and 2026-08-01
        early_members = requests.get(f"{API}/teams/{t['id']}/members?date=2026-02-01",
                                     headers=hdr(admin_token)).json()
        # Find an existing member for team 0 that is not current commander
        before = requests.get(f"{API}/org-structure?date=2026-02-01",
                              headers=hdr(admin_token)).json()
        old_cmd_team = next(x for x in before["teams"] if x["id"] == t["id"])
        old_cid = old_cmd_team["commander_id"]
        new_cmd = next((m for m in early_members if m["id"] != old_cid), None)
        if not new_cmd:
            pytest.skip("No candidate member")
        start = "2026-08-01"
        r = requests.post(f"{API}/commanders", headers=hdr(admin_token),
                          json={"team_id": t["id"], "employee_id": new_cmd["id"],
                                "start_date": start})
        assert r.status_code == 200, r.text
        # Before Aug -> old; After Aug -> new
        feb = requests.get(f"{API}/org-structure?date=2026-02-15",
                           headers=hdr(admin_token)).json()
        aug = requests.get(f"{API}/org-structure?date=2026-08-15",
                           headers=hdr(admin_token)).json()
        feb_t = next(x for x in feb["teams"] if x["id"] == t["id"])
        aug_t = next(x for x in aug["teams"] if x["id"] == t["id"])
        assert feb_t["commander_id"] == old_cid
        assert aug_t["commander_id"] == new_cmd["id"]


# -------------------- Kasubid --------------------
class TestKasubid:
    def test_kasubid_duplicate_rejected(self, admin_token):
        # fetch current KASUBID1 holder for today, try to assign same to KASUBID2 on same date -> reject
        today = date.today().isoformat()
        info = requests.get(f"{API}/kasubid?date={today}", headers=hdr(admin_token)).json()
        k1 = next(x for x in info if x["position_id"] == "KASUBID1")
        if not k1["employee_id"]:
            pytest.skip("No KASUBID1 holder")
        r = requests.post(f"{API}/kasubid", headers=hdr(admin_token),
                         json={"position_id": "KASUBID2", "employee_id": k1["employee_id"],
                               "start_date": today})
        assert r.status_code == 400
        assert "sama" in r.text.lower() or "kasubid" in r.text.lower()

    def test_org_structure_has_kasubid(self, admin_token):
        r = requests.get(f"{API}/org-structure?date=2026-03-15", headers=hdr(admin_token)).json()
        assert "kasubid" in r and len(r["kasubid"]) == 2
        assert all(k.get("label") for k in r["kasubid"])


# -------------------- Role access --------------------
class TestRoleAccess:
    def test_staff_cannot_list_users(self, staff_token):
        r = requests.get(f"{API}/users", headers=hdr(staff_token))
        assert r.status_code == 403

    def test_staff_cannot_batch(self, staff_token):
        r = requests.post(f"{API}/attendance/batch", headers=hdr(staff_token),
                          json={"date": "2026-03-15", "employee_ids": [], "status": "HDR"})
        assert r.status_code == 403

    def test_kasubid_can_access_recap_kasubid(self, kasubid_token):
        r = requests.get(f"{API}/recap/kasubid?start=2026-01&end=2026-03",
                         headers=hdr(kasubid_token))
        assert r.status_code == 200

    def test_staff_cannot_access_recap_kasubid(self, staff_token):
        r = requests.get(f"{API}/recap/kasubid?start=2026-01&end=2026-03",
                         headers=hdr(staff_token))
        assert r.status_code == 403


# -------------------- /me/* --------------------
class TestMe:
    def test_me_profile(self, staff_token):
        r = requests.get(f"{API}/me/profile", headers=hdr(staff_token))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["employee"]["nama"]
        assert "team" in d

    def test_me_recap(self, staff_token):
        r = requests.get(f"{API}/me/recap?start=2026-01&end=2026-03",
                         headers=hdr(staff_token))
        assert r.status_code == 200
        d = r.json()
        assert "counts" in d and "dates" in d
        assert isinstance(d["total"], int)

    def test_me_calendar(self, staff_token):
        r = requests.get(f"{API}/me/calendar?month=2026-03", headers=hdr(staff_token))
        assert r.status_code == 200
        assert "days" in r.json()

    def test_me_assignments(self, staff_token):
        r = requests.get(f"{API}/me/assignments", headers=hdr(staff_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# -------------------- Kasubid recap + exports --------------------
class TestKasubidRecap:
    def test_recap_kasubid_structure(self, admin_token):
        r = requests.get(f"{API}/recap/kasubid?start=2026-01&end=2026-03",
                         headers=hdr(admin_token))
        assert r.status_code == 200
        d = r.json()
        assert "positions" in d and len(d["positions"]) == 2
        for p in d["positions"]:
            assert "total" in p and "monthly" in p
            assert len(p["monthly"]) == 3

    def test_export_kasubid_excel(self, admin_token):
        r = requests.get(f"{API}/export/kasubid/excel?start=2026-01&end=2026-03",
                         headers=hdr(admin_token), timeout=60)
        assert r.status_code == 200
        assert len(r.content) > 1000

    def test_export_kasubid_pdf(self, admin_token):
        r = requests.get(f"{API}/export/kasubid/pdf?start=2026-01&end=2026-03",
                         headers=hdr(admin_token), timeout=60)
        assert r.status_code == 200
        assert r.content[:4] == b"%PDF"

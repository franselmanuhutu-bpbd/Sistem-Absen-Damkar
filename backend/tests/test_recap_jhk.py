import asyncio
from unittest.mock import AsyncMock, patch, MagicMock
from utils import _compute_recap, _compute_kasubid_recap, last_day_of_month

def test_compute_recap_jumlah_hari_kerja():
    asyncio.run(_async_test_compute_recap())

async def _async_test_compute_recap():
    # 2026-04 has 30 days
    # Employee 1: 5 OFF -> jhk = 30 - 5 = 25
    # Employee 2: 0 OFF -> jhk = 30 - 0 = 30
    mock_teams = [{"id": "t1", "name": "Regu A"}]
    mock_employees = [
        {"id": "e1", "no": 1, "nip": "1001", "nama": "Budi", "jabatan": "Anggota", "pangkat": "I", "status": "ACTIVE"},
        {"id": "e2", "no": 2, "nip": "1002", "nama": "Siti", "jabatan": "Anggota", "pangkat": "I", "status": "ACTIVE"},
    ]
    mock_attendance = [
        # e1 has 5 OFF and 20 HDR
        *[{"employee_id": "e1", "date": f"2026-04-{i:02d}", "status": "OFF"} for i in range(1, 6)],
        *[{"employee_id": "e1", "date": f"2026-04-{i:02d}", "status": "HDR"} for i in range(6, 26)],
        # e2 has 25 HDR and 0 OFF
        *[{"employee_id": "e2", "date": f"2026-04-{i:02d}", "status": "HDR"} for i in range(1, 26)],
    ]

    with patch("utils.get_db") as mock_get_db, \
         patch("utils.build_intervals", return_value={"e1": [{"employee_id": "e1", "team_id": "t1", "start_date": "2026-01-01"}], "e2": [{"employee_id": "e2", "team_id": "t1", "start_date": "2026-01-01"}]}), \
         patch("utils.resolve_kasubid_for_date", return_value=None), \
         patch("utils.fetch_all", return_value=mock_attendance):
        
        mock_db = MagicMock()
        mock_get_db.return_value = mock_db
        
        # mock table calls
        def table_side_effect(table_name):
            t = MagicMock()
            if table_name == "teams":
                t.select.return_value.execute = AsyncMock(return_value=MagicMock(data=mock_teams))
            elif table_name == "employees":
                t.select.return_value.order.return_value.execute = AsyncMock(return_value=MagicMock(data=mock_employees))
            elif table_name == "sub_unit_assignments":
                t.select.return_value.execute = AsyncMock(return_value=MagicMock(data=[]))
            elif table_name == "attendance":
                t.select.return_value.gte.return_value.lte.return_value = MagicMock()
            return t
        
        mock_db.table.side_effect = table_side_effect

        result = await _compute_recap("2026-04", "2026-04", None)

        rows = {r["employee_id"]: r for r in result["rows"]}
        
        # e1: 30 days in April - 5 OFF = 25
        assert rows["e1"]["OFF"] == 5
        assert rows["e1"]["jumlah_hari_kerja"] == 25
        assert rows["e1"]["total_kehadiran"] == 20

        # e2: 30 days in April - 0 OFF = 30
        assert rows["e2"]["OFF"] == 0
        assert rows["e2"]["jumlah_hari_kerja"] == 30
        assert rows["e2"]["total_kehadiran"] == 25

        # Check breakdown
        bd_e1 = [b for b in result["breakdown"] if b["employee_id"] == "e1"]
        assert len(bd_e1) == 1
        assert bd_e1[0]["OFF"] == 5
        assert bd_e1[0]["jumlah_hari_kerja"] == 25


def test_compute_kasubid_recap_jumlah_hari_kerja():
    asyncio.run(_async_test_compute_kasubid_recap())

async def _async_test_compute_kasubid_recap():
    # 2026-04 has 30 days
    # Position KASUBID1 held by e_kasubid with 4 OFF, 20 HDR -> jhk = 30 - 4 = 26
    mock_employees = [{"id": "ek1", "nama": "Pak Kasubid"}]
    mock_subs = [{"position_id": "KASUBID1", "employee_id": "ek1", "start_date": "2026-01-01", "end_date": None}]
    mock_attendance = [
        *[{"employee_id": "ek1", "date": f"2026-04-{i:02d}", "status": "OFF"} for i in range(1, 5)],
        *[{"employee_id": "ek1", "date": f"2026-04-{i:02d}", "status": "HDR"} for i in range(5, 25)],
    ]

    with patch("utils.get_db") as mock_get_db, \
         patch("utils.fetch_all", return_value=mock_attendance):
        
        mock_db = MagicMock()
        mock_get_db.return_value = mock_db

        def table_side_effect(table_name):
            t = MagicMock()
            if table_name == "sub_unit_assignments":
                t.select.return_value.execute = AsyncMock(return_value=MagicMock(data=mock_subs))
            elif table_name == "employees":
                t.select.return_value.execute = AsyncMock(return_value=MagicMock(data=mock_employees))
            elif table_name == "attendance":
                t.select.return_value.in_.return_value.gte.return_value.lte.return_value = MagicMock()
            return t

        mock_db.table.side_effect = table_side_effect

        result = await _compute_kasubid_recap("2026-04", "2026-04")
        k1 = next(p for p in result["positions"] if p["position_id"] == "KASUBID1")
        
        # 30 days - 4 OFF = 26
        assert k1["OFF"] == 4
        assert k1["jumlah_hari_kerja"] == 26
        assert k1["total_kehadiran"] == 20
        assert k1["monthly"][0]["jumlah_hari_kerja"] == 26


def test_export_excel_and_pdf():
    asyncio.run(_async_test_export_excel_and_pdf())

async def _async_test_export_excel_and_pdf():
    from routers.exports import export_excel, export_pdf, export_kasubid_excel, export_kasubid_pdf
    
    mock_recap_data = {
        "period_label": "April 2026",
        "rows": [
            {
                "employee_id": "e1", "no": 1, "nip": "1001", "nama": "Budi", "jabatan": "Staff",
                "pangkat": "I", "category": "Staff", "regu": "Regu A",
                "HDR": 20, "OFF": 5, "SKT": 0, "TK": 0, "IZN": 0, "DL": 0,
                "total": 25, "jumlah_hari_kerja": 25, "total_kehadiran": 20
            }
        ],
        "breakdown": [
            {
                "employee_id": "e1", "no": 1, "nip": "1001", "nama": "Budi", "regu": "Regu A",
                "month_label": "April 2026",
                "HDR": 20, "OFF": 5, "SKT": 0, "TK": 0, "IZN": 0, "DL": 0,
                "total": 25, "jumlah_hari_kerja": 25, "total_kehadiran": 20
            }
        ],
        "grand_total": {"HDR": 20, "OFF": 5, "SKT": 0, "TK": 0, "IZN": 0, "DL": 0},
        "total_pegawai": 1,
        "jumlah_hari_kerja": 30,
    }

    mock_kasubid_data = {
        "period_label": "April 2026",
        "months": ["2026-04"],
        "positions": [
            {
                "position_id": "KASUBID1", "label": "Kasubid 1", "nama": "Pak Kasubid",
                "HDR": 20, "OFF": 4, "SKT": 0, "TK": 0, "IZN": 0, "DL": 0,
                "jumlah_hari_kerja": 26, "total_kehadiran": 20, "total": 24,
                "monthly": [
                    {
                        "month": "2026-04", "month_label": "April 2026",
                        "HDR": 20, "OFF": 4, "SKT": 0, "TK": 0, "IZN": 0, "DL": 0,
                        "jumlah_hari_kerja": 26, "total_kehadiran": 20, "total": 24
                    }
                ]
            }
        ],
        "detail": [],
        "jumlah_hari_kerja": 30,
    }

    with patch("routers.exports._compute_recap", AsyncMock(return_value=mock_recap_data)):
        res_excel = await export_excel("2026-04", "2026-04", user={"role": "admin"})
        assert res_excel.status_code == 200
        
        res_pdf = await export_pdf("2026-04", "2026-04", user={"role": "admin"})
        assert res_pdf.status_code == 200

    with patch("routers.exports._compute_kasubid_recap", AsyncMock(return_value=mock_kasubid_data)):
        res_k_excel = await export_kasubid_excel("2026-04", "2026-04", user={"role": "admin"})
        assert res_k_excel.status_code == 200

        res_k_pdf = await export_kasubid_pdf("2026-04", "2026-04", user={"role": "admin"})
        assert res_k_pdf.status_code == 200


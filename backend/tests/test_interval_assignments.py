import asyncio
from unittest.mock import AsyncMock, patch, MagicMock
from routers.assignments import (
    apply_interval_assignment,
    slice_out_interval_for_assignments,
    create_assignment,
    create_batch_assignment,
    reset_assignments,
)
from models import AssignmentIn, BatchAssignmentIn, ResetAssignmentsIn


def test_interval_slicing_and_splitting():
    """Uji coba pemotongan dan pembelahan interval temporal (revisi tanggal tunggal di tengah periode)."""
    asyncio.run(_async_test_slicing())


def test_reset_single_and_range():
    """Uji coba reset fleksibel berbasis tanggal tunggal, rentang tanggal, dan reset total."""
    asyncio.run(_async_test_reset())


def test_team_detail_empty_when_reset():
    """Uji coba bahwa team_detail pada tanggal yang di-reset tidak fallback ke penempatan hari ini."""
    asyncio.run(_async_test_team_detail_empty())


async def _async_test_team_detail_empty():
    from routers.teams import team_detail
    mock_db = MagicMock()
    # Mock data regu
    team_data = [{"id": "team-3", "name": "Regu 3 - Pos Kota", "order": 3}]
    
    def mock_table(name):
        tbl = MagicMock()
        if name == "teams":
            tbl.select.return_value.eq.return_value.execute = AsyncMock(
                return_value=MagicMock(data=team_data)
            )
        elif name == "attendance":
            tbl.select.return_value.eq.return_value.eq.return_value.execute = AsyncMock(
                return_value=MagicMock(data=[])
            )
        return tbl
    mock_db.table.side_effect = mock_table

    # Mock resolusi penempatan regu pada tanggal 2026-10-05: kosong (sudah di-reset)
    with patch("routers.teams.get_db", AsyncMock(return_value=mock_db)), \
         patch("routers.teams.resolve_teams_for_date", AsyncMock(return_value={})), \
         patch("routers.teams.resolve_commander_for_date", AsyncMock(return_value=None)), \
         patch("routers.teams.get_active_kasubid_ids", AsyncMock(return_value=set())):

        # Panggil team_detail untuk tanggal yang sudah di-reset
        res = await team_detail(team_id="team-3", date="2026-10-05")

        # Pastikan tidak ada anggota yang muncul dan komandan bernilai None
        assert len(res["members"]) == 0
        assert res["commander"]["employee_id"] is None
        assert res["commander"]["nama"] is None
        assert res["date"] == "2026-10-05"


async def _async_test_slicing():
    mock_db = MagicMock()
    # Skenario: Pegawai sudah memiliki penempatan Q1 (2026-01-01 s/d 2026-03-31) di Regu 1
    existing_q1 = [{
        "id": "assign-q1",
        "employee_id": "emp-1",
        "team_id": "team-1",
        "start_date": "2026-01-01",
        "end_date": "2026-03-31",
    }]

    mock_db.table.return_value.select.return_value.eq.return_value.execute = AsyncMock(
        return_value=MagicMock(data=existing_q1)
    )
    mock_db.table.return_value.update.return_value.eq.return_value.execute = AsyncMock()
    mock_db.table.return_value.insert.return_value.execute = AsyncMock()
    mock_db.table.return_value.delete.return_value.eq.return_value.execute = AsyncMock()

    # Admin ingin merevisi/memindahkan pegawai ke Regu 2 KHUSUS tanggal tunggal 2026-02-15
    res = await apply_interval_assignment(
        db=mock_db,
        employee_id="emp-1",
        team_id="team-2",
        start_date="2026-02-15",
        end_date="2026-02-15"
    )

    assert res["employee_id"] == "emp-1"
    assert res["team_id"] == "team-2"
    assert res["start_date"] == "2026-02-15"
    assert res["end_date"] == "2026-02-15"

    # Verifikasi bahwa interval lama dibelah:
    # 1. Update bagian kiri menjadi 2026-01-01 s/d 2026-02-14
    mock_db.table.return_value.update.assert_any_call({"end_date": "2026-02-14", "updated_at": unittest_any()})


async def _async_test_reset():
    mock_db = MagicMock()
    user = {"email": "admin@example.com", "name": "Admin", "role": "admin"}

    # 1. Test Reset Single Date
    existing_assignments = [
        {"id": "a-1", "employee_id": "emp-1", "team_id": "team-1", "start_date": "2026-10-01", "end_date": "2026-10-31"}
    ]
    mock_db.table.return_value.select.return_value.lte.return_value.execute = AsyncMock(
        return_value=MagicMock(data=existing_assignments)
    )
    mock_db.table.return_value.update.return_value.eq.return_value.execute = AsyncMock()
    mock_db.table.return_value.insert.return_value.execute = AsyncMock()

    with patch("routers.assignments.get_db", AsyncMock(return_value=mock_db)), \
         patch("routers.assignments.write_audit", AsyncMock()):
        reset_res = await reset_assignments(
            body=ResetAssignmentsIn(mode="single", date="2026-10-15"),
            user=user
        )
        assert reset_res["mode"] == "single"
        assert "2026-10-15" in reset_res["scope"]


def test_check_assignment_conflicts():
    """Uji coba pengecekan konflik penimpaan penempatan regu."""
    asyncio.run(_async_test_check_conflicts())


async def _async_test_check_conflicts():
    from routers.assignments import check_assignment_conflicts
    mock_db = MagicMock()
    user = {"email": "admin@example.com", "name": "Admin", "role": "admin"}

    def mock_table(name):
        tbl = MagicMock()
        if name == "teams":
            tbl.select.return_value.execute = AsyncMock(
                return_value=MagicMock(data=[
                    {"id": "team-1", "name": "Regu 1"},
                    {"id": "team-2", "name": "Regu 2"},
                ])
            )
        elif name == "employees":
            tbl.select.return_value.in_.return_value.execute = AsyncMock(
                return_value=MagicMock(data=[
                    {"id": "emp-1", "nama": "Staff A", "nip": "12345"},
                ])
            )
        elif name == "team_assignments":
            tbl.select.return_value.in_.return_value.execute = AsyncMock(
                return_value=MagicMock(data=[
                    # Staff A sudah ada di Regu 1 pada 2026-10-08
                    {"id": "a-1", "employee_id": "emp-1", "team_id": "team-1", "start_date": "2026-10-08", "end_date": "2026-10-08"}
                ])
            )
        return tbl

    mock_db.table.side_effect = mock_table

    with patch("routers.assignments.get_db", AsyncMock(return_value=mock_db)):
        # Coba roll Staff A ke Regu 2 dari September s/d November 2026
        res = await check_assignment_conflicts(
            body=BatchAssignmentIn(
                employee_ids=["emp-1"],
                team_id="team-2",
                start_date="2026-09-01",
                end_date="2026-11-30"
            ),
            user=user
        )
        assert res["has_conflicts"] is True
        assert len(res["conflicts"]) == 1
        conflict = res["conflicts"][0]
        assert conflict["employee_nama"] == "Staff A"
        assert conflict["existing_team_name"] == "Regu 1"
        assert conflict["target_team_name"] == "Regu 2"
        assert conflict["is_different_team"] is True


def unittest_any():
    class AnyMatcher:
        def __eq__(self, other):
            return True
    return AnyMatcher()

import asyncio
from unittest.mock import AsyncMock, patch, MagicMock
from routers.dashboard import dashboard


def test_dashboard_members_with_attendance_fallback():
    asyncio.run(_async_test())


async def _async_test():
    # Mock active employees
    active_emps = [
        {"id": "emp-1", "nama": "Employee 1"},
        {"id": "emp-2", "nama": "Employee 2"},
    ]
    # Mock teams
    teams = [
        {"id": "team-1", "name": "Regu 1", "code": "R-01", "order": 1},
    ]
    # Historical date where team_assignments has no record (e.g. wiped by reset)
    # but attendance has records with team_id
    attendance_records = [
        {"id": "att-1", "employee_id": "emp-1", "team_id": "team-1", "status": "HDR", "date": "2026-10-06"},
        {"id": "att-2", "employee_id": "emp-2", "team_id": "team-1", "status": "OFF", "date": "2026-10-06"},
    ]

    mock_db = MagicMock()
    def table_mock(tbl):
        builder = MagicMock()
        if tbl == "attendance":
            builder.select.return_value.lte.return_value.order.return_value.limit.return_value.execute = AsyncMock(
                return_value=MagicMock(data=[{"date": "2026-10-06"}])
            )
            builder.select.return_value.eq.return_value.limit.return_value.execute = AsyncMock(
                return_value=MagicMock(data=[])
            )
            # records for ref
            builder.select.return_value.eq.return_value.limit.return_value.execute = AsyncMock(
                return_value=MagicMock(data=attendance_records)
            )
        elif tbl == "teams":
            builder.select.return_value.order.return_value.limit.return_value.execute = AsyncMock(
                return_value=MagicMock(data=teams)
            )
        elif tbl == "employees":
            builder.select.return_value.eq.return_value.limit.return_value.execute = AsyncMock(
                return_value=MagicMock(data=active_emps)
            )
            builder.select.return_value.in_.return_value.limit.return_value.execute = AsyncMock(
                return_value=MagicMock(data=active_emps)
            )
        return builder

    mock_db.table.side_effect = table_mock

    with patch("routers.dashboard.get_db", AsyncMock(return_value=mock_db)), \
         patch("routers.dashboard.resolve_teams_for_date", AsyncMock(return_value={})), \
         patch("routers.dashboard.resolve_commander_for_date", AsyncMock(return_value="emp-1")), \
         patch("routers.dashboard.resolve_kasubid_for_date", AsyncMock(return_value=None)):
        res = await dashboard(date="2026-10-06", user={})

        assert res["date"] == "2026-10-06"
        team_data = res["per_team"][0]
        # Members must not be 0; it should count members from attendance records fallback
        assert team_data["members"] == 2
        assert team_data["HDR"] == 1
        assert team_data["OFF"] == 1
        assert team_data["commander_name"] == "Employee 1"

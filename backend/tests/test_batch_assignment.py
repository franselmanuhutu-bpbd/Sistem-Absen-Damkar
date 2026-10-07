import asyncio
from unittest.mock import AsyncMock, patch, MagicMock
from routers.assignments import create_batch_assignment
from models import BatchAssignmentIn


def test_batch_assignment():
    asyncio.run(_async_test())


async def _async_test():
    mock_db = MagicMock()
    mock_user = {"email": "admin@example.com", "name": "Admin", "role": "admin"}

    body = BatchAssignmentIn(
        employee_ids=["emp-1", "emp-2"],
        team_id="team-1",
        start_date="2026-10-07",
    )

    def table_mock(tbl):
        builder = MagicMock()
        if tbl == "teams":
            builder.select.return_value.eq.return_value.execute = AsyncMock(
                return_value=MagicMock(data=[{"id": "team-1", "name": "Regu 1 - Pos Kota"}])
            )
        elif tbl == "employees":
            builder.select.return_value.in_.return_value.execute = AsyncMock(
                return_value=MagicMock(data=[
                    {"id": "emp-1", "nama": "Budi"},
                    {"id": "emp-2", "nama": "Siti"},
                ])
            )
        elif tbl == "team_assignments":
            builder.select.return_value.in_.return_value.execute = AsyncMock(
                return_value=MagicMock(data=[])
            )
            builder.update.return_value.eq.return_value.execute = AsyncMock(
                return_value=MagicMock(data=[])
            )
            builder.insert.return_value.execute = AsyncMock(
                return_value=MagicMock(data=[])
            )
        elif tbl == "audit_logs":
            builder.insert.return_value.execute = AsyncMock(
                return_value=MagicMock(data=[])
            )
        return builder

    mock_db.table.side_effect = table_mock

    with patch("routers.assignments.get_db", AsyncMock(return_value=mock_db)), \
         patch("routers.assignments.write_audit", AsyncMock()):
        res = await create_batch_assignment(body=body, user=mock_user)
        assert res["count"] == 2
        assert res["team_name"] == "Regu 1 - Pos Kota"
        assert res["start_date"] == "2026-10-07"

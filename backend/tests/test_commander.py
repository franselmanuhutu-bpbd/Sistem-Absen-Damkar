import asyncio
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi import HTTPException
from models import CommanderIn
from routers.teams import set_commander, delete_commander


def test_commander_conflict_and_override():
    asyncio.run(_async_test_conflict_and_override())


def test_commander_smooth_transition():
    asyncio.run(_async_test_smooth_transition())


def test_commander_delete():
    asyncio.run(_async_test_delete())


async def _async_test_conflict_and_override():
    mock_db = MagicMock()
    # Team & employee records
    mock_emp = [{"id": "calvin-id", "nama": "Calvin Arthur Tanser, S.E"}]
    mock_team = [{"id": "team-1", "name": "Regu 1 - Pos Kota"}]

    # Existing records: Daud on 2026-10-08, Calvin on 2026-10-09
    existing_commanders = [
        {"id": "c1", "team_id": "team-1", "employee_id": "daud-id", "start_date": "2026-10-08", "end_date": "2026-10-08"},
        {"id": "c2", "team_id": "team-1", "employee_id": "calvin-id", "start_date": "2026-10-09", "end_date": None},
    ]

    deleted_ids = []
    inserted_docs = []

    def mock_table(name):
        tbl = MagicMock()
        if name == "employees":
            tbl.select.return_value.eq.return_value.execute = AsyncMock(return_value=MagicMock(data=mock_emp))
            tbl.select.return_value.execute = AsyncMock(return_value=MagicMock(data=[
                {"id": "daud-id", "nama": "Daud R. Metaloby"},
                {"id": "calvin-id", "nama": "Calvin Arthur Tanser, S.E"}
            ]))
        elif name == "teams":
            tbl.select.return_value.eq.return_value.execute = AsyncMock(return_value=MagicMock(data=mock_team))
        elif name == "team_commanders":
            tbl.select.return_value.eq.return_value.execute = AsyncMock(return_value=MagicMock(data=list(existing_commanders)))
            def mock_delete():
                del_obj = MagicMock()
                del_obj.eq = lambda field, val: MagicMock(execute=AsyncMock(side_effect=lambda: deleted_ids.append(val)))
                return del_obj
            tbl.delete = mock_delete
            tbl.insert = lambda doc: MagicMock(execute=AsyncMock(side_effect=lambda: inserted_docs.append(doc)))
            tbl.update = lambda update_dict: MagicMock(eq=lambda field, val: MagicMock(execute=AsyncMock()))
        return tbl

    mock_db.table.side_effect = mock_table
    user = {"email": "admin@damkar.go.id", "name": "Admin", "role": "admin"}

    with patch("routers.teams.get_db", AsyncMock(return_value=mock_db)), \
         patch("routers.teams.write_audit", AsyncMock()):

        # 1. Setting Calvin on 2026-10-01 without override -> should raise 409
        body_no_override = CommanderIn(team_id="team-1", employee_id="calvin-id", start_date="2026-10-01", override=False)
        try:
            await set_commander(body_no_override, user=user)
            assert False, "Should have raised HTTPException 409"
        except HTTPException as e:
            assert e.status_code == 409
            assert len(e.detail["conflicts"]) == 2

        # 2. Setting Calvin on 2026-10-01 with override=True -> should delete conflicts and succeed
        body_override = CommanderIn(team_id="team-1", employee_id="calvin-id", start_date="2026-10-01", override=True)
        res = await set_commander(body_override, user=user)
        assert res["employee_id"] == "calvin-id"
        assert res["start_date"] == "2026-10-01"
        assert res["end_date"] is None
        assert "c1" in deleted_ids
        assert "c2" in deleted_ids


async def _async_test_smooth_transition():
    mock_db = MagicMock()
    mock_emp = [{"id": "new-id", "nama": "New Commander"}]
    mock_team = [{"id": "team-1", "name": "Regu 1"}]

    # Existing: Old commander active from 2026-09-01 onwards (no end date)
    existing_commanders = [
        {"id": "old-c", "team_id": "team-1", "employee_id": "old-id", "start_date": "2026-09-01", "end_date": None},
    ]

    updated_calls = []

    def mock_table(name):
        tbl = MagicMock()
        if name == "employees":
            tbl.select.return_value.eq.return_value.execute = AsyncMock(return_value=MagicMock(data=mock_emp))
            tbl.select.return_value.execute = AsyncMock(return_value=MagicMock(data=[]))
        elif name == "teams":
            tbl.select.return_value.eq.return_value.execute = AsyncMock(return_value=MagicMock(data=mock_team))
        elif name == "team_commanders":
            tbl.select.return_value.eq.return_value.execute = AsyncMock(return_value=MagicMock(data=list(existing_commanders)))
            def mock_update(d):
                up_obj = MagicMock()
                up_obj.eq = lambda field, val: MagicMock(execute=AsyncMock(side_effect=lambda: updated_calls.append((val, d))))
                return up_obj
            tbl.update = mock_update
            tbl.insert = lambda doc: MagicMock(execute=AsyncMock())
        return tbl

    mock_db.table.side_effect = mock_table
    user = {"email": "admin@damkar.go.id", "name": "Admin", "role": "admin"}

    with patch("routers.teams.get_db", AsyncMock(return_value=mock_db)), \
         patch("routers.teams.write_audit", AsyncMock()):

        # Setting new commander starting 2026-10-01 without override -> smooth transition, no conflict!
        body = CommanderIn(team_id="team-1", employee_id="new-id", start_date="2026-10-01", override=False)
        res = await set_commander(body, user=user)
        assert res["start_date"] == "2026-10-01"
        assert len(updated_calls) == 1
        assert updated_calls[0][0] == "old-c"
        assert updated_calls[0][1]["end_date"] == "2026-09-30"


async def _async_test_delete():
    mock_db = MagicMock()
    mock_cmd = [{"id": "c1", "start_date": "2026-10-01"}]
    deleted = []

    def mock_table(name):
        tbl = MagicMock()
        if name == "team_commanders":
            tbl.select.return_value.eq.return_value.execute = AsyncMock(return_value=MagicMock(data=mock_cmd))
            tbl.delete = lambda: MagicMock(eq=lambda f, v: MagicMock(execute=AsyncMock(side_effect=lambda: deleted.append(v))))
        return tbl

    mock_db.table.side_effect = mock_table
    user = {"email": "admin@damkar.go.id", "name": "Admin", "role": "admin"}

    with patch("routers.teams.get_db", AsyncMock(return_value=mock_db)), \
         patch("routers.teams.write_audit", AsyncMock()):
        res = await delete_commander("c1", user=user)
        assert res["ok"] is True
        assert "c1" in deleted

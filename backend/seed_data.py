"""Master employee and team reference data imported from 'Project Absen.xlsx' (DAMKAR Mimika).
Provides seeding logic for structure and master data only (teams, employees, assignments).
User accounts and attendance records are not pre-generated and should be created explicitly.
"""

import os
import uuid
import logging
from pathlib import Path
from datetime import datetime, timezone
from dotenv import load_dotenv
from supabase import create_client, Client

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")
load_dotenv(ROOT_DIR.parent / ".env")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("seed")

SEED_EMPLOYEES = [
    {"no": 1, "nama": "Yosep Bleskadit", "nip": "198101152006051004", "pangkat": "III/a", "jabatan": "Kepala Sub Bidang Pencegahan Kebakaran"},
    {"no": 2, "nama": "Daud R. Metaloby, A.Md", "nip": "197712212006051001", "pangkat": "III/c", "jabatan": "Staf Subbid Penanggulangan Kebakaran"},
    {"no": 3, "nama": "Tedi Triyanto, S.E", "nip": "198408032015101001", "pangkat": "III/a", "jabatan": "Staf Subbid Penanggulangan Kebakaran"},
    {"no": 4, "nama": "Mitodius Kanipiyau", "nip": "198507052011041001", "pangkat": "II/d", "jabatan": "Staf Subbid Penanggulangan Kebakaran"},
    {"no": 5, "nama": "Martinus Paukeyauta", "nip": "198504062011041001", "pangkat": "II/c", "jabatan": "Staf Subbid Pencegahan Kebakaran"},
    {"no": 6, "nama": "Philipus Ukapoka", "nip": "197809092011041001", "pangkat": "II/c", "jabatan": "Staf Subbid Pencegahan Kebakaran"},
    {"no": 7, "nama": "Soleman Luis Waroy", "nip": "198511292011041001", "pangkat": "II/c", "jabatan": "Staf Subbid Pencegahan Kebakaran"},
    {"no": 8, "nama": "Detius Dekme", "nip": "1991122120150511001", "pangkat": "II/b", "jabatan": "Staf Subbid Pencegahan Kebakaran"},
    {"no": 9, "nama": "Daud Pali", "nip": "197006102015101001", "pangkat": "II/b", "jabatan": "Staf Subbid Penanggulangan Kebakaran"},
    {"no": 10, "nama": "Lakus Elier", "nip": "198311292021031001", "pangkat": "II/a", "jabatan": "Staf Subbid Pencegahan Kebakaran"},
    {"no": 11, "nama": "Yakobus Rahayaan", "nip": "2002041822025061009", "pangkat": "II/a", "jabatan": "Staf Subbid Penanggulangan Kebakaran"},
    {"no": 12, "nama": "Defron Dedy Tabuni", "nip": "200111262025061009", "pangkat": "II/a", "jabatan": "Staf Subbid Pencegahan Kebakaran"},
    {"no": 13, "nama": "Yohanis Solme", "nip": "199212082023071001", "pangkat": "II/a", "jabatan": "Staf Subbid Pencegahan Kebakaran"},
    {"no": 14, "nama": "Steven Stenly Paat", "nip": "199109222025061005", "pangkat": "II/a", "jabatan": "Staf Subbid Penanggulangan Kebakaran"},
    {"no": 15, "nama": "Mahather Muhamad Rumonin", "nip": "200009192025061013", "pangkat": "II/a", "jabatan": "Staf Subbid Pencegahan Kebakaran"},
    {"no": 16, "nama": "Frans Deda", "nip": "198610152023071001", "pangkat": "II/a", "jabatan": "Staf Subbid Penanggulangan Kebakaran"},
    {"no": 17, "nama": "Sepnad Jelli Blesia", "nip": "199007172025061007", "pangkat": "II/a", "jabatan": "Staf Subbid Penanggulangan Kebakaran"},
    {"no": 18, "nama": "Emilianus Mawiyuta", "nip": "199209242023071001", "pangkat": "II/a", "jabatan": "Staf Subbid Pencegahan Kebakaran"},
    {"no": 19, "nama": "Rainsyah Asyura Juniart Islam Djafa", "nip": "200606162025061004", "pangkat": "II/a", "jabatan": "Staf Subbid Pencegahan Kebakaran"},
    {"no": 20, "nama": "Ladani Sumaela", "nip": "199210282025061007", "pangkat": "II/a", "jabatan": "Staf Subbid Pencegahan Kebakaran"},
    {"no": 21, "nama": "Jerrysanda Y.P.W. Wenda", "nip": "200406012025061004", "pangkat": "II/a", "jabatan": "Staf Subbid Pencegahan Kebakaran"},
    {"no": 22, "nama": "Dikwan Einsen Waromi", "nip": "199506282025061009", "pangkat": "II/a", "jabatan": "Staf Subbid Penanggulangan Kebakaran"},
    {"no": 23, "nama": "Yordan Agustinus Morin", "nip": "200208072025061004", "pangkat": "II/a", "jabatan": "Staf Subbid Pencegahan Kebakaran"},
    {"no": 24, "nama": "Irvin Carolis Rayaar", "nip": "199910132025061006", "pangkat": "II/a", "jabatan": "Staf Subbid Penanggulangan Kebakaran"},
    {"no": 25, "nama": "Sam Billy Bertho Rumboryas", "nip": "199509092025061008", "pangkat": "II/a", "jabatan": "Staf Subbid Penanggulangan Kebakaran"},
    {"no": 26, "nama": "John W. Waromi, S.IP", "nip": "199204242025211177", "pangkat": "IX", "jabatan": "Staf Subbid Pencegahan Kebakaran"},
    {"no": 27, "nama": "Calvin Arthur Tanser, S.E", "nip": "199711082025211097", "pangkat": "IX", "jabatan": "Staf Subbid Pencegahan Kebakaran"},
    {"no": 28, "nama": "Kasrach Julian Adriaansz, A.Md", "nip": "198702112025211131", "pangkat": "VII", "jabatan": "Staf Subbid Penanggulangan Kebakaran"},
    {"no": 29, "nama": "Yusup, A.Md., Kep", "nip": "198903182025211148", "pangkat": "VII", "jabatan": "Staf Subbid Pencegahan Kebakaran"},
    {"no": 30, "nama": "Hasan Tofer", "nip": "198409292025211109", "pangkat": "V", "jabatan": "Staf Subbid Pencegahan Kebakaran"},
    {"no": 31, "nama": "Yunus Solme", "nip": "200006132025211041", "pangkat": "V", "jabatan": "Staf Subbid Penanggulangan Kebakaran"},
    {"no": 32, "nama": "Eric Actriv Soselisa", "nip": "199304042025211253", "pangkat": "V", "jabatan": "Staf Subbid Penanggulangan Kebakaran"},
    {"no": 33, "nama": "Frandovalen Tuaputimain", "nip": "199307262025211102", "pangkat": "V", "jabatan": "Staf Subbid Pencegahan Kebakaran"},
    {"no": 34, "nama": "Petrus Ola Boli", "nip": "198305232025211117", "pangkat": "V", "jabatan": "Staf Subbid Penanggulangan Kebakaran"},
    {"no": 35, "nama": "Eron Mofu", "nip": "198412232025211097", "pangkat": "V", "jabatan": "Staf Subbid Pencegahan Kebakaran"},
    {"no": 36, "nama": "Yohanes Kelake Duran", "nip": "BELUM TERBIT SK", "pangkat": "V", "jabatan": "Staf Subbid Penanggulangan Kebakaran"},
    {"no": 37, "nama": "Tenus Kum", "nip": "198509092025211157", "pangkat": "V", "jabatan": "Staf Subbid Penanggulangan Kebakaran"},
    {"no": 38, "nama": "Norbertus Pulung", "nip": "198011122023211006", "pangkat": "V", "jabatan": "Staf Subbid Pencegahan Kebakaran"},
    {"no": 39, "nama": "Joseph Bros Alen Syatauw", "nip": "199202202025211164", "pangkat": "V", "jabatan": "Staf Subbid Pencegahan Kebakaran"},
    {"no": 40, "nama": "Muhajin Ginuni", "nip": "199006132025211125", "pangkat": "V", "jabatan": "Staf Subbid Penanggulangan Kebakaran"},
    {"no": 41, "nama": "Christian Lossu", "nip": "199705242025211109", "pangkat": "V", "jabatan": "Staf Subbid Pencegahan Kebakaran"},
    {"no": 42, "nama": "Mozes Karafir", "nip": "198910152025211151", "pangkat": "V", "jabatan": "Staf Subbid Pencegahan Kebakaran"},
    {"no": 43, "nama": "Emer Yustus Kabes", "nip": "199212132025211105", "pangkat": "V", "jabatan": "Staf Subbid Penanggulangan Kebakaran"},
    {"no": 44, "nama": "Yulius Palullungan", "nip": "198407082025211121", "pangkat": "V", "jabatan": "Staf Subbid Penanggulangan Kebakaran"},
    {"no": 45, "nama": "Jefry Bonay", "nip": "BELUM TERBIT SK", "pangkat": "V", "jabatan": "Staf Subbid Pencegahan Kebakaran"},
    {"no": 46, "nama": "Fernando Kuum", "nip": "TIDAK TERCANTUM", "pangkat": "V", "jabatan": "Staf Subbid Pencegahan Kebakaran"},
    {"no": 47, "nama": "Gerry Sahetapy, S.E", "nip": "200008122025211043", "pangkat": "V", "jabatan": "Staf Subbid Penanggulangan Kebakaran"},
    {"no": 48, "nama": "Joni Tombeng", "nip": "198806132025211138", "pangkat": "V", "jabatan": "Staf Subbid Pencegahan Kebakaran"},
    {"no": 49, "nama": "Ruben Okoka", "nip": "198511032025211116", "pangkat": "V", "jabatan": "Staf Subbid Pencegahan Kebakaran"},
    {"no": 50, "nama": "John Oktovianus Nuboba", "nip": "198310012025211113", "pangkat": "V", "jabatan": "Staf Subbid Penanggulangan Kebakaran"},
    {"no": 51, "nama": "Yance Amisin", "nip": "198006142023211005", "pangkat": "V", "jabatan": "Staf Subbid Pencegahan Kebakaran"},
    {"no": 52, "nama": "Erryck John Rumere", "nip": "199205122025211154", "pangkat": "V", "jabatan": "Staf Subbid Pencegahan Kebakaran"},
    {"no": 53, "nama": "Yulianus Amisin", "nip": "199106222023071001", "pangkat": "V", "jabatan": "Staf Subbid Pencegahan Kebakaran"},
    {"no": 54, "nama": "Yunus Alomang", "nip": "199206122015051001", "pangkat": "V", "jabatan": "Staf Subbid Pencegahan Kebakaran"},
]

SEED_TEAMS = [
    {"name": "Regu 1", "code": "R-01", "order": 1},
    {"name": "Regu 2", "code": "R-02", "order": 2},
    {"name": "Regu 3", "code": "R-03", "order": 3},
    {"name": "Regu 4", "code": "R-04", "order": 4},
    {"name": "Regu 5", "code": "R-05", "order": 5},
    {"name": "Regu 6", "code": "R-06", "order": 6},
]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_client() -> Client:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SECRET_KEY")
    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_SECRET_KEY must be set in .env")
    return create_client(url, key)


def seed_master_data(client: Client = None):
    """Seed master structural data (teams and employees) into Supabase PostgreSQL."""
    if client is None:
        client = get_client()

    logger.info("Verifying tables in Supabase PostgreSQL...")
    try:
        client.table("teams").select("id").limit(1).execute()
    except Exception as e:
        logger.error("Could not query 'teams' table. Ensure schema is deployed!")
        raise RuntimeError("Tables do not exist in database.") from e

    # 1. Seed Teams
    team_ids = {}
    existing_teams = client.table("teams").select("*").execute().data
    existing_by_code = {t["code"]: t["id"] for t in existing_teams}
    for t in SEED_TEAMS:
        if t["code"] in existing_by_code:
            team_ids[t["order"]] = existing_by_code[t["code"]]
        else:
            tid = str(uuid.uuid4())
            logger.info(f"Creating team: {t['name']} ({t['code']})")
            client.table("teams").insert({"id": tid, **t}).execute()
            team_ids[t["order"]] = tid

    # 2. Seed Employees
    existing_employees = client.table("employees").select("id,no").order("no").execute().data
    emp_ids = []
    if not existing_employees:
        logger.info(f"Seeding {len(SEED_EMPLOYEES)} master employees...")
        emp_records = []
        for e in SEED_EMPLOYEES:
            eid = str(uuid.uuid4())
            emp_ids.append(eid)
            emp_records.append({
                "id": eid,
                "no": e["no"],
                "nama": e["nama"],
                "nip": e["nip"],
                "pangkat": e["pangkat"],
                "jabatan": e["jabatan"],
                "status": "ACTIVE",
                "created_at": now_iso(),
            })
        client.table("employees").insert(emp_records).execute()
    else:
        emp_ids = [e["id"] for e in existing_employees]

    # 3. Team Assignments (distribute employees across 6 teams)
    existing_assigns = client.table("team_assignments").select("id").limit(1).execute().data
    if not existing_assigns and emp_ids:
        logger.info("Setting initial team assignments across teams...")
        order_list = sorted(team_ids.keys())
        assign_records = []
        for i, eid in enumerate(emp_ids):
            tid = team_ids[order_list[i % len(order_list)]]
            assign_records.append({
                "id": str(uuid.uuid4()),
                "employee_id": eid,
                "team_id": tid,
                "start_date": "2026-01-01",
                "end_date": None,
                "created_at": now_iso(),
            })
        client.table("team_assignments").insert(assign_records).execute()

    # 4. Team Commanders
    existing_cmd = client.table("team_commanders").select("id").limit(1).execute().data
    if not existing_cmd and emp_ids:
        logger.info("Setting initial team commanders...")
        cmd_records = []
        order_list = sorted(team_ids.keys())
        for i, order in enumerate(order_list):
            tid = team_ids[order]
            member_eid = emp_ids[i]
            cmd_records.append({
                "id": str(uuid.uuid4()),
                "team_id": tid,
                "employee_id": member_eid,
                "start_date": "2026-01-01",
                "end_date": None,
                "created_at": now_iso(),
                "updated_at": now_iso(),
            })
        client.table("team_commanders").insert(cmd_records).execute()

    logger.info("Master data verification completed successfully!")


if __name__ == "__main__":
    try:
        seed_master_data()
        print("\n--> Master data seeded successfully.")
    except Exception as exc:
        print(f"\n--> FAILED: {exc}")

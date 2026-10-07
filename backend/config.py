from dotenv import load_dotenv
from pathlib import Path
import os
import logging

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")
load_dotenv(ROOT_DIR.parent / ".env")

# Supabase / PostgREST settings
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SECRET_KEY = os.environ.get("SUPABASE_SECRET_KEY")
SUPABASE_PUBLISHABLE_KEY = os.environ.get("SUPABASE_PUBLISHABLE_KEY")

# Standard PostgreSQL connection URL (e.g. Supabase pooler/direct, Neon, Railway, Docker, RDS)
DATABASE_URL = os.environ.get("POSTGRESQL_DATABASE_URL")

# Auth Configuration
JWT_SECRET = os.environ.get("JWT_SECRET")
JWT_ALG = "HS256"

# Web Push (VAPID) Settings
VAPID_PUBLIC_KEY = os.environ.get("VAPID_PUBLIC_KEY", "BOqmEeXmOiAZZQHYR015T2DClxPb6HDHqD-ZRenoLxwhYgWrwKS9MzCOAbLJGRNwFp-t0HzTaotkwyEYS_yA9M8")
VAPID_PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY", "ziQlouKeqqHfwbkhlJNQkyT_OMMDwO9o3p7J-_dT5NI")
VAPID_CLAIM_EMAIL = os.environ.get("VAPID_CLAIM_EMAIL", "mailto:fransel.manuhutu@gmail.com")

# System Constants
STATUSES = ["HDR", "OFF", "SKT", "TK", "IZN", "DL"]
STATUS_LABEL = {
    "HDR": "Hadir",
    "OFF": "Off",
    "SKT": "Sakit",
    "TK": "Tanpa Keterangan",
    "IZN": "Izin",
    "DL": "Dinas Luar",
}
STATUS_HEX = {
    "HDR": "16A34A",
    "OFF": "64748B",
    "SKT": "2563EB",
    "TK": "DC2626",
    "IZN": "D97706",
    "DL": "9333EA",
}
ALLOWED_ROLES = ("admin", "operator", "viewer", "komandan", "kasubid", "staff")
KASUBID_POSITIONS = [("KASUBID1", "Kasubid 1"), ("KASUBID2", "Kasubid 2")]

# Logger
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("damkar")

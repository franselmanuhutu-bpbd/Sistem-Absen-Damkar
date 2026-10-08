from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class EmployeeIn(BaseModel):
    nama: str
    nip: str = ""
    pangkat: str = ""
    jabatan: str = ""


class UserIn(BaseModel):
    name: str
    email: EmailStr
    password: Optional[str] = None
    role: str = "operator"
    status: str = "ACTIVE"
    employee_id: Optional[str] = None


class TeamIn(BaseModel):
    name: str
    code: str
    order: int = 1


class TeamRenameIn(BaseModel):
    name: str


class AssignmentIn(BaseModel):
    employee_id: str
    team_id: str
    start_date: str
    end_date: Optional[str] = None


class BatchAssignmentIn(BaseModel):
    # Model untuk penempatan massal beberapa pegawai ke satu regu
    employee_ids: List[str]
    team_id: str
    start_date: str
    end_date: Optional[str] = None


class ResetAssignmentsIn(BaseModel):
    # Model untuk reset penempatan regu dengan fleksibilitas tanggal
    mode: str = "all"  # Opsi mode: "single" (1 hari), "range" (rentang tanggal), "all" (semua tanggal)
    date: Optional[str] = None  # Tanggal acuan jika mode == "single" (format YYYY-MM-DD)
    start_date: Optional[str] = None  # Tanggal mulai jika mode == "range" (format YYYY-MM-DD)
    end_date: Optional[str] = None  # Tanggal akhir jika mode == "range" (format YYYY-MM-DD)
    team_id: Optional[str] = None  # ID regu spesifik yang ingin direset, atau None untuk semua regu
    reset_attendance_teams: bool = True  # Apakah kolom team_id di data absensi terkait ikut dikosongkan


class CommanderIn(BaseModel):
    team_id: str
    employee_id: str
    start_date: str


class KasubidIn(BaseModel):
    position_id: str
    employee_id: Optional[str] = None
    start_date: str


class BatchAttendanceIn(BaseModel):
    date: str
    employee_ids: List[str]
    status: str

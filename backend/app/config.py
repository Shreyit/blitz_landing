import os
import json
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./data/blitz.db")
PUBLIC_URL = os.getenv("PUBLIC_URL", "http://localhost:3000").rstrip("/")
PRODUCTION = os.getenv("PRODUCTION", "false").lower() == "true"
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "")
SESSION_SECRET = os.getenv("SESSION_SECRET", "")
ALLOWED_ORIGINS = set(
    os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(
        ","
    )
)
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "./data/photos"))
REGISTRATION_OPTIONS = json.loads(
    (Path(__file__).resolve().parents[2] / "shared/registration-options.json").read_text()
)
VOLUNTEER_DEPARTMENTS = REGISTRATION_OPTIONS["volunteerDepartments"]
REGIONS = REGISTRATION_OPTIONS["regions"]
SPORTS = [
    "Football",
    "Cricket",
    "Badminton",
    "Table tennis",
    "Weightlifting",
    "Chess",
    "Tug of war",
    "Dodgeball",
]
TEAMS = [
    ("Court Kings", "#4c7051", "CK"),
    ("The Strikers", "#bd6039", "ST"),
    ("Blue Wolves", "#466da3", "BW"),
    ("Slytherwins", "#1f7a3a", "SW"),
    ("X Force United", "#c4242b", "XF"),
    ("Vikings", "#8f1d2a", "VK"),
    ("The Mavericks", "#3c8a88", "MV"),
    ("Thunder Club", "#6e638c", "TC"),
]

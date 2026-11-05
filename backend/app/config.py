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
# Ids match the live database, where teams 2 and 8 were removed.
TEAMS = [
    (1, "The Monarchs", "#3f6e5a", "MO"),
    (3, "Shell Mates", "#6b4a2e", "SM"),
    (4, "SlytherWins", "#1f7a3a", "SW"),
    (5, "X Force United", "#c4242b", "XF"),
    (6, "Vikings", "#8f1d2a", "VK"),
    (7, "Shadow Strikers", "#2b2b30", "SS"),
]
TEAM_IDS = {team[0] for team in TEAMS}

import sys
import os

current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from app.database.seed import seed_database

if __name__ == "__main__":
    print("Initializing database...")
    seed_database()
    print("Database ready!")


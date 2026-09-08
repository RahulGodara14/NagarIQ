# E:\NagarIQ\backend\app\database.py
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

# Explicitly tell python to look for .env in the parent directory of this file's folder
env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
load_dotenv(dotenv_path=env_path)

# 1. Fetch DATABASE_URL or fallback to local SQLite database
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")

if not SQLALCHEMY_DATABASE_URL:
    # Safe fallback if no Postgres DB is configured
    SQLALCHEMY_DATABASE_URL = "sqlite:///./nagariq.db"

# 2. Render Compatibility: Fix 'postgres://' to 'postgresql://' for SQLAlchemy 2.0+
if SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgres://", "postgresql://", 1)

# 3. Create engine with dialect-specific options
if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        connect_args={"check_same_thread": False}
    )
else:
    try:
        engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"connect_timeout": 5})
        with engine.connect() as conn:
            pass
    except Exception as e:
        print(f"Warning: Primary database connection failed ({e}). Falling back to SQLite nagariq.db")
        SQLALCHEMY_DATABASE_URL = "sqlite:///./nagariq.db"
        engine = create_engine(
            SQLALCHEMY_DATABASE_URL,
            connect_args={"check_same_thread": False}
        )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
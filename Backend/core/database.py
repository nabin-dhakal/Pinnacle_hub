from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from .config import settings
import os

engine = create_engine(
    settings.DATABASE_URL,
    pool_size=10,
    max_overflow=5,
    pool_recycle=3600,
    pool_pre_ping= True,
    connect_args= {
        "application_name": "Pinnacle Hub",
        "keepalives_idle":60,
        "connect_timeout":15,
        **({"check_same_thread":False} if "sqlite" in settings.DATABASE_URL else {})
    })

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
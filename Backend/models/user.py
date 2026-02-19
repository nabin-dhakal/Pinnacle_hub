from sqlalchemy import Column, Integer, String, UUID, Boolean , DateTime
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from core.database import Base
import uuid

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    username = Column(String, unique=True, index=True, nullable= False)
    email = Column(String, unique=True, index=True, nullable= False)
    fullname = Column(String)
    hashed_password = Column(String, nullable=False)

    created_at = Column(DateTime, default=datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=datetime.now(timezone.utc))

    is_active = Column(Boolean, default=True)
    
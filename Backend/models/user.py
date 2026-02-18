from sqlalchemy import Column, Integer, String, UUID, Boolean , DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from core.database import Base
import uuid

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    username = Column(String, unique=True, index=True, nullable= False)
    email = Column(String, unique=True, index=True, nullable= False)
    fullname = Column(String)
    password = Column(String, nullable=False)

    isactive = Column(Boolean, default=True)
    
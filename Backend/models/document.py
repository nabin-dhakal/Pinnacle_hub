from sqlalchemy import Column, String, Enum, ForeignKey, JSON, DateTime, UniqueConstraint, Integer
from sqlalchemy.orm import relationship
from core.database import Base
import uuid
from datetime import datetime, timezone
import enum
from .user import User

class ItemType(enum.Enum):
    FILE = "FILE"
    FOLDER = "FOLDER"

class Permission(enum.Enum):
    VIEW = "view"
    SUGGEST = "suggest" 
    EDIT = "edit"

class File(Base):
    __tablename__ = "files"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    type = Column(Enum(ItemType), nullable=False)
    owner_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    parent_id = Column(String(36), ForeignKey("files.id"), nullable=True)
    content = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=datetime.now(timezone.utc), onupdate=datetime.now(timezone.utc))
    version = Column(Integer, default=1)
    changes = relationship("FileChange", back_populates="file", cascade="all, delete-orphan")    
    
    owner = relationship("User", foreign_keys=[owner_id])
    parent = relationship("File", remote_side=[id], foreign_keys=[parent_id])
    children = relationship("File", foreign_keys=[parent_id], overlaps="parent")
    permissions = relationship("FilePermission", back_populates="file", cascade="all, delete-orphan")
    
    __table_args__ = (
        UniqueConstraint('name', 'parent_id', 'owner_id', name='unique_name_per_location'),
    )

class FilePermission(Base):
    __tablename__ = "file_permissions"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    file_id = Column(String(36), ForeignKey("files.id"), nullable=False)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    permission = Column(Enum(Permission), nullable=False)
    granted_at = Column(DateTime, default=datetime.now(timezone.utc))
    
    file = relationship("File", back_populates="permissions")
    user = relationship("User")

class FileChange(Base):
    __tablename__ = "filechanges"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    file_id = Column(String(36), ForeignKey("files.id"), nullable=False)
    user_id = Column(String(36), ForeignKey("users.id"),nullable=False)
    operations = Column(JSON)
    version = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.now(timezone.utc))

    file = relationship("File", back_populates="changes")
    user = relationship("User" , foreign_keys=[user_id])

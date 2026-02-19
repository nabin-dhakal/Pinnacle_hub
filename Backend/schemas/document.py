from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from enum import Enum

class ItemType(str, Enum):
    FILE = "FILE"
    FOLDER = "FOLDER"

class Permission(str, Enum):
    VIEW = "view"
    SUGGEST = "suggest"
    EDIT = "edit"

class FileBase(BaseModel):
    name: str
    type: ItemType
    parent_id: Optional[str] = None

class FileCreate(FileBase):
    pass  

class FileUpdate(BaseModel):
    name: Optional[str] = None
    content: Optional[dict] = None  
    parent_id: Optional[str] = None

class FilePermissionBase(BaseModel):
    file_id: str
    user_id: str
    permission: Permission

class FilePermissionCreate(FilePermissionBase):
    pass

class FilePermissionResponse(FilePermissionBase):
    id: str
    granted_at: datetime
    
    class Config:
        from_attributes = True

class FileResponse(FileBase):
    id: str
    owner_id: str
    content: Optional[dict] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class FileWithPermissions(FileResponse):
    permissions: List[FilePermissionResponse] = []
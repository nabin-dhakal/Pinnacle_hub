from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from core.database import get_db
from models.document import File, FilePermission
from models.user import User
from schemas.document import FileCreate, FileUpdate, FileResponse, FilePermissionCreate, FilePermissionResponse
from routers.auth import get_current_user
from typing import List

router = APIRouter(prefix="/files", tags=["Files"])

@router.post("", response_model=FileResponse)
def create_file(
    file_data: FileCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if file_data.parent_id:
        parent = db.query(File).filter(File.id == file_data.parent_id).first()
        if not parent:
            raise HTTPException(404, "Parent folder not found")
        if parent.type != "folder":
            raise HTTPException(400, "Parent must be a folder")
    
    new_file = File(
        **file_data.model_dump(),
        owner_id=current_user.id
    )
    db.add(new_file)
    db.commit()
    db.refresh(new_file)
    return new_file

@router.get("/{file_id}", response_model=FileResponse)
def get_file(
    file_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    file = db.query(File).filter(File.id == file_id).first()
    if not file:
        raise HTTPException(404, "File not found")
    
    if not can_access_file(db, current_user.id, file_id, "view"):
        raise HTTPException(403, "Not authorized")
    
    return file

@router.put("/{file_id}", response_model=FileResponse)
def update_file(
    file_id: str,
    file_data: FileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    file = db.query(File).filter(File.id == file_id).first()
    if not file:
        raise HTTPException(404, "File not found")
    
    if not can_access_file(db, current_user.id, file_id, "edit"):
        raise HTTPException(403, "Not authorized")
    
    for key, value in file_data.model_dump(exclude_unset=True).items():
        setattr(file, key, value)
    
    db.commit()
    db.refresh(file)
    return file

@router.post("/{file_id}/share", response_model=FilePermissionResponse)
def share_file(
    file_id: str,
    permission_data: FilePermissionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    file = db.query(File).filter(File.id == file_id).first()
    if not file or file.owner_id != current_user.id:
        raise HTTPException(403, "Only owner can share")
    
    existing = db.query(FilePermission).filter(
        FilePermission.file_id == file_id,
        FilePermission.user_id == permission_data.user_id
    ).first()
    
    if existing:
        existing.permission = permission_data.permission
    else:
        existing = FilePermission(**permission_data.model_dump())
        db.add(existing)
    
    db.commit()
    db.refresh(existing)
    return existing

def can_access_file(db: Session, user_id: str, file_id: str, required_permission: str) -> bool:
    file = db.query(File).filter(File.id == file_id).first()
    if file and file.owner_id == user_id:
        return True
    
    perm = db.query(FilePermission).filter(
        FilePermission.file_id == file_id,
        FilePermission.user_id == user_id
    ).first()
    
    if perm:
        if required_permission == "view":
            return True
        if required_permission == "suggest" and perm.permission in ["suggest", "edit"]:
            return True
        if required_permission == "edit" and perm.permission == "edit":
            return True
    
    return False

@router.get("", response_model=List[FileResponse])
def get_user_files(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    files = db.query(File).filter(
        File.owner_id == current_user.id,
        File.type == "FILE"
    ).all()
    return files
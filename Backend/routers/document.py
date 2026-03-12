from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from core.database import get_db
from models.document import File, FilePermission, Permission as ModelPermission, ItemType
from models.user import User
from schemas.document import FileCreate, FileUpdate, FileResponse, FilePermissionCreate, FilePermissionResponse
from routers.auth import get_current_user
from services.document_service import FileService
from typing import List
from sqlalchemy import or_

router = APIRouter(prefix="/files", tags=["Files"])

@router.post("", response_model=FileResponse)
def create_file(
    file_data: FileCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return FileService(db).create(file_data, current_user.id)

@router.get("/{file_id}", response_model=FileResponse)
def get_file(
    file_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return FileService(db).get(file_id, current_user.id)

@router.put("/{file_id}", response_model=FileResponse)
def update_file(
    file_id: str,
    file_data: FileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return FileService(db).update_metadata(file_id, file_data, current_user.id)

@router.delete("/{file_id}")
def delete_file(
    file_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    FileService(db).delete(file_id, current_user.id)
    return {"message": "File deleted successfully"}

@router.post("/{file_id}/share", response_model=FilePermissionResponse)
def share_file(
    file_id: str,
    permission_data: FilePermissionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return FileService(db).share(file_id, permission_data.username, ModelPermission(permission_data.permission.value), current_user.id)

@router.get("", response_model=List[FileResponse])
def get_user_files(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(File).filter(
        File.type == ItemType.FILE
    ).filter(
        or_(
            File.owner_id == current_user.id,
            File.permissions.any(FilePermission.user_id == current_user.id)
        )
    ).all()

@router.get("/{file_id}/history")
def get_file_history(
    file_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return FileService(db).get_history(file_id, current_user.id)

@router.post("/{file_id}/revert/{version}")
def revert_file(
    file_id: str,
    version: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    file = FileService(db).revert_to_version(file_id, version, current_user.id)
    return {"message": f"Reverted to version {version}", "current_version": file.version}
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from core.database import get_db
from models.document import File, FilePermission, Permission as ModelPermission, ItemType
from models.user import User
from schemas.document import FileCreate, FileUpdate, FileResponse, FilePermissionCreate, FilePermissionResponse
from routers.auth import get_current_user
from services.document_service import FileService
from typing import List, Optional
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
    file = db.query(File).filter(File.id == file_id).first()
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    
    if file.owner_id == current_user.id:
        return file
    
    permission = db.query(FilePermission).filter(
        FilePermission.file_id == file_id,
        FilePermission.user_id == current_user.id
    ).first()
    
    if permission:
        return file
    
    parent = file
    while parent.parent_id:
        parent = db.query(File).filter(File.id == parent.parent_id).first()
        if not parent:
            break
        if parent.owner_id == current_user.id:
            return file
        parent_permission = db.query(FilePermission).filter(
            FilePermission.file_id == parent.id,
            FilePermission.user_id == current_user.id
        ).first()
        if parent_permission:
            return file
    
    raise HTTPException(status_code=403, detail="Not authorized to access this file")

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
    parent_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    accessible_folders = db.query(File.id).filter(
        File.type == ItemType.FOLDER,
        or_(
            File.owner_id == current_user.id,
            File.permissions.any(FilePermission.user_id == current_user.id)
        )
    ).all()
    
    accessible_folder_ids = [f[0] for f in accessible_folders]
    
    all_accessible_folder_ids = set(accessible_folder_ids)
    for folder_id in accessible_folder_ids:
        descendants = db.query(File.id).filter(
            File.parent_id.in_(list(all_accessible_folder_ids))
        ).all()
        for desc_id in descendants:
            all_accessible_folder_ids.add(desc_id[0])
    
    direct_folder_access = db.query(File).filter(
        File.type == ItemType.FOLDER,
        or_(
            File.owner_id == current_user.id,
            File.permissions.any(FilePermission.user_id == current_user.id)
        )
    )
    
    direct_file_access = db.query(File).filter(
        File.type == ItemType.FILE,
        or_(
            File.owner_id == current_user.id,
            File.permissions.any(FilePermission.user_id == current_user.id)
        )
    )
    
    inherited_file_access = db.query(File).filter(
        File.type == ItemType.FILE,
        File.parent_id.in_(all_accessible_folder_ids)
    )
    
    all_files = direct_folder_access.union(direct_file_access).union(inherited_file_access).all()
    
    file_ids = list(set([f.id for f in all_files]))
    
    query = db.query(File).filter(File.id.in_(file_ids))
    
    if parent_id is not None:
        if parent_id == "null":
            query = query.filter(File.parent_id.is_(None))
        else:
            query = query.filter(File.parent_id == parent_id)
    
    files = query.all()
    
    result = []
    for file in files:
        file_dict = file.__dict__
        
        parent_accessible = False
        if file.parent_id:
            if file.parent_id in all_accessible_folder_ids:
                parent_accessible = True
        
        file_dict['parent_accessible'] = parent_accessible
        result.append(FileResponse.from_orm(file))
    
    return result

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
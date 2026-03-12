from sqlalchemy.orm import Session
from sqlalchemy import and_
from models.document import File, FileChange, FilePermission, Permission, ItemType
from models.user import User
from schemas.document import FileCreate, FileUpdate, Operation
from fastapi import HTTPException
from datetime import datetime
import uuid
import copy


class FileService:
    def __init__(self, db: Session):
        self.db = db
    
    def create(self, file_data: FileCreate, user_id: str) -> File:
        if file_data.parent_id:
            parent = self.db.query(File).filter(File.id == file_data.parent_id).first()
            if not parent:
                raise HTTPException(status_code=404, detail="Parent folder not found")
            if parent.type != ItemType.FOLDER:
                raise HTTPException(status_code=400, detail="Parent must be a folder")
        
        new_file = File(
            name=file_data.name,
            type=file_data.type,
            owner_id=user_id,
            parent_id=file_data.parent_id,
            content=file_data.content or {"ops": []},
            version=1
        )
        
        self.db.add(new_file)
        self.db.commit()
        self.db.flush()
        
        owner_permission = FilePermission(
            file_id=new_file.id,
            user_id=user_id,
            permission=Permission.EDIT
        )
        self.db.add(owner_permission)
        
        self.db.commit()
        self.db.refresh(new_file)
        return new_file
    
    def get(self, file_id: str, user_id: str) -> File:
        file = self.db.query(File).filter(File.id == file_id).first()
        if not file:
            raise HTTPException(status_code=404, detail="File not found")
        
        if not self.check_permission(file_id, user_id, Permission.VIEW):
            raise HTTPException(status_code=403, detail="Access denied")
        
        return file
    
    def update_metadata(self, file_id: str, update_data: FileUpdate, user_id: str) -> File:
        file = self.get(file_id, user_id)
        
        if not self.check_permission(file_id, user_id, Permission.EDIT):
            raise HTTPException(status_code=403, detail="Edit permission required")
        
        if update_data.name:
            file.name = update_data.name
        
        if update_data.parent_id is not None:
            if update_data.parent_id:
                new_parent = self.get(update_data.parent_id, user_id)
                if new_parent.type != ItemType.FOLDER:
                    raise HTTPException(status_code=400, detail="Parent must be a folder")
            file.parent_id = update_data.parent_id
        
        file.updated_at = datetime.now()
        self.db.commit()
        self.db.refresh(file)
        return file
    
    def delete(self, file_id: str, user_id: str) -> None:
        file = self.get(file_id, user_id)
        
        if file.owner_id != user_id:
            raise HTTPException(status_code=403, detail="Only owner can delete")
        
        self.db.delete(file)
        self.db.commit()
    
    def check_permission(self, file_id: str, user_id: str, required: Permission) -> bool:
        file = self.db.query(File).filter(File.id == file_id).first()
        if file and file.owner_id == user_id:
            return True
        
        permission = self.db.query(FilePermission).filter(
            FilePermission.file_id == file_id,
            FilePermission.user_id == user_id
        ).first()

        if not permission:
            return False

        permission_levels = {
            Permission.VIEW: 1,
            Permission.SUGGEST: 2,
            Permission.EDIT: 3
        }

        return permission_levels[permission.permission] >= permission_levels[required]
    
    def share(self, file_id: str, target_username: str, permission: Permission, owner_id: str) -> FilePermission:
        file = self.get(file_id, owner_id)
        
        if file.owner_id != owner_id:
            raise HTTPException(status_code=403, detail="Only owner can share")
        
        user = self.db.query(User).filter(User.username == target_username).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        existing = self.db.query(FilePermission).filter(
            and_(
                FilePermission.file_id == file_id,
                FilePermission.user_id == user.id
            )
        ).first()
        
        if existing:
            existing.permission = permission
            perm = existing
        else:
            perm = FilePermission(
                file_id=file_id,
                user_id=user.id,
                permission=permission
            )
            self.db.add(perm)
        
        self.db.commit()
        self.db.refresh(perm)
        return perm
    
    def get_content(self, file_id: str, user_id: str) -> dict:
        file = self.get(file_id, user_id)
        return file.content or {"ops": []}
    
    def apply_changes(self, file_id: str, operations: list, base_version: int, user_id: str) -> dict:
        file = self.get(file_id, user_id)
        
        if not self.check_permission(file_id, user_id, Permission.EDIT):
            raise HTTPException(status_code=403, detail="Edit permission required")
        
        if base_version != file.version:
            operations = self.transform_operations(operations, file.version, base_version, file_id)
        
        new_content = self.apply_operations_to_content(copy.deepcopy(file.content or {"ops": []}), operations)        
        file.content = new_content
        file.version += 1
        file.updated_at = datetime.now()
        
        change = FileChange(
            file_id=file_id,
            user_id=user_id,
            operations=operations,
            version=base_version
        )
        self.db.add(change)
        
        self.db.commit()
        
        return {
            "content": new_content,
            "version": file.version,
            "operations": operations
        }
    
    def transform_operations(self, operations: list, current_version: int, base_version: int, file_id: str) -> list:
        changes = self.db.query(FileChange).filter(
            and_(
                FileChange.file_id == file_id,
                FileChange.version > base_version,
                FileChange.version <= current_version
            )
        ).order_by(FileChange.version).all()
        
        transformed = operations.copy()
        
        for change in changes:
            transformed = self.transform_batch(transformed, change.operations)
        
        return transformed
    
    def transform_batch(self, new_ops: list, past_ops: list) -> list:
        result = []
        for new_op in new_ops:
            transformed = new_op.copy()
            for past_op in past_ops:
                transformed = self.transform_single(transformed, past_op)
            result.append(transformed)
        return result
    
    def transform_single(self, op1: dict, op2: dict) -> dict:
        op = op1.copy()
        
        if op2.get("type") == "insert":
            if op2.get("position", 0) <= op.get("position", 0):
                op["position"] = op.get("position", 0) + len(op2.get("text", ""))
        elif op2.get("type") == "delete":
            if op2.get("position", 0) < op.get("position", 0):
                op["position"] = op.get("position", 0) - op2.get("length", 0)
            elif op2.get("position", 0) <= op.get("position", 0) < op2.get("position", 0) + op2.get("length", 0):
                op["position"] = op2.get("position", 0)
        
        return op
    
    def apply_operations_to_content(self, content: dict, operations: list) -> dict:
        if "ops" not in content:
            content["ops"] = []
        
        sorted_ops = sorted(operations, key=lambda x: x.get("position", 0), reverse=True)
        
        for op in sorted_ops:
            op_type = op.get("type")
            if op_type == "insert":
                self.insert_at_position(content, op)
            elif op_type == "delete":
                self.delete_at_position(content, op)
        
        return content
    
    def insert_at_position(self, content: dict, op: dict):
        position = op.get("position", 0)
        text = op.get("text", "")
        
        current_ops = content.get("ops", [])
        
        if not current_ops:
            content["ops"] = [{"insert": text}]
            return
        
        char_count = 0
        for i, segment in enumerate(current_ops):
            segment_text = segment.get("insert", "")
            segment_len = len(segment_text)
            
            if position <= char_count + segment_len:
                before = segment_text[:position - char_count]
                after = segment_text[position - char_count:]
                
                new_segments = []
                if before:
                    new_segments.append({"insert": before})
                new_segments.append({"insert": text})
                if after:
                    new_segments.append({"insert": after})
                
                current_ops[i:i+1] = new_segments
                content["ops"] = current_ops
                return
            
            char_count += segment_len
        
        content["ops"].append({"insert": text})
    
    def delete_at_position(self, content: dict, op: dict):
        position = op.get("position", 0)
        length = op.get("length", 1)
        
        current_ops = content.get("ops", [])
        
        char_count = 0
        delete_start = position
        delete_end = position + length
        
        new_ops = []
        
        for segment in current_ops:
            segment_text = segment.get("insert", "")
            segment_len = len(segment_text)
            segment_start = char_count
            segment_end = char_count + segment_len
            
            if segment_end <= delete_start:
                new_ops.append(segment)
            elif segment_start >= delete_end:
                new_ops.append(segment)
            else:
                if segment_start < delete_start:
                    before_text = segment_text[:delete_start - segment_start]
                    if before_text:
                        new_ops.append({"insert": before_text})
                
                if segment_end > delete_end:
                    after_text = segment_text[delete_end - segment_start:]
                    if after_text:
                        new_ops.append({"insert": after_text})
            
            char_count += segment_len
        
        content["ops"] = new_ops
    
    def get_history(self, file_id: str, user_id: str) -> list:
        self.get(file_id, user_id)
        
        changes = self.db.query(FileChange).filter(
            FileChange.file_id == file_id
        ).order_by(FileChange.version.desc()).all()
        
        return [
            {
                "version": change.version,
                "user_id": change.user_id,
                "timestamp": change.created_at,
                "operations_count": len(change.operations)
            }
            for change in changes
        ]
    
    def revert_to_version(self, file_id: str, target_version: int, user_id: str) -> File:
        file = self.get(file_id, user_id)
        
        if not self.check_permission(file_id, user_id, Permission.EDIT):
            raise HTTPException(status_code=403, detail="Edit permission required")
        
        changes = self.db.query(FileChange).filter(
            and_(
                FileChange.file_id == file_id,
                FileChange.version <= target_version
            )
        ).order_by(FileChange.version).all()
        
        content = {"ops": []}
        for change in changes:
            content = self.apply_operations_to_content(content, change.operations)
        
        file.content = content
        file.version += 1
        file.updated_at = datetime.now()
        
        revert_change = FileChange(
            file_id=file_id,
            user_id=user_id,
            operations=[{"type": "revert", "target_version": target_version}],
            version=file.version
        )
        self.db.add(revert_change)
        
        self.db.commit()
        self.db.refresh(file)
        
        return file
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import uuid

class Document(BaseModel):
    id: str = str(uuid.uuid4())
    title: str = "Untitled Document"
    content: str = ""
    created_at: datetime = datetime.utcnow()
    updated_at: datetime = datetime.utcnow()
    owner_id: Optional[str] = None
    version: int = 0

documents_db = {}

def get_document(document_id: str) -> Optional[Document]:
    return documents_db.get(document_id)

def create_document(title: str = "Untitled Document", content: str = "") -> Document:
    doc = Document(title=title, content=content)
    documents_db[doc.id] = doc
    return doc

def update_document(document_id: str, content: str, increment_version: bool = True) -> Optional[Document]:
    if document_id not in documents_db:
        return None
    
    doc = documents_db[document_id]
    doc.content = content
    doc.updated_at = datetime.utcnow()
    if increment_version:
        doc.version += 1
    
    return doc

def get_all_documents() -> list:
    return list(documents_db.values())
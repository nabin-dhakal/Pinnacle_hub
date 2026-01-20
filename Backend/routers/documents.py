from fastapi import APIRouter, HTTPException
from models.document import Document, create_document, get_document, update_document, get_all_documents

router = APIRouter(prefix="/documents", tags=["documents"])

@router.get("/")
async def list_documents():
    documents = get_all_documents()
    return {"documents": [doc.dict() for doc in documents]}

@router.get("/{document_id}")
async def get_document_by_id(document_id: str):
    doc = get_document(document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc.dict()

@router.post("/")
async def create_new_document():
    doc = create_document()
    return doc.dict()

@router.put("/{document_id}")
async def update_document_content(document_id: str, content: str):
    doc = update_document(document_id, content)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc.dict()
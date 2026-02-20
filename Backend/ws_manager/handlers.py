import json

class MessageHandler:
    def __init__(self, manager):
        self.manager = manager
    
    async def handle_edit(self, user_id: str, document_id: str, data: dict):
        await self.manager.broadcast_to_document(
            document_id,
            {
                "type": "edit",
                "user_id": user_id,
                "content": data.get("content"),
                "position": data.get("position"),
                "timestamp": data.get("timestamp")
            },
            exclude_user=user_id
        )
    
    async def handle_cursor(self, user_id: str, document_id: str, data: dict):
        await self.manager.broadcast_to_document(
            document_id,
            {
                "type": "cursor",
                "user_id": user_id,
                "position": data.get("position")
            },
            exclude_user=user_id
        )
    
    async def handle_selection(self, user_id: str, document_id: str, data: dict):
        await self.manager.broadcast_to_document(
            document_id,
            {
                "type": "selection",
                "user_id": user_id,
                "start": data.get("start"),
                "end": data.get("end")
            },
            exclude_user=user_id
        )
    
    async def handle_comment(self, user_id: str, document_id: str, data: dict):
        await self.manager.broadcast_to_document(
            document_id,
            {
                "type": "comment",
                "user_id": user_id,
                "comment_id": data.get("comment_id"),
                "content": data.get("content"),
                "position": data.get("position")
            }
        )
    
    async def handle_presence(self, user_id: str, document_id: str, data: dict):
        await self.manager.broadcast_to_document(
            document_id,
            {
                "type": "presence",
                "user_id": user_id,
                "status": data.get("status", "active")
            }
        )
    
    async def handle_document_save(self, user_id: str, document_id: str, data: dict):
        
        await self.manager.broadcast_to_document(
            document_id,
            {
                "type": "document_saved",
                "user_id": user_id,
                "timestamp": data.get("timestamp")
            }
        )
import json
from typing import Dict, Set
from fastapi import WebSocket
from .handlers import MessageHandler

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.document_subscribers: Dict[str, Set[str]] = {}
        self.message_handler = MessageHandler(self)
    
    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.active_connections[user_id] = websocket
    
    def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
        
        for doc_id in list(self.document_subscribers.keys()):
            if user_id in self.document_subscribers[doc_id]:
                self.document_subscribers[doc_id].remove(user_id)
    
    async def subscribe_to_document(self, user_id: str, document_id: str):
        if document_id not in self.document_subscribers:
            self.document_subscribers[document_id] = set()
        self.document_subscribers[document_id].add(user_id)
        
        await self.broadcast_to_document(
            document_id, 
            {"type": "user_joined", "user_id": user_id}
        )
    
    async def unsubscribe_from_document(self, user_id: str, document_id: str):
        if document_id in self.document_subscribers:
            if user_id in self.document_subscribers[document_id]:
                self.document_subscribers[document_id].remove(user_id)
                
                await self.broadcast_to_document(
                    document_id,
                    {"type": "user_left", "user_id": user_id}
                )
    
    async def send_to_user(self, user_id: str, message: dict):
        if user_id in self.active_connections:
            await self.active_connections[user_id].send_json(message)
    
    async def broadcast_to_document(self, document_id: str, message: dict, exclude_user: str = None):
        if document_id not in self.document_subscribers:
            return
            
        for user_id in self.document_subscribers[document_id]:
            if exclude_user and user_id == exclude_user:
                continue
            await self.send_to_user(user_id, message)
    
    async def handle_message(self, user_id: str, message: dict):
        msg_type = message.get("type")
        document_id = message.get("document_id")
        data = message.get("data", {})
        
        handlers = {
            "edit": self.message_handler.handle_edit,
            "cursor": self.message_handler.handle_cursor,
            "selection": self.message_handler.handle_selection,
            "comment": self.message_handler.handle_comment,
            "presence": self.message_handler.handle_presence,
            "document_save": self.message_handler.handle_document_save
        }
        
        handler = handlers.get(msg_type)
        if handler:
            await handler(user_id, document_id, data)
from fastapi import WebSocket, status
from typing import List
from config import settings

class WebSocketOriginMiddleware:
    def __init__(self, allowed_origins: List[str] = None):
        if allowed_origins is None:
            self.allowed_origins = settings.WEBSOCKET_ALLOWED_ORIGINS
        else:
            self.allowed_origins = allowed_origins
        
        self.environment = settings.ENVIRONMENT
    
    async def validate_origin(self, websocket: WebSocket) -> bool:
        origin = websocket.headers.get("origin") or websocket.headers.get("Origin")
        
        if not origin:
            if self.environment == "development":
                return True
            await self._reject_connection(websocket, "Origin header missing")
            return False
        
        if origin in self.allowed_origins or "*" in self.allowed_origins:
            return True
        
        if self.environment == "development":
            print(f"Warning: Connection from unlisted origin: {origin}")
            return True
            
        await self._reject_connection(websocket, f"Origin {origin} not allowed")
        return False
    
    async def _reject_connection(self, websocket: WebSocket, reason: str):
        await websocket.close(
            code=status.WS_1008_POLICY_VIOLATION,
            reason=reason[:120]
        )
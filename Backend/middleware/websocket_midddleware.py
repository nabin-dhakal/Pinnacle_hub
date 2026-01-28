from fastapi import WebSocket, status
from typing import List, Optional


class WebSocketOriginMiddleware:
    def __init__(self, allowed_origins: Optional[List[str]] = None):
        self.allowed_origins = allowed_origins or []

    async def validate_origin(self, websocket: WebSocket) -> bool:
        origin = websocket.headers.get("origin") or websocket.headers.get("Origin")

        if not origin:
            await self._reject_connection(websocket, "Origin header missing")
            return False

        if "*" in self.allowed_origins or origin in self.allowed_origins:
            return True

        await self._reject_connection(
            websocket, f"Origin {origin} not allowed"
        )
        return False

    async def _reject_connection(self, websocket: WebSocket, reason: str):
        await websocket.close(
            code=status.WS_1008_POLICY_VIOLATION,
            reason=reason[:120],
        )

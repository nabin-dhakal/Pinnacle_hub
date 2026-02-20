from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from ws_manager.dependencies import get_user_from_token
from ws_manager.manager import ConnectionManager

router = APIRouter()
manager = ConnectionManager()

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str):
    user_id = await get_user_from_token(token)
    if not user_id:
        await websocket.close(code=1008)
        return
    
    await manager.connect(websocket, user_id)
    
    try:
        while True:
            message = await websocket.receive_json()
            message_type = message.get("type")
            
            if message_type == "subscribe":
                document_id = message.get("document_id")
                await manager.subscribe_to_document(user_id, document_id)
                
            elif message_type == "unsubscribe":
                document_id = message.get("document_id")
                await manager.unsubscribe_from_document(user_id, document_id)
                
            else:
                await manager.handle_message(user_id, message)
                
    except WebSocketDisconnect:
        manager.disconnect(user_id)
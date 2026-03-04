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
            document_id = message.get("document_id")
            data = message.get("data", {})
            
            if message_type == "subscribe":
                await manager.subscribe_to_document(user_id, document_id)
                await manager.message_handler.handle_request_document(
                    user_id, document_id, data
                )
                
            elif message_type == "unsubscribe":
                await manager.unsubscribe_from_document(user_id, document_id)
                
            elif message_type == "edit":
                await manager.message_handler.handle_edit(
                    user_id, document_id, data
                )
                
            elif message_type == "cursor":
                await manager.message_handler.handle_cursor(
                    user_id, document_id, data
                )
                
            elif message_type == "selection":
                await manager.message_handler.handle_selection(
                    user_id, document_id, data
                )
                
            elif message_type == "comment":
                await manager.message_handler.handle_comment(
                    user_id, document_id, data
                )
                
            elif message_type == "presence":
                await manager.message_handler.handle_presence(
                    user_id, document_id, data
                )
                
            elif message_type == "document_save":
                await manager.message_handler.handle_document_save(
                    user_id, document_id, data
                )
                
            elif message_type == "request_document":
                await manager.message_handler.handle_request_document(
                    user_id, document_id, data
                )
                
            else:
                await manager.handle_message(user_id, message)
                
    except WebSocketDisconnect:
        manager.disconnect(user_id)
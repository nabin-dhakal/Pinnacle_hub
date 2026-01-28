from fastapi import WebSocket, WebSocketDisconnect, APIRouter
import json
from .manager import ConnectionManager
from middleware.websocket_midddleware import WebSocketOriginMiddleware

router = APIRouter()
manager = ConnectionManager()
origin_middleware = WebSocketOriginMiddleware(
       allowed_origins=["*"]  # For development
   )
async def get_user_info(websocket: WebSocket) -> dict:
    query_params = dict(websocket.query_params)
    username = query_params.get("username", "Anonymous")
    user_id = query_params.get("user_id")
    
    return {
        "username": username,
        "user_id": user_id
    }

async def handle_operation(message: dict, sender: WebSocket, document_id: str):
    operation_data = {
        "delta": message.get("payload").get("delta"),
        "userId": message.get("payload").get("userId"),
        "timestamp": message.get("timestamp")
    }
    await manager.add_operation(document_id, operation_data)

    broadcast_msg = {
        "type": "operation",
        "payload": message.get("payload"),
        "sender": manager.get_connection_info(sender),
        "timestamp": message.get("timestamp")
    }
    
    await manager.broadcast_to_document(
        document_id,
        broadcast_msg,
        exclude={sender}
    )

async def handle_cursor(message: dict, sender: WebSocket, document_id: str):
    cursor_msg = {
        "type": "cursor",
        "payload": message.get("payload"),
        "sender": manager.get_connection_info(sender)
    }
    
    await manager.broadcast_to_document(
        document_id,
        json.dumps(cursor_msg),
        exclude={sender}
    )

async def handle_message(data: str, websocket: WebSocket, document_id: str):
    try:
        message = json.loads(data)
        msg_type = message.get("type")
        
        if msg_type == "operation":
            await handle_operation(message, websocket, document_id)
        elif msg_type == "cursor":
            await handle_cursor(message, websocket, document_id)
        elif msg_type == "chat":
            pass
        else:
            await websocket.send_json({
                "type": "error",
                "message": f"Unknown message type: {msg_type}"
            })
            
    except json.JSONDecodeError:
        await websocket.send_json({
            "type": "error",
            "message": "Invalid JSON format"
        })

@router.websocket("/ws/{document_id}")
async def websocket_endpoint(websocket: WebSocket, document_id: str):
    if not await origin_middleware.validate_origin(websocket):
        return
    
    await websocket.accept()
    
    user_info = await get_user_info(websocket)
    await manager.connect(websocket, document_id, user_info)
    
    # Send initial document state
    document_state = await manager.get_document_state(document_id)
    if document_state:
        await websocket.send_json({
            "type": "init",
            "payload": {
                "operations": document_state
            }
        })
    
    try:
        while True:
            data = await websocket.receive_text()
            await handle_message(data, websocket, document_id)
            
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        await manager.disconnect(websocket, document_id)   
from typing import Dict, Set, Optional, Any
import asyncio

class ConnectionManager:
    def __init__(self):
        self.activeconnections : Dict[str, Set[Any]] = {}
        self.connection_info : Dict[any, Dict] ={}
        self.document_states : Dict[str, Any] = {}
        self._lock = asyncio.Lock()
    
    async def connect(self, websocket, document_id:str, user_info: Optional[Dict]= None):
        async with self._lock:
            if document_id not in self.activeconnections:
                self.activeconnections[document_id] = set()
            
            self.activeconnections[document_id].add(websocket)
            
            if user_info:
                self.connection_info[websocket] = user_info
            else:
                self.connection_info[websocket] ={
                    "username":"Anonymous",
                    "user_id":None
                }
        print(f"New connection to document {document_id}")

        return True
    
    async def disconnect(self, websocket, document_id : str):
        async with self._lock:
            if document_id in self.activeconnections:
                self.activeconnections[document_id].discard(websocket)

                if not self.activeconnections[document_id]:
                    del self.activeconnections[document_id]
            if websocket in self.connection_info:
                del self.connection_info[websocket]
        print(f"Connection removed from the documet {document_id}")

        return True
    
    def get_document_connections(self, document_id: str) -> Set:
        return self.activeconnections.get(document_id, set())
    
    def get_connection_info(self, websocket) -> Optional[Dict]:
        return self.connection_info.get(websocket)
    
    async def broadcast_to_document(self, document_id: str, message: dict, exclude: Optional[Set] = None):
        
        
        if exclude is None:
            exclude = set()
        connections = self.get_document_connections(document_id)
        
        
        if not connections:
            return 0
        
        
        successfull_sends = 0
        dead_connections = []

        for connection in connections:
            if connection in exclude:
                continue
            try:
                await connection.send_json(message)
                successfull_sends += 1
            except Exception as e:
                dead_connections.append(connection)
                print(f"failed to send message to connection {e}")
        
        if dead_connections:
            async with self._lock:
                for dead_conn in dead_connections:
                    if document_id in self.activeconnections:
                            self.activeconnections[document_id].discard(dead_conn)
                    
                    if dead_conn in self.connection_info:
                        del self.connection_info[dead_conn]
        return successfull_sends
    
    async def get_document_state(self, document_id: str) -> list:

        return self.document_states.get(document_id, [])

    async def add_operation(self, document_id: str, operation: dict):
        """Store an operation in document history"""
        async with self._lock:
            if document_id not in self.document_states:
                self.document_states[document_id] = []
            
            self.document_states[document_id].append(operation)
from fastapi import HTTPException
from services.document_service import FileService
from core.database import SessionLocal

class MessageHandler:
    def __init__(self, manager):
        self.manager = manager

    async def handle_edit(self, user_id: str, document_id: str, data: dict):
        db = SessionLocal()
        try:
            service = FileService(db)
            result = service.apply_changes(
                document_id,
                data.get("operations", []),
                data.get("version", 1),
                user_id
            )

            await self.manager.broadcast_to_document(
                document_id,
                {
                    "type": "edit",
                    "user_id": user_id,
                    "operations": result["operations"],
                    "version": result["version"],
                    "timestamp": data.get("timestamp")
                },
                exclude_user=user_id
            )

        except HTTPException as e:
            await self.manager.send_to_user(
                user_id,
                {
                    "type": "error",
                    "code": e.status_code,
                    "message": e.detail
                }
            )

        except Exception:
            await self.manager.send_to_user(
                user_id,
                {
                    "type": "error",
                    "message": "Internal server error"
                }
            )
        finally:
            db.close()

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

    async def handle_request_document(self, user_id: str, document_id: str, data: dict):
        db = SessionLocal()
        try:
            service = FileService(db)
            file = service.get(document_id, user_id)

            await self.manager.send_to_user(
                user_id,
                {
                    "type": "document_state",
                    "content": file.content,
                    "version": file.version
                }
            )

        except HTTPException as e:
            await self.manager.send_to_user(
                user_id,
                {
                    "type": "error",
                    "code": e.status_code,
                    "message": e.detail
                }
            )

        except Exception:
            await self.manager.send_to_user(
                user_id,
                {
                    "type": "error",
                    "message": "Internal server error"
                }
            )

        finally:
            db.close()
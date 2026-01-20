from fastapi import FastAPI
from routers import documents
from websocket.handlers import router as websocket_router
from config import settings

app = FastAPI()

app.include_router(documents.router)
app.include_router(websocket_router)

@app.get("/")
async def root():
    return {"message": "Collaborative Docs API"}
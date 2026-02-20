from fastapi import FastAPI
from core.database import engine, SessionLocal
from models.user import User
from core.config import settings
from core.database import Base
from routers import auth, document, websocket
from fastapi.middleware.cors import CORSMiddleware

origins = [
    "http://localhost:5173"
]

# Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    docs_url="/docs" if settings.DEBUG else None,
    redocs_url="/redocs" if settings.DEBUG else None,
    openapi_url="/openapi.json" if settings.DEBUG else None,
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth.router)
app.include_router(document.router)
app.include_router(websocket.router)


@app.get("/")
async def root():
    return {
        "message": "Collaborative Docs API",
        "version": settings.VERSION,
        "database": settings.DATABASE_URL,
        "debug" : settings.DEBUG
    }
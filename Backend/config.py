import os
from typing import List
from dotenv import load_dotenv

load_dotenv()

class settings:
    WEBSOCKET_ALLOWED_ORIGINS : List[str]=[]
    ENVIRONMENT: str = "development"

    def __init__(self):
        origins_str = os.getenv("ALLOWED_ORIGINS","")
        if origins_str:
            self.WEBSOCKET_ALLOWED_ORIGINS = [origin.strip() for origin in origins_str.split(",")]
        else:
            self.WEBSOCKET_ALLOWED_ORIGINS = [
                "http://localhost:3000",
                "http://127.0.0.1:3000",
                "http://localhost:5173",
            ]
        self.ENVIRONMENT = os.getenv("ENVIRONMENT","development")

settings = settings()
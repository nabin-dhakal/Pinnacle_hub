from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    PROJECT_NAME : str = "Pinnacle Hub API"
    VERSION : str = "1.0.0"

    DATABASE_URL : str = "sqlite:///./dbsqlite.db"

    SECRET_KEY : str = "jdfajoierakfda5439534fdsgs@#fd"
    ALGORITHM : str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    class config:
        env_file = ".env"

settings = Settings()

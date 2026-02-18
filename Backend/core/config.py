from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    PROJECT_NAME : str = "Pinnacle Hub API"
    VERSION : str = "1.0.0"

    DATABASE_URL : str = ""
    SQLITE_DB: str = "pinnacle.db"

    SECRET_KEY : str = "jdfajoierakfda5439534fdsgs@#fd"
    ALGORITHM : str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    DEBUG : bool = True

    POSTGRES_USER: str = ""
    POSTGRES_PASSWORD: str = ""
    POSTGRES_DB: str = ""
    POSTGRES_HOST: str = ""
    POSTGRES_PORT: int = 5432


    class Config:
        env_file = ".env"
    
    @property
    def database_url(self) -> str:
        if self.DATABASE_URL:
            return self.DATABASE_URL
        
        if self.DEBUG:
            return f'sqlite:///./{self.SQLITE_DB}'
        
        return (
            f"postgresql+psycopg2://"
            f"{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

settings = Settings()
from pydantic import BaseModel, EmailStr
from typing import Optional

class UserCreate(BaseModel):
    username : str
    email : EmailStr
    password : str
    fullname : Optional[str] = None

class UserLogin(BaseModel):
    username : str
    password : str


class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    fullname: Optional[str]
    is_active: bool

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
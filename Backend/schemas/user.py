from pydantic import BaseModel, EmailStr
from typing import Optional

class UserCreate(BaseModel):
    username : str
    email : EmailStr
    password : str
    fullname : Optional[str] = None
    auth_provider : str = "local"

class UserLogin(BaseModel):
    username : str
    password : str


class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    fullname: Optional[str]
    is_active: bool
    auth_provider: str
    avatar_url: Optional[str]

    class Config:
        from_attributes = True

class Access_Token(BaseModel):
    access_token: str
    token_type: str

class Refresh_Token(BaseModel):
    refresh_token: str

class Logout_Token(BaseModel):
    refresh_token: str

class Token(BaseModel):
    access_token : str
    refresh_token : str
    token_type : str

class TokenData(BaseModel):
    username: Optional[str] = None
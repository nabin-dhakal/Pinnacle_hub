from passlib.context import CryptContext
from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
from core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"],deprecated="auto")

def verify_password(plainpassword, hashedpassword):
    return pwd_context.verify(plainpassword, hashedpassword)


def get_hashed_password(password):
    return pwd_context.hash(password)

def create_access_token(data:dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta( minutes= settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({'exp':expire})

    return jwt.encode( to_encode, settings.SECRET_KEY, settings.ALGORITHM)
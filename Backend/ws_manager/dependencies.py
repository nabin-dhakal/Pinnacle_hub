from jose import jwt
from core.config import settings

async def get_user_from_token(token: str):

    try:
        payload = jwt.decode(
            token, 
            settings.SECRET_KEY, 
            algorithms=[settings.ALGORITHM]
        )
        print("Decoded payload:", payload) 
        return payload.get("user_id")
    except Exception as e:
        print("JWT decode error:", str(e))  
        return None
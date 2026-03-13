from fastapi import APIRouter, Request, Depends, HTTPException
from authlib.integrations.starlette_client import OAuth
from starlette.config import Config
from sqlalchemy.orm import Session
from core.database import get_db
from core.config import settings
from models.user import User
from core.security import create_access_token, create_refresh_token
from schemas.user import Token
import uuid
from fastapi.responses import RedirectResponse
from authlib.integrations.base_client.errors import MismatchingStateError

router = APIRouter(prefix="/auth/google", tags=["Google OAuth"])

config = Config(environ={
    'GOOGLE_CLIENT_ID': settings.GOOGLE_CLIENT_ID,
    'GOOGLE_CLIENT_SECRET': settings.GOOGLE_CLIENT_SECRET
})
oauth = OAuth(config)
oauth.register(
    name='google',
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={'scope': 'openid email profile'}
)

@router.get("/login")
async def google_login(request: Request):
    redirect_uri = request.url_for('google_callback')
    return await oauth.google.authorize_redirect(request, redirect_uri)

@router.get("/callback")
async def google_callback(request: Request, db: Session = Depends(get_db)):
    try:
        token = await oauth.google.authorize_access_token(request)
    except MismatchingStateError:
        if not settings.DEBUG:
            raise HTTPException(400, "State mismatch error")
        
        request.scope["query_string"] = request.scope["query_string"].replace(
            f"state={request.query_params['state']}".encode(), b""
        )
        token = await oauth.google.authorize_access_token(request)
    
    user_info = token.get('userinfo')
    
    if not user_info:
        raise HTTPException(400, "Failed to get user info")
    
    email = user_info.get('email')
    google_id = user_info.get('sub')
    name = user_info.get('name')
    avatar = user_info.get('picture')
    
    existing_user = db.query(User).filter(User.email == email).first()
    if existing_user and existing_user.auth_provider == "local":
        raise HTTPException(
            400, 
            "Email already registered with password. Please login with password."
        )
    
    user = db.query(User).filter(User.google_id == google_id).first()
    
    if not user:
        username_base = email.split('@')[0]
        username = username_base
        counter = 1
        while db.query(User).filter(User.username == username).first():
            username = f"{username_base}{counter}"
            counter += 1
        
        user = User(
            username=username,
            email=email,
            fullname=name,
            google_id=google_id,
            avatar_url=avatar,
            auth_provider="google",
            hashed_password=None
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    
    access_token = create_access_token({"sub": user.username, "user_id": str(user.id)})
    refresh_token = create_refresh_token({"sub": user.username, "user_id": str(user.id)})
    
    frontend_url = settings.FRONTEND_URL
    redirect_url = f"{frontend_url}/oauth-callback?access_token={access_token}&refresh_token={refresh_token}&token_type=bearer"
    
    return RedirectResponse(url=redirect_url)
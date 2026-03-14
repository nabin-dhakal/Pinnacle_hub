from fastapi import APIRouter, Request, Depends, HTTPException
from authlib.integrations.starlette_client import OAuth
from sqlalchemy.orm import Session
from core.database import get_db
from core.config import settings
from models.user import User
from core.security import create_access_token, create_refresh_token
from fastapi.responses import RedirectResponse
from authlib.integrations.base_client.errors import MismatchingStateError
import logging

router = APIRouter(prefix="/auth/google", tags=["Google OAuth"])

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

oauth = OAuth()

oauth.register(
    name='google',
    client_id=settings.GOOGLE_CLIENT_ID,
    client_secret=settings.GOOGLE_CLIENT_SECRET,
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={
        'scope': 'openid email profile',
    }
)

@router.get("/login")
async def google_login(request: Request):
    try:
        redirect_uri = "https://pinnacle-hub.nabindhakal10.com.np/api/auth/google/callback"
        logger.info(f"Login initiated with redirect_uri: {redirect_uri}")
        request.session['oauth_redirect_uri'] = redirect_uri
        return await oauth.google.authorize_redirect(request, redirect_uri)
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/callback")
async def google_callback(request: Request, db: Session = Depends(get_db)):
    try:
        logger.info(f"Callback received with state: {request.query_params.get('state')}")
        logger.info(f"Session data: {dict(request.session)}")
        token = await oauth.google.authorize_access_token(request)
    except MismatchingStateError as e:
        logger.error(f"State mismatch error: {str(e)}")
        if settings.DEBUG:
            logger.warning("Bypassing state validation in DEBUG mode")
            token = await oauth.google.authorize_access_token(
                request, 
                state=request.query_params.get('state')
            )
        else:
            redirect_url = f"{settings.FRONTEND_URL}/login?error=oauth_failed"
            return RedirectResponse(url=redirect_url)
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        redirect_url = f"{settings.FRONTEND_URL}/login?error=oauth_failed"
        return RedirectResponse(url=redirect_url)
    
    user_info = token.get('userinfo')
    if not user_info:
        user_info = await oauth.google.userinfo(token=token)
    
    if not user_info:
        logger.error("Failed to get user info from token")
        redirect_url = f"{settings.FRONTEND_URL}/login?error=user_info_failed"
        return RedirectResponse(url=redirect_url)
    
    email = user_info.get('email')
    google_id = user_info.get('sub')
    name = user_info.get('name')
    avatar = user_info.get('picture')
    
    logger.info(f"Authenticated user: {email}")
    
    existing_user = db.query(User).filter(User.email == email).first()
    if existing_user and existing_user.auth_provider == "local":
        logger.warning(f"Email {email} already registered with local auth")
        redirect_url = f"{settings.FRONTEND_URL}/login?error=email_exists"
        return RedirectResponse(url=redirect_url)
    
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
            is_active=True,
            hashed_password=None
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        logger.info(f"New user created: {username}")
    
    access_token = create_access_token({
        "sub": user.username, 
        "user_id": str(user.id),
        "auth_provider": "google"
    })
    refresh_token = create_refresh_token({
        "sub": user.username, 
        "user_id": str(user.id),
        "auth_provider": "google"
    })
    
    redirect_url = (
        f"{settings.FRONTEND_URL}/oauth-callback?"
        f"access_token={access_token}&"
        f"refresh_token={refresh_token}&"
        f"token_type=bearer"
    )
    
    logger.info(f"Redirecting to frontend: {settings.FRONTEND_URL}")
    return RedirectResponse(url=redirect_url)
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from core.database import get_db
from core.config import settings
from models.user import User
from schemas.user import TokenData
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from core.database import get_db
from core.security import get_hashed_password, create_access_token, verify_password, create_refresh_token
from schemas.user import UserCreate, UserLogin, UserResponse, Access_Token, Refresh_Token, Logout_Token, Token

router = APIRouter(prefix="/auth", tags=["Authentications"])
BLACKLIST = set()

@router.post("/register", response_model=Token)
def register(user: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter((User.username == user.username) | (User.email == user.email)).first()
    if existing:
        raise HTTPException(400, "Username or email already exist")
    new_user = User(
        username=user.username,
        email=user.email,
        fullname=user.fullname,
        hashed_password=get_hashed_password(user.password)
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    access_token = create_access_token({"sub": new_user.username, "user_id": str(new_user.id)})
    refresh_token = create_refresh_token({"sub": new_user.username, "user_id": str(new_user.id)})

    return {"access_token": access_token, "refresh_token": refresh_token, "token_type": "bearer"}

@router.post("/login", response_model=Token)
def login(user_data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == user_data.username).first()
    if not user or not verify_password(user_data.password, user.hashed_password):
        raise HTTPException(401, "Invalid credentials")
    if not user.is_active:
        raise HTTPException(403, "User is inactive")

    access_token = create_access_token({"sub": user.username, "user_id": str(user.id)})
    refresh_token = create_refresh_token({"sub": user.username, "user_id": str(user.id)})

    return {"access_token": access_token, "refresh_token": refresh_token, "token_type": "bearer"}

@router.post("/refresh", response_model=Token)
def refresh_token(request: Refresh_Token):
    try:
        payload = jwt.decode(request.refresh_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username = payload.get("sub")
        user_id = payload.get("user_id")

        if request.refresh_token in BLACKLIST:
            raise HTTPException(401, "Token has been revoked")

        if not username or not user_id:
            raise HTTPException(401, "Invalid token")

        new_access_token = create_access_token({"sub": username, "user_id": user_id})
        new_refresh_token = create_refresh_token({"sub": username, "user_id": user_id})

        return {
            "access_token": new_access_token,
            "refresh_token": new_refresh_token,
            "token_type": "bearer"
        }
    except jwt.JWTError:
        raise HTTPException(401, "Invalid refresh token")

@router.post("/logout", response_model=dict)
def logout(request: Logout_Token):
    BLACKLIST.add(request.refresh_token)
    return {"msg": "Successfully logged out"}


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username)
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.username == token_data.username).first()
    if user is None:
        raise credentials_exception

    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")

    return user
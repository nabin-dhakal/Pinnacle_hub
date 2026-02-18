from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from core.database import get_db
from core.security import get_hashed_password, create_access_token, verify_password
from models.user import User
from schemas.user import UserCreate, UserLogin, UserResponse, Token

router = APIRouter(prefix="/auth", tags=["Authentications"])

@router.post("/register", response_model= Token)
def register(user: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter((User.username == user.username) |     (User.email == user.email)).first()
    if existing:
        raise HTTPException(400, "Username or email already exist")
    new_user =  User(
        username = user.username,
        email = user.email,
        hashed_password = get_hashed_password(user.password)
        )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    token = create_access_token({"sub": new_user.username})
    return {"access_token": token, "token_type": "bearer"}


@router.post("/login", response_model=Token)
def login(user_data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == user_data.username).first()
    if not user or not verify_password(user_data.password, user.hashed_password):
        raise HTTPException(401, "Invalid credentials")
    if not user.is_active:
        raise HTTPException(403, "User is inactive")
    
    token = create_access_token({"sub": user.username})
    return {"access_token": token, "token_type": "bearer"}
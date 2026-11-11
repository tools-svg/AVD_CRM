from typing import Generator, List, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.core.config import settings
from app.models.all_models import User, Role, UserCompanyAssignment, ProjectShare

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")

def get_current_user(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Inactive or non-existent user")
    return user

def require_roles(allowed_roles: List[str]):
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        user_role_name = current_user.role.name if current_user.role else ""
        if user_role_name not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Operation not permitted for role '{user_role_name}'. Required: {allowed_roles}"
            )
        return current_user
    return role_checker

def get_permitted_company_ids(current_user: User, db: Session) -> Optional[List[int]]:
    """
    Returns None if user has global access (Developer, Director, Project Manager).
    Returns a list of allowed company IDs if restricted (Manager).
    """
    role_name = current_user.role.name if current_user.role else ""
    if role_name in ["Developer", "Director", "Project Manager"]:
        return None # Global access
    
    assignments = db.query(UserCompanyAssignment).filter(UserCompanyAssignment.user_id == current_user.id).all()
    return [a.company_id for a in assignments]


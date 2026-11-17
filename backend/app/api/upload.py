import os
import uuid
import aiofiles
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from app.core.config import settings
from app.models.all_models import User
from app.permissions.deps import get_current_user

router = APIRouter(prefix="/upload", tags=["Upload"])

ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".svg", ".jfif"}
ALLOWED_CONTENT_TYPES = {
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "image/svg+xml",
    "image/pjpeg",
    "image/jfif",
    "image/x-png",
}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

@router.post("/image")
async def upload_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """
    Upload image for member avatar or company logo (Section 3).
    Supported formats: PNG, JPG/JPEG, WEBP, SVG.
    Validation: Content-type, extension, file size up to 10MB.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file selected")

    # Extension validation
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported image format '{ext}'. Supported formats: PNG, JPG, JPEG, WEBP, SVG"
        )

    # Content-type validation (clean params if present)
    content_type = (file.content_type or "").lower().split(";")[0].strip()
    if content_type and content_type not in ALLOWED_CONTENT_TYPES and content_type != "application/octet-stream":
        raise HTTPException(
            status_code=400,
            detail=f"Invalid MIME type '{file.content_type}'. Must be an image (PNG, JPG, WEBP, SVG)"
        )

    # Read content to check file size
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File exceeds maximum allowed size of 5MB (size: {len(contents) / (1024 * 1024):.2f}MB)"
        )

    if len(contents) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    safe_filename = f"{uuid.uuid4().hex}{ext}"
    destination_path = os.path.join(settings.UPLOAD_DIR, safe_filename)

    async with aiofiles.open(destination_path, "wb") as out_file:
        await out_file.write(contents)

    relative_url = f"/uploads/{safe_filename}"
    return {
        "url": relative_url,
        "filename": safe_filename,
        "size": len(contents),
        "content_type": file.content_type
    }


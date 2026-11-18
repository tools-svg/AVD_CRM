import os
import uuid
import base64
import io
import aiofiles
try:
    from PIL import Image
    HAS_PIL = True
except ImportError:
    Image = None
    HAS_PIL = False
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
    Upload image for member avatar or company logo.
    Returns both a database-ready Base64 Data URI (so other users on different machines can view it)
    and stores a local file copy.
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
            detail=f"File exceeds maximum allowed size of 10MB (size: {len(contents) / (1024 * 1024):.2f}MB)"
        )

    if len(contents) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    safe_filename = f"{uuid.uuid4().hex}{ext}"
    destination_path = os.path.join(settings.UPLOAD_DIR, safe_filename)

    async with aiofiles.open(destination_path, "wb") as out_file:
        await out_file.write(contents)

    relative_url = f"/uploads/{safe_filename}"

    # Generate Base64 data URI to be stored directly in the DB
    if ext == ".svg" or not HAS_PIL:
        b64_str = base64.b64encode(contents).decode("utf-8")
        if ext == ".svg":
            db_url = f"data:image/svg+xml;base64,{b64_str}"
        else:
            mime = "image/png" if ext == ".png" else "image/jpeg"
            db_url = f"data:{mime};base64,{b64_str}"
    else:
        try:
            img = Image.open(io.BytesIO(contents))
            img.thumbnail((512, 512), Image.Resampling.LANCZOS)
            out_buf = io.BytesIO()
            if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
                img.save(out_buf, format="PNG", optimize=True)
                mime = "image/png"
            else:
                img.convert("RGB").save(out_buf, format="JPEG", quality=85, optimize=True)
                mime = "image/jpeg"
            b64_str = base64.b64encode(out_buf.getvalue()).decode("utf-8")
            db_url = f"data:{mime};base64,{b64_str}"
        except Exception:
            b64_str = base64.b64encode(contents).decode("utf-8")
            mime = "image/png" if ext == ".png" else "image/jpeg"
            db_url = f"data:{mime};base64,{b64_str}"

    return {
        "url": db_url,
        "local_path": relative_url,
        "filename": safe_filename,
        "size": len(contents),
        "content_type": file.content_type
    }

import os
from datetime import datetime, timedelta
from fastapi import FastAPI, Request, UploadFile, File, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, FileResponse, Response
from sqlmodel import Session, select
from contextlib import asynccontextmanager

from config import settings
from database import create_db_and_tables, get_session, Asset
from storage import get_storage, BaseStorage
from utils import get_file_hash

# In-memory cache for GET request cooldowns
# { "filename": "last_access_attempt_time" }
get_request_cache = {}

# In-memory cache for checking exist
exist_cache = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    # await cleanup_old_files()
    yield


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r".*",
    allow_methods=["GET", "HEAD", "PUT", "OPTIONS"],
    allow_headers=["*"],
    max_age=86400,
)

@app.middleware("http")
async def check_risu_git_flag(request: Request, call_next):
    if (request.method.lower() != "options" and request.method.lower() != "head") and "x-risu-git-flag" not in request.headers:
        return Response(status_code=400)
    response = await call_next(request)
    return response


@app.put("/{filename}")
async def upload_file(
        filename: str,
        file: UploadFile = File(...),
        session: Session = Depends(get_session),
        storage: BaseStorage = Depends(get_storage),
):
    if '/' in filename:
        raise HTTPException(status_code=400, detail="Path is contains a slash")

    if file.size > settings.MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File is too large")

    hash_from_name = filename.split("/")[-1].split(".")[0]
    file_bytes = await file.read()
    hash_from_file = await get_file_hash(file_bytes)

    if hash_from_file != hash_from_name:
        raise HTTPException(status_code=400,
                            detail=f"File is corrupt? Excepted: {hash_from_name}, Actual: {hash_from_file}")

    await storage.save(file_bytes, filename)

    asset = session.exec(select(Asset).where(Asset.filename == filename)).first()
    if not asset:
        asset = Asset(
            filename=filename,
            file_type=file.content_type,
            file_size=file.size,
        )
    else:
        asset.file_size = file.size
        asset.upload_date = datetime.utcnow()
        asset.last_accessed_date = datetime.utcnow()

    session.add(asset)
    session.commit()
    session.refresh(asset)

    exist_cache[filename] = True

    return {"status": "ok"}


@app.get("/{filename}")
async def get_file(
        filename: str,
        session: Session = Depends(get_session),
        storage: BaseStorage = Depends(get_storage),
):
    if '/' in filename:
        raise HTTPException(status_code=400, detail="Path is contains a slash")

    cache_headers = {"Cache-Control": "public, max-age=31536000, immutable"}

    now = datetime.utcnow()
    if filename in get_request_cache:
        last_attempt = get_request_cache[filename]
        if now - last_attempt < timedelta(hours=1):
            if settings.STORAGE_TYPE == "local":
                if await storage.exists(filename):
                    return FileResponse(storage.get_path(filename))
                else:
                    raise HTTPException(status_code=404, detail="File not found")
            return RedirectResponse(url=f"{settings.ASSET_URL}/{filename}")

    asset = session.exec(select(Asset).where(Asset.filename == filename)).first()

    if not asset:
        raise HTTPException(status_code=404, detail="File not found")

    asset.last_accessed_date = now
    session.add(asset)
    session.commit()

    get_request_cache[filename] = now

    if settings.STORAGE_TYPE == "local":
        if await storage.exists(filename):
            return FileResponse(storage.get_path(filename), headers=cache_headers)
        else:
            raise HTTPException(status_code=404, detail="File not found")
    return RedirectResponse(url=f"{settings.ASSET_URL}/{filename}", headers=cache_headers)


@app.head("/{filename}")
async def head_file(
        filename: str,
        session: Session = Depends(get_session),
):
    if '/' in filename:
        raise HTTPException(status_code=400, detail="Path is contains a slash")

    cache_headers = {"Cache-Control": "public, max-age=31536000, immutable"}

    if filename in exist_cache:
        return Response(status_code=200, headers=cache_headers)

    asset = session.exec(select(Asset).where(Asset.filename == filename)).first()
    if not asset:
        return Response(status_code=404)

    cache_headers = {"Cache-Control": "public, max-age=31536000, immutable"}
    exist_cache[filename] = True

    return Response(status_code=200, headers=cache_headers)


async def cleanup_old_files(
        session: Session = next(get_session()),
        storage: BaseStorage = get_storage(),
):
    sixty_days_ago = datetime.utcnow() - timedelta(days=60)
    old_assets = session.exec(select(Asset).where(Asset.last_accessed_date < sixty_days_ago)).all()

    for asset in old_assets:
        await storage.delete(asset.filename)
        session.delete(asset)

    session.commit()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=41839)

import hashlib
import magic
from fastapi import UploadFile

async def get_file_hash(file: UploadFile) -> str:
    sha256_hash = hashlib.sha256()
    while chunk := await file.read(8192):
        sha256_hash.update(chunk)
    await file.seek(0)
    return sha256_hash.hexdigest()

def verify_file_type(file: UploadFile, expected_type: str) -> bool:
    try:
        mime = magic.from_buffer(file.file.read(2048), mime=True)
        file.file.seek(0)
        return mime == expected_type
    except Exception:
        return False

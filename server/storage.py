import os
import aiofiles
import boto3
from abc import ABC, abstractmethod
from fastapi import UploadFile
from config import settings

class BaseStorage(ABC):
    @abstractmethod
    async def save(self, file: UploadFile, filename: str) -> None:
        pass

    @abstractmethod
    async def delete(self, filename: str) -> None:
        pass

class LocalStorage(BaseStorage):
    def __init__(self, path: str):
        self.path = path
        if not os.path.exists(path):
            os.makedirs(path)

    async def save(self, file: UploadFile, filename: str) -> None:
        file_path = os.path.join(self.path, filename)
        async with aiofiles.open(file_path, "wb") as f:
            while content := await file.read(1024 * 1024):  # Read in 1MB chunks
                await f.write(content)
        await file.seek(0)

    async def delete(self, filename: str) -> None:
        file_path = os.path.join(self.path, filename)
        if os.path.exists(file_path):
            os.remove(file_path)

class S3Storage(BaseStorage):
    def __init__(self, endpoint_url, access_key, secret_key, bucket_name):
        self.client = boto3.client(
            "s3",
            endpoint_url=endpoint_url,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
        )
        self.bucket_name = bucket_name

    async def save(self, file: UploadFile, filename: str) -> None:
        self.client.upload_fileobj(file.file, self.bucket_name, filename)
        await file.seek(0)

    async def delete(self, filename: str) -> None:
        self.client.delete_object(bucket=self.bucket_name, key=filename)

def get_storage() -> BaseStorage:
    if settings.STORAGE_TYPE == "s3":
        return S3Storage(
            endpoint_url=settings.S3_ENDPOINT_URL,
            access_key=settings.S3_ACCESS_KEY_ID,
            secret_key=settings.S3_SECRET_ACCESS_KEY,
            bucket_name=settings.S3_BUCKET_NAME,
        )
    return LocalStorage(settings.LOCAL_STORAGE_PATH)

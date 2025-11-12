import os
import aiofiles
import aioboto3
from abc import ABC, abstractmethod
from config import settings
from botocore.exceptions import ClientError

class BaseStorage(ABC):
    @abstractmethod
    async def save(self, data: bytes, filename: str) -> None:
        pass

    @abstractmethod
    async def delete(self, filename: str) -> None:
        pass

    @abstractmethod
    async def exists(self, filename: str) -> bool:
        pass

    @abstractmethod
    def get_path(self, filename: str) -> str:
        pass

class LocalStorage(BaseStorage):
    def __init__(self, path: str):
        self.path = path
        if not os.path.exists(path):
            os.makedirs(path)

    def get_path(self, filename: str) -> str:
        return os.path.join(self.path, filename)

    async def save(self, data: bytes, filename: str) -> None:
        file_path = self.get_path(filename)
        async with aiofiles.open(file_path, "wb") as f:
            await f.write(data)

    async def delete(self, filename: str) -> None:
        file_path = self.get_path(filename)
        if os.path.exists(file_path):
            os.remove(file_path)

    async def exists(self, filename: str) -> bool:
        file_path = self.get_path(filename)
        return os.path.exists(file_path)

class S3Storage(BaseStorage):
    def __init__(self, endpoint_url, access_key, secret_key, bucket_name):
        self.session = aioboto3.Session()
        self.client_config = {
            "endpoint_url": endpoint_url,
            "aws_access_key_id": access_key,
            "aws_secret_access_key": secret_key,
        }
        self.bucket_name = bucket_name

    async def save(self, data: bytes, filename: str) -> None:
        async with self.session.client("s3", **self.client_config) as s3:
            await s3.put_object(Bucket=self.bucket_name, Key=filename, Body=data)

    async def delete(self, filename: str) -> None:
        async with self.session.client("s3", **self.client_config) as s3:
            await s3.delete_object(Bucket=self.bucket_name, Key=filename)

    async def exists(self, filename: str) -> bool:
        async with self.session.client("s3", **self.client_config) as s3:
            try:
                await s3.head_object(Bucket=self.bucket_name, Key=filename)
                return True
            except ClientError as e:
                if e.response["Error"]["Code"] == "404":
                    return False
                else:
                    raise

    def get_path(self, filename: str) -> str:
        raise NotImplementedError("S3 storage does not support local paths")


def get_storage() -> BaseStorage:
    if settings.STORAGE_TYPE == "s3":
        return S3Storage(
            endpoint_url=settings.S3_ENDPOINT_URL,
            access_key=settings.S3_ACCESS_KEY_ID,
            secret_key=settings.S3_SECRET_ACCESS_KEY,
            bucket_name=settings.S3_BUCKET_NAME,
        )
    return LocalStorage(settings.LOCAL_STORAGE_PATH)

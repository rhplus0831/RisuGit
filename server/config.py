import os
from typing import Literal


class Settings:
    STORAGE_TYPE: Literal["local", "s3"]
    LOCAL_STORAGE_PATH: str
    S3_ENDPOINT_URL: str | None
    S3_ACCESS_KEY_ID: str | None
    S3_SECRET_ACCESS_KEY: str | None
    S3_BUCKET_NAME: str | None
    DATABASE_URL: str
    MAX_FILE_SIZE: int
    ALLOWED_MIME_TYPES: list[str]
    ASSET_URL: str

    def __init__(self):
        storage_type = os.getenv("STORAGE_TYPE", "local")
        if storage_type not in ("local", "s3"):
            raise ValueError(
                f"Invalid STORAGE_TYPE: {storage_type}. Must be 'local' or 's3'."
            )
        self.STORAGE_TYPE = storage_type

        self.LOCAL_STORAGE_PATH = os.getenv("LOCAL_STORAGE_PATH", "assets")

        self.S3_ENDPOINT_URL = os.getenv("S3_ENDPOINT_URL")
        self.S3_ACCESS_KEY_ID = os.getenv("S3_ACCESS_KEY_ID")
        self.S3_SECRET_ACCESS_KEY = os.getenv("S3_SECRET_ACCESS_KEY")
        self.S3_BUCKET_NAME = os.getenv("S3_BUCKET_NAME")

        self.DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./assets.db")

        self.MAX_FILE_SIZE = int(os.getenv("MAX_FILE_SIZE", 25 * 1024 * 1024))  # 25MB

        allowed_mime_types_str = os.getenv("ALLOWED_MIME_TYPES")
        if allowed_mime_types_str:
            self.ALLOWED_MIME_TYPES = [
                m.strip() for m in allowed_mime_types_str.split(",")
            ]
        else:
            self.ALLOWED_MIME_TYPES = [
                "image/jpeg",
                "image/png",
                "image/gif",
                "image/webp",
                "video/mp4",
                "video/webm",
                "audio/mpeg",
                "audio/ogg",
                "audio/wav",
            ]
        self.ASSET_URL = os.getenv(
            "ASSET_URL", "https://risu-asset.mephistopheles.moe"
        )


settings = Settings()
print("Using: " + settings.STORAGE_TYPE)
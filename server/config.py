from typing import Literal

class Settings:
    STORAGE_TYPE: Literal["local", "s3"] = "local"
    LOCAL_STORAGE_PATH: str = "assets"
    S3_ENDPOINT_URL: str | None = None
    S3_ACCESS_KEY_ID: str | None = None
    S3_SECRET_ACCESS_KEY: str | None = None
    S3_BUCKET_NAME: str | None = None
    DATABASE_URL: str = "sqlite:///./assets.db"
    MAX_FILE_SIZE: int = 25 * 1024 * 1024  # 25MB
    ALLOWED_MIME_TYPES: list[str] = [
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
    ASSET_URL: str = "https://risu-asset.mephistopheles.moe"


settings = Settings()

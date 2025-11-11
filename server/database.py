from sqlmodel import Field, SQLModel, create_engine, Session
from datetime import datetime
from config import settings

class Asset(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    filename: str = Field(index=True, unique=True)
    file_type: str
    file_size: int
    upload_date: datetime = Field(default_factory=datetime.utcnow)
    last_accessed_date: datetime = Field(default_factory=datetime.utcnow)


engine = create_engine(settings.DATABASE_URL, connect_args={"check_same_thread": False})

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session

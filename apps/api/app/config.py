from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "postgresql+psycopg://board:board@localhost:5432/board"

    session_cookie_name: str = "sid"
    session_secret: str = "change-me"
    session_ttl_days: int = 7
    session_secure: bool = False

    cors_origins: str = "http://127.0.0.1:5173,http://localhost:5173"


settings = Settings()

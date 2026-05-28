from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "postgresql+psycopg://board:board@localhost:5432/board"

    session_cookie_name: str = "sid"
    session_secret: str = "change-me"
    session_ttl_days: int = 7
    session_secure: bool = False

    cors_origins: str = "http://127.0.0.1:5173,http://localhost:5173"

    upload_dir: str = "uploads"
    upload_max_bytes: int = 2 * 1024 * 1024

    # 站点公网地址（邮件中的链接，与 CORS_ORIGINS 主站一致即可）
    app_public_url: str = "http://127.0.0.1:5173"

    # @ 引用邮件通知（未配置 SMTP 时自动跳过）
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    smtp_use_tls: bool = True


settings = Settings()

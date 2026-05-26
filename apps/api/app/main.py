from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.staticfiles import StaticFiles
from starlette.responses import HTMLResponse

from app.config import settings
from app.routers import auth, boards, health, posts, uploads, users
from app.services.media import upload_root

app = FastAPI(title="交换心声 API", version="0.1.0", docs_url=None)

_origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(boards.router, prefix="/api/v1")
app.include_router(posts.board_posts_router, prefix="/api/v1")
app.include_router(posts.posts_router, prefix="/api/v1")
app.include_router(uploads.router, prefix="/api/v1")

_upload_dir = upload_root()
app.mount("/uploads", StaticFiles(directory=str(_upload_dir)), name="uploads")


@app.get("/docs", include_in_schema=False)
async def swagger_ui() -> HTMLResponse:
    """默认 Swagger 不会带 Cookie；注入 requestInterceptor 以便 Try it out 使用会话登录。"""
    base = get_swagger_ui_html(
        openapi_url=app.openapi_url,
        title=f"{app.title} - Swagger UI",
        swagger_ui_parameters={
            "requestInterceptor": "REPLACE_ME",
        },
    )
    body = base.body.decode("utf-8")
    # get_swagger_ui_html 只能 JSON 序列化参数，函数会变成 null；改为把占位符换成 JS 函数表达式
    body = body.replace(
        '"requestInterceptor": "REPLACE_ME",',
        '"requestInterceptor": (req) => { req.credentials = \'include\'; return req; },',
    )
    # 勿沿用 base.headers 里的 Content-Length：替换正文后长度已变，会导致 ERR_CONTENT_LENGTH_MISMATCH
    return HTMLResponse(content=body, status_code=base.status_code)

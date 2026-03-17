from fastapi import APIRouter

router = APIRouter()

# TODO: Бек 1 — реализует авторизацию
# POST /api/auth/register
# POST /api/auth/login
# GET  /api/auth/me


@router.get("/ping")
def ping():
    return {"router": "auth", "status": "todo"}


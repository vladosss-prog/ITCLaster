from fastapi import APIRouter

router = APIRouter()

# TODO: Бек 5 — регистрация, расписание, комментарии, оценки
# POST   /api/events/{id}/register
# GET    /api/schedule/my
# POST   /api/schedule/reports/{id}
# DELETE /api/schedule/reports/{id}
# POST   /api/reports/{id}/comments
# POST   /api/reports/{id}/feedback
# GET    /api/events/{id}/program
# GET    /api/users/search?q=


@router.get("/ping")
def ping():
    return {"router": "participants", "status": "todo"}


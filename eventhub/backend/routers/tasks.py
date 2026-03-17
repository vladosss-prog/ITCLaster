from fastapi import APIRouter

router = APIRouter()

# TODO: Бек 4 — канбан задач, % выполнения, WS-уведомления
# GET    /api/tasks/?event_id=
# POST   /api/tasks/
# PATCH  /api/tasks/{id}/status
# GET    /api/events/{id}/progress
# GET    /api/events/calendar


@router.get("/ping")
def ping():
    return {"router": "tasks", "status": "todo"}


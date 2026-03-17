from fastapi import APIRouter

router = APIRouter()

# TODO: Бек 1 — CRUD мероприятий, секций, докладов, назначение ролей
# GET    /api/events/
# POST   /api/events/
# GET    /api/events/{id}
# POST   /api/events/{id}/curators
# POST   /api/reports/{id}/speaker


@router.get("/ping")
def ping():
    return {"router": "events", "status": "todo"}


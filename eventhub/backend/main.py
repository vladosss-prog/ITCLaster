from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import tasks

from routers import auth, chat, events, participants, tasks
from routers.events import reports_router, sections_router, users_router

app = FastAPI(
    title="EventHub API",
    version="1.0.0",
    description="Платформа управления мероприятиями — ИТ-Кластер Сибири",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router,         prefix="/api/auth",         tags=["Auth"])
app.include_router(events.router,       prefix="/api/events",       tags=["Events"])
app.include_router(users_router,        prefix="/api/users",        tags=["Users"])
app.include_router(sections_router,     prefix="/api/sections",     tags=["Sections"])
app.include_router(reports_router,      prefix="/api/reports",      tags=["Reports"])
app.include_router(tasks.router,        prefix="/api",              tags=["Tasks"])
app.include_router(chat.router,         prefix="/api/chat",         tags=["Chat"])
app.include_router(participants.router, prefix="/api",              tags=["Participants"])

@app.get("/", tags=["Health"])
def root():
    return {"status": "ok", "message": "EventHub API работает", "docs": "/docs"}

@app.get("/health", tags=["Health"])
def health():
    return {"status": "healthy"}

allow_origins=[
    "http://localhost:5173",
    "https://itclaster-production-b3d6.up.railway.app"
]
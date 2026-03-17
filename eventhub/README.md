# EventHub 🚀
Платформа управления мероприятиями — Цифровой хакатон 2026, ИТ-Кластер Сибири

## Стек
- **Backend:** Python 3.11, FastAPI, PostgreSQL, SQLAlchemy 2.0, Alembic, JWT
- **Frontend:** React 18, Vite, TypeScript, Tailwind CSS *(в разработке)*

---

## 🔧 Первый запуск (делаешь ОДИН РАЗ)

### 1. Клонируй репо
```bash
git clone https://github.com/ВАШ_НИК/eventhub.git
cd eventhub
```

### 2. Создай виртуальное окружение
```bash
py -3.11 -m venv venv
venv\Scripts\activate
```
> После активации в начале строки терминала появится `(venv)`

### 3. Установи зависимости
```bash
pip install -r requirements.txt
```

### 4. Создай базу данных
Открой **pgAdmin** → правой кнопкой на **Databases** → **Create** → **Database**
Имя базы: `eventhub_db` → Save

### 5. Настрой .env
```bash
copy .env.example .env
```
Открой `.env` и вставь свой пароль от PostgreSQL в `DATABASE_URL`

### 6. Создай таблицы в БД
```bash
cd backend
alembic upgrade head
```
> Если всё ок — увидишь `Running upgrade -> xxxx, init_v1`

### 7. Запусти сервер
```bash
uvicorn main:app --reload
```

Открой браузер:
- **http://localhost:8000** — проверка что работает
- **http://localhost:8000/docs** — Swagger документация всех эндпоинтов

---

## 📁 Структура проекта

```
eventhub/
├── backend/
│   ├── main.py              # точка входа — подключает роутеры
│   ├── database.py          # подключение к PostgreSQL
│   ├── models.py            # ВСЕ таблицы БД (не трогай без согласования!)
│   ├── routers/             # каждый разработчик — свой файл
│   │   ├── auth.py          # Бек 1
│   │   ├── events.py        # Бек 1
│   │   ├── tasks.py         # Бек 4
│   │   ├── participants.py  # Бек 5
│   │   └── chat.py          # Бек 6
│   ├── schemas/             # Pydantic-схемы запросов/ответов
│   └── alembic/             # миграции БД
├── frontend/                # React (отдельная команда)
│   └── src/
│       ├── api/
│       ├── components/
│       └── pages/
├── .env.example             # шаблон настроек
├── .gitignore
├── requirements.txt
└── README.md
```

---

## 🌿 Git-процесс

```bash
# Создай свою ветку (один раз)
git checkout -b feature/tasks        # или auth, participants, chat

# Работаешь, потом пушишь
git add .
git commit -m "feat: добавил CRUD задач"
git push origin feature/tasks

# Забрать изменения от других (делай каждое утро)
git pull origin main
```

## ⚠️ Правила
- `models.py` — редактирует **только Бек 1** после согласования с командой
- `.env` — **никогда** не пушить в гит
- Перед пушем в `main` — обязательно `alembic upgrade head` на своей машине

---

## 👥 Распределение

| Человек | Роль | Файлы |
|---------|------|-------|
| Бек 1 | Ядро + Auth | `models.py`, `routers/auth.py`, `routers/events.py` |
| Бек 4 | Задачи + DevOps | `routers/tasks.py` |
| Бек 5 | Участники | `routers/participants.py` |
| Бек 6 | Мессенджер | `routers/chat.py` |
| Фронт | React UI | `frontend/` |
| Дизайн | Figma | — |


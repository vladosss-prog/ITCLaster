# ITCLaster
# 🚀 EventHub — Инструкция запуска

> Читай внимательно. Здесь всё что нужно чтобы запустить проект с нуля.

---

## ⚡ Быстрый старт (каждый день)

Открываешь **два терминала** в VS Code и запускаешь:

### Терминал 1 — Бэкенд
```bash
# из корня проекта (папка eventhub/)
venv\Scripts\activate
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Терминал 2 — Фронтенд
```bash
# из корня проекта (папка eventhub/)
cd frontend
npm run dev -- --host 0.0.0.0
```

### Проверяй в браузере (обычный Chrome, не встроенный в VS Code!)
| Что | Адрес |
|-----|-------|
| 🌐 Сайт | http://localhost:5173 |
| ⚙️ API | http://localhost:8000 |
| 📋 Swagger | http://localhost:8000/docs |

---

## 🔧 Первый запуск (один раз на новой машине)

### 1. Клонируй репо
```bash
git clone https://github.com/vladosss-prog/ITCLaster.git
cd ITCLaster
```

### 2. Создай виртуальное окружение Python
```bash
py -3.11 -m venv venv
venv\Scripts\activate
```
> В начале строки терминала появится `(venv)` — значит всё ок

### 3. Установи зависимости Python

### 3. Установи зависимости
```bash
pip install -r requirements.txt
```

### 4. Создай базу данных в pgAdmin
Открой **pgAdmin** → правой кнопкой на **Databases** → **Create → Database**
Имя: `eventhub_db` → Save

### 5. Настрой .env
```bash
copy .env.example .env
```
Открой `.env` и впиши свой пароль от PostgreSQL:
```
DATABASE_URL=postgresql+psycopg://postgres:ТВОЙ_ПАРОЛЬ@localhost:5432/eventhub_db
```

### 6. Примени миграции (создай таблицы в БД)
```bash
cd backend
alembic upgrade head
```
> Если видишь `Running upgrade -> ...` — всё хорошо

### 7. Установи зависимости фронта
```bash
cd ../frontend
npm install
```

### 8. Запускай (см. раздел «Быстрый старт» выше)

---

## ❓ Почему --host 0.0.0.0

На Windows браузер иногда резолвит `localhost` в IPv6 адрес `::1`,
а uvicorn и vite по умолчанию слушают только на `127.0.0.1` (IPv4).
Из-за этого сайт не открывается с ошибкой `ERR_CONNECTION_REFUSED`.

Флаг `--host 0.0.0.0` говорит «слушай на всех адресах» — и проблема исчезает.

**Чтобы не писать флаг каждый раз** — в `frontend/vite.config.ts` уже прописано:
```ts
server: {
  host: '0.0.0.0',
  port: 5173,
}
```
После этого достаточно просто `npm run dev`.

---

## ⚠️ Частые ошибки

| Ошибка | Причина | Решение |
|--------|---------|---------|
| `ERR_CONNECTION_REFUSED` на :5173 | Vite запущен без `--host 0.0.0.0` | Перезапусти с флагом |
| `ERR_CONNECTION_REFUSED` на :8000 | uvicorn запущен без `--host 0.0.0.0` | Перезапусти с флагом |
| `(venv)` нет в терминале | Не активировано виртуальное окружение | Запусти `venv\Scripts\activate` |
| Ошибка подключения к БД | Неверный пароль в .env | Проверь `DATABASE_URL` в `.env` |
| `ModuleNotFoundError` | Зависимости не установлены | Запусти `pip install -r requirements.txt` |

---

## 📁 Структура проекта

```
eventhub/
├── backend/
│   ├── main.py              # точка входа, подключает роутеры
│   ├── database.py          # подключение к PostgreSQL
│   ├── models.py            # ВСЕ таблицы БД — не трогай без согласования!
│   ├── routers/
│   │   ├── auth.py          # Бек 1
│   │   ├── events.py        # Бек 1
│   │   ├── tasks.py         # Бек 4
│   │   ├── participants.py  # Бек 5
│   │   └── chat.py          # Бек 6
│   ├── schemas/             # Pydantic-схемы
│   └── alembic/             # миграции БД
├── frontend/
│   └── src/
│       ├── api/
│       ├── components/
│       └── pages/
├── .env.example
├── requirements.txt
└── README.md
```

---

## 👥 Кто за что отвечает

| Человек | Роль | Файлы |
|---------|------|-------|
| Бек 1 | Auth + Events | `models.py`, `auth.py`, `events.py` |
| Бек 4 | Задачи | `tasks.py` |
| Бек 5 | Участники | `participants.py` |
| Бек 6 | Чат | `chat.py` |
| Фронт | React UI | `frontend/` |

---

## 🌿 Git — как работать

```bash
# Забрать последние изменения (делай каждое утро!)
git pull origin develop

# Создай свою ветку (один раз)
git checkout -b feature/auth

# Работал, закончил — пушь
git add .
git commit -m "feat: добавил регистрацию"
git push origin feature/auth
```

> ⚠️ **Никогда** не пушь `.env` в гит!
> ⚠️ `models.py` редактирует только Бек 1 после согласования с командой
### 4. Создай базу данных
Открой **pgAdmin** → правой кнопкой на **Databases** → **Create** → **Database**
Имя: `eventhub_db` → Сохранить

### 5. Настрой переменные окружения
```bash
copy .env.example .env
```
Открой `.env` и укажи свой пароль от PostgreSQL:
```
DATABASE_URL=postgresql://postgres:ВАШ_ПАРОЛЬ@localhost/eventhub_db
SECRET_KEY=придумайте_длинную_строку
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=480
```

### 6. Создай таблицы в БД
```bash
cd backend
..\venv\Scripts\alembic upgrade head
```

### 7. Запусти сервер
```bash
..\venv\Scripts\uvicorn main:app --reload
```

- API: [http://localhost:8000](http://localhost:8000)
- Swagger документация: [http://localhost:8000/docs](http://localhost:8000/docs)

---
## Запуск фронтенд-проекта
Перед началом убедитесь, что у вас установлена [Node.js](https://nodejs.org) версии **18.0.0 или выше** (рекомендуется LTS).

# Быстрый старт

1. **Перейдите в директорию фронтенда:**
   ```bash
   cd eventhub/frontend
   
2. ```bash
   npm install
   
3. ```bash
   npm run dev
   
4.Откройте приложение:
Перейдите по адресу http://localhost:5173 в вашем браузере.
## Разработка

### Git-процесс
```bash
# Создай свою ветку
git checkout -b feature/tasks

# Работаешь, коммитишь
git add .
git commit -m "feat: CRUD задач с фильтрами"
git push origin feature/tasks

# Каждое утро забираешь изменения команды
git pull origin main
```

### Распределение команды

| Человек | Направление | Файлы |
|---|---|---|
| Бек 1 | Ядро, Auth, Events | `models.py`, `routers/auth.py`, `routers/events.py` |
| Бек 4 | Задачи, Календарь | `routers/tasks.py` |
| Бек 5 | Участники, Программа | `routers/participants.py` |
| Бек 6 | Мессенджер, WebSocket | `routers/chat.py` |
| Фронт | React UI | `frontend/` |
| Дизайн | Figma | — |

### Правила
- `models.py` редактирует только **Бек 1** после согласования с командой
- Если нужна новая таблица — обсуждаем голосом, Бек 1 добавляет и делает новую миграцию
- После `git pull` всегда запускай `alembic upgrade head` — могли появиться новые миграции
- `.env` никогда не пушить в гит

---

## Роадмап после хакатона

- Мобильное приложение (React Native)
- OAuth через Google / VK / Госуслуги
- Email и Telegram-уведомления
- Интеграция с Zoom и Google Calendar
- Расширенная аналитика и экспорт данных
- Платёжный модуль для платных мероприятий

---

*EventHub — Цифровой хакатон 2026 · ОмГТУ · ИТ-Кластер Сибири*

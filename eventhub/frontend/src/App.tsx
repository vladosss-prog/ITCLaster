import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from "react-router-dom";

import type {
  User,
  Task,
  TaskStatus,
  Event as EventData,
  GlobalRole,
  ChatRoom,
  ChatMessage,
  ChatSocketEvent,
} from "./api/apiClient";

import {
  authAPI,
  eventsAPI,
  tasksAPI,
  participantsAPI,
  chatAPI,
  createChatSocket,
  usersAPI,
} from "./api/apiClient";

import { CuratorDashboard } from "./components/dashboard/CuratorDashboard";
import { CreateEventPage } from "./pages/CreateEventPage";
import { ReportPage } from "./pages/ReportPage";

// ═══════════════════════════════════════════════════════════════
// GLOBAL CSS
// ═══════════════════════════════════════════════════════════════
const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');

:root {
  --primary: #2563eb;
  --primary-dark: #0d1b3e;
  --primary-light: #3b82f6;
  --accent: #f59e0b;
  --bg-light: #f1f5f9;
  --bg-medium: #e8f0fe;
  --border: #e2e8f0;
  --text-main: #1e293b;
  --text-muted: #64748b;
  --success: #16a34a;
  --danger: #ef4444;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: 'Nunito', sans-serif;
  background: var(--bg-light);
  color: var(--text-main);
  min-height: 100vh;
}

a { text-decoration: none; color: inherit; }

.dashboard-wrapper { display: flex; min-height: 100vh; }

.dashboard-sidebar {
  width: 260px; background: white; border-right: 1.5px solid var(--border);
  padding: 28px 20px; display: flex; flex-direction: column; gap: 24px;
  position: sticky; top: 0; height: 100vh; overflow-y: auto;
}

.dashboard-main-content {
  flex: 1; padding: 32px 36px; overflow-y: auto; min-height: 100vh;
}

.sidebar-nav-list { display: flex; flex-direction: column; gap: 4px; }

.nav-link {
  display: flex; align-items: center; padding: 10px 14px; border-radius: 10px;
  font-weight: 700; font-size: 14px; cursor: pointer;
  transition: background 0.15s, color 0.15s;
  font-family: 'Nunito', sans-serif; border: none; text-align: left; width: 100%;
}
.nav-link:hover { background: #eef6ff !important; }

.auth-page {
  min-height: 100vh; display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #0d1b3e 0%, #1e3a8a 50%, #2563eb 100%);
  padding: 20px;
}
.auth-card {
  background: white; border-radius: 24px; padding: 40px 36px;
  width: 100%; max-width: 420px; box-shadow: 0 25px 80px rgba(0,0,0,0.25);
}
.auth-input {
  width: 100%; padding: 12px 16px; border-radius: 10px;
  border: 1.5px solid var(--border); font-size: 14px;
  font-family: 'Nunito', sans-serif; outline: none;
  transition: border-color 0.2s; box-sizing: border-box;
}
.auth-input:focus { border-color: var(--primary); }
.auth-btn {
  width: 100%; padding: 13px; background: var(--primary); color: white;
  border: none; border-radius: 100px; font-weight: 800; font-size: 15px;
  cursor: pointer; font-family: 'Nunito', sans-serif; transition: opacity 0.15s;
}
.auth-btn:hover { opacity: 0.9; }
.auth-btn:disabled { opacity: 0.6; cursor: not-allowed; }

.kanban-board { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.kanban-col { background: var(--bg-light); border-radius: 14px; padding: 16px; min-height: 220px; }
.kanban-card {
  background: white; border-radius: 12px; padding: 14px 16px;
  box-shadow: 0 2px 8px rgba(74,89,138,0.06); border: 1.5px solid var(--border);
  margin-bottom: 10px; transition: box-shadow 0.15s, transform 0.1s;
}
.kanban-card:hover { box-shadow: 0 4px 16px rgba(74,89,138,0.12); transform: translateY(-1px); }

.cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
.cal-cell {
  min-height: 90px; background: white; border-radius: 8px; padding: 6px 8px;
  border: 1.5px solid var(--border); transition: border-color 0.15s; position: relative;
}
.cal-cell:hover { border-color: var(--primary-light); }
.cal-cell.today { border-color: var(--primary); background: #eef6ff; }
.cal-cell.other-month { background: #f8fafc; opacity: 0.5; }
.cal-day-num { font-size: 12px; font-weight: 800; color: var(--text-muted); margin-bottom: 4px; }
.cal-cell.today .cal-day-num { color: var(--primary); }
.cal-dot {
  font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px;
  margin-bottom: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

.chat-wrapper { display: flex; height: calc(100vh - 100px); border-radius: 16px; overflow: hidden; border: 1.5px solid var(--border); background: white; }
.chat-rooms-list { width: 280px; border-right: 1.5px solid var(--border); display: flex; flex-direction: column; background: #fafbfc; }
.chat-rooms-header { padding: 16px 18px; border-bottom: 1.5px solid var(--border); font-weight: 800; font-size: 15px; color: var(--primary-dark); display: flex; justify-content: space-between; align-items: center; }
.chat-room-item { padding: 12px 18px; cursor: pointer; border-bottom: 1px solid var(--border); transition: background 0.12s; display: flex; align-items: center; gap: 10px; }
.chat-room-item:hover { background: #eef6ff; }
.chat-room-item.active { background: #e8f0fe; border-left: 3px solid var(--primary); }
.chat-messages-area { flex: 1; display: flex; flex-direction: column; }
.chat-messages-header { padding: 14px 20px; border-bottom: 1.5px solid var(--border); font-weight: 800; font-size: 14px; color: var(--primary-dark); background: white; }
.chat-messages-scroll { flex: 1; overflow-y: auto; padding: 16px 20px; display: flex; flex-direction: column; gap: 8px; }
.chat-msg { max-width: 70%; padding: 10px 14px; border-radius: 14px; font-size: 13px; line-height: 1.5; word-wrap: break-word; }
.chat-msg.mine { align-self: flex-end; background: var(--primary); color: white; border-bottom-right-radius: 4px; }
.chat-msg.theirs { align-self: flex-start; background: #f1f5f9; color: var(--text-main); border-bottom-left-radius: 4px; }
.chat-input-bar { padding: 12px 16px; border-top: 1.5px solid var(--border); display: flex; gap: 10px; background: white; }
.chat-input-bar input { flex: 1; padding: 10px 14px; border-radius: 10px; border: 1.5px solid var(--border); font-size: 13px; font-family: 'Nunito', sans-serif; outline: none; }
.chat-input-bar input:focus { border-color: var(--primary); }
.chat-input-bar button { padding: 10px 20px; background: var(--primary); color: white; border: none; border-radius: 10px; font-weight: 800; font-size: 13px; cursor: pointer; font-family: 'Nunito', sans-serif; white-space: nowrap; }
.chat-empty { flex: 1; display: flex; align-items: center; justify-content: center; color: var(--text-muted); font-weight: 600; font-size: 14px; }
@media (max-width: 900px) { .chat-rooms-list { width: 200px; } .chat-msg { max-width: 85%; } }

.landing-hero {
  min-height: 100vh; display: flex; flex-direction: column;
  background: linear-gradient(160deg, #0d1b3e 0%, #162557 40%, #1e3a8a 70%, #2563eb 100%);
  color: white; position: relative; overflow: hidden;
}
.landing-hero::before {
  content: ''; position: absolute; inset: 0;
  background: radial-gradient(circle at 80% 20%, rgba(59,130,246,0.3) 0%, transparent 60%),
              radial-gradient(circle at 20% 80%, rgba(245,158,11,0.15) 0%, transparent 50%);
  pointer-events: none;
}
.landing-nav {
  display: flex; justify-content: space-between; align-items: center;
  padding: 20px 48px; position: relative; z-index: 2;
}
.landing-content {
  flex: 1; display: flex; align-items: center; justify-content: center;
  padding: 0 48px; position: relative; z-index: 2;
}
.landing-features { padding: 80px 48px; background: white; }
.feature-card {
  background: var(--bg-light); border-radius: 20px; padding: 32px 28px;
  border: 1.5px solid var(--border); transition: transform 0.2s, box-shadow 0.2s;
}
.feature-card:hover { transform: translateY(-4px); box-shadow: 0 12px 40px rgba(74,89,138,0.1); }

@media (max-width: 900px) {
  .dashboard-wrapper { flex-direction: column; }
  .dashboard-sidebar {
    width: 100%; height: auto; position: relative;
    flex-direction: row; flex-wrap: wrap; justify-content: center; gap: 12px; padding: 16px;
  }
  .sidebar-nav-list { flex-direction: row; flex-wrap: wrap; gap: 6px; }
  .dashboard-main-content { padding: 20px 16px; }
  .kanban-board { grid-template-columns: 1fr; }
  .landing-nav { padding: 16px 20px; }
  .landing-content { padding: 0 20px; }
  .landing-features { padding: 40px 20px; }
}

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(24px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
`;

function injectGlobalCSS() {
  if (typeof document === "undefined") return;
  if (document.getElementById("eh-css")) return;
  const s = document.createElement("style");
  s.id = "eh-css";
  s.textContent = GLOBAL_CSS;
  document.head.appendChild(s);
}

// ═══════════════════════════════════════════════════════════════
// UI HELPERS
// ═══════════════════════════════════════════════════════════════
export function Spinner({ label = "Загрузка..." }: { label?: string }) {
  return (
    <div style={{ textAlign: "center", padding: 48, color: "var(--text-muted)" }}>
      <div style={{ fontSize: 32, marginBottom: 12, animation: "spin 1s linear infinite" }}>
        ⏳
      </div>
      <div style={{ fontWeight: 700, fontSize: 14 }}>{label}</div>
    </div>
  );
}

export function ErrorBlock({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      style={{
        background: "#fef2f2",
        border: "1.5px solid #fecaca",
        borderRadius: 14,
        padding: "20px 24px",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 28, marginBottom: 8 }}>⚠️</div>
      <div
        style={{
          color: "#dc2626",
          fontWeight: 700,
          fontSize: 14,
          marginBottom: 12,
        }}
      >
        {message}
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            padding: "8px 20px",
            background: "#dc2626",
            color: "white",
            border: "none",
            borderRadius: 100,
            fontWeight: 800,
            fontSize: 13,
            cursor: "pointer",
            fontFamily: "Nunito, sans-serif",
          }}
        >
          Повторить
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "48px 20px",
        color: "var(--text-muted)",
      }}
    >
      <div style={{ fontSize: 48, marginBottom: 12 }}>{icon}</div>
      <div
        style={{
          fontWeight: 800,
          fontSize: 16,
          color: "var(--primary-dark)",
          marginBottom: 6,
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: 14 }}>{description}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DEMO DATA — «ХАКАТОН ВНУТРИ ХАКАТОНА»
// ═══════════════════════════════════════════════════════════════
interface DemoUser extends User {
  password: string;
}

const DEMO_USERS: Record<string, DemoUser> = {
  "org@it.ru": {
    id: "u1",
    email: "org@it.ru",
    password: "org",
    full_name: "Организатор Иванов",
    global_role: "ORGANIZER",
    organization: "ИТ-Кластер Сибири",
  },
  "user@it.ru": {
    id: "u2",
    email: "user@it.ru",
    password: "user",
    full_name: "Иван Участников",
    global_role: "PARTICIPANT",
    organization: "ОмГТУ",
  },
  "curator@it.ru": {
    id: "u3",
    email: "curator@it.ru",
    password: "curator",
    full_name: "Куратор Секционов",
    global_role: "PARTICIPANT" as GlobalRole,
    organization: "CURATOR_DEMO",
  },
};

const DEMO_EVENTS: EventData[] = [
  {
    id: "e1",
    title: "XI Международный ИТ-Форум 2026",
    description:
      "«Основы цифрового будущего» — крупнейший IT-форум Сибири. Секции: ИнфоБез, ML, DevOps, Frontend, UX/UI.",
    start_date: "2026-03-16",
    end_date: "2026-03-20",
    owner_id: "u1",
    status: "PUBLISHED",
  },
  {
    id: "e2",
    title: "Цифровой хакатон 2026",
    description:
      "Хакатон ИТ-Кластера Сибири × ОмГТУ. 6 кейсов, 3 дня, 30 команд.",
    start_date: "2026-03-16",
    end_date: "2026-03-20",
    owner_id: "u1",
    status: "PUBLISHED",
  },
  {
    id: "e3",
    title: "Робофест Омск 2026",
    description: "Фестиваль робототехники. Черновик — запуск осенью.",
    start_date: "2026-10-01",
    end_date: "2026-10-03",
    owner_id: "u1",
    status: "DRAFT",
  },
];

const DEMO_TASKS: Task[] = [
  {
    id: "t1",
    event_id: "e1",
    title: "Подтвердить спикеров секции ИнфоБез",
    assigned_to: "u3",
    assigned_to_name: "Куратор Секционов",
    created_by: "u1",
    status: "IN_PROGRESS",
    due_date: "2026-03-18",
  },
  {
    id: "t2",
    event_id: "e1",
    title: "Забронировать Зал А (корпус 1)",
    assigned_to: "u1",
    assigned_to_name: "Организатор Иванов",
    created_by: "u1",
    status: "DONE",
    due_date: "2026-03-16",
  },
  {
    id: "t3",
    event_id: "e1",
    title: "Подготовить раздаточные материалы",
    assigned_to: "u2",
    assigned_to_name: "Иван Участников",
    created_by: "u1",
    status: "TODO",
    due_date: "2026-03-19",
  },
  {
    id: "t4",
    event_id: "e1",
    title: "Настроить трансляцию секции ML",
    assigned_to: "u1",
    assigned_to_name: "Организатор Иванов",
    created_by: "u1",
    status: "TODO",
    due_date: "2026-03-19",
  },
  {
    id: "t5",
    event_id: "e2",
    title: "Настроить WiFi в аудиториях",
    assigned_to: "u1",
    assigned_to_name: "Организатор Иванов",
    created_by: "u1",
    status: "IN_PROGRESS",
    due_date: "2026-03-18",
  },
  {
    id: "t6",
    event_id: "e2",
    title: "Подготовить кейсы для команд",
    assigned_to: "u1",
    assigned_to_name: "Организатор Иванов",
    created_by: "u1",
    status: "DONE",
    due_date: "2026-03-17",
  },
  {
    id: "t7",
    event_id: "e2",
    title: "Пригласить менторов на хакатон",
    assigned_to: "u3",
    assigned_to_name: "Куратор Секционов",
    created_by: "u1",
    status: "TODO",
    due_date: "2026-03-18",
  },
  {
    id: "t8",
    event_id: "e2",
    title: "Заказать питание для участников",
    assigned_to: "u2",
    assigned_to_name: "Иван Участников",
    created_by: "u1",
    status: "IN_PROGRESS",
    due_date: "2026-03-19",
  },
];

// ═══════════════════════════════════════════════════════════════
// 1. LANDING PAGE  (FIX #5 — возвращён лендинг)
// ═══════════════════════════════════════════════════════════════
function LandingPage() {
  const navigate = useNavigate();

  const features = [
    { icon: "🏗️", title: "Структура мероприятия", desc: "Секции, доклады, кейсы — всё в одном месте с ролевой моделью" },
    { icon: "📌", title: "Канбан задач", desc: "Ставьте задачи организаторам, кураторам, спикерам. Контролируйте % готовности" },
    { icon: "📅", title: "Календарь и расписание", desc: "Мероприятия, дедлайны задач и личное расписание участника" },
    { icon: "👥", title: "4 роли", desc: "Организатор → Куратор → Спикер → Участник. Каждый видит своё" },
    { icon: "💬", title: "Встроенный мессенджер", desc: "Групповые чаты мероприятий и ЛС. WebSocket в реальном времени" },
    { icon: "⭐", title: "Обратная связь", desc: "Комментарии и оценки докладов. Итоговый отчёт куратора секции" },
  ];

  return (
    <div>
      {/* HERO */}
      <div className="landing-hero">
        <nav className="landing-nav">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 28 }}>🚀</span>
            <span style={{ fontWeight: 900, fontSize: 22, letterSpacing: "-0.5px" }}>
              EventHub
            </span>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={() => navigate("/login")}
              style={{
                padding: "10px 24px",
                background: "rgba(255,255,255,0.1)",
                color: "white",
                border: "1.5px solid rgba(255,255,255,0.25)",
                borderRadius: 100,
                fontWeight: 800,
                fontSize: 14,
                cursor: "pointer",
                fontFamily: "Nunito, sans-serif",
                backdropFilter: "blur(8px)",
              }}
            >
              Войти
            </button>
            <button
              onClick={() => navigate("/login")}
              style={{
                padding: "10px 24px",
                background: "white",
                color: "var(--primary)",
                border: "none",
                borderRadius: 100,
                fontWeight: 800,
                fontSize: 14,
                cursor: "pointer",
                fontFamily: "Nunito, sans-serif",
              }}
            >
              Начать бесплатно
            </button>
          </div>
        </nav>

        <div className="landing-content">
          <div style={{ maxWidth: 680, animation: "fadeInUp 0.8s ease-out" }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 800,
                color: "rgba(255,255,255,0.6)",
                textTransform: "uppercase",
                letterSpacing: 2,
                marginBottom: 16,
              }}
            >
              Платформа управления мероприятиями
            </div>
            <h1
              style={{
                fontSize: "clamp(36px, 5vw, 56px)",
                fontWeight: 900,
                lineHeight: 1.15,
                marginBottom: 20,
                letterSpacing: "-1px",
              }}
            >
              Организуйте форумы,{" "}
              <span style={{ color: "#f59e0b" }}>конференции</span> и хакатоны в
              одном месте
            </h1>
            <p
              style={{
                fontSize: 18,
                color: "rgba(255,255,255,0.75)",
                lineHeight: 1.7,
                marginBottom: 36,
                maxWidth: 520,
              }}
            >
              Замените связку «сайт&nbsp;+ мессенджеры&nbsp;+ таблицы&nbsp;+
              файл&nbsp;программы» одним инструментом.
            </p>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <button
                onClick={() => navigate("/login")}
                style={{
                  padding: "14px 36px",
                  background: "white",
                  color: "var(--primary-dark)",
                  border: "none",
                  borderRadius: 100,
                  fontWeight: 900,
                  fontSize: 16,
                  cursor: "pointer",
                  fontFamily: "Nunito, sans-serif",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
                }}
              >
                Попробовать Demo →
              </button>
              <button
                onClick={() =>
                  document
                    .getElementById("features")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
                style={{
                  padding: "14px 36px",
                  background: "transparent",
                  color: "white",
                  border: "1.5px solid rgba(255,255,255,0.3)",
                  borderRadius: 100,
                  fontWeight: 800,
                  fontSize: 16,
                  cursor: "pointer",
                  fontFamily: "Nunito, sans-serif",
                }}
              >
                Узнать больше
              </button>
            </div>
            <div style={{ display: "flex", gap: 40, marginTop: 48 }}>
              {[
                { n: "4", l: "Роли" },
                { n: "10+", l: "Функций куратора" },
                { n: "1", l: "Вместо 5 сервисов" },
              ].map((s) => (
                <div key={s.l}>
                  <div style={{ fontSize: 28, fontWeight: 900, color: "#f59e0b" }}>
                    {s.n}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "rgba(255,255,255,0.5)",
                      textTransform: "uppercase",
                    }}
                  >
                    {s.l}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* FEATURES */}
      <div id="features" className="landing-features">
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 800,
                color: "var(--primary)",
                textTransform: "uppercase",
                letterSpacing: 2,
                marginBottom: 8,
              }}
            >
              Возможности
            </div>
            <h2
              style={{
                fontSize: 32,
                fontWeight: 900,
                color: "var(--primary-dark)",
              }}
            >
              Всё что нужно — в одной платформе
            </h2>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 20,
            }}
          >
            {features.map((f) => (
              <div key={f.title} className="feature-card">
                <div style={{ fontSize: 36, marginBottom: 14 }}>{f.icon}</div>
                <h3
                  style={{
                    fontWeight: 800,
                    fontSize: 16,
                    color: "var(--primary-dark)",
                    marginBottom: 8,
                  }}
                >
                  {f.title}
                </h3>
                <p
                  style={{
                    fontSize: 14,
                    color: "var(--text-muted)",
                    lineHeight: 1.6,
                  }}
                >
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FOOTER CTA */}
      <div
        style={{
          padding: "64px 48px",
          background: "var(--primary-dark)",
          textAlign: "center",
          color: "white",
        }}
      >
        <h2 style={{ fontSize: 28, fontWeight: 900, marginBottom: 12 }}>
          Готовы начать?
        </h2>
        <p
          style={{
            color: "rgba(255,255,255,0.6)",
            marginBottom: 28,
            fontSize: 16,
          }}
        >
          Создайте первое мероприятие прямо сейчас
        </p>
        <button
          onClick={() => navigate("/login")}
          style={{
            padding: "14px 40px",
            background: "white",
            color: "var(--primary-dark)",
            border: "none",
            borderRadius: 100,
            fontWeight: 900,
            fontSize: 16,
            cursor: "pointer",
            fontFamily: "Nunito, sans-serif",
          }}
        >
          Войти в EventHub
        </button>
        <div
          style={{
            marginTop: 32,
            fontSize: 12,
            color: "rgba(255,255,255,0.35)",
          }}
        >
          EventHub · Цифровой хакатон 2026 · ОмГТУ × ИТ-Кластер Сибири
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// 2. AUTH PAGE
// ═══════════════════════════════════════════════════════════════
function AuthPage({
  onLogin,
  onRegister,
  loading,
  error,
}: {
  onLogin: (email: string, password: string) => void;
  onRegister: (email: string, password: string, full_name: string) => void;
  loading: boolean;
  error: string;
}) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isRegister) {
      onRegister(email, password, fullName);
    } else {
      onLogin(email, password);
    }
  };

  const switchMode = () => {
    setIsRegister(!isRegister);
    setEmail("");
    setPassword("");
    setFullName("");
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div
            style={{ fontSize: 36, marginBottom: 8, cursor: "pointer" }}
            onClick={() => navigate("/")}
          >
            🚀
          </div>
          <h1
            style={{
              fontWeight: 900,
              fontSize: 24,
              color: "var(--primary-dark)",
              marginBottom: 4,
            }}
          >
            EventHub
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: 13, fontWeight: 600 }}>
            {isRegister ? "Регистрация" : "Вход в платформу"}
          </p>
        </div>

        {error && (
          <div
            style={{
              background: "#fef2f2",
              color: "#dc2626",
              padding: "10px 14px",
              borderRadius: 8,
              marginBottom: 16,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {isRegister && (
            <div style={{ marginBottom: 14 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 11,
                  fontWeight: 800,
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  marginBottom: 5,
                }}
              >
                ФИО
              </label>
              <input
                type="text"
                className="auth-input"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Иванов Иван Иванович"
                required
              />
            </div>
          )}
          <div style={{ marginBottom: 14 }}>
            <label
              style={{
                display: "block",
                fontSize: 11,
                fontWeight: 800,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                marginBottom: 5,
              }}
            >
              Email
            </label>
            <input
              type="email"
              className="auth-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@it.ru"
              required
            />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label
              style={{
                display: "block",
                fontSize: 11,
                fontWeight: 800,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                marginBottom: 5,
              }}
            >
              Пароль
            </label>
            <input
              type="password"
              className="auth-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={4}
            />
          </div>
          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? (isRegister ? "Регистрация..." : "Вход...") : (isRegister ? "Зарегистрироваться" : "Войти")}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: 16 }}>
          <span
            onClick={switchMode}
            style={{
              fontSize: 13,
              color: "var(--primary)",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {isRegister ? "Уже есть аккаунт? Войти" : "Нет аккаунта? Зарегистрироваться"}
          </span>
        </div>

        {/* Demo buttons — показываем только на странице входа */}
        {!isRegister && (
          <div
            style={{
              marginTop: 16,
              borderTop: "1.5px solid var(--border)",
              paddingTop: 16,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                textAlign: "center",
                marginBottom: 10,
              }}
            >
              Быстрый Demo вход
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {[
                { email: "org@it.ru", pass: "org", label: "👔 Организатор", bg: "var(--primary)" },
                { email: "user@it.ru", pass: "user", label: "🙋 Участник", bg: "#16a34a" },
                { email: "curator@it.ru", pass: "curator", label: "📋 Куратор", bg: "#6b7280" },
              ].map((d) => (
                <button
                  key={d.email}
                  onClick={() => {
                    setEmail(d.email);
                    setPassword(d.pass);
                  }}
                  style={{
                    flex: 1,
                    padding: 8,
                    background: d.bg,
                    color: "white",
                    border: "none",
                    borderRadius: 8,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontSize: 12,
                    fontFamily: "Nunito, sans-serif",
                  }}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ textAlign: "center", marginTop: 12 }}>
          <span
            onClick={() => navigate("/")}
            style={{
              fontSize: 13,
              color: "var(--text-muted)",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            ← На главную
          </span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// 3. CALENDAR  (FIX #3 — настоящая сетка-календарь)
// ═══════════════════════════════════════════════════════════════
function CalendarView({
  events,
  tasks,
}: {
  events: EventData[];
  tasks: Task[];
}) {
  const [viewDate, setViewDate] = useState(() => new Date(2026, 2, 1));

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const today = new Date();
  const lastDay = new Date(year, month + 1, 0);
  const startDow = (new Date(year, month, 1).getDay() + 6) % 7; // Пн=0

  const cells: { day: number; mo: number; yr: number; cur: boolean }[] = [];
  const prevLast = new Date(year, month, 0).getDate();
  for (let i = startDow - 1; i >= 0; i--)
    cells.push({ day: prevLast - i, mo: month - 1, yr: year, cur: false });
  for (let d = 1; d <= lastDay.getDate(); d++)
    cells.push({ day: d, mo: month, yr: year, cur: true });
  while (cells.length < 42)
    cells.push({
      day: cells.length - (startDow + lastDay.getDate()) + 1,
      mo: month + 1,
      yr: year,
      cur: false,
    });

  const monthNames = [
    "Январь","Февраль","Март","Апрель","Май","Июнь",
    "Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь",
  ];

  const getItems = (d: number, mo: number, yr: number) => {
    const ds = `${yr}-${String(mo + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const items: { label: string; color: string; bg: string }[] = [];

    events.forEach((ev) => {
      if (ev.start_date && ev.end_date && ds >= ev.start_date && ds <= ev.end_date) {
        items.push({ label: ev.title.slice(0, 16), color: "#2563eb", bg: "#e8f0fe" });
      }
    });

    tasks.forEach((t) => {
      if (t.due_date === ds) {
        const done = t.status === "DONE";
        items.push({
          label: (done ? "✓ " : "") + t.title.slice(0, 14),
          color: done ? "#16a34a" : t.status === "IN_PROGRESS" ? "#d97706" : "#64748b",
          bg: done ? "#f0fdf4" : t.status === "IN_PROGRESS" ? "#fffbeb" : "#f1f5f9",
        });
      }
    });

    return items;
  };

  const isToday = (d: number, mo: number, yr: number) =>
    d === today.getDate() && mo === today.getMonth() && yr === today.getFullYear();

  return (
    <div>
      {/* Навигация по месяцам */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <button
          onClick={() => setViewDate(new Date(year, month - 1, 1))}
          style={{
            padding: "8px 16px",
            background: "white",
            border: "1.5px solid var(--border)",
            borderRadius: 8,
            fontWeight: 800,
            cursor: "pointer",
            fontFamily: "Nunito, sans-serif",
            fontSize: 13,
          }}
        >
          ← Назад
        </button>
        <h2 style={{ fontWeight: 900, fontSize: 20, color: "var(--primary-dark)" }}>
          {monthNames[month]} {year}
        </h2>
        <button
          onClick={() => setViewDate(new Date(year, month + 1, 1))}
          style={{
            padding: "8px 16px",
            background: "white",
            border: "1.5px solid var(--border)",
            borderRadius: 8,
            fontWeight: 800,
            cursor: "pointer",
            fontFamily: "Nunito, sans-serif",
            fontSize: 13,
          }}
        >
          Вперёд →
        </button>
      </div>

      {/* Дни недели */}
      <div className="cal-grid" style={{ marginBottom: 4 }}>
        {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((d) => (
          <div
            key={d}
            style={{
              textAlign: "center",
              fontWeight: 800,
              fontSize: 12,
              color: "var(--text-muted)",
              padding: "8px 0",
              textTransform: "uppercase",
            }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Ячейки */}
      <div className="cal-grid">
        {cells.map((c, idx) => {
          const items = c.cur ? getItems(c.day, c.mo, c.yr) : [];
          const todayCls = isToday(c.day, c.mo, c.yr) ? " today" : "";
          const otherCls = !c.cur ? " other-month" : "";
          return (
            <div key={idx} className={`cal-cell${todayCls}${otherCls}`}>
              <div className="cal-day-num">{c.day}</div>
              {items.slice(0, 3).map((it, j) => (
                <div
                  key={j}
                  className="cal-dot"
                  style={{ color: it.color, background: it.bg }}
                  title={it.label}
                >
                  {it.label}
                </div>
              ))}
              {items.length > 3 && (
                <div
                  style={{
                    fontSize: 9,
                    color: "var(--text-muted)",
                    fontWeight: 700,
                    paddingLeft: 4,
                  }}
                >
                  +{items.length - 3}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Легенда */}
      <div
        style={{
          display: "flex",
          gap: 20,
          marginTop: 16,
          fontSize: 12,
          fontWeight: 700,
          color: "var(--text-muted)",
          flexWrap: "wrap",
        }}
      >
        {[
          { bg: "#e8f0fe", bc: "#2563eb", label: "Мероприятие" },
          { bg: "#f1f5f9", bc: "#64748b", label: "Задача" },
          { bg: "#fffbeb", bc: "#d97706", label: "В работе" },
          { bg: "#f0fdf4", bc: "#16a34a", label: "Готово" },
        ].map((l) => (
          <span key={l.label}>
            <span
              style={{
                display: "inline-block",
                width: 10,
                height: 10,
                borderRadius: 3,
                background: l.bg,
                border: `1px solid ${l.bc}`,
                marginRight: 4,
              }}
            />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// 3b. CHAT VIEW — мессенджер (группы по мероприятию + ЛС)
// ═══════════════════════════════════════════════════════════════
interface DemoChatRoom {
  id: string;
  event_id: string | null;
  type: "GROUP" | "DIRECT";
  name: string;
  avatar: string;
}

interface DemoChatMsg {
  id: string;
  room_id: string;
  user_id: string;
  user_name: string;
  text: string;
  created_at: string;
}

const DEMO_CHAT_ROOMS: DemoChatRoom[] = [
  { id: "cr1", event_id: "e1", type: "GROUP", name: "ИТ-Форум 2026 — общий", avatar: "🏢" },
  { id: "cr2", event_id: "e2", type: "GROUP", name: "Хакатон 2026 — команда", avatar: "🚀" },
  { id: "cr3", event_id: null, type: "DIRECT", name: "Организатор Иванов", avatar: "О" },
  { id: "cr4", event_id: null, type: "DIRECT", name: "Куратор Секционов", avatar: "К" },
];

const DEMO_CHAT_MESSAGES: DemoChatMsg[] = [
  // cr1 — ИТ-Форум общий
  { id: "m1", room_id: "cr1", user_id: "u1", user_name: "Организатор Иванов", text: "Всем привет! Напоминаю: ИТ-Форум стартует 16 марта. Проверяйте свои секции.", created_at: "2026-03-15T09:00:00Z" },
  { id: "m2", room_id: "cr1", user_id: "u3", user_name: "Куратор Секционов", text: "Секция ИнфоБез готова на 60%. Два спикера подтверждены, одного ищем.", created_at: "2026-03-15T09:05:00Z" },
  { id: "m3", room_id: "cr1", user_id: "u2", user_name: "Иван Участников", text: "Подскажите, где можно посмотреть расписание докладов?", created_at: "2026-03-15T09:10:00Z" },
  { id: "m4", room_id: "cr1", user_id: "u1", user_name: "Организатор Иванов", text: "Расписание будет в разделе «Программа» после публикации. Скоро!", created_at: "2026-03-15T09:12:00Z" },
  { id: "m5", room_id: "cr1", user_id: "u3", user_name: "Куратор Секционов", text: "Зал А забронирован, трансляцию настроим к 18-му.", created_at: "2026-03-16T10:00:00Z" },
  { id: "m6", room_id: "cr1", user_id: "u2", user_name: "Иван Участников", text: "Спасибо! Буду на секции ИнфоБез точно 👍", created_at: "2026-03-16T10:05:00Z" },
  // cr2 — Хакатон
  { id: "m10", room_id: "cr2", user_id: "u1", user_name: "Организатор Иванов", text: "Команды, напоминаю: дедлайн загрузки проектов — 19 марта, 23:59!", created_at: "2026-03-16T08:00:00Z" },
  { id: "m11", room_id: "cr2", user_id: "u2", user_name: "Иван Участников", text: "Мы на кейсе 3 — EventHub. Уже есть бэкенд и фронт 💪", created_at: "2026-03-16T08:15:00Z" },
  { id: "m12", room_id: "cr2", user_id: "u3", user_name: "Куратор Секционов", text: "Красавцы! Если нужна помощь с деплоем — пишите.", created_at: "2026-03-16T08:20:00Z" },
  { id: "m13", room_id: "cr2", user_id: "u1", user_name: "Организатор Иванов", text: "WiFi в аудиториях проверяем сегодня. Если глючит — сразу сигнальте в чат.", created_at: "2026-03-17T09:00:00Z" },
  // cr3 — ЛС с Организатором
  { id: "m20", room_id: "cr3", user_id: "u1", user_name: "Организатор Иванов", text: "Привет! Как дела с подготовкой?", created_at: "2026-03-15T14:00:00Z" },
  { id: "m21", room_id: "cr3", user_id: "u2", user_name: "Иван Участников", text: "Всё идёт по плану. Материалы готовлю.", created_at: "2026-03-15T14:05:00Z" },
  { id: "m22", room_id: "cr3", user_id: "u1", user_name: "Организатор Иванов", text: "Отлично, дедлайн 19-го. Если нужна помощь — пиши.", created_at: "2026-03-15T14:07:00Z" },
  // cr4 — ЛС с Куратором
  { id: "m30", room_id: "cr4", user_id: "u3", user_name: "Куратор Секционов", text: "Привет! Видел твою регистрацию на ИнфоБез. Рад что будешь!", created_at: "2026-03-16T11:00:00Z" },
  { id: "m31", room_id: "cr4", user_id: "u2", user_name: "Иван Участников", text: "Обязательно буду! Очень интересная программа.", created_at: "2026-03-16T11:05:00Z" },
];

function ChatView({
  user,
  demoMode,
}: {
  user: User;
  demoMode: boolean;
}) {
  const [rooms, setRooms] = useState<DemoChatRoom[]>([]);
  const [messages, setMessages] = useState<DemoChatMsg[]>([]);
  const [activeRoomId, setActiveRoomId] = useState("");
  const [inputText, setInputText] = useState("");
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [showNewDM, setShowNewDM] = useState(false);
  const [dmQuery, setDmQuery] = useState("");
  const [dmResults, setDmResults] = useState<User[]>([]);
  const [dmSearching, setDmSearching] = useState(false);

  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Загрузка комнат
  useEffect(() => {
    if (demoMode) {
      setRooms(DEMO_CHAT_ROOMS);
      setMessages([...DEMO_CHAT_MESSAGES]);
      setActiveRoomId(DEMO_CHAT_ROOMS[0]?.id || "");
      setLoadingRooms(false);
      return;
    }
    (async () => {
      try {
        const res = await chatAPI.getMy();
        const apiRooms: DemoChatRoom[] = (res.data || []).map((r: ChatRoom) => ({
          id: r.id,
          event_id: r.event_id || null,
          type: r.type,
          name: (r as any).name || (r.type === "GROUP" ? `Группа ${r.id.slice(0, 6)}` : `ЛС ${r.id.slice(0, 6)}`),
          avatar: r.type === "GROUP" ? "🏢" : "💬",
        }));
        setRooms(apiRooms);
        if (apiRooms.length) {
          setActiveRoomId(apiRooms[0].id);
          try {
            const msgRes = await chatAPI.getMessages(apiRooms[0].id, { limit: 50 });
            const items = msgRes.data?.items || msgRes.data || [];
            setMessages(
              (Array.isArray(items) ? items : []).map((m: ChatMessage) => ({
                id: m.id,
                room_id: m.room_id,
                user_id: m.user_id,
                user_name: m.user_name || "Пользователь",
                text: m.text,
                created_at: m.created_at,
              }))
            );
          } catch {}
        }
      } catch {}
      finally { setLoadingRooms(false); }
    })();
  }, [demoMode]);

  // Прокрутка вниз при смене комнаты или новых сообщениях
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeRoomId, messages]);

  // Сообщения для активной комнаты
  const roomMessages = useMemo(
    () => messages.filter((m) => m.room_id === activeRoomId).sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [messages, activeRoomId]
  );
  const activeRoom = rooms.find((r) => r.id === activeRoomId);

  // Последнее сообщение для превью в списке
  const lastMsg = useCallback(
    (roomId: string) => {
      const msgs = messages.filter((m) => m.room_id === roomId);
      if (!msgs.length) return null;
      return msgs.sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    },
    [messages]
  );

  // Отправка
  const sendMessage = async () => {
    if (!inputText.trim() || !activeRoomId) return;
    const text = inputText.trim();
    setInputText("");

    if (demoMode) {
      const newMsg: DemoChatMsg = {
        id: `msg-${Date.now()}`,
        room_id: activeRoomId,
        user_id: user.id,
        user_name: user.full_name,
        text,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, newMsg]);
    } else {
      try {
        const res = await chatAPI.sendMessage(activeRoomId, { text });
        const sent: ChatMessage = res.data;
        const newMsg: DemoChatMsg = {
          id: sent.id,
          room_id: sent.room_id,
          user_id: sent.user_id,
          user_name: sent.user_name || user.full_name,
          text: sent.text,
          created_at: sent.created_at,
        };
        setMessages((prev) => [...prev, newMsg]);
      } catch {
        // Fallback — добавляем локально если бэкенд недоступен
        const newMsg: DemoChatMsg = {
          id: `msg-${Date.now()}`,
          room_id: activeRoomId,
          user_id: user.id,
          user_name: user.full_name,
          text,
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, newMsg]);
      }
    }
  };

  // Переключение комнаты
  const switchRoom = async (roomId: string) => {
    setActiveRoomId(roomId);
    if (!demoMode) {
      try {
        const res = await chatAPI.getMessages(roomId, { limit: 50 });
        const items = res.data?.items || res.data || [];
        const fetched = (Array.isArray(items) ? items : []).map((m: ChatMessage) => ({
          id: m.id,
          room_id: m.room_id,
          user_id: m.user_id,
          user_name: m.user_name || "Пользователь",
          text: m.text,
          created_at: m.created_at,
        }));
        setMessages((prev) => [
          ...prev.filter((m) => m.room_id !== roomId),
          ...fetched,
        ]);
      } catch {}
    }
  };

  // Поиск для нового ЛС
  const searchDM = async (q: string) => {
    setDmQuery(q);
    if (q.length < 2) { setDmResults([]); return; }
    setDmSearching(true);
    if (demoMode) {
      const demoUsers = ([
        { id: "u1", email: "org@it.ru", full_name: "Организатор Иванов", global_role: "ORGANIZER" as GlobalRole },
        { id: "u3", email: "curator@it.ru", full_name: "Куратор Секционов", global_role: "PARTICIPANT" as GlobalRole },
        { id: "u5", email: "speaker@it.ru", full_name: "Алексей Спикеров", global_role: "PARTICIPANT" as GlobalRole },
      ] as User[]).filter((u) => u.id !== user.id && u.full_name.toLowerCase().includes(q.toLowerCase()));
      setDmResults(demoUsers);
    } else {
      try {
        const res = await usersAPI.search(q);
        setDmResults((res.data || []).filter((u: User) => u.id !== user.id));
      } catch { setDmResults([]); }
    }
    setDmSearching(false);
  };

  const startDM = async (targetUser: User) => {
    // Проверяем, есть ли уже ЛС
    const existing = rooms.find(
      (r) => r.type === "DIRECT" && r.name === targetUser.full_name
    );
    if (existing) {
      setActiveRoomId(existing.id);
      setShowNewDM(false);
      setDmQuery("");
      setDmResults([]);
      return;
    }

    let roomId = `cr-dm-${Date.now()}`;
    if (!demoMode) {
      try {
        const res = await chatAPI.createDirect({ user_id: targetUser.id });
        roomId = res.data.id;
      } catch {}
    }

    const newRoom: DemoChatRoom = {
      id: roomId,
      event_id: null,
      type: "DIRECT",
      name: targetUser.full_name,
      avatar: targetUser.full_name[0],
    };
    setRooms((prev) => [...prev, newRoom]);
    setActiveRoomId(newRoom.id);
    setShowNewDM(false);
    setDmQuery("");
    setDmResults([]);
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  if (loadingRooms) return <Spinner label="Загружаем чаты..." />;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ fontWeight: 900, fontSize: 22, color: "var(--primary-dark)" }}>💬 Мессенджер</h1>
        <button
          onClick={() => setShowNewDM(true)}
          style={{ padding: "8px 18px", background: "var(--primary)", color: "white", border: "none", borderRadius: 100, fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}
        >
          + Новое сообщение
        </button>
      </div>

      <div className="chat-wrapper">
        {/* Список комнат */}
        <div className="chat-rooms-list">
          <div className="chat-rooms-header">
            Чаты
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)" }}>{rooms.length}</span>
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {rooms.map((room) => {
              const last = lastMsg(room.id);
              return (
                <div
                  key={room.id}
                  className={`chat-room-item${activeRoomId === room.id ? " active" : ""}`}
                  onClick={() => switchRoom(room.id)}
                >
                  <div
                    style={{
                      width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                      background: room.type === "GROUP" ? "var(--primary)" : "#16a34a",
                      color: "white", display: "flex", alignItems: "center", justifyContent: "center",
                      fontWeight: 900, fontSize: room.avatar.length > 1 ? 16 : 14,
                    }}
                  >
                    {room.avatar}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "var(--primary-dark)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {room.name}
                    </div>
                    {last && (
                      <div style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>
                        {last.user_id === user.id ? "Вы: " : ""}{last.text.slice(0, 30)}{last.text.length > 30 ? "…" : ""}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", flexShrink: 0, fontWeight: 600 }}>
                    {room.type === "GROUP" ? "👥" : "👤"}
                  </div>
                </div>
              );
            })}
            {rooms.length === 0 && (
              <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                Нет чатов
              </div>
            )}
          </div>
        </div>

        {/* Область сообщений */}
        {activeRoom ? (
          <div className="chat-messages-area">
            <div className="chat-messages-header">
              {activeRoom.type === "GROUP" ? "👥 " : "👤 "}{activeRoom.name}
            </div>

            <div className="chat-messages-scroll" ref={scrollRef}>
              {roomMessages.length === 0 ? (
                <div className="chat-empty">Начните диалог — напишите первое сообщение</div>
              ) : (
                roomMessages.map((msg) => {
                  const isMine = msg.user_id === user.id;
                  return (
                    <div key={msg.id} style={{ display: "flex", flexDirection: "column", alignItems: isMine ? "flex-end" : "flex-start" }}>
                      {!isMine && activeRoom.type === "GROUP" && (
                        <div style={{ fontSize: 10, fontWeight: 800, color: "var(--primary)", marginBottom: 2, paddingLeft: 4 }}>
                          {msg.user_name}
                        </div>
                      )}
                      <div className={`chat-msg ${isMine ? "mine" : "theirs"}`}>
                        {msg.text}
                      </div>
                      <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 2, padding: "0 4px" }}>
                        {formatTime(msg.created_at)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="chat-input-bar">
              <input
                type="text"
                placeholder="Написать сообщение..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              />
              <button onClick={sendMessage}>Отправить</button>
            </div>
          </div>
        ) : (
          <div className="chat-messages-area">
            <div className="chat-empty">Выберите чат слева</div>
          </div>
        )}
      </div>

      {/* Модалка нового ЛС */}
      {showNewDM && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(13,27,62,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000 }}>
          <div style={{ background: "white", borderRadius: 20, padding: 28, width: "100%", maxWidth: 440, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", borderTop: "5px solid var(--primary)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ fontWeight: 900, margin: 0, color: "var(--primary-dark)", fontSize: 16 }}>Новое сообщение</h3>
              <button onClick={() => { setShowNewDM(false); setDmQuery(""); setDmResults([]); }} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#777" }}>×</button>
            </div>
            <input
              type="text"
              placeholder="Поиск по ФИО..."
              value={dmQuery}
              onChange={(e) => searchDM(e.target.value)}
              autoFocus
              style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1.5px solid var(--border)", fontSize: 14, boxSizing: "border-box", fontFamily: "Nunito, sans-serif", outline: "none", marginBottom: 12 }}
            />
            {dmSearching && <div style={{ color: "#777", fontSize: 13, textAlign: "center", padding: 8 }}>Поиск...</div>}
            {dmResults.length > 0 && (
              <div style={{ maxHeight: 240, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 10 }}>
                {dmResults.map((u) => (
                  <div
                    key={u.id}
                    onClick={() => startDM(u)}
                    style={{ padding: "12px 16px", cursor: "pointer", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12, transition: "background 0.15s" }}
                    onMouseOver={(e) => (e.currentTarget.style.background = "#f0f7ff")}
                    onMouseOut={(e) => (e.currentTarget.style.background = "white")}
                  >
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--primary)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 14, flexShrink: 0 }}>
                      {u.full_name[0]}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "var(--primary-dark)" }}>{u.full_name}</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{u.email}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {dmQuery.length >= 2 && dmResults.length === 0 && !dmSearching && (
              <div style={{ color: "#aaa", textAlign: "center", padding: 16, fontSize: 13 }}>Никого не найдено</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// 4. ORGANIZER DASHBOARD
//    FIX #1: events подтягиваются из DEMO_EVENTS
//    FIX #2: новая задача привязывается к selectedEventId
//    FIX #3: CalendarView вместо пустого списка
//    FIX #4: канбан — понятные кнопки переходов
// ═══════════════════════════════════════════════════════════════
const COL_CFG: Record<TaskStatus, { label: string; icon: string; color: string }> = {
  TODO: { label: "К выполнению", icon: "📋", color: "#64748b" },
  IN_PROGRESS: { label: "В работе", icon: "🔧", color: "#d97706" },
  DONE: { label: "Выполнено", icon: "✅", color: "#16a34a" },
};

function OrganizerDashboard({
  user,
  onLogout,
  demoMode,
}: {
  user: User;
  onLogout: () => void;
  demoMode: boolean;
}) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"events" | "kanban" | "calendar" | "chat" | "settings">("events");
  const [events, setEvents] = useState<EventData[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selEv, setSelEv] = useState("");

  const [newTitle, setNewTitle] = useState("");
  const [newDue, setNewDue] = useState("");

  // --- Загрузка данных ---
  useEffect(() => {
    setLoading(true);
    if (demoMode) {
      setEvents(DEMO_EVENTS);
      setTasks([...DEMO_TASKS]); // копия чтобы мутировать
      setSelEv(DEMO_EVENTS[0]?.id || "");
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const evRes = await eventsAPI.getAll();
        const evs: EventData[] = evRes.data || [];
        setEvents(evs);
        if (evs.length) setSelEv(evs[0].id);
        const all: Task[] = [];
        for (const ev of evs) {
          try {
            const r = await tasksAPI.getByEvent(ev.id);
            all.push(...(r.data || []));
          } catch {}
        }
        setTasks(all);
      } catch {}
      finally { setLoading(false); }
    })();
  }, [demoMode]);

  const filtered = useMemo(() => tasks.filter((t) => t.event_id === selEv), [tasks, selEv]);
  const selEvent = events.find((e) => e.id === selEv);

  const pct = useCallback(
    (eid: string) => {
      const ts = tasks.filter((t) => t.event_id === eid);
      if (!ts.length) return 0;
      return Math.round((ts.filter((t) => t.status === "DONE").length / ts.length) * 100);
    },
    [tasks]
  );

  // --- Канбан: смена статуса ---
  const moveTask = async (id: string, s: TaskStatus) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: s } : t)));
    if (!demoMode) try { await tasksAPI.updateStatus(id, s); } catch {}
  };

  // --- FIX #2: добавление задачи ПРИВЯЗЫВАЕТСЯ к selEv ---
  const addTask = async () => {
    if (!newTitle.trim() || !selEv) return;
    const newTask: Task = {
      id: `t-${Date.now()}`,
      event_id: selEv,
      title: newTitle.trim(),
      assigned_to: user.id,
      assigned_to_name: user.full_name,
      created_by: user.id,
      status: "TODO",
      due_date: newDue || null,
    };
    if (demoMode) {
      setTasks((prev) => [...prev, newTask]);
    } else {
      try {
        const res = await tasksAPI.create({
          event_id: selEv,
          title: newTitle.trim(),
          due_date: newDue || undefined,
        });
        setTasks((prev) => [...prev, res.data]);
      } catch {
        setTasks((prev) => [...prev, newTask]);
      }
    }
    setNewTitle("");
    setNewDue("");
  };

  const delTask = async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    if (!demoMode) try { await tasksAPI.delete(id); } catch {}
  };

  const navItems = [
    { id: "events", icon: "📋", label: "Мероприятия" },
    { id: "kanban", icon: "📌", label: "Канбан задач" },
    { id: "calendar", icon: "📅", label: "Календарь" },
    { id: "chat", icon: "💬", label: "Мессенджер" },
    { id: "settings", icon: "⚙️", label: "Настройки" },
  ];

  return (
    <div className="dashboard-wrapper">
      {/* SIDEBAR */}
      <aside className="dashboard-sidebar">
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: 72, height: 72, borderRadius: "50%", background: "var(--primary)",
              color: "white", fontSize: 26, fontWeight: 900, display: "flex",
              alignItems: "center", justifyContent: "center", margin: "0 auto",
            }}
          >
            {user.full_name[0]}
          </div>
          <h5 style={{ marginTop: 10, marginBottom: 4, fontWeight: 800, fontSize: 15 }}>
            {user.full_name}
          </h5>
          <span
            style={{
              display: "inline-block", padding: "3px 10px", background: "#e8f0fe",
              color: "var(--primary)", borderRadius: 100, fontSize: 11, fontWeight: 800,
            }}
          >
            ORGANIZER
          </span>
          {user.organization && (
            <p style={{ fontSize: 11, color: "#777", marginTop: 5 }}>
              {user.organization}
            </p>
          )}
          {demoMode && (
            <div style={{ fontSize: 10, color: "#f59e0b", fontWeight: 700, marginTop: 3 }}>
              DEMO
            </div>
          )}
        </div>

        <nav className="sidebar-nav-list">
          {navItems.map((i) => (
            <button
              key={i.id}
              className="nav-link"
              style={{
                background: tab === i.id ? "#eef6ff" : "#f1f5f9",
                color: tab === i.id ? "var(--primary)" : "#475569",
              }}
              onClick={() => setTab(i.id as any)}
            >
              <span style={{ marginRight: 8 }}>{i.icon}</span>
              {i.label}
            </button>
          ))}
          <button
            className="nav-link"
            style={{ marginTop: 8, background: "#f0fdf4", color: "#16a34a" }}
            onClick={() => navigate("/create-event")}
          >
            <span style={{ marginRight: 10 }}>➕</span>Создать мероприятие
          </button>
          <button
            className="nav-link"
            style={{ marginTop: 16, background: "#fff1f1", color: "#ef4444" }}
            onClick={onLogout}
          >
            <span style={{ marginRight: 8 }}>🚪</span>Выйти
          </button>
        </nav>
      </aside>

      {/* MAIN CONTENT */}
      <main className="dashboard-main-content">
        {loading ? (
          <Spinner label="Загружаем данные..." />
        ) : (
          <>
            {/* ═══ TAB: МЕРОПРИЯТИЯ ═══ */}
            {tab === "events" && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                  <h1 style={{ fontWeight: 900, fontSize: 22, color: "var(--primary-dark)" }}>Мои мероприятия</h1>
                  <button onClick={() => navigate("/create-event")} style={{ padding: "10px 24px", background: "var(--primary)", color: "white", border: "none", borderRadius: 100, fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>+ Создать</button>
                </div>
                <div style={{ display: "grid", gap: 14 }}>
                  {events.map((ev) => {
                    const p = pct(ev.id);
                    return (
                      <div
                        key={ev.id}
                        onClick={() => { setSelEv(ev.id); setTab("kanban"); }}
                        style={{
                          background: "white", borderRadius: 16, padding: "20px 24px",
                          boxShadow: "0 2px 12px rgba(74,89,138,0.07)",
                          border: `1.5px solid ${selEv === ev.id ? "var(--primary)" : "var(--border)"}`,
                          cursor: "pointer", transition: "border-color 0.2s",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div style={{ flex: 1 }}>
                            <h3 style={{ fontWeight: 800, fontSize: 16, color: "var(--primary-dark)", marginBottom: 6 }}>{ev.title}</h3>
                            {ev.description && <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 8 }}>{ev.description}</p>}
                            <div style={{ display: "flex", gap: 12, fontSize: 12, color: "var(--text-muted)", fontWeight: 600, flexWrap: "wrap" }}>
                              {ev.start_date && <span>📅 {ev.start_date} — {ev.end_date}</span>}
                              <span style={{ padding: "2px 8px", borderRadius: 100, background: ev.status === "PUBLISHED" ? "#f0fdf4" : "#fffbeb", color: ev.status === "PUBLISHED" ? "#16a34a" : "#92400e", fontWeight: 800 }}>
                                {ev.status === "PUBLISHED" ? "Опубликовано" : "Черновик"}
                              </span>
                            </div>
                          </div>
                          <div style={{ textAlign: "center", minWidth: 70, flexShrink: 0 }}>
                            <div style={{ fontSize: 28, fontWeight: 900, color: p >= 75 ? "#16a34a" : p >= 40 ? "#d97706" : "var(--primary)" }}>{p}%</div>
                            <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700 }}>готовность</div>
                          </div>
                        </div>
                        <div style={{ marginTop: 12, height: 6, background: "var(--bg-light)", borderRadius: 100, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${p}%`, background: p >= 75 ? "#16a34a" : p >= 40 ? "#d97706" : "var(--primary)", borderRadius: 100, transition: "width 0.5s" }} />
                        </div>
                        <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>
                          Нажмите чтобы открыть канбан →
                        </div>
                      </div>
                    );
                  })}
                  {events.length === 0 && <EmptyState icon="📋" title="Нет мероприятий" description="Создайте первое мероприятие." />}
                </div>
              </div>
            )}

            {/* ═══ TAB: КАНБАН ═══ */}
            {tab === "kanban" && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
                  <h1 style={{ fontWeight: 900, fontSize: 22, color: "var(--primary-dark)" }}>📌 Канбан задач</h1>
                  <select value={selEv} onChange={(e) => setSelEv(e.target.value)} style={{ padding: "8px 14px", borderRadius: 8, border: "1.5px solid var(--border)", fontSize: 13, fontFamily: "Nunito, sans-serif", fontWeight: 700, outline: "none", minWidth: 200 }}>
                    {events.map((ev) => (
                      <option key={ev.id} value={ev.id}>{ev.title}</option>
                    ))}
                  </select>
                </div>

                {selEvent && (
                  <div style={{ background: "white", borderRadius: 12, padding: "12px 18px", marginBottom: 16, border: "1.5px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                    <span style={{ fontWeight: 800, fontSize: 14, color: "var(--primary-dark)" }}>{selEvent.title}</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: pct(selEv) >= 75 ? "#16a34a" : "#d97706" }}>
                      Готовность: {pct(selEv)}% · Задач: {filtered.length}
                    </span>
                  </div>
                )}

                {/* Добавить задачу */}
                <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
                  <input type="text" placeholder="Новая задача..." value={newTitle} onChange={(e) => setNewTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTask()} style={{ flex: 2, minWidth: 180, padding: "10px 14px", borderRadius: 10, border: "1.5px solid var(--border)", fontSize: 13, fontFamily: "Nunito, sans-serif", outline: "none" }} />
                  <input type="date" value={newDue} onChange={(e) => setNewDue(e.target.value)} style={{ padding: "10px 14px", borderRadius: 10, border: "1.5px solid var(--border)", fontSize: 13, fontFamily: "Nunito, sans-serif", outline: "none" }} />
                  <button onClick={addTask} style={{ padding: "10px 22px", background: "var(--primary)", color: "white", border: "none", borderRadius: 100, fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "Nunito, sans-serif", whiteSpace: "nowrap" }}>+ Добавить</button>
                </div>

                {/* Колонки */}
                <div className="kanban-board">
                  {(["TODO", "IN_PROGRESS", "DONE"] as TaskStatus[]).map((status) => {
                    const col = COL_CFG[status];
                    const colTasks = filtered.filter((t) => t.status === status);
                    return (
                      <div key={status} className="kanban-col">
                        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 14, color: col.color, display: "flex", alignItems: "center", gap: 6 }}>
                          {col.icon} {col.label}
                          <span style={{ marginLeft: "auto", background: "white", padding: "2px 8px", borderRadius: 100, fontSize: 11, fontWeight: 900, color: col.color }}>{colTasks.length}</span>
                        </div>
                        {colTasks.map((task) => (
                          <div key={task.id} className="kanban-card">
                            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, color: "var(--primary-dark)" }}>{task.title}</div>
                            {task.assigned_to_name && <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>👤 {task.assigned_to_name}</div>}
                            {task.due_date && <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>📅 {task.due_date}</div>}
                            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                              {status === "TODO" && (
                                <button onClick={() => moveTask(task.id, "IN_PROGRESS")} style={{ padding: "4px 10px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 100, fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif", color: "#d97706" }}>🔧 Взять в работу</button>
                              )}
                              {status === "IN_PROGRESS" && (
                                <>
                                  <button onClick={() => moveTask(task.id, "DONE")} style={{ padding: "4px 10px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 100, fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif", color: "#16a34a" }}>✅ Выполнено</button>
                                  <button onClick={() => moveTask(task.id, "TODO")} style={{ padding: "4px 10px", background: "#f1f5f9", border: "1px solid var(--border)", borderRadius: 100, fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif", color: "#64748b" }}>← Вернуть</button>
                                </>
                              )}
                              {status === "DONE" && (
                                <button onClick={() => moveTask(task.id, "IN_PROGRESS")} style={{ padding: "4px 10px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 100, fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif", color: "#d97706" }}>🔄 Вернуть в работу</button>
                              )}
                              <button onClick={() => delTask(task.id)} style={{ padding: "4px 8px", background: "#fff1f1", border: "1px solid #fecaca", borderRadius: 100, fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif", color: "#ef4444", marginLeft: "auto" }}>✕</button>
                            </div>
                          </div>
                        ))}
                        {colTasks.length === 0 && (
                          <div style={{ textAlign: "center", padding: 24, color: "#ccc", fontSize: 13, fontWeight: 600 }}>
                            {status === "TODO" ? "Добавьте задачу выше ↑" : "Пусто"}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ═══ TAB: КАЛЕНДАРЬ ═══ */}
            {tab === "calendar" && (
              <div>
                <h1 style={{ fontWeight: 900, fontSize: 22, color: "var(--primary-dark)", marginBottom: 20 }}>📅 Календарь</h1>
                <CalendarView events={events} tasks={tasks} />
              </div>
            )}

            {/* ═══ TAB: МЕССЕНДЖЕР ═══ */}
            {tab === "chat" && <ChatView user={user} demoMode={demoMode} />}

            {/* ═══ TAB: НАСТРОЙКИ ═══ */}
            {tab === "settings" && (
              <div>
                <h1 style={{ fontWeight: 900, fontSize: 22, color: "var(--primary-dark)", marginBottom: 20 }}>Настройки профиля</h1>
                <div style={{ background: "white", borderRadius: 16, padding: 28, maxWidth: 440, boxShadow: "0 2px 10px rgba(74,89,138,0.07)" }}>
                  {[
                    { l: "Имя", v: user.full_name },
                    { l: "Email", v: user.email },
                    { l: "Роль", v: user.global_role },
                    ...(user.organization && user.organization !== "CURATOR_DEMO" ? [{ l: "Организация", v: user.organization }] : []),
                  ].map((f) => (
                    <div key={f.l} style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>{f.l}</div>
                      <div style={{ padding: "9px 14px", background: "#f8fafc", borderRadius: 8, fontSize: 14, fontWeight: 600 }}>{f.v}</div>
                    </div>
                  ))}
                  {demoMode && <p style={{ color: "#f59e0b", fontSize: 12, fontWeight: 600 }}>⚠️ Demo — изменения не сохраняются</p>}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// 5. PARTICIPANT DASHBOARD
// ═══════════════════════════════════════════════════════════════
function ParticipantDashboard({
  user,
  onLogout,
  demoMode,
}: {
  user: User;
  onLogout: () => void;
  demoMode: boolean;
}) {
  const [tab, setTab] = useState<"program" | "schedule" | "chat" | "settings">("program");
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [regs, setRegs] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (demoMode) {
      setEvents(DEMO_EVENTS.filter((e) => e.status === "PUBLISHED"));
      setLoading(false);
    } else {
      eventsAPI
        .getAll()
        .then((res) => setEvents((res.data || []).filter((e: EventData) => e.status === "PUBLISHED")))
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [demoMode]);

  const register = async (id: string) => {
    if (regs.has(id)) return;
    if (!demoMode) try { await participantsAPI.registerToEvent(id); } catch {}
    setRegs((prev) => new Set(prev).add(id));
  };

  const navItems = [
    { id: "program", icon: "📋", label: "Программа" },
    { id: "schedule", icon: "📅", label: "Моё расписание" },
    { id: "chat", icon: "💬", label: "Чат" },
    { id: "settings", icon: "⚙️", label: "Настройки" },
  ];

  return (
    <div className="dashboard-wrapper">
      <aside className="dashboard-sidebar">
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#16a34a", color: "white", fontSize: 26, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}>
            {user.full_name[0]}
          </div>
          <h5 style={{ marginTop: 10, marginBottom: 4, fontWeight: 800, fontSize: 15 }}>{user.full_name}</h5>
          <span style={{ display: "inline-block", padding: "3px 10px", background: "#f0fdf4", color: "#16a34a", borderRadius: 100, fontSize: 11, fontWeight: 800 }}>PARTICIPANT</span>
          {user.organization && <p style={{ fontSize: 11, color: "#777", marginTop: 5 }}>{user.organization}</p>}
          {demoMode && <div style={{ fontSize: 10, color: "#f59e0b", fontWeight: 700, marginTop: 3 }}>DEMO</div>}
        </div>
        <nav className="sidebar-nav-list">
          {navItems.map((i) => (
            <button key={i.id} className="nav-link" style={{ background: tab === i.id ? "#f0fdf4" : "#f1f5f9", color: tab === i.id ? "#16a34a" : "#475569" }} onClick={() => setTab(i.id as any)}>
              <span style={{ marginRight: 8 }}>{i.icon}</span>{i.label}
            </button>
          ))}
          <button className="nav-link" style={{ marginTop: 16, background: "#fff1f1", color: "#ef4444" }} onClick={onLogout}>
            <span style={{ marginRight: 8 }}>🚪</span>Выйти
          </button>
        </nav>
      </aside>

      <main className="dashboard-main-content">
        {loading ? <Spinner /> : (
          <>
            {tab === "program" && (
              <div>
                <h1 style={{ fontWeight: 900, fontSize: 22, color: "var(--primary-dark)", marginBottom: 20 }}>Программа мероприятий</h1>
                <div style={{ display: "grid", gap: 14 }}>
                  {events.map((ev) => (
                    <div key={ev.id} style={{ background: "white", borderRadius: 16, padding: "20px 24px", boxShadow: "0 2px 12px rgba(74,89,138,0.07)", border: "1.5px solid var(--border)" }}>
                      <h3 style={{ fontWeight: 800, fontSize: 16, color: "var(--primary-dark)", marginBottom: 6 }}>{ev.title}</h3>
                      {ev.description && <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 8 }}>{ev.description}</p>}
                      <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600, marginBottom: 12 }}>📅 {ev.start_date} — {ev.end_date}</div>
                      <button onClick={() => register(ev.id)} style={{ padding: "9px 22px", background: regs.has(ev.id) ? "#f0fdf4" : "#16a34a", color: regs.has(ev.id) ? "#16a34a" : "white", border: regs.has(ev.id) ? "1.5px solid #bbf7d0" : "none", borderRadius: 100, fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>
                        {regs.has(ev.id) ? "✅ Вы зарегистрированы" : "Зарегистрироваться"}
                      </button>
                    </div>
                  ))}
                  {events.length === 0 && <EmptyState icon="📋" title="Нет мероприятий" description="Скоро здесь появятся новые мероприятия." />}
                </div>
              </div>
            )}

            {tab === "schedule" && (
              <div>
                <h1 style={{ fontWeight: 900, fontSize: 22, color: "var(--primary-dark)", marginBottom: 20 }}>Моё расписание</h1>
                {demoMode ? (
                  <div style={{ display: "grid", gap: 12 }}>
                    {[
                      { time: "10:00 – 10:30", title: "Угрозы безопасности 2026", loc: "📍 Зал А · Секция ИнфоБез" },
                      { time: "10:30 – 11:00", title: "Защита данных в облаке", loc: "📍 Зал А · Секция ИнфоБез" },
                      { time: "11:00 – 11:30", title: "Нейросети на производстве", loc: "📍 Зал Б · Секция ML" },
                    ].map((r, i) => (
                      <div key={i} style={{ background: "white", borderRadius: 14, padding: "16px 20px", boxShadow: "0 2px 10px rgba(74,89,138,0.07)", border: "1.5px solid var(--border)" }}>
                        <div style={{ fontSize: 12, color: "var(--primary)", fontWeight: 800, marginBottom: 4 }}>{r.time}</div>
                        <div style={{ fontWeight: 800, fontSize: 15, color: "var(--primary-dark)", marginBottom: 4 }}>{r.title}</div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{r.loc}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState icon="📅" title="Расписание пока пусто" description="Зарегистрируйтесь на мероприятие и добавьте доклады." />
                )}
              </div>
            )}

            {tab === "chat" && <ChatView user={user} demoMode={demoMode} />}

            {tab === "settings" && (
              <div>
                <h1 style={{ fontWeight: 900, fontSize: 22, color: "var(--primary-dark)", marginBottom: 20 }}>Настройки</h1>
                <div style={{ background: "white", borderRadius: 16, padding: 28, maxWidth: 440, boxShadow: "0 2px 10px rgba(74,89,138,0.07)" }}>
                  {[
                    { l: "Имя", v: user.full_name },
                    { l: "Email", v: user.email },
                    { l: "Роль", v: "PARTICIPANT" },
                    ...(user.organization ? [{ l: "Организация", v: user.organization }] : []),
                  ].map((f) => (
                    <div key={f.l} style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>{f.l}</div>
                      <div style={{ padding: "9px 14px", background: "#f8fafc", borderRadius: 8, fontSize: 14, fontWeight: 600 }}>{f.v}</div>
                    </div>
                  ))}
                  {demoMode && <p style={{ color: "#f59e0b", fontSize: 12, fontWeight: 600 }}>⚠️ Demo</p>}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// APP ROOT — роутинг
// ═══════════════════════════════════════════════════════════════
function AppContent() {
  const [user, setUser] = useState<User | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [initLoading, setInitLoading] = useState(true);

  useEffect(() => {
    injectGlobalCSS();
    const token = localStorage.getItem("access_token");
    const du = localStorage.getItem("demo_user");

    if (du) {
      try {
        setUser(JSON.parse(du));
        setDemoMode(true);
      } catch {}
      setInitLoading(false);
      return;
    }

    if (token) {
      authAPI
        .me()
        .then((res) => setUser(res.data))
        .catch(() => localStorage.removeItem("access_token"))
        .finally(() => setInitLoading(false));
    } else {
      setInitLoading(false);
    }
  }, []);

  const handleLogin = async (email: string, password: string) => {
    setAuthLoading(true);
    setAuthError("");

    // Demo
    const du = DEMO_USERS[email];
    if (du && du.password === password) {
      const { password: _, ...userData } = du;
      setUser(userData);
      setDemoMode(true);
      localStorage.setItem("demo_user", JSON.stringify(userData));
      setAuthLoading(false);
      return;
    }

    // Real backend
    try {
      const res = await authAPI.login({ email, password });
      localStorage.setItem("access_token", res.data.access_token);
      const meRes = await authAPI.me();
      setUser(meRes.data);
      setDemoMode(false);
    } catch (e: any) {
      setAuthError(e?.response?.data?.detail || "Неверный email или пароль");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegister = async (email: string, password: string, full_name: string) => {
    setAuthLoading(true);
    setAuthError("");
    try {
      const res = await authAPI.register({ email, password, full_name });
      localStorage.setItem("access_token", res.data.access_token);
      const meRes = await authAPI.me();
      setUser(meRes.data);
      setDemoMode(false);
    } catch (e: any) {
      setAuthError(e?.response?.data?.detail || "Ошибка регистрации. Проверьте данные.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setDemoMode(false);
    localStorage.removeItem("access_token");
    localStorage.removeItem("demo_user");
  };

  const isCurator = () => {
    if (!user) return false;
    if (demoMode && user.organization === "CURATOR_DEMO") return true;
    // TODO: при подключении бэка — проверять EventMembership
    return false;
  };

  if (initLoading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          background: "var(--bg-light)",
        }}
      >
        <Spinner label="Загрузка EventHub..." />
      </div>
    );
  }

  return (
    <Routes>
      {/* FIX #5: лендинг на / */}
      <Route path="/" element={user ? <Navigate to="/dashboard" /> : <LandingPage />} />

      <Route
        path="/login"
        element={
          user ? <Navigate to="/dashboard" /> : <AuthPage onLogin={handleLogin} onRegister={handleRegister} loading={authLoading} error={authError} />
        }
      />

      <Route
        path="/create-event"
        element={
          user?.global_role === "ORGANIZER" ? <CreateEventPage demoMode={demoMode} /> : <Navigate to="/dashboard" />
        }
      />

      <Route
        path="/reports/:id"
        element={
          user ? <ReportPage user={user} demoMode={demoMode} /> : <Navigate to="/login" />
        }
      />

      <Route
        path="/dashboard"
        element={
          user ? (
            user.global_role === "ORGANIZER" ? (
              <OrganizerDashboard user={user} onLogout={handleLogout} demoMode={demoMode} />
            ) : isCurator() ? (
              <CuratorDashboard user={user} onLogout={handleLogout} demoMode={demoMode} />
            ) : (
              <ParticipantDashboard user={user} onLogout={handleLogout} demoMode={demoMode} />
            )
          ) : (
            <Navigate to="/login" />
          )
        }
      />

      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

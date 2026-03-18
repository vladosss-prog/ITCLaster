import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { eventsAPI, tasksAPI } from "../api/apiClient";
import type { Task, TaskStatus, EventData as EventItem, EventStatus } from "../api/apiClient";
// -----------------------------------------------------------
// ТИПЫ
// -----------------------------------------------------------
// interface EventItem {
//   id: string;
//   title: string;
//   description?: string | null;
//   start_date?: string | null;
//   end_date?: string | null;
//   owner_id: string;
//   status: string;
//   readiness_percent?: number;
// }

// -----------------------------------------------------------
// DEMO ДАННЫЕ
// -----------------------------------------------------------
const DEMO_EVENTS: Record<string, EventItem> = {
  "e1": {
    id: "e1", title: "ИТ-Форум 2026", status: "PUBLISHED", owner_id: "u1",
    description: "Главное событие цифровой индустрии Сибири. Конференции, воркшопы, нетворкинг.",
    start_date: "2026-03-19", end_date: "2026-03-20", readiness_percent: 72,
  },
  "e2": {
    id: "e2", title: "Хакатон EventHub", status: "PUBLISHED", owner_id: "u1",
    description: "48-часовой хакатон по разработке платформы EventHub.",
    start_date: "2026-03-16", end_date: "2026-03-18", readiness_percent: 95,
  },
  "e3": {
    id: "e3", title: "Робофест Омск 2026", status: "DRAFT", owner_id: "u1",
    description: "Городской чемпионат по робототехнике среди школьников и студентов.",
    start_date: "2026-04-10", end_date: "2026-04-11", readiness_percent: 30,
  },
};

const DEMO_TASKS: Record<string, Task[]> = {
  "e1": [
    { id: "t1", event_id: "e1", title: "Подготовить бейджи", status: "DONE", assigned_to: "u1", created_by: "u1", due_date: "2026-03-18" },
    { id: "t2", event_id: "e1", title: "Настроить проектор в зале А", status: "IN_PROGRESS", assigned_to: "u2", created_by: "u1", due_date: "2026-03-19" },
    { id: "t3", event_id: "e1", title: "Согласовать кейтеринг", status: "IN_PROGRESS", assigned_to: "u1", created_by: "u1", due_date: "2026-03-17" },
    { id: "t4", event_id: "e1", title: "Разослать программу участникам", status: "TODO", assigned_to: "u2", created_by: "u1", due_date: "2026-03-18" },
    { id: "t5", event_id: "e1", title: "Подготовить сертификаты", status: "TODO", assigned_to: "u1", created_by: "u1", due_date: "2026-03-20" },
  ],
  "e2": [
    { id: "t6", event_id: "e2", title: "Настроить репозиторий", status: "DONE", assigned_to: "u1", created_by: "u1", due_date: "2026-03-16" },
    { id: "t7", event_id: "e2", title: "Подготовить задание хакатона", status: "DONE", assigned_to: "u1", created_by: "u1", due_date: "2026-03-15" },
    { id: "t8", event_id: "e2", title: "Записать GIF демо", status: "TODO", assigned_to: "u2", created_by: "u1", due_date: "2026-03-18" },
  ],
  "e3": [
    { id: "t9", event_id: "e3", title: "Найти площадку", status: "TODO", assigned_to: "u1", created_by: "u1", due_date: "2026-04-01" },
  ],
};

// -----------------------------------------------------------
// МОДАЛКА СОЗДАНИЯ ЗАДАЧИ
// -----------------------------------------------------------
const CreateTaskModal = ({
  eventId,
  onClose,
  onCreated,
  demoMode,
}: {
  eventId: string;
  onClose: () => void;
  onCreated: (task: Task) => void;
  demoMode: boolean;
}) => {
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async () => {
    if (!title.trim()) { setError("Введите название задачи"); return; }
    setSaving(true);
    setError("");

    if (demoMode) {
      const newTask: Task = {
        id: `demo-task-${Date.now()}`,
        event_id: eventId,
        title: title.trim(),
        status: "TODO",
        assigned_to: null,
        created_by: "u1",
        due_date: dueDate || null,
      };
      onCreated(newTask);
      onClose();
      return;
    }

    try {
      const res = await tasksAPI.create({
        event_id: eventId,
        title: title.trim(),
        status: "TODO",
        due_date: dueDate || undefined,
      });
      onCreated(res.data);
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || "Не удалось создать задачу");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(13,27,62,0.5)",
      backdropFilter: "blur(4px)", display: "flex", alignItems: "center",
      justifyContent: "center", zIndex: 3000,
    }}>
      <div style={{
        background: "white", borderRadius: 20, padding: 32, width: "100%",
        maxWidth: 440, boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
        borderTop: "5px solid var(--primary)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h3 style={{ fontWeight: 900, margin: 0, color: "var(--primary-dark)" }}>Новая задача</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#777" }}>×</button>
        </div>

        {error && (
          <div style={{ background: "#fef2f2", color: "#dc2626", padding: "10px 14px", borderRadius: 8, marginBottom: 16, fontSize: 14, fontWeight: 600 }}>
            {error}
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "#777", textTransform: "uppercase", marginBottom: 6 }}>
            Название задачи *
          </label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleCreate()}
            placeholder="Например: Подготовить бейджи"
            autoFocus
            style={{
              width: "100%", padding: "10px 14px", borderRadius: 8,
              border: "1.5px solid var(--border)", fontSize: 14, boxSizing: "border-box",
              fontFamily: "Nunito, sans-serif", outline: "none",
            }}
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "#777", textTransform: "uppercase", marginBottom: 6 }}>
            Дедлайн
          </label>
          <input
            type="date"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
            style={{
              width: "100%", padding: "10px 14px", borderRadius: 8,
              border: "1.5px solid var(--border)", fontSize: 14, boxSizing: "border-box",
              fontFamily: "Nunito, sans-serif", outline: "none",
            }}
          />
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={handleCreate}
            disabled={saving}
            style={{
              flex: 1, padding: "12px", background: "var(--primary)", color: "white",
              border: "none", borderRadius: 100, fontWeight: 800, fontSize: 14,
              cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1,
              fontFamily: "Nunito, sans-serif",
            }}
          >
            {saving ? "Создание..." : "СОЗДАТЬ"}
          </button>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: "12px", background: "#f1f5f9", color: "#475569",
              border: "none", borderRadius: 100, fontWeight: 800, fontSize: 14,
              cursor: "pointer", fontFamily: "Nunito, sans-serif",
            }}
          >
            ОТМЕНА
          </button>
        </div>
      </div>
    </div>
  );
};

// -----------------------------------------------------------
// МОДАЛКА РЕДАКТИРОВАНИЯ МЕРОПРИЯТИЯ
// -----------------------------------------------------------
const EditEventModal = ({
  event,
  onClose,
  onSaved,
  demoMode,
}: {
  event: EventItem;
  onClose: () => void;
  onSaved: (updated: EventItem) => void;
  demoMode: boolean;
}) => {
  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description || "");
  const [startDate, setStartDate] = useState(event.start_date || "");
  const [endDate, setEndDate] = useState(event.end_date || "");
  const [status, setStatus] = useState(event.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!title.trim()) { setError("Введите название"); return; }
    setSaving(true); setError("");

    const updated: EventItem = {
      ...event,
      title: title.trim(),
      description: description || null,
      start_date: startDate || null,
      end_date: endDate || null,
      status,
    };

    if (demoMode) {
      onSaved(updated);
      onClose();
      return;
    }

    try {
      await eventsAPI.update(event.id, updated); // PATCH /api/events/{id} — когда бэк добавит
      onSaved(updated);
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: 12, fontWeight: 800, color: "#777",
    textTransform: "uppercase", marginBottom: 6,
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 14px", borderRadius: 8,
    border: "1.5px solid var(--border)", fontSize: 14, boxSizing: "border-box",
    fontFamily: "Nunito, sans-serif", outline: "none", marginBottom: 16,
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(13,27,62,0.5)",
      backdropFilter: "blur(4px)", display: "flex", alignItems: "center",
      justifyContent: "center", zIndex: 3000,
    }}>
      <div style={{
        background: "white", borderRadius: 20, padding: 32, width: "100%",
        maxWidth: 520, boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
        borderTop: "5px solid var(--primary)", maxHeight: "90vh", overflowY: "auto",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h3 style={{ fontWeight: 900, margin: 0, color: "var(--primary-dark)" }}>Редактировать мероприятие</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#777" }}>×</button>
        </div>

        {error && (
          <div style={{ background: "#fef2f2", color: "#dc2626", padding: "10px 14px", borderRadius: 8, marginBottom: 16, fontSize: 14, fontWeight: 600 }}>
            {error}
          </div>
        )}

        {demoMode && (
          <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, fontWeight: 600, color: "#92400e" }}>
            ⚠️ Demo режим — изменения не сохраняются в БД
          </div>
        )}

        <label style={labelStyle}>Название *</label>
        <input type="text" value={title} onChange={e => setTitle(e.target.value)} style={inputStyle} />

        <label style={labelStyle}>Описание</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={3}
          style={{ ...inputStyle, resize: "vertical" }}
        />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          <div>
            <label style={labelStyle}>Дата начала</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              style={{ ...inputStyle, marginBottom: 0 }} />
          </div>
          <div>
            <label style={labelStyle}>Дата окончания</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              style={{ ...inputStyle, marginBottom: 0 }} />
          </div>
        </div>

        <label style={{ ...labelStyle, marginTop: 16 }}>Статус</label>
        <select value={status} onChange={e => setStatus(e.target.value as EventStatus)} style={inputStyle}>
          <option value="DRAFT">DRAFT — Черновик</option>
          <option value="PUBLISHED">PUBLISHED — Опубликовано</option>
          <option value="FINISHED">FINISHED — Завершено</option>
        </select>

        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button onClick={handleSave} disabled={saving} style={{
            flex: 1, padding: "12px", background: "var(--primary)", color: "white",
            border: "none", borderRadius: 100, fontWeight: 800, fontSize: 14,
            cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1,
            fontFamily: "Nunito, sans-serif",
          }}>
            {saving ? "Сохранение..." : "СОХРАНИТЬ"}
          </button>
          <button onClick={onClose} style={{
            flex: 1, padding: "12px", background: "#f1f5f9", color: "#475569",
            border: "none", borderRadius: 100, fontWeight: 800, fontSize: 14,
            cursor: "pointer", fontFamily: "Nunito, sans-serif",
          }}>
            ОТМЕНА
          </button>
        </div>
      </div>
    </div>
  );
};

// -----------------------------------------------------------
// КАНБАН МЕРОПРИЯТИЯ
// -----------------------------------------------------------
const EventKanban = ({
  tasks, onUpdateStatus, onDeleteTask, onAddTask, demoMode,
}: {
  tasks: Task[];
  onUpdateStatus: (id: string, status: TaskStatus) => void;
  onDeleteTask: (id: string) => void;
  onAddTask: () => void;
  demoMode: boolean;
}) => {
  const columns: { id: TaskStatus; label: string; color: string; bg: string }[] = [
    { id: "TODO", label: "Нужно сделать", color: "#94a3b8", bg: "#f8fafc" },
    { id: "IN_PROGRESS", label: "В работе", color: "#f59e0b", bg: "#fffbeb" },
    { id: "DONE", label: "Готово", color: "#16a34a", bg: "#f0fdf4" },
  ];

  const doneCount = tasks.filter(t => t.status === "DONE").length;
  const percent = tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0;

  return (
    <div>
      {/* Прогресс */}
      <div style={{
        background: "white", borderRadius: 12, padding: "16px 20px",
        marginBottom: 20, boxShadow: "0 2px 8px rgba(74,89,138,0.08)",
        border: "1.5px solid var(--border)",
        display: "flex", alignItems: "center", gap: 16,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: "var(--primary-dark)" }}>
              Прогресс выполнения задач
            </span>
            <span style={{ fontWeight: 900, color: percent === 100 ? "#16a34a" : "var(--primary)" }}>
              {doneCount} / {tasks.length} ({percent}%)
            </span>
          </div>
          <div style={{ background: "var(--border)", borderRadius: 100, height: 8 }}>
            <div style={{
              width: `${percent}%`,
              background: percent === 100 ? "#16a34a" : "var(--primary)",
              height: "100%", borderRadius: 100, transition: "width 0.4s",
            }} />
          </div>
        </div>
        <button onClick={onAddTask} style={{
          padding: "10px 20px", background: "var(--primary)", color: "white",
          border: "none", borderRadius: 100, fontWeight: 800, fontSize: 13,
          cursor: "pointer", whiteSpace: "nowrap", fontFamily: "Nunito, sans-serif",
        }}>
          + Задача
        </button>
      </div>

      {/* Колонки */}
      <div style={{ display: "flex", gap: 16, overflowX: "auto", paddingBottom: 8 }}>
        {columns.map(col => {
          const colTasks = tasks.filter(t => t.status === col.id);
          return (
            <div key={col.id} style={{
              minWidth: 280, maxWidth: 320, flex: "0 0 auto",
              background: col.bg, borderRadius: 16, padding: 16,
              border: `1.5px solid ${col.color}22`,
            }}>
              {/* Заголовок колонки */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                marginBottom: 14, paddingBottom: 10,
                borderBottom: `2px solid ${col.color}44`,
              }}>
                <span style={{ fontWeight: 900, fontSize: 14, color: "var(--primary-dark)" }}>
                  {col.label}
                </span>
                <span style={{
                  background: col.color, color: "white", borderRadius: 100,
                  padding: "2px 10px", fontSize: 12, fontWeight: 800,
                }}>
                  {colTasks.length}
                </span>
              </div>

              {/* Задачи */}
              {colTasks.length === 0 && (
                <div style={{ color: "#aaa", fontSize: 13, textAlign: "center", padding: "24px 0", fontWeight: 600 }}>
                  Пусто
                </div>
              )}

              {colTasks.map(task => (
                <div key={task.id} style={{
                  background: "white", borderRadius: 12, padding: 14, marginBottom: 10,
                  boxShadow: "0 2px 8px rgba(74,89,138,0.06)",
                  borderLeft: `4px solid ${col.color}`,
                  transition: "box-shadow 0.2s",
                }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "var(--primary-dark)", marginBottom: 8, lineHeight: 1.4 }}>
                    {task.title}
                  </div>

                  {task.due_date && (
                    <div style={{ fontSize: 12, color: "#777", marginBottom: 10, fontWeight: 600 }}>
                      📅 Дедлайн: {task.due_date}
                    </div>
                  )}

                  {/* Смена статуса */}
                  <select
                    value={task.status}
                    onChange={e => onUpdateStatus(task.id, e.target.value as TaskStatus)}
                    style={{
                      width: "100%", padding: "6px 10px", borderRadius: 8,
                      border: "1.5px solid var(--border)", fontSize: 12,
                      fontFamily: "Nunito, sans-serif", marginBottom: 8,
                      background: "white", cursor: "pointer",
                    }}
                  >
                    <option value="TODO">Нужно сделать</option>
                    <option value="IN_PROGRESS">В работе</option>
                    <option value="DONE">Готово</option>
                  </select>

                  {/* Удалить задачу */}
                  <button
                    onClick={() => onDeleteTask(task.id)}
                    style={{
                      width: "100%", padding: "6px", background: "#fff1f1",
                      color: "#ef4444", border: "none", borderRadius: 8,
                      fontSize: 12, fontWeight: 700, cursor: "pointer",
                      fontFamily: "Nunito, sans-serif",
                    }}
                  >
                    Удалить
                  </button>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// -----------------------------------------------------------
// ГЛАВНЫЙ КОМПОНЕНТ — EventManagePage
// -----------------------------------------------------------
export function EventManagePage({ demoMode }: { demoMode: boolean }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [event, setEvent] = useState<EventItem | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [activeTab, setActiveTab] = useState<"kanban" | "info">("kanban");
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [showEditEvent, setShowEditEvent] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Загрузка мероприятия и задач
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError("");

    if (demoMode) {
      const found = DEMO_EVENTS[id] || null;
      setEvent(found);
      setTasks(DEMO_TASKS[id] || []);
      setLoading(false);
      return;
    }

    Promise.all([
      eventsAPI.getOne(id),
      tasksAPI.getByEvent(id),
    ])
      .then(([evRes, taskRes]) => {
        setEvent(evRes.data as EventItem);
        setTasks(taskRes.data || []);
      })
      .catch(e => setError(e?.response?.data?.detail || e?.message || "Не удалось загрузить мероприятие"))
      .finally(() => setLoading(false));
  }, [id, demoMode]);

  // Смена статуса задачи
  const handleUpdateStatus = async (taskId: string, status: TaskStatus) => {
    if (demoMode) {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t));
      return;
    }
    try {
      await tasksAPI.updateStatus(taskId, status);
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t));
    } catch (e: any) {
      alert(e?.response?.data?.detail || "Не удалось обновить статус");
    }
  };

  // Удаление задачи
  const handleDeleteTask = async (taskId: string) => {
    if (!window.confirm("Удалить задачу?")) return;

    if (demoMode) {
      setTasks(prev => prev.filter(t => t.id !== taskId));
      return;
    }
    try {
      await tasksAPI.delete(taskId);
      setTasks(prev => prev.filter(t => t.id !== taskId));
    } catch (e: any) {
      alert(e?.response?.data?.detail || "Не удалось удалить задачу");
    }
  };

  // Добавление задачи
  const handleTaskCreated = (task: Task) => {
    setTasks(prev => [...prev, task]);
  };

  // Удаление мероприятия
  const handleDeleteEvent = async () => {
    if (!id) return;
    setDeleting(true);

    if (demoMode) {
      navigate("/dashboard");
      return;
    }

    try {
      // DELETE /api/events/{id} — когда бэк добавит эндпоинт
      // await eventsAPI.delete(id);
      navigate("/dashboard");
    } catch (e: any) {
      alert(e?.response?.data?.detail || "Не удалось удалить мероприятие");
      setDeleting(false);
    }
  };

  // ------- РЕНДЕР -------

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: 40, height: 40, border: "4px solid var(--border)",
            borderTop: "4px solid var(--primary)", borderRadius: "50%",
            animation: "spin 0.8s linear infinite", margin: "0 auto 16px",
          }} />
          <p style={{ color: "var(--text-muted)", fontWeight: 600 }}>Загрузка мероприятия...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>😕</div>
        <h2 style={{ fontWeight: 800, marginBottom: 8 }}>Ошибка загрузки</h2>
        <p style={{ color: "#777" }}>{error}</p>
        <button onClick={() => navigate("/dashboard")} style={{
          marginTop: 20, padding: "12px 28px", background: "var(--primary)",
          color: "white", border: "none", borderRadius: 100, fontWeight: 800, cursor: "pointer",
        }}>
          ← В дашборд
        </button>
      </div>
    );
  }

  if (!event) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
        <h2 style={{ fontWeight: 800, marginBottom: 8 }}>Мероприятие не найдено</h2>
        <button onClick={() => navigate("/dashboard")} style={{
          marginTop: 20, padding: "12px 28px", background: "var(--primary)",
          color: "white", border: "none", borderRadius: 100, fontWeight: 800, cursor: "pointer",
        }}>
          ← В дашборд
        </button>
      </div>
    );
  }

  const statusColors: Record<string, { bg: string; color: string }> = {
    DRAFT:     { bg: "#f1f5f9", color: "#64748b" },
    PUBLISHED: { bg: "#e8f0fe", color: "var(--primary)" },
    FINISHED:  { bg: "#f0fdf4", color: "#16a34a" },
  };
  const statusStyle = statusColors[event.status] || statusColors.DRAFT;

  const donePercent = tasks.length > 0
    ? Math.round((tasks.filter(t => t.status === "DONE").length / tasks.length) * 100)
    : 0;

  return (
    <div style={{ padding: "0 0 40px" }}>
      {/* ШАПКА МЕРОПРИЯТИЯ */}
      <div style={{
        background: "white", borderRadius: 16, padding: "24px 28px",
        marginBottom: 24, boxShadow: "0 2px 12px rgba(74,89,138,0.08)",
        border: "1.5px solid var(--border)",
      }}>
        {/* Навигация */}
        <div style={{ marginBottom: 16 }}>
          <button
            onClick={() => navigate("/dashboard")}
            style={{ background: "none", border: "none", color: "var(--primary)", fontWeight: 800, fontSize: 14, cursor: "pointer", padding: 0, fontFamily: "Nunito, sans-serif" }}
          >
            ← Мои мероприятия
          </button>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Статус бейдж */}
            <span style={{
              display: "inline-block", padding: "3px 12px", borderRadius: 100,
              fontSize: 11, fontWeight: 800, textTransform: "uppercase",
              letterSpacing: "0.5px", marginBottom: 10,
              background: statusStyle.bg, color: statusStyle.color,
            }}>
              {event.status}
            </span>

            <h1 style={{ fontWeight: 900, fontSize: "1.6rem", color: "var(--primary-dark)", margin: "0 0 8px" }}>
              {event.title}
            </h1>

            {event.description && (
              <p style={{ color: "var(--text-muted)", fontSize: 15, lineHeight: 1.6, margin: "0 0 12px" }}>
                {event.description}
              </p>
            )}

            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              {(event.start_date || event.end_date) && (
                <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 700 }}>
                  📅 {event.start_date} — {event.end_date}
                </span>
              )}
              <span style={{ fontSize: 13, fontWeight: 700, color: donePercent === 100 ? "#16a34a" : "var(--primary)" }}>
                ✓ Готовность: {donePercent}%
              </span>
            </div>
          </div>

          {/* Кнопки управления */}
          <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
            <button
              onClick={() => setShowEditEvent(true)}
              style={{
                padding: "10px 20px", background: "var(--bg-medium)", color: "var(--primary)",
                border: "1.5px solid var(--border)", borderRadius: 100,
                fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "Nunito, sans-serif",
              }}
            >
              ✏️ Редактировать
            </button>
            <button
              onClick={() => setDeleteConfirm(true)}
              style={{
                padding: "10px 20px", background: "#fff1f1", color: "#ef4444",
                border: "1.5px solid #fecaca", borderRadius: 100,
                fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "Nunito, sans-serif",
              }}
            >
              🗑️ Удалить
            </button>
          </div>
        </div>
      </div>

      {/* ТАБЫ */}
      <div style={{
        display: "flex", gap: 4, background: "var(--bg-light)",
        borderRadius: 12, padding: 4, marginBottom: 20,
        border: "1.5px solid var(--border)", width: "fit-content",
      }}>
        {[
          { id: "kanban", label: "📋 Канбан задач" },
          { id: "info", label: "ℹ️ Информация" },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} style={{
            padding: "8px 20px", border: "none", borderRadius: 8,
            fontWeight: 800, fontSize: 13, cursor: "pointer",
            background: activeTab === tab.id ? "white" : "transparent",
            color: activeTab === tab.id ? "var(--primary)" : "var(--text-muted)",
            boxShadow: activeTab === tab.id ? "0 2px 8px rgba(74,89,138,0.1)" : "none",
            fontFamily: "Nunito, sans-serif", transition: "all 0.2s",
          }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* КАНБАН */}
      {activeTab === "kanban" && (
        <EventKanban
          tasks={tasks}
          onUpdateStatus={handleUpdateStatus}
          onDeleteTask={handleDeleteTask}
          onAddTask={() => setShowCreateTask(true)}
          demoMode={demoMode}
        />
      )}

      {/* ИНФОРМАЦИЯ */}
      {activeTab === "info" && (
        <div style={{ background: "white", borderRadius: 16, padding: 28, boxShadow: "0 2px 12px rgba(74,89,138,0.08)", border: "1.5px solid var(--border)" }}>
          <h2 style={{ fontWeight: 900, marginBottom: 20, color: "var(--primary-dark)" }}>Детали мероприятия</h2>
          {[
            { label: "Название", value: event.title },
            { label: "Описание", value: event.description || "—" },
            { label: "Дата начала", value: event.start_date || "—" },
            { label: "Дата окончания", value: event.end_date || "—" },
            { label: "Статус", value: event.status },
            { label: "ID", value: event.id },
          ].map(field => (
            <div key={field.label} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid var(--border)" }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>
                {field.label}
              </div>
              <div style={{ fontWeight: 700, color: "var(--primary-dark)", fontSize: 15 }}>
                {field.value}
              </div>
            </div>
          ))}
          <button onClick={() => setShowEditEvent(true)} style={{
            padding: "12px 28px", background: "var(--primary)", color: "white",
            border: "none", borderRadius: 100, fontWeight: 800, fontSize: 14,
            cursor: "pointer", fontFamily: "Nunito, sans-serif",
          }}>
            ✏️ Редактировать мероприятие
          </button>
        </div>
      )}

      {/* МОДАЛКА ПОДТВЕРЖДЕНИЯ УДАЛЕНИЯ */}
      {deleteConfirm && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(13,27,62,0.5)",
          backdropFilter: "blur(4px)", display: "flex", alignItems: "center",
          justifyContent: "center", zIndex: 3000,
        }}>
          <div style={{
            background: "white", borderRadius: 20, padding: 32, width: "100%",
            maxWidth: 400, boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
            borderTop: "5px solid #ef4444", textAlign: "center",
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🗑️</div>
            <h3 style={{ fontWeight: 900, color: "var(--primary-dark)", marginBottom: 8 }}>
              Удалить мероприятие?
            </h3>
            <p style={{ color: "var(--text-muted)", marginBottom: 24, fontWeight: 600 }}>
              «{event.title}» будет удалено безвозвратно вместе со всеми задачами.
            </p>
            {demoMode && (
              <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "8px 14px", marginBottom: 16, fontSize: 13, fontWeight: 600, color: "#92400e" }}>
                Demo: вернёт в дашборд без реального удаления
              </div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={handleDeleteEvent} disabled={deleting} style={{
                flex: 1, padding: "12px", background: "#ef4444", color: "white",
                border: "none", borderRadius: 100, fontWeight: 800, fontSize: 14,
                cursor: deleting ? "not-allowed" : "pointer",
                opacity: deleting ? 0.7 : 1, fontFamily: "Nunito, sans-serif",
              }}>
                {deleting ? "Удаление..." : "УДАЛИТЬ"}
              </button>
              <button onClick={() => setDeleteConfirm(false)} style={{
                flex: 1, padding: "12px", background: "#f1f5f9", color: "#475569",
                border: "none", borderRadius: 100, fontWeight: 800, fontSize: 14,
                cursor: "pointer", fontFamily: "Nunito, sans-serif",
              }}>
                ОТМЕНА
              </button>
            </div>
          </div>
        </div>
      )}

      {/* МОДАЛКИ */}
      {showCreateTask && (
        <CreateTaskModal
          eventId={id!}
          onClose={() => setShowCreateTask(false)}
          onCreated={handleTaskCreated}
          demoMode={demoMode}
        />
      )}

      {showEditEvent && (
        <EditEventModal
          event={event}
          onClose={() => setShowEditEvent(false)}
          onSaved={updated => {
            setEvent(updated);
            setShowEditEvent(false);
          }}
          demoMode={demoMode}
        />
      )}
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { eventsAPI, tasksAPI, usersAPI, reportsAPI, participantsAPI } from "../api/apiClient.ts";
import type { Task, TaskStatus, EventData as EventItem, EventStatus, Section, User, Report } from "../api/apiClient.ts";

const API_BASE = "http://localhost:8000";
function _secFetch(method: string, path: string, body?: any) {
  const t = localStorage.getItem("access_token") || "";
  const headers: Record<string,string> = { "Content-Type": "application/json" };
  if (t) headers["Authorization"] = "Bearer " + t;
  return fetch(API_BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",   // отключаем кэш браузера для всех запросов
  });
}
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
// F-9: МОДАЛКА НАЗНАЧЕНИЯ ОТВЕТСТВЕННОГО
// -----------------------------------------------------------
const AssignUserModal = ({
  title: modalTitle,
  onClose,
  onAssign,
}: {
  title: string;
  onClose: () => void;
  onAssign: (userId: string) => void;
}) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);

  const handleSearch = async (q: string) => {
    setQuery(q);
    if (q.length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      const res = await usersAPI.search(q);
      setResults(res.data || []);
    } catch { setResults([]); }
    finally { setSearching(false); }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(13,27,62,0.5)",
      backdropFilter: "blur(4px)", display: "flex", alignItems: "center",
      justifyContent: "center", zIndex: 3000,
    }}>
      <div style={{
        background: "white", borderRadius: 20, padding: 28, width: "100%",
        maxWidth: 440, boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
        borderTop: "5px solid var(--primary)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ fontWeight: 900, margin: 0, color: "var(--primary-dark)", fontSize: 16 }}>{modalTitle}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#777" }}>×</button>
        </div>
        <input
          type="text"
          placeholder="Поиск по ФИО..."
          value={query}
          onChange={e => handleSearch(e.target.value)}
          autoFocus
          style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1.5px solid var(--border)", fontSize: 14, boxSizing: "border-box", fontFamily: "Nunito, sans-serif", outline: "none", marginBottom: 12 }}
        />
        {searching && <div style={{ color: "#777", fontSize: 13, textAlign: "center", padding: 8 }}>Поиск...</div>}
        {results.length > 0 && (
          <div style={{ maxHeight: 240, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 10 }}>
            {results.map(u => (
              <div key={u.id} onClick={() => { onAssign(u.id); onClose(); }}
                style={{ padding: "12px 16px", cursor: "pointer", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12, transition: "background 0.15s" }}
                onMouseOver={e => (e.currentTarget.style.background = "#f0f7ff")}
                onMouseOut={e => (e.currentTarget.style.background = "white")}>
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
        {query.length >= 2 && results.length === 0 && !searching && (
          <div style={{ color: "#aaa", textAlign: "center", padding: 16, fontSize: 13 }}>Никого не найдено</div>
        )}
      </div>
    </div>
  );
};

// -----------------------------------------------------------
// F-7: ТАБ "СЕКЦИИ И КУРАТОРЫ" — полный CRUD
// -----------------------------------------------------------
const SectionsTab = ({ eventId, demoMode }: { eventId: string; demoMode: boolean }) => {
  const [sections, setSections] = useState<Section[]>([]);
  const [reports, setReports] = useState<Record<string, Report[]>>({}); // keyed by section_id
  const [loading, setLoading] = useState(true);
  const [assignSection, setAssignSection] = useState<string | null>(null);
  const [assignSpeakerReport, setAssignSpeakerReport] = useState<Report | null>(null);
  // Итоговые отчёты кураторов: sectionId → текст отчёта
  const [curatorReports, setCuratorReports] = useState<Record<string, string>>({});
  // Средние оценки: reportId → {average, count}
  const [feedbacks, setFeedbacks] = useState<Record<string, { average: number; count: number }>>({});

  // Модалка создания/редактирования секции
  const [secForm, setSecForm] = useState<{ open: boolean; section?: Section }>({ open: false });
  // Модалка создания/редактирования доклада
  const [repForm, setRepForm] = useState<{ open: boolean; report?: Report; sectionId: string }>({ open: false, sectionId: "" });
  // Подтверждение удаления
  const [delSec, setDelSec] = useState<Section | null>(null);
  const [delRep, setDelRep] = useState<Report | null>(null);
  // После создания секции — предложить назначить куратора сразу
  const [pendingCuratorSectionId, setPendingCuratorSectionId] = useState<string | null>(null);
  // Кэш имён пользователей: id → full_name
  const [usersMap, setUsersMap] = useState<Record<string, string>>({});

  const inp: React.CSSProperties = { width: "100%", padding: "9px 12px", borderRadius: 8, border: "1.5px solid var(--border)", fontSize: 13, fontFamily: "Nunito, sans-serif", boxSizing: "border-box", outline: "none", marginBottom: 10 };
  const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 3 };

  const reload = async () => {
    if (demoMode) { setLoading(false); return; }
    setLoading(true);
    try {
      // Используем _secFetch напрямую (без axios-кэша)
      const secRes = await _secFetch("GET", `/api/events/${eventId}/sections`);
      if (!secRes.ok) { setLoading(false); return; }
      const secs: Section[] = await secRes.json();
      setSections(secs);

      // Загружаем доклады для каждой секции последовательно
      const recs: Record<string, Report[]> = {};
      for (const s of secs) {
        try {
          const r = await _secFetch("GET", `/api/sections/${s.id}/reports`);
          const data = r.ok ? await r.json() : [];
          recs[s.id] = Array.isArray(data) ? data : [];
          console.log(`[SectionsTab] section ${s.id} reports:`, recs[s.id].length, recs[s.id]);
        } catch (e) {
          console.error(`[SectionsTab] failed to load reports for section ${s.id}:`, e);
          recs[s.id] = [];
        }
      }
      console.log("[SectionsTab] all reports loaded:", recs);
      setReports({ ...recs });

      // Загружаем имена, итоговые отчёты и оценки параллельно
      try {
        const ur = await _secFetch("GET", "/api/users/search?q=");
        if (ur.ok) {
          const allUsers: any[] = await ur.json();
          const map: Record<string, string> = {};
          allUsers.forEach((u: any) => { map[u.id] = u.full_name; });
          setUsersMap(map);
        }
      } catch {}

      // Итоговые отчёты кураторов
      const crMap: Record<string, string> = {};
      await Promise.all(secs.map(async (s: Section) => {
        try {
          const cr = await _secFetch("GET", `/api/sections/${s.id}/curator-report`);
          if (cr.ok) { const d = await cr.json(); crMap[s.id] = d.text || ""; }
        } catch {}
      }));
      setCuratorReports(crMap);

      // Средние оценки докладов
      const fbMap: Record<string, { average: number; count: number }> = {};
      const allReps = Object.values(recs).flat() as any[];
      await Promise.all(allReps.map(async (r: any) => {
        try {
          const fr = await _secFetch("GET", `/api/reports/${r.id}/feedback`);
          if (fr.ok) { const d = await fr.json(); fbMap[r.id] = { average: d.average || 0, count: d.count || 0 }; }
          else fbMap[r.id] = { average: 0, count: 0 };
        } catch { fbMap[r.id] = { average: 0, count: 0 }; }
      }));
      setFeedbacks(fbMap);

    } catch (e) {
      console.error("reload error:", e);
    }
    finally { setLoading(false); }
  };

  useEffect(() => { reload(); }, [eventId, demoMode]);

  // Перезагружаем данные когда вкладка браузера снова становится активной
  useEffect(() => {
    const handleVisibility = () => { if (document.visibilityState === "visible") reload(); };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  // ── Куратор ──
  const handleAssignCurator = async (userId: string) => {
    const targetSection = assignSection || pendingCuratorSectionId;
    if (!targetSection) return;
    try {
      const r = await _secFetch("POST", `/api/events/${eventId}/curators`, { user_id: userId, section_id: targetSection });
      if (!r.ok) { const err = await r.json().catch(() => ({})); alert(err?.detail || `Ошибка ${r.status}`); return; }
      await reload();
    } catch (e: any) { alert(e?.message || "Не удалось назначить куратора"); }
    setAssignSection(null);
    setPendingCuratorSectionId(null);
  };

  const handleRemoveCurator = async (curatorId: string) => {
    try { await eventsAPI.removeCurator(eventId, curatorId); await reload(); }
    catch (e: any) { alert(e?.response?.data?.detail || "Не удалось снять куратора"); }
  };

  // ── Секции ──
  const handleSaveSec = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body: any = {};
    ["title","format","location","section_start","section_end","tech_notes"].forEach(k => { const v = fd.get(k); if (v) body[k] = String(v); });
    try {
      let createdSectionId: string | null = null;
      if (secForm.section) {
        const r = await _secFetch("PATCH", `/api/sections/${secForm.section.id}`, body);
        if (!r.ok) { const err = await r.json().catch(() => ({})); alert(err?.detail || `Ошибка ${r.status}`); return; }
      } else {
        const r = await _secFetch("POST", `/api/events/${eventId}/sections`, body);
        if (!r.ok) { const err = await r.json().catch(() => ({})); alert(err?.detail || `Ошибка ${r.status}`); return; }
        const created = await r.json();
        createdSectionId = created?.id || null;
      }
      setSecForm({ open: false });
      await reload();
      // Если создали новую секцию — предложить сразу назначить куратора
      if (createdSectionId) {
        setPendingCuratorSectionId(createdSectionId);
      }
    } catch (err: any) { alert(err?.message || "Сетевая ошибка"); }
  };

  const handleDeleteSec = async () => {
    if (!delSec) return;
    try {
      const r = await _secFetch("DELETE", `/api/sections/${delSec.id}`);
      if (!r.ok && r.status !== 204) { const err = await r.json().catch(() => ({})); alert(err?.detail || `Ошибка ${r.status}`); return; }
      setDelSec(null); await reload();
    } catch (e: any) { alert(e?.message || "Ошибка удаления"); }
  };

  // ── Доклады ──
  const handleSaveRep = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body: any = {};
    ["title","description","presentation_format","start_time","end_time"].forEach(k => { const v = fd.get(k); if (v) body[k] = String(v); });
    try {
      let r: Response;
      if (repForm.report) {
        r = await _secFetch("PATCH", `/api/reports/${repForm.report.id}`, body);
      } else {
        r = await _secFetch("POST", `/api/sections/${repForm.sectionId}/reports`, body);
      }
      if (!r.ok) { const err = await r.json().catch(() => ({})); alert(err?.detail || `Ошибка ${r.status}`); return; }
      setRepForm({ open: false, sectionId: "" });
      await reload();
    } catch (e: any) { alert(e?.message || "Ошибка"); }
  };

  const handleDeleteRep = async () => {
    if (!delRep) return;
    try {
      const r = await _secFetch("DELETE", `/api/reports/${delRep.id}`);
      if (!r.ok && r.status !== 204) { const err = await r.json().catch(() => ({})); alert(err?.detail || `Ошибка ${r.status}`); return; }
      setDelRep(null); await reload();
    } catch (e: any) { alert(e?.message || "Ошибка удаления"); }
  };

  const handleAssignSpeaker = async (userId: string) => {
    if (!assignSpeakerReport) return;
    try {
      const r = await _secFetch("POST", `/api/reports/${assignSpeakerReport.id}/speaker`, { user_id: userId });
      if (!r.ok) { const err = await r.json().catch(() => ({})); alert(err?.detail || `Ошибка ${r.status}`); return; }
      await reload();
    } catch (e: any) { alert(e?.message || "Не удалось назначить спикера"); }
    setAssignSpeakerReport(null);
  };

  if (loading) return <div style={{ textAlign: "center", padding: 40, color: "#999" }}>Загрузка секций...</div>;

  return (
    <div>
      {/* Шапка с кнопкой создания */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 10 }}>
        <h2 style={{ fontWeight: 900, margin: 0, fontSize: 18, color: "var(--primary-dark)" }}>📂 Секции и кураторы</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => reload()} style={{ padding: "9px 14px", background: "var(--bg-medium)", color: "var(--primary)", border: "1px solid var(--border)", borderRadius: 100, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>
            🔄 Обновить
          </button>
          {!demoMode && (
            <button onClick={() => setSecForm({ open: true })} style={{ padding: "9px 20px", background: "var(--primary)", color: "white", border: "none", borderRadius: 100, fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>
              ✚ Новая секция
            </button>
          )}
        </div>
      </div>

      {sections.length === 0 ? (
        <div style={{ textAlign: "center", padding: 48, color: "var(--text-muted)" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📂</div>
          <div style={{ fontWeight: 800, fontSize: 16, color: "var(--primary-dark)", marginBottom: 6 }}>Нет секций</div>
          <div style={{ fontSize: 14, marginBottom: 20 }}>Создайте первую секцию для этого мероприятия</div>
          {!demoMode && (
            <button onClick={() => setSecForm({ open: true })} style={{ padding: "12px 28px", background: "var(--primary)", color: "white", border: "none", borderRadius: 100, fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>
              ✚ Создать секцию
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          {sections.map((s: Section) => {
            const secReports: Report[] = reports[s.id] || [];
            return (
              <div key={s.id} style={{ background: "white", borderRadius: 16, border: "1.5px solid var(--border)", overflow: "hidden", boxShadow: "0 2px 10px rgba(74,89,138,0.07)" }}>
                {/* Заголовок секции */}
                <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", background: "#f8fbff" }}>
                  <div>
                    <div style={{ fontWeight: 900, fontSize: 15, color: "var(--primary-dark)" }}>📌 {s.title}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3, display: "flex", gap: 10, flexWrap: "wrap" }}>
                      {s.location && <span>📍 {s.location}</span>}
                      {s.format && <span>📋 {s.format}</span>}
                      {s.section_start && <span>🕐 {new Date(s.section_start).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>}
                    </div>
                    {/* Куратор */}
                    <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase" }}>Куратор:</span>
                      {s.curator_id ? (
                        <>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--primary)", padding: "2px 8px", background: "#e8f0fe", borderRadius: 100 }}>
                            {usersMap[s.curator_id] || (s as any).curator_name || s.curator_id.slice(0, 8)}
                          </span>
                          {!demoMode && (
                            <button onClick={() => handleRemoveCurator(s.curator_id!)} style={{ padding: "2px 8px", background: "#fff1f1", color: "#ef4444", border: "1px solid #fecaca", borderRadius: 100, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>✕</button>
                          )}
                        </>
                      ) : (
                        <button onClick={() => setAssignSection(s.id)} style={{ padding: "3px 10px", background: "var(--primary)", color: "white", border: "none", borderRadius: 100, fontSize: 11, fontWeight: 800, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>Назначить</button>
                      )}
                    </div>
                  </div>
                  {!demoMode && (
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button onClick={() => setSecForm({ open: true, section: s })} style={{ padding: "5px 12px", background: "var(--bg-medium)", color: "var(--primary)", border: "1px solid var(--border)", borderRadius: 100, fontWeight: 700, fontSize: 11, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>✏️ Изменить</button>
                      <button onClick={() => setDelSec(s)} style={{ padding: "5px 12px", background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 100, fontWeight: 700, fontSize: 11, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>🗑</button>
                    </div>
                  )}
                </div>

                {/* Прогресс */}
                <div style={{ padding: "8px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1, height: 4, background: "#e2e8f0", borderRadius: 100, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${s.readiness_percent}%`, background: s.readiness_percent >= 75 ? "#16a34a" : "var(--primary)", borderRadius: 100 }} />
                  </div>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700 }}>Готовность: {s.readiness_percent}%</span>
                </div>

                {/* Итоговый отчёт куратора */}
                {curatorReports[s.id] && (
                  <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--border)", background: "#f0fdf4" }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#16a34a", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>
                      📝 Итоговый отчёт куратора
                    </div>
                    <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                      {curatorReports[s.id].length > 300
                        ? curatorReports[s.id].slice(0, 300) + "..."
                        : curatorReports[s.id]}
                    </div>
                  </div>
                )}

                {/* Доклады */}
                <div style={{ padding: "12px 18px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: "#475569" }}>Доклады ({secReports.length})</span>
                    {!demoMode && (
                      <button onClick={() => setRepForm({ open: true, sectionId: s.id })} style={{ padding: "4px 10px", background: "#ecfdf5", color: "#10b981", border: "1px solid #a7f3d0", borderRadius: 100, fontWeight: 700, fontSize: 11, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>+ Доклад</button>
                    )}
                  </div>
                  {secReports.length === 0 ? (
                    <div style={{ color: "#94a3b8", fontSize: 12, padding: "6px 0" }}>Докладов нет</div>
                  ) : (
                    <div style={{ display: "grid", gap: 6 }}>
                      {secReports.map((r: Report) => (
                        <div key={r.id} style={{ background: "#f8fafc", borderRadius: 10, padding: "8px 12px", border: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 800, fontSize: 13, color: "var(--primary-dark)" }}>{r.title}</div>
                            <div style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", gap: 8, marginTop: 2, flexWrap: "wrap" }}>
                              {r.start_time && <span>🕐 {new Date(r.start_time).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</span>}
                              {r.presentation_format && <span style={{ padding: "1px 6px", borderRadius: 100, background: "#e8f0fe", color: "var(--primary)", fontSize: 10, fontWeight: 800 }}>{r.presentation_format}</span>}
                              {r.speaker_id
                                ? <span style={{ color: r.speaker_confirmed ? "#16a34a" : "#92400e" }}>🎤 {(r as any).speaker_name || usersMap[r.speaker_id] || "Спикер"} {r.speaker_confirmed ? "✅" : "⏳"}</span>
                                : <span style={{ color: "#dc2626" }}>🎤 Спикер не назначен</span>}
                                  {feedbacks[r.id]?.count > 0 && <span style={{ color: "#f59e0b", fontWeight: 800, fontSize: 11 }}>★ {feedbacks[r.id].average.toFixed(1)} ({feedbacks[r.id].count})</span>}
                            </div>
                          </div>
                          {!demoMode && (
                            <div style={{ display: "flex", gap: 4 }}>
                              <button onClick={() => setAssignSpeakerReport(r)} style={{ padding: "3px 8px", background: "var(--bg-medium)", color: "var(--primary)", border: "1px solid var(--border)", borderRadius: 100, fontWeight: 700, fontSize: 10, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>🎤 {r.speaker_id ? "Сменить" : "Спикер"}</button>
                              <button onClick={() => setRepForm({ open: true, report: r, sectionId: s.id })} style={{ padding: "3px 7px", background: "#f1f5f9", color: "#64748b", border: "none", borderRadius: 100, fontWeight: 700, fontSize: 10, cursor: "pointer" }}>✏️</button>
                              <button onClick={() => setDelRep(r)} style={{ padding: "3px 7px", background: "#fef2f2", color: "#dc2626", border: "none", borderRadius: 100, fontWeight: 700, fontSize: 10, cursor: "pointer" }}>🗑</button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── МОДАЛКА СЕКЦИЯ ── */}
      {secForm.open && !demoMode && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(13,27,62,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000 }}>
          <div style={{ background: "white", borderRadius: 20, padding: 28, width: "100%", maxWidth: 500, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", borderTop: "5px solid var(--primary)", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
              <h3 style={{ fontWeight: 900, margin: 0, fontSize: 16 }}>{secForm.section ? "Редактировать секцию" : "Новая секция"}</h3>
              <button onClick={() => setSecForm({ open: false })} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer" }}>×</button>
            </div>
            <form onSubmit={handleSaveSec}>
              <label style={lbl}>Название *</label>
              <input name="title" required defaultValue={secForm.section?.title || ""} autoFocus style={inp} placeholder="Название секции" />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={lbl}>Формат</label>
                  <select name="format" defaultValue={secForm.section?.format || ""} style={inp}>
                    <option value="">Не выбран</option>
                    <option value="SEQUENTIAL">Последовательный</option>
                    <option value="ROUNDTABLE">Круглый стол</option>
                    <option value="PANEL">Панельная дискуссия</option>
                    <option value="WORKSHOP">Воркшоп</option>
                  </select>
                </div>
                <div>
                  <label style={lbl}>Локация</label>
                  <input name="location" defaultValue={secForm.section?.location || ""} style={inp} placeholder="Зал A..." />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div><label style={lbl}>Начало</label><input type="datetime-local" name="section_start" defaultValue={secForm.section?.section_start ? String(secForm.section.section_start).slice(0,16) : ""} style={inp} /></div>
                <div><label style={lbl}>Конец</label><input type="datetime-local" name="section_end" defaultValue={secForm.section?.section_end ? String(secForm.section.section_end).slice(0,16) : ""} style={inp} /></div>
              </div>
              <label style={lbl}>Технические заметки</label>
              <textarea name="tech_notes" defaultValue={secForm.section?.tech_notes || ""} rows={3} style={{ ...inp, resize: "vertical" }} placeholder="Оборудование, требования..." />
              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <button type="submit" style={{ flex: 1, padding: 11, background: "var(--primary)", color: "white", border: "none", borderRadius: 100, fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>
                  {secForm.section ? "Сохранить" : "Создать секцию"}
                </button>
                <button type="button" onClick={() => setSecForm({ open: false })} style={{ flex: 1, padding: 11, background: "#f1f5f9", color: "#475569", border: "none", borderRadius: 100, fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>Отмена</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── МОДАЛКА ДОКЛАД ── */}
      {repForm.open && !demoMode && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(13,27,62,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000 }}>
          <div style={{ background: "white", borderRadius: 20, padding: 28, width: "100%", maxWidth: 480, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", borderTop: "5px solid #10b981", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
              <h3 style={{ fontWeight: 900, margin: 0, fontSize: 16 }}>{repForm.report ? "Редактировать доклад" : "Новый доклад"}</h3>
              <button onClick={() => setRepForm({ open: false, sectionId: "" })} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer" }}>×</button>
            </div>
            <form onSubmit={handleSaveRep}>
              <label style={lbl}>Название *</label>
              <input name="title" required defaultValue={repForm.report?.title || ""} autoFocus style={inp} placeholder="Название доклада" />
              <label style={lbl}>Описание</label>
              <textarea name="description" defaultValue={repForm.report?.description || ""} rows={3} style={{ ...inp, resize: "vertical" }} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div><label style={lbl}>Начало</label><input type="datetime-local" name="start_time" defaultValue={repForm.report?.start_time ? String(repForm.report.start_time).slice(0,16) : ""} style={inp} /></div>
                <div><label style={lbl}>Конец</label><input type="datetime-local" name="end_time" defaultValue={repForm.report?.end_time ? String(repForm.report.end_time).slice(0,16) : ""} style={inp} /></div>
              </div>
              <label style={lbl}>Формат</label>
              <select name="presentation_format" defaultValue={repForm.report?.presentation_format || ""} style={inp}>
                <option value="">Не выбран</option>
                <option value="OFFLINE">Офлайн</option>
                <option value="ONLINE">Онлайн</option>
              </select>
              <div style={{ display: "flex", gap: 10 }}>
                <button type="submit" style={{ flex: 1, padding: 11, background: "#10b981", color: "white", border: "none", borderRadius: 100, fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>
                  {repForm.report ? "Сохранить" : "Создать доклад"}
                </button>
                <button type="button" onClick={() => setRepForm({ open: false, sectionId: "" })} style={{ flex: 1, padding: 11, background: "#f1f5f9", color: "#475569", border: "none", borderRadius: 100, fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>Отмена</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── УДАЛИТЬ СЕКЦИЮ ── */}
      {delSec && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(13,27,62,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3100 }}>
          <div style={{ background: "white", borderRadius: 20, padding: 28, width: "100%", maxWidth: 400, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", borderTop: "5px solid #ef4444" }}>
            <h3 style={{ fontWeight: 900, margin: "0 0 10px", color: "#991b1b" }}>🗑 Удалить секцию?</h3>
            <p style={{ fontSize: 14, color: "#475569", marginBottom: 22 }}>«{delSec.title}» и все её доклады будут удалены.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={handleDeleteSec} style={{ flex: 1, padding: 11, background: "#ef4444", color: "white", border: "none", borderRadius: 100, fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>Удалить</button>
              <button onClick={() => setDelSec(null)} style={{ flex: 1, padding: 11, background: "#f1f5f9", color: "#475569", border: "none", borderRadius: 100, fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      {/* ── УДАЛИТЬ ДОКЛАД ── */}
      {delRep && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(13,27,62,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3100 }}>
          <div style={{ background: "white", borderRadius: 20, padding: 28, width: "100%", maxWidth: 400, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", borderTop: "5px solid #ef4444" }}>
            <h3 style={{ fontWeight: 900, margin: "0 0 10px", color: "#991b1b" }}>🗑 Удалить доклад?</h3>
            <p style={{ fontSize: 14, color: "#475569", marginBottom: 22 }}>«{delRep.title}» будет удалён.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={handleDeleteRep} style={{ flex: 1, padding: 11, background: "#ef4444", color: "white", border: "none", borderRadius: 100, fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>Удалить</button>
              <button onClick={() => setDelRep(null)} style={{ flex: 1, padding: 11, background: "#f1f5f9", color: "#475569", border: "none", borderRadius: 100, fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      {/* ── НАЗНАЧИТЬ КУРАТОРА ── */}
      {assignSection && (
        <AssignUserModal title="Назначить куратора" onClose={() => setAssignSection(null)} onAssign={handleAssignCurator} />
      )}

      {/* ── НАЗНАЧИТЬ КУРАТОРА НОВОЙ СЕКЦИИ ── */}
      {pendingCuratorSectionId && !assignSection && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(13,27,62,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000 }}>
          <div style={{ background: "white", borderRadius: 20, padding: 28, width: "100%", maxWidth: 440, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", borderTop: "5px solid #10b981" }}>
            <h3 style={{ fontWeight: 900, margin: "0 0 8px", fontSize: 17, color: "var(--primary-dark)" }}>✅ Секция создана!</h3>
            <p style={{ fontSize: 14, color: "#475569", marginBottom: 20 }}>Назначить куратора для этой секции прямо сейчас?</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => { setAssignSection(pendingCuratorSectionId); setPendingCuratorSectionId(null); }}
                style={{ flex: 1, padding: 11, background: "var(--primary)", color: "white", border: "none", borderRadius: 100, fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>
                Назначить куратора
              </button>
              <button
                onClick={() => setPendingCuratorSectionId(null)}
                style={{ flex: 1, padding: 11, background: "#f1f5f9", color: "#475569", border: "none", borderRadius: 100, fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>
                Пропустить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── НАЗНАЧИТЬ СПИКЕРА ── */}
      {assignSpeakerReport && (
        <AssignUserModal title={`Спикер: «${assignSpeakerReport.title}»`} onClose={() => setAssignSpeakerReport(null)} onAssign={handleAssignSpeaker} />
      )}
    </div>
  );
};

// -----------------------------------------------------------
// F-8: ТАБ "СПИКЕРЫ"
// -----------------------------------------------------------
const SpeakersTab = ({ eventId, demoMode }: { eventId: string; demoMode: boolean }) => {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignReport, setAssignReport] = useState<string | null>(null);

  const loadProgram = async () => {
    try {
      const res = await participantsAPI.getProgram(eventId);
      const program = res.data;
      const allReports: any[] = [];
      for (const section of (program?.sections || [])) {
        for (const report of (section.reports || [])) {
          allReports.push({ ...report, section_title: section.title });
        }
      }
      setReports(allReports);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (demoMode) { setLoading(false); return; }
    loadProgram();
  }, [eventId, demoMode]);

  const handleAssignSpeaker = async (userId: string) => {
    if (!assignReport) return;
    try {
      await reportsAPI.assignSpeaker(assignReport, { speaker_id: userId });
      await loadProgram();
    } catch (e: any) {
      alert(e?.response?.data?.detail || "Не удалось назначить спикера");
    }
    setAssignReport(null);
  };

  if (loading) return <div style={{ textAlign: "center", padding: 40, color: "#999" }}>Загрузка докладов...</div>;

  if (reports.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: 48, color: "var(--text-muted)" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🎤</div>
        <div style={{ fontWeight: 800, fontSize: 16, color: "var(--primary-dark)", marginBottom: 6 }}>Нет докладов</div>
        <div style={{ fontSize: 14 }}>Создайте доклады в секциях мероприятия.</div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "grid", gap: 12 }}>
        {reports.map((r: any) => (
          <div key={r.id} style={{
            background: "white", borderRadius: 14, padding: "16px 20px",
            boxShadow: "0 2px 10px rgba(74,89,138,0.07)", border: "1.5px solid var(--border)",
            display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: "var(--primary-dark)", marginBottom: 4 }}>{r.title}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>📂 {r.section_title}</div>
              {r.start_time && (
                <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>
                  🕐 {new Date(r.start_time).toLocaleString("ru-RU")}
                </div>
              )}
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              {r.speaker_id ? (
                <div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--primary)" }}>
                    🎤 {r.speaker_name || r.speaker_id.slice(0, 8)}
                  </span>
                  <span style={{
                    marginLeft: 8, display: "inline-block", padding: "2px 8px", borderRadius: 100,
                    fontSize: 10, fontWeight: 800,
                    background: r.speaker_confirmed ? "#f0fdf4" : "#fffbeb",
                    color: r.speaker_confirmed ? "#16a34a" : "#d97706",
                  }}>
                    {r.speaker_confirmed ? "✅" : "⏳"}
                  </span>
                </div>
              ) : (
                <button onClick={() => setAssignReport(r.id)} style={{
                  padding: "6px 14px", background: "var(--primary)", color: "white",
                  border: "none", borderRadius: 100, fontSize: 12, fontWeight: 800, cursor: "pointer",
                  fontFamily: "Nunito, sans-serif",
                }}>Назначить спикера</button>
              )}
            </div>
          </div>
        ))}
      </div>
      {assignReport && (
        <AssignUserModal title="Назначить спикера" onClose={() => setAssignReport(null)} onAssign={handleAssignSpeaker} />
      )}
    </div>
  );
};

// -----------------------------------------------------------
// КАНБАН МЕРОПРИЯТИЯ (обновлён: F-9 — кнопка назначить ответственного)
// -----------------------------------------------------------
const EventKanban = ({
  tasks, onUpdateStatus, onDeleteTask, onAddTask, demoMode, onAssignTask,
}: {
  tasks: Task[];
  onUpdateStatus: (id: string, status: TaskStatus) => void;
  onDeleteTask: (id: string) => void;
  onAddTask: () => void;
  demoMode: boolean;
  onAssignTask?: (taskId: string) => void;
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
                    <div style={{ fontSize: 12, color: "#777", marginBottom: 6, fontWeight: 600 }}>
                      📅 Дедлайн: {task.due_date}
                    </div>
                  )}

                  {/* F-9: Ответственный */}
                  <div style={{ fontSize: 12, color: "#777", marginBottom: 8, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                    👤 {task.assigned_to_name || (task.assigned_to ? task.assigned_to.slice(0, 8) : "Не назначен")}
                    {onAssignTask && (
                      <button onClick={() => onAssignTask(task.id)} style={{
                        marginLeft: "auto", padding: "2px 8px", background: "#e8f0fe", color: "var(--primary)",
                        border: "1px solid #bfdbfe", borderRadius: 100, fontSize: 10, fontWeight: 800, cursor: "pointer",
                        fontFamily: "Nunito, sans-serif",
                      }}>Назначить</button>
                    )}
                  </div>

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

  const [activeTab, setActiveTab] = useState<"kanban" | "info" | "sections" | "speakers">("kanban");
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [showEditEvent, setShowEditEvent] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [assignTaskId, setAssignTaskId] = useState<string | null>(null);

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

  // F-9: Назначение ответственного на задачу
  const handleAssignTask = async (userId: string) => {
    if (!assignTaskId) return;
    if (demoMode) {
      setTasks(prev => prev.map(t => t.id === assignTaskId ? { ...t, assigned_to: userId, assigned_to_name: "Назначен" } : t));
      setAssignTaskId(null);
      return;
    }
    try {
      await tasksAPI.assign(assignTaskId, userId);
      // Reload tasks
      if (id) {
        const res = await tasksAPI.getByEvent(id);
        setTasks(res.data || []);
      }
    } catch (e: any) {
      alert(e?.response?.data?.detail || "Не удалось назначить ответственного");
    }
    setAssignTaskId(null);
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
      await eventsAPI.delete(id);
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
    <div style={{ padding: "0 0 40px", minHeight: "100vh", background: "#E2F5FB", fontFamily: "Nunito, sans-serif" }}>
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
          { id: "sections", label: "📂 Секции и кураторы" },
          { id: "speakers", label: "🎤 Спикеры" },
          { id: "info", label: "ℹ️ Информация" },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} style={{
            padding: "8px 20px", border: "none", borderRadius: 8,
            fontWeight: 800, fontSize: 13, cursor: "pointer",
            background: activeTab === tab.id ? "#4A598A" : "white",
            color: activeTab === tab.id ? "white" : "#475569",
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
          onAssignTask={!demoMode ? (taskId: string) => setAssignTaskId(taskId) : undefined}
        />
      )}

      {/* СЕКЦИИ И КУРАТОРЫ */}
      {activeTab === "sections" && (
        <SectionsTab key={`sections-${id}`} eventId={id!} demoMode={demoMode} />
      )}

      {/* СПИКЕРЫ */}
      {activeTab === "speakers" && (
        <SpeakersTab eventId={id!} demoMode={demoMode} />
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

      {/* F-9: Модалка назначения ответственного на задачу */}
      {assignTaskId && (
        <AssignUserModal
          title="Назначить ответственного"
          onClose={() => setAssignTaskId(null)}
          onAssign={handleAssignTask}
        />
      )}
    </div>
  );
}

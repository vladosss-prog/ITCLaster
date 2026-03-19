import React, { useCallback, useEffect, useState } from "react";
import {
  eventsAPI,
  sectionsAPI,
  reportsAPI,
  participantsAPI,
  usersAPI,
} from "../../api/apiClient";
import type {
  User,
  Section,
  Report,
  Comment,
  SectionReportOut,
} from "../../api/apiClient";
import { Spinner } from "../ui/Spinner";
import { ErrorBlock } from "../ui/ErrorBlock";
import { EmptyState } from "../ui/EmptyState";

// -----------------------------------------------------------
// DEMO DATA
// -----------------------------------------------------------
const DEMO_SECTIONS: Section[] = [
  {
    id: "s1", event_id: "e1", title: "Секция ИнфоБез",
    curator_id: "u3", format: "SEQUENTIAL",
    location: "Зал А", readiness_percent: 60,
    section_start: "2026-03-19T10:00:00Z",
    section_end: "2026-03-19T14:00:00Z",
  },
  {
    id: "s2", event_id: "e1", title: "Секция ML",
    curator_id: "u3", format: "ROUNDTABLE",
    location: "Зал Б", readiness_percent: 40,
  },
];

const DEMO_REPORTS: Report[] = [
  {
    id: "r1", section_id: "s1", title: "Угрозы безопасности 2026",
    speaker_id: "u2", speaker_name: "Иван Участников",
    speaker_confirmed: true, presentation_format: "OFFLINE",
    start_time: "2026-03-19T10:00:00Z", end_time: "2026-03-19T10:30:00Z",
    description: "Обзор актуальных угроз",
  },
  {
    id: "r2", section_id: "s1", title: "Защита данных в облаке",
    speaker_id: null, speaker_confirmed: false,
    start_time: "2026-03-19T10:30:00Z", end_time: "2026-03-19T11:00:00Z",
    description: "Спикер не назначен",
  },
];

const DEMO_COMMENTS: Comment[] = [
  {
    id: "c1", report_id: "r1", author_id: "u2",
    author_name: "Иван Участников",
    text: "Отличный доклад! Есть вопрос по шифрованию.",
    created_at: "2026-03-19T10:35:00Z",
  },
];

// -----------------------------------------------------------
// ТИПЫ ДЛЯ ФОРМ
// -----------------------------------------------------------
interface SectionFormData {
  title: string;
  format: string;
  location: string;
  section_start: string;
  section_end: string;
  tech_notes: string;
}

interface ReportFormData {
  title: string;
  description: string;
  presentation_format: string;
  start_time: string;
  end_time: string;
}

const EMPTY_SECTION_FORM: SectionFormData = {
  title: "", format: "", location: "",
  section_start: "", section_end: "", tech_notes: "",
};

const EMPTY_REPORT_FORM: ReportFormData = {
  title: "", description: "", presentation_format: "",
  start_time: "", end_time: "",
};

// -----------------------------------------------------------
// МОДАЛКА: СЕКЦИЯ (создание / редактирование)
// -----------------------------------------------------------
function SectionModal({
  initial,
  eventId,
  onClose,
  onSaved,
  demoMode,
}: {
  initial?: Section;
  eventId: string;
  onClose: () => void;
  onSaved: (section: Section) => void;
  demoMode: boolean;
}) {
  const isEdit = !!initial;
  const [form, setForm] = useState<SectionFormData>(
    initial
      ? {
          title: initial.title,
          format: initial.format || "",
          location: initial.location || "",
          section_start: initial.section_start ? initial.section_start.slice(0, 16) : "",
          section_end: initial.section_end ? initial.section_end.slice(0, 16) : "",
          tech_notes: initial.tech_notes || "",
        }
      : EMPTY_SECTION_FORM
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k: keyof SectionFormData, v: string) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async () => {
    if (!form.title.trim()) { setError("Название обязательно"); return; }
    setSaving(true); setError("");
    const payload = {
      title: form.title.trim(),
      format: form.format || undefined,
      location: form.location || undefined,
      section_start: form.section_start || undefined,
      section_end: form.section_end || undefined,
      tech_notes: form.tech_notes || undefined,
    };

    if (demoMode) {
      const fake: Section = {
        id: initial?.id || `demo-sec-${Date.now()}`,
        event_id: eventId,
        curator_id: "u3",
        readiness_percent: initial?.readiness_percent ?? 0,
        ...payload,
      };
      onSaved(fake);
      return;
    }

    try {
      let res: any;
      if (isEdit && initial) {
        res = await sectionsAPI.update(initial.id, payload);
      } else {
        res = await eventsAPI.createSection(eventId, payload);
      }
      onSaved(res.data);
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Не удалось сохранить секцию");
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "9px 12px", borderRadius: 8,
    border: "1.5px solid var(--border)", fontSize: 13,
    fontFamily: "Nunito, sans-serif", boxSizing: "border-box",
    outline: "none", marginBottom: 12,
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(13,27,62,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000 }}>
      <div style={{ background: "white", borderRadius: 20, padding: 28, width: "100%", maxWidth: 500, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", borderTop: "5px solid var(--primary)", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ fontWeight: 900, margin: 0, color: "var(--primary-dark)", fontSize: 16 }}>
            {isEdit ? `Редактировать: «${initial!.title}»` : "Новая секция"}
          </h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#777" }}>×</button>
        </div>

        {error && <div style={{ background: "#fef2f2", color: "#dc2626", padding: "8px 12px", borderRadius: 8, marginBottom: 12, fontSize: 13 }}>{error}</div>}

        <label style={{ fontSize: 12, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 3 }}>Название *</label>
        <input style={inputStyle} value={form.title} onChange={e => set("title", e.target.value)} placeholder="Название секции" autoFocus />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 3 }}>Формат</label>
            <select style={{ ...inputStyle }} value={form.format} onChange={e => set("format", e.target.value)}>
              <option value="">Не выбран</option>
              <option value="SEQUENTIAL">Последовательный</option>
              <option value="ROUNDTABLE">Круглый стол</option>
              <option value="PANEL">Панельная дискуссия</option>
              <option value="WORKSHOP">Воркшоп</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 3 }}>Локация</label>
            <input style={inputStyle} value={form.location} onChange={e => set("location", e.target.value)} placeholder="Зал A, онлайн..." />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 3 }}>Начало</label>
            <input type="datetime-local" style={inputStyle} value={form.section_start} onChange={e => set("section_start", e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 3 }}>Конец</label>
            <input type="datetime-local" style={inputStyle} value={form.section_end} onChange={e => set("section_end", e.target.value)} />
          </div>
        </div>

        <label style={{ fontSize: 12, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 3 }}>Технические заметки</label>
        <textarea
          style={{ ...inputStyle, resize: "vertical", minHeight: 70 }}
          value={form.tech_notes}
          onChange={e => set("tech_notes", e.target.value)}
          placeholder="Оборудование, требования, замечания..."
        />

        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <button onClick={submit} disabled={saving}
            style={{ flex: 1, padding: "11px", background: "var(--primary)", color: "white", border: "none", borderRadius: 100, fontWeight: 800, fontSize: 13, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1, fontFamily: "Nunito, sans-serif" }}>
            {saving ? "Сохранение..." : isEdit ? "Сохранить изменения" : "Создать секцию"}
          </button>
          <button onClick={onClose}
            style={{ flex: 1, padding: "11px", background: "#f1f5f9", color: "#475569", border: "none", borderRadius: 100, fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------
// МОДАЛКА: ДОКЛАД (создание / редактирование)
// -----------------------------------------------------------
function ReportModal({
  initial,
  sectionId,
  onClose,
  onSaved,
  demoMode,
}: {
  initial?: Report;
  sectionId: string;
  onClose: () => void;
  onSaved: (report: Report) => void;
  demoMode: boolean;
}) {
  const isEdit = !!initial;
  const [form, setForm] = useState<ReportFormData>(
    initial
      ? {
          title: initial.title,
          description: initial.description || "",
          presentation_format: initial.presentation_format || "",
          start_time: initial.start_time ? initial.start_time.slice(0, 16) : "",
          end_time: initial.end_time ? initial.end_time.slice(0, 16) : "",
        }
      : EMPTY_REPORT_FORM
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k: keyof ReportFormData, v: string) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async () => {
    if (!form.title.trim()) { setError("Название обязательно"); return; }
    setSaving(true); setError("");
    const payload = {
      title: form.title.trim(),
      description: form.description || undefined,
      presentation_format: form.presentation_format || undefined,
      start_time: form.start_time || undefined,
      end_time: form.end_time || undefined,
    };

    if (demoMode) {
      const fake: Report = {
        id: initial?.id || `demo-rep-${Date.now()}`,
        section_id: sectionId,
        speaker_id: initial?.speaker_id ?? null,
        speaker_name: initial?.speaker_name,
        speaker_confirmed: initial?.speaker_confirmed ?? false,
        ...payload,
      };
      onSaved(fake);
      return;
    }

    try {
      let res: any;
      if (isEdit && initial) {
        res = await reportsAPI.update(initial.id, payload);
      } else {
        res = await sectionsAPI.createReport(sectionId, payload);
      }
      onSaved(res.data);
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Не удалось сохранить доклад");
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "9px 12px", borderRadius: 8,
    border: "1.5px solid var(--border)", fontSize: 13,
    fontFamily: "Nunito, sans-serif", boxSizing: "border-box",
    outline: "none", marginBottom: 12,
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(13,27,62,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000 }}>
      <div style={{ background: "white", borderRadius: 20, padding: 28, width: "100%", maxWidth: 480, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", borderTop: "5px solid #10b981", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ fontWeight: 900, margin: 0, color: "var(--primary-dark)", fontSize: 16 }}>
            {isEdit ? `Редактировать доклад` : "Новый доклад"}
          </h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#777" }}>×</button>
        </div>

        {error && <div style={{ background: "#fef2f2", color: "#dc2626", padding: "8px 12px", borderRadius: 8, marginBottom: 12, fontSize: 13 }}>{error}</div>}

        <label style={{ fontSize: 12, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 3 }}>Название *</label>
        <input style={inputStyle} value={form.title} onChange={e => set("title", e.target.value)} placeholder="Название доклада" autoFocus />

        <label style={{ fontSize: 12, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 3 }}>Описание</label>
        <textarea
          style={{ ...inputStyle, resize: "vertical", minHeight: 70 }}
          value={form.description}
          onChange={e => set("description", e.target.value)}
          placeholder="Краткое описание доклада..."
        />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 3 }}>Формат</label>
            <select style={{ ...inputStyle }} value={form.presentation_format} onChange={e => set("presentation_format", e.target.value)}>
              <option value="">Не выбран</option>
              <option value="OFFLINE">Офлайн</option>
              <option value="ONLINE">Онлайн</option>
            </select>
          </div>
          <div />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 3 }}>Начало</label>
            <input type="datetime-local" style={inputStyle} value={form.start_time} onChange={e => set("start_time", e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 3 }}>Конец</label>
            <input type="datetime-local" style={inputStyle} value={form.end_time} onChange={e => set("end_time", e.target.value)} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <button onClick={submit} disabled={saving}
            style={{ flex: 1, padding: "11px", background: "#10b981", color: "white", border: "none", borderRadius: 100, fontWeight: 800, fontSize: 13, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1, fontFamily: "Nunito, sans-serif" }}>
            {saving ? "Сохранение..." : isEdit ? "Сохранить" : "Создать доклад"}
          </button>
          <button onClick={onClose}
            style={{ flex: 1, padding: "11px", background: "#f1f5f9", color: "#475569", border: "none", borderRadius: 100, fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------
// МОДАЛКА: ДИАЛОГ ПОДТВЕРЖДЕНИЯ УДАЛЕНИЯ
// -----------------------------------------------------------
function ConfirmDeleteModal({
  title,
  description,
  onConfirm,
  onCancel,
  loading,
}: {
  title: string;
  description: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(13,27,62,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3100 }}>
      <div style={{ background: "white", borderRadius: 20, padding: 28, width: "100%", maxWidth: 400, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", borderTop: "5px solid #ef4444" }}>
        <h3 style={{ fontWeight: 900, margin: "0 0 10px", color: "#991b1b", fontSize: 16 }}>🗑 {title}</h3>
        <p style={{ fontSize: 14, color: "#475569", marginBottom: 22 }}>{description}</p>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onConfirm} disabled={loading}
            style={{ flex: 1, padding: "11px", background: "#ef4444", color: "white", border: "none", borderRadius: 100, fontWeight: 800, fontSize: 13, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1, fontFamily: "Nunito, sans-serif" }}>
            {loading ? "Удаление..." : "Удалить"}
          </button>
          <button onClick={onCancel}
            style={{ flex: 1, padding: "11px", background: "#f1f5f9", color: "#475569", border: "none", borderRadius: 100, fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------
// МОДАЛКА: НАЗНАЧЕНИЕ СПИКЕРА
// -----------------------------------------------------------
function AssignSpeakerModal({
  report,
  onClose,
  onAssigned,
  demoMode,
}: {
  report: Report;
  onClose: () => void;
  onAssigned: (reportId: string, speakerId: string, speakerName: string) => void;
  demoMode: boolean;
}) {
  const DEMO_USERS: User[] = [
    { id: "u5", email: "speaker@it.ru", full_name: "Алексей Спикеров", global_role: "PARTICIPANT" as const },
    { id: "u6", email: "anna@it.ru", full_name: "Анна Докладова", global_role: "PARTICIPANT" as const },
  ];

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const search = async (q: string) => {
    setQuery(q);
    if (q.length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      if (demoMode) {
        setResults(DEMO_USERS.filter(u => u.full_name.toLowerCase().includes(q.toLowerCase())));
      } else {
        const res = await usersAPI.search(q);
        setResults(res.data || []);
      }
    } catch { setResults([]); }
    finally { setSearching(false); }
  };

  const assign = async (user: User) => {
    setSaving(true); setError("");
    if (demoMode) {
      onAssigned(report.id, user.id, user.full_name);
      onClose();
      return;
    }
    try {
      await reportsAPI.assignSpeaker(report.id, { speaker_id: user.id });
      onAssigned(report.id, user.id, user.full_name);
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Не удалось назначить спикера");
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(13,27,62,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000 }}>
      <div style={{ background: "white", borderRadius: 20, padding: 28, width: "100%", maxWidth: 460, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", borderTop: "5px solid var(--primary)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ fontWeight: 900, margin: 0, color: "var(--primary-dark)", fontSize: 16 }}>
            🎤 Назначить спикера
          </h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#777" }}>×</button>
        </div>
        <p style={{ fontSize: 13, color: "#64748b", marginBottom: 14 }}>Доклад: «{report.title}»</p>

        {error && <div style={{ background: "#fef2f2", color: "#dc2626", padding: "8px 12px", borderRadius: 8, marginBottom: 12, fontSize: 13 }}>{error}</div>}

        <input type="text" placeholder="Поиск по ФИО (мин. 2 символа)..."
          value={query} onChange={e => search(e.target.value)} autoFocus
          style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1.5px solid var(--border)", fontSize: 14, boxSizing: "border-box", fontFamily: "Nunito, sans-serif", outline: "none", marginBottom: 12 }}
        />

        {searching && <div style={{ color: "#777", fontSize: 13, textAlign: "center", padding: 8 }}>Поиск...</div>}

        {results.length > 0 && (
          <div style={{ maxHeight: 240, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 10 }}>
            {results.map(u => (
              <div key={u.id} onClick={() => !saving && assign(u)}
                style={{ padding: "12px 16px", cursor: saving ? "not-allowed" : "pointer", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12 }}
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
}

// -----------------------------------------------------------
// МОДАЛКА: ОТВЕТ НА КОММЕНТАРИЙ
// -----------------------------------------------------------
function AnswerCommentModal({
  comment,
  onClose,
  onAnswered,
  demoMode,
}: {
  comment: Comment;
  onClose: () => void;
  onAnswered: (commentId: string, answerText: string) => void;
  demoMode: boolean;
}) {
  const [text, setText] = useState(comment.answer_text || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!text.trim()) { setError("Введите ответ"); return; }
    setSaving(true); setError("");
    if (demoMode) { onAnswered(comment.id, text.trim()); onClose(); return; }
    try {
      await participantsAPI.answerComment(comment.id, { text: text.trim() });
      onAnswered(comment.id, text.trim());
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Не удалось сохранить ответ");
    } finally { setSaving(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(13,27,62,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000 }}>
      <div style={{ background: "white", borderRadius: 20, padding: 28, width: "100%", maxWidth: 480, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", borderTop: "5px solid var(--primary)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ fontWeight: 900, margin: 0, fontSize: 16 }}>Ответить на комментарий</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#777" }}>×</button>
        </div>
        <div style={{ background: "var(--bg-light)", borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 13, color: "var(--text-muted)", fontWeight: 600 }}>
          <b style={{ color: "var(--primary-dark)" }}>{comment.author_name || "Пользователь"}:</b> {comment.text}
        </div>
        {error && <div style={{ background: "#fef2f2", color: "#dc2626", padding: "8px 12px", borderRadius: 8, marginBottom: 12, fontSize: 13 }}>{error}</div>}
        <textarea value={text} onChange={e => setText(e.target.value)} rows={4}
          placeholder="Ваш ответ..." autoFocus
          style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1.5px solid var(--border)", fontSize: 14, boxSizing: "border-box", fontFamily: "Nunito, sans-serif", resize: "vertical", outline: "none", marginBottom: 16 }}
        />
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={submit} disabled={saving}
            style={{ flex: 1, padding: "11px", background: "var(--primary)", color: "white", border: "none", borderRadius: 100, fontWeight: 800, fontSize: 13, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1, fontFamily: "Nunito, sans-serif" }}>
            {saving ? "Сохранение..." : "Ответить"}
          </button>
          <button onClick={onClose}
            style={{ flex: 1, padding: "11px", background: "#f1f5f9", color: "#475569", border: "none", borderRadius: 100, fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------
// ГЛАВНЫЙ КОМПОНЕНТ
// -----------------------------------------------------------
export function CuratorDashboard({
  user,
  onLogout,
  demoMode,
}: {
  user: User;
  onLogout: () => void;
  demoMode: boolean;
}) {
  const [activeTab, setActiveTab] = useState<"sections" | "comments" | "report" | "settings">("sections");

  // Секции
  const [myEventId, setMyEventId] = useState<string>("");  // event_id мероприятия куратора
  const [sections, setSections] = useState<Section[]>([]);
  const [loadingSections, setLoadingSections] = useState(true);
  const [sectionsError, setSectionsError] = useState("");

  // Активная секция и её доклады
  const [activeSectionId, setActiveSectionId] = useState<string>("");
  const [reports, setReports] = useState<Record<string, Report[]>>({}); // keyed by section_id
  const [loadingReports, setLoadingReports] = useState(false);

  // Комментарии
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [selectedReportIdForComments, setSelectedReportIdForComments] = useState<string>("");

  // Итоговый отчёт
  const [sectionReport, setSectionReport] = useState<SectionReportOut | null>(null);
  const [reportText, setReportText] = useState("");
  const [savingReport, setSavingReport] = useState(false);
  const [reportError, setReportError] = useState("");
  const [reportSaved, setReportSaved] = useState(false);

  // Модалки
  const [sectionModal, setSectionModal] = useState<{ open: boolean; section?: Section; eventId: string }>({ open: false, eventId: "" });
  const [reportModal, setReportModal] = useState<{ open: boolean; report?: Report; sectionId: string }>({ open: false, sectionId: "" });
  const [deleteSection, setDeleteSection] = useState<Section | null>(null);
  const [deleteReport, setDeleteReport] = useState<Report | null>(null);
  const [deletingSection, setDeletingSection] = useState(false);
  const [deletingReport, setDeletingReport] = useState(false);
  const [assignSpeakerReport, setAssignSpeakerReport] = useState<Report | null>(null);
  const [answerComment, setAnswerComment] = useState<Comment | null>(null);

  const activeSection = sections.find(s => s.id === activeSectionId);
  const activeReports = reports[activeSectionId] || [];

  // Загрузка секций
  const loadSections = useCallback(async () => {
    setLoadingSections(true);
    setSectionsError("");
    if (demoMode) {
      setSections(DEMO_SECTIONS);
      setActiveSectionId(DEMO_SECTIONS[0]?.id || "");
      setReports({ s1: DEMO_REPORTS.filter(r => r.section_id === "s1"), s2: [] });
      setLoadingSections(false);
      return;
    }
    try {
      const evRes = await eventsAPI.getAll();
      const allSections: Section[] = [];

      for (const ev of evRes.data || []) {
        const secRes = await eventsAPI.getSections(ev.id);
        const evSections = secRes.data || [];

        // Ищем секции через EventMembership куратора (GET /api/events/{id}/curators)
        const mySectionIds = new Set<string>();
        let isCuratorOfEvent = false;
        try {
          const token = localStorage.getItem("access_token") || "";
          const curatorsRes = await fetch(`/api/events/${ev.id}/curators`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          if (curatorsRes.ok) {
            const memberships: Array<{ user_id: string; section_id?: string | null }> = await curatorsRes.json();
            for (const m of memberships) {
              if (m.user_id === user.id) {
                isCuratorOfEvent = true;
                if (m.section_id) {
                  mySectionIds.add(m.section_id);
                } else {
                  // Куратор всего мероприятия (без привязки к секции) — добавляем все секции
                  evSections.forEach((s: Section) => mySectionIds.add(s.id));
                }
              }
            }
          }
        } catch { /* нет прав или ошибка — пропускаем */ }

        // Запоминаем event_id даже если у него нет секций пока
        if (isCuratorOfEvent) setMyEventId(ev.id);

        for (const sec of evSections) {
          // curator_id совпадает ИЛИ нашли через membership
          if (sec.curator_id === user.id || mySectionIds.has(sec.id)) {
            if (!allSections.find(s => s.id === sec.id)) allSections.push(sec);
          }
        }
      }

      setSections(allSections);
      if (allSections.length > 0) setActiveSectionId(allSections[0].id);
    } catch (e: any) {
      setSectionsError(e?.response?.data?.detail || "Не удалось загрузить секции");
    } finally {
      setLoadingSections(false);
    }
  }, [demoMode, user.id]);

  useEffect(() => { loadSections(); }, [loadSections]);

  // Загрузка докладов активной секции
  const loadReports = useCallback(async (sectionId: string) => {
    if (!sectionId || reports[sectionId] !== undefined) return;
    setLoadingReports(true);
    if (demoMode) {
      setReports(prev => ({ ...prev, [sectionId]: DEMO_REPORTS.filter(r => r.section_id === sectionId) }));
      setLoadingReports(false);
      return;
    }
    try {
      const res = await sectionsAPI.getReports(sectionId);
      setReports(prev => ({ ...prev, [sectionId]: res.data || [] }));
    } catch {
      setReports(prev => ({ ...prev, [sectionId]: [] }));
    } finally { setLoadingReports(false); }
  }, [demoMode, reports]);

  useEffect(() => { loadReports(activeSectionId); }, [activeSectionId, loadReports]);

  // Загрузка комментариев
  const loadComments = useCallback(async (reportId: string) => {
    setSelectedReportIdForComments(reportId);
    setLoadingComments(true);
    if (demoMode) {
      setComments(DEMO_COMMENTS.filter(c => c.report_id === reportId));
      setLoadingComments(false);
      return;
    }
    try {
      const res = await reportsAPI.getComments(reportId);
      setComments(res.data || []);
    } catch { setComments([]); }
    finally { setLoadingComments(false); }
  }, [demoMode]);

  // Загрузка итогового отчёта
  useEffect(() => {
    if (!activeSectionId || activeTab !== "report") return;
    if (demoMode) { setSectionReport(null); setReportText(""); return; }
    sectionsAPI.getSectionReport(activeSectionId)
      .then(res => { setSectionReport(res.data); setReportText(res.data.text); })
      .catch(() => { setSectionReport(null); setReportText(""); });
  }, [activeSectionId, activeTab, demoMode]);

  // --- CRUD: СЕКЦИИ ---

  const handleSectionSaved = (section: Section) => {
    setSections(prev => {
      const idx = prev.findIndex(s => s.id === section.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = section;
        return next;
      }
      return [...prev, section];
    });
    setActiveSectionId(section.id);
    setSectionModal({ open: false, eventId: "" });
  };

  const handleDeleteSection = async () => {
    if (!deleteSection) return;
    setDeletingSection(true);
    if (demoMode) {
      setSections(prev => prev.filter(s => s.id !== deleteSection.id));
      if (activeSectionId === deleteSection.id) {
        const remaining = sections.filter(s => s.id !== deleteSection.id);
        setActiveSectionId(remaining[0]?.id || "");
      }
      setDeleteSection(null);
      setDeletingSection(false);
      return;
    }
    try {
      await sectionsAPI.delete(deleteSection.id);
      setSections(prev => prev.filter(s => s.id !== deleteSection.id));
      if (activeSectionId === deleteSection.id) {
        const remaining = sections.filter(s => s.id !== deleteSection.id);
        setActiveSectionId(remaining[0]?.id || "");
      }
      setDeleteSection(null);
    } catch (e: any) {
      alert(e?.response?.data?.detail || "Не удалось удалить секцию");
    } finally { setDeletingSection(false); }
  };

  // --- CRUD: ДОКЛАДЫ ---

  const handleReportSaved = (report: Report) => {
    setReports(prev => {
      const sid = report.section_id;
      const list = prev[sid] || [];
      const idx = list.findIndex(r => r.id === report.id);
      if (idx >= 0) {
        const next = [...list];
        next[idx] = report;
        return { ...prev, [sid]: next };
      }
      return { ...prev, [sid]: [...list, report] };
    });
    setReportModal({ open: false, sectionId: "" });
  };

  const handleDeleteReport = async () => {
    if (!deleteReport) return;
    setDeletingReport(true);
    if (demoMode) {
      setReports(prev => {
        const sid = deleteReport.section_id;
        return { ...prev, [sid]: (prev[sid] || []).filter(r => r.id !== deleteReport.id) };
      });
      setDeleteReport(null);
      setDeletingReport(false);
      return;
    }
    try {
      await reportsAPI.delete(deleteReport.id);
      setReports(prev => {
        const sid = deleteReport.section_id;
        return { ...prev, [sid]: (prev[sid] || []).filter(r => r.id !== deleteReport.id) };
      });
      setDeleteReport(null);
    } catch (e: any) {
      alert(e?.response?.data?.detail || "Не удалось удалить доклад");
    } finally { setDeletingReport(false); }
  };

  // --- Итоговый отчёт ---

  const saveReport = async () => {
    if (!reportText.trim() || !activeSectionId) { setReportError("Введите текст отчёта"); return; }
    setSavingReport(true); setReportError(""); setReportSaved(false);
    if (demoMode) { setSavingReport(false); setReportSaved(true); setTimeout(() => setReportSaved(false), 3000); return; }
    try {
      const res = await sectionsAPI.createSectionReport(activeSectionId, { text: reportText });
      setSectionReport(res.data);
      setReportSaved(true);
      setTimeout(() => setReportSaved(false), 3000);
    } catch (e: any) {
      setReportError(e?.response?.data?.detail || "Не удалось сохранить отчёт");
    } finally { setSavingReport(false); }
  };

  // --- Найти eventId для активной секции ---
  const activeEventId = activeSection?.event_id || sections[0]?.event_id || myEventId;

  const navItems = [
    { id: "sections", icon: "📋", label: "Мои секции" },
    { id: "comments", icon: "💬", label: "Комментарии" },
    { id: "report", icon: "📝", label: "Итоговый отчёт" },
    { id: "settings", icon: "⚙️", label: "Настройки" },
  ];

  const btnStyle = (color: string, bg: string, border?: string): React.CSSProperties => ({
    padding: "6px 12px", borderRadius: 100, border: border || "none",
    background: bg, color: color, fontWeight: 800, fontSize: 11,
    cursor: "pointer", fontFamily: "Nunito, sans-serif", whiteSpace: "nowrap",
  });

  return (
    <div className="dashboard-wrapper">
      {/* САЙДБАР */}
      <aside className="dashboard-sidebar">
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 72, height: 72, borderRadius: "50%", background: "var(--primary)", color: "white", fontSize: 26, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}>
            {user.full_name[0]}
          </div>
          <h5 style={{ marginTop: 10, marginBottom: 4, fontWeight: 800, fontSize: 15 }}>{user.full_name}</h5>
          <span style={{ display: "inline-block", padding: "3px 10px", background: "#e8f0fe", color: "var(--primary)", borderRadius: 100, fontSize: 11, fontWeight: 800 }}>
            КУРАТОР СЕКЦИИ
          </span>
          {user.organization && <p style={{ fontSize: 11, color: "#777", marginTop: 5 }}>{user.organization}</p>}
          {demoMode && <div style={{ fontSize: 10, color: "#f59e0b", fontWeight: 700, marginTop: 3 }}>DEMO</div>}
        </div>

        <nav className="sidebar-nav-list">
          {navItems.map(item => (
            <button key={item.id} className="nav-link border-0 w-100 text-start"
              style={{ background: activeTab === item.id ? "#eef6ff" : "#f1f5f9", color: activeTab === item.id ? "var(--primary)" : "#475569" }}
              onClick={() => setActiveTab(item.id as any)}>
              <span style={{ marginRight: 8 }}>{item.icon}</span>{item.label}
            </button>
          ))}
          <button className="nav-link border-0 w-100 text-start"
            style={{ marginTop: 16, background: "#fff1f1", color: "#ef4444" }} onClick={onLogout}>
            <span style={{ marginRight: 8 }}>🚪</span>Выйти
          </button>
        </nav>

        {/* Переключатель секций */}
        {sections.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase" }}>Секции</div>
              <button
                onClick={() => setSectionModal({ open: true, eventId: activeEventId })}
                style={{ fontSize: 11, padding: "3px 8px", borderRadius: 100, background: "var(--primary)", color: "white", border: "none", cursor: "pointer", fontWeight: 700, fontFamily: "Nunito, sans-serif" }}>
                + Новая
              </button>
            </div>
            {sections.map(s => (
              <button key={s.id} onClick={() => setActiveSectionId(s.id)}
                style={{ width: "100%", padding: "8px 10px", marginBottom: 4, textAlign: "left", border: "1.5px solid", borderColor: activeSectionId === s.id ? "var(--primary)" : "var(--border)", borderRadius: 8, background: activeSectionId === s.id ? "#eef6ff" : "white", color: activeSectionId === s.id ? "var(--primary)" : "var(--text-main)", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>
                {s.title}
              </button>
            ))}
          </div>
        )}
      </aside>

      {/* ОСНОВНОЙ КОНТЕНТ */}
      <main className="dashboard-main-content">
        {loadingSections ? (
          <Spinner label="Загружаем секции..." />
        ) : sectionsError ? (
          <ErrorBlock message={sectionsError} onRetry={loadSections} />
        ) : sections.length === 0 ? (
          /* ======= ПУСТОЕ СОСТОЯНИЕ: нет секций ======= */
          <div style={{ textAlign: "center", paddingTop: 60 }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>📋</div>
            <h2 style={{ fontWeight: 900, color: "var(--primary-dark)", marginBottom: 8 }}>Мои секции</h2>
            <p style={{ color: "#64748b", fontSize: 14, marginBottom: 28, maxWidth: 360, margin: "0 auto 28px" }}>
              У вас пока нет назначенных секций. Вы можете создать секцию самостоятельно или дождаться назначения от организатора.
            </p>
            <button
              onClick={() => setSectionModal({ open: true, eventId: activeEventId })}
              style={{ padding: "12px 28px", background: "var(--primary)", color: "white", border: "none", borderRadius: 100, fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>
              ✚ Создать первую секцию
            </button>
          </div>
        ) : (
          <>
            {/* Шапка активной секции */}
            {activeSection && (
              <div style={{ background: "white", borderRadius: 14, padding: "14px 18px", marginBottom: 20, boxShadow: "0 2px 10px rgba(74,89,138,0.07)", border: "1.5px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", marginBottom: 2 }}>Активная секция</div>
                  <h2 style={{ fontWeight: 900, margin: 0, color: "var(--primary-dark)", fontSize: 18 }}>{activeSection.title}</h2>
                  <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4, display: "flex", gap: 12, flexWrap: "wrap" }}>
                    {activeSection.location && <span>📍 {activeSection.location}</span>}
                    {activeSection.format && <span>📌 {activeSection.format}</span>}
                    <span style={{ color: activeSection.readiness_percent > 80 ? "#16a34a" : "var(--primary)", fontWeight: 700 }}>
                      ✓ {activeSection.readiness_percent}% готово
                    </span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setSectionModal({ open: true, eventId: activeEventId, section: activeSection })}
                    style={btnStyle("var(--primary)", "var(--bg-medium)", "1px solid var(--border)")}>
                    ✏️ Редактировать
                  </button>
                  <button onClick={() => setDeleteSection(activeSection)}
                    style={btnStyle("#dc2626", "#fef2f2", "1px solid #fecaca")}>
                    🗑 Удалить секцию
                  </button>
                </div>
              </div>
            )}

            {/* ТАБ: МОИ СЕКЦИИ */}
            {activeTab === "sections" && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h2 style={{ fontWeight: 800, margin: 0 }}>📋 Мои секции</h2>
                  <button
                    onClick={() => setSectionModal({ open: true, eventId: activeEventId })}
                    style={{ padding: "8px 18px", background: "var(--primary)", color: "white", border: "none", borderRadius: 100, fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>
                    ✚ Новая секция
                  </button>
                </div>

                {/* Список секций с карточками */}
                {sections.map(section => {
                  const secReports = reports[section.id];
                  const isActive = section.id === activeSectionId;

                  return (
                    <div key={section.id}
                      style={{ background: "white", borderRadius: 16, marginBottom: 20, boxShadow: "0 2px 10px rgba(74,89,138,0.07)", border: isActive ? "2px solid var(--primary)" : "1.5px solid var(--border)", overflow: "hidden" }}>
                      {/* Заголовок секции */}
                      <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", background: isActive ? "#f8fbff" : "white" }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 900, fontSize: 16, color: "var(--primary-dark)" }}>{section.title}</div>
                          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2, display: "flex", gap: 10, flexWrap: "wrap" }}>
                            {section.location && <span>📍 {section.location}</span>}
                            {section.format && <span>📌 {section.format}</span>}
                            {section.section_start && (
                              <span>🕐 {new Date(section.section_start).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                            )}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                          <button onClick={() => { setActiveSectionId(section.id); setSectionModal({ open: true, eventId: section.event_id, section }); }}
                            style={btnStyle("var(--primary)", "var(--bg-medium)", "1px solid var(--border)")}>
                            ✏️ Изменить
                          </button>
                          <button onClick={() => setDeleteSection(section)}
                            style={btnStyle("#dc2626", "#fef2f2", "1px solid #fecaca")}>
                            🗑
                          </button>
                        </div>
                      </div>

                      {/* Доклады секции */}
                      <div style={{ padding: "14px 18px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                          <div style={{ fontSize: 13, fontWeight: 800, color: "#475569" }}>
                            Доклады {secReports ? `(${secReports.length})` : ""}
                          </div>
                          <button
                            onClick={() => { setActiveSectionId(section.id); setReportModal({ open: true, sectionId: section.id }); }}
                            style={{ ...btnStyle("#10b981", "#ecfdf5", "1px solid #a7f3d0") }}>
                            + Добавить доклад
                          </button>
                        </div>

                        {!secReports ? (
                          <div style={{ textAlign: "center", padding: "12px 0", color: "#aaa", fontSize: 13 }}>
                            <button onClick={() => loadReports(section.id)} style={{ background: "none", border: "none", color: "var(--primary)", cursor: "pointer", fontFamily: "Nunito, sans-serif", fontWeight: 700 }}>
                              Загрузить доклады
                            </button>
                          </div>
                        ) : secReports.length === 0 ? (
                          <div style={{ padding: "12px 0", color: "#94a3b8", fontSize: 13, textAlign: "center" }}>
                            Докладов нет — нажмите «+ Добавить доклад»
                          </div>
                        ) : (
                          <div style={{ display: "grid", gap: 8 }}>
                            {secReports.map(r => (
                              <div key={r.id}
                                style={{ background: "#f8fafc", borderRadius: 10, padding: "10px 14px", border: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontWeight: 800, fontSize: 14, color: "var(--primary-dark)", marginBottom: 3 }}>{r.title}</div>
                                  <div style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", gap: 8, flexWrap: "wrap" }}>
                                    {r.start_time && <span>🕐 {new Date(r.start_time).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</span>}
                                    {r.presentation_format && <span style={{ padding: "1px 7px", borderRadius: 100, background: r.presentation_format === "ONLINE" ? "#e8f5e9" : "#e8f0fe", color: r.presentation_format === "ONLINE" ? "#2e7d32" : "var(--primary)", fontSize: 10, fontWeight: 800 }}>{r.presentation_format}</span>}
                                    {r.speaker_id ? (
                                      <span style={{ color: r.speaker_confirmed ? "#16a34a" : "#92400e" }}>
                                        🎤 {r.speaker_name || "Спикер"} {r.speaker_confirmed ? "✅" : "⏳"}
                                      </span>
                                    ) : (
                                      <span style={{ color: "#dc2626" }}>🎤 Спикер не назначен</span>
                                    )}
                                  </div>
                                </div>
                                <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                                  <button onClick={() => setAssignSpeakerReport(r)}
                                    style={btnStyle("var(--primary)", "var(--bg-medium)", "1px solid var(--border)")}>
                                    🎤 {r.speaker_id ? "Сменить" : "Спикер"}
                                  </button>
                                  <button onClick={() => { setActiveSectionId(section.id); setReportModal({ open: true, sectionId: section.id, report: r }); }}
                                    style={btnStyle("#64748b", "#f1f5f9")}>
                                    ✏️
                                  </button>
                                  <button onClick={() => setDeleteReport(r)}
                                    style={btnStyle("#dc2626", "#fef2f2")}>
                                    🗑
                                  </button>
                                </div>
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

            {/* ТАБ: КОММЕНТАРИИ */}
            {activeTab === "comments" && (
              <div>
                <h2 style={{ fontWeight: 800, marginBottom: 16 }}>💬 Комментарии к докладам</h2>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
                  {activeReports.map(r => (
                    <button key={r.id} onClick={() => loadComments(r.id)}
                      style={{ padding: "7px 16px", border: "1.5px solid", borderColor: selectedReportIdForComments === r.id ? "var(--primary)" : "var(--border)", background: selectedReportIdForComments === r.id ? "var(--primary)" : "white", color: selectedReportIdForComments === r.id ? "white" : "var(--primary-dark)", borderRadius: 100, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>
                      {r.title}
                    </button>
                  ))}
                </div>
                {!selectedReportIdForComments ? (
                  <EmptyState icon="💬" title="Выберите доклад" description="Нажмите на доклад выше чтобы увидеть комментарии." />
                ) : loadingComments ? (
                  <Spinner label="Загружаем комментарии..." />
                ) : comments.length === 0 ? (
                  <EmptyState icon="💬" title="Комментариев нет" description="К этому докладу пока никто не оставил комментариев." />
                ) : (
                  <div style={{ display: "grid", gap: 12 }}>
                    {comments.map(c => (
                      <div key={c.id} style={{ background: "white", borderRadius: 14, padding: "16px 18px", boxShadow: "0 2px 10px rgba(74,89,138,0.07)", border: "1.5px solid var(--border)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          <span style={{ fontWeight: 800, color: "var(--primary-dark)", fontSize: 14 }}>{c.author_name || "Участник"}</span>
                          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                            {new Date(c.created_at).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <div style={{ fontSize: 14, color: "#334155", marginBottom: 10 }}>{c.text}</div>
                        {c.answer_text ? (
                          <div style={{ background: "var(--bg-medium)", borderRadius: 10, padding: "10px 14px", borderLeft: "3px solid var(--primary)" }}>
                            <div style={{ fontSize: 11, fontWeight: 800, color: "var(--primary)", marginBottom: 4 }}>Ответ куратора</div>
                            <div style={{ fontSize: 13, color: "#334155" }}>{c.answer_text}</div>
                            <button onClick={() => setAnswerComment(c)}
                              style={{ marginTop: 6, padding: "4px 12px", background: "none", border: "1px solid var(--primary)", color: "var(--primary)", borderRadius: 100, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>
                              Изменить ответ
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setAnswerComment(c)}
                            style={{ padding: "7px 16px", background: "var(--primary)", color: "white", border: "none", borderRadius: 100, fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>
                            Ответить
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ТАБ: ИТОГОВЫЙ ОТЧЁТ */}
            {activeTab === "report" && (
              <div>
                <h2 style={{ fontWeight: 800, marginBottom: 8 }}>📝 Итоговый отчёт секции</h2>
                <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 20 }}>
                  Напишите итоговый отчёт о проведении секции «{activeSection?.title}».
                </p>
                {reportError && <ErrorBlock message={reportError} />}
                {reportSaved && (
                  <div style={{ background: "#f0fdf4", color: "#16a34a", padding: "10px 14px", borderRadius: 8, marginBottom: 16, fontWeight: 700, fontSize: 13 }}>
                    ✅ Отчёт сохранён!
                  </div>
                )}
                {sectionReport && (
                  <div style={{ background: "var(--bg-light)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "var(--text-muted)", fontWeight: 600 }}>
                    Последнее сохранение: {new Date(sectionReport.created_at).toLocaleString("ru-RU")}
                  </div>
                )}
                <textarea
                  value={reportText} onChange={e => setReportText(e.target.value)} rows={12}
                  placeholder="Опишите как прошла секция: количество участников, основные обсуждения, выводы, проблемы..."
                  style={{ width: "100%", padding: "14px 16px", borderRadius: 12, border: "1.5px solid var(--border)", fontSize: 14, fontFamily: "Nunito, sans-serif", resize: "vertical", outline: "none", boxSizing: "border-box", lineHeight: 1.7, marginBottom: 16 }}
                />
                <button onClick={saveReport} disabled={savingReport}
                  style={{ padding: "12px 32px", background: "var(--primary)", color: "white", border: "none", borderRadius: 100, fontWeight: 800, fontSize: 14, cursor: savingReport ? "not-allowed" : "pointer", opacity: savingReport ? 0.7 : 1, fontFamily: "Nunito, sans-serif" }}>
                  {savingReport ? "Сохранение..." : sectionReport ? "Обновить отчёт" : "Сохранить отчёт"}
                </button>
              </div>
            )}

            {/* ТАБ: НАСТРОЙКИ */}
            {activeTab === "settings" && (
              <div>
                <h2 style={{ fontWeight: 800, marginBottom: 20 }}>⚙️ Настройки профиля</h2>
                <div style={{ background: "white", borderRadius: 16, padding: 28, maxWidth: 440, boxShadow: "0 2px 10px rgba(74,89,138,0.07)" }}>
                  {[
                    { label: "Имя", value: user.full_name },
                    { label: "Email", value: user.email },
                    { label: "Роль", value: "КУРАТОР" },
                    ...(user.organization ? [{ label: "Организация", value: user.organization }] : []),
                  ].map(f => (
                    <div key={f.label} style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>{f.label}</div>
                      <div style={{ padding: "9px 14px", background: "#f8fafc", borderRadius: 8, fontSize: 14, fontWeight: 600 }}>{f.value}</div>
                    </div>
                  ))}
                  {demoMode && <p style={{ color: "#f59e0b", fontSize: 12, fontWeight: 600 }}>⚠️ Demo — изменения не сохраняются</p>}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* ======= МОДАЛКИ ======= */}

      {sectionModal.open && (
        <SectionModal
          initial={sectionModal.section}
          eventId={sectionModal.eventId}
          onClose={() => setSectionModal({ open: false, eventId: "" })}
          onSaved={handleSectionSaved}
          demoMode={demoMode}
        />
      )}

      {reportModal.open && (
        <ReportModal
          initial={reportModal.report}
          sectionId={reportModal.sectionId}
          onClose={() => setReportModal({ open: false, sectionId: "" })}
          onSaved={handleReportSaved}
          demoMode={demoMode}
        />
      )}

      {deleteSection && (
        <ConfirmDeleteModal
          title="Удалить секцию?"
          description={`Секция «${deleteSection.title}» и все её доклады будут удалены. Это действие нельзя отменить.`}
          onConfirm={handleDeleteSection}
          onCancel={() => setDeleteSection(null)}
          loading={deletingSection}
        />
      )}

      {deleteReport && (
        <ConfirmDeleteModal
          title="Удалить доклад?"
          description={`Доклад «${deleteReport.title}» будет удалён. Это действие нельзя отменить.`}
          onConfirm={handleDeleteReport}
          onCancel={() => setDeleteReport(null)}
          loading={deletingReport}
        />
      )}

      {assignSpeakerReport && (
        <AssignSpeakerModal
          report={assignSpeakerReport}
          onClose={() => setAssignSpeakerReport(null)}
          onAssigned={(reportId, speakerId, speakerName) => {
            setReports(prev => {
              const sid = assignSpeakerReport.section_id;
              return {
                ...prev,
                [sid]: (prev[sid] || []).map(r =>
                  r.id === reportId ? { ...r, speaker_id: speakerId, speaker_name: speakerName } : r
                ),
              };
            });
            setAssignSpeakerReport(null);
          }}
          demoMode={demoMode}
        />
      )}

      {answerComment && (
        <AnswerCommentModal
          comment={answerComment}
          onClose={() => setAnswerComment(null)}
          onAnswered={(commentId, answerText) => {
            setComments(prev => prev.map(c =>
              c.id === commentId ? { ...c, answer_text: answerText, answer_created_at: new Date().toISOString() } : c
            ));
            setAnswerComment(null);
          }}
          demoMode={demoMode}
        />
      )}
    </div>
  );
}

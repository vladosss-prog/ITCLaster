import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
  {
    id: "c2", report_id: "r1", author_id: "u4",
    author_name: "Анна Петрова",
    text: "Когда будут слайды доступны?",
    created_at: "2026-03-19T10:40:00Z",
    answer_text: "Слайды выложим вечером",
    answer_by_id: "u3",
    answer_created_at: "2026-03-19T11:00:00Z",
  },
];

// -----------------------------------------------------------
// ВСПОМОГАТЕЛЬНЫЕ КОМПОНЕНТЫ
// -----------------------------------------------------------

// Назначение спикера на доклад
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
        setResults(([
  { id: "u5", email: "speaker@it.ru", full_name: "Алексей Спикеров", global_role: "PARTICIPANT" as const },
  { id: "u6", email: "anna@it.ru", full_name: "Анна Докладова", global_role: "PARTICIPANT" as const },
] as User[]).filter(u => u.full_name.toLowerCase().includes(q.toLowerCase())));
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
    } finally { setSaving(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(13,27,62,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000 }}>
      <div style={{ background: "white", borderRadius: 20, padding: 28, width: "100%", maxWidth: 460, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", borderTop: "5px solid var(--primary)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ fontWeight: 900, margin: 0, color: "var(--primary-dark)", fontSize: 16 }}>
            Назначить спикера: «{report.title}»
          </h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#777" }}>×</button>
        </div>

        {error && <div style={{ background: "#fef2f2", color: "#dc2626", padding: "8px 12px", borderRadius: 8, marginBottom: 12, fontSize: 13 }}>{error}</div>}

        <input
          type="text"
          placeholder="Поиск по ФИО..."
          value={query}
          onChange={e => search(e.target.value)}
          autoFocus
          style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1.5px solid var(--border)", fontSize: 14, boxSizing: "border-box", fontFamily: "Nunito, sans-serif", outline: "none", marginBottom: 12 }}
        />

        {searching && <div style={{ color: "#777", fontSize: 13, textAlign: "center", padding: 8 }}>Поиск...</div>}

        {results.length > 0 && (
          <div style={{ maxHeight: 240, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 10 }}>
            {results.map(u => (
              <div key={u.id}
                onClick={() => !saving && assign(u)}
                style={{ padding: "12px 16px", cursor: saving ? "not-allowed" : "pointer", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12, transition: "background 0.15s" }}
                onMouseOver={e => (e.currentTarget.style.background = "#f0f7ff")}
                onMouseOut={e => (e.currentTarget.style.background = "white")}
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

        {query.length >= 2 && results.length === 0 && !searching && (
          <div style={{ color: "#aaa", textAlign: "center", padding: 16, fontSize: 13 }}>Никого не найдено</div>
        )}
      </div>
    </div>
  );
}

// Ответ куратора на комментарий
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
    if (demoMode) {
      onAnswered(comment.id, text.trim());
      onClose();
      return;
    }
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

        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          rows={4}
          placeholder="Ваш ответ..."
          autoFocus
          style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1.5px solid var(--border)", fontSize: 14, boxSizing: "border-box", fontFamily: "Nunito, sans-serif", resize: "vertical", outline: "none", marginBottom: 16 }}
        />

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={submit} disabled={saving}
            style={{ flex: 1, padding: "11px", background: "var(--primary)", color: "white", border: "none", borderRadius: 100, fontWeight: 800, fontSize: 13, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1, fontFamily: "Nunito, sans-serif" }}>
            {saving ? "Сохранение..." : "ОТВЕТИТЬ"}
          </button>
          <button onClick={onClose}
            style={{ flex: 1, padding: "11px", background: "#f1f5f9", color: "#475569", border: "none", borderRadius: 100, fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>
            ОТМЕНА
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
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"sections" | "comments" | "report" | "messenger" | "settings">("sections");

  // Данные секций куратора
  const [sections, setSections] = useState<Section[]>([]);
  const [loadingSections, setLoadingSections] = useState(true);
  const [sectionsError, setSectionsError] = useState("");

  // Активная секция и её доклады
  const [activeSectionId, setActiveSectionId] = useState<string>("");
  const [reports, setReports] = useState<Report[]>([]);
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
  const [assignSpeakerReport, setAssignSpeakerReport] = useState<Report | null>(null);
  const [answerComment, setAnswerComment] = useState<Comment | null>(null);

  // Загружаем секции куратора
  const loadSections = useCallback(async () => {
    setLoadingSections(true);
    setSectionsError("");
    if (demoMode) {
      setSections(DEMO_SECTIONS);
      setActiveSectionId(DEMO_SECTIONS[0]?.id || "");
      setLoadingSections(false);
      return;
    }
    try {
      // Получаем все мероприятия, затем секции где curator_id === user.id
      const evRes = await eventsAPI.getAll();
      const allSections: Section[] = [];
      for (const ev of evRes.data || []) {
        const secRes = await eventsAPI.getSections(ev.id);
        for (const sec of secRes.data || []) {
          if (sec.curator_id === user.id) allSections.push(sec);
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

  // Загружаем доклады активной секции
  useEffect(() => {
    if (!activeSectionId) return;
    setLoadingReports(true);
    if (demoMode) {
      setReports(DEMO_REPORTS.filter(r => r.section_id === activeSectionId));
      setLoadingReports(false);
      return;
    }
    sectionsAPI.getReports(activeSectionId)
      .then(res => setReports(res.data || []))
      .catch(() => setReports([]))
      .finally(() => setLoadingReports(false));
  }, [activeSectionId, demoMode]);

  // Загружаем комментарии к докладу
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

  // Загружаем итоговый отчёт
  useEffect(() => {
    if (!activeSectionId || activeTab !== "report") return;
    if (demoMode) {
      setSectionReport(null);
      setReportText("");
      return;
    }
    sectionsAPI.getSectionReport(activeSectionId)
      .then(res => { setSectionReport(res.data); setReportText(res.data.text); })
      .catch(() => { setSectionReport(null); setReportText(""); });
  }, [activeSectionId, activeTab, demoMode]);

  const saveReport = async () => {
    if (!reportText.trim() || !activeSectionId) { setReportError("Введите текст отчёта"); return; }
    setSavingReport(true); setReportError(""); setReportSaved(false);
    if (demoMode) {
      setSavingReport(false); setReportSaved(true);
      setTimeout(() => setReportSaved(false), 3000);
      return;
    }
    try {
      const res = await sectionsAPI.createSectionReport(activeSectionId, { text: reportText });
      setSectionReport(res.data);
      setReportSaved(true);
      setTimeout(() => setReportSaved(false), 3000);
    } catch (e: any) {
      setReportError(e?.response?.data?.detail || "Не удалось сохранить отчёт");
    } finally { setSavingReport(false); }
  };

  const activeSection = sections.find(s => s.id === activeSectionId);

  const navItems = [
    { id: "sections", icon: "📋", label: "Мои секции" },
    { id: "comments", icon: "💬", label: "Комментарии" },
    { id: "report", icon: "📝", label: "Итоговый отчёт" },
    { id: "settings", icon: "⚙️", label: "Настройки" },
  ];

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
            CURATOR
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
        {sections.length > 1 && (
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 6 }}>Мои секции</div>
            {sections.map(s => (
              <button key={s.id}
                onClick={() => setActiveSectionId(s.id)}
                style={{ width: "100%", padding: "8px 10px", marginBottom: 4, textAlign: "left", border: "1.5px solid", borderColor: activeSectionId === s.id ? "var(--primary)" : "var(--border)", borderRadius: 8, background: activeSectionId === s.id ? "#eef6ff" : "white", color: activeSectionId === s.id ? "var(--primary)" : "var(--text-main)", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>
                {s.title}
              </button>
            ))}
          </div>
        )}
      </aside>

      {/* ОСНОВНОЙ КОНТЕНТ */}
      <main className="dashboard-main-content">
        {loadingSections ? <Spinner label="Загружаем секции..." /> : sectionsError ? (
          <ErrorBlock message={sectionsError} onRetry={loadSections} />
        ) : sections.length === 0 ? (
          <EmptyState icon="📋" title="Нет назначенных секций" description="Организатор ещё не назначил вас куратором ни одной секции." />
        ) : (
          <>
            {/* Шапка активной секции */}
            {activeSection && (
              <div style={{ background: "white", borderRadius: 14, padding: "16px 20px", marginBottom: 20, boxShadow: "0 2px 10px rgba(74,89,138,0.07)", border: "1.5px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", marginBottom: 3 }}>Активная секция</div>
                  <h2 style={{ fontWeight: 900, margin: 0, color: "var(--primary-dark)", fontSize: 18 }}>{activeSection.title}</h2>
                  <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4, display: "flex", gap: 12, flexWrap: "wrap" }}>
                    {activeSection.location && <span>📍 {activeSection.location}</span>}
                    {activeSection.format && <span>📌 {activeSection.format}</span>}
                    <span style={{ color: activeSection.readiness_percent > 80 ? "#16a34a" : "var(--primary)", fontWeight: 700 }}>
                      ✓ {activeSection.readiness_percent}% готово
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* ТАБ: МОИ СЕКЦИИ — доклады + назначение спикеров */}
            {activeTab === "sections" && (
              <div>
                <h2 style={{ fontWeight: 800, marginBottom: 16 }}>Доклады секции</h2>
                {loadingReports ? <Spinner label="Загружаем доклады..." /> : reports.length === 0 ? (
                  <EmptyState icon="🎤" title="Докладов нет" description="В этой секции пока нет докладов." />
                ) : (
                  <div style={{ display: "grid", gap: 12 }}>
                    {reports.map(r => (
                      <div key={r.id} style={{ background: "white", borderRadius: 14, padding: "16px 20px", boxShadow: "0 2px 10px rgba(74,89,138,0.07)", border: "1.5px solid var(--border)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, color: "var(--primary)", fontWeight: 800, marginBottom: 4 }}>
                              {r.start_time ? new Date(r.start_time).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : "—"}
                              {r.end_time ? ` – ${new Date(r.end_time).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}` : ""}
                              {r.presentation_format && (
                                <span style={{ marginLeft: 8, padding: "2px 8px", borderRadius: 100, background: r.presentation_format === "ONLINE" ? "#e8f5e9" : "#e8f0fe", color: r.presentation_format === "ONLINE" ? "#2e7d32" : "var(--primary)", fontSize: 10 }}>
                                  {r.presentation_format}
                                </span>
                              )}
                            </div>
                            <div style={{ fontWeight: 800, fontSize: 15, color: "var(--primary-dark)", marginBottom: 6 }}>{r.title}</div>
                            {r.description && <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{r.description}</div>}
                          </div>

                          <div style={{ display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>
                            {/* Статус спикера */}
                            {r.speaker_id ? (
                              <div style={{ fontSize: 12, background: r.speaker_confirmed ? "#f0fdf4" : "#fffbeb", color: r.speaker_confirmed ? "#16a34a" : "#92400e", padding: "4px 10px", borderRadius: 100, fontWeight: 700, textAlign: "center" }}>
                                🎤 {r.speaker_name || "Спикер назначен"}
                                {r.speaker_confirmed ? " ✅" : " ⏳"}
                              </div>
                            ) : (
                              <div style={{ fontSize: 12, background: "#fef2f2", color: "#dc2626", padding: "4px 10px", borderRadius: 100, fontWeight: 700, textAlign: "center" }}>
                                🎤 Спикер не назначен
                              </div>
                            )}

                            <button onClick={() => setAssignSpeakerReport(r)}
                              style={{ padding: "7px 14px", background: "var(--bg-medium)", color: "var(--primary)", border: "1.5px solid var(--border)", borderRadius: 100, fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>
                              {r.speaker_id ? "Сменить спикера" : "Назначить спикера"}
                            </button>

                            <button onClick={() => { setActiveTab("comments"); loadComments(r.id); }}
                              style={{ padding: "7px 14px", background: "#f1f5f9", color: "#475569", border: "none", borderRadius: 100, fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>
                              💬 Комментарии
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ТАБ: КОММЕНТАРИИ — просмотр и ответы */}
            {activeTab === "comments" && (
              <div>
                <h2 style={{ fontWeight: 800, marginBottom: 16 }}>Комментарии к докладам</h2>

                {/* Выбор доклада */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
                  {reports.map(r => (
                    <button key={r.id}
                      onClick={() => loadComments(r.id)}
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
                          <span style={{ fontWeight: 800, color: "var(--primary-dark)", fontSize: 14 }}>
                            {c.author_name || "Участник"}
                          </span>
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
                <h2 style={{ fontWeight: 800, marginBottom: 8 }}>Итоговый отчёт секции</h2>
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
                  value={reportText}
                  onChange={e => setReportText(e.target.value)}
                  rows={12}
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
                <h2 style={{ fontWeight: 800, marginBottom: 20 }}>Настройки профиля</h2>
                <div style={{ background: "white", borderRadius: 16, padding: 28, maxWidth: 440, boxShadow: "0 2px 10px rgba(74,89,138,0.07)" }}>
                  {[
                    { label: "Имя", value: user.full_name },
                    { label: "Email", value: user.email },
                    { label: "Роль", value: "CURATOR" },
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

      {/* МОДАЛКИ */}
      {assignSpeakerReport && (
        <AssignSpeakerModal
          report={assignSpeakerReport}
          onClose={() => setAssignSpeakerReport(null)}
          onAssigned={(reportId, speakerId, speakerName) => {
            setReports(prev => prev.map(r => r.id === reportId ? { ...r, speaker_id: speakerId, speaker_name: speakerName } : r));
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
            setComments(prev => prev.map(c => c.id === commentId ? { ...c, answer_text: answerText, answer_created_at: new Date().toISOString() } : c));
            setAnswerComment(null);
          }}
          demoMode={demoMode}
        />
      )}
    </div>
  );
}

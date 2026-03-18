import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { eventsAPI, sectionsAPI, usersAPI } from "../api/apiClient";
import type { User, SectionFormat } from "../api/apiClient";

// -----------------------------------------------------------
// ТИПЫ ШАГОВ
// -----------------------------------------------------------
type Step = 1 | 2 | 3;

interface SectionDraft {
  id: string; // временный локальный id
  title: string;
  format: SectionFormat | "";
  location: string;
  section_start: string;
  section_end: string;
  tech_notes: string;
  curator: User | null; // выбранный куратор
}

const emptySectionDraft = (): SectionDraft => ({
  id: `tmp-${Date.now()}-${Math.random()}`,
  title: "",
  format: "",
  location: "",
  section_start: "",
  section_end: "",
  tech_notes: "",
  curator: null,
});

// -----------------------------------------------------------
// ПОИСК КУРАТОРА
// -----------------------------------------------------------
function CuratorSearch({
  section,
  onSelect,
  demoMode,
}: {
  section: SectionDraft;
  onSelect: (user: User | null) => void;
  demoMode: boolean;
}) {
  const [query, setQuery] = useState(section.curator?.full_name || "");
  const [results, setResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);

  const DEMO_USERS: User[] = [
    { id: "cu1", email: "curator1@it.ru", full_name: "Анна Кураторова", global_role: "PARTICIPANT", organization: "ОмГТУ" },
    { id: "cu2", email: "curator2@it.ru", full_name: "Дмитрий Секционов", global_role: "PARTICIPANT", organization: "ИТ-Кластер" },
    { id: "cu3", email: "curator3@it.ru", full_name: "Мария Ведущая", global_role: "PARTICIPANT", organization: "ИНСИСТ" },
  ];

  const search = async (q: string) => {
    setQuery(q);
    onSelect(null); // сбрасываем при новом поиске
    if (q.length < 2) { setResults([]); setOpen(false); return; }
    setSearching(true); setOpen(true);
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

  const pick = (u: User) => {
    setQuery(u.full_name);
    onSelect(u);
    setOpen(false);
    setResults([]);
  };

  return (
    <div style={{ position: "relative" }}>
      <input
        type="text"
        value={query}
        onChange={e => search(e.target.value)}
        placeholder="Начните вводить ФИО куратора..."
        style={{ width: "100%", padding: "9px 14px", borderRadius: 8, border: `1.5px solid ${section.curator ? "var(--primary)" : "var(--border)"}`, fontSize: 13, fontFamily: "Nunito, sans-serif", outline: "none", boxSizing: "border-box" }}
      />
      {section.curator && (
        <div style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "#16a34a", fontSize: 16 }}>✓</div>
      )}
      {open && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 100, background: "white", border: "1.5px solid var(--border)", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.1)", maxHeight: 200, overflowY: "auto" }}>
          {searching && <div style={{ padding: 12, fontSize: 13, color: "#777" }}>Поиск...</div>}
          {results.map(u => (
            <div key={u.id} onClick={() => pick(u)}
              style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid var(--border)", fontSize: 13 }}
              onMouseOver={e => (e.currentTarget.style.background = "#f0f7ff")}
              onMouseOut={e => (e.currentTarget.style.background = "white")}>
              <div style={{ fontWeight: 700, color: "var(--primary-dark)" }}>{u.full_name}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{u.email} · {u.organization}</div>
            </div>
          ))}
          {query.length >= 2 && results.length === 0 && !searching && (
            <div style={{ padding: 12, fontSize: 13, color: "#aaa" }}>Никого не найдено</div>
          )}
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------
// ГЛАВНЫЙ КОМПОНЕНТ
// -----------------------------------------------------------
export function CreateEventPage({ demoMode }: { demoMode: boolean }) {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Шаг 1 — основные данные мероприятия
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState<"DRAFT" | "PUBLISHED">("DRAFT");

  // Шаг 2 — секции
  const [sections, setSections] = useState<SectionDraft[]>([emptySectionDraft()]);

  // Шаг 3 — подтверждение
  const [createdEventId, setCreatedEventId] = useState<string>("");

  // ------- ШАГИ -------

  const validateStep1 = () => {
    if (!title.trim()) { setError("Введите название мероприятия"); return false; }
    setError(""); return true;
  };

  const validateStep2 = () => {
    for (const s of sections) {
      if (!s.title.trim()) { setError("Введите название для каждой секции"); return false; }
    }
    setError(""); return true;
  };

  const goNext = () => {
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    setStep((s) => (s + 1) as Step);
  };

  const addSection = () => setSections(prev => [...prev, emptySectionDraft()]);

  const removeSection = (id: string) => setSections(prev => prev.filter(s => s.id !== id));

  const updateSection = (id: string, field: keyof SectionDraft, value: unknown) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  // ------- ФИНАЛЬНОЕ СОЗДАНИЕ -------

  const handleCreate = async () => {
    setSaving(true); setError("");

    if (demoMode) {
      // Demo: просто имитируем
      setCreatedEventId("demo-new-event");
      setStep(3);
      setSaving(false);
      return;
    }

    try {
      // 1. Создаём мероприятие
      const eventRes = await eventsAPI.create({
        title: title.trim(),
        description: description.trim() || null,
        start_date: startDate || null,
        end_date: endDate || null,
        status,
      });
      const eventId = eventRes.data.id;

      // 2. Создаём секции и назначаем кураторов
      for (const sec of sections) {
        if (!sec.title.trim()) continue;

        const secRes = await eventsAPI.createSection(eventId, {
          title: sec.title.trim(),
          format: sec.format || undefined,
          location: sec.location.trim() || undefined,
          section_start: sec.section_start || undefined,
          section_end: sec.section_end || undefined,
          tech_notes: sec.tech_notes.trim() || undefined,
        });

        // 3. Назначаем куратора если выбран
        if (sec.curator) {
          try {
            await eventsAPI.assignCurator(eventId, {
              user_id: sec.curator.id,
              section_id: secRes.data.id,
            });
          } catch {
            // не блокируем если назначение куратора не удалось
            console.warn(`Не удалось назначить куратора для секции ${sec.title}`);
          }
        }
      }

      setCreatedEventId(eventId);
      setStep(3);
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || "Не удалось создать мероприятие");
    } finally {
      setSaving(false);
    }
  };

  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: 11, fontWeight: 800, color: "var(--text-muted)",
    textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 5,
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "9px 14px", borderRadius: 8,
    border: "1.5px solid var(--border)", fontSize: 14, boxSizing: "border-box",
    fontFamily: "Nunito, sans-serif", outline: "none",
  };

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 0 60px" }}>

      {/* Прогресс шагов */}
      <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 32 }}>
        {[
          { n: 1, label: "Основное" },
          { n: 2, label: "Секции" },
          { n: 3, label: "Готово" },
        ].map((s, i) => (
          <React.Fragment key={s.n}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{
                width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 900, fontSize: 15,
                background: step >= s.n ? "var(--primary)" : "var(--border)",
                color: step >= s.n ? "white" : "var(--text-muted)",
              }}>{step > s.n ? "✓" : s.n}</div>
              <span style={{ fontSize: 11, fontWeight: 700, color: step >= s.n ? "var(--primary)" : "var(--text-muted)" }}>{s.label}</span>
            </div>
            {i < 2 && <div style={{ flex: 1, height: 2, background: step > s.n ? "var(--primary)" : "var(--border)", margin: "0 8px", marginBottom: 20 }} />}
          </React.Fragment>
        ))}
      </div>

      {/* ШАГ 1: Основные данные */}
      {step === 1 && (
        <div style={{ background: "white", borderRadius: 16, padding: 28, boxShadow: "0 2px 12px rgba(74,89,138,0.08)", border: "1.5px solid var(--border)" }}>
          <h2 style={{ fontWeight: 900, margin: "0 0 20px", color: "var(--primary-dark)" }}>Основная информация</h2>

          {error && <div style={{ background: "#fef2f2", color: "#dc2626", padding: "10px 14px", borderRadius: 8, marginBottom: 16, fontSize: 13 }}>{error}</div>}
          {demoMode && <div style={{ background: "#fffbeb", border: "1px solid #fde68a", padding: "8px 14px", borderRadius: 8, marginBottom: 16, fontSize: 12, color: "#92400e", fontWeight: 600 }}>⚠️ Demo — создание не сохраняется в БД</div>}

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Название мероприятия *</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              placeholder="ИТ-Форум 2026" style={inputStyle} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Описание</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              rows={3} placeholder="Кратко опишите мероприятие..."
              style={{ ...inputStyle, resize: "vertical" }} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>Дата начала</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Дата окончания</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={inputStyle} />
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={labelStyle}>Статус публикации</label>
            <div style={{ display: "flex", gap: 10 }}>
              {(["DRAFT", "PUBLISHED"] as const).map(s => (
                <button key={s} onClick={() => setStatus(s)}
                  style={{ flex: 1, padding: "9px", border: "1.5px solid", borderColor: status === s ? "var(--primary)" : "var(--border)", background: status === s ? "var(--primary)" : "white", color: status === s ? "white" : "var(--text-muted)", borderRadius: 8, fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>
                  {s === "DRAFT" ? "📝 Черновик" : "🌐 Опубликовать"}
                </button>
              ))}
            </div>
          </div>

          <button onClick={goNext}
            style={{ width: "100%", padding: "13px", background: "var(--primary)", color: "white", border: "none", borderRadius: 100, fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>
            Далее: добавить секции →
          </button>
        </div>
      )}

      {/* ШАГ 2: Секции */}
      {step === 2 && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h2 style={{ fontWeight: 900, margin: 0, color: "var(--primary-dark)" }}>Секции мероприятия</h2>
            <button onClick={addSection}
              style={{ padding: "9px 20px", background: "var(--bg-medium)", color: "var(--primary)", border: "1.5px solid var(--border)", borderRadius: 100, fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>
              + Добавить секцию
            </button>
          </div>

          {error && <div style={{ background: "#fef2f2", color: "#dc2626", padding: "10px 14px", borderRadius: 8, marginBottom: 16, fontSize: 13 }}>{error}</div>}

          <div style={{ display: "grid", gap: 16, marginBottom: 24 }}>
            {sections.map((sec, idx) => (
              <div key={sec.id} style={{ background: "white", borderRadius: 16, padding: 24, boxShadow: "0 2px 12px rgba(74,89,138,0.08)", border: "1.5px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <span style={{ fontWeight: 900, color: "var(--primary)", fontSize: 14 }}>Секция {idx + 1}</span>
                  {sections.length > 1 && (
                    <button onClick={() => removeSection(sec.id)}
                      style={{ background: "#fff1f1", border: "none", color: "#ef4444", padding: "4px 12px", borderRadius: 100, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                      Удалить
                    </button>
                  )}
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={labelStyle}>Название секции *</label>
                  <input type="text" value={sec.title}
                    onChange={e => updateSection(sec.id, "title", e.target.value)}
                    placeholder="Секция ИнфоБезопасности" style={inputStyle} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                  <div>
                    <label style={labelStyle}>Формат</label>
                    <select value={sec.format} onChange={e => updateSection(sec.id, "format", e.target.value)}
                      style={{ ...inputStyle }}>
                      <option value="">Не выбран</option>
                      <option value="SEQUENTIAL">Последовательные доклады</option>
                      <option value="ROUNDTABLE">Круглый стол</option>
                      <option value="GAME">Деловая игра</option>
                      <option value="OTHER">Другое</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Зал / аудитория</label>
                    <input type="text" value={sec.location}
                      onChange={e => updateSection(sec.id, "location", e.target.value)}
                      placeholder="Зал А" style={inputStyle} />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                  <div>
                    <label style={labelStyle}>Время начала</label>
                    <input type="datetime-local" value={sec.section_start}
                      onChange={e => updateSection(sec.id, "section_start", e.target.value)}
                      style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Время окончания</label>
                    <input type="datetime-local" value={sec.section_end}
                      onChange={e => updateSection(sec.id, "section_end", e.target.value)}
                      style={inputStyle} />
                  </div>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={labelStyle}>Техническое оснащение</label>
                  <input type="text" value={sec.tech_notes}
                    onChange={e => updateSection(sec.id, "tech_notes", e.target.value)}
                    placeholder="Проектор, микрофон, трансляция..." style={inputStyle} />
                </div>

                {/* Назначение куратора */}
                <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14, marginTop: 14 }}>
                  <label style={{ ...labelStyle, color: "var(--primary)" }}>🎯 Назначить куратора секции</label>
                  <CuratorSearch
                    section={sec}
                    onSelect={curator => updateSection(sec.id, "curator", curator)}
                    demoMode={demoMode}
                  />
                  {sec.curator && (
                    <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 10, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "8px 12px" }}>
                      <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#16a34a", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 12, flexShrink: 0 }}>
                        {sec.curator.full_name[0]}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: "#166534" }}>{sec.curator.full_name}</div>
                        <div style={{ fontSize: 11, color: "#16a34a" }}>{sec.curator.email}</div>
                      </div>
                      <button onClick={() => updateSection(sec.id, "curator", null)}
                        style={{ marginLeft: "auto", background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 16 }}>×</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <button onClick={() => setStep(1)}
              style={{ flex: 1, padding: "12px", background: "#f1f5f9", color: "#475569", border: "none", borderRadius: 100, fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>
              ← Назад
            </button>
            <button onClick={handleCreate} disabled={saving}
              style={{ flex: 2, padding: "12px", background: "var(--primary)", color: "white", border: "none", borderRadius: 100, fontWeight: 800, fontSize: 14, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1, fontFamily: "Nunito, sans-serif" }}>
              {saving ? "Создание..." : "✓ Создать мероприятие"}
            </button>
          </div>
        </div>
      )}

      {/* ШАГ 3: Успех */}
      {step === 3 && (
        <div style={{ background: "white", borderRadius: 16, padding: 40, textAlign: "center", boxShadow: "0 2px 12px rgba(74,89,138,0.08)", border: "1.5px solid var(--border)" }}>
          <div style={{ fontSize: 64, marginBottom: 20 }}>🎉</div>
          <h2 style={{ fontWeight: 900, color: "var(--primary-dark)", marginBottom: 12 }}>Мероприятие создано!</h2>
          <p style={{ color: "var(--text-muted)", fontSize: 15, marginBottom: 8 }}>
            «{title}» успешно создано
            {sections.filter(s => s.title).length > 0 && ` с ${sections.filter(s => s.title).length} секциями`}.
          </p>
          {sections.filter(s => s.curator).length > 0 && (
            <p style={{ color: "#16a34a", fontSize: 13, fontWeight: 700, marginBottom: 20 }}>
              ✅ Кураторы назначены для {sections.filter(s => s.curator).length} секций
            </p>
          )}
          {demoMode && (
            <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "8px 14px", marginBottom: 20, fontSize: 12, color: "#92400e", fontWeight: 600 }}>
              Demo режим — данные не сохранены в БД
            </div>
          )}
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <button onClick={() => navigate("/dashboard")}
              style={{ padding: "12px 28px", background: "var(--primary)", color: "white", border: "none", borderRadius: 100, fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>
              В дашборд
            </button>
            {createdEventId && !demoMode && (
              <button onClick={() => navigate(`/manage/events/${createdEventId}`)}
                style={{ padding: "12px 28px", background: "var(--bg-medium)", color: "var(--primary)", border: "1.5px solid var(--border)", borderRadius: 100, fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>
                Управление мероприятием →
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

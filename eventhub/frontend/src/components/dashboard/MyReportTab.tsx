import React, { useEffect, useState } from "react";
import type { PresentationFormat, Report, User } from "../../api/apiClient";
import { reportsAPI } from "../../api/apiClient";
import { Spinner } from "../ui/Spinner";
import { ErrorBlock } from "../ui/ErrorBlock";
import { EmptyState } from "../ui/EmptyState";

// В demo режиме используем фиксированный доклад спикера.
const DEMO_REPORT: Report = {
  id: "demo-report-1",
  section_id: "s1",
  title: "Доклад участника",
  speaker_id: "u2",
  speaker_confirmed: true,
  presentation_format: "OFFLINE",
  start_time: "2026-03-17T10:00:00Z",
  end_time: "2026-03-17T10:30:00Z",
  description: "Как мы делали EventHub за 48 часов",
};

interface Props {
  user: User;
  demoMode: boolean;
}

export function MyReportTab({ user, demoMode }: Props) {
  const [report, setReport] = useState<Report | null>(demoMode ? DEMO_REPORT : null);
  const [loading, setLoading] = useState(!demoMode);
  const [bio, setBio] = useState(user.bio ?? "");
  const [photoUrl, setPhotoUrl] = useState(user.photo_url ?? "");
  const [confirmed, setConfirmed] = useState(report?.speaker_confirmed ?? false);
  const [format, setFormat] = useState<PresentationFormat | "">(
    report?.presentation_format ?? ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Загружаем доклады спикера из бэка
  useEffect(() => {
    if (demoMode) return;
    setLoading(true);
    reportsAPI
      .getMy()
      .then((res) => {
        const reports = res.data || [];
        if (reports.length > 0) {
          const r = reports[0];
          setReport(r);
          setConfirmed(r.speaker_confirmed);
          setFormat(r.presentation_format ?? "");
        }
      })
      .catch((e) => setError(e?.response?.data?.detail || e?.message || "Не удалось загрузить доклад"))
      .finally(() => setLoading(false));
  }, [demoMode]);

  const handleSave = async () => {
    if (!report) return;
    setSaving(true);
    setError("");

    if (demoMode) {
      setReport((prev) =>
        prev
          ? {
              ...prev,
              speaker_confirmed: confirmed,
              presentation_format: (format || prev.presentation_format) ?? "OFFLINE",
              description: prev.description,
            }
          : prev
      );
      setSaving(false);
      return;
    }

    try {
      await reportsAPI.update(report.id, {
        speaker_confirmed: confirmed,
        presentation_format: format || null,
      });
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || "Не удалось сохранить доклад");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Spinner label="Загружаем данные доклада..." />;
  }

  if (!demoMode && !report) {
    return (
      <EmptyState
        icon="🎤"
        title="У вас пока нет назначенных докладов"
        description="Когда организатор назначит вас спикером на доклад, он появится здесь."
      />
    );
  }

  if (!report) {
    return <Spinner label="Загружаем данные доклада..." />;
  }

  return (
    <div>
      <h2 style={{ fontWeight: 800, marginBottom: 16 }}>Мой доклад</h2>
      <p style={{ color: "#64748b", fontWeight: 600, marginBottom: 20 }}>
        Здесь можно обновить информацию о себе как о спикере и подтвердить участие.
      </p>

      {error && <ErrorBlock message={error} />}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1.5fr)", gap: 24 }}>
        <div style={{ background: "white", borderRadius: 16, padding: 24, boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#777", marginBottom: 4 }}>Название доклада</div>
            <div style={{ fontWeight: 900, fontSize: 16 }}>{report.title}</div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 700, color: "#64748b", marginBottom: 4, display: "block" }}>
              Bio
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={4}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #dbe7ff",
                resize: "vertical",
                fontFamily: "Nunito, sans-serif",
                fontSize: 13,
              }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 700, color: "#64748b", marginBottom: 4, display: "block" }}>
              Ссылка на фото
            </label>
            <input
              type="url"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #dbe7ff",
                fontSize: 13,
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 700, color: "#64748b" }}>Формат выступления</label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as PresentationFormat | "")}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid #dbe7ff",
                fontSize: 13,
              }}
            >
              <option value="">Не выбран</option>
              <option value="OFFLINE">OFFLINE</option>
              <option value="ONLINE">ONLINE</option>
            </select>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#334155" }}>
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
            Подтверждаю участие как спикер
          </label>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            style={{
              marginTop: 18,
              padding: "10px 20px",
              borderRadius: 999,
              border: "none",
              background: "linear-gradient(135deg, #007bff, #0056b3)",
              color: "white",
              fontWeight: 800,
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "Сохранение..." : "Сохранить"}
          </button>
        </div>

        <div style={{ background: "white", borderRadius: 16, padding: 24, boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
          <div
            style={{
              background: "#f8fafc",
              borderRadius: 14,
              padding: 16,
              textAlign: "center",
              marginBottom: 16,
            }}
          >
            <div
              style={{
                width: 96,
                height: 96,
                borderRadius: "50%",
                background: "#e5edff",
                margin: "0 auto 8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 36,
                fontWeight: 900,
                color: "#00296b",
              }}
            >
              {user.full_name[0]}
            </div>
            <div style={{ fontWeight: 900, marginBottom: 4 }}>{user.full_name}</div>
            <div style={{ fontSize: 13, color: "#64748b" }}>{user.organization}</div>
          </div>

          <div
            style={{
              background: confirmed ? "#ecfdf5" : "#f9fafb",
              borderRadius: 12,
              padding: 14,
              border: confirmed ? "1px solid #4ade80" : "1px dashed #cbd5f5",
              fontSize: 13,
              fontWeight: 700,
              color: confirmed ? "#166534" : "#64748b",
            }}
          >
            {confirmed ? "Статус: доклад подтверждён ✅" : "Статус: ожидает подтверждения"}
          </div>
        </div>
      </div>
    </div>
  );
}


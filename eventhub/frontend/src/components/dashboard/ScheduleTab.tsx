import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { participantsAPI } from "../../api/apiClient";
import type { MyScheduleItem } from "../../api/apiClient";
import { ErrorBlock } from "../ui/ErrorBlock";
import { EmptyState } from "../ui/EmptyState";
import { Spinner } from "../ui/Spinner";

type DemoScheduleItem = MyScheduleItem;

const DEMO_SCHEDULE: DemoScheduleItem[] = [
  {
    event_id: "e2",
    section: {
      id: "s1",
      title: "Пленарная секция",
      format: "SEQUENTIAL",
      location: "Зал А",
      section_start: "2026-03-17T09:00:00Z",
      section_end: "2026-03-17T12:00:00Z",
      reports: [],
    },
    report: {
      id: "r4",
      title: "Открытие хакатона",
      start_time: "2026-03-17T09:00:00Z",
      end_time: "2026-03-17T09:30:00Z",
      speaker_name: "Оргкомитет",
      description: "Брифинг команд и вводная часть",
    },
  },
];

function formatTime(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

export function ScheduleTab({ demoMode }: { demoMode: boolean }) {
  const [items, setItems] = useState<MyScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  const load = useCallback(() => {
    setLoading(true);
    setError("");

    if (demoMode) {
      setItems(DEMO_SCHEDULE);
      setLoading(false);
      return;
    }

    participantsAPI
      .getMySchedule()
      .then((res) => setItems(res.data || []))
      .catch((e) => setError(e?.response?.data?.detail || e?.message || "Не удалось загрузить расписание"))
      .finally(() => setLoading(false));
  }, [demoMode]);

  useEffect(() => {
    load();
  }, [load]);

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      const ta = a.report.start_time ? new Date(a.report.start_time).getTime() : 0;
      const tb = b.report.start_time ? new Date(b.report.start_time).getTime() : 0;
      return ta - tb;
    });
  }, [items]);

  const handleRemove = async (reportId: string) => {
    if (demoMode) {
      setItems((prev) => prev.filter((x) => x.report.id !== reportId));
      return;
    }
    try {
      await participantsAPI.removeFromSchedule(reportId);
      setItems((prev) => prev.filter((x) => x.report.id !== reportId));
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || "Не удалось убрать из расписания");
    }
  };

  if (loading) return <Spinner label="Загружаем расписание..." />;
  if (error) return <ErrorBlock message={error} onRetry={load} />;

  if (sorted.length === 0) {
    return <EmptyState icon="📅" title="Расписание пустое" description="Добавьте доклады из программы мероприятия." />;
  }

  return (
    <div>
      <h2 style={{ fontWeight: 800, marginBottom: 18 }}>Расписание</h2>
      <div style={{ display: "grid", gap: 12 }}>
        {sorted.map((it) => (
          <div
            key={it.report.id}
            style={{
              background: "white",
              borderRadius: 16,
              padding: "16px 18px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
              borderLeft: "5px solid var(--primary)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: "var(--primary)", marginBottom: 6 }}>
                  {formatTime(it.report.start_time)}–{formatTime(it.report.end_time)} · {it.section.location || "Локация: —"}
                </div>
                <Link to={`/reports/${it.report.id}`} style={{ fontWeight: 900, fontSize: 16, color: "var(--primary-dark)" }}>
                  {it.report.title}
                </Link>
                <div style={{ marginTop: 6, color: "#64748b", fontWeight: 700, fontSize: 13 }}>
                  Секция: {it.section.title}
                  {it.report.speaker_name ? ` · Спикер: ${it.report.speaker_name}` : ""}
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleRemove(it.report.id)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #fecaca",
                  background: "#fff1f2",
                  color: "#b91c1c",
                  fontWeight: 900,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                Убрать
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


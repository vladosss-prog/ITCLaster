import React from "react";

export function EmptyState({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div style={{ textAlign: "center", padding: "48px 20px", color: "var(--text-muted)" }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontWeight: 800, fontSize: 16, color: "var(--primary-dark)", marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 14 }}>{description}</div>
    </div>
  );
}

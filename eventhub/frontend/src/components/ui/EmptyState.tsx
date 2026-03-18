import React from "react";

export function EmptyState({
  icon,
  title,
  description,
  className = "",
  actions,
}: {
  icon?: string;
  title: string;
  description?: string;
  className?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className={`ui-empty ${className}`.trim()}>
      {icon ? <div className="ui-empty__icon">{icon}</div> : null}
      <div className="ui-empty__title">{title}</div>
      {description ? <div className="ui-empty__desc">{description}</div> : null}
      {actions ? <div className="ui-empty__actions">{actions}</div> : null}
    </div>
  );
}


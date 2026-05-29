"use client";

import QuickActionCard from "../components/QuickActionCard";

export default function QuickActions({
  actions,
  onNavigate,
}) {
  return (
    <div className="mt-6">
      <p className="text-[12px] text-[var(--text-muted)] tracking-[0.5px] font-medium mb-3">
        ACCESO RÁPIDO
      </p>

      <div className="flex flex-col gap-[10px]">
        {actions.map((action) => (
          <QuickActionCard
            key={action.label}
            {...action}
            onClick={() =>
              action.path &&
              onNavigate(action.path)
            }
          />
        ))}
      </div>
    </div>
  );
}
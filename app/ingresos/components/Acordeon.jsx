"use client";

import { ChevronDown } from "lucide-react";

export default function Acordeon({
  titulo,
  total,
  subtitle,
  open,
  onToggle,
  children,
  empty = false,
}) {
  if (empty) {
    return (
      <div className="overflow-hidden rounded-[22px] border border-[rgba(138,100,255,0.18)] bg-glass backdrop-blur-[18px] px-4 py-[14px]">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-sora text-[14px] font-semibold text-text">
              {titulo}
            </p>

            <p className="mt-[6px] text-[11px] text-text-muted">
              Sin movimientos este mes
            </p>
          </div>

          <div className="text-right shrink-0">
            <p className="font-sora text-[15px] font-bold text-accent-light">
              $0
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[22px] border border-[rgba(138,100,255,0.18)] bg-glass backdrop-blur-[18px]">
      <button
        onClick={onToggle}
        className="flex w-full items-start justify-between px-4 py-[14px]"
      >
        {/* LEFT */}
        <div className="min-w-0 text-left">
          <p className="font-sora text-[14px] font-semibold text-text">
            {titulo}
          </p>
        </div>

        {/* RIGHT */}
        <div className="flex items-start gap-3 shrink-0">
          <div className="text-right">
            <p className="font-sora whitespace-nowrap text-[15px] font-bold text-accent-light">
              $
              {Number(total || 0).toLocaleString(
                "es-AR",
              )}
            </p>

            {subtitle && (
              <p className="mt-[2px] text-[11px] text-[#5EE0C5]">
                {subtitle}
              </p>
            )}
          </div>

          <div
            className={`mt-[1px] transition-transform duration-200 ${
              open
                ? "rotate-180"
                : ""
            }`}
          >
            <ChevronDown
              size={18}
              className="text-text-muted"
            />
          </div>
        </div>
      </button>

      {open && (
        <div className="border-t border-[rgba(138,100,255,0.08)] px-4 py-2">
          {children}
        </div>
      )}
    </div>
  );
}
"use client";

import { useState } from "react";

// Selector de mes compartido por /gastos, /gastos-fijos, /ingresos y
// /reintegros. 5.2 agrega dos props OPCIONALES para /balances:
//  - yearNavigation: flechas de año (default false = comportamiento actual)
//  - maxMonth: deshabilita meses posteriores (default null = sin límite)
export default function MonthSelectorModal({
  open,
  value,
  onClose,
  onSelect,
  yearNavigation = false,
  maxMonth = null,
}) {
  const [viewYear, setViewYear] = useState(
    () => value?.getFullYear() ?? new Date().getFullYear(),
  );

  if (!open) return null;

  const now = new Date();

  const currentYear =
    now.getFullYear();

  const year = yearNavigation
    ? viewYear
    : currentYear;

  const minYear = currentYear - 10;

  const months = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ];

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[999] flex items-center justify-center bg-[rgba(0,0,0,0.45)] p-4 backdrop-blur-[6px]"
    >
      <div
        onClick={(e) =>
          e.stopPropagation()
        }
        className="w-full max-w-[360px] rounded-[20px] border border-border bg-[rgba(20,16,30,0.92)] p-[18px] shadow-[0px_10px_30px_rgba(0,0,0,0.2)] backdrop-blur-[18px]"
      >
        {/* HEADER */}
        <div className="mb-[14px] flex items-center justify-between">
          <h3 className="font-sora text-[16px] font-bold text-text">
            Seleccionar mes
          </h3>

          <button
            onClick={onClose}
            className="cursor-pointer border-none bg-transparent text-[18px] text-text"
          >
            ✕
          </button>
        </div>

        {/* GRID */}
        <div className="grid grid-cols-2 gap-[10px]">
          {months.map((m, i) => {
            const date =
              new Date(year, i, 1);

            const isSelected =
              value?.getMonth() === i &&
              value?.getFullYear() === year;

            const disabled =
              !!maxMonth && date > maxMonth;

            return (
              <button
                key={m}
                type="button"
                disabled={disabled}
                onClick={() => {
                  onSelect(date);
                  onClose();
                }}
                className={`rounded-[12px] px-3 py-3 font-sora text-[13px] font-semibold transition-all duration-200 ${
                  disabled
                    ? "cursor-not-allowed border border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.02)] text-[rgba(255,255,255,0.3)]"
                    : "cursor-pointer"
                } ${
                  !disabled && isSelected
                    ? "border border-accent2 bg-[rgba(138,100,255,0.25)] text-text"
                    : ""
                } ${
                  !disabled && !isSelected
                    ? "border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] text-[rgba(255,255,255,0.7)]"
                    : ""
                }`}
              >
                {m}
              </button>
            );
          })}
        </div>

        {/* FOOTER */}
        {yearNavigation ? (
          <div className="mt-[14px] flex items-center justify-between">
            <button
              type="button"
              aria-label="Año anterior"
              disabled={year <= minYear}
              onClick={() =>
                setViewYear((actual) =>
                  Math.max(minYear, actual - 1),
                )
              }
              className="cursor-pointer rounded-[8px] px-2 py-1 text-[18px] text-text disabled:cursor-not-allowed disabled:opacity-30"
            >
              ‹
            </button>

            <span className="font-sora text-[12px] text-[rgba(255,255,255,0.5)]">
              {year}
            </span>

            <button
              type="button"
              aria-label="Año siguiente"
              disabled={year >= currentYear}
              onClick={() =>
                setViewYear((actual) =>
                  Math.min(currentYear, actual + 1),
                )
              }
              className="cursor-pointer rounded-[8px] px-2 py-1 text-[18px] text-text disabled:cursor-not-allowed disabled:opacity-30"
            >
              ›
            </button>
          </div>
        ) : (
          <div className="mt-[14px] flex justify-center">
            <span className="font-sora text-[12px] text-[rgba(255,255,255,0.5)]">
              {currentYear}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import IconChevron from "@/app/components/icons/IconChevron";

export default function QuickActionCard({
  icon: Icon,
  label,
  sub,
  color,
  colorBg,
  colorBorder,
  disabled,
  onClick,
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-[14px] rounded-[18px] px-4 py-[14px] text-left backdrop-blur-[16px] transition-all duration-150 border ${
        disabled
          ? "cursor-default opacity-45"
          : "cursor-pointer hover:-translate-y-[1px]"
      }`}
      style={{
        background: colorBg,
        borderColor: colorBorder,
      }}
    >
      <div
        className={`w-[38px] h-[38px] rounded-[12px] flex items-center justify-center shrink-0 ${
          disabled
            ? "bg-white/5"
            : "bg-accent/15"
        }`}
        style={{
          color,
        }}
      >
        <Icon size={20} />
      </div>

      <div className="flex-1">
        <p
          className={`text-[14px] font-semibold tracking-[-0.2px] font-display ${
            disabled
              ? "text-text-muted"
              : "text-text"
          }`}
        >
          {label}
        </p>

        <p className="text-[12px] mt-[2px] text-text-muted">
          {sub}
        </p>
      </div>

      {!disabled && (
        <IconChevron
          size={16}
          color="var(--accent)"
        />
      )}
    </button>
  );
}
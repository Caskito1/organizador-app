export default function Acordeon({
  titulo,
  total,
  subtitle,

  open,
  onToggle,

  children,

  empty = false,
}) 


{
  if (empty) {
   
    return (
      <div className="overflow-hidden rounded-[20px] border border-border bg-[rgba(138,100,255,0.07)] backdrop-blur-[16px] px-[18px] py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="font-sora text-[15px] font-semibold text-text">
              {titulo}
            </span>

            {subtitle && (
              <p className="mt-[3px] text-[10px] text-text-muted">
                {subtitle}
              </p>
            )}
          </div>

          <span className="font-sora whitespace-nowrap text-[15px] font-bold text-accent-light">
            $0
          </span>
        </div>

        <p className="mt-3 text-[12px] text-text-muted">
          Sin movimientos este mes
        </p>
      </div>
    );
  }

  return (
    
    <div className="overflow-hidden rounded-[20px] border border-border bg-[rgba(138,100,255,0.07)] backdrop-blur-[16px]">
    <button
  onClick={onToggle}
  className="flex w-full items-center justify-between bg-transparent px-[18px] py-4 border-none cursor-pointer"
>
  {/* LEFT */}

  <div className="min-w-0 text-left">
    <span className="font-sora text-[15px] font-semibold text-text">
    
      {titulo}
    </span>
  </div>

  {/* RIGHT */}

  <div className="flex items-center gap-[10px]">
    <div className="flex flex-col items-end">
      <span className="font-sora whitespace-nowrap text-[15px] font-bold text-accent-light leading-none">
        $
        {Number(total).toLocaleString(
          "es-AR",
        )}
      </span>

      {subtitle && (
        <span className="mt-[4px] text-[10px] font-medium text-[var(--user-b)] leading-none">
          {subtitle}
        </span>
      )}
    </div>

    <div
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-[8px] bg-[rgba(138,100,255,0.15)] text-accent2 transition-transform duration-200 ${
        open
          ? "rotate-180"
          : "rotate-0"
      }`}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>
  </div>
</button>

      {open && (
        <div className="flex flex-col gap-1 px-[18px] pb-4">
          {children}
        </div>
      )}
    </div>
  );
}
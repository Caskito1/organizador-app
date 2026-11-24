// balances/components/BotonOpciones.jsx
// Disparador del menú ⋮ (mismo patrón visual que FilaReintegro.jsx:93-117).

"use client";

export default function BotonOpciones({ etiqueta, onClick }) {
  return (
    <button
      type="button"
      aria-label={etiqueta}
      onClick={onClick}
      className="inline-flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded-[10px] text-text-muted/60 transition-colors hover:bg-white/6 hover:text-text-muted"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <circle cx="12" cy="5" r="2" />
        <circle cx="12" cy="12" r="2" />
        <circle cx="12" cy="19" r="2" />
      </svg>
    </button>
  );
}

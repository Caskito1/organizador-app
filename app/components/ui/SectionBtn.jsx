// /components/agregar/shared/SelectBtn.jsx

export default function SelectBtn({
  label,
  active,
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        padding: "13px 18px",
        borderRadius: "14px",
        textAlign: "left",
        border: `1px solid ${
          active
            ? "rgba(138,100,255,0.55)"
            : "var(--border)"
        }`,
        background: active
          ? "rgba(138,100,255,0.18)"
          : "rgba(255,255,255,0.03)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        color: active
          ? "var(--accent-light)"
          : "var(--text)",
        fontSize: "14px",
        fontWeight: active ? 600 : 400,
        fontFamily: "var(--font-body)",
        cursor: "pointer",
        transition: "all 0.15s",
        boxShadow: active
          ? "0 0 16px rgba(138,100,255,0.2)"
          : "none",
      }}
    >
      {label}
    </button>
  );
}
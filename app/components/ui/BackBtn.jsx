// components/ui/BackBtn.jsx

import IconBack from "../icons/IconBack";

export default function BackBtn({
  onClick,
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "36px",
        height: "36px",
        borderRadius: "11px",
        background:
          "rgba(255,255,255,0.05)",
        border:
          "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        flexShrink: 0,
      }}
    >
      <IconBack />
    </button>
  );
}
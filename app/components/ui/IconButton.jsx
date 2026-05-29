// components/ui/IconButton.jsx

export default function IconButton({
  children,
  onClick,
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "36px",
        height: "36px",
        borderRadius: "10px",
        background:
          "rgba(138,100,255,0.12)",
        border:
          "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        color: "var(--accent2)",
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}
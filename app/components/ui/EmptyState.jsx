// components/ui/EmptyState.jsx

export default function EmptyState({
  text = "Sin datos",
}) {
  return (
    <p
      style={{
        fontSize: "13px",
        color:
          "var(--text-muted)",
        padding: "8px 0",
      }}
    >
      {text}
    </p>
  );
}
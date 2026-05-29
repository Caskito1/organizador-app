// /components/agregar/shared/SectionLabel.jsx

export default function SectionLabel({ children }) {
  return (
    <p
      style={{
        fontSize: "11px",
        fontWeight: 500,
        letterSpacing: "0.5px",
        textTransform: "uppercase",
        color: "var(--text-muted)",
        marginBottom: "10px",
      }}
    >
      {children}
    </p>
  );
}
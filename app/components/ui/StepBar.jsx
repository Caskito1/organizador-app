// /components/agregar/shared/StepBar.jsx

export default function StepBar({ current, total }) {
  return (
    <div
      style={{
        display: "flex",
        gap: "5px",
        marginBottom: "24px",
      }}
    >
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: "3px",
            borderRadius: "99px",
            background:
              i < current
                ? "var(--accent)"
                : "rgba(138,100,255,0.15)",
            transition: "background 0.3s",
          }}
        />
      ))}
    </div>
  );
}
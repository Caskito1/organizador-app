// components/ui/LoadingScreen.jsx

export default function LoadingScreen({
  text = "Cargando...",
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor:
          "var(--bg)",
      }}
    >
      <div
        style={{
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "12px",
            background:
              "rgba(138,100,255,0.2)",
            border:
              "1px solid rgba(138,100,255,0.3)",
            margin:
              "0 auto 12px",
            display: "flex",
            alignItems: "center",
            justifyContent:
              "center",
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--accent2)"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <line
              x1="12"
              y1="1"
              x2="12"
              y2="23"
            />

            <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
          </svg>
        </div>

        <p
          style={{
            fontSize: "13px",
            color:
              "var(--text-muted)",
          }}
        >
          {text}
        </p>
      </div>
    </div>
  );
}
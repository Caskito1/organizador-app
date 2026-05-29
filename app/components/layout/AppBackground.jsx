// components/layout/AppBackground.jsx

export default function AppBackground({
  children,
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-bg">
      {/* Glow superior */}
      <div
        className="fixed left-1/2 top-[-60px] w-[300px] h-[300px] rounded-full pointer-events-none -translate-x-1/2"
        style={{
          background:
            "radial-gradient(circle, rgba(138,100,255,0.15) 0%, transparent 70%)",
        }}
      />

      {/* Glow lateral */}
      <div
        className="fixed bottom-[100px] right-[-60px] w-[200px] h-[200px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(94,224,197,0.06) 0%, transparent 70%)",
        }}
      />

      {/* Content */}
      <div className="relative z-[1] min-h-screen">
        {children}
      </div>
    </div>
  );
}
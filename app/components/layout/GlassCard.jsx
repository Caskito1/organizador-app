

export default function GlassCard({
  children,
  className = "",
  padding = "p-[18px]",
  style = {},
}) {
  return (
    <div
      className={`overflow-hidden rounded-[20px] border border-border bg-glass backdrop-blur-[16px] ${padding} ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}
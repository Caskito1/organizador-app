// components/layout/SectionBlock.jsx

export default function SectionBlock({
  children,
  gap = "10px",
  marginTop = "16px",
}) {
  return (
    <div
      className="flex flex-col"
      style={{
        gap,
        marginTop,
      }}
    >
      {children}
    </div>
  );
}
// components/icons/IconChevron.jsx

export default function IconChevron({
  size = 12,
  color = "currentColor",
  open = false,
}) {
  return (
    <div
      style={{
        transform: open
          ? "rotate(180deg)"
          : "rotate(0deg)",

        transition:
          "transform 0.2s",
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>
  );
}
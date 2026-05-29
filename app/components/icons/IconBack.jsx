// components/icons/IconBack.jsx

export default function IconBack({
  size = 18,
  color = "var(--accent2)",
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line
        x1="19"
        y1="12"
        x2="5"
        y2="12"
      />

      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}
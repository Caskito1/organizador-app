// components/icons/IconPersonal.jsx

export default function IconPersonal({
  size = 16,
  color = "currentColor",
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle
        cx="12"
        cy="8"
        r="4"
      />

      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}
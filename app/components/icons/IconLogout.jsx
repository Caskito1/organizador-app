export default function IconLogout({
  size = 20,
  color = "currentColor",
  strokeWidth = 1.8,
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* puerta */}
      <path d="M9 3h8a2 2 0 012 2v14a2 2 0 01-2 2H9" />

      {/* flecha */}
      <path d="M16 12H3" />
      <path d="M7 8l-4 4 4 4" />
    </svg>
  );
}
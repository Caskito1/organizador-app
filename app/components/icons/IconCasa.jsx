// components/icons/IconCasa.jsx

export default function IconCasa({
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
      <path d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1H5a1 1 0 01-1-1V10.5z" />

      <path d="M9 21V12h6v9" />

      <path d="M15 3v3.5" />

      <path d="M13 3h4v4" />
    </svg>
  );
}
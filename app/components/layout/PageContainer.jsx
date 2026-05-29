// components/layout/PageContainer.jsx

export default function PageContainer({
  children,
  className = "",
}) {
  return (
    <div className={`relative z-[1] w-full max-w-[430px] mx-auto px-5 ${className}`}>
      {children}
    </div>
  );
}
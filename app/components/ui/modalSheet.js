// components/ui/modalSheet.js
// 4.3a (ajuste 21/10/2026) — Clases del contenedor «hoja» (bottom sheet)
// de los modales, en una constante compartida para no repetirlas. El
// padding inferior (125px + safe-area) deja el botón de registrar visible
// por encima del menú inferior fijo (fixed bottom-0, z-50) sin scroll
// extra. La usan DevolucionModal y ReintegroModal (alta); EditarReintegroModal
// la reutilizará en 4.3b.
export const MODAL_SHEET_CLASSES =
  "max-h-[88vh] w-full max-w-[430px] overflow-y-auto rounded-t-[28px] border-t border-border bg-[rgba(18,14,28,0.97)] px-5 pt-5 pb-[calc(125px+env(safe-area-inset-bottom))]";

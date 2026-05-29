// gastos/sections/GastosHeader.jsx

import BackBtn from "@/app/components/ui/BackBtn";
import IconButton from "@/app/components/ui/IconButton";

import IconCalendar from "@/app/components/icons/IconCalendar";

export default function GastosHeader({
  router,
  mesActual,
  onOpenCalendar,
}) {
  function getMesLabel(date) {
    return date.toLocaleString(
      "es-AR",
      {
        month: "long",
        year: "numeric",
      },
    );
  }

  return (
    <div className="flex items-center justify-between pt-14 pb-2">
      <div className="flex items-center gap-3">
        <BackBtn
          onClick={() =>
            router.back()
          }
        />

        <h1 className="font-display text-[20px] font-bold text-text tracking-[-0.4px] capitalize">
          Gastos ·{" "}
          {getMesLabel(
            mesActual,
          )}
        </h1>
      </div>

      <IconButton
        onClick={
          onOpenCalendar
        }
      >
        <IconCalendar />
      </IconButton>
    </div>
  );
}
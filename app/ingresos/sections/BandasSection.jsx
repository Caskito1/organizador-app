import Acordeon from "@/app/gastos/components/Acordeon";

export default function BandasSection({
  ingresos,
  open,
  onToggle,
}) {
  const bandas = ingresos.reduce(
    (acc, ingreso) => {
      const key =
        ingreso.subtipo || "Sin banda";

      if (!acc[key]) {
        acc[key] = [];
      }

      acc[key].push(ingreso);

      return acc;
    },
    {},
  );

  const totalGeneral =
    ingresos.reduce(
      (a, i) =>
        a + Number(i.monto || 0),
      0,
    );

  return (
    <Acordeon
      titulo="Bandas"
      total={totalGeneral}
      open={open}
      onToggle={onToggle}
      empty={!ingresos.length}
    >
      <div className="flex flex-col gap-3">
        {Object.entries(bandas).map(
          ([banda, items]) => {
            const totalBanda =
              items.reduce(
                (a, i) =>
                  a +
                  Number(
                    i.monto || 0,
                  ),
                0,
              );

            return (
              <div
                key={banda}
                className="rounded-[16px] border border-[rgba(138,100,255,0.12)] bg-[rgba(255,255,255,0.02)] overflow-hidden"
              >
                {/* HEADER BANDA */}

                <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(138,100,255,0.08)]">
                  <p className="font-sora text-[14px] font-semibold capitalize text-text">
                    {banda}
                  </p>

                  <p className="font-sora text-[14px] font-bold text-accent-light">
                    $
                    {totalBanda.toLocaleString(
                      "es-AR",
                    )}
                  </p>
                </div>

                {/* ITEMS */}

                <div className="flex flex-col px-4 py-1">
                  {items.map((i) => {
                    const fecha =
                      i.createdAt
                        ?.toDate?.() ??
                      new Date(
                        i.createdAt,
                      );

                    return (
                      <div
                        key={i.id}
                        className="flex items-center justify-between py-[10px] border-b border-[rgba(138,100,255,0.08)] last:border-none"
                      >
                        <div>
                          <p className="text-[13px] text-text">
                            {i.detalle ||
                              "Ingreso"}
                          </p>

                          <p className="mt-[2px] text-[11px] text-text-muted">
                            {fecha.toLocaleDateString()}
                          </p>
                        </div>

                        <p className="font-sora text-[13px] font-bold text-text">
                          $
                          {Number(
                            i.monto,
                          ).toLocaleString(
                            "es-AR",
                          )}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          },
        )}
      </div>
    </Acordeon>
  );
}
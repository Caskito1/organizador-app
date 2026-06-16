export default function BalanceMesCard({
  balanceNeto,
  totalCompartido,
  totalPersonal,
  grupo,
  itemsQueDebo = [],
  itemsQueDebenAMi = [],
  saldarMes,
}) {
  const teDeben = balanceNeto > 0;
  const debes = balanceNeto < 0;
  const esNeutro = balanceNeto === 0;

  const montoAbsoluto = Math.abs(balanceNeto);

  return (
    <div className="mt-3 rounded-[22px] border border-[rgba(138,100,255,0.28)] bg-[linear-gradient(135deg,rgba(138,100,255,0.18),rgba(91,53,213,0.22))] px-[22px] py-5">

      {/* Totales del mes */}
      <div className="flex gap-3">
        <div className="flex-1">
          <p className="text-[11px] text-[rgba(200,174,255,0.65)] uppercase tracking-[0.5px] mb-[4px]">
            Compartido
          </p>
          <p className="font-sora text-[22px] font-bold text-accent-light leading-none">
            ${Number(totalCompartido).toLocaleString("es-AR")}
          </p>
        </div>

        <div className="w-[1px] bg-[rgba(138,100,255,0.2)]" />

        <div className="flex-1">
          <p className="text-[11px] text-[rgba(200,174,255,0.65)] uppercase tracking-[0.5px] mb-[4px]">
            Personal
          </p>
          <p className="font-sora text-[22px] font-bold text-accent-light leading-none">
            ${Number(totalPersonal).toLocaleString("es-AR")}
          </p>
        </div>
      </div>

      {/* Balance neto — solo si hay algo pendiente */}
      {!esNeutro && (
        <div className={`mt-4 rounded-[14px] border px-4 py-3 ${
          teDeben
            ? "border-[rgba(94,224,197,0.25)] bg-[rgba(94,224,197,0.08)]"
            : "border-[rgba(255,100,100,0.25)] bg-[rgba(255,100,100,0.08)]"
        }`}>
          <div className="flex justify-between items-center">
            <div>
              <p className="text-[11px] uppercase tracking-[0.4px] text-text-muted mb-[2px]">
                Balance con {grupo?.name ?? "el grupo"}
              </p>
              <p className={`text-[13px] font-semibold ${teDeben ? "text-[var(--user-b)]" : "text-[var(--negative)]"}`}>
                {teDeben
                  ? `Te deben $${montoAbsoluto.toLocaleString("es-AR")}`
                  : `Debés $${montoAbsoluto.toLocaleString("es-AR")}`}
              </p>

              {/* Desglose */}
              <div className="mt-2 flex flex-col gap-[3px]">
                {itemsQueDebenAMi.map((g) => {
                  const monto = Math.max(0,
                    (g.miParticipante?.pagado ?? 0) - (g.miParticipante?.corresponde ?? 0)
                  );
                  return (
                    <p key={g.id} className="text-[11px] text-text-muted">
                      {g.icon} {g.nombre}: +${monto.toLocaleString("es-AR")}
                    </p>
                  );
                })}
                {itemsQueDebo.map((g) => {
                  const monto = Math.max(0,
                    (g.otroParticipante?.pagado ?? 0) - (g.otroParticipante?.corresponde ?? 0)
                  );
                  return (
                    <p key={g.id} className="text-[11px] text-text-muted">
                      {g.icon} {g.nombre}: -${monto.toLocaleString("es-AR")}
                    </p>
                  );
                })}
              </div>
            </div>

            <p className={`font-sora text-[22px] font-bold flex-shrink-0 ml-3 ${
              teDeben ? "text-[var(--user-b)]" : "text-[var(--negative)]"
            }`}>
              ${montoAbsoluto.toLocaleString("es-AR")}
            </p>
          </div>

          {/* Botón saldar — solo si vos debés */}
          {debes && itemsQueDebo.length > 0 && (
            <button
              onClick={saldarMes}
              className="mt-3 w-full rounded-[14px] border border-[rgba(94,224,197,0.3)] bg-[rgba(94,224,197,0.1)] px-4 py-[10px] text-[13px] font-semibold text-[var(--user-b)] transition-all hover:bg-[rgba(94,224,197,0.18)]"
            >
              ✓ Saldar ${montoAbsoluto.toLocaleString("es-AR")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
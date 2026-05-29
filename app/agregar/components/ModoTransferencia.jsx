"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { useState } from "react";

import BackBtn from "@/app/components/ui/BackBtn";
import StepBar from "@/app/components/ui/StepBar";
import SectionLabel from "@/app/components/ui/SectionLabel";

import { useModoTransferencia } from "./transferencia/hooks/useModoTransferencia";
import { submitTransferencia } from "./transferencia/helpers/submitTransferencia";

export default function ModoTransferencia({ onBack }) {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const t = useModoTransferencia();

  const pasoIdx = t.PASOS_T.indexOf(t.paso);

  const titulos = {
    grupo: "¿A qué grupo?",
    detalle: "Detalle de la transferencia",
  };

  function volverPaso() {
    if (t.paso === "detalle") return t.setPaso("grupo");
    onBack();
  }

  async function handleSubmit() {
    if (!t.canSubmit) return;
    setLoading(true);
    try {
      await submitTransferencia({
        user,
        monto: t.monto,
        concepto: t.concepto,
        detalle: t.detalle,
        selectedGroupId: t.selectedGroupId,
        destinatarioUid: t.destinatarioUid,
        destinatarioNombre: t.destinatarioNombre,
      });
      router.push("/gastos");
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* HEADER */}
      <div className="flex items-center gap-3 pt-14 pb-4">
        <BackBtn onClick={volverPaso} />
        <div className="flex-1 min-w-0">
          <h1 className="font-sora text-[18px] font-bold tracking-[-0.4px] text-text">
            {titulos[t.paso]}
          </h1>
          {t.selectedGroupId && t.paso === "detalle" && (
            <p className="text-[11px] text-text-muted mt-[3px] overflow-hidden text-ellipsis whitespace-nowrap">
              {t.groups.find((g) => g.id === t.selectedGroupId)?.name}
              {t.destinatarioNombre ? ` › Para: ${t.destinatarioNombre}` : ""}
            </p>
          )}
        </div>
      </div>

      <StepBar current={pasoIdx + 1} total={t.PASOS_T.length} />

      {/* PASO: GRUPO */}
      {t.paso === "grupo" && (
        <div className="flex flex-col gap-4 mt-2">

          {/* ELEGIR GRUPO */}
          <div className="flex flex-col gap-2">
            <SectionLabel>Grupo</SectionLabel>

            {t.loadingGroups ? (
              <p className="text-[13px] text-text-muted">Cargando grupos...</p>
            ) : (
              t.groups.map((g) => {
                const active = t.selectedGroupId === g.id;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => t.seleccionarGrupo(g.id)}
                    className={`w-full rounded-[14px] border px-4 py-[13px] text-left text-[14px] transition-all duration-150 ${
                      active
                        ? "border-accent/60 bg-accent/18 text-accent-light font-semibold"
                        : "border-border bg-white/3 text-text"
                    }`}
                  >
                    {g.name}
                  </button>
                );
              })
            )}
          </div>

          {/* ELEGIR DESTINATARIO */}
          {t.selectedGroupId && (
            <div className="flex flex-col gap-2">
              <SectionLabel>¿Para quién es?</SectionLabel>

              {t.loadingMembers ? (
                <p className="text-[13px] text-text-muted">Cargando integrantes...</p>
              ) : t.miembros.length === 0 ? (
                <p className="text-[13px] text-text-muted">No hay otros integrantes en este grupo.</p>
              ) : (
                t.miembros.map((m) => {
                  const active = t.destinatarioUid === m.uid;
                  return (
                    <button
                      key={m.uid}
                      type="button"
                      onClick={() => t.seleccionarDestinatario(m.uid, m.displayName)}
                      className={`w-full rounded-[14px] border px-4 py-[13px] text-left text-[14px] transition-all duration-150 ${
                        active
                          ? "border-[rgba(94,224,197,0.55)] bg-[rgba(94,224,197,0.12)] text-[var(--user-b)] font-semibold"
                          : "border-border bg-white/3 text-text"
                      }`}
                    >
                      {m.displayName}
                    </button>
                  );
                })
              )}
            </div>
          )}

          <button
            type="button"
            disabled={!t.canProceed}
            onClick={t.irADetalle}
            className={`mt-1 w-full rounded-[16px] py-[15px] text-[15px] font-bold text-white transition-all duration-200 ${
              !t.canProceed
                ? "cursor-default bg-accent/30"
                : "cursor-pointer bg-gradient-to-br from-[#9d7bff] to-[#5b35d5] shadow-[0_8px_28px_rgba(138,100,255,0.38)] hover:scale-[1.01]"
            }`}
          >
            Continuar
          </button>
        </div>
      )}

      {/* PASO: DETALLE */}
      {t.paso === "detalle" && (
        <div className="flex flex-col gap-4 mt-2">

          {/* CONCEPTO */}
          <div className="flex flex-col gap-2">
            <SectionLabel>Concepto</SectionLabel>
            {t.CONCEPTOS.map((c) => {
              const active = t.concepto === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => t.setConcepto(c.id)}
                  className={`w-full rounded-[14px] border px-4 py-[13px] text-left text-[14px] transition-all duration-150 ${
                    active
                      ? "border-accent/60 bg-accent/18 text-accent-light font-semibold"
                      : "border-border bg-white/3 text-text"
                  }`}
                >
                  {c.label}
                </button>
              );
            })}
          </div>

          {/* DETALLE LIBRE si concepto = otros */}
          {t.concepto === "otros" && (
            <div className="flex flex-col gap-2">
              <SectionLabel>¿De qué es? (requerido)</SectionLabel>
              <input
                type="text"
                placeholder="Ej: Expensas, internet..."
                value={t.detalle}
                onChange={(e) => t.setDetalle(e.target.value)}
              />
            </div>
          )}

          {/* DESTINATARIO — solo lectura */}
          <div className="rounded-[14px] border border-[rgba(94,224,197,0.25)] bg-[rgba(94,224,197,0.07)] px-4 py-3">
            <p className="text-[11px] text-text-muted mb-[2px] uppercase tracking-[0.4px]">
              Para
            </p>
            <p className="text-[14px] font-semibold text-[var(--user-b)]">
              {t.destinatarioNombre}
            </p>
          </div>

          {/* MONTO */}
          <div className="relative overflow-hidden rounded-[22px] border border-accent/30 bg-gradient-to-br from-accent/15 to-[#5b35d5]/20 px-[22px] py-5 backdrop-blur-[20px]">
            <p className="mb-[10px] text-[11px] font-medium tracking-[0.5px] text-[#c8aeffa6]">
              MONTO ($)
            </p>
            <div className="flex items-center gap-1">
              <span className="font-sora text-[26px] font-bold leading-none text-accent-light">$</span>
              <input
                type="number"
                placeholder="0"
                value={t.monto}
                onChange={(e) => t.setMonto(e.target.value)}
                className="w-full border-none bg-transparent p-0 font-sora text-[34px] font-bold tracking-[-1px] text-text outline-none focus:ring-0"
              />
            </div>
          </div>

          {/* SUBMIT */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || !t.canSubmit}
            className={`mt-1 w-full rounded-[16px] py-[15px] text-[15px] font-bold text-white transition-all duration-200 ${
              !t.canSubmit || loading
                ? "cursor-default bg-accent/30"
                : "cursor-pointer bg-gradient-to-br from-[#9d7bff] to-[#5b35d5] shadow-[0_8px_28px_rgba(138,100,255,0.38)] hover:scale-[1.01]"
            }`}
          >
            {loading ? "Guardando..." : "Registrar transferencia"}
          </button>
        </div>
      )}
    </>
  );
}
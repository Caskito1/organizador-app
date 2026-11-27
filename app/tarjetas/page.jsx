// app/tarjetas/page.jsx
// 6.2 — Página /tarjetas (UI). Plan: PROPUESTA-ETAPA-6.md §12.
// Consume el modelo puro (6.0) y los servicios de persistencia (6.1).

"use client";

import { useState } from "react";

import Appshell from "@/app/components/layout/Appshell";
import GlassCard from "@/app/components/layout/GlassCard";
import MonthNavigator from "@/app/gastos/components/MonthNavigator";

import CerrarFacturaModal from "./components/CerrarFacturaModal";
import CompraModal from "./components/CompraModal";
import ConfigTarjetaCard from "./components/ConfigTarjetaCard";
import ConfirmarAccionModal from "./components/ConfirmarAccionModal";
import MenuAccionesSheet from "./components/MenuAccionesSheet";
import PagoModal from "./components/PagoModal";
import AvisoPendiente from "./sections/AvisoPendiente";
import ComprasCicloCard from "./sections/ComprasCicloCard";
import ResumenHeaderCard from "./sections/ResumenHeaderCard";
import TarjetasHeader from "./sections/TarjetasHeader";
import { etiquetaCiclo } from "./helpers/ciclo";
import { mesDeCiclo } from "./helpers/fechas";
import useTarjetas from "./hooks/useTarjetas";

export default function TarjetasPage() {
  const t = useTarjetas();

  const [calendarOpen, setCalendarOpen] = useState(false);
  const [editandoConfig, setEditandoConfig] = useState(false);
  const [modal, setModal] = useState(null);
  const [menu, setMenu] = useState(null);
  const [confirmar, setConfirmar] = useState(null);

  const perfilFaltante = !t.loading && !t.error && !t.existe;
  const sinTarjeta = !t.loading && !t.error && t.existe && !t.tarjeta;
  const listo = !t.loading && !t.error && t.existe && !!t.tarjeta;

  function abrirMenuCompra(compra) {
    setMenu({
      titulo: compra.detalle || "Compra",
      subtitulo: `${compra.tipo === "reintegro" ? "Reintegro" : "Personal"} · ${compra.moneda} · ${compra.cuotasTotal} cuota(s)`,
      items: [
        {
          id: "editar",
          label: "Editar",
          onSelect: async () => {
            // 6.3-bis: vínculo para precargar nombre y pre-validar el monto.
            const vinculo = await t.vinculoDe(compra);
            const devuelto = Number(vinculo?.devuelto || 0);
            const montoBloqueado =
              !!vinculo &&
              (devuelto > 0 ||
                vinculo.condonada ||
                vinculo.estado === "eliminada");
            let motivoMontoBloqueado = null;
            if (vinculo?.estado === "eliminada") {
              motivoMontoBloqueado =
                "El reintegro está eliminado; recreá el vínculo.";
            } else if (vinculo?.condonada) {
              motivoMontoBloqueado =
                "No se puede cambiar el monto: el reintegro está perdonado.";
            } else if (devuelto > 0) {
              motivoMontoBloqueado =
                "No se puede cambiar el monto: el reintegro ya tiene cobros registrados.";
            }

            setModal({
              tipo: "compra",
              compra,
              contraparteInicial:
                vinculo?.contraparteNombre ?? compra.contraparteNombre ?? null,
              montoBloqueado,
              motivoMontoBloqueado,
            });
          },
        },
        {
          id: "eliminar",
          label: "Eliminar",
          danger: true,
          onSelect: () =>
            setConfirmar({
              tipo: "compra",
              id: compra.id,
              titulo: "Eliminar compra",
              descripcion: `Se quitará «${compra.detalle || "Compra"}» del ciclo.`,
            }),
        },
      ],
    });
  }

  async function guardarCompra(compra, ids) {
    if (modal?.compra) {
      await t.acciones.actualizarCompra(modal.compra.id, compra);
    } else {
      await t.acciones.crearCompra(compra, ids);
    }
  }

  async function ejecutarConfirmacion() {
    if (confirmar?.tipo === "compra") {
      return t.acciones.borrarCompra(confirmar.id);
    }
    if (confirmar?.tipo === "recrear") {
      return t.acciones.recrearReintegro(confirmar.id);
    }
  }

  function pedirRecrear(compra) {
    setConfirmar({
      tipo: "recrear",
      id: compra.id,
      boton: "Recrear",
      peligro: false,
      titulo: "Recrear reintegro",
      descripcion:
        "Se creará una obligación nueva por el total y se vinculará a esta compra. El vínculo eliminado queda como histórico.",
    });
  }

  return (
    <Appshell>
      <div className="mx-auto max-w-[430px] relative z-[1]">
        <TarjetasHeader
          nombre={t.tarjeta?.nombre ?? null}
          onEditarConfig={
            listo && !t.pendiente ? () => setEditandoConfig(true) : null
          }
          onOpenCalendar={() => setCalendarOpen(true)}
        />

        {t.loading && (
          <p className="text-[13px] text-text-muted">Cargando tarjeta…</p>
        )}

        {!t.loading && t.error && (
          <div className="rounded-[12px] border border-negative/30 bg-negative/10 px-4 py-3 text-[13px] text-negative">
            <p>No se pudo cargar la tarjeta.</p>
            <button
              type="button"
              onClick={t.recargar}
              className="mt-2 cursor-pointer rounded-[12px] border border-negative/40 px-3 py-[6px] text-[12px] font-semibold text-negative transition-all hover:bg-negative/10"
            >
              Reintentar
            </button>
          </div>
        )}

        {perfilFaltante && (
          <GlassCard>
            <p className="text-[13px] font-semibold text-text">
              Falta tu perfil de usuario
            </p>
            <p className="mt-1 text-[12px] leading-[1.5] text-text-muted">
              No se pueden guardar datos de la tarjeta sin tu perfil. Revisá tu
              sesión o creá el perfil de usuario.
            </p>
          </GlassCard>
        )}

        {(sinTarjeta || (listo && editandoConfig)) && (
          <ConfigTarjetaCard
            inicial={t.tarjeta}
            guardando={t.guardando}
            onCancelar={
              editandoConfig ? () => setEditandoConfig(false) : undefined
            }
            onGuardar={async (config) => {
              await t.acciones.guardarConfig(config);
              setEditandoConfig(false);
            }}
          />
        )}

        {listo && !editandoConfig && (
          <div className="mt-4 flex flex-col gap-[10px] pb-10">
            <ResumenHeaderCard
              estado={t.estado}
              resumen={t.resumen}
              vencimientoLabel={t.vencimientoLabel}
              rangoLabel={t.rangoLabel}
            />

            {t.pendiente && (
              <AvisoPendiente
                etiqueta={etiquetaCiclo(t.pendiente)}
                bloqueado={t.bloqueado}
                onIr={
                  t.cicloKey !== t.pendiente
                    ? () =>
                        t.seleccionarCiclo(
                          mesDeCiclo(t.pendiente) ?? new Date(),
                        )
                    : null
                }
              />
            )}

            {/* CTAs (6.2-bis): Cargar solo en el ciclo actual y sin pendientes;
                Cerrar en el actual con datos y en el pendiente sin verificar;
                Pagar en cualquier por_pagar no bloqueado. */}
            {(t.puedeCargarCompra || t.puedeCerrarFactura) && (
              <div className="flex gap-2">
                {t.puedeCargarCompra && (
                  <button
                    type="button"
                    onClick={() => setModal({ tipo: "compra", compra: null })}
                    className="flex-1 cursor-pointer rounded-[14px] bg-gradient-to-br from-[#9d7bff] to-[#5b35d5] px-3 py-[11px] text-[13px] font-bold text-white shadow-[0_8px_28px_rgba(138,100,255,0.38)] transition-all hover:scale-[1.01]"
                  >
                    Cargar compra
                  </button>
                )}
                {t.puedeCerrarFactura && (
                  <button
                    type="button"
                    onClick={() => setModal({ tipo: "cerrar" })}
                    className="flex-1 cursor-pointer rounded-[14px] border border-accent/50 bg-accent/15 px-3 py-[11px] text-[13px] font-semibold text-accent-light transition-all hover:bg-accent/25"
                  >
                    Cerrar factura
                  </button>
                )}
              </div>
            )}

            {t.puedePagarResumen && (
              <button
                type="button"
                onClick={() => setModal({ tipo: "pago" })}
                className="w-full cursor-pointer rounded-[14px] bg-gradient-to-br from-[#9d7bff] to-[#5b35d5] px-3 py-[11px] text-[13px] font-bold text-white shadow-[0_8px_28px_rgba(138,100,255,0.38)] transition-all hover:scale-[1.01]"
              >
                Pagar resumen
              </button>
            )}

            <ComprasCicloCard
              comprasCiclo={t.comprasCiclo}
              resumen={t.resumen}
              esEditable={t.esCompraEditable}
              onMenu={abrirMenuCompra}
              vinculos={t.vinculos}
              onRecrear={pedirRecrear}
            />
          </div>
        )}
      </div>

      <MonthNavigator
        open={calendarOpen}
        value={mesDeCiclo(t.cicloKey) ?? new Date()}
        onClose={() => setCalendarOpen(false)}
        onSelect={(fecha) => t.seleccionarCiclo(fecha)}
        yearNavigation
        maxMonth={mesDeCiclo(t.cicloActual) ?? new Date()}
      />

      {modal?.tipo === "compra" && (
        <CompraModal
          inicial={modal.compra}
          contraparteInicial={modal.contraparteInicial ?? null}
          montoBloqueado={modal.montoBloqueado ?? false}
          motivoMontoBloqueado={modal.motivoMontoBloqueado ?? null}
          cicloKey={t.cicloKey}
          diaCierre={t.diaCierre}
          diaVencimiento={t.diaVencimiento}
          rangoLabel={t.rangoLabel}
          guardando={t.guardando}
          onClose={() => setModal(null)}
          onGuardar={guardarCompra}
        />
      )}

      {modal?.tipo === "pago" && (
        <PagoModal
          aPagar={t.resumen.total}
          guardando={t.guardando}
          onClose={() => setModal(null)}
          onGuardar={t.acciones.pagarResumen}
        />
      )}

      {modal?.tipo === "cerrar" && (
        <CerrarFacturaModal
          resumen={t.resumen}
          guardando={t.guardando}
          onClose={() => setModal(null)}
          onConfirmar={t.acciones.cerrarFactura}
        />
      )}

      {menu && <MenuAccionesSheet {...menu} onClose={() => setMenu(null)} />}

      {confirmar && (
        <ConfirmarAccionModal
          titulo={confirmar.titulo}
          descripcion={confirmar.descripcion}
          boton={confirmar.boton}
          peligro={confirmar.peligro}
          guardando={t.guardando}
          onClose={() => setConfirmar(null)}
          onConfirmar={ejecutarConfirmacion}
        />
      )}
    </Appshell>
  );
}

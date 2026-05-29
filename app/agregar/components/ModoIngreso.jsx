// components/ModoIngreso.jsx

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/lib/AuthContext";

import BackBtn from "@/app/components/ui/BackBtn";
import StepBar from "@/app/components/ui/StepBar";
import SectionLabel from "@/app/components/ui/SectionLabel";

import { useModoIngreso } from "./ingresos/hooks/useModoIngreso";
import { submitIngreso } from "./ingresos/helpers/submitIngreso";

import PasoTipoIngreso from "./ingresos/sections/PasoTipoIngreso";
import PasoDetalleIngreso from "./ingresos/sections/PasoDetalleIngreso";

export default function ModoIngreso({ onBack }) {
  const router = useRouter();

  const { user } = useAuth();

  const [loading, setLoading] = useState(false);

  const modo = useModoIngreso();

  const pasoIdx =
    modo.PASOS_I.indexOf(modo.paso);

  const titulos = {
    tipo: "¿Qué ingreso fue?",
    detalle: "Detalle del ingreso",
  };

  const breadcrumb = [
    modo.tipoLabel,
    modo.subtipoLabel,
  ]
    .filter(Boolean)
    .join(" › ");

const detalleRequired =
  modo.tipo === "freelance" ||
  modo.tipo === "otros";

const canSubmit =
  modo.monto &&
  (!detalleRequired ||
    modo.detalle.trim());

  function volverPaso() {
    if (modo.paso === "detalle") {
      return modo.setPaso("tipo");
    }

    onBack();
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!canSubmit) return;

    setLoading(true);

    try {
      await submitIngreso({
        user,

        tipo: modo.tipo,
        subtipo: modo.subtipo,

        detalle: modo.detalle,

        monto: modo.monto,
      });

      router.push("/ingresos");
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
            {titulos[modo.paso]}
          </h1>

          {breadcrumb && (
            <p className="text-[11px] text-text-muted mt-[3px] overflow-hidden text-ellipsis whitespace-nowrap">
              {breadcrumb}
            </p>
          )}
        </div>
      </div>

      {/* STEPBAR */}

      <StepBar
        current={pasoIdx + 1}
        total={modo.PASOS_I.length}
      />

      {/* PASO TIPO */}

      {modo.paso === "tipo" && (
        <PasoTipoIngreso
          tipo={modo.tipo}
          subtipo={modo.subtipo}
          seleccionarTipo={
            modo.seleccionarTipo
          }
          seleccionarBanda={
            modo.seleccionarBanda
          }
        />
      )}

      {/* PASO DETALLE */}

      {modo.paso === "detalle" && (
        <PasoDetalleIngreso
          modo={modo}
          loading={loading}
          canSubmit={canSubmit}
          handleSubmit={handleSubmit}
        />
      )}
    </>
  );
}
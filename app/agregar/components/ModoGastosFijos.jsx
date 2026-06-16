"use client";

import {
  useEffect,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import { useAuth } from "@/lib/AuthContext";
import { useGroups } from "@/lib/GroupContext";

import StepBar from "@/app/components/ui/StepBar";
import BackBtn from "@/app/components/ui/BackBtn";

import { useFixedExpense } from "./gastos-fijos/hooks/useFixedExpense";

import { submitFixedExpense } from "./gastos-fijos/helpers/fixedExpenseHelpers";

import PasoTipo from "./gastos-fijos/sections/PasoTipo";
import PasoDetalle from "./gastos-fijos/sections/PasoDetalle";
import PasoResumen from "./gastos-fijos/sections/PasoResumen";

export default function ModoGastosFijos({
  onBack,
}) {
  const router = useRouter();

  const { user } = useAuth();

  const {
    groups,
    loadingGroups,
  } = useGroups();

  const [loading, setLoading] =
    useState(false);

  const modo =
    useFixedExpense();

  const pasoIdx =
    modo.PASOS.indexOf(
      modo.paso,
    );

  useEffect(() => {
    if (
      groups.length === 1 &&
      !modo.selectedGroupId
    ) {
      modo.setSelectedGroupId(
        groups[0].id,
      );
    }
  }, [groups]);

  function volverPaso() {
    if (modo.paso === "resumen") {
      return modo.setPaso(
        "detalle",
      );
    }

    if (modo.paso === "detalle") {
      return modo.setPaso(
        "tipo",
      );
    }

    onBack();
  }

  async function handleSubmit() {
    if (!modo.item || !modo.monto)
      return;

    setLoading(true);

    try {
      await submitFixedExpense({
        user,

        item: modo.item,

        monto: modo.monto,

        fecha: modo.fecha,

        selectedGroupId:
          modo.selectedGroupId,
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
        <BackBtn
          onClick={volverPaso}
        />

        <div className="flex-1">
          <h1 className="font-sora text-[18px] font-bold text-text">
            Gasto fijo
          </h1>

          {modo.item && (
            <p className="mt-1 text-[11px] text-text-muted">
              {modo.item.nombre}
            </p>
          )}
        </div>
      </div>

      {/* STEPBAR */}

      <StepBar
        current={pasoIdx + 1}
        total={modo.PASOS.length}
      />

      {/* PASO TIPO */}

      {modo.paso === "tipo" && (
        <PasoTipo
          tipos={modo.tipos}
          tipoId={modo.tipoId}
          seleccionarTipo={
            modo.seleccionarTipo
          }
          seleccionarItem={
            modo.seleccionarItem
          }
        />
      )}

      {/* PASO DETALLE */}

      {modo.paso ===
        "detalle" && (
        <div className="mt-4">
          <PasoDetalle
            item={modo.item}
            monto={modo.monto}
            setMonto={
              modo.setMonto
            }
            fecha={modo.fecha}
            setFecha={
              modo.setFecha
            }
            groups={groups}
            selectedGroupId={
              modo.selectedGroupId
            }
            setSelectedGroupId={
              modo.setSelectedGroupId
            }
          />

          <button
            type="button"
            onClick={() =>
              modo.setPaso(
                "resumen",
              )
            }
            disabled={
              !modo.monto ||
              (modo.item
                ?.compartido &&
                !modo.selectedGroupId)
            }
            className="mt-6 w-full rounded-[16px] bg-gradient-to-br from-[#9d7bff] to-[#5b35d5] py-[15px] text-[15px] font-bold text-white disabled:opacity-40"
          >
            Continuar
          </button>
        </div>
      )}

      {/* PASO RESUMEN */}

      {modo.paso ===
        "resumen" && (
        <PasoResumen
          item={modo.item}
          monto={modo.monto}
          fecha={modo.fecha}
          loading={loading}
          handleSubmit={
            handleSubmit
          }
        />
      )}
    </>
  );
}
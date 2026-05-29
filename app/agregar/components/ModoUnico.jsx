"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { useAuth } from "@/lib/AuthContext";
import { useGroups } from "@/lib/GroupContext";

import {
  CATEGORIAS,
  UNIDADES,
} from "@/lib/taxonomia";

import StepBar from "@/app/components/ui/StepBar";
import SectionLabel from "@/app/components/ui/SectionLabel";
import BackBtn from "@/app/components/ui/BackBtn";

import { useModoUnico } from "./unico/hooks/useModoUnico";
import { submitUnico } from "./unico/helpers/submitUnico";

import PasoContexto from "./unico/sections/PasoContexto";
import PasoCategoria from "./unico/sections/PasoCategoria";
import PasoProducto from "./unico/sections/PasoProducto";

export default function ModoUnico({
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

  const modo = useModoUnico();

  const pasoIdx =
    modo.PASOS_U.indexOf(modo.paso);

  const titulos = {
    contexto: "¿Dónde fue?",
    categoria: "¿Qué categoría?",
    subcategoria: "¿Qué tipo?",
    producto: "¿Qué producto?",
    detalle: "Detalle del gasto",
  };

  const breadcrumb = [
    modo.contexto?.label,

    modo.catId
      ? CATEGORIAS[modo.catId]?.label
      : null,

    modo.subcatId
      ? CATEGORIAS[modo.catId]
          ?.subcategorias[
          modo.subcatId
        ]?.label
      : null,

    modo.esOtros
      ? "Otros"
      : modo.producto?.nombre,
  ]
    .filter(Boolean)
    .join(" › ");

  const canSubmit =
    modo.monto &&
    (!modo.esOtros ||
      modo.detalle.trim()) &&
    (modo.tipo !==
      "compartido" ||
      modo.selectedGroupId);

  function volverPaso() {
    if (modo.paso === "detalle") {
      return modo.setPaso(
        "producto",
      );
    }

    if (modo.paso === "producto") {
      return modo.setPaso(
        Object.keys(modo.subcats)
          .length === 1
          ? "categoria"
          : "subcategoria",
      );
    }

    if (
      modo.paso === "subcategoria"
    ) {
      return modo.setPaso(
        "categoria",
      );
    }

    if (
      modo.paso === "categoria"
    ) {
      return modo.setPaso(
        "contexto",
      );
    }

    onBack();
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!canSubmit) return;

    setLoading(true);

    try {
      await submitUnico({
        user,

        monto: modo.monto,

        producto: modo.producto,

        esOtros: modo.esOtros,

        detalle: modo.detalle,

        cantidad: modo.cantidad,

        unidadActual:
          modo.unidadActual,

        catId: modo.catId,

        subcatId: modo.subcatId,

        contexto: modo.contexto,

        tipo: modo.tipo,

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
        total={modo.PASOS_U.length}
      />

      {/* CONTEXTO */}

      {modo.paso ===
        "contexto" && (
        <PasoContexto
          contexto={
            modo.contexto
          }
          seleccionarContexto={
            modo.seleccionarContexto
          }
        />
      )}

      {/* CATEGORIA */}

      {modo.paso ===
        "categoria" && (
        <PasoCategoria
          catId={modo.catId}
          seleccionarCategoria={
            modo.seleccionarCategoria
          }
        />
      )}

      {/* SUBCATEGORIA */}

      {modo.paso ===
        "subcategoria" && (
        <div className="flex flex-col gap-2">
          {Object.entries(
            modo.subcats,
          ).map(([id, sub]) => (
            <button
              key={id}
              type="button"
              onClick={() =>
                modo.seleccionarSubcat(
                  id,
                )
              }
              className="w-full rounded-[14px] border border-border bg-white/3 px-4 py-[13px] text-left text-[14px] text-text transition-all duration-150 hover:border-accent/40 hover:bg-accent/8"
            >
              {sub.label}
            </button>
          ))}
        </div>
      )}

      {/* PRODUCTOS */}

      {modo.paso ===
        "producto" && (
        <div>
          <SectionLabel>
            Seleccioná un producto
          </SectionLabel>

          <PasoProducto
            productosConOtros={
              modo.productosConOtros
            }
            producto={
              modo.producto
            }
            esOtros={modo.esOtros}
            seleccionarProducto={
              modo.seleccionarProducto
            }
          />
        </div>
      )}

      {/* DETALLE */}

      {modo.paso ===
        "detalle" && (
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4"
        >
          {/* RESUMEN */}

          <div className="rounded-[16px] border border-accent/25 bg-accent/10 backdrop-blur-[16px] px-4 py-[14px]">
            <p className="font-sora text-[14px] font-semibold text-text">
              {modo.esOtros
                ? "Otros"
                : modo.producto
                    ?.nombre}
            </p>

            <p className="mt-[2px] text-[11px] text-text-muted">
              {[
                modo.contexto
                  ?.label,

                CATEGORIAS[
                  modo.catId
                ]?.label,

                modo.subcatId &&
                  CATEGORIAS[
                    modo.catId
                  ]
                    ?.subcategorias[
                    modo.subcatId
                  ]?.label,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>

          {/* DETALLE */}

          <div className="flex flex-col gap-2">
            <SectionLabel>
              {modo.esOtros
                ? "¿Qué es? (requerido)"
                : "Detalle (opcional)"}
            </SectionLabel>

            <input
              type="text"
              placeholder={
                modo.esOtros
                  ? "Ej: Papel higiénico..."
                  : "Ej: Marca, variedad..."
              }
              value={modo.detalle}
              onChange={(e) =>
                modo.setDetalle(
                  e.target.value,
                )
              }
              required={modo.esOtros}
            />
          </div>

          {/* CANTIDAD */}

          <div className="flex flex-col gap-2">
            <SectionLabel>
              Cantidad (
              {
                UNIDADES[
                  modo
                    .unidadActual
                ]?.label
              }
              )
            </SectionLabel>

            <div className="relative">
              <input
                type="number"
                step="0.01"
                placeholder="0"
                value={modo.cantidad}
                onChange={(e) =>
                  modo.setCantidad(
                    e.target.value,
                  )
                }
                className="pr-[52px]"
              />

              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[13px] font-medium text-accent2">
                {
                  UNIDADES[
                    modo
                      .unidadActual
                  ]?.label
                }
              </span>
            </div>
          </div>

          {/* MONTO */}

          <div className="relative overflow-hidden rounded-[22px] border border-accent/30 bg-gradient-to-br from-accent/15 to-[#5b35d5]/20 px-[22px] py-5 backdrop-blur-[20px]">
            <p className="mb-[10px] text-[11px] font-medium tracking-[0.5px] text-[#c8aeffa6]">
              MONTO ($)
            </p>

            <div className="flex items-center gap-1">
              <span className="font-sora text-[26px] font-bold leading-none text-accent-light">
                $
              </span>

              <input
                type="number"
                placeholder="0"
                value={modo.monto}
                onChange={(e) =>
                  modo.setMonto(
                    e.target.value,
                  )
                }
                required
                className="w-full border-none bg-transparent p-0 font-sora text-[34px] font-bold tracking-[-1px] text-text outline-none focus:ring-0"
              />
            </div>
          </div>

          {/* TIPO */}

          <div className="flex flex-col gap-2">
            <SectionLabel>
              Tipo de gasto
            </SectionLabel>

            <div className="flex gap-2">
              {[
                {
                  id: "personal",
                  label:
                    "Personal",
                },

                {
                  id: "compartido",
                  label:
                    "Compartido",
                },
              ].map((t) => {
                const active =
                  modo.tipo ===
                  t.id;

                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() =>
                      modo.setTipo(
                        t.id,
                      )
                    }
                    className={`flex-1 rounded-[14px] border px-[13px] py-[13px] text-[14px] transition-all duration-150 ${
                      active
                        ? "border-accent/60 bg-accent/18 text-accent-light"
                        : "border-border bg-white/3 text-text-muted"
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* GRUPOS */}

          {modo.tipo ===
            "compartido" && (
            <div className="flex flex-col gap-2">
              <SectionLabel>
                Grupo
              </SectionLabel>

              {loadingGroups ? (
                <p className="text-sm text-text-muted">
                  Cargando...
                </p>
              ) : (
                groups.map((g) => {
                  const active =
                    modo.selectedGroupId ===
                    g.id;

                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() =>
                        modo.setSelectedGroupId(
                          g.id,
                        )
                      }
                      className={`w-full rounded-[14px] px-4 py-[13px] text-left text-[14px] transition-all duration-150 ${
                        active
                          ? "border border-accent/60 bg-accent/18 text-accent-light"
                          : "border border-border bg-white/3 text-text"
                      }`}
                    >
                      {g.name}
                    </button>
                  );
                })
              )}
            </div>
          )}

          {/* SUBMIT */}

          <button
            type="submit"
            disabled={
              loading ||
              !canSubmit
            }
            className={`mt-1 w-full rounded-[16px] py-[15px] text-[15px] font-bold text-white transition-all duration-200 ${
              !canSubmit ||
              loading
                ? "cursor-default bg-accent/30"
                : "cursor-pointer bg-gradient-to-br from-[#9d7bff] to-[#5b35d5] shadow-[0_8px_28px_rgba(138,100,255,0.38)] hover:scale-[1.01]"
            }`}
          >
            {loading
              ? "Guardando..."
              : "Guardar gasto"}
          </button>
        </form>
      )}
    </>
  );
}
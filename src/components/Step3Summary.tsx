import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Clock,
  Sprout,
  Home,
  Bus,
  ArrowLeft,
  Send,
  MapPin,
  Users,
  Utensils,
  Pencil,
} from 'lucide-react';
import { RequerimientoDraft } from '../types';
import { getStoredParaderos } from '../services/storageService';

interface Step3SummaryProps {
  draft: RequerimientoDraft;
  onEdit: () => void;
  onSubmit: () => void;
  onPrev: () => void;
  onUpdateDraft?: (partial: Partial<RequerimientoDraft>) => void;
  isSubmitting?: boolean;
}

export const Step3Summary: React.FC<Step3SummaryProps> = ({
  draft,
  onEdit,
  onSubmit,
  onPrev,
  onUpdateDraft,
  isSubmitting = false,
}) => {
  const [observacion, setObservacion] = useState(draft.observaciones || '');

  // Master paraderos map for zone reference and official naming
  const paraderosMaster = useMemo(() => getStoredParaderos(), []);
  const paraderoInfoMap = useMemo(() => {
    const map = new Map<string, { zona?: string; codigo?: string }>();
    paraderosMaster.forEach((p) => {
      map.set(p.paradero.toLowerCase().trim(), { zona: p.zona, codigo: p.codigo });
    });
    return map;
  }, [paraderosMaster]);

  // Extract comedores breakdown (only those with total > 0)
  const comedoresList = draft.comedores && draft.comedores.length > 0 ? draft.comedores : [];
  const comedoresSummary = useMemo(() => {
    return comedoresList
      .map((c) => {
        const total = (Object.values(c.paraderosCantidades || {}) as (number | string)[]).reduce(
          (s: number, v) => s + (Number(v) > 0 ? Number(v) : 0),
          0
        );
        return {
          comedor: c.comedor,
          total,
          paraderos: Object.entries(c.paraderosCantidades || {})
            .filter(([_, qty]) => Number(qty) > 0)
            .map(([paradero, qty]) => ({ paradero, cantidad: Number(qty) })),
        };
      })
      .filter((cs) => cs.total > 0);
  }, [comedoresList]);

  // Extract paradero-level entries (consolidated) directly from draft matrix and comedores
  const { paraderosEntries, grandTotal } = useMemo(() => {
    const mapByParadero: Record<string, { total: number; details: string[] }> = {};
    let total = 0;

    // Check draft.matrizCantidades first for the most granular matrix
    if (draft.matrizCantidades && Object.keys(draft.matrizCantidades).length > 0) {
      Object.entries(draft.matrizCantidades).forEach(([paradero, colMap]) => {
        if (colMap && typeof colMap === 'object') {
          Object.entries(colMap).forEach(([comedor, rawVal]) => {
            const qty = Number(rawVal) || 0;
            if (qty > 0) {
              if (!mapByParadero[paradero]) {
                mapByParadero[paradero] = { total: 0, details: [] };
              }
              mapByParadero[paradero].total += qty;
              mapByParadero[paradero].details.push(`${comedor}: ${qty}`);
              total += qty;
            }
          });
        }
      });
    } else if (comedoresList.length > 0) {
      comedoresList.forEach((c) => {
        Object.entries(c.paraderosCantidades || {}).forEach(([paradero, rawQty]) => {
          const qty = Number(rawQty) || 0;
          if (qty > 0) {
            if (!mapByParadero[paradero]) {
              mapByParadero[paradero] = { total: 0, details: [] };
            }
            mapByParadero[paradero].total += qty;
            mapByParadero[paradero].details.push(`${c.comedor}: ${qty}`);
            total += qty;
          }
        });
      });
    } else if (draft.cantidadesPorParadero && Object.keys(draft.cantidadesPorParadero).length > 0) {
      Object.entries(draft.cantidadesPorParadero).forEach(([paradero, rawQty]) => {
        const qty = typeof rawQty === 'number' ? rawQty : Number(rawQty) || 0;
        if (qty > 0) {
          mapByParadero[paradero] = { total: qty, details: [] };
          total += qty;
        }
      });
    }

    const entries = Object.entries(mapByParadero).map(([paradero, data]) => {
      const info = paraderoInfoMap.get(paradero.toLowerCase().trim());
      return {
        paradero,
        cantidad: data.total,
        comedoresDetalle: data.details.join(', '),
        zona: info?.zona,
      };
    });

    return { paraderosEntries: entries, grandTotal: total };
  }, [draft.matrizCantidades, draft.cantidadesPorParadero, comedoresList, paraderoInfoMap]);

  // Format date DD/MM/YYYY
  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return '09/07/2026';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  const handleSend = () => {
    if (onUpdateDraft && observacion !== draft.observaciones) {
      onUpdateDraft({ observaciones: observacion });
    }
    onSubmit();
  };

  return (
    <div className="space-y-4 max-w-2xl mx-auto w-full pb-24">
      {/* Header */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs text-center">
        <h2 className="text-lg font-black text-[#173B56] uppercase tracking-tight">
          Resumen del requerimiento
        </h2>
        <p className="text-xs text-gray-500 font-medium mt-0.5">
          Verifica la información antes de enviar el requerimiento
        </p>
      </div>

      {/* Card 1: Requerimiento details */}
      <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-xs space-y-2.5 text-xs text-[#173B56]">
        <div className="flex items-center justify-between pb-1.5 border-b border-gray-100">
          <span className="text-xs font-black text-[#173B56] uppercase tracking-wide">
            Datos del Servicio
          </span>
          <button
            type="button"
            onClick={onEdit}
            className="text-[11px] font-bold text-[#00843D] hover:underline flex items-center gap-1"
          >
            <Pencil className="w-3 h-3" />
            <span>Editar datos</span>
          </button>
        </div>

        <div className="flex items-center justify-between py-1 border-b border-gray-100">
          <span className="flex items-center gap-2 text-gray-500 font-medium">
            <Calendar className="w-4 h-4 text-[#00843D]" />
            <span>Fecha</span>
          </span>
          <strong className="font-extrabold text-sm">{formatDisplayDate(draft.fecha)}</strong>
        </div>

        <div className="flex items-center justify-between py-1 border-b border-gray-100">
          <span className="flex items-center gap-2 text-gray-500 font-medium">
            <Clock className="w-4 h-4 text-[#00843D]" />
            <span>Hora de recojo</span>
          </span>
          <strong className="font-extrabold text-sm">{draft.horaRecojo || '13:00'}</strong>
        </div>

        <div className="flex items-center justify-between py-1 border-b border-gray-100">
          <span className="flex items-center gap-2 text-gray-500 font-medium">
            <Sprout className="w-4 h-4 text-[#00843D]" />
            <span>Servicio y cultivo</span>
          </span>
          <strong className="font-extrabold text-sm uppercase">{draft.cultivo || 'ARÁNDANO'}</strong>
        </div>

        <div className="flex items-center justify-between py-1 border-b border-gray-100">
          <span className="flex items-center gap-2 text-gray-500 font-medium">
            <Home className="w-4 h-4 text-[#00843D]" />
            <span>Fundo</span>
          </span>
          <strong className="font-extrabold text-sm uppercase">{draft.fundo || 'AGRICULTOR 1'}</strong>
        </div>

        <div className="flex items-center justify-between py-1">
          <span className="flex items-center gap-2 text-gray-500 font-medium">
            <Bus className="w-4 h-4 text-[#00843D]" />
            <span>Movimiento</span>
          </span>
          <strong className="font-extrabold text-sm">{draft.movimiento || 'Programa personal por tarea'}</strong>
        </div>
      </div>

      {/* Card 2: Totales por Comedor (si hay comedores con personas asignadas) */}
      {comedoresSummary.length > 0 && (
        <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-xs space-y-2.5">
          <h3 className="text-xs font-black text-[#173B56] uppercase tracking-wide flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Utensils className="w-4 h-4 text-[#00843D]" />
              <span>Totales por Comedor</span>
            </span>
            <span className="text-[11px] font-normal text-gray-500">
              {comedoresSummary.length} comedor(es) con personal
            </span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {comedoresSummary.map((cs) => (
              <div
                key={cs.comedor}
                className="p-3 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-[#E8F5EF] text-[#00843D] flex items-center justify-center shrink-0">
                    <Utensils className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-bold text-[#173B56] truncate">
                    Comedor {cs.comedor}
                  </span>
                </div>
                <span className="text-xs font-black text-[#00843D] bg-white px-2.5 py-1 rounded-lg border border-gray-200 shrink-0">
                  {cs.total} pers.
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Card 3: Detalle de paraderos con cantidad real */}
      <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-xs space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black text-[#173B56] uppercase tracking-wide flex items-center gap-2">
            <Users className="w-4 h-4 text-[#00843D]" />
            <span>Paraderos solicitados</span>
          </h3>
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-medium text-gray-500">
              {paraderosEntries.length} paradero(s)
            </span>
            <button
              type="button"
              onClick={onPrev}
              className="text-[11px] font-bold text-[#00843D] hover:underline flex items-center gap-1"
            >
              <Pencil className="w-3 h-3" />
              <span>Modificar cantidades</span>
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-[#E8F5EF]">
              <tr className="text-[#00843D] font-black border-b border-[#00843D]/20">
                <th className="py-2.5 px-3 text-left">Paradero</th>
                {comedoresList.length > 1 && (
                  <th className="py-2.5 px-3 text-left">Comedores</th>
                )}
                <th className="py-2.5 px-3 text-right">Personal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paraderosEntries.length === 0 ? (
                <tr>
                  <td colSpan={comedoresList.length > 1 ? 3 : 2} className="py-8 text-center text-gray-400 italic">
                    <div className="space-y-1">
                      <p className="font-semibold text-gray-500">No se han ingresado cantidades aún</p>
                      <p className="text-[11px]">Haz clic en "Modificar cantidades" o "Atrás" para ingresar el personal por paradero.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paraderosEntries.map((item) => (
                  <tr key={item.paradero} className="hover:bg-gray-50">
                    <td className="py-2.5 px-3 font-semibold text-[#173B56]">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-[#00843D] shrink-0" />
                        <span className="truncate">{item.paradero}</span>
                        {item.zona && (
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-sm uppercase ${
                            item.zona === 'SUR'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {item.zona}
                          </span>
                        )}
                      </div>
                    </td>
                    {comedoresList.length > 1 && (
                      <td className="py-2.5 px-3 text-gray-600 text-[11px] font-medium">
                        {item.comedoresDetalle || '-'}
                      </td>
                    )}
                    <td className="py-2.5 px-3 text-right font-black text-[#00843D] text-sm">
                      {item.cantidad}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="bg-[#E8F5EF]/90 font-black text-xs text-[#00843D] border-t-2 border-[#00843D]/30">
                <td colSpan={comedoresList.length > 1 ? 2 : 1} className="py-3 px-3 uppercase tracking-tight">
                  TOTAL GENERAL
                </td>
                <td className="py-3 px-3 text-right text-base">{grandTotal} personas</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Card 4: Observaciones (opcional) */}
      <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-xs space-y-1.5">
        <label className="block text-xs font-black text-[#173B56] uppercase tracking-wide">
          Observaciones (opcional)
        </label>
        <input
          type="text"
          placeholder="Escribe una observación..."
          value={observacion}
          onChange={(e) => {
            setObservacion(e.target.value);
            if (onUpdateDraft) onUpdateDraft({ observaciones: e.target.value });
          }}
          className="w-full p-3 bg-gray-50/80 border border-gray-200 rounded-xl text-xs font-medium text-[#173B56] placeholder-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00843D]"
        />
      </div>

      {/* Action Buttons: [ Atrás ] [ Enviar requerimiento ] */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          id="btn-summary-atras"
          onClick={onPrev}
          className="flex-1 py-3.5 px-4 bg-white border border-gray-300 hover:bg-gray-50 text-[#173B56] font-bold text-sm rounded-2xl transition-all flex items-center justify-center gap-1.5 shadow-2xs"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Atrás</span>
        </button>

        <button
          type="button"
          id="btn-enviar-requerimiento"
          onClick={handleSend}
          disabled={isSubmitting}
          className="flex-1 py-3.5 px-4 bg-[#00843D] hover:bg-[#007034] active:bg-[#005c2b] disabled:opacity-50 text-white font-black text-sm rounded-2xl shadow-md transition-all flex items-center justify-center gap-2"
        >
          <Send className="w-4 h-4" />
          <span>{isSubmitting ? 'Enviando...' : 'Enviar requerimiento'}</span>
        </button>
      </div>
    </div>
  );
};

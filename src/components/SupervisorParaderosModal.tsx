import React, { useState } from 'react';
import {
  X,
  Copy,
  CheckCircle2,
  FileSpreadsheet,
  ExternalLink,
} from 'lucide-react';
import { Requerimiento, DetalleRequerimiento } from '../types';
import { consolidarParaderos, exportarRequerimientoIndividualExcel } from '../services/excelExportService';
import { getHorarioDisplay } from '../data/masterData';

interface SupervisorParaderosModalProps {
  isOpen: boolean;
  requerimiento: Requerimiento | null;
  detalles: DetalleRequerimiento[];
  onClose: () => void;
  onOpenFullDetail?: (req: Requerimiento) => void;
}

export const SupervisorParaderosModal: React.FC<SupervisorParaderosModalProps> = ({
  isOpen,
  requerimiento,
  detalles,
  onClose,
  onOpenFullDetail,
}) => {
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'AGRUPADO' | 'TODOS' | 'SUR' | 'NORTE'>('AGRUPADO');

  if (!isOpen || !requerimiento) return null;

  const paraderosAgrupados = consolidarParaderos(detalles);
  const totalPersonas = paraderosAgrupados.reduce((sum, p) => sum + p.totalPersonas, 0);

  const paraderosSur = paraderosAgrupados.filter((p) => p.zona === 'SUR');
  const paraderosNorte = paraderosAgrupados.filter((p) => p.zona === 'NORTE');
  const totalZonaSur = paraderosSur.reduce((sum, p) => sum + p.totalPersonas, 0);
  const totalZonaNorte = paraderosNorte.reduce((sum, p) => sum + p.totalPersonas, 0);

  // Formato de horario adaptativo según movimiento (INGRESO muestra desglose Norte/Sur, SALIDA o tarea normal se mantiene normal)
  const horario = getHorarioDisplay(requerimiento);

  // Filtrado de paraderos según la pestaña seleccionada
  const paraderosFiltrados =
    viewMode === 'SUR'
      ? paraderosSur
      : viewMode === 'NORTE'
      ? paraderosNorte
      : paraderosAgrupados;

  const handleCopySummary = () => {
    let text = `🚌 *RESUMEN DE TRANSPORTE - CAMPOSOL*\n`;
    text += `📋 *Requerimiento:* ${requerimiento.numeroRequerimiento}\n`;
    text += `👤 *Supervisor:* ${requerimiento.usuario || 'Supervisor'}\n`;
    text += `📅 *Fecha:* ${requerimiento.fecha} | *Turno:* ${horario.textoTurnoHeader}\n`;
    text += `🏢 *Área:* ${requerimiento.area} | *Fundo:* ${requerimiento.fundo}\n`;
    text += `🔄 *Movimiento:* ${requerimiento.movimiento}\n`;
    text += `👥 *Total:* ${totalPersonas} personas\n\n`;

    if (totalZonaSur > 0) {
      text += `🟡 *ZONA SUR (${totalZonaSur} pers. - ${paraderosSur.length} paraderos${horario.isIngreso && horario.horaSur ? ` - Hora: ${horario.horaSur}` : ''}):*\n`;
      paraderosSur.forEach((p, idx) => {
        text += `  ${idx + 1}. *${p.paradero}*: ${p.totalPersonas}`;
        if (p.comedoresDetalle.length > 1) {
          const comText = p.comedoresDetalle.map((c) => `${c.comedor}: ${c.cantidad}`).join(', ');
          text += ` [${comText}]`;
        }
        text += `\n`;
      });
      text += `\n`;
    }

    if (totalZonaNorte > 0) {
      text += `🔵 *ZONA NORTE (${totalZonaNorte} pers. - ${paraderosNorte.length} paraderos${horario.isIngreso && horario.horaNorte ? ` - Hora: ${horario.horaNorte}` : ''}):*\n`;
      paraderosNorte.forEach((p, idx) => {
        text += `  ${idx + 1}. *${p.paradero}*: ${p.totalPersonas}`;
        if (p.comedoresDetalle.length > 1) {
          const comText = p.comedoresDetalle.map((c) => `${c.comedor}: ${c.cantidad}`).join(', ');
          text += ` [${comText}]`;
        }
        text += `\n`;
      });
      text += `\n`;
    }

    text += `📊 *TOTAL CONSOLIDADO:*\n`;
    text += `• Zona Sur: *${totalZonaSur} personas* (${paraderosSur.length} paraderos)\n`;
    text += `• Zona Norte: *${totalZonaNorte} personas* (${paraderosNorte.length} paraderos)\n`;
    text += `• Total: *${totalPersonas} personas*\n`;

    if (requerimiento.observaciones) {
      text += `\n📝 *Nota:* ${requerimiento.observaciones}\n`;
    }

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadExcel = () => {
    exportarRequerimientoIndividualExcel(requerimiento, detalles);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto border border-gray-100 flex flex-col max-h-[90vh]">
        {/* Header Limpio */}
        <div className="bg-[#173B56] text-white px-5 py-4 relative shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 text-white/70 hover:text-white rounded-full hover:bg-white/10 transition-colors cursor-pointer"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#00843D] flex items-center justify-center text-white shrink-0 font-black text-sm shadow-sm">
              {(requerimiento.usuario || 'S').slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 pr-8">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-tight leading-tight truncate">
                  {requerimiento.usuario || 'Supervisor Solicitante'}
                </h2>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-white/15 text-emerald-200 shrink-0">
                  {requerimiento.numeroRequerimiento}
                </span>
              </div>
              <p className="text-xs text-white/80 mt-0.5 truncate">
                {requerimiento.fecha} • {horario.textoTurnoHeader} • {requerimiento.area} ({requerimiento.fundo})
              </p>
            </div>
          </div>
        </div>

        {/* 3 Tarjetas KPI Limpias (Solo Pasajeros y Paraderos) */}
        <div className="px-5 pt-3.5 pb-2 grid grid-cols-3 gap-2.5 shrink-0">
          {/* Total */}
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-2.5 text-center">
            <div className="text-2xl sm:text-3xl font-black text-[#00843D] leading-none">
              {totalPersonas}
            </div>
            <div className="text-[11px] font-bold text-gray-700 mt-1">
              Total Pasajeros
            </div>
            <div className="text-[10px] text-emerald-800 font-semibold">
              {paraderosAgrupados.length} paraderos
            </div>
          </div>

          {/* Sur */}
          <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-2.5 text-center flex flex-col justify-between">
            <div>
              <div className="text-2xl sm:text-3xl font-black text-amber-900 leading-none">
                {totalZonaSur}
              </div>
              <div className="text-[11px] font-bold text-amber-900 mt-1">
                Zona Sur
              </div>
              <div className="text-[10px] text-amber-800 font-semibold">
                {paraderosSur.length} paraderos
              </div>
            </div>
            {horario.isIngreso && horario.horaSur && (
              <div className="mt-1 text-[10px] font-black text-amber-950 bg-amber-100/90 py-0.5 px-1.5 rounded-md border border-amber-300/70 shadow-2xs mx-auto">
                Hora: {horario.horaSur}
              </div>
            )}
          </div>

          {/* Norte */}
          <div className="bg-indigo-50/70 border border-indigo-200 rounded-2xl p-2.5 text-center flex flex-col justify-between">
            <div>
              <div className="text-2xl sm:text-3xl font-black text-indigo-900 leading-none">
                {totalZonaNorte}
              </div>
              <div className="text-[11px] font-bold text-indigo-900 mt-1">
                Zona Norte
              </div>
              <div className="text-[10px] text-indigo-800 font-semibold">
                {paraderosNorte.length} paraderos
              </div>
            </div>
            {horario.isIngreso && horario.horaNorte && (
              <div className="mt-1 text-[10px] font-black text-indigo-950 bg-indigo-100/90 py-0.5 px-1.5 rounded-md border border-indigo-300/70 shadow-2xs mx-auto">
                Hora: {horario.horaNorte}
              </div>
            )}
          </div>
        </div>

        {/* Contenido: Selector y Tabla Limpia */}
        <div className="px-5 py-2 overflow-y-auto flex-1 space-y-2">
          {/* Selector de Vista Minimalista */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-xs font-bold text-gray-500">
              {paraderosAgrupados.length} paraderos solicitados
            </span>

            <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-xl text-xs">
              <button
                type="button"
                id="btn-view-agrupado"
                onClick={() => setViewMode('AGRUPADO')}
                className={`px-2.5 py-1 font-bold rounded-lg transition-all cursor-pointer ${
                  viewMode === 'AGRUPADO'
                    ? 'bg-white text-gray-900 shadow-2xs font-black'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                Por Zonas
              </button>
              <button
                type="button"
                id="btn-view-todos"
                onClick={() => setViewMode('TODOS')}
                className={`px-2.5 py-1 font-bold rounded-lg transition-all cursor-pointer ${
                  viewMode === 'TODOS'
                    ? 'bg-white text-gray-900 shadow-2xs font-black'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                Todos
              </button>
              <button
                type="button"
                id="btn-view-sur"
                onClick={() => setViewMode('SUR')}
                className={`px-2 py-1 font-bold rounded-lg transition-all cursor-pointer ${
                  viewMode === 'SUR'
                    ? 'bg-amber-600 text-white shadow-2xs font-black'
                    : 'text-amber-800 hover:bg-amber-100/60'
                }`}
              >
                Sur ({totalZonaSur})
              </button>
              <button
                type="button"
                id="btn-view-norte"
                onClick={() => setViewMode('NORTE')}
                className={`px-2 py-1 font-bold rounded-lg transition-all cursor-pointer ${
                  viewMode === 'NORTE'
                    ? 'bg-indigo-600 text-white shadow-2xs font-black'
                    : 'text-indigo-800 hover:bg-indigo-100/60'
                }`}
              >
                Norte ({totalZonaNorte})
              </button>
            </div>
          </div>

          {paraderosAgrupados.length === 0 ? (
            <div className="p-8 text-center bg-gray-50 rounded-2xl border border-gray-200 text-gray-400 text-xs">
              No se registraron paraderos para este requerimiento.
            </div>
          ) : (
            <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-600 font-bold text-[11px] border-b border-gray-200">
                  <tr>
                    <th className="py-2 px-3 w-8">#</th>
                    <th className="py-2 px-3">Paradero</th>
                    {viewMode === 'TODOS' && <th className="py-2 px-2 text-center w-16">Zona</th>}
                    <th className="py-2 px-3 text-right w-24">Pasajeros</th>
                    <th className="py-2 px-3">Comedores</th>
                  </tr>
                </thead>

                {viewMode === 'AGRUPADO' ? (
                  /* Modo Agrupado: Cabeceras de Zona limpias */
                  <tbody className="divide-y divide-gray-100">
                    {/* SECCIÓN ZONA SUR */}
                    {paraderosSur.length > 0 && (
                      <>
                        <tr className="bg-amber-50/80 border-y border-amber-200">
                          <td colSpan={4} className="py-1.5 px-3">
                            <div className="flex items-center justify-between text-xs font-black text-amber-900">
                              <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-amber-500" />
                                <span>Zona Sur</span>
                              </span>
                              <span className="font-mono text-amber-950 font-black">
                                {totalZonaSur} pasajeros ({paraderosSur.length} paraderos)
                              </span>
                            </div>
                          </td>
                        </tr>
                        {paraderosSur.map((item, idx) => (
                          <tr key={`sur-${idx}`} className="hover:bg-amber-50/30 transition-colors">
                            <td className="py-2 px-3 font-semibold text-gray-400 text-[11px]">{idx + 1}</td>
                            <td className="py-2 px-3 font-bold text-gray-800">{item.paradero}</td>
                            <td className="py-2 px-3 text-right">
                              <span className="font-mono font-black text-sm text-[#00843D]">{item.totalPersonas}</span>
                            </td>
                            <td className="py-2 px-3 text-[11px] text-gray-500">
                              {item.comedoresDetalle.map((c, cIdx) => (
                                <span
                                  key={cIdx}
                                  className="inline-block bg-gray-100 px-1.5 py-0.5 rounded mr-1 text-[10px] text-gray-700 font-medium"
                                >
                                  {c.comedor}: <strong>{c.cantidad}</strong>
                                </span>
                              ))}
                            </td>
                          </tr>
                        ))}
                      </>
                    )}

                    {/* SECCIÓN ZONA NORTE */}
                    {paraderosNorte.length > 0 && (
                      <>
                        <tr className="bg-indigo-50/80 border-y border-indigo-200">
                          <td colSpan={4} className="py-1.5 px-3">
                            <div className="flex items-center justify-between text-xs font-black text-indigo-900">
                              <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-indigo-500" />
                                <span>Zona Norte</span>
                              </span>
                              <span className="font-mono text-indigo-950 font-black">
                                {totalZonaNorte} pasajeros ({paraderosNorte.length} paraderos)
                              </span>
                            </div>
                          </td>
                        </tr>
                        {paraderosNorte.map((item, idx) => (
                          <tr key={`norte-${idx}`} className="hover:bg-indigo-50/30 transition-colors">
                            <td className="py-2 px-3 font-semibold text-gray-400 text-[11px]">{idx + 1}</td>
                            <td className="py-2 px-3 font-bold text-gray-800">{item.paradero}</td>
                            <td className="py-2 px-3 text-right">
                              <span className="font-mono font-black text-sm text-[#00843D]">{item.totalPersonas}</span>
                            </td>
                            <td className="py-2 px-3 text-[11px] text-gray-500">
                              {item.comedoresDetalle.map((c, cIdx) => (
                                <span
                                  key={cIdx}
                                  className="inline-block bg-gray-100 px-1.5 py-0.5 rounded mr-1 text-[10px] text-gray-700 font-medium"
                                >
                                  {c.comedor}: <strong>{c.cantidad}</strong>
                                </span>
                              ))}
                            </td>
                          </tr>
                        ))}
                      </>
                    )}
                  </tbody>
                ) : (
                  /* Modo Filtrado / Plano */
                  <tbody className="divide-y divide-gray-100">
                    {paraderosFiltrados.map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50 transition-colors">
                        <td className="py-2 px-3 font-semibold text-gray-400 text-[11px]">{idx + 1}</td>
                        <td className="py-2 px-3 font-bold text-gray-800">{item.paradero}</td>
                        {viewMode === 'TODOS' && (
                          <td className="py-2 px-2 text-center">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                                item.zona === 'SUR'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-indigo-100 text-indigo-800'
                              }`}
                            >
                              {item.zona}
                            </span>
                          </td>
                        )}
                        <td className="py-2 px-3 text-right">
                          <span className="font-mono font-black text-sm text-[#00843D]">{item.totalPersonas}</span>
                        </td>
                        <td className="py-2 px-3 text-[11px] text-gray-500">
                          {item.comedoresDetalle.map((c, cIdx) => (
                            <span
                              key={cIdx}
                              className="inline-block bg-gray-100 px-1.5 py-0.5 rounded mr-1 text-[10px] text-gray-700 font-medium"
                            >
                              {c.comedor}: <strong>{c.cantidad}</strong>
                            </span>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                )}

                {/* Fila Total Limpia */}
                <tfoot className="bg-gray-100/90 font-bold border-t border-gray-200 text-gray-800">
                  <tr>
                    <td colSpan={viewMode === 'TODOS' ? 3 : 2} className="py-2.5 px-3 font-black text-xs">
                      Total:
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-base font-black text-[#00843D]">
                      {viewMode === 'SUR'
                        ? totalZonaSur
                        : viewMode === 'NORTE'
                        ? totalZonaNorte
                        : totalPersonas}
                    </td>
                    <td className="py-2.5 px-3 text-xs text-gray-600 font-semibold">
                      pasajeros
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {requerimiento.observaciones && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-2 text-xs text-gray-600">
              <strong className="text-gray-700">Nota:</strong> {requerimiento.observaciones}
            </div>
          )}
        </div>

        {/* Botones de Acción Limpios */}
        <div className="bg-gray-50 border-t border-gray-200 px-5 py-3 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopySummary}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
                copied
                  ? 'bg-[#173B56] text-white'
                  : 'bg-emerald-100 hover:bg-emerald-200 text-[#00843D]'
              }`}
              title="Copiar resumen para WhatsApp"
            >
              {copied ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>¡Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar para WhatsApp</span>
                </>
              )}
            </button>

            <button
              onClick={handleDownloadExcel}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white hover:bg-emerald-50 text-[#00843D] border border-emerald-300 flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              title="Descargar este requerimiento a Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#00843D]" />
              <span>Descargar en Excel</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {onOpenFullDetail && (
              <button
                onClick={() => {
                  onClose();
                  onOpenFullDetail(requerimiento);
                }}
                className="px-2.5 py-1.5 text-xs font-bold text-gray-600 hover:text-[#173B56] hover:bg-gray-100 rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
              >
                <span>Detalle Completo</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            )}

            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-[#173B56] hover:bg-[#122e43] text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

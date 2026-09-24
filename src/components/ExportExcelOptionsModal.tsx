import React, { useState } from 'react';
import {
  X,
  FileSpreadsheet,
  FileText,
  Table,
  CheckCircle2,
  Download,
  Sigma,
  Layers,
  Sparkles,
} from 'lucide-react';
import { Requerimiento, DetalleRequerimiento } from '../types';
import { exportarExcelOperativoCompleto, formatHoraRegistro } from '../services/excelExportService';
import { exportToCSV } from '../services/storageService';

interface ExportExcelOptionsModalProps {
  isOpen: boolean;
  requerimientos: Requerimiento[];
  detalles: DetalleRequerimiento[];
  onClose: () => void;
  onSuccessToast?: (msg: string) => void;
}

export const ExportExcelOptionsModal: React.FC<ExportExcelOptionsModalProps> = ({
  isOpen,
  requerimientos,
  detalles,
  onClose,
  onSuccessToast,
}) => {
  const [selectedFormat, setSelectedFormat] = useState<'xlsx-multi' | 'csv-detallado' | 'csv-estandar'>('xlsx-multi');

  if (!isOpen) return null;

  const totalPasajeros = requerimientos.reduce((sum, r) => sum + (Number(r.totalPersonas) || 0), 0);

  const handleExecuteExport = () => {
    const today = new Date().toISOString().slice(0, 10);

    if (selectedFormat === 'xlsx-multi') {
      exportarExcelOperativoCompleto(
        requerimientos,
        detalles,
        `CAMPOSOL_Reporte_Transporte_${today}.xlsx`
      );
      if (onSuccessToast) {
        onSuccessToast('¡Libro Excel (.xlsx) multihábil generado con fórmulas y totales para sumar!');
      }
    } else if (selectedFormat === 'csv-detallado') {
      // 1 fila por cada paradero con valor numérico puro
      const rows: Record<string, string | number>[] = [];
      requerimientos.forEach((req) => {
        const dets = detalles.filter((d) => d.requerimientoId === req.id || d.numeroRequerimiento === req.numeroRequerimiento);
        if (dets.length === 0) {
          rows.push({
            Codigo_Requerimiento: req.numeroRequerimiento,
            Fecha: req.fecha,
            Hora_Registro: formatHoraRegistro(req.fechaRegistro) || '',
            Area: req.area,
            Fundo: req.fundo,
            Supervisor: req.usuario || 'Supervisor',
            Movimiento: req.movimiento,
            Hora_Recojo: req.horaRecojo,
            Hora_Salida: req.horaSalida,
            Paradero: 'General',
            Zona: 'NORTE',
            Cantidad_Personas_NUMERICO: Number(req.totalPersonas) || 0,
            Total_Requerimiento: Number(req.totalPersonas) || 0,
            Estado: req.estado,
          });
        } else {
          dets.forEach((d) => {
            rows.push({
              Codigo_Requerimiento: req.numeroRequerimiento,
              Fecha: req.fecha,
              Hora_Registro: formatHoraRegistro(req.fechaRegistro) || '',
              Area: req.area,
              Fundo: req.fundo,
              Supervisor: req.usuario || 'Supervisor',
              Movimiento: req.movimiento,
              Hora_Recojo: req.horaRecojo,
              Hora_Salida: req.horaSalida,
              Paradero: d.paradero,
              Zona: d.zona || 'SUR',
              Comedor: d.comedor,
              Cantidad_Personas_NUMERICO: Number(d.cantidad) || 0,
              Total_Requerimiento: Number(req.totalPersonas) || 0,
              Estado: req.estado,
            });
          });
        }
      });

      // Fila de suma total para el usuario
      rows.push({
        Codigo_Requerimiento: 'TOTAL_GENERAL',
        Fecha: '',
        Hora_Registro: '',
        Area: '',
        Fundo: '',
        Supervisor: '',
        Movimiento: '',
        Hora_Recojo: '',
        Hora_Salida: '',
        Paradero: 'TOTAL SUMADO',
        Zona: '',
        Comedor: '',
        Cantidad_Personas_NUMERICO: totalPasajeros,
        Total_Requerimiento: totalPasajeros,
        Estado: '',
      });

      exportToCSV(`CAMPOSOL_Detalle_Sumas_${today}.csv`, rows);
      if (onSuccessToast) {
        onSuccessToast('Reporte detallado por paradero listo para sumar descargado');
      }
    } else {
      // Formato estándar con resumen limpio
      const rows = requerimientos.map((r) => {
        const dets = detalles.filter((d) => d.requerimientoId === r.id || d.numeroRequerimiento === r.numeroRequerimiento);
        // Agrupar para no repetir paraderos
        const agrupado: Record<string, number> = {};
        dets.forEach((d) => {
          agrupado[d.paradero] = (agrupado[d.paradero] || 0) + Number(d.cantidad);
        });
        const summary = Object.entries(agrupado)
          .map(([p, c]) => `${p}: ${c}`)
          .join('; ');

        return {
          Codigo: r.numeroRequerimiento,
          Fecha: r.fecha,
          Hora_Registro: formatHoraRegistro(r.fechaRegistro) || '',
          Area: r.area,
          Fundo: r.fundo,
          Movimiento: r.movimiento,
          Hora_Recojo: r.horaRecojo,
          Hora_Salida: r.horaSalida,
          Total_Personas_NUMERICO: Number(r.totalPersonas) || 0,
          Estado: r.estado,
          Supervisor_Usuario: r.usuario || 'Supervisor',
          Paraderos_Consolidados: summary,
          Observaciones: r.observaciones || '',
        };
      });

      exportToCSV(`CAMPOSOL_Requerimientos_${today}.csv`, rows);
      if (onSuccessToast) {
        onSuccessToast('Reporte general exportado');
      }
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto border border-gray-100">
        {/* Header */}
        <div className="bg-[#173B56] text-white p-5 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-white/70 hover:text-white rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#00843D] flex items-center justify-center text-white shadow-md">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold tracking-widest text-emerald-300 uppercase">
                EXPORTACIÓN OPTIMIZADA PARA EXCEL
              </span>
              <h2 className="text-lg font-black uppercase tracking-tight">
                Descarga de Datos para Sumas
              </h2>
              <p className="text-xs text-white/80 font-medium">
                {requerimientos.length} requerimientos filtrados • {totalPasajeros} pasajeros a sumar
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <p className="text-xs text-gray-600 leading-relaxed">
            Selecciona el formato que mejor se adapte a tu trabajo en Excel para que puedas <strong>sumar fácilmente por paradero, supervisor o fundo</strong>:
          </p>

          <div className="space-y-2.5">
            {/* Opcion 1: Libro Excel Multihábil (.xlsx) */}
            <div
              onClick={() => setSelectedFormat('xlsx-multi')}
              className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-3.5 ${
                selectedFormat === 'xlsx-multi'
                  ? 'border-[#00843D] bg-emerald-50/50 shadow-xs'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center shrink-0 ${
                  selectedFormat === 'xlsx-multi'
                    ? 'border-[#00843D] bg-[#00843D] text-white'
                    : 'border-gray-300'
                }`}
              >
                {selectedFormat === 'xlsx-multi' && <CheckCircle2 className="w-3.5 h-3.5" />}
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <strong className="text-xs font-black text-[#173B56] uppercase">
                    Libro Completo Excel (.xlsx)
                  </strong>
                  <span className="bg-[#00843D] text-white text-[9px] font-black px-2 py-0.5 rounded-full">
                    RECOMENDADO
                  </span>
                </div>
                <p className="text-[11px] text-gray-600 mt-1 leading-normal">
                  Incluye <strong>3 hojas automáticas</strong>:
                </p>
                <ul className="text-[10px] text-gray-500 mt-1 space-y-0.5 list-disc list-inside">
                  <li><strong>Hoja 1 (Detalle para Sumas):</strong> Cada paradero en una fila con columna numérica de pasajeros para usar <code className="bg-gray-100 px-1 rounded text-gray-700">=SUMA()</code>.</li>
                  <li><strong>Hoja 2 (Resumen por Paradero):</strong> Totales consolidados de cada paradero con porcentajes y buses.</li>
                  <li><strong>Hoja 3 (Matriz Cruzada):</strong> Columnas numéricas individuales por cada paradero con fila de suma total al final.</li>
                </ul>
              </div>
            </div>

            {/* Opcion 2: CSV Detallado 1 fila por paradero */}
            <div
              onClick={() => setSelectedFormat('csv-detallado')}
              className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-3.5 ${
                selectedFormat === 'csv-detallado'
                  ? 'border-[#00843D] bg-emerald-50/50 shadow-xs'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center shrink-0 ${
                  selectedFormat === 'csv-detallado'
                    ? 'border-[#00843D] bg-[#00843D] text-white'
                    : 'border-gray-300'
                }`}
              >
                {selectedFormat === 'csv-detallado' && <CheckCircle2 className="w-3.5 h-3.5" />}
              </div>

              <div className="flex-1">
                <strong className="text-xs font-black text-[#173B56] uppercase block">
                  CSV Detallado para Tablas Dinámicas (.csv)
                </strong>
                <p className="text-[11px] text-gray-600 mt-1 leading-normal">
                  Una sola tabla plana donde cada paradero tiene su propia fila y una columna con <strong>números puros</strong> lista para crear Tablas Dinámicas (Pivot Tables) o aplicar filtros rápidos en Excel.
                </p>
              </div>
            </div>

            {/* Opcion 3: Resumen Estándar */}
            <div
              onClick={() => setSelectedFormat('csv-estandar')}
              className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-3.5 ${
                selectedFormat === 'csv-estandar'
                  ? 'border-[#00843D] bg-emerald-50/50 shadow-xs'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center shrink-0 ${
                  selectedFormat === 'csv-estandar'
                    ? 'border-[#00843D] bg-[#00843D] text-white'
                    : 'border-gray-300'
                }`}
              >
                {selectedFormat === 'csv-estandar' && <CheckCircle2 className="w-3.5 h-3.5" />}
              </div>

              <div className="flex-1">
                <strong className="text-xs font-black text-[#173B56] uppercase block">
                  Reporte General de Requerimientos (.csv)
                </strong>
                <p className="text-[11px] text-gray-600 mt-1 leading-normal">
                  Una fila por cada requerimiento con el total de personas numérico y los paraderos resumidos limpiamente sin repeticiones.
                </p>
              </div>
            </div>
          </div>

          {/* Tip Box */}
          <div className="p-3 bg-blue-50/80 border border-blue-200/80 rounded-2xl text-[11px] text-blue-950 flex items-start gap-2">
            <Sigma className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <p>
              <strong>Fácil de sumar:</strong> Al abrir en Excel, los valores de pasajeros son números reales. Puedes seleccionar la columna y ver la suma instantánea en la barra inferior de Excel o usar el botón <strong>Autosuma (Σ)</strong>.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-xs font-bold text-gray-600 hover:bg-gray-200 rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleExecuteExport}
            className="px-5 py-2.5 bg-[#00843D] hover:bg-[#006e33] active:bg-[#005728] text-white rounded-xl text-xs font-bold uppercase transition-all shadow-md flex items-center gap-1.5"
          >
            <Download className="w-4 h-4" />
            <span>Descargar Archivo</span>
          </button>
        </div>
      </div>
    </div>
  );
};

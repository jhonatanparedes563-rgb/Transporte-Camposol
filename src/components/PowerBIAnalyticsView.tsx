import React, { useState } from 'react';
import {
  BarChart2,
  Download,
  Database,
  Users,
  Compass,
  Building,
  Utensils,
  MapPin,
  RefreshCw,
  Table,
  CheckCircle2,
  FileSpreadsheet,
  Layers,
  ArrowUpRight,
  ArrowDownLeft,
  Filter,
  Sparkles,
  PieChart,
  Clock,
  Calendar,
  Sprout,
  ShieldCheck,
} from 'lucide-react';
import { Requerimiento, DetalleRequerimiento } from '../types';
import {
  getStoredRequerimientos,
  getStoredDetalles,
  exportToCSV,
  resetDataToDefault,
  inferParaderoZona,
} from '../services/storageService';

interface PowerBIAnalyticsViewProps {
  onBack: () => void;
  onRefreshParent: () => void;
}

export const PowerBIAnalyticsView: React.FC<PowerBIAnalyticsViewProps> = ({
  onBack,
  onRefreshParent,
}) => {
  const [requerimientos, setRequerimientos] = useState<Requerimiento[]>(getStoredRequerimientos());
  const [detalles, setDetalles] = useState<DetalleRequerimiento[]>(getStoredDetalles());
  const [exportSuccess, setExportSuccess] = useState<string>('');

  // Interactive filters for Power BI preview
  const [filterZona, setFilterZona] = useState<string>('TODAS');
  const [filterFundo, setFilterFundo] = useState<string>('TODOS');
  const [filterCultivo, setFilterCultivo] = useState<string>('TODOS');

  const refreshData = () => {
    setRequerimientos(getStoredRequerimientos());
    setDetalles(getStoredDetalles());
    onRefreshParent();
  };

  const handleResetData = () => {
    if (window.confirm('¿Deseas restaurar los datos de prueba iniciales de CAMPOSOL?')) {
      resetDataToDefault();
      refreshData();
    }
  };

  // Enriched normalized data rows: Fecha | Hora | Fundo | Cultivo | Zona | Paradero | Parcela | Cantidad
  const enrichedRows = detalles.map((d) => {
    const parent = requerimientos.find((r) => r.id === d.requerimientoId || r.numeroRequerimiento === d.numeroRequerimiento);
    const zona = d.zona || inferParaderoZona(d.paradero);
    return {
      id: d.id,
      fecha: parent?.fecha || '09/07/2026',
      hora: parent?.horaRecojo || '13:00',
      fundo: parent?.fundo || 'AGRICULTOR 1',
      cultivo: d.cultivo || parent?.cultivo || 'ARÁNDANO',
      zona: zona,
      paradero: d.paradero,
      parcela: d.parcela || d.comedor,
      cantidad: d.cantidad,
    };
  });

  // Filtered rows
  const filteredRows = enrichedRows.filter((row) => {
    if (filterZona !== 'TODAS' && row.zona !== filterZona) return false;
    if (filterFundo !== 'TODOS' && row.fundo !== filterFundo) return false;
    if (filterCultivo !== 'TODOS' && row.cultivo !== filterCultivo) return false;
    return true;
  });

  // Filtered KPIs
  const totalPersonal = filteredRows.reduce((sum, r) => sum + r.cantidad, 0);
  const distinctFundos = new Set(filteredRows.map((r) => r.fundo)).size;
  const distinctCultivos = new Set(filteredRows.map((r) => r.cultivo)).size;
  const distinctZonas = new Set(filteredRows.map((r) => r.zona)).size;

  // Personal por Zona
  const totalZonaSur = filteredRows
    .filter((r) => r.zona === 'SUR')
    .reduce((sum, r) => sum + r.cantidad, 0);
  const totalZonaNorte = filteredRows
    .filter((r) => r.zona === 'NORTE')
    .reduce((sum, r) => sum + r.cantidad, 0);

  const pctSur = totalPersonal > 0 ? Math.round((totalZonaSur / totalPersonal) * 100) : 0;
  const pctNorte = totalPersonal > 0 ? 100 - pctSur : 0;

  // Personal por Paradero (sorted desc)
  const personalPorParadero: Record<string, number> = {};
  filteredRows.forEach((r) => {
    personalPorParadero[r.paradero] = (personalPorParadero[r.paradero] || 0) + r.cantidad;
  });
  const paraderosSorted = Object.entries(personalPorParadero).sort((a, b) => b[1] - a[1]);
  const maxParaderoVal = paraderosSorted.length > 0 ? paraderosSorted[0][1] : 1;

  // Export handlers
  const handleExportPowerBIDataset = () => {
    const exportRows = enrichedRows.map((r) => ({
      Fecha: r.fecha,
      Hora: r.hora,
      Fundo: r.fundo,
      Cultivo: r.cultivo,
      Zona: r.zona,
      Paradero: r.paradero,
      Parcela: r.parcela,
      Cantidad: r.cantidad,
    }));

    exportToCSV('CAMPOSOL_DATASET_POWERBI.csv', exportRows);
    setExportSuccess('¡Archivo CAMPOSOL_DATASET_POWERBI.csv exportado!');
    setTimeout(() => setExportSuccess(''), 4000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-gray-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-black text-[#00843D] uppercase tracking-wider block">
            CAMPOSOL • ANALYTICS & BI
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-[#173B56] mt-0.5">
            Dashboard en Power BI & Datos en Tiempo Real
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Los datos ingresados desde el formulario móvil se sincronizan automáticamente en tablas normalizadas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportPowerBIDataset}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-[#00843D] hover:bg-[#007034] active:bg-[#005c2b] text-white rounded-xl text-xs font-bold transition-all shadow-xs"
          >
            <Download className="w-4 h-4" />
            <span>Descargar Dataset CSV</span>
          </button>
          <button
            onClick={refreshData}
            className="p-2.5 bg-gray-100 hover:bg-gray-200 text-[#173B56] rounded-xl transition-all"
            title="Refrescar datos"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {exportSuccess && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{exportSuccess}</span>
        </div>
      )}

      {/* 1. SECCIÓN: DASHBOARD EN POWER BI (TIEMPO REAL) matching mockup */}
      <div className="bg-gradient-to-br from-white via-[#F5F8F7] to-white rounded-3xl p-5 sm:p-6 border border-gray-200 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-200">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#00843D] text-white flex items-center justify-center font-bold shadow-xs">
              <BarChart2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-[#173B56] uppercase tracking-wide">
                Dashboard en Power BI (tiempo real)
              </h3>
              <span className="text-[11px] text-gray-500 font-medium">
                Visualización ejecutiva automatizada
              </span>
            </div>
          </div>

          {/* Interactive Filters Bar matching mockup */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold text-gray-400 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Filtros:
            </span>

            {/* Zona filter */}
            <select
              value={filterZona}
              onChange={(e) => setFilterZona(e.target.value)}
              className="text-xs bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 font-bold text-[#173B56] focus:ring-1 focus:ring-[#00843D]"
            >
              <option value="TODAS">Zona: Todas</option>
              <option value="SUR">Zona Sur</option>
              <option value="NORTE">Zona Norte</option>
            </select>

            {/* Fundo filter */}
            <select
              value={filterFundo}
              onChange={(e) => setFilterFundo(e.target.value)}
              className="text-xs bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 font-bold text-[#173B56] focus:ring-1 focus:ring-[#00843D]"
            >
              <option value="TODOS">Fundo: Todos</option>
              {Array.from(new Set(enrichedRows.map((r) => r.fundo))).map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>

            {/* Cultivo filter */}
            <select
              value={filterCultivo}
              onChange={(e) => setFilterCultivo(e.target.value)}
              className="text-xs bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 font-bold text-[#173B56] focus:ring-1 focus:ring-[#00843D]"
            >
              <option value="TODOS">Cultivo: Todos</option>
              {Array.from(new Set(enrichedRows.map((r) => r.cultivo))).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 4 KPI CARDS MATCHING MOCKUP */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-2xs">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wide block">
              Personas requeridas
            </span>
            <span className="text-2xl sm:text-3xl font-black text-[#00843D] mt-1 block">
              {totalPersonal}
            </span>
            <span className="text-[10px] text-gray-400 font-medium">Total consolidado</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-2xs">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wide block">
              Fundos
            </span>
            <span className="text-2xl sm:text-3xl font-black text-[#173B56] mt-1 block">
              {distinctFundos}
            </span>
            <span className="text-[10px] text-gray-400 font-medium">Destinos asignados</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-2xs">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wide block">
              Servicios / Cultivos
            </span>
            <span className="text-2xl sm:text-3xl font-black text-[#173B56] mt-1 block">
              {distinctCultivos}
            </span>
            <span className="text-[10px] text-gray-400 font-medium">Actividades agrícolas</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-2xs">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wide block">
              Zonas
            </span>
            <span className="text-2xl sm:text-3xl font-black text-[#173B56] mt-1 block">
              {distinctZonas}
            </span>
            <span className="text-[10px] text-gray-400 font-medium">Sur y Norte</span>
          </div>
        </div>

        {/* 2 Visual Charts matching mockup */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left: Bar Chart of Personnel by Paradero */}
          <div className="lg:col-span-7 bg-white p-4 sm:p-5 rounded-2xl border border-gray-200/80 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-[#173B56] tracking-wide flex items-center gap-1.5">
                <BarChart2 className="w-4 h-4 text-[#00843D]" />
                <span>Personal por Paradero</span>
              </span>
              <span className="text-[11px] text-gray-400 font-medium">Ranking</span>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {paraderosSorted.length === 0 ? (
                <div className="text-center py-6 text-gray-400 text-xs italic">
                  Sin registros con los filtros actuales
                </div>
              ) : (
                paraderosSorted.map(([paradero, count]) => {
                  const pctOfMax = Math.round((count / (maxParaderoVal || 1)) * 100);
                  return (
                    <div key={paradero} className="space-y-0.5">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-[#173B56] truncate pr-2">{paradero}</span>
                        <span className="text-[#00843D] font-black">{count}</span>
                      </div>
                      <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#00843D] rounded-full transition-all duration-500"
                          style={{ width: `${pctOfMax}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right: Pie/Donut breakdown by Zona (Sur vs Norte) matching mockup */}
          <div className="lg:col-span-5 bg-white p-4 sm:p-5 rounded-2xl border border-gray-200/80 shadow-2xs space-y-4 flex flex-col justify-between">
            <span className="text-xs font-black uppercase text-[#173B56] tracking-wide flex items-center gap-1.5">
              <PieChart className="w-4 h-4 text-[#00843D]" />
              <span>Distribución por Zona</span>
            </span>

            {/* Visual Donut representation */}
            <div className="flex items-center justify-center py-3">
              <div className="relative w-36 h-36 rounded-full flex items-center justify-center bg-gray-100 shadow-inner">
                {/* Conic gradient simulating donut */}
                <div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: `conic-gradient(#00843D 0% ${pctSur}%, #0284C7 ${pctSur}% 100%)`,
                  }}
                />
                {/* Inner cutout */}
                <div className="w-22 h-22 rounded-full bg-white flex flex-col items-center justify-center z-10 shadow-xs">
                  <span className="text-base font-black text-[#173B56]">{totalPersonal}</span>
                  <span className="text-[9px] font-bold text-gray-400 uppercase">Personas</span>
                </div>
              </div>
            </div>

            {/* Legend & Breakdown */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100 text-xs">
              <div className="bg-[#E8F5EF] p-2.5 rounded-xl border border-[#00843D]/20">
                <div className="flex items-center gap-1.5 text-[#00843D] font-black">
                  <span className="w-2 h-2 rounded-full bg-[#00843D]" />
                  <span>Zona Sur</span>
                </div>
                <div className="text-base font-black text-[#00843D] mt-0.5">
                  {totalZonaSur}{' '}
                  <span className="text-[11px] font-medium text-gray-500">({pctSur}%)</span>
                </div>
              </div>

              <div className="bg-sky-50 p-2.5 rounded-xl border border-sky-200">
                <div className="flex items-center gap-1.5 text-sky-800 font-black">
                  <span className="w-2 h-2 rounded-full bg-sky-600" />
                  <span>Zona Norte</span>
                </div>
                <div className="text-base font-black text-sky-800 mt-0.5">
                  {totalZonaNorte}{' '}
                  <span className="text-[11px] font-medium text-gray-500">({pctNorte}%)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. SECCIÓN: "ASÍ SE VERÁ TU DATA" TABLA RELACIONAL MATCHING MOCKUP */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-gray-200/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#E8F5EF] text-[#00843D] flex items-center justify-center font-bold">
              <Table className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-[#173B56] uppercase tracking-wide">
                Así se verá tu data
              </h3>
              <span className="text-[11px] text-gray-500 font-medium">
                Estructura normalizada y consolidada para reportería analítica
              </span>
            </div>
          </div>

          <span className="text-xs font-bold text-[#00843D] bg-[#E8F5EF] px-3 py-1 rounded-full self-start sm:self-auto">
            {filteredRows.length} registros generados
          </span>
        </div>

        {/* Data Table */}
        <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-[#E8F5EF] text-[#00843D] font-black border-b border-[#00843D]/20">
                  <th className="py-3 px-3">Fecha</th>
                  <th className="py-3 px-3">Hora</th>
                  <th className="py-3 px-3">Fundo</th>
                  <th className="py-3 px-3">Cultivo</th>
                  <th className="py-3 px-3">Zona</th>
                  <th className="py-3 px-3">Paradero</th>
                  <th className="py-3 px-3">Parcela</th>
                  <th className="py-3 px-3 text-right">Cantidad</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-6 text-gray-400 italic">
                      No hay registros para mostrar con los filtros aplicados
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row, idx) => (
                    <tr
                      key={row.id || idx}
                      className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'} hover:bg-emerald-50/30 transition-colors`}
                    >
                      <td className="py-2.5 px-3 font-semibold text-[#173B56]">{row.fecha}</td>
                      <td className="py-2.5 px-3 font-bold text-[#173B56]">{row.hora}</td>
                      <td className="py-2.5 px-3 font-semibold text-[#173B56]">{row.fundo}</td>
                      <td className="py-2.5 px-3 font-bold text-[#00843D]">{row.cultivo}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-black ${
                            row.zona === 'SUR'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-sky-100 text-sky-800'
                          }`}
                        >
                          {row.zona}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-bold text-[#173B56]">{row.paradero}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-gray-700">{row.parcela}</td>
                      <td className="py-2.5 px-3 text-right font-black text-sm text-[#00843D]">
                        {row.cantidad}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="bg-[#E8F5EF]/90 font-black text-xs text-[#00843D] border-t-2 border-[#00843D]/30">
                  <td colSpan={7} className="py-2.5 px-3 uppercase tracking-tight">
                    TOTAL PERSONAL CONSOLIDADO
                  </td>
                  <td className="py-2.5 px-3 text-right text-base font-black">
                    {totalPersonal}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      {/* 3. SECCIÓN: 5 TARJETAS DE BENEFICIOS MATCHING MOCKUP FOOTER */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-white p-3.5 rounded-2xl border border-gray-200 shadow-2xs space-y-1">
          <span className="text-[10px] font-black text-[#00843D] uppercase tracking-wide block">
            Rápido y fácil
          </span>
          <p className="text-xs font-bold text-[#173B56]">Desde el celular</p>
          <span className="text-[11px] text-gray-400 block">Flujo de 5 pasos intuitivo</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-gray-200 shadow-2xs space-y-1">
          <span className="text-[10px] font-black text-[#00843D] uppercase tracking-wide block">
            Información centralizada
          </span>
          <p className="text-xs font-bold text-[#173B56]">Sin múltiples archivos</p>
          <span className="text-[11px] text-gray-400 block">Base de datos unificada</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-gray-200 shadow-2xs space-y-1">
          <span className="text-[10px] font-black text-[#00843D] uppercase tracking-wide block">
            Tu Power BI se actualiza
          </span>
          <p className="text-xs font-bold text-[#173B56]">Automáticamente</p>
          <span className="text-[11px] text-gray-400 block">Sincronización en vivo</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-gray-200 shadow-2xs space-y-1">
          <span className="text-[10px] font-black text-[#00843D] uppercase tracking-wide block">
            Menos errores de data
          </span>
          <p className="text-xs font-bold text-[#173B56]">Totales automáticos</p>
          <span className="text-[11px] text-gray-400 block">Cálculos matemáticos al instante</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-gray-200 shadow-2xs space-y-1">
          <span className="text-[10px] font-black text-[#00843D] uppercase tracking-wide block">
            Ahorra tiempo
          </span>
          <p className="text-xs font-bold text-[#173B56]">Sin revisar registro a registro</p>
          <span className="text-[11px] text-gray-400 block">Reportes listos para auditoría</span>
        </div>
      </div>
    </div>
  );
};

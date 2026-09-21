import React, { useState, useRef, useEffect } from 'react';
import {
  Database,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  HardDrive,
  FileSpreadsheet,
  RefreshCw,
  X,
  Layers,
  Calendar,
} from 'lucide-react';
import {
  getDatabaseStats,
  exportFullDatabaseBackup,
  importFullDatabaseBackup,
  getStoredRequerimientos,
  getStoredDetalles,
  exportToCSV,
  DatabaseStats,
} from '../services/storageService';

interface DatabaseManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataImported?: () => void;
}

export const DatabaseManagementModal: React.FC<DatabaseManagementModalProps> = ({
  isOpen,
  onClose,
  onDataImported,
}) => {
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadStats();
    }
  }, [isOpen]);

  const loadStats = () => {
    setStats(getDatabaseStats());
  };

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleExportJSON = () => {
    exportFullDatabaseBackup();
    showToast('Archivo JSON de la base de datos descargado');
  };

  const handleExportCSV = () => {
    const reqs = getStoredRequerimientos();
    const dets = getStoredDetalles();

    const exportData = reqs.map((r) => {
      const details = dets.filter((d) => d.requerimientoId === r.id);
      const paraderosSummary = details.map((d) => `${d.paradero} (${d.cantidad})`).join(', ');
      return {
        ID: r.id,
        Numero_Requerimiento: r.numeroRequerimiento,
        Fecha: r.fecha,
        Area: r.area,
        Fundo: r.fundo,
        Movimiento: r.movimiento,
        Hora_Recojo: r.horaRecojo,
        Hora_Salida: r.horaSalida,
        Total_Personas: r.totalPersonas,
        Estado: r.estado,
        Usuario: r.usuario,
        Observaciones: r.observaciones,
        Detalle_Paraderos: paraderosSummary,
        Fecha_Registro: r.fechaRegistro,
      };
    });

    exportToCSV(`CAMPOSOL_Requerimientos_${new Date().toISOString().slice(0, 10)}.csv`, exportData);
    showToast('Base de datos exportada a CSV');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const result = importFullDatabaseBackup(content);
        if (result.success) {
          showToast(result.message, 'success');
          loadStats();
          if (onDataImported) onDataImported();
        } else {
          showToast(result.message, 'error');
        }
      } catch (err) {
        showToast('Error al leer el archivo de respaldo', 'error');
      } finally {
        setIsProcessing(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.onerror = () => {
      showToast('Error al cargar el archivo', 'error');
      setIsProcessing(false);
    };

    reader.readAsText(file);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto border border-gray-100">
        {/* Toast Alert */}
        {toast && (
          <div
            className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full text-xs font-bold flex items-center gap-2 shadow-lg ${
              toast.type === 'success'
                ? 'bg-[#173B56] text-white border border-emerald-500/30'
                : 'bg-red-600 text-white'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-white" />
            )}
            <span>{toast.message}</span>
          </div>
        )}

        {/* Modal Header */}
        <div className="bg-[#173B56] text-white p-5 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-white/70 hover:text-white rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#00843D] flex items-center justify-center text-white shadow-md">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold tracking-widest text-emerald-300 uppercase">
                ALMACENAMIENTO DE DATOS
              </span>
              <h2 className="text-lg font-black uppercase tracking-tight">
                Base de Datos Local
              </h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-xs text-white/80 font-medium">Persistencia Activa y Segura</span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Status Metrics Box */}
          <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-[#173B56] uppercase tracking-wide flex items-center gap-1.5">
                <HardDrive className="w-4 h-4 text-[#00843D]" />
                <span>Estado de Almacenamiento</span>
              </span>
              <button
                onClick={loadStats}
                className="text-[11px] font-bold text-[#00843D] hover:underline flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Actualizar</span>
              </button>
            </div>

            {stats && (
              <div className="grid grid-cols-3 gap-2 text-center pt-1">
                <div className="bg-white p-2.5 rounded-xl border border-gray-100 shadow-xs">
                  <div className="text-lg font-black text-[#173B56]">{stats.requerimientosCount}</div>
                  <div className="text-[10px] text-gray-500 font-medium">Requerimientos</div>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-gray-100 shadow-xs">
                  <div className="text-lg font-black text-[#00843D]">{stats.paraderosCount}</div>
                  <div className="text-[10px] text-gray-500 font-medium">Paraderos</div>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-gray-100 shadow-xs">
                  <div className="text-lg font-black text-[#173B56]">{stats.totalSizeKB} KB</div>
                  <div className="text-[10px] text-gray-500 font-medium">Tamaño BD</div>
                </div>
              </div>
            )}

            <div className="text-[11px] text-gray-500 space-y-1 pt-1 border-t border-gray-200/60">
              <div className="flex justify-between">
                <span>Fundos registrados:</span>
                <strong className="text-gray-700">{stats?.fundosCount || 0} fundos</strong>
              </div>
              <div className="flex justify-between">
                <span>Áreas de operación:</span>
                <strong className="text-gray-700">{stats?.areasCount || 0} áreas</strong>
              </div>
              <div className="flex justify-between">
                <span>Comedores:</span>
                <strong className="text-gray-700">{stats?.comedoresCount || 0} comedores</strong>
              </div>
            </div>
          </div>

          {/* Database Backup Actions */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-black text-[#173B56] uppercase tracking-wide">
              Respaldos y Portabilidad
            </h3>

            {/* Descargar Backup JSON */}
            <button
              id="btn-download-db-backup"
              onClick={handleExportJSON}
              className="w-full flex items-center justify-between p-3.5 bg-white border border-gray-200 hover:border-[#00843D] hover:bg-[#E8F5EF]/30 rounded-2xl transition-all shadow-xs group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#E8F5EF] text-[#00843D] flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Download className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <div className="text-xs font-black text-[#173B56] uppercase">
                    Descargar Copia de Seguridad (JSON)
                  </div>
                  <div className="text-[11px] text-gray-500">
                    Guarda todos los datos para restaurarlos en cualquier momento
                  </div>
                </div>
              </div>
            </button>

            {/* Restaurar Backup JSON */}
            <button
              id="btn-import-db-backup"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className="w-full flex items-center justify-between p-3.5 bg-white border border-gray-200 hover:border-[#00843D] hover:bg-[#E8F5EF]/30 rounded-2xl transition-all shadow-xs group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Upload className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <div className="text-xs font-black text-[#173B56] uppercase">
                    Restaurar Base de Datos (JSON)
                  </div>
                  <div className="text-[11px] text-gray-500">
                    Carga un archivo de respaldo previo
                  </div>
                </div>
              </div>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".json,application/json"
              className="hidden"
            />

            {/* Exportar a Excel / CSV */}
            <button
              id="btn-export-db-excel"
              onClick={handleExportCSV}
              className="w-full flex items-center justify-between p-3.5 bg-white border border-gray-200 hover:border-[#00843D] hover:bg-[#E8F5EF]/30 rounded-2xl transition-all shadow-xs group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <div className="text-xs font-black text-[#173B56] uppercase">
                    Exportar Datos a Excel / CSV
                  </div>
                  <div className="text-[11px] text-gray-500">
                    Compatible con Excel y Power BI
                  </div>
                </div>
              </div>
            </button>
          </div>

          {/* Cloud Database Info Note */}
          <div className="p-3.5 bg-emerald-50/70 border border-[#00843D]/20 rounded-2xl text-[11px] text-[#173B56] space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-[#00843D]">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>Tus datos ya se guardan automáticamente</span>
            </div>
            <p className="text-gray-600 leading-relaxed">
              Toda la información registrada (requerimientos, paraderos, fundos y áreas) queda guardada de manera persistente en este dispositivo y navegador. Si deseas compartir o migrar la información a otro equipo, utiliza el botón de <strong>Descargar Copia de Seguridad</strong>.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-[#173B56] hover:bg-[#122e43] text-white rounded-xl text-xs font-bold uppercase transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

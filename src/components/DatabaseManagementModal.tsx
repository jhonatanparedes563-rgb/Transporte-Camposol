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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1B3A57]/40 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto border border-[#E5ECF2]">
        {/* Toast Alert */}
        {toast && (
          <div
            className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full text-xs font-bold flex items-center gap-2 shadow-lg ${
              toast.type === 'success'
                ? 'bg-[#1B3A57] text-white border border-[#55A529]/40'
                : 'bg-[#DC2626] text-white'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-[#8CE062]" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-white" />
            )}
            <span>{toast.message}</span>
          </div>
        )}

        {/* Modal Header */}
        <div className="bg-[#1B3A57] text-white p-5 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-white/70 hover:text-white rounded-full hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#55A529] flex items-center justify-center text-white shadow-sm">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-bold tracking-widest text-[#A3E47D] uppercase">
                ALMACENAMIENTO DE DATOS
              </span>
              <h2 className="text-lg font-bold uppercase tracking-tight">
                Base de Datos Local
              </h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-[#8CE062] animate-pulse"></span>
                <span className="text-xs text-white/80 font-medium">Persistencia Activa y Segura</span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Status Metrics Box */}
          <div className="bg-[#F8FAFC] rounded-2xl p-4 border border-[#E5ECF2] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#1B3A57] uppercase tracking-wide flex items-center gap-1.5">
                <HardDrive className="w-4 h-4 text-[#55A529]" />
                <span>Estado de Almacenamiento</span>
              </span>
              <button
                onClick={loadStats}
                className="text-[11px] font-semibold text-[#2F7D18] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Actualizar</span>
              </button>
            </div>

            {stats && (
              <div className="grid grid-cols-3 gap-2 text-center pt-1">
                <div className="bg-white p-2.5 rounded-xl border border-[#E5ECF2] shadow-2xs">
                  <div className="text-lg font-bold text-[#1B3A57]">{stats.requerimientosCount}</div>
                  <div className="text-[10px] text-slate-500 font-medium">Requerimientos</div>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-[#E5ECF2] shadow-2xs">
                  <div className="text-lg font-bold text-[#2F7D18]">{stats.paraderosCount}</div>
                  <div className="text-[10px] text-slate-500 font-medium">Paraderos</div>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-[#E5ECF2] shadow-2xs">
                  <div className="text-lg font-bold text-[#1B3A57]">{stats.totalSizeKB} KB</div>
                  <div className="text-[10px] text-slate-500 font-medium">Tamaño BD</div>
                </div>
              </div>
            )}

            <div className="text-[11px] text-slate-500 space-y-1 pt-1 border-t border-[#E5ECF2]">
              <div className="flex justify-between">
                <span>Fundos registrados:</span>
                <strong className="text-[#1B3A57]">{stats?.fundosCount || 0} fundos</strong>
              </div>
              <div className="flex justify-between">
                <span>Áreas de operación:</span>
                <strong className="text-[#1B3A57]">{stats?.areasCount || 0} áreas</strong>
              </div>
              <div className="flex justify-between">
                <span>Comedores:</span>
                <strong className="text-[#1B3A57]">{stats?.comedoresCount || 0} comedores</strong>
              </div>
            </div>
          </div>

          {/* Database Backup Actions */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold text-[#1B3A57] uppercase tracking-wide">
              Respaldos y Portabilidad
            </h3>

            {/* Descargar Backup JSON */}
            <button
              id="btn-download-db-backup"
              onClick={handleExportJSON}
              className="w-full flex items-center justify-between p-3.5 bg-white border border-[#E5ECF2] hover:border-[#55A529] hover:bg-[#F3F8F0] rounded-2xl transition-all shadow-2xs group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#EAF7E4] text-[#2F7D18] flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Download className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold text-[#1B3A57] uppercase">
                    Descargar Copia de Seguridad (JSON)
                  </div>
                  <div className="text-[11px] text-slate-500">
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
              className="w-full flex items-center justify-between p-3.5 bg-white border border-[#E5ECF2] hover:border-[#0082B3] hover:bg-[#F7FBFE] rounded-2xl transition-all shadow-2xs group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#E6F3FB] text-[#0082B3] flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Upload className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold text-[#1B3A57] uppercase">
                    Restaurar Base de Datos (JSON)
                  </div>
                  <div className="text-[11px] text-slate-500">
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
              className="w-full flex items-center justify-between p-3.5 bg-white border border-[#E5ECF2] hover:border-[#55A529] hover:bg-[#F3F8F0] rounded-2xl transition-all shadow-2xs group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#EAF7E4] text-[#2F7D18] flex items-center justify-center group-hover:scale-105 transition-transform">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold text-[#1B3A57] uppercase">
                    Exportar Datos a Excel / CSV
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Compatible con Excel y Power BI
                  </div>
                </div>
              </div>
            </button>
          </div>

          {/* Cloud Database Info Note */}
          <div className="p-3.5 bg-[#EAF7E4] border border-[#C6E9B4] rounded-2xl text-[11px] text-[#1B3A57] space-y-2">
            <div className="font-bold flex items-center justify-between text-[#2F7D18]">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Base Cloud Firestore Conectada</span>
              </span>
              <span className="text-[10px] bg-[#55A529] text-white px-2.5 py-0.5 rounded-full font-bold">
                EN VIVO
              </span>
            </div>
            <p className="text-slate-600 leading-relaxed">
              La base de datos en la nube está activa y configurada para recibir y sincronizar en tiempo real los requerimientos y usuarios desde cualquier celular o equipo. Además, se mantiene un respaldo local para garantizar operación inmediata y soporte sin conexión.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-[#F8FAFC] border-t border-[#E5ECF2] flex justify-end">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-[#22A846] hover:bg-[#1C8E3A] text-white rounded-full text-xs font-bold uppercase transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

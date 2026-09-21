import React from 'react';
import {
  X,
  Calendar,
  Building,
  Compass,
  Clock,
  Users,
  Utensils,
  MapPin,
  FileText,
  Copy,
  CheckCircle2,
  AlertCircle,
  Clock3,
  XCircle,
  CheckCheck,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { Requerimiento, DetalleRequerimiento, EstadoRequerimiento, UserRole } from '../types';
import {
  getDetallesByRequerimientoId,
  updateRequerimientoEstado,
  deleteRequerimiento,
} from '../services/storageService';
import { ShieldCheck, Info } from 'lucide-react';

interface RequirementDetailModalProps {
  requerimiento: Requerimiento;
  onClose: () => void;
  onStatusChange?: () => void;
  onDelete?: (id: string) => void;
  userRole?: UserRole;
}

export const RequirementDetailModal: React.FC<RequirementDetailModalProps> = ({
  requerimiento,
  onClose,
  onStatusChange,
  onDelete,
  userRole = 'admin',
}) => {
  const [copied, setCopied] = React.useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = React.useState(false);
  const detalles: DetalleRequerimiento[] = getDetallesByRequerimientoId(requerimiento.id);
  const canManageStatus = userRole === 'admin' || userRole === 'receptor';

  // Group detalles by comedor
  const groupedByComedor = detalles.reduce((acc, curr) => {
    if (!acc[curr.comedor]) {
      acc[curr.comedor] = [];
    }
    acc[curr.comedor].push(curr);
    return acc;
  }, {} as Record<string, DetalleRequerimiento[]>);

  const copyReqNumber = () => {
    navigator.clipboard.writeText(requerimiento.numeroRequerimiento);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Helper for status badge styling
  const getStatusBadge = (estado: EstadoRequerimiento) => {
    switch (estado) {
      case 'APROBADO':
        return {
          bg: 'bg-emerald-100 text-emerald-800 border-emerald-300',
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
        };
      case 'ATENDIDO':
        return {
          bg: 'bg-blue-100 text-blue-800 border-blue-300',
          icon: <CheckCheck className="w-4 h-4 text-blue-600" />,
        };
      case 'EN REVISIÓN':
        return {
          bg: 'bg-purple-100 text-purple-800 border-purple-300',
          icon: <Clock3 className="w-4 h-4 text-purple-600" />,
        };
      case 'RECHAZADO':
        return {
          bg: 'bg-red-100 text-red-800 border-red-300',
          icon: <XCircle className="w-4 h-4 text-red-600" />,
        };
      case 'PENDIENTE':
      default:
        return {
          bg: 'bg-amber-100 text-amber-800 border-amber-300',
          icon: <Clock className="w-4 h-4 text-amber-600" />,
        };
    }
  };

  const statusStyle = getStatusBadge(requerimiento.estado);

  // Quick action to change status (demonstrates operational workflow)
  const handleQuickStatusUpdate = (newStatus: EstadoRequerimiento) => {
    updateRequerimientoEstado(requerimiento.id, newStatus);
    requerimiento.estado = newStatus;
    if (onStatusChange) onStatusChange();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-lg md:max-w-2xl lg:max-w-3xl rounded-3xl bg-white text-[#173B56] shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in duration-200">
        {/* Modal Header */}
        <div className="bg-[#00843D] text-white p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-base sm:text-lg font-black tracking-wider">
              {requerimiento.numeroRequerimiento}
            </span>
            <button
              onClick={copyReqNumber}
              className="p-1 rounded-md hover:bg-white/20 text-white/90 transition-colors"
              title="Copiar código"
            >
              {copied ? <span className="text-[10px] font-bold">¡Copiado!</span> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-4 sm:space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Status Bar */}
          <div className="flex items-center justify-between bg-gray-50 p-3 sm:p-4 rounded-2xl border border-gray-200">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-500">Estado:</span>
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black border ${statusStyle.bg}`}
              >
                {statusStyle.icon}
                <span>{requerimiento.estado}</span>
              </span>
            </div>

            <span
              className={`text-xs font-black px-3 py-1 rounded-lg ${
                requerimiento.movimiento === 'INGRESO'
                  ? 'bg-[#E8F5EF] text-[#00843D]'
                  : 'bg-blue-50 text-blue-700'
              }`}
            >
              {requerimiento.movimiento}
            </span>
          </div>

          {/* Service Details Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs bg-[#F5F8F7] p-4 sm:p-5 rounded-2xl border border-gray-200">
            <div>
              <span className="text-gray-400 block font-medium">Fecha</span>
              <span className="font-black text-[#173B56] text-sm">
                {requerimiento.fecha}
              </span>
            </div>

            <div>
              <span className="text-gray-400 block font-medium">Área</span>
              <span className="font-black text-[#173B56] text-sm truncate block">
                {requerimiento.area}
              </span>
            </div>

            <div>
              <span className="text-gray-400 block font-medium">Fundo</span>
              <span className="font-black text-[#173B56] text-sm truncate block">
                {requerimiento.fundo}
              </span>
            </div>

            <div>
              <span className="text-gray-400 block font-medium">Total Solicitado</span>
              <span className="font-black text-[#00843D] text-sm">
                {requerimiento.totalPersonas} personas
              </span>
            </div>

            <div>
              <span className="text-gray-400 block font-medium">Hora Recojo</span>
              <span className="font-bold text-[#173B56]">{requerimiento.horaRecojo}</span>
            </div>

            <div>
              <span className="text-gray-400 block font-medium">Hora Salida</span>
              <span className="font-bold text-[#173B56]">{requerimiento.horaSalida}</span>
            </div>

            <div className="col-span-2 md:col-span-3 pt-2 border-t border-gray-200/60">
              <span className="text-gray-400 block font-medium">Solicitante (Registrado por)</span>
              <span className="font-bold text-[#173B56] flex items-center gap-1.5 flex-wrap">
                <span>{requerimiento.usuario || 'Supervisor de Campo'}</span>
                {requerimiento.userUsername && (
                  <span className="text-[11px] font-mono font-medium text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded">
                    @{requerimiento.userUsername}
                  </span>
                )}
                <span className="text-xs font-normal text-gray-500">
                  • {new Date(requerimiento.fechaRegistro).toLocaleString()}
                </span>
              </span>
            </div>
          </div>

          {requerimiento.observaciones && (
            <div className="text-xs bg-amber-50/50 p-3.5 rounded-xl border border-amber-200/60">
              <span className="font-bold text-amber-900 block mb-0.5">Observaciones:</span>
              <p className="text-gray-700">{requerimiento.observaciones}</p>
            </div>
          )}

          {/* Detailed Breakdown per Comedor and Paradero */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase text-[#173B56] tracking-wider flex items-center justify-between">
              <span>DESGLOSE POR COMEDOR Y PARADERO</span>
              <span className="text-[#00843D] font-bold">
                {Object.keys(groupedByComedor).length} Comedores
              </span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.entries(groupedByComedor).map(([comedorNum, items]) => {
                const comedorTotal = items.reduce((sum, item) => sum + item.cantidad, 0);
                return (
                  <div
                    key={comedorNum}
                    className="border border-gray-200 rounded-2xl p-3.5 space-y-2 bg-white"
                  >
                    <div className="flex items-center justify-between pb-1.5 border-b border-gray-100">
                      <span className="font-black text-xs text-[#00843D] uppercase flex items-center gap-1.5">
                        <Utensils className="w-3.5 h-3.5" />
                        <span>COMEDOR {comedorNum}</span>
                      </span>
                      <span className="text-xs font-black text-gray-800">
                        Subtotal: {comedorTotal} pers.
                      </span>
                    </div>

                    <div className="space-y-1">
                      {items.map((it) => (
                        <div
                          key={it.id}
                          className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-gray-50"
                        >
                          <span className="text-gray-700 font-medium flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-gray-400" />
                            <span>{it.paradero}</span>
                          </span>
                          <span className="font-bold text-[#173B56]">
                            {it.cantidad} persona{it.cantidad > 1 ? 's' : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Status management section */}
          {canManageStatus ? (
            <div className="pt-3 border-t border-gray-100">
              <div className="flex items-center gap-1.5 mb-2">
                <ShieldCheck className="w-4 h-4 text-[#00843D]" />
                <span className="text-xs font-black text-[#173B56] uppercase tracking-tight">
                  {userRole === 'receptor' ? 'Gestión de Solicitud (Receptor):' : 'Control Operativo (Administrador):'}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                {(['PENDIENTE', 'EN REVISIÓN', 'APROBADO', 'ATENDIDO', 'RECHAZADO'] as EstadoRequerimiento[]).map(
                  (st) => (
                    <button
                      key={st}
                      onClick={() => handleQuickStatusUpdate(st)}
                      className={`px-2 py-2 text-[10px] font-black rounded-xl uppercase transition-all flex items-center justify-center ${
                        requerimiento.estado === st
                          ? 'bg-[#00843D] text-white shadow-md ring-2 ring-[#00843D]/30 scale-[1.02]'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      }`}
                    >
                      {st}
                    </button>
                  )
                )}
              </div>
            </div>
          ) : (
            <div className="pt-3 border-t border-gray-100">
              <div className="flex items-start gap-2 bg-[#E8F5EF] p-3 rounded-xl border border-emerald-200 text-xs text-emerald-900">
                <Info className="w-4 h-4 text-[#00843D] shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">Estado Actual: {requerimiento.estado}</span>
                  <span className="text-[11px] text-emerald-800">
                    Tu solicitud está en manos de la Coordinación de Transporte de CAMPOSOL.
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between gap-3">
          {canManageStatus ? (
            <button
              id="btn-delete-from-modal"
              type="button"
              onClick={() => setShowConfirmDelete(true)}
              className="px-4 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-bold transition-colors flex items-center gap-1.5 shadow-2xs"
              title="Eliminar este requerimiento de la base de datos"
            >
              <Trash2 className="w-4 h-4" />
              <span>Eliminar Requerimiento</span>
            </button>
          ) : (
            <div />
          )}

          <button
            onClick={onClose}
            className={`${
              canManageStatus ? 'px-6' : 'w-full'
            } py-2.5 rounded-xl bg-[#00843D] hover:bg-[#006e33] active:bg-[#005728] text-white text-xs font-bold transition-colors`}
          >
            Cerrar Detalle
          </button>
        </div>
      </div>

      {/* Confirmation dialog for deleting requirement from modal */}
      {showConfirmDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-red-150 p-6 overflow-hidden">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-black text-[#173B56]">
                  ¿Eliminar Requerimiento?
                </h3>
                <p className="text-xs text-red-600 font-bold">
                  {requerimiento.numeroRequerimiento}
                </p>
              </div>
            </div>

            <p className="text-xs text-gray-600 mb-4 leading-relaxed">
              ¿Estás seguro de que deseas eliminar este requerimiento (<strong>{requerimiento.fundo}</strong>, <strong>{requerimiento.totalPersonas} personas</strong>)? Esta acción es irreversible y lo eliminará del servidor web.
            </p>

            <div className="flex items-start gap-2 bg-red-50 p-3 rounded-xl border border-red-200 text-xs text-red-800 mb-5">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <p className="text-[11px] leading-relaxed">
                Se eliminarán todos los desgloses de paraderos y registros de personas asociados a esta solicitud.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowConfirmDelete(false)}
                className="px-4 py-2.5 rounded-xl border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteRequerimiento(requerimiento.id);
                  setShowConfirmDelete(false);
                  if (onDelete) onDelete(requerimiento.id);
                  if (onStatusChange) onStatusChange();
                  onClose();
                }}
                className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Sí, Eliminar</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import {
  Search,
  Filter,
  Users,
  Clock,
  Calendar,
  Building,
  Compass,
  ArrowRight,
  PlusCircle,
  CheckCircle2,
  Clock3,
  XCircle,
  CheckCheck,
  ChevronRight,
  History,
  RotateCcw,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { Requerimiento, EstadoRequerimiento, UserRole } from '../types';
import { updateRequerimientoEstado } from '../services/storageService';
import { getHorarioDisplay } from '../data/masterData';

interface MyRequirementsScreenProps {
  requerimientos: Requerimiento[];
  onSelectRequirement: (req: Requerimiento) => void;
  onNewRequirement: () => void;
  userRole?: UserRole;
}

export const MyRequirementsScreen: React.FC<MyRequirementsScreenProps> = ({
  requerimientos,
  onSelectRequirement,
  onNewRequirement,
  userRole = 'admin',
}) => {
  const isAdmin = userRole === 'admin';
  const [apartadoTab, setApartadoTab] = useState<'activos' | 'historial'>('activos');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedEstadoFilter, setSelectedEstadoFilter] = useState<string>('TODOS');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Restore requirement from history
  const handleRestore = (req: Requerimiento, e: React.MouseEvent) => {
    e.stopPropagation();
    updateRequerimientoEstado(req.id, 'PENDIENTE', 'Usuario', 'Restaurado desde historial');
    showToast(`Requerimiento ${req.numeroRequerimiento} restaurado a Activo`);
  };

  // Format date nicely: YYYY-MM-DD -> DD/MM/YYYY
  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return '';
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

  // Status visual badge styling
  const getStatusStyle = (estado: EstadoRequerimiento) => {
    switch (estado) {
      case 'APROBADO':
        return {
          badge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
          dot: 'bg-emerald-500',
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />,
        };
      case 'ATENDIDO':
        return {
          badge: 'bg-blue-100 text-blue-800 border-blue-300',
          dot: 'bg-blue-500',
          icon: <CheckCheck className="w-3.5 h-3.5 text-blue-600" />,
        };
      case 'EN REVISIÓN':
        return {
          badge: 'bg-purple-100 text-purple-800 border-purple-300',
          dot: 'bg-purple-500',
          icon: <Clock3 className="w-3.5 h-3.5 text-purple-600" />,
        };
      case 'RECHAZADO':
        return {
          badge: 'bg-red-100 text-red-800 border-red-300',
          dot: 'bg-red-500',
          icon: <XCircle className="w-3.5 h-3.5 text-red-600" />,
        };
      case 'ANULADO':
        return {
          badge: 'bg-rose-50 text-rose-800 border-rose-200',
          dot: 'bg-rose-500',
          icon: <XCircle className="w-3.5 h-3.5 text-rose-600" />,
        };
      case 'PENDIENTE':
      default:
        return {
          badge: 'bg-amber-100 text-amber-800 border-amber-300',
          dot: 'bg-amber-500',
          icon: <Clock className="w-3.5 h-3.5 text-amber-600" />,
        };
    }
  };

  const reqsActivos = requerimientos.filter((r) => r.estado !== 'ANULADO');
  const reqsHistorial = requerimientos.filter((r) => r.estado === 'ANULADO');

  // Filtered requirements based on selected apartado
  const currentList = apartadoTab === 'activos' ? reqsActivos : reqsHistorial;

  const filtered = currentList.filter((r) => {
    const matchesEstado =
      selectedEstadoFilter === 'TODOS' || r.estado === selectedEstadoFilter;
    const q = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !q ||
      r.numeroRequerimiento.toLowerCase().includes(q) ||
      r.area.toLowerCase().includes(q) ||
      r.fundo.toLowerCase().includes(q) ||
      r.fecha.includes(q);
    return matchesEstado && matchesSearch;
  });

  const activeStatuses: (EstadoRequerimiento | 'TODOS')[] = [
    'TODOS',
    'PENDIENTE',
    'EN REVISIÓN',
    'APROBADO',
    'ATENDIDO',
    'RECHAZADO',
  ];

  return (
    <div className="space-y-4 w-full max-w-7xl mx-auto pb-24 px-3 sm:px-6 lg:px-8 py-4">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 bg-[#1B3A57] text-white px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-bold animate-in fade-in slide-in-from-top duration-200">
          <CheckCircle2 className="w-4 h-4 text-[#8CE062]" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Top Banner with Counter & New Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-[#E5ECF2] shadow-xs">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-[#1B3A57] uppercase tracking-tight">
            {isAdmin ? 'Bandeja de Recepción (Admin)' : 'Mis Requerimientos de Bus'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {reqsActivos.length} activos en curso • {reqsHistorial.length} en historial de trazabilidad
          </p>
        </div>

        <button
          onClick={onNewRequirement}
          className="bg-[#22A846] text-white px-4 py-2 rounded-full text-xs sm:text-sm font-semibold hover:bg-[#1C8E3A] active:scale-95 transition-all flex items-center justify-center gap-2 shadow-xs shrink-0 cursor-pointer"
        >
          <PlusCircle className="w-4 h-4 sm:w-5 sm:h-5" />
          <span>Nuevo Requerimiento</span>
        </button>
      </div>

      {/* APARTADOS: Selector de Pestañas Activos vs Historial */}
      <div className="grid grid-cols-2 gap-2 p-1.5 bg-[#E5ECF2] rounded-2xl">
        <button
          type="button"
          onClick={() => {
            setApartadoTab('activos');
            setSelectedEstadoFilter('TODOS');
          }}
          className={`py-2 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
            apartadoTab === 'activos'
              ? 'bg-white text-[#2F7D18] shadow-xs'
              : 'text-slate-600 hover:text-[#1B3A57]'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Requerimientos Activos</span>
          <span className={`text-[10px] px-2 py-0.2 rounded-full font-bold ${
            apartadoTab === 'activos' ? 'bg-[#EAF7E4] text-[#2F7D18]' : 'bg-white/70 text-slate-600'
          }`}>
            {reqsActivos.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setApartadoTab('historial');
            setSelectedEstadoFilter('TODOS');
          }}
          className={`py-2 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
            apartadoTab === 'historial'
              ? 'bg-white text-[#1B3A57] shadow-xs'
              : 'text-slate-600 hover:text-[#1B3A57]'
          }`}
        >
          <History className="w-4 h-4 text-[#DC2626]" />
          <span>Historial & Anulados</span>
          <span className={`text-[10px] px-2 py-0.2 rounded-full font-bold ${
            apartadoTab === 'historial' ? 'bg-[#FDECEC] text-[#DC2626]' : 'bg-white/70 text-slate-600'
          }`}>
            {reqsHistorial.length}
          </span>
        </button>
      </div>

      {/* Mensaje informativo cuando está en el apartado de Historial */}
      {apartadoTab === 'historial' && (
        <div className="flex items-start gap-2.5 bg-[#FDECEC] border border-[#FECACA] p-3 rounded-2xl text-xs text-[#DC2626]">
          <ShieldCheck className="w-4 h-4 text-[#DC2626] shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block">Apartado de Historial & Trazabilidad</span>
            <p className="text-[11px] text-[#DC2626]/90 leading-tight">
              Aquí se almacenan los requerimientos borrados o cancelados. Los datos de personas y paraderos permanecen guardados para trazabilidad histórica. Si borraste uno por error, puedes restaurarlo.
            </p>
          </div>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="space-y-3 bg-white p-3.5 sm:p-5 rounded-2xl border border-[#E5ECF2] shadow-xs">
        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-[#55A529] absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por código, área, fundo o fecha..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-9 h-10 bg-white border border-[#D8E2EA] rounded-full text-xs sm:text-sm text-[#1B3A57] focus:outline-none focus:border-[#55A529] transition-colors"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        {/* Estado Filter Chips (Solo en activos) */}
        {apartadoTab === 'activos' && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none pt-0.5">
            {activeStatuses.map((st) => {
              const isSelected = selectedEstadoFilter === st;
              const count =
                st === 'TODOS'
                  ? reqsActivos.length
                  : reqsActivos.filter((r) => r.estado === st).length;

              return (
                <button
                  key={st}
                  onClick={() => setSelectedEstadoFilter(st)}
                  className={`px-3 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 border cursor-pointer ${
                    isSelected
                      ? 'bg-[#22A846] text-white border-[#22A846] shadow-xs'
                      : 'bg-white text-slate-600 border-[#D8E2EA] hover:bg-[#F3F8F0]'
                  }`}
                >
                  <span>{st}</span>
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold ${
                      isSelected ? 'bg-white text-[#22A846]' : 'bg-[#F1F5F9] text-slate-500'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* REQUIREMENTS LIST: Responsive Grid */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 border border-[#E5ECF2] text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-[#EAF7E4] text-[#2F7D18] flex items-center justify-center mx-auto">
            {apartadoTab === 'historial' ? (
              <History className="w-6 h-6 text-[#DC2626]" />
            ) : (
              <Filter className="w-6 h-6" />
            )}
          </div>
          <h3 className="text-base font-bold text-[#1B3A57]">
            {apartadoTab === 'historial'
              ? 'No hay requerimientos en el historial'
              : 'No hay requerimientos activos con estos filtros'}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {apartadoTab === 'historial'
              ? 'Cuando un requerimiento sea anulado o borrado, quedará almacenado en este apartado con su trazabilidad completa.'
              : 'Intenta cambiar los filtros seleccionados o registra una nueva solicitud de transporte.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {filtered.map((req) => {
            const statusStyle = getStatusStyle(req.estado);
            const isAnulado = req.estado === 'ANULADO';

            return (
              <div
                key={req.id}
                onClick={() => onSelectRequirement(req)}
                className={`group bg-white rounded-2xl p-4 border transition-all cursor-pointer shadow-xs hover:shadow-md flex flex-col justify-between ${
                  isAnulado
                    ? 'border-[#FECACA] hover:border-rose-400 bg-[#FDECEC]/15'
                    : 'border-[#E5ECF2] hover:border-[#55A529]'
                }`}
              >
                <div>
                  {/* Card Header: Requerimiento Code & Status Badge */}
                  <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${statusStyle.dot}`} />
                      <span className="font-bold text-sm text-[#1B3A57] group-hover:text-[#55A529] transition-colors">
                        {req.numeroRequerimiento}
                      </span>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${statusStyle.badge}`}
                    >
                      {statusStyle.icon}
                      <span>{req.estado}</span>
                    </span>
                  </div>

                  {/* Card Body: Info Fields */}
                  <div className="pt-3 space-y-2 text-xs">
                    {/* Fecha de Servicio */}
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="flex items-center gap-1.5 text-slate-500 font-medium">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>Fecha Servicio:</span>
                      </span>
                      <span className="font-bold text-[#1B3A57]">
                        {formatDisplayDate(req.fecha)}
                      </span>
                    </div>

                    {/* Fundo & Área */}
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="flex items-center gap-1.5 text-slate-500 font-medium">
                        <Building className="w-3.5 h-3.5 text-slate-400" />
                        <span>Fundo / Área:</span>
                      </span>
                      <span className="font-bold text-[#1B3A57] truncate max-w-[170px]">
                        {req.fundo} ({req.area})
                      </span>
                    </div>

                    {/* Horarios */}
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="flex items-center gap-1.5 text-slate-500 font-medium">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>Horarios:</span>
                      </span>
                      <span className="font-medium text-slate-700">
                        {getHorarioDisplay(req).textoHorario}
                      </span>
                    </div>

                    {/* Personal Total */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                      <span className="flex items-center gap-1.5 text-slate-500 font-medium">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <span>Total Personas:</span>
                      </span>
                      <span className="font-bold text-sm text-[#2F7D18]">
                        {req.totalPersonas} pax
                      </span>
                    </div>

                    {/* Si está anulado, mostrar información de trazabilidad */}
                    {isAnulado && (
                      <div className="mt-2 p-2 rounded-xl bg-[#FDECEC] border border-[#FECACA] text-[11px] text-[#DC2626] space-y-1">
                        <div className="flex items-center justify-between font-bold">
                          <span>Guardado en Historial</span>
                          {req.fechaAnulacion && (
                            <span className="font-normal text-[10px] text-[#DC2626]/80">
                              {new Date(req.fechaAnulacion).toLocaleDateString('es-PE')}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-[#DC2626]/90 italic truncate">
                          Motivo: {req.motivoAnulacion || 'Anulado de la programación diaria.'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Footer: Action button */}
                <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between">
                  {isAnulado ? (
                    <button
                      type="button"
                      onClick={(e) => handleRestore(req, e)}
                      className="px-3 py-1 rounded-full bg-[#EAF7E4] text-[#2F7D18] hover:bg-emerald-100 border border-[#C6E9B4] text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                      title="Restaurar este requerimiento a la bandeja activa"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Restaurar</span>
                    </button>
                  ) : (
                    <span className="text-[11px] text-slate-400 font-medium">
                      {req.usuario}
                    </span>
                  )}

                  <span className="text-xs font-semibold text-[#2F7D18] flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                    <span>Ver detalle</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};


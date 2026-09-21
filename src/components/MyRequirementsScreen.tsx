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
} from 'lucide-react';
import { Requerimiento, EstadoRequerimiento, UserRole } from '../types';

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
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedEstadoFilter, setSelectedEstadoFilter] = useState<string>('TODOS');

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

  // Helper for status visual styling
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
      case 'PENDIENTE':
      default:
        return {
          badge: 'bg-amber-100 text-amber-800 border-amber-300',
          dot: 'bg-amber-500',
          icon: <Clock className="w-3.5 h-3.5 text-amber-600" />,
        };
    }
  };

  // Filtered requirements
  const filtered = requerimientos.filter((r) => {
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

  const allStatuses: (EstadoRequerimiento | 'TODOS')[] = [
    'TODOS',
    'PENDIENTE',
    'EN REVISIÓN',
    'APROBADO',
    'ATENDIDO',
    'RECHAZADO',
  ];

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto pb-24 px-4 sm:px-6 lg:px-8 py-6">
      {/* Top Banner with Counter & New Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs">
        <div>
          <h2 className="text-xl font-black text-[#173B56] uppercase tracking-tight">
            {isAdmin ? 'Bandeja de Recepción (Admin)' : 'Mis Requerimientos de Bus'}
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            {isAdmin
              ? `${requerimientos.length} solicitudes recibidas para gestión, aprobación y control`
              : `${requerimientos.length} solicitud${requerimientos.length !== 1 ? 'es' : ''} de transporte registrada${requerimientos.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        <button
          onClick={onNewRequirement}
          className="bg-[#00843D] text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold hover:bg-[#006e33] active:scale-95 transition-all flex items-center justify-center gap-2 shadow-xs shrink-0"
        >
          <PlusCircle className="w-4 h-4 sm:w-5 sm:h-5" />
          <span>Nuevo Requerimiento</span>
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="space-y-3 bg-white p-4 sm:p-5 rounded-2xl border border-gray-200/80 shadow-xs">
        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por código (ej. REQ-000001), área, fundo o fecha..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-9 py-2.5 bg-gray-50/70 hover:bg-gray-50 focus:bg-white border border-gray-200/90 rounded-xl text-xs sm:text-sm text-[#173B56] focus:outline-none focus:ring-2 focus:ring-[#00843D] shadow-2xs transition-colors"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600 p-1"
            >
              ✕
            </button>
          )}
        </div>

        {/* Estado Filter Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none pt-1">
          {allStatuses.map((st) => {
            const isSelected = selectedEstadoFilter === st;
            const count =
              st === 'TODOS'
                ? requerimientos.length
                : requerimientos.filter((r) => r.estado === st).length;

            return (
              <button
                key={st}
                onClick={() => setSelectedEstadoFilter(st)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 shrink-0 border ${
                  isSelected
                    ? 'bg-[#00843D] text-white border-[#00843D] shadow-xs'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                <span>{st}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                    isSelected ? 'bg-white text-[#00843D]' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* REQUIREMENTS LIST: Responsive Grid */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 border border-gray-200 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-[#E8F5EF] text-[#00843D] flex items-center justify-center mx-auto">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-sm sm:text-base font-bold text-[#173B56]">
            No se encontraron requerimientos
          </h3>
          <p className="text-xs sm:text-sm text-gray-400 max-w-sm mx-auto">
            {searchTerm || selectedEstadoFilter !== 'TODOS'
              ? 'Prueba modificando el término de búsqueda o el filtro de estado.'
              : 'Aún no has registrado requerimientos de bus.'}
          </p>
          <button
            onClick={onNewRequirement}
            className="mt-2 inline-flex items-center gap-1.5 bg-[#00843D] text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold hover:bg-[#006e33]"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Crear primer requerimiento</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((req) => {
            const stStyle = getStatusStyle(req.estado);

            return (
              <div
                key={req.id}
                id={`card-${req.numeroRequerimiento.toLowerCase()}`}
                onClick={() => onSelectRequirement(req)}
                className="bg-white rounded-2xl p-4 sm:p-5 border border-gray-200/90 hover:border-[#00843D] hover:shadow-md active:scale-[0.99] transition-all cursor-pointer space-y-3.5 relative group flex flex-col justify-between"
              >
                {/* Header Row: Número + Fecha + Estado */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-sm text-[#00843D] bg-[#E8F5EF] px-2.5 py-1 rounded-lg">
                      {req.numeroRequerimiento}
                    </span>
                    <span className="text-xs font-semibold text-gray-500 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-gray-400" />
                      {formatDisplayDate(req.fecha)}
                    </span>
                  </div>

                  {/* Estado Visual Badge */}
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black border ${stStyle.badge}`}
                  >
                    {stStyle.icon}
                    <span>{req.estado}</span>
                  </span>
                </div>

                {/* Body Row: Area & Fundo */}
                <div className="grid grid-cols-2 gap-3 text-xs bg-gray-50/60 p-3 rounded-xl border border-gray-100">
                  <div>
                    <span className="text-gray-400 block text-[10px] font-bold uppercase">Área</span>
                    <span className="font-extrabold text-[#173B56] text-sm block truncate">
                      {req.area}
                    </span>
                  </div>

                  <div>
                    <span className="text-gray-400 block text-[10px] font-bold uppercase">Fundo</span>
                    <span className="font-extrabold text-[#173B56] text-sm block truncate">
                      {req.fundo}
                    </span>
                  </div>
                </div>

                {/* Footer Row: Movimiento, Hora, Total personas */}
                <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`font-extrabold px-2 py-0.5 rounded-md text-[11px] ${
                        req.movimiento === 'INGRESO'
                          ? 'bg-emerald-50 text-[#00843D]'
                          : 'bg-blue-50 text-blue-700'
                      }`}
                    >
                      {req.movimiento === 'INGRESO' ? '↓ INGRESO' : '↑ SALIDA'}
                    </span>

                    <span className="text-gray-600 font-bold flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-gray-400" />
                      {req.horaRecojo}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 font-black text-[#00843D] text-sm">
                    <Users className="w-4 h-4" />
                    <span>{req.totalPersonas}</span>
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#00843D] group-hover:translate-x-0.5 transition-all ml-1" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

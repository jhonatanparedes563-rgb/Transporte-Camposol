import React from 'react';
import {
  Bus,
  PlusCircle,
  ClipboardList,
  ArrowRight,
  Clock,
  Calendar,
  Users,
  CheckCircle2,
  Clock3,
  XCircle,
  CheckCheck,
  ChevronRight,
  Info,
  UserCheck,
} from 'lucide-react';
import { Requerimiento, EstadoRequerimiento, AppUser } from '../types';

interface UserHomeScreenProps {
  onNewRequirement: () => void;
  onMyRequirements: () => void;
  requerimientos: Requerimiento[];
  onSelectRequirement: (req: Requerimiento) => void;
  onOpenRoleSwitcher?: () => void;
  currentUser?: AppUser;
}

export const UserHomeScreen: React.FC<UserHomeScreenProps> = ({
  onNewRequirement,
  onMyRequirements,
  requerimientos,
  onSelectRequirement,
  currentUser,
}) => {
  // Count user metrics (user only sees their own summary, no admin KPIs)
  const totalReqs = requerimientos.length;
  const pendingReqs = requerimientos.filter((r) => r.estado === 'PENDIENTE' || r.estado === 'EN REVISIÓN').length;
  const approvedReqs = requerimientos.filter((r) => r.estado === 'APROBADO').length;
  const attendedReqs = requerimientos.filter((r) => r.estado === 'ATENDIDO').length;

  // Latest requirement (if any)
  const latestReq = requerimientos.length > 0 ? requerimientos[0] : null;

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
      case 'PENDIENTE':
      default:
        return {
          badge: 'bg-amber-100 text-amber-800 border-amber-300',
          dot: 'bg-amber-500',
          icon: <Clock className="w-3.5 h-3.5 text-amber-600" />,
        };
    }
  };

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

  return (
    <div className="flex flex-col w-full p-4 space-y-4 pb-24">
      {/* 1. Header Hero Card */}
      <div className="bg-white rounded-3xl p-5 border border-gray-200/90 shadow-xs relative overflow-hidden">
        {/* Subtle background decoration */}
        <div className="absolute -right-6 -bottom-6 opacity-5 pointer-events-none">
          <Bus className="w-36 h-36 text-[#00843D]" />
        </div>

        <div className="flex items-center gap-3 mb-1.5">
          <div className="w-11 h-11 rounded-2xl bg-[#E8F5EF] flex items-center justify-center text-[#00843D] shadow-xs shrink-0">
            <Bus className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-[#00843D] block">
              CAMPOSOL
            </span>
            <h1 className="text-base font-black text-[#173B56] leading-tight">
              Transporte de Personal
            </h1>
          </div>
        </div>

        <p className="text-xs text-gray-500 leading-relaxed mt-2">
          Registra y consulta tus requerimientos de buses para el ingreso o salida de personal de tu área.
        </p>

        {/* User identification badge from active session */}
        {currentUser && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-[#E8F5EF] text-[#00843D] flex items-center justify-center font-bold text-xs">
                <UserCheck className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-gray-400 block uppercase leading-none">
                  Solicitante Conectado
                </span>
                <span className="text-xs font-black text-[#173B56] leading-tight block">
                  {currentUser.nombre}
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-extrabold text-[#00843D] bg-[#E8F5EF] px-2 py-0.5 rounded-full inline-block">
                {currentUser.area}
              </span>
              <span className="text-[10px] text-gray-400 block mt-0.5">
                {currentUser.fundo}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 2. BOTÓN 1: + NUEVO REQUERIMIENTO */}
      <button
        id="btn-mobile-nuevo-requerimiento"
        onClick={onNewRequirement}
        className="w-full bg-[#00843D] hover:bg-[#006e33] active:bg-[#005728] text-white p-5 rounded-3xl shadow-md hover:shadow-lg transition-all text-left flex items-center justify-between group active:scale-[0.99]"
      >
        <div className="flex items-center gap-4">
          <div className="w-13 h-13 rounded-2xl bg-white/20 flex items-center justify-center shrink-0 text-white shadow-inner">
            <PlusCircle className="w-8 h-8" />
          </div>
          <div>
            <div className="text-base sm:text-lg font-black uppercase tracking-tight text-white leading-tight">
              + NUEVO REQUERIMIENTO
            </div>
            <div className="text-xs text-emerald-100 font-medium mt-0.5">
              Solicitar transporte para personal agrícola
            </div>
          </div>
        </div>
        <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white shrink-0 group-hover:translate-x-1 transition-transform">
          <ArrowRight className="w-5 h-5" />
        </div>
      </button>

      {/* 3. BOTÓN 2: MIS REQUERIMIENTOS */}
      <button
        id="btn-mobile-mis-requerimientos"
        onClick={onMyRequirements}
        className="w-full bg-white hover:bg-gray-50/90 active:bg-gray-100 p-4.5 rounded-3xl border border-gray-200/90 shadow-xs transition-all text-left flex items-center justify-between group"
      >
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-[#173B56] text-white flex items-center justify-center shrink-0 shadow-xs">
            <ClipboardList className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black uppercase text-[#173B56]">
                MIS REQUERIMIENTOS
              </span>
              <span className="px-2.5 py-0.5 text-[10px] font-black bg-[#E8F5EF] text-[#00843D] rounded-full">
                {totalReqs}
              </span>
            </div>
            <div className="text-xs text-gray-500 font-medium mt-0.5">
              Consulta el estado de tus solicitudes
            </div>
          </div>
        </div>
        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 group-hover:translate-x-1 group-hover:text-[#00843D] transition-all">
          <ChevronRight className="w-4 h-4" />
        </div>
      </button>

      {/* 4. RESUMEN DEL USUARIO: PENDIENTES, APROBADOS, ATENDIDOS */}
      <div className="space-y-2">
        <div className="px-1 text-[11px] font-black text-gray-400 uppercase tracking-wider">
          Resumen de mis Solicitudes
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {/* Pendientes */}
          <div className="bg-white p-3 rounded-2xl border border-amber-200/80 shadow-2xs text-center">
            <div className="flex items-center justify-center gap-1 text-[11px] text-amber-800 font-bold mb-1">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span>Pendientes</span>
            </div>
            <div className="text-xl font-black text-amber-600 leading-none">{pendingReqs}</div>
            <div className="text-[9px] text-gray-400 mt-1">En revisión</div>
          </div>

          {/* Aprobados */}
          <div className="bg-white p-3 rounded-2xl border border-emerald-200/80 shadow-2xs text-center">
            <div className="flex items-center justify-center gap-1 text-[11px] text-emerald-800 font-bold mb-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#00843D]" />
              <span>Aprobados</span>
            </div>
            <div className="text-xl font-black text-[#00843D] leading-none">{approvedReqs}</div>
            <div className="text-[9px] text-gray-400 mt-1">Programados</div>
          </div>

          {/* Atendidos */}
          <div className="bg-white p-3 rounded-2xl border border-blue-200/80 shadow-2xs text-center">
            <div className="flex items-center justify-center gap-1 text-[11px] text-blue-800 font-bold mb-1">
              <CheckCheck className="w-3.5 h-3.5 text-blue-600" />
              <span>Atendidos</span>
            </div>
            <div className="text-xl font-black text-blue-600 leading-none">{attendedReqs}</div>
            <div className="text-[9px] text-gray-400 mt-1">Completados</div>
          </div>
        </div>
      </div>

      {/* 5. ÚLTIMO REQUERIMIENTO REGISTRADO (Tarjetón vertical de fácil lectura) */}
      {latestReq ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-black text-gray-400 uppercase tracking-wider">
              Última Solicitud Registrada
            </span>
            <button
              onClick={onMyRequirements}
              className="text-[11px] font-bold text-[#00843D] hover:underline"
            >
              Ver todas ({totalReqs})
            </button>
          </div>

          <div
            id="card-latest-mobile-req"
            onClick={() => onSelectRequirement(latestReq)}
            className="bg-white rounded-3xl p-4 border border-gray-200/90 shadow-xs hover:border-[#00843D] transition-all cursor-pointer space-y-3 active:scale-[0.99]"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono font-black text-xs text-[#00843D] bg-[#E8F5EF] px-2.5 py-1 rounded-lg">
                  {latestReq.numeroRequerimiento}
                </span>
                <span className="text-xs text-gray-500 font-medium flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-gray-400" />
                  {formatDisplayDate(latestReq.fecha)}
                </span>
              </div>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black border ${
                  getStatusStyle(latestReq.estado).badge
                }`}
              >
                {getStatusStyle(latestReq.estado).icon}
                <span>{latestReq.estado}</span>
              </span>
            </div>

            <div className="bg-gray-50 p-3 rounded-2xl border border-gray-100 space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-gray-400 font-bold text-[10px] uppercase">Área:</span>
                <span className="font-black text-[#173B56]">{latestReq.area}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400 font-bold text-[10px] uppercase">Fundo:</span>
                <span className="font-black text-[#173B56]">{latestReq.fundo}</span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-gray-200/50">
                <span className="text-gray-400 font-bold text-[10px] uppercase">Movimiento:</span>
                <span className="font-black text-[#00843D]">
                  {latestReq.movimiento === 'INGRESO' ? '↓ INGRESO' : '↑ SALIDA'} ({latestReq.horaRecojo})
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <div className="flex items-center gap-1.5 font-black text-[#173B56]">
                <Users className="w-4 h-4 text-[#00843D]" />
                <span>{latestReq.totalPersonas} personas solicitadas</span>
              </div>
              <span className="text-[#00843D] font-bold flex items-center gap-0.5 text-xs">
                <span>Ver detalle</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-6 border border-gray-200/80 text-center space-y-2">
          <div className="w-10 h-10 rounded-full bg-emerald-50 text-[#00843D] flex items-center justify-center mx-auto">
            <Bus className="w-5 h-5" />
          </div>
          <div className="text-xs font-black text-[#173B56] uppercase">
            Aún no tienes requerimientos registrados
          </div>
          <p className="text-[11px] text-gray-500">
            Toca el botón "+ Nuevo Requerimiento" para registrar tu primer pedido de transporte.
          </p>
        </div>
      )}

      {/* 6. Nota de Coordinación */}
      <div className="bg-[#E8F5EF]/70 rounded-2xl p-3.5 border border-[#00843D]/15 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-[#00843D] shrink-0 mt-0.5" />
        <div className="text-[11px] text-[#173B56] leading-relaxed">
          <span className="font-bold text-[#00843D]">Coordinación de Transporte: </span>
          El horario regular de recepción de solicitudes finaliza a las 18:00 hrs para programación de turnos.
        </div>
      </div>
    </div>
  );
};

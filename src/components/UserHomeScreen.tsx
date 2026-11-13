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
  History,
} from 'lucide-react';
import { Requerimiento, EstadoRequerimiento, AppUser } from '../types';
import { getHorarioDisplay } from '../data/masterData';
import { getPublicAssetUrl } from './CamposolLogo';

interface UserHomeScreenProps {
  onNewRequirement: () => void;
  onMyRequirements: () => void;
  requerimientos: Requerimiento[];
  onSelectRequirement: (req: Requerimiento) => void;
  onOpenRoleSwitcher?: () => void;
  currentUser?: AppUser;
}

export const UserHomeScreen: React.FC<UserHomeScreenProps> = React.memo(({
  onNewRequirement,
  onMyRequirements,
  requerimientos,
  onSelectRequirement,
  currentUser,
}) => {
  // Count user metrics in a single pass with memoization
  const { totalReqs, pendingReqs, approvedReqs, attendedReqs, latestReq, historyReqs } = React.useMemo(() => {
    let p = 0;
    let a = 0;
    let at = 0;
    let hist = 0;
    for (const r of requerimientos) {
      if (r.estado === 'ANULADO') hist++;
      else if (r.estado === 'PENDIENTE' || r.estado === 'EN REVISIÓN') p++;
      else if (r.estado === 'APROBADO') a++;
      else if (r.estado === 'ATENDIDO') at++;
    }
    const activeReqs = requerimientos.filter((r) => r.estado !== 'ANULADO');
    return {
      totalReqs: requerimientos.length,
      pendingReqs: p,
      approvedReqs: a,
      attendedReqs: at,
      historyReqs: hist,
      latestReq: activeReqs.length > 0 ? activeReqs[0] : null,
    };
  }, [requerimientos]);

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
      <div className="bg-white rounded-2xl p-5 border border-[#E5ECF2] shadow-xs relative overflow-hidden">
        {/* Subtle background decoration */}
        <div className="absolute -right-6 -bottom-6 opacity-5 pointer-events-none">
          <Bus className="w-36 h-36 text-[#55A529]" />
        </div>

        <div className="flex items-center gap-3 mb-1.5">
          <div className="w-12 h-12 rounded-full overflow-hidden shadow-xs shrink-0 border border-[#B89F67]/70 bg-[#55A529] flex items-center justify-center p-0.5">
            <img
              src={getPublicAssetUrl('camposol-emblem.png')}
              onError={(e) => {
                const target = e.currentTarget;
                if (!target.src.includes('.svg')) {
                  target.src = getPublicAssetUrl('camposol-emblem.svg');
                }
              }}
              alt="CAMPOSOL"
              referrerPolicy="no-referrer"
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#55A529] block">
              CAMPOSOL
            </span>
            <h1 className="text-base font-bold text-[#1B3A57] leading-tight">
              Transporte de Personal
            </h1>
          </div>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed mt-2">
          Registra y consulta tus requerimientos para el ingreso o salida de personal de tu área.
        </p>

        {/* User identification badge from active session */}
        {currentUser && (
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-[#EAF7E4] text-[#2F7D18] flex items-center justify-center font-bold text-xs">
                <UserCheck className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 block uppercase leading-none">
                  Solicitante Conectado
                </span>
                <span className="text-xs font-bold text-[#1B3A57] leading-tight block">
                  {currentUser.nombre}
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold text-[#2F7D18] bg-[#EAF7E4] border border-[#C6E9B4] px-2.5 py-0.5 rounded-full inline-block">
                {currentUser.area}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
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
        className="w-full bg-[#22A846] hover:bg-[#1C8E3A] active:bg-[#177830] text-white p-5 rounded-2xl shadow-sm hover:shadow-md transition-all text-left flex items-center justify-between group active:scale-[0.99]"
      >
        <div className="flex items-center gap-4">
          <div className="w-13 h-13 rounded-2xl bg-white/20 flex items-center justify-center shrink-0 text-white shadow-inner">
            <PlusCircle className="w-8 h-8" />
          </div>
          <div>
            <div className="text-base sm:text-lg font-bold uppercase tracking-tight text-white leading-tight">
              + NUEVO REQUERIMIENTO
            </div>
            <div className="text-xs text-[#EAF7E4] font-medium mt-0.5">
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
        className="w-full bg-white hover:bg-[#F7FBFE] p-4.5 rounded-2xl border border-[#E5ECF2] shadow-xs transition-all text-left flex items-center justify-between group"
      >
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-[#1B3A57] text-white flex items-center justify-center shrink-0 shadow-xs">
            <ClipboardList className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold uppercase text-[#1B3A57]">
                MIS REQUERIMIENTOS
              </span>
              <span className="px-2.5 py-0.5 text-[10px] font-bold bg-[#EAF7E4] text-[#2F7D18] rounded-full border border-[#C6E9B4]">
                {totalReqs}
              </span>
            </div>
            <div className="text-xs text-slate-500 font-medium mt-0.5">
              Consulta el estado de tus solicitudes
            </div>
          </div>
        </div>
        <div className="w-8 h-8 rounded-full bg-[#F1F5F9] flex items-center justify-center text-slate-500 group-hover:translate-x-1 group-hover:text-[#55A529] transition-all">
          <ChevronRight className="w-4 h-4" />
        </div>
      </button>

      {/* 4. RESUMEN DEL USUARIO: PENDIENTES, APROBADOS, ATENDIDOS */}
      <div className="space-y-2">
        <div className="px-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          Resumen de mis Solicitudes
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {/* Pendientes */}
          <div className="bg-white p-3 rounded-2xl border border-[#E5ECF2] border-l-4 border-l-amber-400 shadow-2xs text-center">
            <div className="flex items-center justify-center gap-1 text-[11px] text-[#B45309] font-bold mb-1">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span>Pendientes</span>
            </div>
            <div className="text-xl font-bold text-[#B45309] leading-none">{pendingReqs}</div>
            <div className="text-[9px] text-slate-400 mt-1">En revisión</div>
          </div>

          {/* Aprobados */}
          <div className="bg-white p-3 rounded-2xl border border-[#E5ECF2] border-l-4 border-l-[#55A529] shadow-2xs text-center">
            <div className="flex items-center justify-center gap-1 text-[11px] text-[#2F7D18] font-bold mb-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#55A529]" />
              <span>Aprobados</span>
            </div>
            <div className="text-xl font-bold text-[#2F7D18] leading-none">{approvedReqs}</div>
            <div className="text-[9px] text-slate-400 mt-1">Programados</div>
          </div>

          {/* Atendidos */}
          <div className="bg-white p-3 rounded-2xl border border-[#E5ECF2] border-l-4 border-l-[#0082B3] shadow-2xs text-center">
            <div className="flex items-center justify-center gap-1 text-[11px] text-[#0082B3] font-bold mb-1">
              <CheckCheck className="w-3.5 h-3.5 text-[#0082B3]" />
              <span>Atendidos</span>
            </div>
            <div className="text-xl font-bold text-[#0082B3] leading-none">{attendedReqs}</div>
            <div className="text-[9px] text-slate-400 mt-1">Completados</div>
          </div>
        </div>

        {/* Notificación de requerimientos en historial */}
        {historyReqs > 0 && (
          <button
            type="button"
            onClick={onMyRequirements}
            className="w-full mt-2 p-2.5 rounded-2xl bg-[#FDECEC] border border-[#FECACA] hover:bg-red-100/70 text-[#DC2626] flex items-center justify-between text-xs transition-colors shadow-2xs"
          >
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-[#DC2626] shrink-0" />
              <span className="font-bold">
                {historyReqs} {historyReqs === 1 ? 'solicitud guardada' : 'solicitudes guardadas'} en historial
              </span>
            </div>
            <span className="text-[11px] text-[#DC2626] font-bold flex items-center gap-0.5">
              <span>Ver Historial</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </button>
        )}
      </div>

      {/* 5. ÚLTIMO REQUERIMIENTO REGISTRADO (Tarjetón vertical de fácil lectura) */}
      {latestReq ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Última Solicitud Registrada
            </span>
            <button
              onClick={onMyRequirements}
              className="text-[11px] font-semibold text-[#2F7D18] hover:underline"
            >
              Ver todas ({totalReqs})
            </button>
          </div>

          <div
            id="card-latest-mobile-req"
            onClick={() => onSelectRequirement(latestReq)}
            className="bg-white rounded-2xl p-4 border border-[#E5ECF2] shadow-xs hover:border-[#55A529] transition-all cursor-pointer space-y-3 active:scale-[0.99]"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-xs text-[#2F7D18] bg-[#EAF7E4] border border-[#C6E9B4] px-2.5 py-0.5 rounded-full">
                  {latestReq.numeroRequerimiento}
                </span>
                <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  {formatDisplayDate(latestReq.fecha)}
                </span>
              </div>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                  getStatusStyle(latestReq.estado).badge
                }`}
              >
                {getStatusStyle(latestReq.estado).icon}
                <span>{latestReq.estado}</span>
              </span>
            </div>

            <div className="bg-[#F8FAFC] p-3 rounded-xl border border-[#E5ECF2] space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-bold text-[10px] uppercase">Área:</span>
                <span className="font-bold text-[#1B3A57]">{latestReq.area}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-bold text-[10px] uppercase">Fundo:</span>
                <span className="font-bold text-[#1B3A57]">{latestReq.fundo}</span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-slate-200/50">
                <span className="text-slate-400 font-bold text-[10px] uppercase">Movimiento:</span>
                <span className="font-bold text-[#2F7D18]">
                  {latestReq.movimiento === 'INGRESO'
                    ? `↓ INGRESO (${getHorarioDisplay(latestReq).textoHorario})`
                    : latestReq.movimiento === 'SALIDA'
                    ? `↑ SALIDA (${getHorarioDisplay(latestReq).textoHorario})`
                    : `${latestReq.movimiento} (${getHorarioDisplay(latestReq).textoHorario})`}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <div className="flex items-center gap-1.5 font-bold text-[#1B3A57]">
                <Users className="w-4 h-4 text-[#55A529]" />
                <span>{latestReq.totalPersonas} personas solicitadas</span>
              </div>
              <span className="text-[#2F7D18] font-semibold flex items-center gap-0.5 text-xs">
                <span>Ver detalle</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-6 border border-[#E5ECF2] text-center space-y-2">
          <div className="w-10 h-10 rounded-full bg-[#EAF7E4] text-[#2F7D18] flex items-center justify-center mx-auto">
            <Bus className="w-5 h-5" />
          </div>
          <div className="text-xs font-bold text-[#1B3A57] uppercase">
            Aún no tienes requerimientos registrados
          </div>
          <p className="text-[11px] text-slate-500">
            Toca el botón "+ Nuevo Requerimiento" para registrar tu primer pedido de transporte.
          </p>
        </div>
      )}

      {/* 6. Nota de Coordinación */}
      <div className="bg-[#EAF7E4] rounded-2xl p-3.5 border border-[#C6E9B4] flex items-start gap-2.5">
        <Info className="w-4 h-4 text-[#2F7D18] shrink-0 mt-0.5" />
        <div className="text-[11px] text-[#1B3A57] leading-relaxed">
          <span className="font-bold text-[#2F7D18]">Coordinación de Transporte: </span>
          El horario regular de recepción de solicitudes para la salida del mismo día es hasta las <strong className="font-bold text-[#1B3A57]">09:00 AM</strong> y para el día siguiente es hasta las <strong className="font-bold text-[#1B3A57]">14:00 PM</strong>.
        </div>
      </div>
    </div>
  );
});

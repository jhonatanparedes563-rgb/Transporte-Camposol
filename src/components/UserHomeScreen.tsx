import React, { useState } from 'react';
import {
  Bus,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  Calendar,
  CalendarCheck,
  Users,
  Check,
  CheckCircle2,
  Clock3,
  XCircle,
  CheckCheck,
  ChevronRight,
  User,
  MapPin,
} from 'lucide-react';
import { Requerimiento, EstadoRequerimiento, AppUser } from '../types';
import { getHorarioDisplay } from '../data/masterData';
import busBannerImg from '../assets/images/camposol_bus_banner_1794664881122.jpg';

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
  const [bannerImgFailed, setBannerImgFailed] = useState(false);

  const { pendingReqs, approvedReqs, attendedReqs, latestReq } = React.useMemo(() => {
    let p = 0;
    let a = 0;
    let at = 0;
    for (const r of requerimientos) {
      if (r.estado === 'ANULADO') continue;
      if (r.estado === 'PENDIENTE' || r.estado === 'EN REVISIÓN') p++;
      else if (r.estado === 'APROBADO') a++;
      else if (r.estado === 'ATENDIDO') at++;
    }
    const activeReqs = requerimientos.filter((r) => r.estado !== 'ANULADO');
    return {
      pendingReqs: p,
      approvedReqs: a,
      attendedReqs: at,
      latestReq: activeReqs.length > 0 ? activeReqs[0] : null,
    };
  }, [requerimientos]);

  const getStatusStyle = (estado: EstadoRequerimiento) => {
    switch (estado) {
      case 'APROBADO':
        return {
          bar: 'bg-[#E8F8E2] border-[#BCE8AA] text-[#14532D]',
          iconWrap: 'bg-[#16A34A] text-white',
          icon: <CheckCircle2 className="w-3.5 h-3.5" />,
          label: 'Aprobado',
        };
      case 'ATENDIDO':
        return {
          bar: 'bg-[#E6F3FB] border-[#C5E3F6] text-[#0C4A6E]',
          iconWrap: 'bg-[#0284C7] text-white',
          icon: <CheckCheck className="w-3.5 h-3.5" />,
          label: 'Atendido',
        };
      case 'EN REVISIÓN':
        return {
          bar: 'bg-purple-50 border-purple-200 text-purple-900',
          iconWrap: 'bg-purple-600 text-white',
          icon: <Clock3 className="w-3.5 h-3.5" />,
          label: 'En revisión',
        };
      case 'RECHAZADO':
        return {
          bar: 'bg-[#FDECEC] border-[#FECACA] text-[#991B1B]',
          iconWrap: 'bg-[#DC2626] text-white',
          icon: <XCircle className="w-3.5 h-3.5" />,
          label: 'Rechazado',
        };
      case 'PENDIENTE':
      default:
        return {
          bar: 'bg-[#E9F7E1] border-[#C6E9B4] text-[#166534]',
          iconWrap: 'bg-[#16A34A] text-white',
          icon: <Check className="w-3.5 h-3.5 stroke-[2.75]" />,
          label: 'Pendiente',
        };
    }
  };

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  return (
    <div className="flex flex-col w-full p-3.5 space-y-3 pb-24">
      {/* 1. Solicitante Conectado */}
      <div className="bg-white rounded-2xl px-3.5 py-3 border border-[#E5ECF2] shadow-2xs flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-10 h-10 rounded-full bg-[#EAF7E4] text-[#15803D] flex items-center justify-center shrink-0">
            <User className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[11px] font-medium text-slate-500 block leading-tight">
              Solicitante conectado
            </span>
            <span className="text-[13px] font-bold text-[#1B3A57] leading-snug block truncate">
              {currentUser?.nombre || 'Solicitante'}
            </span>
          </div>
        </div>

        {currentUser?.area && (
          <span className="shrink-0 max-w-[140px] truncate px-2.5 py-1 rounded-full border border-[#22A846]/50 bg-[#F4FBF2] text-[11px] font-semibold text-[#15803D]">
            {currentUser.area}
          </span>
        )}
      </div>

      {/* 2. Banner Principal: + Nuevo Requerimiento */}
      <button
        id="btn-mobile-nuevo-requerimiento"
        type="button"
        onClick={onNewRequirement}
        className="relative w-full min-h-[108px] rounded-2xl overflow-hidden shadow-sm bg-gradient-to-r from-[#0F7A33] via-[#1CA13D] to-[#49B82C] text-left group cursor-pointer active:scale-[0.99] transition-transform flex items-center justify-between px-4 py-3.5"
      >
        {!bannerImgFailed && (
          <img
            src={busBannerImg}
            alt="Bus de transporte de personal CAMPOSOL"
            referrerPolicy="no-referrer"
            onError={() => setBannerImgFailed(true)}
            className="absolute inset-0 w-full h-full object-cover object-right pointer-events-none select-none"
          />
        )}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-r from-[#0D6E2D] via-[#138735]/90 to-[#16A34A]/15 pointer-events-none"
        />

        <div className="relative z-10 flex items-center gap-3 min-w-0 max-w-[76%]">
          <div className="relative w-11 h-11 rounded-full bg-[#22C55E] border-2 border-white/80 flex items-center justify-center shrink-0 shadow-xs">
            <Bus className="w-5 h-5 text-white" />
            <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-white text-[#15803D] flex items-center justify-center shadow-2xs">
              <Check className="w-2.5 h-2.5 stroke-[3]" />
            </span>
          </div>

          <div className="min-w-0">
            <div className="text-[15px] font-extrabold text-white leading-tight tracking-tight drop-shadow-xs">
              + Nuevo Requerimiento
            </div>
            <p className="text-[11px] font-medium text-white/95 leading-snug mt-0.5 drop-shadow-xs">
              Solicita transporte para personal agrícola
            </p>
          </div>
        </div>

        <span className="relative z-10 w-8 h-8 rounded-full bg-white text-[#15803D] shadow-md flex items-center justify-center shrink-0 group-hover:translate-x-0.5 transition-transform">
          <ChevronRight className="w-4 h-4 stroke-[2.5]" />
        </span>
      </button>

      {/* 3. Tarjetas KPI de Estados */}
      <div className="grid grid-cols-3 gap-2.5">
        <button
          id="btn-mobile-mis-requerimientos"
          type="button"
          onClick={onMyRequirements}
          className="bg-[#FFF8EC] border border-[#FDE2B8] rounded-2xl py-3 px-2 flex flex-col items-center text-center shadow-2xs hover:brightness-[0.98] active:scale-[0.98] transition-all cursor-pointer min-h-[44px]"
        >
          <span className="w-8 h-8 rounded-full bg-[#F59E0B] text-white flex items-center justify-center mb-1.5 shadow-2xs">
            <Clock className="w-4 h-4" />
          </span>
          <span className="text-2xl font-extrabold text-[#C2410C] leading-none tabular-nums">
            {pendingReqs}
          </span>
          <span className="text-xs font-bold text-[#9A3412] mt-1">
            Pendientes
          </span>
          <span className="mt-1.5 px-2 py-0.5 rounded-full bg-[#FFEDD5] border border-[#FED7AA] text-[10px] font-semibold text-[#B45309]">
            En revisión
          </span>
        </button>

        <button
          type="button"
          onClick={onMyRequirements}
          className="bg-[#EFFCF2] border border-[#C1F0CD] rounded-2xl py-3 px-2 flex flex-col items-center text-center shadow-2xs hover:brightness-[0.98] active:scale-[0.98] transition-all cursor-pointer min-h-[44px]"
        >
          <span className="w-8 h-8 rounded-full bg-[#16A34A] text-white flex items-center justify-center mb-1.5 shadow-2xs">
            <CheckCircle2 className="w-4 h-4" />
          </span>
          <span className="text-2xl font-extrabold text-[#15803D] leading-none tabular-nums">
            {approvedReqs}
          </span>
          <span className="text-xs font-bold text-[#166534] mt-1">
            Aprobados
          </span>
          <span className="mt-1.5 px-2 py-0.5 rounded-full bg-[#DCFCE7] border border-[#BBF7D0] text-[10px] font-semibold text-[#15803D]">
            Programados
          </span>
        </button>

        <button
          type="button"
          onClick={onMyRequirements}
          className="bg-[#EFF6FF] border border-[#C7E0FC] rounded-2xl py-3 px-2 flex flex-col items-center text-center shadow-2xs hover:brightness-[0.98] active:scale-[0.98] transition-all cursor-pointer min-h-[44px]"
        >
          <span className="w-8 h-8 rounded-full bg-[#0284C7] text-white flex items-center justify-center mb-1.5 shadow-2xs">
            <CheckCheck className="w-4 h-4" />
          </span>
          <span className="text-2xl font-extrabold text-[#0369A1] leading-none tabular-nums">
            {attendedReqs}
          </span>
          <span className="text-xs font-bold text-[#1E3A8A] mt-1">
            Atendidos
          </span>
          <span className="mt-1.5 px-2 py-0.5 rounded-full bg-[#E0F2FE] border border-[#BAE6FD] text-[10px] font-semibold text-[#0369A1]">
            Completados
          </span>
        </button>
      </div>

      {/* 4. Última Solicitud Registrada */}
      {latestReq ? (
        <div
          id="card-latest-mobile-req"
          role="button"
          tabIndex={0}
          onClick={() => onSelectRequirement(latestReq)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSelectRequirement(latestReq);
            }
          }}
          className="bg-white rounded-2xl p-3.5 border border-[#E5ECF2] shadow-xs hover:border-[#22A846] transition-all cursor-pointer active:scale-[0.99]"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <CalendarCheck className="w-4 h-4 text-[#15803D] shrink-0" />
              <span className="text-[13px] font-bold text-[#1B3A57] truncate">
                Tu última solicitud
              </span>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-[#EAF7E4] text-[#2F7D18] font-mono text-[11px] font-bold shrink-0">
              {latestReq.numeroRequerimiento}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-12 gap-2.5 items-center">
            <div className="col-span-5 pr-2 border-r border-slate-200/80 space-y-2">
              <div className="flex items-center gap-1.5 text-xs text-[#1B3A57]">
                <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="font-semibold tabular-nums truncate">
                  {formatDisplayDate(latestReq.fecha)}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-[#1B3A57]">
                <Users className="w-3.5 h-3.5 text-[#15803D] shrink-0" />
                <span className="font-bold tabular-nums truncate">
                  {latestReq.totalPersonas} personas
                </span>
              </div>
            </div>

            <div className="col-span-7 bg-[#F4F8FB] rounded-xl px-2.5 py-2 space-y-1 text-[11px]">
              <div className="flex items-center gap-1.5 text-[#1B3A57]">
                <MapPin className="w-3.5 h-3.5 text-[#1B3A57] shrink-0" />
                <span className="font-semibold truncate">{latestReq.area}</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-600">
                <Bus className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span className="truncate">{latestReq.fundo}</span>
              </div>
              <div className="flex items-center gap-1.5 text-[#15803D] font-bold">
                {latestReq.movimiento === 'SALIDA' ? (
                  <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <ArrowDownLeft className="w-3.5 h-3.5 shrink-0" />
                )}
                <span className="truncate">
                  {latestReq.movimiento}: {getHorarioDisplay(latestReq).textoHorario}
                </span>
              </div>
            </div>
          </div>

          {(() => {
            const st = getStatusStyle(latestReq.estado);
            return (
              <div
                className={`mt-3 px-3 py-2 rounded-xl border flex items-center justify-between text-xs font-bold ${st.bar}`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${st.iconWrap}`}
                  >
                    {st.icon}
                  </span>
                  <span>{st.label}</span>
                </div>
                <span className="inline-flex items-center gap-0.5 font-semibold">
                  <span>Ver detalle</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
            );
          })()}
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-5 border border-[#E5ECF2] text-center space-y-2">
          <div className="w-10 h-10 rounded-full bg-[#EAF7E4] text-[#2F7D18] flex items-center justify-center mx-auto">
            <Bus className="w-5 h-5" />
          </div>
          <div className="text-xs font-bold text-[#1B3A57]">
            Sin solicitudes registradas
          </div>
          <p className="text-[11px] text-slate-500">
            Toca &quot;+ Nuevo Requerimiento&quot; para solicitar transporte.
          </p>
        </div>
      )}

      {/* 5. Comentario obligatorio de Horario de Corte */}
      <div className="bg-[#F4FBF2] border border-[#CBEBC2] rounded-2xl px-3.5 py-2.5 flex items-start gap-2.5 text-[11px] text-[#1B3A57] leading-snug">
        <Clock className="w-4 h-4 text-[#15803D] shrink-0 mt-0.5" />
        <p>
          <strong className="font-bold text-[#14532D]">Horario de corte:</strong>{' '}
          recepción para salida del mismo día hasta las{' '}
          <strong className="font-bold">09:00 AM</strong> y para el día siguiente hasta las{' '}
          <strong className="font-bold">02:00 PM (14:00)</strong>.
        </p>
      </div>
    </div>
  );
});

import React, { useState } from 'react';
import {
  Bus,
  Clock,
  Calendar,
  FileText,
  Check,
  CheckCircle2,
  Clock3,
  XCircle,
  CheckCheck,
  ChevronRight,
  User,
  MapPin,
  Sprout,
} from 'lucide-react';
import { Requerimiento, EstadoRequerimiento, AppUser } from '../types';
import { getHorarioDisplay } from '../data/masterData';
import busBannerImg from '../assets/images/camposol_bus_banner_light_1794665350151.jpg';

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
          bar: 'bg-[#E9F7DF] border-[#C6E9B4] text-[#166534]',
          iconWrap: 'bg-[#15803D] text-white',
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
    <div className="flex flex-col w-full px-3.5 py-2.5 space-y-2 pb-3">
      {/* 1. Solicitante Conectado */}
      <div className="bg-white rounded-2xl px-3 py-2 border border-[#E2E8F0] shadow-2xs flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="w-9 h-9 rounded-full bg-[#EAF7E4] text-[#15803D] flex items-center justify-center shrink-0">
            <User className="w-4.5 h-4.5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-medium text-slate-500 block leading-tight">
              Solicitante conectado
            </span>
            <span className="text-[12px] font-bold text-[#1B3A57] leading-tight block truncate">
              {currentUser?.nombre || 'Solicitante'}
            </span>
          </div>
        </div>

        {currentUser?.area && (
          <span className="shrink-0 max-w-[140px] inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-[#BFE6B3] bg-[#EAF7E4] text-[10.5px] font-semibold text-[#15803D]">
            <Sprout className="w-3 h-3 shrink-0" />
            <span className="truncate">{currentUser.area}</span>
          </span>
        )}
      </div>

      {/* 2. Banner Principal: Nuevo Requerimiento */}
      <button
        id="btn-mobile-nuevo-requerimiento"
        type="button"
        onClick={onNewRequirement}
        className="relative w-full min-h-[118px] rounded-2xl overflow-hidden bg-white border border-[#DCE8DF] shadow-sm text-left group cursor-pointer active:scale-[0.99] transition-transform flex items-center"
      >
        {!bannerImgFailed && (
          <img
            src={busBannerImg}
            alt="Bus de transporte de personal CAMPOSOL"
            referrerPolicy="no-referrer"
            onError={() => setBannerImgFailed(true)}
            className="absolute inset-0 w-full h-full object-cover object-[76%_center] pointer-events-none select-none"
          />
        )}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(90deg,#FFFFFF_0%,#F6FCF5_42%,rgba(255,255,255,0.88)_53%,rgba(255,255,255,0)_72%)] pointer-events-none"
        />

        {/* Detalle decorativo sutil inferior izquierdo */}
        <svg
          aria-hidden="true"
          viewBox="0 0 120 28"
          className="absolute bottom-0 left-0 w-24 h-6 pointer-events-none"
        >
          <path d="M0,4 Q48,22 105,28 L0,28 Z" fill="#3AB526" opacity="0.92" />
          <path d="M0,14 Q36,24 78,28 L0,28 Z" fill="#15803D" opacity="0.88" />
        </svg>

        <div className="relative z-10 px-3.5 py-2.5 flex flex-col justify-center max-w-[58%]">
          <div className="relative inline-block w-fit">
            <span className="block text-[22px] font-extrabold text-[#15803D] leading-none tracking-tight">
              Nuevo
            </span>
            <svg
              aria-hidden="true"
              viewBox="0 0 28 24"
              className="w-6 h-5 absolute -top-1 -right-7 text-[#65C428]"
            >
              <line x1="4" y1="9" x2="10" y2="2" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
              <line x1="10" y1="14" x2="21" y2="7" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
              <line x1="13" y1="20" x2="23" y2="17" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
            </svg>
          </div>
          <span className="block text-[19px] font-extrabold text-[#1B3A57] leading-[1.08] tracking-tight">
            Requerimiento
          </span>
          <p className="text-[11px] font-medium text-slate-700 leading-snug mt-1">
            Solicita transporte para personal agrícola
          </p>
          <span className="w-14 h-1 rounded-full bg-[#3AB526] mt-2 block" />
        </div>
      </button>

      {/* 3. Tarjetas KPI de Estados */}
      <div className="grid grid-cols-3 gap-2">
        <button
          id="btn-mobile-mis-requerimientos"
          type="button"
          onClick={onMyRequirements}
          className="bg-[#FFF8EC] border border-[#FDE2B8] rounded-2xl py-2.5 px-1.5 flex flex-col items-center text-center shadow-2xs hover:brightness-[0.98] active:scale-[0.98] transition-all cursor-pointer min-h-[44px]"
        >
          <span className="w-7 h-7 rounded-full border-2 border-[#F59E0B] bg-white text-[#F59E0B] flex items-center justify-center mb-1">
            <Clock className="w-4 h-4 stroke-[2.4]" />
          </span>
          <span className="text-2xl font-extrabold text-[#9A3412] leading-none tabular-nums">
            {pendingReqs}
          </span>
          <span className="text-[11.5px] font-bold text-[#9A3412] mt-0.5">
            Pendientes
          </span>
          <span className="mt-1 px-2.5 py-0.5 rounded-full bg-[#FDE2AC] text-[10px] font-semibold text-[#92400E]">
            En revisión
          </span>
        </button>

        <button
          type="button"
          onClick={onMyRequirements}
          className="bg-[#EFFCF2] border border-[#C1F0CD] rounded-2xl py-2.5 px-1.5 flex flex-col items-center text-center shadow-2xs hover:brightness-[0.98] active:scale-[0.98] transition-all cursor-pointer min-h-[44px]"
        >
          <span className="w-7 h-7 rounded-full bg-[#16A34A] text-white flex items-center justify-center mb-1">
            <CheckCircle2 className="w-4 h-4" />
          </span>
          <span className="text-2xl font-extrabold text-[#15803D] leading-none tabular-nums">
            {approvedReqs}
          </span>
          <span className="text-[11.5px] font-bold text-[#166534] mt-0.5">
            Aprobados
          </span>
          <span className="mt-1 px-2.5 py-0.5 rounded-full bg-[#C7F3D0] text-[10px] font-semibold text-[#166534]">
            Programados
          </span>
        </button>

        <button
          type="button"
          onClick={onMyRequirements}
          className="bg-[#EFF6FF] border border-[#C7E0FC] rounded-2xl py-2.5 px-1.5 flex flex-col items-center text-center shadow-2xs hover:brightness-[0.98] active:scale-[0.98] transition-all cursor-pointer min-h-[44px]"
        >
          <span className="w-7 h-7 rounded-full bg-[#0284C7] text-white flex items-center justify-center mb-1">
            <CheckCheck className="w-4 h-4" />
          </span>
          <span className="text-2xl font-extrabold text-[#1E3A8A] leading-none tabular-nums">
            {attendedReqs}
          </span>
          <span className="text-[11.5px] font-bold text-[#1E3A8A] mt-0.5">
            Atendidos
          </span>
          <span className="mt-1 px-2.5 py-0.5 rounded-full bg-[#CFE5FE] text-[10px] font-semibold text-[#1D4ED8]">
            Completados
          </span>
        </button>
      </div>

      {/* 4. Tu última solicitud */}
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
          className="bg-white rounded-2xl p-3 border border-[#E2E8F0] shadow-xs hover:border-[#22A846] transition-all cursor-pointer active:scale-[0.99]"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="w-4 h-4 text-[#16A34A] shrink-0" />
              <span className="text-[13px] font-bold text-[#1B3A57] truncate">
                Tu última solicitud
              </span>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-[#E5F7DC] border border-[#C6E9B4] text-[#166534] font-mono text-[10.5px] font-bold shrink-0">
              {latestReq.numeroRequerimiento}
            </span>
          </div>

          <div className="mt-2 bg-[#F7FAFC] border border-[#EDF2F7] rounded-xl px-2.5 py-2 grid grid-cols-2 gap-2 items-center">
            <div className="space-y-1.5 pr-2 border-r border-slate-200 min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <Calendar className="w-3.5 h-3.5 text-[#334155] shrink-0" />
                <div className="min-w-0">
                  <span className="text-[9.5px] text-slate-500 block leading-none">
                    Fecha
                  </span>
                  <span className="text-[11.5px] font-bold text-[#1B3A57] tabular-nums block leading-tight truncate">
                    {formatDisplayDate(latestReq.fecha)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 min-w-0">
                <MapPin className="w-3.5 h-3.5 text-[#334155] shrink-0" />
                <div className="min-w-0">
                  <span className="text-[9.5px] text-slate-500 block leading-none">
                    Fundo
                  </span>
                  <span className="text-[11.5px] font-bold text-[#1B3A57] block leading-tight truncate">
                    {latestReq.fundo}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pl-0.5 min-w-0">
              <Bus className="w-4.5 h-4.5 text-[#1B3A57] shrink-0" />
              <div className="min-w-0">
                <span className="text-[9.5px] text-slate-500 block leading-none">
                  Movimiento
                </span>
                <span className="text-[11.5px] font-bold text-[#1B3A57] block leading-snug">
                  {latestReq.movimiento === 'SALIDA' ? 'Salida' : 'Ingreso'} (Hora:{' '}
                  {getHorarioDisplay(latestReq).textoHorario})
                </span>
              </div>
            </div>
          </div>

          {(() => {
            const st = getStatusStyle(latestReq.estado);
            return (
              <div
                className={`mt-2 px-3 py-1.5 rounded-full border flex items-center justify-between text-xs font-bold ${st.bar}`}
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
        <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0] text-center space-y-1.5">
          <div className="w-9 h-9 rounded-full bg-[#EAF7E4] text-[#2F7D18] flex items-center justify-center mx-auto">
            <Bus className="w-4.5 h-4.5" />
          </div>
          <div className="text-xs font-bold text-[#1B3A57]">
            Sin solicitudes registradas
          </div>
          <p className="text-[11px] text-slate-500">
            Toca &quot;Nuevo Requerimiento&quot; para solicitar transporte.
          </p>
        </div>
      )}

      {/* 5. Horario de corte al pie */}
      <div className="bg-[#F4FBF2] border border-[#CBEBC2] rounded-xl px-3 py-2 flex items-center gap-2 text-[10.5px] text-[#1B3A57] leading-tight">
        <Clock className="w-3.5 h-3.5 text-[#15803D] shrink-0" />
        <p className="min-w-0">
          <strong className="font-bold text-[#14532D]">Horario de corte:</strong>{' '}
          hoy hasta <strong className="font-bold">09:00 AM</strong> · día siguiente hasta{' '}
          <strong className="font-bold">02:00 PM (14:00)</strong>.
        </p>
      </div>
    </div>
  );
});

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
          bar: 'bg-[#E6F7DF] border-[#BCE8AA] text-[#14532D]',
          iconWrap: 'bg-[#16A34A] text-white',
          icon: <CheckCircle2 className="w-4 h-4" />,
          label: 'Aprobado',
        };
      case 'ATENDIDO':
        return {
          bar: 'bg-[#E6F3FB] border-[#C5E3F6] text-[#0C4A6E]',
          iconWrap: 'bg-[#0284C7] text-white',
          icon: <CheckCheck className="w-4 h-4" />,
          label: 'Atendido',
        };
      case 'EN REVISIÓN':
        return {
          bar: 'bg-purple-50 border-purple-200 text-purple-900',
          iconWrap: 'bg-purple-600 text-white',
          icon: <Clock3 className="w-4 h-4" />,
          label: 'En revisión',
        };
      case 'RECHAZADO':
        return {
          bar: 'bg-[#FDECEC] border-[#FECACA] text-[#991B1B]',
          iconWrap: 'bg-[#DC2626] text-white',
          icon: <XCircle className="w-4 h-4" />,
          label: 'Rechazado',
        };
      case 'PENDIENTE':
      default:
        return {
          bar: 'bg-[#E5F6D9] border-[#BBE4A3] text-[#14532D]',
          iconWrap: 'bg-[#15803D] text-white',
          icon: <Check className="w-3.5 h-3.5 stroke-[3]" />,
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

  const firstName = (currentUser?.nombre || 'Solicitante').trim().split(/\s+/)[0];
  const hour = new Date().getHours();
  const saludo = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';

  return (
    <div className="min-h-full w-full flex flex-col px-3.5 py-3 gap-3">
      {/* 1. Saludo y Bienvenida al Solicitante */}
      <div className="bg-white rounded-2xl px-4 py-3.5 border border-[#E2E8F0] shadow-xs shrink-0">
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-12 h-12 rounded-full bg-[#E5F5DF] border border-[#CBEBC2] text-[#15803D] flex items-center justify-center shrink-0">
              <User className="w-6 h-6" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-[17px] font-extrabold text-[#1B3A57] leading-tight tracking-tight truncate">
                ¡{saludo}, {firstName}!
              </h1>
              <p className="text-xs font-medium text-slate-600 leading-snug mt-0.5">
                Bienvenido al portal de transporte de personal
              </p>
            </div>
          </div>

          {currentUser?.area && (
            <span className="shrink-0 max-w-[138px] inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-[#BFE6B3] bg-[#EAF7E4] text-[10.5px] font-semibold text-[#15803D]">
              <Sprout className="w-3 h-3 shrink-0" />
              <span className="truncate">{currentUser.area}</span>
            </span>
          )}
        </div>

        <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 text-[11.5px]">
          <span className="text-slate-500 truncate">
            Solicitante:{' '}
            <strong className="font-bold text-[#1B3A57]">
              {currentUser?.nombre || 'Solicitante'}
            </strong>
          </span>
          {currentUser?.fundo && (
            <span className="text-[11px] font-semibold text-[#15803D] shrink-0">
              {currentUser.fundo}
            </span>
          )}
        </div>
      </div>

      {/* 2. Banner Principal: Nuevo Requerimiento (expansivo y de alto impacto visual) */}
      <button
        id="btn-mobile-nuevo-requerimiento"
        type="button"
        onClick={onNewRequirement}
        className="relative w-full flex-1 min-h-[178px] max-h-[225px] rounded-2xl overflow-hidden bg-white border border-[#DCE8DF] shadow-sm text-left group cursor-pointer active:scale-[0.99] transition-transform flex items-center"
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
          className="absolute inset-0 bg-[linear-gradient(90deg,#FFFFFF_0%,#F6FCF5_42%,rgba(255,255,255,0.88)_51%,rgba(255,255,255,0)_65%)] pointer-events-none"
        />

        {/* Curva decorativa inferior izquierda */}
        <svg
          aria-hidden="true"
          viewBox="0 0 140 34"
          className="absolute bottom-0 left-0 w-32 h-8 pointer-events-none"
        >
          <path d="M0,5 Q56,26 122,34 L0,34 Z" fill="#3AB526" opacity="0.92" />
          <path d="M0,17 Q42,28 88,34 L0,34 Z" fill="#15803D" opacity="0.88" />
        </svg>

        <div className="relative z-10 px-4 py-4 flex flex-col justify-center w-[52%] max-w-[205px]">
          <div className="relative inline-block w-fit">
            <span className="block text-[28px] font-extrabold text-[#15803D] leading-none tracking-tight">
              Nuevo
            </span>
            <svg
              aria-hidden="true"
              viewBox="0 0 28 24"
              className="w-7 h-6 absolute -top-2 -right-8 text-[#65C428]"
            >
              <line x1="4" y1="9" x2="10" y2="2" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
              <line x1="10" y1="14" x2="21" y2="7" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
              <line x1="13" y1="20" x2="23" y2="17" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
            </svg>
          </div>
          <span className="block text-[24px] font-extrabold text-[#1B3A57] leading-[1.06] tracking-tight mt-0.5">
            Requerimiento
          </span>
          <p className="text-[12.5px] font-medium text-slate-700 leading-snug mt-1.5">
            Solicita transporte para personal agrícola
          </p>
          <span className="w-20 h-1.5 rounded-full bg-[#3AB526] mt-3 block" />
        </div>
      </button>

      {/* 3. Tarjetas KPI de Estados */}
      <div className="grid grid-cols-3 gap-2.5 shrink-0">
        <button
          id="btn-mobile-mis-requerimientos"
          type="button"
          onClick={onMyRequirements}
          className="bg-[#FFF8EC] border border-[#FDE2B8] rounded-2xl py-4 px-2 flex flex-col items-center justify-center text-center shadow-xs hover:brightness-[0.98] active:scale-[0.98] transition-all cursor-pointer min-h-[144px]"
        >
          <span className="w-11 h-11 rounded-full border-[2.5px] border-[#F59E0B] bg-white text-[#F59E0B] flex items-center justify-center mb-2">
            <Clock className="w-6 h-6 stroke-[2.2]" />
          </span>
          <span className="text-[32px] font-extrabold text-[#9A3412] leading-none tabular-nums">
            {pendingReqs}
          </span>
          <span className="text-[13px] font-bold text-[#9A3412] mt-1.5">
            Pendientes
          </span>
          <span className="mt-2 px-3 py-1 rounded-full bg-[#FDE2AC] text-[11px] font-semibold text-[#92400E]">
            En revisión
          </span>
        </button>

        <button
          type="button"
          onClick={onMyRequirements}
          className="bg-[#EFFCF2] border border-[#C1F0CD] rounded-2xl py-4 px-2 flex flex-col items-center justify-center text-center shadow-xs hover:brightness-[0.98] active:scale-[0.98] transition-all cursor-pointer min-h-[144px]"
        >
          <span className="w-11 h-11 rounded-full bg-[#16A34A] text-white flex items-center justify-center mb-2">
            <CheckCircle2 className="w-6 h-6" />
          </span>
          <span className="text-[32px] font-extrabold text-[#15803D] leading-none tabular-nums">
            {approvedReqs}
          </span>
          <span className="text-[13px] font-bold text-[#166534] mt-1.5">
            Aprobados
          </span>
          <span className="mt-2 px-3 py-1 rounded-full bg-[#C7F3D0] text-[11px] font-semibold text-[#166534]">
            Programados
          </span>
        </button>

        <button
          type="button"
          onClick={onMyRequirements}
          className="bg-[#EFF6FF] border border-[#C7E0FC] rounded-2xl py-4 px-2 flex flex-col items-center justify-center text-center shadow-xs hover:brightness-[0.98] active:scale-[0.98] transition-all cursor-pointer min-h-[144px]"
        >
          <span className="w-11 h-11 rounded-full bg-[#0284C7] text-white flex items-center justify-center mb-2">
            <CheckCheck className="w-6 h-6" />
          </span>
          <span className="text-[32px] font-extrabold text-[#1E3A8A] leading-none tabular-nums">
            {attendedReqs}
          </span>
          <span className="text-[13px] font-bold text-[#1E3A8A] mt-1.5">
            Atendidos
          </span>
          <span className="mt-2 px-3 py-1 rounded-full bg-[#CFE5FE] text-[11px] font-semibold text-[#1D4ED8]">
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
          className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-xs hover:border-[#22A846] transition-all cursor-pointer active:scale-[0.99] shrink-0"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="w-5 h-5 text-[#16A34A] shrink-0" />
              <span className="text-[15px] font-bold text-[#1B3A57] truncate">
                Tu última solicitud
              </span>
            </div>
            <span className="px-3 py-1 rounded-full bg-[#E5F7DC] border border-[#C6E9B4] text-[#166534] font-mono text-xs font-bold shrink-0">
              {latestReq.numeroRequerimiento}
            </span>
          </div>

          <div className="mt-3 bg-[#F7FAFC] border border-[#EDF2F7] rounded-xl px-3.5 py-3 grid grid-cols-2 gap-3 items-center">
            <div className="space-y-2.5 pr-2.5 border-r-2 border-blue-200/70 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <Calendar className="w-4.5 h-4.5 text-[#334155] shrink-0" />
                <div className="min-w-0">
                  <span className="text-[10.5px] text-slate-500 block leading-none">
                    Fecha
                  </span>
                  <span className="text-[13px] font-bold text-[#1B3A57] tabular-nums block leading-tight mt-0.5 truncate">
                    {formatDisplayDate(latestReq.fecha)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 min-w-0">
                <MapPin className="w-4.5 h-4.5 text-[#334155] shrink-0" />
                <div className="min-w-0">
                  <span className="text-[10.5px] text-slate-500 block leading-none">
                    Fundo
                  </span>
                  <span className="text-[13px] font-bold text-[#1B3A57] block leading-tight mt-0.5 truncate">
                    {latestReq.fundo}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 pl-0.5 min-w-0">
              <Bus className="w-6 h-6 text-[#1B3A57] shrink-0" />
              <div className="min-w-0">
                <span className="text-[10.5px] text-slate-500 block leading-none">
                  Movimiento
                </span>
                <span className="text-[13px] font-bold text-[#1B3A57] block leading-snug mt-0.5">
                  {latestReq.movimiento === 'SALIDA' ? 'Salida' : 'Ingreso'} (
                  {getHorarioDisplay(latestReq).textoHorario})
                </span>
              </div>
            </div>
          </div>

          {(() => {
            const st = getStatusStyle(latestReq.estado);
            return (
              <div
                className={`mt-3 px-4 py-2 rounded-full border flex items-center justify-between text-[13.5px] font-bold ${st.bar}`}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${st.iconWrap}`}
                  >
                    {st.icon}
                  </span>
                  <span>{st.label}</span>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-bold">
                  <span>Ver detalle</span>
                  <ChevronRight className="w-4 h-4" />
                </span>
              </div>
            );
          })()}
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-6 border border-[#E2E8F0] text-center space-y-2 shrink-0">
          <div className="w-11 h-11 rounded-full bg-[#EAF7E4] text-[#2F7D18] flex items-center justify-center mx-auto">
            <Bus className="w-5.5 h-5.5" />
          </div>
          <div className="text-sm font-bold text-[#1B3A57]">
            Sin solicitudes registradas
          </div>
          <p className="text-xs text-slate-500">
            Toca &quot;Nuevo Requerimiento&quot; para solicitar transporte.
          </p>
        </div>
      )}

      {/* 5. Horario de corte al pie */}
      <div className="bg-[#F4FBF2] border border-[#CBEBC2] rounded-2xl px-3.5 py-2.5 flex items-center gap-2.5 text-[11.5px] text-[#1B3A57] leading-snug shrink-0">
        <Clock className="w-4 h-4 text-[#15803D] shrink-0" />
        <p className="min-w-0">
          <strong className="font-bold text-[#14532D]">Horario de corte:</strong>{' '}
          hoy hasta <strong className="font-bold">09:00 AM</strong> · día siguiente hasta{' '}
          <strong className="font-bold">02:00 PM (14:00)</strong>.
        </p>
      </div>
    </div>
  );
});

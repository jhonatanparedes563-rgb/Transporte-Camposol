import React, { useState, useEffect } from 'react';
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
  RefreshCw,
} from 'lucide-react';
import { Requerimiento, EstadoRequerimiento, AppUser } from '../types';
import { getHorarioDisplay } from '../data/masterData';
import {
  getCloudSyncStatus,
  processPendingSyncQueue,
  syncWithServerNow,
  subscribeToDataChanges,
} from '../services/storageService';
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
  const [syncStatus, setSyncStatus] = useState(() => getCloudSyncStatus());
  const [isSendingOutbox, setIsSendingOutbox] = useState(false);

  useEffect(() => {
    const refresh = () => setSyncStatus(getCloudSyncStatus());
    refresh();
    void processPendingSyncQueue().then(refresh);
    const unsubData = subscribeToDataChanges(refresh);
    return () => {
      unsubData();
    };
  }, []);

  const handleFlushPendingOutbox = async () => {
    setIsSendingOutbox(true);
    try {
      await processPendingSyncQueue();
      await syncWithServerNow(true);
      setSyncStatus(getCloudSyncStatus());
    } finally {
      setIsSendingOutbox(false);
    }
  };

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
    <div className="w-full flex flex-col justify-start px-3 min-[375px]:px-3.5 pt-2.5 pb-4 gap-3 min-[375px]:gap-3.5">
      {/* 1. Saludo y Bienvenida al Solicitante */}
      <div className="bg-white rounded-2xl px-3 min-[375px]:px-3.5 py-2.5 border border-[#E2E8F0] shadow-[0_2px_8px_rgba(15,23,42,0.04)] shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-9 h-9 min-[375px]:w-10 min-[375px]:h-10 rounded-full bg-[#E5F5DF] border border-[#CBEBC2] text-[#15803D] flex items-center justify-center shrink-0">
              <User className="w-4.5 h-4.5 min-[375px]:w-5 min-[375px]:h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[15px]! min-[375px]:text-[16px]! font-extrabold text-[#1B3A57] leading-tight tracking-tight truncate">
                ¡{saludo}, {firstName}!
              </div>
              <div className="text-[11px]! min-[375px]:text-[11.5px]! font-medium text-slate-600 leading-snug mt-0.5 truncate">
                Bienvenido al portal de transporte de personal
              </div>
            </div>
          </div>

          {currentUser?.area && (
            <span className="shrink-0 max-w-[46%] inline-flex items-center gap-1 px-2 min-[375px]:px-2.5 py-0.5 rounded-full border border-[#BFE6B3] bg-[#EAF7E4] text-[10px]! min-[375px]:text-[10.5px]! font-semibold text-[#15803D]">
              <Sprout className="w-3 h-3 shrink-0" />
              <span className="truncate">{currentUser.area}</span>
            </span>
          )}
        </div>

        <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between gap-2 text-[11px]!">
          <span className="text-slate-500 truncate">
            Solicitante:{' '}
            <strong className="font-bold text-[#1B3A57]">
              {currentUser?.nombre || 'Solicitante'}
            </strong>
          </span>
          {currentUser?.fundo && (
            <span className="text-[10.5px]! font-semibold text-[#15803D] shrink-0 whitespace-nowrap">
              {currentUser.fundo}
            </span>
          )}
        </div>
      </div>

      {syncStatus.pendingOutboxCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-3.5 py-2 shadow-[0_2px_8px_rgba(15,23,42,0.04)] shrink-0 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[11.5px]! font-bold text-amber-900 leading-tight">
              {syncStatus.pendingOutboxCount === 1
                ? '1 requerimiento por enviar a la web'
                : `${syncStatus.pendingOutboxCount} requerimientos por enviar a la web`}
            </div>
            <div className="text-[10px]! text-amber-800 leading-tight">
              Se enviará automáticamente al recuperar conexión.
            </div>
          </div>
          <button
            type="button"
            id="btn-home-flush-outbox"
            onClick={handleFlushPendingOutbox}
            disabled={isSendingOutbox}
            className="shrink-0 px-2.5 py-1 rounded-full bg-white hover:bg-amber-100 border border-amber-300 text-amber-900 text-[10.5px]! font-bold flex items-center gap-1 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3 h-3 ${isSendingOutbox ? 'animate-spin' : ''}`} />
            <span>Reintentar</span>
          </button>
        </div>
      )}

      {/* 2. Banner Principal: Nuevo Requerimiento */}
      <button
        id="btn-mobile-nuevo-requerimiento"
        type="button"
        onClick={onNewRequirement}
        className="relative w-full h-[clamp(138px,19.5svh,172px)] shrink-0 rounded-2xl overflow-hidden bg-white border border-[#DCE8DF] shadow-[0_2px_10px_rgba(15,23,42,0.05)] text-left group cursor-pointer active:scale-[0.99] transition-transform flex items-center"
      >
        {!bannerImgFailed && (
          <img
            src={busBannerImg}
            alt="Bus de transporte de personal CAMPOSOL"
            referrerPolicy="no-referrer"
            fetchPriority="high"
            decoding="sync"
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
          className="absolute bottom-0 left-0 w-28 h-7 pointer-events-none"
        >
          <path d="M0,5 Q56,26 122,34 L0,34 Z" fill="#3AB526" opacity="0.92" />
          <path d="M0,17 Q42,28 88,34 L0,34 Z" fill="#15803D" opacity="0.88" />
        </svg>

        <div className="relative z-10 px-3.5 min-[375px]:px-4 py-3 flex flex-col justify-center w-[58%] min-[375px]:w-[55%] max-w-[220px]">
          <div className="relative inline-block w-fit">
            <span className="block text-[clamp(21px,6vw,26px)]! font-extrabold text-[#15803D] leading-none tracking-tight">
              Nuevo
            </span>
            <svg
              aria-hidden="true"
              viewBox="0 0 28 24"
              className="w-5.5 h-4.5 min-[375px]:w-6 min-[375px]:h-5 absolute -top-2 -right-6 min-[375px]:-right-7 text-[#65C428]"
            >
              <line x1="4" y1="9" x2="10" y2="2" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
              <line x1="10" y1="14" x2="21" y2="7" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
              <line x1="13" y1="20" x2="23" y2="17" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
            </svg>
          </div>
          <span className="block text-[clamp(18px,5.1vw,22px)]! font-extrabold text-[#1B3A57] leading-[1.06] tracking-tight mt-0.5">
            Requerimiento
          </span>
          <div className="text-[11px]! min-[375px]:text-[11.5px]! font-medium text-slate-700 leading-snug mt-1">
            Solicita transporte para personal agrícola
          </div>
          <span className="w-16 h-1 rounded-full bg-[#3AB526] mt-2 block" />
        </div>
      </button>

      {/* 3. Tarjetas KPI de Estados */}
      <div className="grid grid-cols-3 gap-2 min-[375px]:gap-2.5 shrink-0">
        <button
          id="btn-mobile-mis-requerimientos"
          type="button"
          onClick={onMyRequirements}
          className="bg-[#FFF8EC] border border-[#FDE2B8] rounded-2xl py-3 min-[375px]:py-3.5 px-1.5 min-[375px]:px-2 flex flex-col items-center justify-center text-center shadow-[0_2px_8px_rgba(15,23,42,0.04)] hover:brightness-[0.98] active:scale-[0.98] transition-all cursor-pointer min-w-0"
        >
          <span className="w-8.5 h-8.5 min-[375px]:w-9 min-[375px]:h-9 rounded-full border-2 border-[#F59E0B] bg-white text-[#F59E0B] flex items-center justify-center mb-1.5">
            <Clock className="w-4.5 h-4.5 min-[375px]:w-5 min-[375px]:h-5 stroke-[2.2]" />
          </span>
          <span className="text-[24px]! min-[375px]:text-[26px]! font-extrabold text-[#9A3412] leading-none tabular-nums">
            {pendingReqs}
          </span>
          <span className="text-[11.5px]! min-[375px]:text-[12px]! font-bold text-[#9A3412] mt-1 truncate w-full">
            Pendientes
          </span>
          <span className="mt-1 px-2 min-[375px]:px-2.5 py-0.5 rounded-full bg-[#FDE2AC] text-[10px]! font-semibold text-[#92400E] whitespace-nowrap">
            En revisión
          </span>
        </button>

        <button
          type="button"
          onClick={onMyRequirements}
          className="bg-[#EFFCF2] border border-[#C1F0CD] rounded-2xl py-3 min-[375px]:py-3.5 px-1.5 min-[375px]:px-2 flex flex-col items-center justify-center text-center shadow-[0_2px_8px_rgba(15,23,42,0.04)] hover:brightness-[0.98] active:scale-[0.98] transition-all cursor-pointer min-w-0"
        >
          <span className="w-8.5 h-8.5 min-[375px]:w-9 min-[375px]:h-9 rounded-full bg-[#16A34A] text-white flex items-center justify-center mb-1.5">
            <CheckCircle2 className="w-4.5 h-4.5 min-[375px]:w-5 min-[375px]:h-5" />
          </span>
          <span className="text-[24px]! min-[375px]:text-[26px]! font-extrabold text-[#15803D] leading-none tabular-nums">
            {approvedReqs}
          </span>
          <span className="text-[11.5px]! min-[375px]:text-[12px]! font-bold text-[#166534] mt-1 truncate w-full">
            Aprobados
          </span>
          <span className="mt-1 px-2 min-[375px]:px-2.5 py-0.5 rounded-full bg-[#C7F3D0] text-[10px]! font-semibold text-[#166534] whitespace-nowrap">
            Programados
          </span>
        </button>

        <button
          type="button"
          onClick={onMyRequirements}
          className="bg-[#EFF6FF] border border-[#C7E0FC] rounded-2xl py-3 min-[375px]:py-3.5 px-1.5 min-[375px]:px-2 flex flex-col items-center justify-center text-center shadow-[0_2px_8px_rgba(15,23,42,0.04)] hover:brightness-[0.98] active:scale-[0.98] transition-all cursor-pointer min-w-0"
        >
          <span className="w-8.5 h-8.5 min-[375px]:w-9 min-[375px]:h-9 rounded-full bg-[#0284C7] text-white flex items-center justify-center mb-1.5">
            <CheckCheck className="w-4.5 h-4.5 min-[375px]:w-5 min-[375px]:h-5" />
          </span>
          <span className="text-[24px]! min-[375px]:text-[26px]! font-extrabold text-[#1E3A8A] leading-none tabular-nums">
            {attendedReqs}
          </span>
          <span className="text-[11.5px]! min-[375px]:text-[12px]! font-bold text-[#1E3A8A] mt-1 truncate w-full">
            Atendidos
          </span>
          <span className="mt-1 px-2 min-[375px]:px-2.5 py-0.5 rounded-full bg-[#CFE5FE] text-[10px]! font-semibold text-[#1D4ED8] whitespace-nowrap">
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
          className="bg-white rounded-2xl p-3 min-[375px]:p-3.5 border border-[#E2E8F0] shadow-[0_2px_10px_rgba(15,23,42,0.04)] hover:border-[#22A846] transition-all cursor-pointer active:scale-[0.99] shrink-0"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <FileText className="w-4 h-4 text-[#16A34A] shrink-0" />
              <span className="text-[13.5px]! min-[375px]:text-[14px]! font-bold text-[#1B3A57] truncate">
                Tu última solicitud
              </span>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-[#E5F7DC] border border-[#C6E9B4] text-[#166534] font-mono text-[11px]! font-bold shrink-0">
              {latestReq.numeroRequerimiento}
            </span>
          </div>

          <div className="mt-2.5 bg-[#F7FAFC] border border-[#EDF2F7] rounded-xl px-2.5 min-[375px]:px-3 py-2 grid grid-cols-2 gap-2.5 items-center">
            <div className="space-y-1.5 pr-2 border-r-2 border-blue-200/70 min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <Calendar className="w-4 h-4 text-[#334155] shrink-0" />
                <div className="min-w-0">
                  <span className="text-[10px]! text-slate-500 block leading-none">
                    Fecha
                  </span>
                  <span className="text-[12px]! min-[375px]:text-[12.5px]! font-bold text-[#1B3A57] tabular-nums block leading-tight mt-0.5 truncate">
                    {formatDisplayDate(latestReq.fecha)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 min-w-0">
                <MapPin className="w-4 h-4 text-[#334155] shrink-0" />
                <div className="min-w-0">
                  <span className="text-[10px]! text-slate-500 block leading-none">
                    Fundo
                  </span>
                  <span className="text-[12px]! min-[375px]:text-[12.5px]! font-bold text-[#1B3A57] block leading-tight mt-0.5 truncate">
                    {latestReq.fundo}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pl-0.5 min-w-0">
              <Bus className="w-5 h-5 text-[#1B3A57] shrink-0" />
              <div className="min-w-0">
                <span className="text-[10px]! text-slate-500 block leading-none">
                  Movimiento
                </span>
                <span className="text-[12px]! min-[375px]:text-[12.5px]! font-bold text-[#1B3A57] block leading-snug mt-0.5">
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
                className={`mt-2.5 px-3 py-1.5 rounded-full border flex items-center justify-between text-[12px]! min-[375px]:text-[12.5px]! font-bold ${st.bar}`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${st.iconWrap}`}
                  >
                    {st.icon}
                  </span>
                  <span>{st.label}</span>
                </div>
                <span className="inline-flex items-center gap-1 text-[11px]! min-[375px]:text-[11.5px]! font-bold">
                  <span>Ver detalle</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
            );
          })()}
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0] text-center space-y-1.5 shrink-0">
          <div className="w-10 h-10 rounded-full bg-[#EAF7E4] text-[#2F7D18] flex items-center justify-center mx-auto">
            <Bus className="w-5 h-5" />
          </div>
          <div className="text-sm font-bold text-[#1B3A57]">
            Sin solicitudes registradas
          </div>
          <div className="text-xs text-slate-500">
            Toca &quot;Nuevo Requerimiento&quot; para solicitar transporte.
          </div>
        </div>
      )}

      {/* 5. Horario de corte al pie */}
      <div className="bg-[#F2FBF0] border border-[#CBEBC2] rounded-2xl px-3 min-[375px]:px-3.5 py-2.5 shadow-[0_2px_8px_rgba(15,23,42,0.04)] flex items-center gap-2 text-[11px]! text-[#1B3A57] leading-snug shrink-0">
        <Clock className="w-3.5 h-3.5 text-[#15803D] shrink-0" />
        <div className="text-[11px]! min-w-0 leading-snug">
          <strong className="font-bold text-[#14532D]">Horario de corte:</strong>{' '}
          hoy hasta <strong className="font-bold">09:00 AM</strong> · día siguiente hasta{' '}
          <strong className="font-bold">02:00 PM (14:00)</strong>.
        </div>
      </div>
    </div>
  );
});

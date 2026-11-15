import React, { useState, useEffect } from 'react';
import {
  Check,
  Calendar,
  Clock,
  Sprout,
  Home,
  Users,
  PlusCircle,
  RefreshCw,
} from 'lucide-react';
import { Requerimiento } from '../types';
import {
  getCloudSyncStatus,
  processPendingSyncQueue,
  syncWithServerNow,
  subscribeToDataChanges,
} from '../services/storageService';

interface Step4ConfirmationProps {
  requerimiento: Requerimiento;
  syncedToServer?: boolean;
  syncNotice?: string;
  onViewRequirement: (req: Requerimiento) => void;
  onNewRequirement: () => void;
  onGoHome: () => void;
}

export const Step4Confirmation: React.FC<Step4ConfirmationProps> = ({
  requerimiento,
  syncedToServer = true,
  syncNotice,
  onNewRequirement,
  onGoHome,
}) => {
  const [copied, setCopied] = useState(false);
  const [isSynced, setIsSynced] = useState(syncedToServer);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    setIsSynced(syncedToServer);
  }, [syncedToServer, requerimiento.id]);

  useEffect(() => {
    const refresh = () => {
      const st = getCloudSyncStatus();
      if (st.pendingOutboxCount === 0 && (st.firebaseConnected || st.hasServerSession)) {
        setIsSynced(true);
      }
    };
    refresh();
    const unsubData = subscribeToDataChanges(refresh);
    return () => {
      unsubData();
    };
  }, []);

  const handleRetrySync = async () => {
    setIsRetrying(true);
    try {
      await processPendingSyncQueue();
      await syncWithServerNow(true);
      const after = getCloudSyncStatus();
      if (after.pendingOutboxCount === 0 && (after.firebaseConnected || after.hasServerSession)) {
        setIsSynced(true);
      }
    } finally {
      setIsRetrying(false);
    }
  };

  const copyNumber = () => {
    navigator.clipboard.writeText(requerimiento.numeroRequerimiento);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
    <div className="space-y-4 max-w-md mx-auto w-full pb-20 text-center">
      {/* Big Circular Green Checkmark */}
      <div className="pt-4 flex justify-center">
        <div className="w-20 h-20 rounded-full bg-[#55A529] text-white flex items-center justify-center shadow-lg ring-8 ring-[#EAF7E4]">
          <Check className="w-10 h-10 stroke-[3.5]" />
        </div>
      </div>

      {/* Main Title & Subtitle */}
      <div className="space-y-1">
        <h2 className="text-xl sm:text-2xl font-bold text-[#1B3A57] tracking-tight">
          ¡Requerimiento registrado!
        </h2>
        <p className={`text-xs sm:text-sm font-medium ${isSynced ? 'text-[#2F7D18]' : 'text-amber-700'}`}>
          {isSynced
            ? 'Guardado en línea y transmitido en tiempo real a Procesos.'
            : syncNotice || 'Guardado en el teléfono; se enviará a la web en cuanto haya conexión.'}
        </p>
        {!isSynced && (
          <div className="pt-1 flex justify-center">
            <button
              type="button"
              id="btn-step4-retry-sync"
              onClick={handleRetrySync}
              disabled={isRetrying}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-[11px] font-semibold transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${isRetrying ? 'animate-spin' : ''}`} />
              <span>{isRetrying ? 'Enviando...' : 'Reintentar envío'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Ticket Number Badge */}
      <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-[#EAF7E4] border border-[#C6E9B4] rounded-full">
        <span className="text-xs font-mono font-bold text-[#2F7D18]">
          {requerimiento.numeroRequerimiento}
        </span>
        <button
          type="button"
          onClick={copyNumber}
          className="text-[10px] text-[#2F7D18] hover:underline font-semibold cursor-pointer"
        >
          {copied ? '¡Copiado!' : 'Copiar'}
        </button>
      </div>

      {/* Summary Card matching mockup */}
      <div className="bg-white rounded-2xl p-4 border border-[#E5ECF2] shadow-xs text-left space-y-2.5 text-xs text-[#1B3A57]">
        <div className="flex items-center justify-between py-1 border-b border-slate-100">
          <span className="flex items-center gap-2 text-slate-500 font-medium">
            <Calendar className="w-4 h-4 text-[#55A529]" />
            <span>Fecha</span>
          </span>
          <strong className="font-bold text-sm">
            {formatDisplayDate(requerimiento.fecha)}
          </strong>
        </div>

        <div className="flex items-center justify-between py-1 border-b border-slate-100">
          <span className="flex items-center gap-2 text-slate-500 font-medium">
            <Clock className="w-4 h-4 text-[#55A529]" />
            <span>Hora</span>
          </span>
          <strong className="font-bold text-sm">
            {requerimiento.movimiento === 'INGRESO' && requerimiento.horaRecojoNorte && requerimiento.horaRecojoSur
              ? `Norte: ${requerimiento.horaRecojoNorte} | Sur: ${requerimiento.horaRecojoSur}`
              : requerimiento.horaRecojo}
          </strong>
        </div>

        <div className="flex items-center justify-between py-1 border-b border-slate-100">
          <span className="flex items-center gap-2 text-slate-500 font-medium">
            <Sprout className="w-4 h-4 text-[#55A529]" />
            <span>Cultivo</span>
          </span>
          <strong className="font-bold text-sm uppercase">
            {requerimiento.cultivo || 'ARÁNDANO'}
          </strong>
        </div>

        <div className="flex items-center justify-between py-1 border-b border-slate-100">
          <span className="flex items-center gap-2 text-slate-500 font-medium">
            <Home className="w-4 h-4 text-[#55A529]" />
            <span>Fundo</span>
          </span>
          <strong className="font-bold text-sm uppercase">{requerimiento.fundo}</strong>
        </div>

        <div className="flex items-center justify-between py-1">
          <span className="flex items-center gap-2 text-slate-500 font-medium">
            <Users className="w-4 h-4 text-[#55A529]" />
            <span>Total personas</span>
          </span>
          <strong className="font-bold text-base text-[#2F7D18]">
            {requerimiento.totalPersonas}
          </strong>
        </div>
      </div>

      {/* Action Buttons matching mockup */}
      <div className="space-y-2.5 pt-2">
        <button
          type="button"
          id="btn-registrar-otro"
          onClick={onNewRequirement}
          className="w-full py-3.5 px-4 bg-[#22A846] hover:bg-[#1C8E3A] text-white font-semibold text-sm rounded-full shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Registrar otro requerimiento</span>
        </button>

        <button
          type="button"
          id="btn-volver-inicio"
          onClick={onGoHome}
          className="w-full py-3 px-4 bg-[#F1F5F9] hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-full transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <Home className="w-4 h-4 text-slate-500" />
          <span>Volver al inicio</span>
        </button>
      </div>
    </div>
  );
};

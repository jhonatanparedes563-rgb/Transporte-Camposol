import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  Sprout,
  Home,
  Bus,
  ArrowRight,
  AlertCircle,
  Lock,
  UserCheck,
} from 'lucide-react';
import { RequerimientoDraft, MovimientoType, AppUser } from '../types';
import { getStoredFundos } from '../services/storageService';
import {
  MAESTRO_CULTIVOS,
  MAESTRO_MOVIMIENTOS,
} from '../data/masterData';

interface Step1ServiceDataProps {
  draft: RequerimientoDraft;
  onUpdateDraft: (partial: Partial<RequerimientoDraft>) => void;
  onNext: () => void;
  onCancel: () => void;
  currentUser?: AppUser;
}

// Helper para asegurar formato HH:mm válido en inputs tipo time
const cleanSingleTime = (val?: string): string => {
  if (!val) return '13:00';
  const match = val.match(/\b([01]\d|2[0-3]):([0-5]\d)\b/);
  return match ? match[0] : '13:00';
};

export const Step1ServiceData: React.FC<Step1ServiceDataProps> = ({
  draft,
  onUpdateDraft,
  onNext,
  onCancel,
  currentUser,
}) => {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [fundos] = useState(() => getStoredFundos());

  const isOrdinaryUser = currentUser?.rol === 'usuario';

  // Ensure default values matching the mockup
  useEffect(() => {
    const updates: Partial<RequerimientoDraft> = {};
    if (!draft.cultivo) updates.cultivo = 'ARÁNDANO';
    if (!draft.fundo) updates.fundo = 'AGRICULTOR 1';
    if (!draft.movimiento) updates.movimiento = 'Programa personal por tarea' as MovimientoType;
    if (draft.movimiento === 'INGRESO') {
      if (!draft.horaRecojoNorte) updates.horaRecojoNorte = '05:00';
      if (!draft.horaRecojoSur) updates.horaRecojoSur = '05:00';
      if (!draft.horaRecojo || !draft.horaRecojo.includes('/')) {
        updates.horaRecojo = '05:00 (N) / 05:00 (S)';
        updates.horaSalida = '05:00 (N) / 05:00 (S)';
      }
    } else {
      if (!draft.horaRecojo) updates.horaRecojo = '13:00';
    }
    if (isOrdinaryUser && currentUser) {
      updates.area = currentUser.area || draft.area || 'PRODUCCIÓN';
      if (currentUser.fundo && currentUser.fundo !== 'TODOS LOS FUNDOS') {
        updates.fundo = currentUser.fundo;
      }
      if (currentUser.cultivo && currentUser.cultivo !== 'TODOS LOS CULTIVOS') {
        updates.cultivo = currentUser.cultivo;
      }
    } else if (!draft.area) {
      updates.area = 'PRODUCCIÓN';
    }

    if (Object.keys(updates).length > 0) {
      onUpdateDraft(updates);
    }
  }, [currentUser, isOrdinaryUser, draft.movimiento]);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!draft.fecha) errs.fecha = 'Selecciona la fecha del servicio.';
    if (draft.movimiento === 'INGRESO') {
      if (!draft.horaRecojoNorte && !draft.horaRecojo) {
        errs.horaRecojo = 'Ingresa el horario de recojo para Norte y Sur.';
      }
    } else {
      if (!draft.horaRecojo) errs.horaRecojo = 'Ingresa la hora de recojo.';
    }
    if (!draft.fundo) errs.fundo = 'Selecciona el fundo.';
    if (!draft.cultivo) errs.cultivo = 'Selecciona el cultivo o servicio.';

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onNext();
    }
  };

  return (
    <form onSubmit={handleContinue} className="space-y-3 w-full pb-6">
      {/* Title & Subtitle Matching Mockup */}
      <div className="bg-white p-4 rounded-2xl border border-[#E5ECF2] shadow-xs text-center space-y-0.5">
        <h2 className="text-lg sm:text-xl font-bold text-[#1B3A57] tracking-tight uppercase">
          REQUERIMIENTO DE BUS
        </h2>
        <p className="text-xs text-slate-500 font-medium">
          {draft.movimiento || 'Programa personal por tarea'}
        </p>
      </div>

      {/* User Info Bar if logged in */}
      {currentUser && (
        <div className="bg-[#EAF7E4]/70 p-3 rounded-2xl border border-[#C6E9B4] flex flex-col gap-2 text-xs text-[#1B3A57]">
          <div className="flex items-center gap-2 min-w-0">
            <UserCheck className="w-4 h-4 text-[#55A529] shrink-0" />
            <span className="truncate">
              Solicitante: <strong className="font-bold">{currentUser.nombre}</strong>
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 pl-6">
            <span className="text-[10px] font-semibold bg-white text-[#2F7D18] px-2.5 py-0.5 rounded-full border border-[#C6E9B4] whitespace-nowrap">
              {currentUser.fundo || 'Fundo Asignado'}
            </span>
            {currentUser.cultivo && (
              <span className="text-[10px] font-semibold bg-white text-[#2F7D18] px-2.5 py-0.5 rounded-full border border-[#C6E9B4] whitespace-nowrap">
                {currentUser.cultivo}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="space-y-3.5">
        {/* FECHA */}
        <div className="bg-white p-4 rounded-2xl border border-[#E5ECF2] shadow-xs">
          <label className="block text-xs font-bold text-[#1B3A57] uppercase tracking-wide flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-[#55A529]" />
            <span>FECHA</span>
          </label>
          <input
            id="input-fecha"
            type="date"
            value={draft.fecha}
            onChange={(e) => {
              onUpdateDraft({ fecha: e.target.value });
              if (errors.fecha) setErrors((prev) => ({ ...prev, fecha: '' }));
            }}
            className={`w-full px-3.5 py-2.5 bg-white border rounded-full text-sm font-semibold text-[#1B3A57] focus:outline-none focus:border-[#55A529] ${
              errors.fecha ? 'border-red-500 bg-red-50/40' : 'border-[#D8E2EA]'
            }`}
          />
          {errors.fecha && (
            <p className="text-[11px] text-[#DC2626] font-medium mt-1 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {errors.fecha}
            </p>
          )}
        </div>

        {/* MOVIMIENTO */}
        <div className="bg-white p-4 rounded-2xl border border-[#E5ECF2] shadow-xs">
          <label className="block text-xs font-bold text-[#1B3A57] uppercase tracking-wide flex items-center gap-2 mb-2">
            <Bus className="w-4 h-4 text-[#55A529]" />
            <span>MOVIMIENTO</span>
          </label>
          <select
            id="select-movimiento"
            value={draft.movimiento || 'Programa personal por tarea'}
            onChange={(e) => {
              const newMov = e.target.value as MovimientoType;
              if (newMov === 'INGRESO') {
                const n = cleanSingleTime(draft.horaRecojoNorte || draft.horaRecojo || '05:00');
                const s = cleanSingleTime(draft.horaRecojoSur || draft.horaRecojo || '05:00');
                onUpdateDraft({
                  movimiento: newMov,
                  horaRecojoNorte: n,
                  horaRecojoSur: s,
                  horaRecojo: `${n} (N) / ${s} (S)`,
                  horaSalida: `${n} (N) / ${s} (S)`,
                });
              } else {
                const single = cleanSingleTime(draft.horaRecojoNorte || draft.horaRecojo || '13:00');
                onUpdateDraft({
                  movimiento: newMov,
                  horaRecojo: single,
                  horaSalida: single,
                });
              }
              if (errors.horaRecojo) setErrors((prev) => ({ ...prev, horaRecojo: '' }));
            }}
            className="w-full px-3.5 py-2.5 bg-white border border-[#D8E2EA] rounded-full text-sm font-semibold text-[#1B3A57] focus:outline-none focus:border-[#55A529]"
          >
            {MAESTRO_MOVIMIENTOS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        {/* HORA DE RECOJO / HORARIO SEGÚN MOVIMIENTO */}
        {draft.movimiento === 'INGRESO' ? (
          <div className="bg-white p-4 rounded-2xl border border-[#E5ECF2] shadow-xs space-y-2">
            <label className="block text-xs font-bold text-[#1B3A57] uppercase tracking-wide flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#55A529]" />
              <span>HORA DE RECOJO (INGRESO)</span>
            </label>
            <div className="grid grid-cols-2 gap-3 pt-1">
              {/* Cuadrito NORTE */}
              <div>
                <label className="block text-xs font-bold text-[#0082B3] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#0082B3]"></span>
                  <span>NORTE</span>
                </label>
                <input
                  id="input-hora-recojo-norte"
                  type="time"
                  value={cleanSingleTime(draft.horaRecojoNorte || draft.horaRecojo || '05:00')}
                  onChange={(e) => {
                    const newNorte = e.target.value;
                    const currentSur = cleanSingleTime(draft.horaRecojoSur || draft.horaRecojo || '05:00');
                    onUpdateDraft({
                      horaRecojoNorte: newNorte,
                      horaRecojoSur: currentSur,
                      horaRecojo: `${newNorte} (N) / ${currentSur} (S)`,
                      horaSalida: `${newNorte} (N) / ${currentSur} (S)`,
                    });
                    if (errors.horaRecojo) setErrors((prev) => ({ ...prev, horaRecojo: '' }));
                  }}
                  className="w-full px-3.5 py-2.5 bg-white border border-[#D8E2EA] rounded-full text-sm font-bold text-[#1B3A57] focus:outline-none focus:border-[#55A529]"
                />
              </div>

              {/* Cuadrito SUR */}
              <div>
                <label className="block text-xs font-bold text-[#B45309] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  <span>SUR</span>
                </label>
                <input
                  id="input-hora-recojo-sur"
                  type="time"
                  value={cleanSingleTime(draft.horaRecojoSur || draft.horaRecojo || '05:00')}
                  onChange={(e) => {
                    const newSur = e.target.value;
                    const currentNorte = cleanSingleTime(draft.horaRecojoNorte || draft.horaRecojo || '05:00');
                    onUpdateDraft({
                      horaRecojoNorte: currentNorte,
                      horaRecojoSur: newSur,
                      horaRecojo: `${currentNorte} (N) / ${newSur} (S)`,
                      horaSalida: `${currentNorte} (N) / ${newSur} (S)`,
                    });
                    if (errors.horaRecojo) setErrors((prev) => ({ ...prev, horaRecojo: '' }));
                  }}
                  className="w-full px-3.5 py-2.5 bg-white border border-[#D8E2EA] rounded-full text-sm font-bold text-[#1B3A57] focus:outline-none focus:border-[#55A529]"
                />
              </div>
            </div>
            {errors.horaRecojo && (
              <p className="text-[11px] text-[#DC2626] font-medium mt-1 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {errors.horaRecojo}
              </p>
            )}
          </div>
        ) : (
          /* HORA DE RECOJO (SALIDA O TAREA NORMAL - MANTENER COMO ESTÁ AHORA) */
          <div className="bg-white p-4 rounded-2xl border border-[#E5ECF2] shadow-xs">
            <label className="block text-xs font-bold text-[#1B3A57] uppercase tracking-wide flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-[#55A529]" />
              <span>HORA DE RECOJO</span>
            </label>
            <input
              id="input-hora-recojo"
              type="time"
              value={cleanSingleTime(draft.horaRecojo || '13:00')}
              onChange={(e) => {
                onUpdateDraft({
                  horaRecojo: e.target.value,
                  horaSalida: e.target.value,
                });
                if (errors.horaRecojo) setErrors((prev) => ({ ...prev, horaRecojo: '' }));
              }}
              className={`w-full px-3.5 py-2.5 bg-white border rounded-full text-sm font-bold text-[#1B3A57] focus:outline-none focus:border-[#55A529] ${
                errors.horaRecojo ? 'border-red-500 bg-red-50/40' : 'border-[#D8E2EA]'
              }`}
            />
            {errors.horaRecojo && (
              <p className="text-[11px] text-[#DC2626] font-medium mt-1 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {errors.horaRecojo}
              </p>
            )}
          </div>
        )}

        {/* SERVICIO Y CULTIVO */}
        <div className="bg-white p-4 rounded-2xl border border-[#E5ECF2] shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-bold text-[#1B3A57] uppercase tracking-wide flex items-center gap-2">
              <Sprout className="w-4 h-4 text-[#55A529]" />
              <span>SERVICIO Y CULTIVO</span>
            </label>
            {isOrdinaryUser && currentUser?.cultivo && currentUser.cultivo !== 'TODOS LOS CULTIVOS' && (
              <span className="text-[10px] text-[#2F7D18] font-semibold flex items-center gap-1">
                <Lock className="w-3 h-3" /> Cultivo asignado
              </span>
            )}
          </div>
          <select
            id="select-cultivo"
            value={draft.cultivo || 'ARÁNDANO'}
            disabled={isOrdinaryUser && !!currentUser?.cultivo && currentUser.cultivo !== 'TODOS LOS CULTIVOS'}
            onChange={(e) => {
              onUpdateDraft({ cultivo: e.target.value });
              if (errors.cultivo) setErrors((prev) => ({ ...prev, cultivo: '' }));
            }}
            className="w-full px-3.5 py-2.5 bg-white border border-[#D8E2EA] rounded-full text-sm font-semibold text-[#1B3A57] focus:outline-none focus:border-[#55A529] disabled:opacity-80 disabled:bg-slate-100"
          >
            {MAESTRO_CULTIVOS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* NOMBRE DE FUNDO */}
        <div className="bg-white p-4 rounded-2xl border border-[#E5ECF2] shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-bold text-[#1B3A57] uppercase tracking-wide flex items-center gap-2">
              <Home className="w-4 h-4 text-[#55A529]" />
              <span>NOMBRE DE FUNDO</span>
            </label>
            {isOrdinaryUser && currentUser?.fundo && currentUser.fundo !== 'TODOS LOS FUNDOS' && (
              <span className="text-[10px] text-[#2F7D18] font-semibold flex items-center gap-1">
                <Lock className="w-3 h-3" /> Fundo asignado
              </span>
            )}
          </div>
          <select
            id="select-fundo"
            value={draft.fundo || 'AGRICULTOR 1'}
            disabled={isOrdinaryUser && !!currentUser?.fundo && currentUser.fundo !== 'TODOS LOS FUNDOS'}
            onChange={(e) => {
              onUpdateDraft({ fundo: e.target.value });
              if (errors.fundo) setErrors((prev) => ({ ...prev, fundo: '' }));
            }}
            className="w-full px-3.5 py-2.5 bg-white border border-[#D8E2EA] rounded-full text-sm font-semibold text-[#1B3A57] focus:outline-none focus:border-[#55A529] disabled:opacity-80 disabled:bg-slate-100"
          >
            {fundos.map((f) => (
              <option key={f.id} value={f.fundo}>
                {f.fundo}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Action Button: Siguiente → */}
      <div className="pt-2">
        <button
          type="submit"
          id="btn-step1-siguiente"
          className="w-full py-3.5 px-6 bg-[#22A846] hover:bg-[#1C8E3A] text-white font-semibold text-base rounded-full shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>Siguiente</span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </form>
  );
};

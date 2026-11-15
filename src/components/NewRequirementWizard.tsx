import React, { useState, useRef } from 'react';
import { RequerimientoDraft, Requerimiento, AppUser, ComedorPersonalDraft } from '../types';
import { Step1ServiceData } from './Step1ServiceData';
import { Step2PersonnelQuantity } from './Step2PersonnelQuantity';
import { Step3Summary } from './Step3Summary';
import { Step4Confirmation } from './Step4Confirmation';
import {
  saveNewRequerimientoAsync,
  getStoredComedores,
  getStoredRequirementDraft,
  saveStoredRequirementDraft,
  clearStoredRequirementDraft,
} from '../services/storageService';

interface NewRequirementWizardProps {
  onCancel: () => void;
  onSuccess: (savedReq: Requerimiento) => void;
  onViewRequirement: (req: Requerimiento) => void;
  currentUser?: AppUser;
}

const getLocalTodayDate = (): string => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const NewRequirementWizard: React.FC<NewRequirementWizardProps> = ({
  onCancel,
  onSuccess,
  onViewRequirement,
  currentUser,
}) => {
  // Steps matching the user's mockup:
  // 1: Selecciona los datos del servicio
  // 2: Ingresa las cantidades por zona (Zona Sur)
  // 3: Ingresa las cantidades por zona (Zona Norte)
  // 4: Revisa y confirma
  // 5: Confirmación
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string>('');
  const [createdRequirement, setCreatedRequirement] = useState<Requerimiento | null>(null);
  const [syncedToServer, setSyncedToServer] = useState<boolean>(true);
  const [syncNotice, setSyncNotice] = useState<string>('');
  const submitLockRef = useRef(false);

  const todayDate = getLocalTodayDate();

  const buildInitialDraft = (): RequerimientoDraft => {
    const storedComedores = getStoredComedores();
    const defaultComedorName = storedComedores[0]?.comedor || '57';

    // Si existe un borrador guardado en progreso, restaurarlo para no perder datos
    const savedDraft = getStoredRequirementDraft();
    if (savedDraft) {
      const comedoresConDatos = (savedDraft.comedores || []).filter((c) =>
        Object.values(c.paraderosCantidades || {}).some((v) => Number(v) > 0)
      );
      const fechaVigente =
        !savedDraft.fecha || savedDraft.fecha < todayDate || comedoresConDatos.length === 0
          ? todayDate
          : savedDraft.fecha;
      if (comedoresConDatos.length === 0 && (savedDraft.comedores?.length || 0) > 1) {
        return {
          ...savedDraft,
          fecha: fechaVigente,
          comedores: [{ comedor: savedDraft.comedores![0].comedor || defaultComedorName, paraderosCantidades: {} }],
        };
      }
      return {
        ...savedDraft,
        fecha: fechaVigente,
      };
    }

    const initialComedores: ComedorPersonalDraft[] = [
      { comedor: defaultComedorName, paraderosCantidades: {} },
    ];

    return {
      fecha: todayDate,
      area: currentUser?.area || 'PRODUCCIÓN',
      fundo:
        currentUser?.fundo && currentUser.fundo !== 'TODOS LOS FUNDOS'
          ? currentUser.fundo
          : 'AGRICULTOR 1',
      cultivo:
        currentUser?.cultivo && currentUser.cultivo !== 'TODOS LOS CULTIVOS'
          ? currentUser.cultivo
          : 'ARÁNDANO',
      movimiento: 'Programa personal por tarea',
      horaRecojo: '13:00',
      horaSalida: '13:00',
      observaciones: '',
      cantidadesPorParadero: {},
      matrizCantidades: {},
      comedores: initialComedores,
    };
  };

  const [draft, setDraft] = useState<RequerimientoDraft>(buildInitialDraft);

  const handleUpdateDraft = (partial: Partial<RequerimientoDraft>) => {
    setDraft((prev) => {
      const updated = { ...prev, ...partial };
      // Guardar automáticamente en segundo plano para que no se mueva ni pierda ningún dato
      saveStoredRequirementDraft(updated);
      return updated;
    });
  };

  const handleSubmit = async () => {
    if (submitLockRef.current || isSubmitting) return;
    submitLockRef.current = true;
    setSubmitError('');
    setIsSubmitting(true);
    try {
      const result = await saveNewRequerimientoAsync(draft, currentUser);
      clearStoredRequirementDraft();
      setCreatedRequirement(result.requerimiento);
      setSyncedToServer(result.syncedToServer);
      setSyncNotice(result.authError || '');
      onSuccess(result.requerimiento);
      setCurrentStep(4);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo registrar el requerimiento.';
      setSubmitError(msg);
      submitLockRef.current = false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForNew = () => {
    submitLockRef.current = false;
    setSubmitError('');
    setSyncedToServer(true);
    setSyncNotice('');
    clearStoredRequirementDraft();
    setDraft(buildInitialDraft());
    setCreatedRequirement(null);
    setCurrentStep(1);
  };

  const stepsInfo = [
    { id: 1, title: 'Datos', label: 'Selecciona los datos del servicio' },
    { id: 2, title: 'Comedores', label: 'Ingresa las cantidades por comedor y paradero' },
    { id: 3, title: 'Resumen', label: 'Revisa y confirma el requerimiento' },
    { id: 4, title: 'Listo', label: 'Confirmación' },
  ];

  return (
    <div className="flex-1 flex flex-col w-full py-0.5">
      {/* 4-Step Progress Header */}
      <div className="mb-3 bg-white p-3 rounded-2xl border border-[#E5ECF2] shadow-xs">
        <div className="flex items-center justify-between gap-1">
          {stepsInfo.map((s) => {
            const isActive = currentStep === s.id;
            const isCompleted = currentStep > s.id;

            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  if (s.id <= currentStep && currentStep < 4) {
                    setCurrentStep(s.id);
                  }
                }}
                disabled={currentStep === 4 || s.id > currentStep}
                className="flex flex-col items-center flex-1 transition-all"
              >
                <div
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-[#55A529] text-white ring-4 ring-[#EAF7E4] shadow-xs scale-105'
                      : isCompleted
                      ? 'bg-[#EAF7E4] text-[#2F7D18] border border-[#C6E9B4]'
                      : 'bg-[#F1F5F9] text-slate-400'
                  }`}
                >
                  {s.id}
                </div>
                <span
                  className={`text-[9px] sm:text-[10px] mt-1 font-bold truncate max-w-[65px] ${
                    isActive
                      ? 'text-[#2F7D18]'
                      : isCompleted
                      ? 'text-slate-600'
                      : 'text-slate-400'
                  }`}
                >
                  {s.title}
                </span>
              </button>
            );
          })}
        </div>

        {/* Current Step Description Callout */}
        <div className="mt-2.5 pt-2 border-t border-slate-100 text-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#55A529] block">
            Paso {currentStep} de 4
          </span>
          <p className="text-xs font-bold text-[#1B3A57]">
            {stepsInfo[currentStep - 1]?.label}
          </p>
        </div>
      </div>

      {/* Step Components */}
      {currentStep === 1 && (
        <Step1ServiceData
          draft={draft}
          onUpdateDraft={handleUpdateDraft}
          onNext={() => setCurrentStep(2)}
          onCancel={onCancel}
          currentUser={currentUser}
        />
      )}

      {currentStep === 2 && (
        <Step2PersonnelQuantity
          draft={draft}
          onUpdateDraft={handleUpdateDraft}
          onNext={() => setCurrentStep(3)}
          onPrev={() => setCurrentStep(1)}
        />
      )}

      {submitError && (
        <div className="mb-3 p-3 bg-[#FDECEC] border border-[#FECACA] rounded-2xl text-xs font-bold text-[#DC2626] text-center">
          {submitError}
        </div>
      )}

      {currentStep === 3 && (
        <Step3Summary
          draft={draft}
          onEdit={() => setCurrentStep(1)}
          onSubmit={handleSubmit}
          onPrev={() => setCurrentStep(2)}
          onUpdateDraft={handleUpdateDraft}
          isSubmitting={isSubmitting}
        />
      )}

      {currentStep === 4 && createdRequirement && (
        <Step4Confirmation
          requerimiento={createdRequirement}
          syncedToServer={syncedToServer}
          syncNotice={syncNotice}
          onViewRequirement={(req) => onViewRequirement(req)}
          onNewRequirement={handleResetForNew}
          onGoHome={onCancel}
        />
      )}
    </div>
  );
};

import React, { useState } from 'react';
import { RequerimientoDraft, Requerimiento, AppUser, ComedorPersonalDraft } from '../types';
import { Step1ServiceData } from './Step1ServiceData';
import { Step2PersonnelQuantity } from './Step2PersonnelQuantity';
import { Step3Summary } from './Step3Summary';
import { Step4Confirmation } from './Step4Confirmation';
import {
  saveNewRequerimiento,
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
  const [createdRequirement, setCreatedRequirement] = useState<Requerimiento | null>(null);

  const todayDate = new Date().toISOString().split('T')[0];

  const buildInitialDraft = (): RequerimientoDraft => {
    // Si existe un borrador guardado en progreso, restaurarlo para no perder datos
    const savedDraft = getStoredRequirementDraft();
    if (savedDraft) {
      return savedDraft;
    }

    const storedComedores = getStoredComedores();
    const initialComedores: ComedorPersonalDraft[] =
      storedComedores.length >= 2
        ? storedComedores.slice(0, 2).map((c) => ({
            comedor: c.comedor,
            paraderosCantidades: {},
          }))
        : storedComedores.length === 1
        ? [
            { comedor: storedComedores[0].comedor, paraderosCantidades: {} },
            { comedor: '63', paraderosCantidades: {} },
          ]
        : [
            { comedor: '57', paraderosCantidades: {} },
            { comedor: '63', paraderosCantidades: {} },
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

  const handleSubmit = () => {
    setIsSubmitting(true);
    try {
      const result = saveNewRequerimiento(draft, currentUser);
      clearStoredRequirementDraft();
      setCreatedRequirement(result.requerimiento);
      onSuccess(result.requerimiento);
      setCurrentStep(4);
    } catch (err) {
      console.error('Error saving requirement:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForNew = () => {
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
    <div className="flex-1 flex flex-col w-full max-w-xl mx-auto py-2">
      {/* 4-Step Progress Header */}
      <div className="mb-4 bg-white p-3 rounded-2xl border border-gray-200 shadow-2xs">
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
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                    isActive
                      ? 'bg-[#00843D] text-white ring-4 ring-emerald-100 shadow-xs scale-105'
                      : isCompleted
                      ? 'bg-[#E8F5EF] text-[#00843D] border border-[#00843D]/30'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {s.id}
                </div>
                <span
                  className={`text-[9px] sm:text-[10px] mt-1 font-bold truncate max-w-[65px] ${
                    isActive
                      ? 'text-[#00843D]'
                      : isCompleted
                      ? 'text-gray-600'
                      : 'text-gray-400'
                  }`}
                >
                  {s.title}
                </span>
              </button>
            );
          })}
        </div>

        {/* Current Step Description Callout */}
        <div className="mt-2.5 pt-2 border-t border-gray-100 text-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#00843D] block">
            Paso {currentStep} de 4
          </span>
          <p className="text-xs font-black text-[#173B56]">
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
          onViewRequirement={(req) => onViewRequirement(req)}
          onNewRequirement={handleResetForNew}
          onGoHome={onCancel}
        />
      )}
    </div>
  );
};

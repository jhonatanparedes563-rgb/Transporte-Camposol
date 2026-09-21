import React, { useEffect, useRef, useState } from 'react';
import { Bus, Sparkles, ArrowRight, ShieldCheck } from 'lucide-react';
import { AppUser } from '../types';

interface WelcomeSplashScreenProps {
  currentUser?: AppUser | null;
  onFinish: () => void;
  durationMs?: number;
}

export const WelcomeSplashScreen: React.FC<WelcomeSplashScreenProps> = ({
  currentUser,
  onFinish,
  durationMs = 1800,
}) => {
  const [isClosing, setIsClosing] = useState(false);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  const handleDismiss = () => {
    if (isClosing) return;
    setIsClosing(true);
    setTimeout(() => {
      onFinishRef.current();
    }, 280);
  };

  useEffect(() => {
    // Single robust timer that never loops or resets on parent re-renders
    const timer = setTimeout(() => {
      handleDismiss();
    }, durationMs);

    return () => clearTimeout(timer);
  }, [durationMs]);

  const userName = currentUser?.nombre || 'Solicitante';
  const userFundo = currentUser?.fundo || 'Operaciones Agrícolas';
  const userArea = currentUser?.area || 'Producción';

  return (
    <div
      id="welcome-splash-screen"
      onClick={handleDismiss}
      className={`fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-b from-[#004D25] via-[#006A33] to-[#00843D] text-white select-none transition-opacity duration-300 ${
        isClosing ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Background ambient lighting (hardware-accelerated, no heavy blurs) */}
      <div className="absolute inset-0 pointer-events-none opacity-25 bg-[radial-gradient(circle_at_50%_35%,#FFC72C_0%,transparent_60%)]" />

      {/* Main Content Container */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 w-full max-w-sm px-6 py-6 flex flex-col items-center text-center animate-fade-in"
      >
        {/* Animated Brand Emblem */}
        <div className="relative mb-5 transform transition-transform hover:scale-105">
          {/* Subtle Golden ring glow */}
          <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full overflow-hidden p-1 bg-white/10 border-2 border-[#B89F67] shadow-xl relative z-10 flex items-center justify-center">
            <img
              src="/camposol-emblem.svg"
              alt="CAMPOSOL"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover rounded-full"
            />
          </div>

          {/* Golden Badge floating tag */}
          <div className="absolute -bottom-1.5 -right-1.5 bg-gradient-to-r from-[#FFC72C] to-[#F8A51D] text-[#004D25] px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase shadow-md flex items-center gap-1 border border-white/60">
            <Sparkles className="w-3 h-3 text-[#004D25]" />
            <span>OFICIAL</span>
          </div>
        </div>

        {/* Welcome Typography Sequence */}
        <div className="space-y-1 mb-5">
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-white/15 border border-white/20 text-emerald-100 text-[11px] font-bold tracking-widest uppercase mb-1">
            <Bus className="w-3 h-3 text-[#FFC72C]" />
            <span>Sistema de Transporte</span>
          </div>

          <h1 className="text-2xl font-black tracking-tight text-white leading-tight">
            ¡Bienvenido a{' '}
            <span className="text-[#FFC72C] drop-shadow-sm block">TDP CAMPOSOL!</span>
          </h1>

          <p className="text-xs text-emerald-100/90 font-medium max-w-[260px] mx-auto">
            Gestión inteligente de transporte para personal agrícola
          </p>
        </div>

        {/* Connected User Pill */}
        <div className="w-full bg-white/10 border border-white/20 rounded-2xl p-3 mb-5 text-left shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-[#FFC72C] shrink-0 border border-white/30">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="truncate">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-200 block">
                  Solicitante Conectado
                </span>
                <span className="text-sm font-black text-white truncate block">
                  {userName}
                </span>
              </div>
            </div>

            <div className="text-right shrink-0 pl-2">
              <span className="text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-md bg-[#84BD00]/30 text-lime-200 border border-[#84BD00]/50 block">
                {userArea}
              </span>
              <span className="text-[10px] font-medium text-emerald-200/80 block mt-0.5 truncate max-w-[90px]">
                {userFundo}
              </span>
            </div>
          </div>
        </div>

        {/* Pure CSS Hardware-Accelerated Progress Bar (Zero React re-renders) */}
        <div className="w-full space-y-2 mb-5">
          <div className="relative w-full h-4 flex items-center">
            {/* Dashed Road Line */}
            <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#84BD00] to-[#FFC72C]"
                style={{
                  width: '100%',
                  animation: `camposolProgress ${durationMs}ms linear forwards`,
                }}
              />
            </div>

            {/* Traveling Bus */}
            <div
              className="absolute -top-1 transform -translate-x-1/2 text-[#FFC72C]"
              style={{
                animation: `camposolBusTravel ${durationMs}ms linear forwards`,
              }}
            >
              <div className="w-5 h-5 rounded-full bg-[#004D25] border border-[#FFC72C] flex items-center justify-center shadow-md">
                <Bus className="w-3 h-3 text-[#FFC72C]" />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] font-bold text-emerald-200">
            <span>Cargando sistema...</span>
            <span className="text-[#FFC72C] text-[10px] uppercase font-bold tracking-wider">Listo</span>
          </div>
        </div>

        {/* Skip button for instant entry */}
        <button
          id="btn-skip-welcome-splash"
          type="button"
          onClick={handleDismiss}
          className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-white/20 hover:bg-white/30 active:scale-95 text-white text-xs font-black uppercase tracking-wider border border-white/30 transition-all cursor-pointer shadow-md"
        >
          <span>Ingresar Ahora</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Footer copyright note */}
      <div className="absolute bottom-3 text-center text-[10px] text-emerald-200/70 font-semibold tracking-wide">
        CAMPOSOL S.A. • Gerencia de Operaciones Agrícolas
      </div>

      {/* Keyframe Styles injected directly for smooth 60fps CSS animation */}
      <style>{`
        @keyframes camposolProgress {
          0% { width: 0%; }
          100% { width: 100%; }
        }
        @keyframes camposolBusTravel {
          0% { left: 4%; }
          100% { left: 96%; }
        }
      `}</style>
    </div>
  );
};

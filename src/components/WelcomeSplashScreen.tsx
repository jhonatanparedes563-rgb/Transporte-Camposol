import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bus, Sparkles, ArrowRight, ShieldCheck, MapPin } from 'lucide-react';
import { AppUser } from '../types';

interface WelcomeSplashScreenProps {
  currentUser?: AppUser | null;
  onFinish: () => void;
  durationMs?: number;
}

export const WelcomeSplashScreen: React.FC<WelcomeSplashScreenProps> = ({
  currentUser,
  onFinish,
  durationMs = 2800,
}) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const currentProgress = Math.min(100, Math.round((elapsed / durationMs) * 100));
      setProgress(currentProgress);

      if (elapsed >= durationMs) {
        clearInterval(interval);
        onFinish();
      }
    }, 30);

    return () => clearInterval(interval);
  }, [durationMs, onFinish]);

  const userName = currentUser?.nombre || 'Solicitante';
  const userFundo = currentUser?.fundo || 'Operaciones Agrícolas';
  const userArea = currentUser?.area || 'Producción';

  return (
    <div
      id="welcome-splash-screen"
      className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-b from-[#004D25] via-[#006A33] to-[#00843D] text-white overflow-hidden select-none"
    >
      {/* Dynamic Background Rays & Ambient Glow */}
      <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(circle_at_50%_40%,#FFC72C_0%,transparent_65%)]" />
      <div className="absolute -top-32 -left-32 w-80 h-80 rounded-full bg-[#84BD00]/15 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-[#FFC72C]/15 blur-3xl pointer-events-none" />

      {/* Main Content Container */}
      <div className="relative z-10 w-full max-w-sm px-6 py-8 flex flex-col items-center text-center">
        {/* Animated Brand Emblem */}
        <motion.div
          initial={{ scale: 0.4, opacity: 0, y: -20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{
            type: 'spring',
            stiffness: 260,
            damping: 20,
            duration: 0.8,
          }}
          className="relative mb-6"
        >
          {/* Pulsing Aura Rings */}
          <motion.div
            animate={{ scale: [1, 1.25, 1], opacity: [0.35, 0.05, 0.35] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -inset-4 rounded-full bg-gradient-to-r from-[#FFC72C] to-[#84BD00] blur-xl"
          />

          <motion.div
            animate={{ rotate: [0, 3, -3, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            className="w-32 h-32 sm:w-36 sm:h-36 rounded-full overflow-hidden p-1 bg-white/10 backdrop-blur-md border-2 border-[#B89F67] shadow-2xl relative z-10 flex items-center justify-center"
          >
            <img
              src="/camposol-emblem.svg"
              alt="CAMPOSOL"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover rounded-full drop-shadow-md"
            />
          </motion.div>

          {/* Golden Badge floating tag */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.4, type: 'spring' }}
            className="absolute -bottom-2 -right-2 bg-gradient-to-r from-[#FFC72C] to-[#F8A51D] text-[#004D25] px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase shadow-md flex items-center gap-1 border border-white/60"
          >
            <Sparkles className="w-3 h-3 text-[#004D25]" />
            <span>OFICIAL</span>
          </motion.div>
        </motion.div>

        {/* Welcome Typography Sequence */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="space-y-1.5 mb-6"
        >
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 text-emerald-100 text-xs font-bold tracking-widest uppercase mb-1">
            <Bus className="w-3.5 h-3.5 text-[#FFC72C]" />
            <span>Sistema de Transporte</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white leading-tight">
            ¡Bienvenido a{' '}
            <span className="text-[#FFC72C] drop-shadow-sm block">TDP CAMPOSOL!</span>
          </h1>

          <p className="text-xs sm:text-sm text-emerald-100/90 font-medium max-w-[260px] mx-auto">
            Gestión inteligente de transporte para personal agrícola
          </p>
        </motion.div>

        {/* Connected User Pill (Just like in the screenshot) */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="w-full bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-3 mb-6 text-left shadow-lg"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-[#FFC72C] shrink-0 border border-white/30">
                <ShieldCheck className="w-5 h-5" />
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
              <span className="text-[10px] font-medium text-emerald-200/80 block mt-0.5 truncate max-w-[100px]">
                {userFundo}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Progress bar & Bus animation */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="w-full space-y-2 mb-6"
        >
          {/* Animated road track with moving bus */}
          <div className="relative w-full h-5 flex items-center">
            {/* Dashed Road Line */}
            <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#84BD00] to-[#FFC72C] transition-all duration-100 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* Traveling Bus Icon */}
            <div
              className="absolute -top-1.5 transform -translate-x-1/2 transition-all duration-100 ease-out text-[#FFC72C]"
              style={{ left: `${Math.max(6, Math.min(94, progress))}%` }}
            >
              <div className="w-6 h-6 rounded-full bg-[#004D25] border border-[#FFC72C] flex items-center justify-center shadow-md">
                <Bus className="w-3.5 h-3.5 text-[#FFC72C]" />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] font-bold text-emerald-200">
            <span>Cargando tus solicitudes...</span>
            <span className="text-[#FFC72C]">{progress}%</span>
          </div>
        </motion.div>

        {/* Skip button for instant entry */}
        <motion.button
          id="btn-skip-welcome-splash"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          onClick={onFinish}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/20 hover:bg-white/30 active:bg-white/40 text-white text-xs font-black uppercase tracking-wider backdrop-blur-md border border-white/30 transition-all cursor-pointer shadow-md group"
        >
          <span>Continuar</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
        </motion.button>
      </div>

      {/* Footer copyright note */}
      <div className="absolute bottom-4 text-center text-[10px] text-emerald-200/70 font-semibold tracking-wide">
        CAMPOSOL S.A. • Gerencia de Operaciones Agrícolas
      </div>
    </div>
  );
};

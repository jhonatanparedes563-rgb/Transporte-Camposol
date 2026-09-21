import React, { useState } from 'react';
import { Download, X, Smartphone, PlusSquare } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallBanner: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [dismissed, setDismissed] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  if (isInstalled || dismissed) {
    return null;
  }

  if (!isInstallable && !isIOS) {
    return null;
  }

  return (
    <div className="bg-[#E8F5EF] border border-[#00843D]/20 rounded-2xl p-3.5 mx-4 mt-3 mb-1 shadow-xs transition-all">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-[#00843D] text-white flex items-center justify-center shrink-0 shadow-sm">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-[#00843D] uppercase tracking-wide">
              Instalar en Pantalla de Inicio
            </h4>
            <p className="text-xs text-[#173B56] leading-snug">
              Úsalo como una aplicación nativa, rápido y sin conexión.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isInstallable && (
            <button
              id="pwa-banner-install-btn"
              onClick={install}
              className="bg-[#00843D] text-white px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-[#006e33] active:scale-95 transition-all flex items-center gap-1 shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Instalar</span>
            </button>
          )}

          {isIOS && (
            <button
              id="pwa-banner-ios-btn"
              onClick={() => setShowIOSInstructions(true)}
              className="bg-[#00843D] text-white px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-[#006e33] active:scale-95 transition-all flex items-center gap-1 shadow-xs"
            >
              <PlusSquare className="w-3.5 h-3.5" />
              <span>¿Cómo?</span>
            </button>
          )}

          <button
            onClick={() => setDismissed(true)}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
            aria-label="Cerrar sugerencia"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {showIOSInstructions && (
        <div className="mt-2.5 pt-2.5 border-t border-[#00843D]/15 text-xs text-[#173B56]">
          <p className="font-semibold mb-1">Pasos para iPhone / Safari:</p>
          <p>
            1. Toca el botón <strong>Compartir</strong> (abajo en Safari).
            <br />
            2. Selecciona <strong>"Agregar al inicio"</strong>.
          </p>
        </div>
      )}
    </div>
  );
};

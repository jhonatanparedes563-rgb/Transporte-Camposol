import React, { useState } from 'react';
import { Bus, Download, BarChart2, ArrowLeft, WifiOff, Smartphone, MapPin, Database, ShieldCheck, User } from 'lucide-react';
import { usePWAInstall, useOnlineStatus } from '../hooks/usePWAInstall';
import { UserRole } from '../types';

interface HeaderProps {
  currentScreen: 'home' | 'new-request' | 'my-requests' | 'analytics' | 'masters';
  onNavigate: (screen: 'home' | 'new-request' | 'my-requests' | 'analytics' | 'masters') => void;
  onOpenDatabaseModal?: () => void;
  userRole?: UserRole;
  onOpenRoleSwitcher?: () => void;
  title?: string;
  subtitle?: string;
  showBack?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentScreen,
  onNavigate,
  onOpenDatabaseModal,
  userRole = 'admin',
  onOpenRoleSwitcher,
  title = 'CAMPOSOL',
  subtitle = 'Transporte de Personal',
  showBack = false,
}) => {
  const { isInstallable, isIOS, isInstalled, install } = usePWAInstall();
  const isOnline = useOnlineStatus();
  const [showIOSModal, setShowIOSModal] = useState(false);
  const isAdmin = userRole === 'admin';

  return (
    <header className="sticky top-0 z-40 bg-[#00843D] text-white shadow-md">
      {/* Offline banner if offline */}
      {!isOnline && (
        <div className="bg-amber-500 text-white text-xs px-3 py-1 flex items-center justify-center gap-1.5 font-medium">
          <WifiOff className="w-3.5 h-3.5" />
          <span>Modo Sin Conexión — La información se sincronizará localmente</span>
        </div>
      )}

      <div className="w-full px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {showBack ? (
            <button
              id="header-back-btn"
              onClick={() => onNavigate('home')}
              className="p-1.5 -ml-1.5 rounded-lg hover:bg-[#006e33] active:bg-[#005728] transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
              aria-label="Volver al inicio"
            >
              <ArrowLeft className="w-6 h-6 text-white" />
            </button>
          ) : (
            <button
              onClick={() => onNavigate('home')}
              className="flex items-center gap-2.5 text-left focus:outline-none"
            >
              <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm shrink-0 border border-white/20">
                <Bus className="w-6 h-6 text-[#00843D]" />
              </div>
              <div>
                <div className="text-lg font-black tracking-wider leading-none text-white flex items-center gap-1.5">
                  <span>{title}</span>
                  <span className="text-[10px] uppercase font-bold tracking-widest bg-[#E8F5EF] text-[#00843D] px-1.5 py-0.5 rounded-md">
                    APP
                  </span>
                </div>
                <div className="text-xs text-[#E8F5EF] font-medium tracking-tight mt-0.5">
                  {subtitle}
                </div>
              </div>
            </button>
          )}

          {showBack && (
            <div>
              <h1 className="text-base font-bold text-white leading-tight">{title}</h1>
              {subtitle && <p className="text-xs text-[#E8F5EF]">{subtitle}</p>}
            </div>
          )}
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1.5 mx-4">
          <button
            id="nav-desktop-home"
            onClick={() => onNavigate('home')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              currentScreen === 'home'
                ? 'bg-white text-[#00843D] shadow-xs'
                : 'text-white/90 hover:bg-[#006e33]'
            }`}
          >
            Inicio
          </button>
          <button
            id="nav-desktop-new"
            onClick={() => onNavigate('new-request')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              currentScreen === 'new-request'
                ? 'bg-white text-[#00843D] shadow-xs'
                : 'text-white/90 hover:bg-[#006e33]'
            }`}
          >
            Nuevo Requerimiento
          </button>
          <button
            id="nav-desktop-requests"
            onClick={() => onNavigate('my-requests')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              currentScreen === 'my-requests'
                ? 'bg-white text-[#00843D] shadow-xs'
                : 'text-white/90 hover:bg-[#006e33]'
            }`}
          >
            {isAdmin ? 'Bandeja de Recepción' : 'Mis Requerimientos'}
          </button>
          {isAdmin && (
            <>
              <button
                id="nav-desktop-masters"
                onClick={() => onNavigate('masters')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  currentScreen === 'masters'
                    ? 'bg-white text-[#00843D] shadow-xs'
                    : 'text-white/90 hover:bg-[#006e33]'
                }`}
              >
                Datos Maestros
              </button>
              <button
                id="nav-desktop-analytics"
                onClick={() => onNavigate('analytics')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  currentScreen === 'analytics'
                    ? 'bg-white text-[#00843D] shadow-xs'
                    : 'text-white/90 hover:bg-[#006e33]'
                }`}
              >
                Reportes / Power BI
              </button>
            </>
          )}
        </nav>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          {/* PWA Install Button if available */}
          {!isInstalled && isInstallable && (
            <button
              id="pwa-install-header-btn"
              onClick={install}
              className="flex items-center gap-1 bg-white text-[#00843D] px-2.5 py-1.5 rounded-lg text-xs font-bold shadow hover:bg-emerald-50 active:scale-95 transition-all"
              title="Instalar en celular"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Instalar</span>
            </button>
          )}

          {!isInstalled && isIOS && (
            <button
              id="pwa-install-ios-header-btn"
              onClick={() => setShowIOSModal(true)}
              className="flex items-center gap-1 bg-white/20 text-white hover:bg-white/30 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all"
              title="Instalar en iPhone"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Instalar</span>
            </button>
          )}

          {/* Role Switcher Indicator Button */}
          {onOpenRoleSwitcher && (
            <button
              id="header-role-switcher-btn"
              onClick={onOpenRoleSwitcher}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-black transition-all border ${
                isAdmin
                  ? 'bg-[#173B56] text-white border-white/20 hover:bg-[#122e43] shadow-xs'
                  : 'bg-white text-[#00843D] border-white/40 hover:bg-emerald-50 shadow-xs'
              }`}
              title="Cambiar entre modo Usuario y Administrador"
            >
              {isAdmin ? (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[11px] uppercase tracking-wide">Admin</span>
                </>
              ) : (
                <>
                  <User className="w-3.5 h-3.5 text-[#00843D]" />
                  <span className="text-[11px] uppercase tracking-wide">Usuario</span>
                </>
              )}
            </button>
          )}

          {/* Admin Only Actions: Maestros, Power BI, Base de Datos */}
          {isAdmin && (
            <>
              {/* Mis Maestros Button */}
              <button
                id="nav-masters-btn"
                onClick={() => onNavigate(currentScreen === 'masters' ? 'home' : 'masters')}
                className={`p-2 rounded-lg transition-colors flex items-center gap-1 text-xs font-medium ${
                  currentScreen === 'masters'
                    ? 'bg-white text-[#00843D] font-bold shadow-xs'
                    : 'hover:bg-[#006e33] text-white/90'
                }`}
                title="Mis Maestros (Paraderos, Fundos, Áreas)"
              >
                <MapPin className="w-4.5 h-4.5" />
                <span className="hidden sm:inline">Maestros</span>
              </button>

              {/* Power BI / Analítica Button */}
              <button
                id="nav-analytics-btn"
                onClick={() => onNavigate(currentScreen === 'analytics' ? 'home' : 'analytics')}
                className={`p-2 rounded-lg transition-colors flex items-center gap-1 text-xs font-medium ${
                  currentScreen === 'analytics'
                    ? 'bg-white text-[#00843D] font-bold shadow-xs'
                    : 'hover:bg-[#006e33] text-white/90'
                }`}
                title="Analítica y Power BI"
              >
                <BarChart2 className="w-4.5 h-4.5" />
                <span className="hidden sm:inline">Power BI</span>
              </button>

              {/* Base de Datos Button */}
              {onOpenDatabaseModal && (
                <button
                  id="nav-database-btn"
                  onClick={onOpenDatabaseModal}
                  className="p-2 rounded-lg transition-colors flex items-center gap-1 text-xs font-medium hover:bg-[#006e33] text-white/90"
                  title="Base de Datos y Respaldos"
                >
                  <Database className="w-4.5 h-4.5" />
                  <span className="hidden md:inline">BD</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* iOS Safari Installation Guide Modal */}
      {showIOSModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white text-[#173B56] p-5 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-[#E8F5EF] flex items-center justify-center text-[#00843D]">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#173B56]">Instalar en iPhone / iPad</h3>
                <p className="text-xs text-gray-500">Acceso rápido como aplicación móvil</p>
              </div>
            </div>

            <ol className="mt-3 space-y-2.5 text-xs text-gray-700 bg-[#F5F8F7] p-3.5 rounded-xl border border-gray-100">
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-[#00843D] text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  1
                </span>
                <span>
                  Toca el botón <strong>Compartir</strong> (ícono de cuadrado con flecha hacia arriba) en la barra de Safari.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-[#00843D] text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  2
                </span>
                <span>
                  Baja en el menú y selecciona <strong>"Agregar al inicio"</strong>.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-[#00843D] text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  3
                </span>
                <span>
                  Toca <strong>Agregar</strong> en la esquina superior derecha. ¡Listo!
                </span>
              </li>
            </ol>

            <button
              onClick={() => setShowIOSModal(false)}
              className="mt-4 w-full rounded-xl bg-[#00843D] py-2.5 text-sm font-bold text-white hover:bg-[#006e33] active:bg-[#005728] transition-colors"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </header>
  );
};

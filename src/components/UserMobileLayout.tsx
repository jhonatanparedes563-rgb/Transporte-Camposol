import React from 'react';
import { Bus, Home, PlusCircle, ClipboardList, ArrowLeft, LogOut, User } from 'lucide-react';
import { UserHomeScreen } from './UserHomeScreen';
import { NewRequirementWizard } from './NewRequirementWizard';
import { MyRequirementsScreen } from './MyRequirementsScreen';
import { Requerimiento, UserRole, AppUser } from '../types';
import { getPublicAssetUrl } from './CamposolLogo';

interface UserMobileLayoutProps {
  currentScreen: 'home' | 'new-request' | 'my-requests';
  onNavigate: (screen: 'home' | 'new-request' | 'my-requests') => void;
  requerimientos: Requerimiento[];
  onOpenRequirementDetail: (req: Requerimiento) => void;
  onRequirementSaved: (savedReq: Requerimiento) => void;
  onOpenRoleSwitcher?: () => void;
  userRole: UserRole;
  currentUser?: AppUser;
  onLogout?: () => void;
}

export const UserMobileLayout: React.FC<UserMobileLayoutProps> = ({
  currentScreen,
  onNavigate,
  requerimientos,
  onOpenRequirementDetail,
  onRequirementSaved,
  onOpenRoleSwitcher,
  userRole,
  currentUser,
  onLogout,
}) => {
  const totalReqs = requerimientos.length;

  return (
    <div className="min-h-[100dvh] w-full bg-[#EEF3F7] lg:py-4 lg:px-4 flex items-stretch lg:items-center justify-center font-sans antialiased text-[#1B3A57]">
      {/* Mobile App Container: Full-bleed edge-to-edge on phones/tablets, centered frame only on wide desktop */}
      <div className="w-full lg:max-w-lg bg-[#EEF3F7] min-h-[100dvh] h-[100dvh] lg:h-[844px] lg:max-h-[calc(100vh-2rem)] lg:rounded-[32px] lg:shadow-2xl lg:border lg:border-[#D8E2EA] flex flex-col relative overflow-hidden">
        {/* Mobile App Header */}
        <header className="relative z-40 overflow-hidden bg-gradient-to-br from-[#0F7A2E] via-[#1E9834] to-[#52B826] text-white px-4 pt-3.5 pb-6 flex items-center justify-between shrink-0">
          {/* Ondas verdes decorativas de fondo */}
          <svg
            aria-hidden="true"
            viewBox="0 0 400 96"
            preserveAspectRatio="none"
            className="absolute inset-0 w-full h-full pointer-events-none"
          >
            <path
              d="M150,0 C210,40 270,10 340,45 C370,60 390,45 400,35 L400,0 Z"
              fill="#6BCB2F"
              opacity="0.35"
            />
            <path
              d="M220,96 C265,45 315,15 400,5 L400,96 Z"
              fill="#0A6624"
              opacity="0.45"
            />
            <path
              d="M0,78 C95,96 220,92 310,76 C355,68 385,72 400,78 L400,96 L0,96 Z"
              fill="#EEF3F7"
            />
          </svg>

          <div className="relative z-10 flex items-center gap-3 min-w-0">
            {currentScreen !== 'home' ? (
              <button
                id="btn-mobile-back"
                onClick={() => onNavigate('home')}
                className="p-2 -ml-1.5 rounded-full hover:bg-white/15 active:bg-white/25 transition-colors focus:outline-none cursor-pointer shrink-0"
                aria-label="Volver al inicio"
              >
                <ArrowLeft className="w-6 h-6 text-white" />
              </button>
            ) : (
              <div className="w-13 h-13 rounded-full overflow-hidden shadow-md shrink-0 border-2 border-[#FACC15]/85 bg-[#15803D] flex items-center justify-center">
                <img
                  src={getPublicAssetUrl('camposol-emblem.png')}
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (!target.src.includes('.svg')) {
                      target.src = getPublicAssetUrl('camposol-emblem.svg');
                    }
                  }}
                  alt="CAMPOSOL"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <div className="min-w-0 border-l-[1.5px] border-white/75 pl-3 py-0.5">
              <div className="font-extrabold tracking-wide text-[21px] text-white leading-none drop-shadow-2xs">
                CAMPOSOL
              </div>
              <div className="text-[13px] text-white/95 font-semibold leading-tight mt-1 truncate">
                {currentScreen === 'new-request'
                  ? 'Nuevo Requerimiento'
                  : currentScreen === 'my-requests'
                  ? 'Mis Requerimientos'
                  : 'Transporte de Personal'}
              </div>
            </div>
          </div>

          {/* Logout Button */}
          <div className="relative z-10 flex items-center gap-2 shrink-0">
            {onLogout && (
              <button
                id="btn-mobile-logout"
                onClick={onLogout}
                className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 active:scale-95 text-white px-3 py-1.5 rounded-full text-xs font-semibold transition-all border border-white/30 cursor-pointer backdrop-blur-2xs"
                title="Cerrar sesión"
              >
                <LogOut className="w-3.5 h-3.5 text-[#EAF7E4]" />
                <span className="text-[11px] font-semibold text-white">Salir</span>
              </button>
            )}
          </div>
        </header>

        {/* Scrollable Screen Content */}
        <main className="flex-1 overflow-y-auto overscroll-contain w-full">
          {currentScreen === 'home' && (
            <UserHomeScreen
              onNewRequirement={() => onNavigate('new-request')}
              onMyRequirements={() => onNavigate('my-requests')}
              requerimientos={requerimientos}
              onSelectRequirement={onOpenRequirementDetail}
              currentUser={currentUser}
            />
          )}

          {currentScreen === 'new-request' && (
            <div className="p-3 sm:p-4 w-full">
              <NewRequirementWizard
                onCancel={() => onNavigate('home')}
                onSuccess={(saved) => {
                  onRequirementSaved(saved);
                }}
                onViewRequirement={(req) => {
                  onOpenRequirementDetail(req);
                  onNavigate('my-requests');
                }}
                currentUser={currentUser}
              />
            </div>
          )}

          {currentScreen === 'my-requests' && (
            <div className="p-2 sm:p-3 w-full">
              <MyRequirementsScreen
                requerimientos={requerimientos}
                onSelectRequirement={onOpenRequirementDetail}
                onNewRequirement={() => onNavigate('new-request')}
                userRole={userRole}
              />
            </div>
          )}
        </main>

        {/* Sticky Mobile Bottom Navigation Bar (Oculta durante la creación del requerimiento para dar espacio al wizard) */}
        {currentScreen !== 'new-request' && (
          <nav className="sticky bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#E2E8F0] py-1.5 px-4 flex items-center justify-around shadow-lg shrink-0">
            {/* Tab 1: INICIO */}
            <button
              id="nav-mobile-home"
              onClick={() => onNavigate('home')}
              className={`flex flex-col items-center py-1 px-3 rounded-xl transition-all ${
                currentScreen === 'home'
                  ? 'text-[#55A529] font-bold'
                  : 'text-slate-400 hover:text-slate-600 font-medium'
              }`}
            >
              <Home className="w-5 h-5" />
              <span className="text-[10px] mt-0.5 font-bold">Inicio</span>
            </button>

            {/* Tab 2: NUEVO REQUERIMIENTO (Prominent elevated center button) */}
            <button
              id="nav-mobile-new"
              onClick={() => onNavigate('new-request')}
              className="flex flex-col items-center -mt-4 group focus:outline-none"
              aria-label="Crear nuevo requerimiento"
            >
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95 ${
                  currentScreen === 'new-request'
                    ? 'bg-[#1B3A57] text-white ring-4 ring-[#EAF7E4]'
                    : 'bg-[#22A846] text-white group-hover:bg-[#1C8E3A]'
                }`}
              >
                <PlusCircle className="w-7 h-7" />
              </div>
              <span className="text-[10px] mt-1 font-bold text-[#2F7D18]">Nuevo</span>
            </button>

            {/* Tab 3: MIS REQUERIMIENTOS */}
            <button
              id="nav-mobile-requests"
              onClick={() => onNavigate('my-requests')}
              className={`flex flex-col items-center py-1 px-3 rounded-xl transition-all relative ${
                currentScreen === 'my-requests'
                  ? 'text-[#55A529] font-bold'
                  : 'text-slate-400 hover:text-slate-600 font-medium'
              }`}
            >
              <div className="relative">
                <ClipboardList className="w-5 h-5" />
                {totalReqs > 0 && (
                  <span className="absolute -top-1 -right-2 px-1.5 py-0.2 text-[9px] font-bold bg-[#55A529] text-white rounded-full">
                    {totalReqs}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-0.5 font-bold">Mis Solicitudes</span>
            </button>
          </nav>
        )}
      </div>
    </div>
  );
};

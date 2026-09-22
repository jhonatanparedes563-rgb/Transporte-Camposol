import React from 'react';
import { Bus, Home, PlusCircle, ClipboardList, ArrowLeft, LogOut, User } from 'lucide-react';
import { UserHomeScreen } from './UserHomeScreen';
import { NewRequirementWizard } from './NewRequirementWizard';
import { MyRequirementsScreen } from './MyRequirementsScreen';
import { Requerimiento, UserRole, AppUser } from '../types';

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
    <div className="min-h-screen bg-slate-200/70 sm:py-6 sm:px-4 flex items-center justify-center font-sans antialiased text-[#173B56]">
      {/* Centered Mobile Device Frame (Phone container) */}
      <div className="w-full max-w-md bg-[#F5F8F7] min-h-screen sm:min-h-[844px] sm:max-h-[920px] sm:rounded-[38px] sm:shadow-2xl sm:border sm:border-gray-300/80 flex flex-col relative overflow-hidden transform translate-z-0">
        {/* Mobile App Header */}
        <header className="sticky top-0 z-40 bg-[#00843D] text-white px-4 py-3 shadow-md flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            {currentScreen !== 'home' ? (
              <button
                id="btn-mobile-back"
                onClick={() => onNavigate('home')}
                className="p-1.5 -ml-1.5 rounded-xl hover:bg-[#006e33] active:bg-[#005728] transition-colors focus:outline-none cursor-pointer"
                aria-label="Volver al inicio"
              >
                <ArrowLeft className="w-5 h-5 text-white" />
              </button>
            ) : (
              <div className="w-10 h-10 rounded-full overflow-hidden shadow-xs shrink-0 border border-[#B89F67]/60 bg-[#58A33E] flex items-center justify-center">
                <img
                  src="/camposol-emblem.svg"
                  alt="CAMPOSOL"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black tracking-wider text-sm text-white">CAMPOSOL</span>
                <span className="text-[9px] uppercase font-black tracking-widest bg-white/20 text-white px-1.5 py-0.2 rounded-md">
                  SOLICITANTE
                </span>
              </div>
              <div className="text-[11px] text-emerald-100 font-medium">
                {currentScreen === 'new-request'
                  ? 'Nuevo Requerimiento'
                  : currentScreen === 'my-requests'
                  ? 'Mis Requerimientos'
                  : 'Transporte de Personal'}
              </div>
            </div>
          </div>

          {/* User Profile Pill & Logout Button */}
          <div className="flex items-center gap-2">
            {onLogout && (
              <button
                id="btn-mobile-logout"
                onClick={onLogout}
                className="flex items-center gap-1.5 bg-black/20 hover:bg-black/35 active:scale-95 text-white px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all border border-white/15 cursor-pointer"
                title="Cerrar sesión"
              >
                <LogOut className="w-3.5 h-3.5 text-emerald-100" />
                <span className="text-[11px] font-bold text-white">Salir</span>
              </button>
            )}
          </div>
        </header>

        {/* Scrollable Screen Content */}
        <main className="flex-1 overflow-y-auto">
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
            <div className="p-3">
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
            <div className="p-1">
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
          <nav className="sticky bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200/90 py-1.5 px-4 flex items-center justify-around shadow-lg shrink-0">
            {/* Tab 1: INICIO */}
            <button
              id="nav-mobile-home"
              onClick={() => onNavigate('home')}
              className={`flex flex-col items-center py-1 px-3 rounded-xl transition-all ${
                currentScreen === 'home'
                  ? 'text-[#00843D] font-black'
                  : 'text-gray-400 hover:text-gray-600 font-medium'
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
                    ? 'bg-[#173B56] text-white ring-4 ring-emerald-100'
                    : 'bg-[#00843D] text-white group-hover:bg-[#006e33]'
                }`}
              >
                <PlusCircle className="w-7 h-7" />
              </div>
              <span className="text-[10px] mt-1 font-extrabold text-[#00843D]">Nuevo</span>
            </button>

            {/* Tab 3: MIS REQUERIMIENTOS */}
            <button
              id="nav-mobile-requests"
              onClick={() => onNavigate('my-requests')}
              className={`flex flex-col items-center py-1 px-3 rounded-xl transition-all relative ${
                currentScreen === 'my-requests'
                  ? 'text-[#00843D] font-black'
                  : 'text-gray-400 hover:text-gray-600 font-medium'
              }`}
            >
              <div className="relative">
                <ClipboardList className="w-5 h-5" />
                {totalReqs > 0 && (
                  <span className="absolute -top-1 -right-2 px-1.5 py-0.2 text-[9px] font-black bg-[#00843D] text-white rounded-full">
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

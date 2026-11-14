/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { LoginScreen } from './components/LoginScreen';
import { getPublicAssetUrl } from './components/CamposolLogo';
import { Requerimiento, UserRole, AppUser } from './types';
import { getStoredRequerimientos, subscribeToDataChanges } from './services/storageService';
import { getCurrentSession, logoutSession } from './services/authService';

const AdminPortalLayout = lazy(() =>
  import('./components/AdminPortalLayout').then((m) => ({ default: m.AdminPortalLayout }))
);
const UserMobileLayout = lazy(() =>
  import('./components/UserMobileLayout').then((m) => ({ default: m.UserMobileLayout }))
);
const RequirementDetailModal = lazy(() =>
  import('./components/RequirementDetailModal').then((m) => ({ default: m.RequirementDetailModal }))
);
const DatabaseManagementModal = lazy(() =>
  import('./components/DatabaseManagementModal').then((m) => ({ default: m.DatabaseManagementModal }))
);

const AppLoadingScreen: React.FC = () => (
  <div className="min-h-[100dvh] w-full bg-white flex flex-col items-center justify-center gap-3 px-6">
    <img
      src={getPublicAssetUrl('app-icon-192-v4.png')}
      alt="CAMPOSOL TDP Transporte de Personal"
      className="w-24 h-24 object-contain animate-pulse"
    />
  </div>
);

export default function App() {
  // Authentication State: Si no hay sesión activa, pedir usuario y contraseña en LoginScreen
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => {
    return getCurrentSession();
  });

  const [currentScreen, setCurrentScreen] = useState<'home' | 'new-request' | 'my-requests'>('home');
  const [requerimientos, setRequerimientos] = useState<Requerimiento[]>([]);
  const [selectedRequirement, setSelectedRequirement] = useState<Requerimiento | null>(null);
  const [isDatabaseModalOpen, setIsDatabaseModalOpen] = useState(false);

  // Active Role is strictly bound to the authenticated user's assigned role
  const userRole: UserRole = currentUser?.rol || 'usuario';

  // Load persistent requirements data
  const loadData = () => {
    const list = getStoredRequerimientos();
    setRequerimientos(list);
  };

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeToDataChanges(() => {
      loadData();
    });
    return () => {
      unsubscribe();
    };
  }, []);

  // Prefetch ligero de la vista móvil en segundo plano mientras el usuario inicia sesión
  useEffect(() => {
    if (!currentUser) {
      const timer = window.setTimeout(() => {
        import('./components/UserMobileLayout').catch(() => {});
      }, 250);
      return () => window.clearTimeout(timer);
    }
  }, [currentUser]);

  const handleLoginSuccess = (user: AppUser) => {
    setCurrentUser(user);
    setCurrentScreen('home');
    loadData();
  };

  const handleLogout = () => {
    logoutSession();
    setCurrentUser(null);
    setCurrentScreen('home');
    setSelectedRequirement(null);
  };

  const handleRequirementSaved = (newReq: Requerimiento) => {
    loadData();
  };

  const handleOpenDetail = (req: Requerimiento) => {
    setSelectedRequirement(req);
  };

  const handleCloseDetail = () => {
    setSelectedRequirement(null);
    loadData();
  };

  // Data isolation: If role is USUARIO, they ONLY see their own requirements
  const visibleRequerimientos = useMemo(() => {
    if (!currentUser) return [];
    if (userRole === 'usuario') {
      return requerimientos.filter((r) => {
        // Match by userId, username handle, or full name
        const matchUserId = r.userId && r.userId === currentUser.id;
        const matchUsername = r.userUsername && r.userUsername.toLowerCase() === currentUser.usuario.toLowerCase();
        const matchNombre = r.usuario && r.usuario.toLowerCase() === currentUser.nombre.toLowerCase();
        return matchUserId || matchUsername || matchNombre;
      });
    }
    // RECEPTOR and ADMINISTRADOR can view all operational requirements
    return requerimientos;
  }, [requerimientos, currentUser, userRole]);

  // If no user is authenticated, enforce login screen (cannot enter without login)
  if (!currentUser) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  // Check if role is desktop-oriented (admin or receptor)
  const isDesktopRole = userRole === 'admin' || userRole === 'receptor';

  return (
    <div className="w-full min-h-screen bg-[#F3F4F6] font-sans antialiased selection:bg-[#00843D] selection:text-white">
      <Suspense fallback={<AppLoadingScreen />}>
        {/* ------------------------------------------------------------- */}
        {/* 1. VISTA ADMINISTRADOR / RECEPTOR: SISTEMA WEB DE ESCRITORIO   */}
        {/* ------------------------------------------------------------- */}
        {isDesktopRole ? (
          <AdminPortalLayout
            requerimientos={visibleRequerimientos}
            onRefreshData={loadData}
            onOpenRequirementDetail={handleOpenDetail}
            onOpenDatabaseModal={() => setIsDatabaseModalOpen(true)}
            userRole={userRole}
            currentUser={currentUser}
            onLogout={handleLogout}
          />
        ) : (
          /* ----------------------------------------------------------- */
          /* 2. VISTA USUARIO (SOLICITANTE): DISEÑO TIPO APP MÓVIL       */
          /* ----------------------------------------------------------- */
          <UserMobileLayout
            currentScreen={currentScreen}
            onNavigate={(screen) => setCurrentScreen(screen)}
            requerimientos={visibleRequerimientos}
            onOpenRequirementDetail={handleOpenDetail}
            onRequirementSaved={handleRequirementSaved}
            userRole={userRole}
            currentUser={currentUser}
            onLogout={handleLogout}
          />
        )}

        {/* ------------------------------------------------------------- */}
        {/* SHARED MODALS (Requirement Detail, Database Management)        */}
        {/* ------------------------------------------------------------- */}
        {selectedRequirement && (
          <RequirementDetailModal
            requerimiento={selectedRequirement}
            onClose={handleCloseDetail}
            onStatusChange={loadData}
            onDelete={loadData}
            userRole={userRole}
          />
        )}

        {isDatabaseModalOpen && userRole === 'admin' && (
          <DatabaseManagementModal
            isOpen={true}
            onClose={() => setIsDatabaseModalOpen(false)}
            onDataImported={loadData}
          />
        )}
      </Suspense>
    </div>
  );
}

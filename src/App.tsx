/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { RequirementDetailModal } from './components/RequirementDetailModal';
import { DatabaseManagementModal } from './components/DatabaseManagementModal';
import { AdminPortalLayout } from './components/AdminPortalLayout';
import { UserMobileLayout } from './components/UserMobileLayout';
import { LoginScreen } from './components/LoginScreen';
import { WelcomeSplashScreen } from './components/WelcomeSplashScreen';
import { Requerimiento, UserRole, AppUser } from './types';
import { getStoredRequerimientos, subscribeToDataChanges } from './services/storageService';
import { getCurrentSession, logoutSession, restoreMainAdminUser } from './services/authService';

export default function App() {
  // Authentication State: Si no hay sesión activa, el usuario debe autenticarse en LoginScreen
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => {
    return getCurrentSession();
  });

  // Animación de bienvenida con logo Camposol antes de ingresar a la pantalla principal
  const [showWelcomeSplash, setShowWelcomeSplash] = useState<boolean>(() => {
    return Boolean(getCurrentSession());
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

  const handleLoginSuccess = (user: AppUser) => {
    setCurrentUser(user);
    setShowWelcomeSplash(true);
    setCurrentScreen('home');
    loadData();
  };

  const handleLogout = () => {
    logoutSession();
    setCurrentUser(null);
    setShowWelcomeSplash(true);
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

  // Animación oficial de bienvenida antes de entrar a la pantalla principal
  if (showWelcomeSplash) {
    return (
      <WelcomeSplashScreen
        currentUser={currentUser}
        onFinish={() => setShowWelcomeSplash(false)}
      />
    );
  }

  // Check if role is desktop-oriented (admin or receptor)
  const isDesktopRole = userRole === 'admin' || userRole === 'receptor';

  return (
    <div className="w-full min-h-screen bg-[#F3F4F6] font-sans antialiased selection:bg-[#00843D] selection:text-white">
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
          onShowWelcomeSplash={() => setShowWelcomeSplash(true)}
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

      <DatabaseManagementModal
        isOpen={isDatabaseModalOpen && userRole === 'admin'}
        onClose={() => setIsDatabaseModalOpen(false)}
        onDataImported={loadData}
      />
    </div>
  );
}

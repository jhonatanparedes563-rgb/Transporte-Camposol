/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { RefreshCw, LogIn, X, WifiOff } from 'lucide-react';
import { LoginScreen } from './components/LoginScreen';
import { UserMobileLayout } from './components/UserMobileLayout';
import { Requerimiento, UserRole, AppUser } from './types';
import {
  getStoredRequerimientos,
  subscribeToDataChanges,
  syncWithServerDetailed,
  getCloudSyncStatus,
  isHostedExpressOrigin,
} from './services/storageService';
import {
  getCurrentSession,
  logoutSession,
  verifySessionWithServer,
  clearActiveSession,
} from './services/authService';

const AdminPortalLayout = lazy(() =>
  import('./components/AdminPortalLayout').then((m) => ({ default: m.AdminPortalLayout }))
);
const RequirementDetailModal = lazy(() =>
  import('./components/RequirementDetailModal').then((m) => ({ default: m.RequirementDetailModal }))
);
const DatabaseManagementModal = lazy(() =>
  import('./components/DatabaseManagementModal').then((m) => ({ default: m.DatabaseManagementModal }))
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
  const [syncAlert, setSyncAlert] = useState<{
    kind: 'cookie_check' | 'network';
    message: string;
  } | null>(null);
  const [isRetryingAlert, setIsRetryingAlert] = useState(false);

  // Active Role is strictly bound to the authenticated user's assigned role
  const userRole: UserRole = currentUser?.rol || 'usuario';

  // Load persistent requirements data
  const loadData = useCallback(() => {
    const list = getStoredRequerimientos();
    setRequerimientos(list);
  }, []);

  const handleCookieCheckRequired = useCallback(() => {
    try {
      const lastTs = Number(sessionStorage.getItem('camposol_cookie_reload_ts') || '0');
      if (!lastTs || Date.now() - lastTs > 30_000) {
        sessionStorage.setItem('camposol_cookie_reload_ts', String(Date.now()));
        window.location.reload();
        return;
      }
    } catch {
      // ignore storage errors
    }
    setSyncAlert({
      kind: 'cookie_check',
      message: 'La autorización del navegador venció. Recargue la página para activar el envío en línea.',
    });
  }, []);

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeToDataChanges(() => {
      loadData();
      const st = getCloudSyncStatus();
      if (st.isOnline && (st.hasServerSession || st.firebaseConnected)) {
        setSyncAlert(null);
      }
    });

    const handleSessionInvalidated = () => {
      setCurrentUser(null);
      setSelectedRequirement(null);
      setSyncAlert(null);
    };
    window.addEventListener('camposol_session_invalidated', handleSessionInvalidated);
    window.addEventListener('camposol_cookie_check_required', handleCookieCheckRequired);

    if (getCurrentSession()) {
      verifySessionWithServer().then(async (verifiedUser) => {
        if (!verifiedUser) {
          setCurrentUser(null);
          return;
        }
        setCurrentUser(verifiedUser);
        const syncRes = await syncWithServerDetailed(true);
        loadData();
        if (syncRes.ok) {
          setSyncAlert(null);
          return;
        }
        const st = getCloudSyncStatus();
        if (
          syncRes.reason === 'session_expired' &&
          isHostedExpressOrigin() &&
          !st.firebaseConnected &&
          typeof navigator !== 'undefined' &&
          navigator.onLine
        ) {
          clearActiveSession();
          setCurrentUser(null);
        } else if (syncRes.reason === 'cookie_check') {
          handleCookieCheckRequired();
        }
      });
    }

    return () => {
      unsubscribe();
      window.removeEventListener('camposol_session_invalidated', handleSessionInvalidated);
      window.removeEventListener('camposol_cookie_check_required', handleCookieCheckRequired);
    };
  }, [loadData, handleCookieCheckRequired]);

  const handleLoginSuccess = (user: AppUser) => {
    setSyncAlert(null);
    setCurrentUser(user);
    setCurrentScreen('home');
    loadData();
    syncWithServerDetailed(true).then((res) => {
      loadData();
      if (res.ok) {
        setSyncAlert(null);
      } else if (res.reason === 'cookie_check') {
        handleCookieCheckRequired();
      }
    });
  };

  const handleRetryBannerSync = async () => {
    if (syncAlert?.kind === 'cookie_check') {
      window.location.reload();
      return;
    }
    setIsRetryingAlert(true);
    try {
      const res = await syncWithServerDetailed(true);
      loadData();
      if (res.ok) {
        setSyncAlert(null);
      } else if (res.reason === 'cookie_check') {
        handleCookieCheckRequired();
      } else if (res.reason === 'session_expired' || res.reason === 'no_session') {
        clearActiveSession();
        setCurrentUser(null);
      }
    } finally {
      setIsRetryingAlert(false);
    }
  };

  const handleForceReloginFromBanner = () => {
    clearActiveSession();
    setCurrentUser(null);
    setSyncAlert(null);
  };

  const handleLogout = () => {
    logoutSession();
    setCurrentUser(null);
    setCurrentScreen('home');
    setSelectedRequirement(null);
    setSyncAlert(null);
  };

  const handleRequirementSaved = (_newReq: Requerimiento) => {
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

  const syncBannerElement = syncAlert ? (
    <div
      role="status"
      className="sticky top-0 z-50 w-full bg-amber-50 border-b border-amber-200 px-3 py-2 text-xs text-amber-950 flex flex-wrap items-center justify-between gap-2 shadow-2xs"
    >
      <div className="flex items-center gap-2 min-w-0">
        <WifiOff className="w-4 h-4 text-amber-700 shrink-0" />
        <span className="font-semibold leading-snug">{syncAlert.message}</span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={handleRetryBannerSync}
          disabled={isRetryingAlert}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white hover:bg-amber-100 border border-amber-300 text-amber-900 font-bold text-[11px] transition-colors disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`w-3 h-3 ${isRetryingAlert ? 'animate-spin' : ''}`} />
          <span>{syncAlert.kind === 'cookie_check' ? 'Recargar página' : 'Reintentar'}</span>
        </button>
        {currentUser && (
          <button
            type="button"
            onClick={handleForceReloginFromBanner}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#1B3A57] hover:bg-[#142c42] text-white font-bold text-[11px] transition-colors cursor-pointer"
          >
            <LogIn className="w-3 h-3" />
            <span>Iniciar sesión</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => setSyncAlert(null)}
          aria-label="Cerrar aviso"
          className="p-1 text-amber-700 hover:text-amber-950 rounded-full hover:bg-amber-100 cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  ) : null;

  // If no user is authenticated, enforce login screen (cannot enter without login)
  if (!currentUser) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  // Check if role is desktop-oriented (admin or receptor)
  const isDesktopRole = userRole === 'admin' || userRole === 'receptor';

  return (
    <div className="w-full min-h-screen bg-[#F3F4F6] font-sans antialiased selection:bg-[#00843D] selection:text-white">
      {syncBannerElement}
      {/* ------------------------------------------------------------- */}
      {/* 1. VISTA ADMINISTRADOR / RECEPTOR: SISTEMA WEB DE ESCRITORIO   */}
      {/* ------------------------------------------------------------- */}
      {isDesktopRole ? (
        <Suspense fallback={<div className="min-h-[100dvh] w-full bg-[#F3F4F6]" />}>
          <AdminPortalLayout
            requerimientos={visibleRequerimientos}
            onRefreshData={loadData}
            onOpenRequirementDetail={handleOpenDetail}
            onOpenDatabaseModal={() => setIsDatabaseModalOpen(true)}
            userRole={userRole}
            currentUser={currentUser}
            onLogout={handleLogout}
          />
        </Suspense>
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
        <Suspense fallback={null}>
          <RequirementDetailModal
            requerimiento={selectedRequirement}
            onClose={handleCloseDetail}
            onStatusChange={loadData}
            onDelete={loadData}
            userRole={userRole}
          />
        </Suspense>
      )}

      {isDatabaseModalOpen && userRole === 'admin' && (
        <Suspense fallback={null}>
          <DatabaseManagementModal
            isOpen={true}
            onClose={() => setIsDatabaseModalOpen(false)}
            onDataImported={loadData}
          />
        </Suspense>
      )}
    </div>
  );
}

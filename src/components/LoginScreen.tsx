import React, { useState, useEffect } from 'react';
import {
  Lock,
  User,
  ArrowRight,
  ArrowLeft,
  ShieldAlert,
  Eye,
  EyeOff,
  Mail,
  Send,
  CheckCircle2,
} from 'lucide-react';
import {
  authenticateUser,
  requestPasswordRecovery,
  restoreMainAdminUser,
  setActiveSessionUser,
} from '../services/authService';
import { AppUser } from '../types';
import { getPublicAssetUrl } from './CamposolLogo';
import imgTeam from '../assets/images/camposol_field_team_1794669769552.jpg';
import imgBlueberry from '../assets/images/camposol_blueberry_harvest_1794669770772.jpg';
import imgCitrus from '../assets/images/camposol_citrus_workers_1794669771239.jpg';
import imgPacking from '../assets/images/camposol_packing_plant_1794669771411.jpg';

const REMEMBERED_USER_KEY = 'camposol_tdp_remembered_user';

interface LoginScreenProps {
  onLoginSuccess: (user: AppUser) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  // Modo de vista: 'login' o 'recovery'
  const [viewMode, setViewMode] = useState<'login' | 'recovery'>('login');

  // Estados para Login
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Estados para Recuperación de Contraseña
  const [recoveryIdentifier, setRecoveryIdentifier] = useState('');
  const [isRecoverySubmitting, setIsRecoverySubmitting] = useState(false);
  const [recoveryError, setRecoveryError] = useState('');
  const [recoverySuccess, setRecoverySuccess] = useState(false);
  const [recoveredUser, setRecoveredUser] = useState<AppUser | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBERED_USER_KEY);
      if (saved) {
        setUsername(saved);
        setRememberMe(true);
      }
    } catch {
      // Ignorar errores de almacenamiento local
    }
  }, []);

  // Manejador de Inicio de Sesión
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const cleanUser = username.trim();
    const cleanPass = password.trim();

    if (!cleanUser || !cleanPass) {
      setErrorMessage('Por favor ingrese su usuario y contraseña.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await authenticateUser(cleanUser, cleanPass);
      if (result.success && result.user) {
        try {
          if (rememberMe) {
            localStorage.setItem(REMEMBERED_USER_KEY, cleanUser);
          } else {
            localStorage.removeItem(REMEMBERED_USER_KEY);
          }
        } catch {
          // Ignorar errores de almacenamiento local
        }
        onLoginSuccess(result.user);
      } else {
        setErrorMessage(
          result.error || 'Credenciales incorrectas. Verifique sus datos.'
        );
      }
    } catch (err) {
      console.error('Error al autenticar:', err);
      setErrorMessage('Error al validar credenciales con el sistema.');
    } finally {
      setIsLoading(false);
    }
  };

  // Manejador de Recuperación de Contraseña
  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError('');

    const cleanIdentifier = recoveryIdentifier.trim();
    if (!cleanIdentifier) {
      setRecoveryError('Por favor ingrese su usuario o correo electrónico registrado.');
      return;
    }

    setIsRecoverySubmitting(true);
    try {
      const res = await requestPasswordRecovery(cleanIdentifier);
      if (res.success && res.user) {
        setRecoveredUser(res.user);
        setRecoverySuccess(true);
      } else {
        setRecoveryError(
          res.error || 'No se encontró ningún usuario o correo registrado con esa información.'
        );
      }
    } catch (err) {
      console.error('Error al procesar recuperación:', err);
      setRecoveryError('Error en el servicio de recuperación de contraseñas.');
    } finally {
      setIsRecoverySubmitting(false);
    }
  };

  return (
    <div className="min-h-[100dvh] w-full bg-white md:bg-[#EEF3F7] flex flex-col md:justify-center md:items-center md:p-6 font-sans antialiased text-[#1B3A57]">
      {/* Contenedor Principal: Edge-to-edge en celular, encuadrado elegante en escritorio */}
      <div className="w-full flex-1 md:flex-none md:max-w-[440px] md:min-h-[780px] bg-white md:rounded-[28px] md:shadow-xl md:border md:border-[#E2E8F0] flex flex-col overflow-hidden">
        {/* Mosaico Fotográfico Diagonal CAMPOSOL (~44% de la pantalla en móvil) */}
        <div className="relative w-full h-[44dvh] min-h-[330px] max-h-[410px] md:h-[330px] bg-white overflow-hidden shrink-0">
          {/* Cuadrícula rotada ocupando todo el ancho y alto del mosaico */}
          <div
            aria-hidden="true"
            className="absolute inset-x-[-14%] inset-y-[-14%] grid grid-cols-3 grid-rows-3 gap-3 -rotate-[21deg] pointer-events-none select-none"
          >
            {/* Fila 1 */}
            <div className="overflow-hidden rounded-sm bg-[#EAF7E4] h-full">
              <img
                src={imgBlueberry}
                alt=""
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover object-[50%_22%] rotate-[21deg] scale-[1.28]"
              />
            </div>
            <div className="overflow-hidden rounded-sm bg-[#EAF7E4] h-full">
              <img
                src={imgTeam}
                alt=""
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover object-[50%_28%] rotate-[21deg] scale-[1.26]"
              />
            </div>
            <div className="overflow-hidden rounded-sm bg-[#EAF7E4] h-full">
              <img
                src={imgCitrus}
                alt=""
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover object-[50%_30%] rotate-[21deg] scale-[1.28]"
              />
            </div>

            {/* Fila 2: Celda central blanca limpia para el logo CAMPOSOL */}
            <div className="overflow-hidden rounded-sm bg-[#EAF7E4] h-full">
              <img
                src={imgPacking}
                alt=""
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover object-[58%_35%] rotate-[21deg] scale-[1.32]"
              />
            </div>
            <div className="rounded-sm bg-white h-full" />
            <div className="overflow-hidden rounded-sm bg-[#EAF7E4] h-full">
              <img
                src={imgCitrus}
                alt=""
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover object-[42%_30%] rotate-[21deg] scale-[1.28]"
              />
            </div>

            {/* Fila 3 */}
            <div className="overflow-hidden rounded-sm bg-[#EAF7E4] h-full">
              <img
                src={imgPacking}
                alt=""
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover object-[50%_30%] rotate-[21deg] scale-[1.30]"
              />
            </div>
            <div className="overflow-hidden rounded-sm bg-[#EAF7E4] h-full">
              <img
                src={imgTeam}
                alt=""
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover object-[50%_22%] rotate-[21deg] scale-[1.28]"
              />
            </div>
            <div className="overflow-hidden rounded-sm bg-[#EAF7E4] h-full">
              <img
                src={imgBlueberry}
                alt=""
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover object-[50%_25%] rotate-[21deg] scale-[1.28]"
              />
            </div>
          </div>

          {/* Emblema Central CAMPOSOL integrado limpiamente en el espacio blanco central */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-4">
            <div className="flex flex-col items-center">
              <div className="w-22 h-22 sm:w-24 sm:h-24 rounded-full overflow-hidden bg-[#55A529] flex items-center justify-center shadow-sm ring-4 ring-white">
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
              <span className="mt-1.5 px-2.5 py-0.5 rounded-full bg-white/95 text-[14px] font-extrabold text-[#38A126] tracking-tight whitespace-nowrap shadow-2xs">
                Transporte de Personal
              </span>
            </div>
          </div>

          {/* Corte inferior limpio hacia la superficie del formulario */}
          <div
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-5 bg-gradient-to-t from-white via-white/95 to-transparent pointer-events-none"
          />
        </div>

        {/* Cuerpo del Formulario: centrado proporcionalmente en la mitad inferior */}
        <div className="flex-1 flex flex-col justify-between px-6 pt-3 pb-5 bg-white">
          {/* VISTA: INICIAR SESIÓN */}
          {viewMode === 'login' && (
            <div className="my-auto py-2 space-y-5">
              <div>
                <h1 className="text-[30px] font-extrabold text-[#111827] tracking-tight leading-tight">
                  Bienvenido(a)
                </h1>
                <p className="text-[16px] font-normal text-[#1F2937] mt-1 leading-snug">
                  Inicie sesión en Transporte de Personal
                </p>
              </div>

              {errorMessage && (
                <div
                  id="login-error-box"
                  className="p-3.5 bg-[#FDECEC] border border-[#FECACA] rounded-xl flex items-start gap-2.5 text-xs text-[#DC2626]"
                >
                  <ShieldAlert className="w-4 h-4 text-[#DC2626] shrink-0 mt-0.5" />
                  <div className="font-bold leading-relaxed">{errorMessage}</div>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                {/* Campo: Usuario con etiqueta flotante sobre borde */}
                <div>
                  <div className="relative pt-1.5">
                    <label
                      htmlFor="input-login-username"
                      className="absolute top-0 left-3.5 bg-white px-1.5 text-xs font-medium text-slate-500 z-10"
                    >
                      Usuario
                    </label>
                    <div className="relative flex items-center">
                      <input
                        id="input-login-username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Ingrese su usuario o DNI"
                        autoCapitalize="none"
                        autoCorrect="off"
                        autoComplete="username"
                        required
                        className="w-full pl-4 pr-11 py-4 bg-white border border-[#CBD5E1] rounded-xl text-[15px] font-semibold text-[#111827] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#22A846]/20 focus:border-[#22A846] transition-all"
                      />
                      <User className="w-5 h-5 text-slate-400 absolute right-3.5 pointer-events-none" />
                    </div>
                  </div>
                  <p className="text-[12px] text-slate-500 mt-1.5 pl-1">
                    Ingrese con su usuario asignado o número de DNI
                  </p>
                </div>

                {/* Campo: Contraseña con etiqueta flotante sobre borde */}
                <div className="relative pt-1.5">
                  <label
                    htmlFor="input-login-password"
                    className="absolute top-0 left-3.5 bg-white px-1.5 text-xs font-medium text-slate-500 z-10"
                  >
                    Contraseña
                  </label>
                  <div className="relative flex items-center">
                    <Lock className="w-5 h-5 text-slate-400 absolute left-3.5 pointer-events-none" />
                    <input
                      id="input-login-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Ingrese su contraseña"
                      autoComplete="current-password"
                      required
                      className="w-full pl-11 pr-11 py-4 bg-white border border-[#CBD5E1] rounded-xl text-[15px] font-semibold text-[#111827] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#22A846]/20 focus:border-[#22A846] transition-all"
                    />
                    <button
                      id="btn-toggle-password-icon"
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-1.5 p-2 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                      title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Fila: Recordarme + Olvidé mi contraseña */}
                <div className="flex items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={rememberMe}
                    onClick={() => setRememberMe(!rememberMe)}
                    className="inline-flex items-center gap-2.5 cursor-pointer py-1 focus:outline-none"
                  >
                    <span className="text-[13.5px] font-medium text-[#1F2937]">
                      Recordarme
                    </span>
                    <span
                      className={`w-11 h-6 rounded-full p-0.5 transition-colors flex items-center ${
                        rememberMe ? 'bg-[#22A846] justify-end' : 'bg-[#737373] justify-start'
                      }`}
                    >
                      <span className="w-5 h-5 rounded-full bg-white shadow-xs block" />
                    </span>
                  </button>

                  <button
                    id="btn-forgot-password"
                    type="button"
                    onClick={() => {
                      setErrorMessage('');
                      setRecoveryError('');
                      setRecoverySuccess(false);
                      setRecoveryIdentifier(username.trim());
                      setViewMode('recovery');
                    }}
                    className="text-[13.5px] font-semibold text-[#38A126] hover:underline focus:outline-none cursor-pointer py-1"
                  >
                    Olvidé mi contraseña
                  </button>
                </div>

                {/* Botón Principal: Iniciar sesión */}
                <button
                  id="btn-login-submit"
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-4 px-4 bg-[#22A846] hover:bg-[#1C8E3A] active:scale-[0.99] text-white font-bold rounded-xl text-[15.5px] transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer mt-2 min-h-[52px]"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <span>Iniciar sesión</span>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* VISTA: RECUPERAR CONTRASEÑA */}
          {viewMode === 'recovery' && (
            <div className="space-y-5">
              {!recoverySuccess ? (
                <>
                  <div>
                    <h1 className="text-[24px] font-extrabold text-[#111827] tracking-tight leading-tight">
                      Recuperar contraseña
                    </h1>
                    <p className="text-sm text-slate-600 mt-1 leading-snug">
                      Ingrese su usuario o correo electrónico registrado para solicitar el restablecimiento de su acceso.
                    </p>
                  </div>

                  {recoveryError && (
                    <div
                      id="recovery-error-box"
                      className="p-3.5 bg-[#FDECEC] border border-[#FECACA] rounded-xl flex items-start gap-2.5 text-xs text-[#DC2626]"
                    >
                      <ShieldAlert className="w-4 h-4 text-[#DC2626] shrink-0 mt-0.5" />
                      <div className="font-bold leading-relaxed">{recoveryError}</div>
                    </div>
                  )}

                  <form onSubmit={handleRecoverySubmit} className="space-y-4">
                    <div className="relative pt-1.5">
                      <label
                        htmlFor="input-recovery-identifier"
                        className="absolute top-0 left-3.5 bg-white px-1.5 text-xs font-medium text-slate-500 z-10"
                      >
                        Usuario o correo institucional
                      </label>
                      <div className="relative flex items-center">
                        <Mail className="w-5 h-5 text-slate-400 absolute left-3.5 pointer-events-none" />
                        <input
                          id="input-recovery-identifier"
                          type="text"
                          value={recoveryIdentifier}
                          onChange={(e) => setRecoveryIdentifier(e.target.value)}
                          placeholder="Ej: jperez o jperez@camposol.com.pe"
                          autoCapitalize="none"
                          autoCorrect="off"
                          required
                          className="w-full pl-11 pr-4 py-3.5 bg-white border border-[#CBD5E1] rounded-xl text-[14.5px] font-semibold text-[#111827] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#22A846]/20 focus:border-[#22A846] transition-all"
                        />
                      </div>
                    </div>

                    <button
                      id="btn-send-recovery"
                      type="submit"
                      disabled={isRecoverySubmitting}
                      className="w-full py-3.5 px-4 bg-[#22A846] hover:bg-[#1C8E3A] active:scale-[0.99] text-white font-bold rounded-xl text-[15px] transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer min-h-[48px]"
                    >
                      {isRecoverySubmitting ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <span>Enviar recuperación</span>
                          <Send className="w-4 h-4" />
                        </>
                      )}
                    </button>

                    <div className="pt-1 text-center">
                      <button
                        id="btn-back-to-login"
                        type="button"
                        onClick={() => {
                          setViewMode('login');
                          setRecoveryError('');
                        }}
                        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-slate-600 hover:text-[#2F7D18] transition-colors cursor-pointer py-2"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Volver al inicio de sesión</span>
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="w-14 h-14 bg-[#EAF7E4] border border-[#C6E9B4] text-[#2F7D18] rounded-2xl flex items-center justify-center mx-auto shadow-2xs">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>

                  <div className="text-center space-y-1">
                    <h2 className="text-lg font-extrabold text-[#111827]">
                      Solicitud enviada
                    </h2>
                    <p className="text-xs text-slate-600 font-medium leading-relaxed">
                      El sistema ha registrado su requerimiento de recuperación de contraseña.
                    </p>
                  </div>

                  {recoveredUser && (
                    <div className="bg-[#F8FAFC] border border-[#E5ECF2] p-3.5 rounded-xl space-y-2 text-xs">
                      <div className="flex items-center justify-between border-b border-[#E5ECF2] pb-1.5">
                        <span className="text-[11px] font-semibold text-slate-500">
                          Trabajador
                        </span>
                        <span className="font-bold text-[#1B3A57]">
                          {recoveredUser.nombre}
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-b border-[#E5ECF2] pb-1.5">
                        <span className="text-[11px] font-semibold text-slate-500">
                          Usuario
                        </span>
                        <span className="font-mono font-bold text-[#2F7D18]">
                          @{recoveredUser.usuario}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-slate-500">
                          Correo Institucional
                        </span>
                        <span className="font-mono text-slate-700 font-bold">
                          {recoveredUser.email || `${recoveredUser.usuario}@camposol.com.pe`}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="p-3 bg-[#EAF7E4] border border-[#C6E9B4] rounded-xl text-left text-xs text-[#1B3A57] leading-relaxed font-medium">
                    Se han enviado las pautas de validación a su correo y se notificó al{' '}
                    <strong>Administrador del Sistema de Transporte</strong>.
                  </div>

                  <button
                    id="btn-login-with-recovered"
                    type="button"
                    onClick={() => {
                      if (recoveredUser) {
                        setActiveSessionUser(recoveredUser);
                        onLoginSuccess(recoveredUser);
                      } else {
                        const admin = restoreMainAdminUser();
                        onLoginSuccess(admin);
                      }
                    }}
                    className="w-full py-3.5 px-4 bg-[#22A846] hover:bg-[#1C8E3A] text-white font-bold rounded-xl text-sm transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Ingresar ahora con esta cuenta</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <button
                    id="btn-confirm-return-login"
                    type="button"
                    onClick={() => {
                      setViewMode('login');
                      setRecoverySuccess(false);
                      setRecoveryIdentifier('');
                      setRecoveryError('');
                    }}
                    className="w-full py-3 px-4 bg-[#F1F5F9] hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Volver a la pantalla de login</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Pie institucional discreto */}
          <div className="text-center pt-5 text-[11px] text-slate-400 font-medium">
            CAMPOSOL S.A. · Sistema de Transporte de Personal
          </div>
        </div>
      </div>
    </div>
  );
};

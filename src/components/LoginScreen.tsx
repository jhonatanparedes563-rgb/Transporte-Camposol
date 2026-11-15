import React, { useState, useEffect } from 'react';
import {
  Bus,
  Lock,
  User,
  ArrowLeft,
  ShieldAlert,
  Eye,
  EyeOff,
  Mail,
  Send,
  CheckCircle2,
  Calendar,
  Route,
  Users,
} from 'lucide-react';
import {
  authenticateUser,
  requestPasswordRecovery,
} from '../services/authService';
import { AppUser } from '../types';
import { getPublicAssetUrl } from './CamposolLogo';
import imgValleyFleetBg from '../assets/images/camposol_valley_fleet_bg_1794672840329.jpg';

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
  const [heroImgFailed, setHeroImgFailed] = useState(false);

  // Estados para Recuperación de Contraseña
  const [recoveryIdentifier, setRecoveryIdentifier] = useState('');
  const [isRecoverySubmitting, setIsRecoverySubmitting] = useState(false);
  const [recoveryError, setRecoveryError] = useState('');
  const [recoverySuccess, setRecoverySuccess] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState('');
  const [honeypot, setHoneypot] = useState('');

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
      const result = await authenticateUser(cleanUser, cleanPass, honeypot);
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
      const res = await requestPasswordRecovery(cleanIdentifier, honeypot);
      if (res.success) {
        setRecoveryMessage(
          res.message ||
            'Si los datos corresponden a una cuenta activa, la solicitud ha sido registrada para atención del Administrador.'
        );
        setRecoverySuccess(true);
      } else {
        setRecoveryError(
          res.error || 'No se pudo procesar la solicitud en este momento.'
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
    <div className="min-h-[100dvh] w-full bg-white lg:bg-[#0F2A1A] relative flex flex-col lg:justify-center font-sans antialiased text-[#1B3A57] overflow-x-hidden">
      {/* FONDO PANORÁMICO COMPLETO EN PC / LAPTOP */}
      <div className="hidden lg:block absolute inset-0 pointer-events-none select-none overflow-hidden">
        {!heroImgFailed ? (
          <img
            src={imgValleyFleetBg}
            alt="Unidades de transporte CAMPOSOL en el valle"
            referrerPolicy="no-referrer"
            onError={() => setHeroImgFailed(true)}
            className="w-full h-full object-cover object-center"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#15803D] via-[#1B5E3A] to-[#0F2A1A]" />
        )}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(90deg,rgba(9,34,18,0.74)_0%,rgba(9,34,18,0.28)_48%,rgba(9,34,18,0.44)_100%)]"
        />
      </div>

      {/* CABECERA PANORÁMICA EN MÓVIL / TABLET (Adaptable a cualquier teléfono y estable al abrir teclado) */}
      <div className="lg:hidden relative w-full h-[clamp(185px,42svh,395px)] shrink-0 overflow-hidden bg-white">
        {!heroImgFailed ? (
          <img
            src={imgValleyFleetBg}
            alt="Unidades de transporte CAMPOSOL en el valle"
            referrerPolicy="no-referrer"
            fetchPriority="high"
            decoding="sync"
            onError={() => setHeroImgFailed(true)}
            className="absolute inset-0 w-full h-full object-cover object-[52%_65%] pointer-events-none select-none"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-[#15803D] to-white flex items-center justify-center opacity-20 pointer-events-none">
            <Bus className="w-32 h-32 text-white" />
          </div>
        )}

        {/* Scrim superior para contraste del logo */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#082412]/70 via-[#082412]/25 to-transparent pointer-events-none"
        />

        {/* Difuminado suave extendido hacia blanco puro */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-28 sm:h-32 bg-[linear-gradient(180deg,rgba(255,255,255,0)_0%,rgba(255,255,255,0.18)_30%,rgba(255,255,255,0.62)_62%,rgba(255,255,255,0.92)_84%,#FFFFFF_100%)] pointer-events-none"
        />

        {/* Lockup oficial CAMPOSOL | Transporte de Personal en el espacio superior */}
        <div className="relative z-10 px-5 pt-[max(1.25rem,env(safe-area-inset-top))] flex items-center gap-3.5">
          <div className="w-14 h-14 sm:w-15 sm:h-15 rounded-2xl overflow-hidden bg-[#04443A] ring-1 ring-white/35 shadow-lg shrink-0 flex items-center justify-center">
            <img
              src={getPublicAssetUrl('app-icon-192-v4.png')}
              onError={(e) => {
                const target = e.currentTarget;
                if (!target.src.includes('512')) {
                  target.src = getPublicAssetUrl('app-icon-512-v4.png');
                }
              }}
              alt="CAMPOSOL TDP Transporte de Personal"
              referrerPolicy="no-referrer"
              decoding="sync"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="min-w-0 border-l-2 border-white/85 pl-3.5 py-0.5">
            <div className="text-[21px] sm:text-[22px] font-extrabold tracking-wide text-white leading-none drop-shadow-sm">
              CAMPOSOL
            </div>
            <div className="text-[12.5px] sm:text-[13px] font-semibold text-[#ECFDF5] leading-tight mt-1 truncate drop-shadow-xs">
              Transporte de Personal
            </div>
          </div>
        </div>
      </div>

      {/* CONTENEDOR PRINCIPAL RESPONSIVO (Móvil + PC / Laptop) */}
      <div className="relative z-20 w-full flex-1 lg:flex-none max-w-6xl mx-auto lg:px-10 lg:py-8 flex flex-col lg:grid lg:grid-cols-12 lg:gap-10 lg:items-center">
        {/* Columna Izquierda (PC / Laptop): Identidad visual de alto impacto */}
        <div className="hidden lg:flex lg:col-span-7 flex-col items-center justify-center text-white pr-4 select-none">
          {/* Lockup superior: Logo grande + CAMPOSOL | Transporte de Personal */}
          <div className="flex items-center gap-5">
            <div className="w-22 h-22 xl:w-26 xl:h-26 rounded-[22px] overflow-hidden bg-[#04443A] ring-2 ring-[#A3E635]/75 shadow-[0_14px_34px_rgba(0,0,0,0.48)] shrink-0 flex items-center justify-center">
              <img
                src={getPublicAssetUrl('app-icon-512-v4.png')}
                onError={(e) => {
                  const target = e.currentTarget;
                  if (!target.src.includes('192')) {
                    target.src = getPublicAssetUrl('app-icon-192-v4.png');
                  }
                }}
                alt="CAMPOSOL TDP Transporte de Personal"
                referrerPolicy="no-referrer"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="border-l-2 border-white/85 pl-5 py-1">
              <div className="text-3xl xl:text-[38px] font-black tracking-tight text-white leading-none drop-shadow-md">
                CAMPOSOL
              </div>
              <div className="text-base xl:text-[19px] font-semibold text-white/95 mt-1.5 tracking-wide drop-shadow-sm">
                Transporte de Personal
              </div>
            </div>
          </div>

          {/* Bloque Hero Central: Titular + Bus Vector + Banner Lima */}
          <div className="mt-7 flex flex-col items-center text-center">
            <div className="flex items-end justify-center gap-3 xl:gap-4">
              <div
                role="heading"
                aria-level={2}
                className="text-3xl xl:text-[40px] font-black italic text-white leading-[1.06] tracking-tight text-right drop-shadow-[0_3px_12px_rgba(0,0,0,0.5)]"
              >
                <div>Gestiona tu</div>
                <div>requerimiento de</div>
              </div>

              {/* Bus corporativo con arco dinámico verde lima */}
              <svg
                viewBox="0 0 180 96"
                className="w-30 xl:w-38 h-auto shrink-0 drop-shadow-[0_6px_14px_rgba(0,0,0,0.4)] -mb-1"
                aria-hidden="true"
              >
                <path
                  d="M12 46 C 32 8, 96 4, 152 24 C 102 14, 42 20, 20 52 Z"
                  fill="#9CF000"
                />
                <circle cx="14" cy="24" r="2.2" fill="#9CF000" />
                <path
                  d="M36 42 C 36 33, 44 28, 58 28 L 148 28 C 160 28, 166 34, 167 45 L 169 68 C 169 74, 164 78, 158 78 L 149 78 A 10 10 0 0 1 129 78 L 70 78 A 10 10 0 0 1 50 78 L 41 78 C 36 78, 34 74, 34 68 Z"
                  fill="#FFFFFF"
                />
                <path
                  d="M44 37 L 136 36 C 143 36, 146 40, 146 47 L 146 57 L 42 57 L 42 41 C 42 38, 43 37, 44 37 Z"
                  fill="#0B2E26"
                />
                <path
                  d="M150 36 L 161 36 C 163 39, 164 44, 164 55 L 150 55 Z"
                  fill="#0B2E26"
                />
                <rect x="72" y="36" width="2.5" height="21" fill="#FFFFFF" opacity="0.7" />
                <rect x="108" y="36" width="2.5" height="21" fill="#FFFFFF" opacity="0.7" />
                <circle cx="60" cy="78" r="8" fill="#0B2E26" stroke="#FFFFFF" strokeWidth="2.5" />
                <circle cx="60" cy="78" r="3" fill="#CBD5E1" />
                <circle cx="139" cy="78" r="8" fill="#0B2E26" stroke="#FFFFFF" strokeWidth="2.5" />
                <circle cx="139" cy="78" r="3" fill="#CBD5E1" />
              </svg>
            </div>

            {/* Banner Verde Lima Destacado */}
            <div className="mt-2.5 px-7 xl:px-9 py-2 xl:py-2.5 rounded-2xl bg-[linear-gradient(180deg,#C8FF38_0%,#8CE600_100%)] border border-[#E5FF94]/90 shadow-[0_12px_28px_rgba(0,0,0,0.38)] -skew-x-6">
              <div className="text-2xl xl:text-[34px] font-black italic tracking-tight text-[#071D0B] leading-none whitespace-nowrap">
                Transporte de Personal
              </div>
            </div>

            {/* Arco sutil inferior */}
            <svg
              viewBox="0 0 260 16"
              className="w-52 xl:w-64 h-3.5 mt-2.5 drop-shadow-xs"
              aria-hidden="true"
            >
              <path
                d="M10 14 Q 130 0 250 14 Q 130 6 10 14 Z"
                fill="#A3E635"
              />
            </svg>
          </div>

          {/* Fila inferior de 3 pasos simples */}
          <div className="mt-7 flex items-center justify-center gap-4 xl:gap-6">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 xl:w-11 xl:h-11 rounded-full bg-[#11421E]/90 border-2 border-[#A3E635] shadow-[0_0_14px_rgba(163,230,53,0.42)] flex items-center justify-center shrink-0">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <div className="text-xs xl:text-[13.5px] font-bold text-white leading-tight drop-shadow-sm">
                Solicita el servicio
              </div>
            </div>

            <div className="w-px h-8 bg-white/35 shrink-0" />

            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 xl:w-11 xl:h-11 rounded-full bg-[#11421E]/90 border-2 border-[#A3E635] shadow-[0_0_14px_rgba(163,230,53,0.42)] flex items-center justify-center shrink-0">
                <Route className="w-5 h-5 text-white" />
              </div>
              <div className="text-xs xl:text-[13.5px] font-bold text-white leading-tight drop-shadow-sm">
                Define recorridos
                <br />y horarios
              </div>
            </div>

            <div className="w-px h-8 bg-white/35 shrink-0" />

            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 xl:w-11 xl:h-11 rounded-full bg-[#11421E]/90 border-2 border-[#A3E635] shadow-[0_0_14px_rgba(163,230,53,0.42)] flex items-center justify-center shrink-0">
                <Users className="w-5 h-5 text-white" />
              </div>
              <div className="text-xs xl:text-[13.5px] font-bold text-white leading-tight drop-shadow-sm">
                Confirma tu
                <br />
                programación
              </div>
            </div>
          </div>
        </div>

        {/* Columna Derecha / Panel Blanco Móvil (Encuadrado, subido hacia el difuminado y uniforme) */}
        <div className="w-full flex-1 lg:flex-none lg:col-span-5 lg:max-w-[440px] lg:justify-self-end flex flex-col">
          <div className="flex-1 lg:flex-none flex flex-col justify-between bg-white lg:rounded-[26px] px-4 sm:px-6 pt-0 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:p-8 lg:shadow-2xl lg:border lg:border-white/80">
            {/* VISTA: INICIAR SESIÓN */}
            {viewMode === 'login' && (
              <div className="-mt-7 lg:mt-0 mb-auto flex flex-col justify-center bg-white rounded-3xl lg:rounded-none border border-slate-200/80 lg:border-0 shadow-[0_10px_30px_-8px_rgba(15,42,26,0.10)] lg:shadow-none px-4.5 sm:px-5 py-4.5 sm:py-5 lg:p-0 gap-3.5 sm:gap-4 lg:gap-5">
                <div>
                  <div
                    role="heading"
                    aria-level={1}
                    className="text-[27px] min-[375px]:text-[30px] lg:text-[32px] font-extrabold text-[#111827] tracking-tight leading-[1.1]"
                  >
                    Bienvenido(a)
                  </div>
                  <div className="text-[14px] min-[375px]:text-[15px] font-normal text-slate-600 mt-1 leading-snug">
                    Inicie sesión en Transporte de Personal
                  </div>
                </div>

                {errorMessage && (
                  <div
                    id="login-error-box"
                    className="p-3 bg-[#FDECEC] border border-[#FECACA] rounded-2xl flex items-start gap-2.5 text-xs text-[#DC2626]"
                  >
                    <ShieldAlert className="w-4 h-4 text-[#DC2626] shrink-0 mt-0.5" />
                    <div className="font-bold leading-relaxed">{errorMessage}</div>
                  </div>
                )}

                <form onSubmit={handleLogin} className="space-y-3.5">
                  {/* Campo trampa invisible anti-bots */}
                  <input
                    type="text"
                    name="hp_guard_field"
                    value={honeypot}
                    onChange={(e) => setHoneypot(e.target.value)}
                    tabIndex={-1}
                    autoComplete="one-time-code"
                    aria-hidden="true"
                    className="sr-only pointer-events-none"
                  />
                  {/* Campo: Usuario ampliado */}
                  <div className="relative pt-2">
                    <label
                      htmlFor="input-login-username"
                      className="absolute top-0 left-4 bg-white px-1.5 text-[13.5px]! font-medium text-slate-500 z-10"
                    >
                      Usuario
                    </label>
                    <div className="relative flex items-center">
                      <input
                        id="input-login-username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Ingrese su usuario"
                        autoCapitalize="none"
                        autoCorrect="off"
                        autoComplete="username"
                        required
                        className="w-full pl-4 pr-12 py-3.5 bg-white border border-[#CBD5E1] rounded-2xl text-[15.5px]! font-semibold text-[#111827] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#22A846]/25 focus:border-[#22A846] transition-all"
                      />
                      <User className="w-5 h-5 text-slate-400 absolute right-4 pointer-events-none" />
                    </div>
                  </div>

                  {/* Campo: Contraseña ampliado */}
                  <div className="relative pt-2">
                    <label
                      htmlFor="input-login-password"
                      className="absolute top-0 left-4 bg-white px-1.5 text-[13.5px]! font-medium text-slate-500 z-10"
                    >
                      Contraseña
                    </label>
                    <div className="relative flex items-center">
                      <Lock className="w-5 h-5 text-slate-400 absolute left-4 pointer-events-none" />
                      <input
                        id="input-login-password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Ingrese su contraseña"
                        autoComplete="current-password"
                        required
                        className="w-full pl-12 pr-12 py-3.5 bg-white border border-[#CBD5E1] rounded-2xl text-[15.5px]! font-semibold text-[#111827] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#22A846]/25 focus:border-[#22A846] transition-all"
                      />
                      <button
                        id="btn-toggle-password-icon"
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2 p-2.5 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                        title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                        aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  {/* Fila: Recordarme + Olvidé mi contraseña */}
                  <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 pt-0.5">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={rememberMe}
                      onClick={() => setRememberMe(!rememberMe)}
                      className="inline-flex items-center gap-2 cursor-pointer py-0.5 focus:outline-none shrink-0"
                    >
                      <span className="text-[13.5px]! min-[375px]:text-[14px]! font-medium text-[#1F2937]">
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
                      className="text-[13.5px]! min-[375px]:text-[14px]! font-semibold text-[#38A126] hover:underline focus:outline-none cursor-pointer py-0.5 whitespace-nowrap"
                    >
                      Olvidé mi contraseña
                    </button>
                  </div>

                  {/* Botón Principal: Iniciar sesión ampliado */}
                  <button
                    id="btn-login-submit"
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3.5 px-5 bg-[#22A846] hover:bg-[#1C8E3A] active:scale-[0.99] text-white font-bold rounded-2xl text-[16px] lg:text-[17px] transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer min-h-[52px]"
                  >
                    {isLoading ? (
                      <div className="w-5.5 h-5.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <span>Iniciar sesión</span>
                    )}
                  </button>
                </form>
              </div>
            )}

            {/* VISTA: RECUPERAR CONTRASEÑA */}
            {viewMode === 'recovery' && (
              <div className="my-auto py-2 space-y-4">
                {!recoverySuccess ? (
                  <>
                    <div>
                      <h1 className="text-[22px] sm:text-[24px] font-extrabold text-[#111827] tracking-tight leading-tight">
                        Recuperar contraseña
                      </h1>
                      <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-snug">
                        Ingrese su usuario o correo electrónico registrado para solicitar el restablecimiento de su acceso.
                      </p>
                    </div>

                    {recoveryError && (
                      <div
                        id="recovery-error-box"
                        className="p-3 bg-[#FDECEC] border border-[#FECACA] rounded-xl flex items-start gap-2.5 text-xs text-[#DC2626]"
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
                        className="w-full py-3.5 px-4 bg-[#22A846] hover:bg-[#1C8E3A] active:scale-[0.99] text-white font-bold rounded-xl text-[15px] transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer min-h-[50px]"
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

                      <div className="text-center">
                        <button
                          id="btn-back-to-login"
                          type="button"
                          onClick={() => {
                            setViewMode('login');
                            setRecoveryError('');
                          }}
                          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-slate-600 hover:text-[#2F7D18] transition-colors cursor-pointer py-1.5"
                        >
                          <ArrowLeft className="w-4 h-4" />
                          <span>Volver al inicio de sesión</span>
                        </button>
                      </div>
                    </form>
                  </>
                ) : (
                  <div className="space-y-4">
                    <div className="w-12 h-12 bg-[#EAF7E4] border border-[#C6E9B4] text-[#2F7D18] rounded-2xl flex items-center justify-center mx-auto shadow-2xs">
                      <CheckCircle2 className="w-7 h-7" />
                    </div>

                    <div className="text-center space-y-1">
                      <h2 className="text-lg font-extrabold text-[#111827]">
                        Solicitud registrada
                      </h2>
                      <p className="text-xs text-slate-600 font-medium leading-relaxed">
                        {recoveryMessage ||
                          'Si los datos corresponden a una cuenta activa de CAMPOSOL, la solicitud fue enviada al Administrador del Sistema de Transporte.'}
                      </p>
                    </div>

                    <div className="p-3 bg-[#EAF7E4] border border-[#C6E9B4] rounded-xl text-left text-xs text-[#1B3A57] leading-relaxed font-medium">
                      Por seguridad corporativa, el restablecimiento de acceso debe ser autorizado por el{' '}
                      <strong>Administrador del Sistema de Transporte</strong>.
                    </div>

                    <button
                      id="btn-confirm-return-login"
                      type="button"
                      onClick={() => {
                        setViewMode('login');
                        setRecoverySuccess(false);
                        setRecoveryIdentifier('');
                        setRecoveryError('');
                        setRecoveryMessage('');
                      }}
                      className="w-full py-3.5 px-4 bg-[#22A846] hover:bg-[#1C8E3A] text-white font-bold rounded-xl text-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Volver al inicio de sesión</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Pie institucional limpio dentro del panel blanco */}
            <div className="pt-3 border-t border-slate-100 text-center text-[11px] text-slate-400 font-medium">
              CAMPOSOL S.A. · Sistema de Transporte de Personal
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

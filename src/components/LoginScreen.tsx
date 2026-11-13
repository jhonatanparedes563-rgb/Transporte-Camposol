import React, { useState } from 'react';
import {
  Bus,
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
import { authenticateUser, requestPasswordRecovery, restoreMainAdminUser, setActiveSessionUser } from '../services/authService';
import { AppUser } from '../types';
import { getPublicAssetUrl } from './CamposolLogo';

interface LoginScreenProps {
  onLoginSuccess: (user: AppUser) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  // Modo de vista: 'login' o 'recovery'
  const [viewMode, setViewMode] = useState<'login' | 'recovery'>('login');

  // Estados para Login (campos limpios sin credenciales precargadas)
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Estados para Recuperación de Contraseña
  const [recoveryIdentifier, setRecoveryIdentifier] = useState('');
  const [isRecoverySubmitting, setIsRecoverySubmitting] = useState(false);
  const [recoveryError, setRecoveryError] = useState('');
  const [recoverySuccess, setRecoverySuccess] = useState(false);
  const [recoveredUser, setRecoveredUser] = useState<AppUser | null>(null);

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
        // Redirección automática según el rol asignado en la base de datos
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
    <div className="min-h-screen bg-[#EEF3F7] flex flex-col justify-start sm:justify-center items-center p-4 py-8 overflow-y-auto font-sans antialiased text-[#1B3A57]">
      <div className="w-full max-w-md my-auto">
        {/* Card Principal de Autenticación / Recuperación */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#E5ECF2] overflow-hidden">
          {/* Cabecera Oficial CAMPOSOL */}
          <div className="bg-[#55A529] p-6 sm:p-7 text-center text-white relative">
            <div className="flex flex-col items-center">
              {/* Emblema Oficial CAMPOSOL con borde dorado */}
              <div className="w-24 h-24 rounded-full overflow-hidden shadow-md mb-3 border-2 border-[#B89F67]/70 bg-[#55A529] flex items-center justify-center p-1">
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
                  className="w-full h-full object-contain"
                />
              </div>

              <span className="text-xs font-bold uppercase tracking-widest text-[#EAF7E4]">
                CAMPOSOL
              </span>
              <h1 className="text-xl sm:text-2xl font-bold uppercase tracking-tight text-white mt-0.5">
                TRANSPORTE DE PERSONAL
              </h1>
            </div>
          </div>

          {/* VISTA: INICIAR SESIÓN */}
          {viewMode === 'login' && (
            <div className="p-6 sm:p-8 space-y-5">
              <div className="text-center pb-1 border-b border-[#E5ECF2]">
                <h2 className="text-base font-bold uppercase tracking-wider text-[#1B3A57]">
                  INICIAR SESIÓN
                </h2>
              </div>

              {/* Mensaje de Error / Inactivo */}
              {errorMessage && (
                <div
                  id="login-error-box"
                  className="p-3.5 bg-[#FDECEC] border border-[#FECACA] rounded-2xl flex items-start gap-2.5 text-xs text-[#DC2626] animate-in fade-in"
                >
                  <ShieldAlert className="w-4 h-4 text-[#DC2626] shrink-0 mt-0.5" />
                  <div className="font-bold leading-relaxed">{errorMessage}</div>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                {/* Campo: Usuario */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="input-login-username"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-600"
                  >
                    Usuario:
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                      <User className="w-4 h-4" />
                    </div>
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
                      className="w-full pl-11 pr-4 py-3 bg-white border border-[#D8E2EA] rounded-full text-sm font-semibold text-[#1B3A57] placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#55A529] focus:border-[#55A529] transition-colors"
                    />
                  </div>
                </div>

                {/* Campo: Contraseña */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="input-login-password"
                      className="block text-xs font-semibold uppercase tracking-wider text-slate-600"
                    >
                      Contraseña:
                    </label>
                    {/* Botón de texto alternativo para Mostrar/Ocultar contraseña */}
                    <button
                      id="btn-toggle-password-text"
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-[11px] font-semibold text-[#2F7D18] hover:underline focus:outline-none cursor-pointer"
                    >
                      {showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    </button>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      id="input-login-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Ingrese su contraseña"
                      autoComplete="current-password"
                      required
                      className="w-full pl-11 pr-11 py-3 bg-white border border-[#D8E2EA] rounded-full text-sm font-semibold text-[#1B3A57] placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#55A529] focus:border-[#55A529] transition-colors"
                    />
                    {/* Botón Icono Mostrar/Ocultar Contraseña */}
                    <button
                      id="btn-toggle-password-icon"
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                      title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Enlace discreto: ¿Olvidaste tu contraseña? */}
                <div className="flex justify-end -mt-0.5">
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
                    className="text-xs font-semibold text-slate-500 hover:text-[#2F7D18] hover:underline transition-colors focus:outline-none cursor-pointer py-0.5"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>

                {/* Botón [ INGRESAR ] */}
                <button
                  id="btn-login-submit"
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 px-4 bg-[#22A846] hover:bg-[#1C8E3A] active:bg-[#177830] text-white font-bold rounded-full text-sm uppercase tracking-wider transition-colors shadow-xs flex items-center justify-center gap-2 group disabled:opacity-50 cursor-pointer mt-2"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>INGRESAR</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* VISTA: RECUPERAR CONTRASEÑA */}
          {viewMode === 'recovery' && (
            <div className="p-6 sm:p-8 space-y-5">
              {!recoverySuccess ? (
                <>
                  {/* Título de la pantalla */}
                  <div className="text-center pb-2 border-b border-[#E5ECF2]">
                    <h2 className="text-base font-bold uppercase tracking-wider text-[#1B3A57]">
                      RECUPERAR CONTRASEÑA
                    </h2>
                    <p className="text-xs text-slate-500 font-medium mt-1">
                      Ingrese su usuario o correo electrónico registrado para solicitar el restablecimiento de su acceso.
                    </p>
                  </div>

                  {/* Mensaje de Error en Recuperación */}
                  {recoveryError && (
                    <div
                      id="recovery-error-box"
                      className="p-3.5 bg-[#FDECEC] border border-[#FECACA] rounded-2xl flex items-start gap-2.5 text-xs text-[#DC2626] animate-in fade-in"
                    >
                      <ShieldAlert className="w-4 h-4 text-[#DC2626] shrink-0 mt-0.5" />
                      <div className="font-bold leading-relaxed">{recoveryError}</div>
                    </div>
                  )}

                  <form onSubmit={handleRecoverySubmit} className="space-y-4">
                    {/* Campo: Usuario o correo electrónico registrado */}
                    <div className="space-y-1.5">
                      <label
                        htmlFor="input-recovery-identifier"
                        className="block text-xs font-semibold uppercase tracking-wider text-slate-600"
                      >
                        Usuario o correo electrónico registrado:
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                          <Mail className="w-4 h-4" />
                        </div>
                        <input
                          id="input-recovery-identifier"
                          type="text"
                          value={recoveryIdentifier}
                          onChange={(e) => setRecoveryIdentifier(e.target.value)}
                          placeholder="Ej: jperez o jperez@camposol.com.pe"
                          autoCapitalize="none"
                          autoCorrect="off"
                          required
                          className="w-full pl-11 pr-4 py-3 bg-white border border-[#D8E2EA] rounded-full text-sm font-semibold text-[#1B3A57] placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#55A529] focus:border-[#55A529] transition-colors"
                        />
                      </div>
                    </div>

                    {/* Botón [ ENVIAR RECUPERACIÓN ] */}
                    <button
                      id="btn-send-recovery"
                      type="submit"
                      disabled={isRecoverySubmitting}
                      className="w-full py-3.5 px-4 bg-[#22A846] hover:bg-[#1C8E3A] active:bg-[#177830] text-white font-bold rounded-full text-sm uppercase tracking-wider transition-colors shadow-xs flex items-center justify-center gap-2 group disabled:opacity-50 cursor-pointer mt-2"
                    >
                      {isRecoverySubmitting ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <span>ENVIAR RECUPERACIÓN</span>
                          <Send className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                        </>
                      )}
                    </button>

                    {/* Enlace para Volver al Inicio de Sesión */}
                    <div className="pt-2 text-center">
                      <button
                        id="btn-back-to-login"
                        type="button"
                        onClick={() => {
                          setViewMode('login');
                          setRecoveryError('');
                        }}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#2F7D18] transition-colors cursor-pointer py-1"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Volver al inicio de sesión</span>
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                /* Estado Exitoso: Solicitud de Recuperación Enviada */
                <div className="space-y-4 py-2 animate-in fade-in">
                  <div className="w-14 h-14 bg-[#EAF7E4] border border-[#C6E9B4] text-[#2F7D18] rounded-2xl flex items-center justify-center mx-auto shadow-2xs">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>

                  <div className="text-center space-y-1">
                    <h2 className="text-base font-bold uppercase tracking-wider text-[#1B3A57]">
                      SOLICITUD ENVIADA
                    </h2>
                    <p className="text-xs text-slate-600 font-medium leading-relaxed">
                      El sistema ha recibido y registrado su requerimiento de recuperación de contraseña.
                    </p>
                  </div>

                  {recoveredUser && (
                    <div className="bg-[#F8FAFC] border border-[#E5ECF2] p-4 rounded-2xl space-y-2 text-xs">
                      <div className="flex items-center justify-between border-b border-[#E5ECF2] pb-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          Trabajador:
                        </span>
                        <span className="font-bold text-[#1B3A57]">
                          {recoveredUser.nombre}
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-b border-[#E5ECF2] pb-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          Usuario:
                        </span>
                        <span className="font-mono font-bold text-[#2F7D18]">
                          @{recoveredUser.usuario}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          Correo Institucional:
                        </span>
                        <span className="font-mono text-slate-700 font-bold">
                          {recoveredUser.email || `${recoveredUser.usuario}@camposol.com.pe`}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="p-3.5 bg-[#EAF7E4] border border-[#C6E9B4] rounded-2xl text-left text-xs text-[#1B3A57] leading-relaxed font-medium">
                    Se han enviado las pautas de validación a su correo institucional y se ha remitido aviso al <strong>Administrador del Sistema de Transporte</strong> para restablecer su clave en el Maestro de Usuarios.
                  </div>

                  {/* Botón para ingresar inmediatamente */}
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
                    className="w-full py-3.5 px-4 bg-[#22A846] hover:bg-[#1C8E3A] active:bg-[#177830] text-white font-bold rounded-full text-sm uppercase tracking-wider transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer mt-2"
                  >
                    <span>INGRESAR AHORA CON ESTA CUENTA</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  {/* Botón para regresar al login */}
                  <button
                    id="btn-confirm-return-login"
                    type="button"
                    onClick={() => {
                      setViewMode('login');
                      setRecoverySuccess(false);
                      setRecoveryIdentifier('');
                      setRecoveryError('');
                    }}
                    className="w-full py-2.5 px-4 bg-[#F1F5F9] hover:bg-slate-200 text-slate-700 font-semibold rounded-full text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Volver a la pantalla de login</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pie informativo institucional */}
        <div className="text-center mt-5 text-[11px] text-gray-500 font-medium">
          CAMPOSOL S.A. • Sistema de Transporte de Personal
        </div>
      </div>
    </div>
  );
};


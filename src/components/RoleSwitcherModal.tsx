import React, { useState } from 'react';
import {
  ShieldCheck,
  Check,
  Lock,
  AlertCircle,
  X,
  ArrowRight,
  Smartphone,
  Monitor,
  Inbox,
  ShieldAlert,
} from 'lucide-react';
import { UserRole } from '../types';

interface RoleSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRole: UserRole;
  onRoleChange: (newRole: UserRole) => void;
}

export const RoleSwitcherModal: React.FC<RoleSwitcherModalProps> = ({
  isOpen,
  onClose,
  currentRole,
  onRoleChange,
}) => {
  const [selectedRole, setSelectedRole] = useState<UserRole>(currentRole);
  const [pinInput, setPinInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSelectRole = (role: UserRole) => {
    setSelectedRole(role);
    setErrorMsg('');
    setPinInput('');
  };

  const handleConfirm = () => {
    // Si el usuario actual es 'usuario' e intenta pasar a rol de gestión (admin o receptor)
    if (currentRole === 'usuario' && (selectedRole === 'admin' || selectedRole === 'receptor')) {
      if (pinInput.trim() !== '1234') {
        setErrorMsg('ACCESO NO AUTORIZADO: Se requiere el PIN de seguridad administrativo (1234) para acceder a este rol.');
        return;
      }
    }

    onRoleChange(selectedRole);
    onClose();
  };

  const isUpgradingRole = currentRole === 'usuario' && (selectedRole === 'admin' || selectedRole === 'receptor');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto border border-gray-100">
        {/* Header */}
        <div className="bg-[#173B56] text-white p-5 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-white/70 hover:text-white rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#00843D] flex items-center justify-center text-white shadow-md">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold tracking-widest text-emerald-300 uppercase">
                CONTROL DE ACCESO Y EXPERIENCIA
              </span>
              <h2 className="text-lg font-black uppercase tracking-tight">
                Acceso por Rol de Usuario
              </h2>
              <p className="text-xs text-white/80 font-medium">
                {currentRole === 'usuario'
                  ? 'Modo de Pruebas / Acceso restringido para personal administrativo'
                  : 'Selecciona el entorno de trabajo para operar el sistema'}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 space-y-3.5 max-h-[72vh] overflow-y-auto">
          {/* Error Banner */}
          {errorMsg && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-2.5 text-xs text-red-800 animate-in fade-in">
              <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="font-bold">{errorMsg}</div>
            </div>
          )}

          {/* 1. Opción Usuario / Solicitante */}
          <div
            onClick={() => handleSelectRole('usuario')}
            className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
              selectedRole === 'usuario'
                ? 'border-[#00843D] bg-emerald-50/50 shadow-xs'
                : 'border-gray-200 hover:border-gray-300 bg-white'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                    selectedRole === 'usuario'
                      ? 'bg-[#00843D] text-white'
                      : 'bg-emerald-100/70 text-[#00843D]'
                  }`}
                >
                  <Smartphone className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-[#173B56] uppercase">
                      ROL 1: USUARIO / SOLICITANTE
                    </span>
                    <span className="px-2 py-0.5 text-[9px] font-black bg-emerald-100 text-[#00843D] rounded-full uppercase">
                      📱 App Móvil
                    </span>
                    {currentRole === 'usuario' && (
                      <span className="px-1.5 py-0.5 text-[9px] font-bold bg-gray-100 text-gray-500 rounded-md">
                        Actual
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500 block mt-0.5 font-medium">
                    Interfaz sencilla y vertical. Solo Nuevo Requerimiento y Mis Requerimientos.
                  </span>
                </div>
              </div>
              {selectedRole === 'usuario' && (
                <div className="w-5 h-5 rounded-full bg-[#00843D] text-white flex items-center justify-center shrink-0 mt-1">
                  <Check className="w-3.5 h-3.5" />
                </div>
              )}
            </div>

            <div className="mt-3 pt-2.5 border-t border-gray-200/60 text-xs text-gray-600 space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-800 font-medium">
                <Check className="w-3.5 h-3.5 text-[#00843D]" />
                <span>Exclusivo para registrar y consultar requerimientos de bus</span>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-800 font-medium">
                <Check className="w-3.5 h-3.5 text-[#00843D]" />
                <span>Sin acceso a datos maestros, base de datos ni configuraciones</span>
              </div>
            </div>
          </div>

          {/* 2. Opción Administrador */}
          <div
            onClick={() => handleSelectRole('admin')}
            className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
              selectedRole === 'admin'
                ? 'border-[#00843D] bg-emerald-50/50 shadow-xs'
                : 'border-gray-200 hover:border-gray-300 bg-white'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                    selectedRole === 'admin'
                      ? 'bg-[#173B56] text-white'
                      : 'bg-blue-100/70 text-[#173B56]'
                  }`}
                >
                  <Monitor className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-[#173B56] uppercase">
                      ROL 2: ADMINISTRADOR
                    </span>
                    <span className="px-2 py-0.5 text-[9px] font-black bg-blue-100 text-blue-800 rounded-full uppercase">
                      💻 Sistema Web
                    </span>
                    {currentRole === 'admin' && (
                      <span className="px-1.5 py-0.5 text-[9px] font-bold bg-gray-100 text-gray-500 rounded-md">
                        Actual
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500 block mt-0.5 font-medium">
                    Panel completo de computadora a pantalla ancha
                  </span>
                </div>
              </div>
              {selectedRole === 'admin' && (
                <div className="w-5 h-5 rounded-full bg-[#00843D] text-white flex items-center justify-center shrink-0 mt-1">
                  <Check className="w-3.5 h-3.5" />
                </div>
              )}
            </div>

            <div className="mt-3 pt-2.5 border-t border-gray-200/60 text-xs text-gray-600 space-y-1">
              <div className="flex items-center gap-1.5 text-blue-900 font-medium">
                <Check className="w-3.5 h-3.5 text-[#00843D]" />
                <span>Procesos, Datos Maestros, Reportes y Base de Datos</span>
              </div>
              <div className="flex items-center gap-1.5 text-blue-900 font-medium">
                <Check className="w-3.5 h-3.5 text-[#00843D]" />
                <span>Aprobación, Rechazo, Atención masiva y exportación CSV</span>
              </div>
            </div>
          </div>

          {/* 3. Opción Receptor */}
          <div
            onClick={() => handleSelectRole('receptor')}
            className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
              selectedRole === 'receptor'
                ? 'border-[#00843D] bg-emerald-50/50 shadow-xs'
                : 'border-gray-200 hover:border-gray-300 bg-white'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                    selectedRole === 'receptor'
                      ? 'bg-[#00843D] text-white'
                      : 'bg-amber-100/80 text-amber-800'
                  }`}
                >
                  <Inbox className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-[#173B56] uppercase">
                      ROL 3: RECEPTOR
                    </span>
                    <span className="px-2 py-0.5 text-[9px] font-black bg-amber-100 text-amber-900 rounded-full uppercase">
                      💻 Sistema Web
                    </span>
                    {currentRole === 'receptor' && (
                      <span className="px-1.5 py-0.5 text-[9px] font-bold bg-gray-100 text-gray-500 rounded-md">
                        Actual
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500 block mt-0.5 font-medium">
                    Gestión y despacho de requerimientos en pantalla ancha
                  </span>
                </div>
              </div>
              {selectedRole === 'receptor' && (
                <div className="w-5 h-5 rounded-full bg-[#00843D] text-white flex items-center justify-center shrink-0 mt-1">
                  <Check className="w-3.5 h-3.5" />
                </div>
              )}
            </div>

            <div className="mt-3 pt-2.5 border-t border-gray-200/60 text-xs text-gray-600 space-y-1">
              <div className="flex items-center gap-1.5 text-amber-900 font-medium">
                <Check className="w-3.5 h-3.5 text-[#00843D]" />
                <span>Recepción, filtros operativos, aprobación y marcado de atención</span>
              </div>
              <div className="flex items-center gap-1.5 text-amber-900 font-medium">
                <Check className="w-3.5 h-3.5 text-[#00843D]" />
                <span>Sin acceso a configuración de maestros ni base de datos</span>
              </div>
            </div>
          </div>

          {/* PIN Input Box for Security */}
          {isUpgradingRole && (
            <div className="mt-4 p-4 rounded-2xl bg-amber-50/80 border border-amber-300/80 space-y-2">
              <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                <Lock className="w-4 h-4 text-amber-700" />
                <span>Autorización Administrativa Requerida</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Para acceder como <strong>{selectedRole === 'admin' ? 'Administrador' : 'Receptor'}</strong> desde el perfil de solicitante, ingrese el PIN de seguridad administrativo:
              </p>
              <div className="pt-1">
                <input
                  type="password"
                  maxLength={6}
                  placeholder="Ingrese PIN (defecto: 1234)"
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value);
                    setErrorMsg('');
                  }}
                  className="w-full px-3.5 py-2 text-sm border border-amber-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#00843D] bg-white font-mono"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-xs font-bold text-gray-500 hover:text-gray-700 uppercase"
          >
            Cancelar
          </button>
          <button
            id="btn-confirm-role"
            onClick={handleConfirm}
            className="flex-1 py-2.5 bg-[#00843D] hover:bg-[#006e33] text-white rounded-xl text-xs font-bold uppercase transition-colors flex items-center justify-center gap-1.5 shadow-md"
          >
            <span>
              Activar {selectedRole === 'usuario' ? 'Modo Móvil' : 'Sistema Web de Escritorio'}
            </span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

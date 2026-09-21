import React from 'react';
import { PlusCircle, ClipboardList, Bus, Users, Clock, ArrowRight, CheckCircle2, MapPin, Database, ShieldCheck, User, Inbox } from 'lucide-react';
import { Requerimiento, UserRole } from '../types';

interface HomeScreenProps {
  onNewRequirement: () => void;
  onMyRequirements: () => void;
  onOpenMasters: () => void;
  onOpenDatabaseModal: () => void;
  userRole?: UserRole;
  onOpenRoleSwitcher?: () => void;
  requerimientos: Requerimiento[];
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onNewRequirement,
  onMyRequirements,
  onOpenMasters,
  onOpenDatabaseModal,
  userRole = 'admin',
  onOpenRoleSwitcher,
  requerimientos,
}) => {
  const isAdmin = userRole === 'admin';

  // Compute fast operational metrics
  const totalReqs = requerimientos.length;
  const pendingReqs = requerimientos.filter((r) => r.estado === 'PENDIENTE').length;
  const approvedReqs = requerimientos.filter((r) => r.estado === 'APROBADO' || r.estado === 'ATENDIDO').length;
  const totalPersonal = requerimientos.reduce((acc, curr) => acc + (curr.totalPersonas || 0), 0);

  // Latest requirement if any
  const latestReq = requerimientos.length > 0 ? requerimientos[0] : null;

  return (
    <div className="flex flex-col flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Role Banner Indicator */}
      <div className="flex items-center justify-between bg-white rounded-2xl p-3 sm:p-4 border border-gray-200/80 shadow-xs">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isAdmin ? 'bg-[#173B56] text-white' : 'bg-[#00843D] text-white'}`}>
            {isAdmin ? <ShieldCheck className="w-5 h-5" /> : <User className="w-5 h-5" />}
          </div>
          <div>
            <div className="text-xs sm:text-sm font-black uppercase text-[#173B56]">
              {isAdmin ? 'Panel de Administrador (Receptor)' : 'Vista de Usuario (Solicitante)'}
            </div>
            <div className="text-[10px] sm:text-xs text-gray-500 font-medium">
              {isAdmin ? 'Recepción de solicitudes, maestros y control total' : 'Registro de buses y consulta de estado'}
            </div>
          </div>
        </div>
        {onOpenRoleSwitcher && (
          <button
            onClick={onOpenRoleSwitcher}
            className="text-xs font-bold text-[#00843D] hover:underline px-3 py-1.5 rounded-xl hover:bg-emerald-50 transition-colors"
          >
            Cambiar rol
          </button>
        )}
      </div>

      {/* Main Responsive Grid: 2 columns on desktop, 1 on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (Desktop: 5 cols): Brand Hero & KPI Summary */}
        <div className="lg:col-span-5 space-y-5">
          {/* Brand Hero Card */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-150/80 text-center relative overflow-hidden">
            {/* Background decorative watermark */}
            <div className="absolute -right-8 -bottom-8 opacity-5 pointer-events-none">
              <Bus className="w-56 h-56 text-[#00843D]" />
            </div>

            {/* Brand Header */}
            <div className="inline-flex items-center justify-center mb-3">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden shadow-lg border-2 border-[#B89F67]/60 bg-[#58A33E] flex items-center justify-center">
                <img
                  src="/camposol-emblem.svg"
                  alt="CAMPOSOL"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#00843D] uppercase">
                CAMPOSOL
              </h1>
              <h2 className="text-sm sm:text-base font-bold tracking-wider text-[#173B56] uppercase">
                TRANSPORTE DE PERSONAL
              </h2>
              <div className="inline-block mt-2 px-4 py-1.5 bg-[#F5F8F7] border border-[#00843D]/15 rounded-full">
                <span className="text-xs font-extrabold text-[#00843D] tracking-wider uppercase">
                  {isAdmin ? 'COORDINACIÓN & RECEPCIÓN CENTRAL' : 'SOLICITUD DE REQUERIMIENTO DE BUS'}
                </span>
              </div>
            </div>

            <p className="mt-3 text-xs sm:text-sm text-gray-500 max-w-sm mx-auto">
              {isAdmin
                ? 'Monitorea las solicitudes de las áreas, programa buses y gestiona los maestros y paraderos.'
                : 'Completa la información de tu área, fundo, comedor y cantidad de personal por paradero.'}
            </p>
          </div>

          {/* Operational Summary Mini-Cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-2xl p-4 border border-gray-200/80 shadow-xs text-center">
              <div className="text-xs font-semibold text-gray-500 flex items-center justify-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                <span>Pendientes</span>
              </div>
              <div className="text-2xl font-black text-[#173B56] mt-1">{pendingReqs}</div>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-gray-200/80 shadow-xs text-center">
              <div className="text-xs font-semibold text-gray-500 flex items-center justify-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#00843D]" />
                <span>Aprobados</span>
              </div>
              <div className="text-2xl font-black text-[#00843D] mt-1">{approvedReqs}</div>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-gray-200/80 shadow-xs text-center">
              <div className="text-xs font-semibold text-gray-500 flex items-center justify-center gap-1">
                <Users className="w-3.5 h-3.5 text-[#173B56]" />
                <span>Personal</span>
              </div>
              <div className="text-2xl font-black text-[#173B56] mt-1">{totalPersonal}</div>
            </div>
          </div>
        </div>

        {/* Right Column (Desktop: 7 cols): Main Action Buttons & Latest Activity */}
        <div className="lg:col-span-7 space-y-4">
          {/* Main Action Buttons */}
          <div className="space-y-3.5">
            {/* BOTÓN NUEVO REQUERIMIENTO (Visible para ambos) */}
            <button
              id="btn-nuevo-requerimiento"
              onClick={onNewRequirement}
              className="w-full group relative flex items-center justify-between p-5 bg-[#00843D] hover:bg-[#006e33] active:bg-[#005728] text-white rounded-2xl shadow-md active:scale-[0.99] transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center shrink-0 border border-white/20 group-hover:scale-105 transition-transform">
                  <PlusCircle className="w-8 h-8 text-white" />
                </div>
                <div className="text-left">
                  <span className="block text-lg font-black tracking-tight uppercase">
                    NUEVO REQUERIMIENTO
                  </span>
                  <span className="block text-xs text-[#E8F5EF] font-medium mt-0.5">
                    {isAdmin ? 'Crear requerimiento como administrador' : 'Llenar información de personal y paraderos'}
                  </span>
                </div>
              </div>
              <ArrowRight className="w-6 h-6 text-white/80 group-hover:translate-x-1 transition-transform shrink-0" />
            </button>

            {/* BOTÓN REQUERIMIENTOS */}
            <button
              id="btn-mis-requerimientos"
              onClick={onMyRequirements}
              className="w-full group relative flex items-center justify-between p-5 bg-white hover:bg-gray-50 active:bg-gray-100 text-[#173B56] border-2 border-[#00843D]/30 rounded-2xl shadow-sm active:scale-[0.99] transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-[#E8F5EF] flex items-center justify-center shrink-0 border border-[#00843D]/20 group-hover:scale-105 transition-transform">
                  {isAdmin ? <Inbox className="w-8 h-8 text-[#00843D]" /> : <ClipboardList className="w-8 h-8 text-[#00843D]" />}
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-black tracking-tight uppercase">
                      {isAdmin ? 'BANDEJA DE RECEPCIÓN' : 'MIS REQUERIMIENTOS'}
                    </span>
                    {pendingReqs > 0 && (
                      <span className="px-2 py-0.5 text-xs font-black bg-amber-100 text-amber-800 rounded-full">
                        {pendingReqs} {isAdmin ? 'NUEVOS' : 'PENDIENTES'}
                      </span>
                    )}
                  </div>
                  <span className="block text-xs text-gray-500 font-medium mt-0.5">
                    {isAdmin ? 'Revisar, aprobar y atender requerimientos' : 'Consultar estados y detalle de solicitudes'}
                  </span>
                </div>
              </div>
              <ArrowRight className="w-6 h-6 text-[#00843D] group-hover:translate-x-1 transition-transform shrink-0" />
            </button>

            {/* FUNCIONES EXCLUSIVAS DE ADMINISTRADOR (RECEPTOR) */}
            {isAdmin && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* BOTÓN MIS MAESTROS (Solo Admin) */}
                <button
                  id="btn-mis-maestros"
                  onClick={onOpenMasters}
                  className="w-full group relative flex items-center justify-between p-4 bg-white hover:bg-emerald-50/40 active:bg-emerald-100/40 text-[#173B56] border border-gray-200 hover:border-[#00843D]/40 rounded-2xl shadow-xs active:scale-[0.99] transition-all"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-xl bg-[#E8F5EF] flex items-center justify-center shrink-0 border border-[#00843D]/20 text-[#00843D] group-hover:scale-105 transition-transform">
                      <MapPin className="w-6 h-6" />
                    </div>
                    <div className="text-left">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-black tracking-tight uppercase text-[#173B56]">
                          DATOS MAESTROS
                        </span>
                      </div>
                      <span className="block text-[11px] text-gray-500 font-medium mt-0.5">
                        Paraderos, fundos y áreas
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-[#00843D] group-hover:translate-x-1 transition-transform shrink-0" />
                </button>

                {/* BOTÓN BASE DE DATOS & RESPALDOS (Solo Admin) */}
                <button
                  id="btn-base-de-datos"
                  onClick={onOpenDatabaseModal}
                  className="w-full group relative flex items-center justify-between p-4 bg-white hover:bg-emerald-50/40 active:bg-emerald-100/40 text-[#173B56] border border-gray-200 hover:border-[#00843D]/40 rounded-2xl shadow-xs active:scale-[0.99] transition-all"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-xl bg-[#173B56]/10 flex items-center justify-center shrink-0 border border-[#173B56]/20 text-[#173B56] group-hover:scale-105 transition-transform">
                      <Database className="w-6 h-6 text-[#173B56]" />
                    </div>
                    <div className="text-left">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-black tracking-tight uppercase text-[#173B56]">
                          BASE DE DATOS
                        </span>
                      </div>
                      <span className="block text-[11px] text-gray-500 font-medium mt-0.5">
                        Copias de seguridad JSON
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-[#173B56] group-hover:translate-x-1 transition-transform shrink-0" />
                </button>
              </div>
            )}
          </div>

          {/* Latest Requirement Quick Glance */}
          {latestReq && (
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-gray-200/80 shadow-xs">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                <span className="font-bold text-[#173B56]">
                  {isAdmin ? 'Último Requerimiento Recibido' : 'Última Solicitud Enviada'}
                </span>
                <span className="text-[11px] font-mono font-bold text-[#00843D] bg-[#E8F5EF] px-2 py-0.5 rounded-md">
                  {latestReq.numeroRequerimiento}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-[#173B56]">{latestReq.area}</div>
                  <div className="text-xs text-gray-500">
                    Fundo: <span className="font-semibold text-gray-700">{latestReq.fundo}</span> • {latestReq.movimiento}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-black text-[#00843D]">
                    {latestReq.totalPersonas} personas
                  </span>
                  <div className="text-[11px] text-gray-400">Recojo: {latestReq.horaRecojo}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer Info / Corporate Note & Fast Role Toggle */}
      <div className="text-center pt-4 space-y-2">
        {onOpenRoleSwitcher && (
          <button
            onClick={onOpenRoleSwitcher}
            className="text-xs text-gray-500 hover:text-[#00843D] font-medium underline"
          >
            {isAdmin ? '¿Deseas probar la vista de Usuario (Solicitante)?' : '¿Eres Administrador / Receptor? Ingresar aquí'}
          </button>
        )}
        <p className="text-[11px] text-gray-400 font-medium">
          CAMPOSOL S.A. • Gerencia de Operaciones Agrícolas
        </p>
      </div>
    </div>
  );
};

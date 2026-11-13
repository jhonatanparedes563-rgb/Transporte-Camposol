import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  Check,
  X,
  Edit2,
  KeyRound,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Lock,
  Smartphone,
  Inbox,
  Building,
  Compass,
  Eye,
  EyeOff,
  Trash2,
  Sprout,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { AppUser, UserRole, UserStatus } from '../types';
import {
  getStoredUsers,
  createNewUser,
  updateExistingUser,
  toggleUserStatus,
  deleteStoredUser,
  resetUserPassword,
} from '../services/authService';
import { getStoredAreas, getStoredFundos } from '../services/storageService';
import { MAESTRO_CULTIVOS } from '../data/masterData';

interface UserManagementScreenProps {
  currentAdminUser: AppUser;
}

export const UserManagementScreen: React.FC<UserManagementScreenProps> = ({
  currentAdminUser,
}) => {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('TODOS');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('TODOS');

  // Catálogos maestros para selección de Área y Fundo
  const [areas] = useState(() => getStoredAreas());
  const [fundos] = useState(() => getStoredFundos());

  // Estado de modales
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);

  // Formulario de Crear Usuario
  const [createForm, setCreateForm] = useState({
    nombre: '',
    usuario: '',
    email: '',
    contrasena: '',
    confirmarContrasena: '',
    rol: 'usuario' as UserRole,
    area: 'PRODUCCIÓN',
    fundo: 'AGRICULTOR 2',
    cultivo: 'ARÁNDANO',
    estado: 'ACTIVO' as UserStatus,
  });

  // Formulario de Editar Usuario
  const [editForm, setEditForm] = useState({
    nombre: '',
    usuario: '',
    email: '',
    rol: 'usuario' as UserRole,
    area: 'PRODUCCIÓN',
    fundo: 'AGRICULTOR 2',
    cultivo: 'ARÁNDANO',
    estado: 'ACTIVO' as UserStatus,
  });

  // Formulario de Restablecer Contraseña
  const [resetForm, setResetForm] = useState({
    nuevaContrasena: '',
    confirmarContrasena: '',
  });

  // Visibilidad de contraseñas
  const [showCreatePass, setShowCreatePass] = useState(false);
  const [showResetPass, setShowResetPass] = useState(false);

  // Mensajes y alertas
  const [errorMessage, setErrorMessage] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadUsers = () => {
    setUsers(getStoredUsers());
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Abrir Modal de Creación
  const handleOpenCreate = () => {
    setCreateForm({
      nombre: '',
      usuario: '',
      email: '',
      contrasena: '',
      confirmarContrasena: '',
      rol: 'usuario',
      area: areas[0]?.area || 'PRODUCCIÓN',
      fundo: fundos[0]?.fundo || 'AGRICULTOR 2',
      cultivo: 'ARÁNDANO',
      estado: 'ACTIVO',
    });
    setErrorMessage('');
    setShowCreatePass(false);
    setIsCreateModalOpen(true);
  };

  // Guardar Nuevo Usuario (+ NUEVO USUARIO)
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const nombre = createForm.nombre.trim();
    const usuario = createForm.usuario.trim().toLowerCase();
    const email = createForm.email.trim().toLowerCase() || `${usuario}@camposol.com.pe`;
    const contrasena = createForm.contrasena.trim();
    const confirmarContrasena = createForm.confirmarContrasena.trim();

    // Validaciones requeridas:
    if (!nombre) {
      setErrorMessage('El nombre completo es obligatorio.');
      return;
    }
    if (!usuario) {
      setErrorMessage('El usuario es obligatorio.');
      return;
    }
    if (!contrasena) {
      setErrorMessage('La contraseña es obligatoria.');
      return;
    }
    if (contrasena !== confirmarContrasena) {
      setErrorMessage('Las contraseñas no coinciden. Por favor verifique.');
      return;
    }
    if (!createForm.rol) {
      setErrorMessage('El rol es obligatorio.');
      return;
    }
    if (!createForm.estado) {
      setErrorMessage('El estado es obligatorio.');
      return;
    }

    // Validar usuario duplicado
    const existing = users.some((u) => u.usuario.toLowerCase() === usuario);
    if (existing) {
      setErrorMessage(`El usuario "${usuario}" ya se encuentra registrado. Elija otro identificador.`);
      return;
    }

    const res = await createNewUser({
      nombre,
      usuario,
      email,
      contrasena,
      rol: createForm.rol,
      area: createForm.area,
      fundo: createForm.fundo,
      cultivo: createForm.cultivo,
      estado: createForm.estado,
    });

    if (res.success) {
      setIsCreateModalOpen(false);
      loadUsers();
      showToast(`Usuario "${nombre}" creado exitosamente.`);
    } else {
      setErrorMessage(res.error || 'Error al registrar usuario.');
    }
  };

  // Abrir Modal de Edición
  const handleOpenEdit = (user: AppUser) => {
    setSelectedUser(user);
    setEditForm({
      nombre: user.nombre,
      usuario: user.usuario,
      email: user.email || `${user.usuario}@camposol.com.pe`,
      rol: user.rol,
      area: user.area,
      fundo: user.fundo,
      cultivo: user.cultivo || (user.rol === 'usuario' ? 'ARÁNDANO' : 'TODOS LOS CULTIVOS'),
      estado: user.estado,
    });
    setErrorMessage('');
    setIsEditModalOpen(true);
  };

  // Guardar Cambios de Edición
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setErrorMessage('');

    const nombre = editForm.nombre.trim();
    const usuario = editForm.usuario.trim().toLowerCase();
    const email = editForm.email.trim().toLowerCase() || `${usuario}@camposol.com.pe`;

    if (!nombre) {
      setErrorMessage('El nombre completo es obligatorio.');
      return;
    }
    if (!usuario) {
      setErrorMessage('El usuario es obligatorio.');
      return;
    }

    const res = await updateExistingUser(selectedUser.id, {
      nombre,
      usuario,
      email,
      rol: editForm.rol,
      area: editForm.area,
      fundo: editForm.fundo,
      cultivo: editForm.cultivo,
      estado: editForm.estado,
    });

    if (res.success) {
      setIsEditModalOpen(false);
      loadUsers();
      showToast(`Usuario "${nombre}" actualizado correctamente.`);
    } else {
      setErrorMessage(res.error || 'Error al actualizar usuario.');
    }
  };

  // Abrir Modal de Restablecer Contraseña
  const handleOpenReset = (user: AppUser) => {
    setSelectedUser(user);
    setResetForm({
      nuevaContrasena: '',
      confirmarContrasena: '',
    });
    setErrorMessage('');
    setShowResetPass(false);
    setIsResetModalOpen(true);
  };

  // Guardar Nueva Contraseña
  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setErrorMessage('');

    const nueva = resetForm.nuevaContrasena.trim();
    const confirmar = resetForm.confirmarContrasena.trim();

    if (!nueva) {
      setErrorMessage('La nueva contraseña es obligatoria.');
      return;
    }
    if (nueva !== confirmar) {
      setErrorMessage('Las contraseñas no coinciden. Verifique ambas casillas.');
      return;
    }

    const res = await resetUserPassword(selectedUser.id, nueva);
    if (res.success) {
      setIsResetModalOpen(false);
      loadUsers();
      showToast(`Contraseña restablecida exitosamente para ${selectedUser.nombre}.`);
    } else {
      setErrorMessage(res.error || 'Error al restablecer contraseña.');
    }
  };

  // Activar / Desactivar Usuario
  const handleToggleStatus = (user: AppUser) => {
    if (user.id === currentAdminUser.id) {
      alert('No puedes desactivar tu propia cuenta de administrador.');
      return;
    }

    const res = toggleUserStatus(user.id);
    if (res.success) {
      loadUsers();
      showToast(
        `Usuario ${user.nombre} ahora está ${res.newStatus === 'ACTIVO' ? 'ACTIVO' : 'INACTIVO'}.`
      );
    }
  };

  // Abrir Modal de Confirmación de Eliminación
  const handleOpenDelete = (user: AppUser) => {
    if (user.id === currentAdminUser.id) {
      alert('No puedes eliminar tu propia cuenta de administrador activa.');
      return;
    }
    setSelectedUser(user);
    setErrorMessage('');
    setIsDeleteModalOpen(true);
  };

  // Confirmar Eliminación Permanente
  const handleDeleteConfirm = () => {
    if (!selectedUser) return;
    setErrorMessage('');

    const res = deleteStoredUser(selectedUser.id, currentAdminUser.id);
    if (res.success) {
      setIsDeleteModalOpen(false);
      setIsEditModalOpen(false);
      loadUsers();
      showToast(`Usuario "${selectedUser.nombre}" (@${selectedUser.usuario}) eliminado correctamente.`);
    } else {
      setErrorMessage(res.error || 'No fue posible eliminar el usuario.');
    }
  };

  // Filtrado de usuarios
  const filteredUsers = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return users.filter((u) => {
      const matchesSearch =
        !q ||
        u.id.toLowerCase().includes(q) ||
        u.nombre.toLowerCase().includes(q) ||
        u.usuario.toLowerCase().includes(q) ||
        u.area.toLowerCase().includes(q) ||
        u.fundo.toLowerCase().includes(q) ||
        (u.cultivo && u.cultivo.toLowerCase().includes(q));

      const matchesRole =
        selectedRoleFilter === 'TODOS' || u.rol.toLowerCase() === selectedRoleFilter.toLowerCase();
      const matchesStatus =
        selectedStatusFilter === 'TODOS' || u.estado === selectedStatusFilter;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchTerm, selectedRoleFilter, selectedStatusFilter]);

  // Paginación de alto rendimiento para soportar 300+ usuarios
  const [userPageSize, setUserPageSize] = useState<number>(25);
  const [userCurrentPage, setUserCurrentPage] = useState<number>(1);

  // Reiniciar a la primera página cuando cambian los filtros
  useEffect(() => {
    setUserCurrentPage(1);
  }, [searchTerm, selectedRoleFilter, selectedStatusFilter, userPageSize]);

  const totalUserPages = useMemo(() => {
    if (userPageSize === -1) return 1;
    return Math.ceil(filteredUsers.length / userPageSize) || 1;
  }, [filteredUsers.length, userPageSize]);

  const paginatedUsers = useMemo(() => {
    if (userPageSize === -1) return filteredUsers;
    const start = (userCurrentPage - 1) * userPageSize;
    return filteredUsers.slice(start, start + userPageSize);
  }, [filteredUsers, userCurrentPage, userPageSize]);

  return (
    <div className="space-y-4 text-[#1B3A57]">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1B3A57] text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 animate-in slide-in-from-bottom-5 font-semibold text-xs border border-[#55A529]/40">
          <CheckCircle2 className="w-5 h-5 text-[#7BD44B]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Cabecera + Filtros + Tabla unificada estilo corporativo */}
      <div className="bg-white rounded-2xl border border-[#E5ECF2] shadow-xs overflow-hidden">
        {/* Cabecera del Panel */}
        <div className="px-5 pt-4 pb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-[#1B3A57] leading-tight">
              Maestro de usuarios
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Gestión centralizada de cuentas, roles, áreas, fundos y permisos • Mostrando{' '}
              <strong className="text-[#1B3A57] font-semibold">{filteredUsers.length}</strong> de{' '}
              <strong className="text-[#1B3A57] font-semibold">{users.length}</strong> usuarios
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Buscador píldora */}
            <div className="relative">
              <input
                id="input-search-users"
                type="text"
                placeholder="Buscar usuario, área, fundo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-56 sm:w-64 h-9 pl-4 pr-9 bg-white border border-[#D8E2EA] rounded-full text-xs text-slate-700 placeholder-slate-400 focus:border-[#55A529] focus:outline-none transition-colors"
              />
              <Search className="w-4 h-4 text-[#55A529] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Botón: + Nuevo usuario */}
            <button
              id="btn-create-user"
              onClick={handleOpenCreate}
              className="h-9 px-4 bg-[#22A846] hover:bg-[#1C8E3A] text-white rounded-full text-xs font-semibold flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Nuevo usuario</span>
            </button>
          </div>
        </div>

        {/* Barra de Filtros con etiquetas flotantes */}
        <div className="px-5 pt-2 pb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 flex-1 max-w-2xl">
            <div className="relative">
              <label className="absolute -top-1.5 left-4 bg-white px-1.5 text-[10px] leading-[12px] text-slate-500 font-medium z-10 pointer-events-none">
                Rol del usuario
              </label>
              <select
                id="select-filter-user-role"
                value={selectedRoleFilter}
                onChange={(e) => setSelectedRoleFilter(e.target.value)}
                className="w-full h-10 px-4 bg-white border border-[#D8E2EA] rounded-full text-xs text-slate-700 focus:border-[#55A529] focus:outline-none transition-colors cursor-pointer"
              >
                <option value="TODOS">Todos los roles</option>
                <option value="usuario">Usuario</option>
                <option value="receptor">Receptor</option>
                <option value="admin">Administrador</option>
              </select>
            </div>

            <div className="relative">
              <label className="absolute -top-1.5 left-4 bg-white px-1.5 text-[10px] leading-[12px] text-slate-500 font-medium z-10 pointer-events-none">
                Estado de cuenta
              </label>
              <select
                id="select-filter-user-status"
                value={selectedStatusFilter}
                onChange={(e) => setSelectedStatusFilter(e.target.value)}
                className="w-full h-10 px-4 bg-white border border-[#D8E2EA] rounded-full text-xs text-slate-700 focus:border-[#55A529] focus:outline-none transition-colors cursor-pointer"
              >
                <option value="TODOS">Todos los estados</option>
                <option value="ACTIVO">Activo</option>
                <option value="INACTIVO">Inactivo</option>
              </select>
            </div>
          </div>

          {(searchTerm || selectedRoleFilter !== 'TODOS' || selectedStatusFilter !== 'TODOS') && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setSelectedRoleFilter('TODOS');
                setSelectedStatusFilter('TODOS');
              }}
              className="px-4 py-1.5 rounded-full bg-[#F1F5F9] hover:bg-slate-200 text-[11px] font-medium text-slate-600 transition-colors cursor-pointer"
            >
              Restablecer
            </button>
          )}
        </div>

        {/* Tabla Corporativa con Cabecera Celeste */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px] border-collapse">
            <thead className="bg-[#E6F3FB] text-[#0082B3] font-semibold text-[11px] border-y border-[#D4E9F7]">
              <tr>
                <th className="py-2.5 px-3.5 whitespace-nowrap">ID</th>
                <th className="py-2.5 px-3.5 whitespace-nowrap">Nombre completo</th>
                <th className="py-2.5 px-3.5 whitespace-nowrap">Usuario</th>
                <th className="py-2.5 px-3.5 whitespace-nowrap">Contraseña</th>
                <th className="py-2.5 px-3.5 whitespace-nowrap">Rol</th>
                <th className="py-2.5 px-3.5 whitespace-nowrap">Área</th>
                <th className="py-2.5 px-3.5 whitespace-nowrap">Fundo</th>
                <th className="py-2.5 px-3.5 whitespace-nowrap">Cultivo</th>
                <th className="py-2.5 px-3.5 text-center whitespace-nowrap">Estado</th>
                <th className="py-2.5 px-3.5 text-center whitespace-nowrap border-l border-[#D4E9F7]/70">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100 text-slate-700">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <Users className="w-9 h-9 mx-auto mb-2 opacity-40 text-slate-400" />
                    <span className="font-semibold text-xs text-slate-500">
                      No se encontraron usuarios registrados con los criterios especificados.
                    </span>
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((u) => {
                  const isCurrent = u.id === currentAdminUser.id;
                  return (
                    <tr key={u.id} className="hover:bg-[#F7FBFE] transition-colors">
                      {/* ID */}
                      <td className="py-2.5 px-3.5 font-mono font-medium text-slate-500 text-[11px] whitespace-nowrap">
                        {u.id}
                      </td>

                      {/* Nombre completo */}
                      <td className="py-2.5 px-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-[#EAF7E4] text-[#2F7D18] font-bold flex items-center justify-center text-[10px] shrink-0 border border-[#C6E9B4]">
                            {u.nombre.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-semibold text-[#1B3A57] block">
                              {u.nombre}
                            </span>
                            {isCurrent && (
                              <span className="text-[9px] font-semibold text-[#2F7D18] bg-[#EAF7E4] px-1.5 py-0.2 rounded-full">
                                Sesión actual
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Usuario */}
                      <td className="py-2.5 px-3.5 font-mono text-[11px]">
                        <span className="font-semibold text-slate-700 block">@{u.usuario}</span>
                        <span className="text-[10px] text-slate-400 font-sans block truncate max-w-[170px]" title={u.email || `${u.usuario}@camposol.com.pe`}>
                          {u.email || `${u.usuario}@camposol.com.pe`}
                        </span>
                      </td>

                      {/* Contraseña */}
                      <td className="py-2.5 px-3.5">
                        <span className="font-mono text-[11px] tracking-widest text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          ••••••••
                        </span>
                      </td>

                      {/* Rol */}
                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        {u.rol === 'usuario' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#EAF7E4] text-[#2F7D18] border border-[#C6E9B4]">
                            <Smartphone className="w-3 h-3" />
                            <span>Usuario</span>
                          </span>
                        ) : u.rol === 'receptor' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#FFF6E0] text-[#B45309] border border-[#FDE68A]">
                            <Inbox className="w-3 h-3" />
                            <span>Receptor</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#EDF2FA] text-[#1E3A5F] border border-[#D4E2F4]">
                            <ShieldCheck className="w-3 h-3" />
                            <span>Administrador</span>
                          </span>
                        )}
                      </td>

                      {/* Área */}
                      <td className="py-2.5 px-3.5 font-medium text-[#1B3A57]">
                        <div className="flex items-center gap-1.5">
                          <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{u.area}</span>
                        </div>
                      </td>

                      {/* Fundo */}
                      <td className="py-2.5 px-3.5 text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <Compass className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{u.fundo}</span>
                        </div>
                      </td>

                      {/* Cultivo */}
                      <td className="py-2.5 px-3.5">
                        <div className="flex items-center gap-1.5">
                          <Sprout className="w-3.5 h-3.5 text-[#3D8B1C] shrink-0" />
                          <span className="bg-[#EAF7E4] text-[#2F7D18] border border-[#C6E9B4] px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap">
                            {u.cultivo || (u.rol === 'usuario' ? 'ARÁNDANO' : 'TODOS LOS CULTIVOS')}
                          </span>
                        </div>
                      </td>

                      {/* Estado */}
                      <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(u)}
                          disabled={isCurrent}
                          title={isCurrent ? 'No puedes desactivar tu propia cuenta' : 'Cambiar estado'}
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold transition-all cursor-pointer ${
                            u.estado === 'ACTIVO'
                              ? 'bg-[#EAF7E4] text-[#2F7D18] border border-[#C6E9B4] hover:bg-[#FDECEC] hover:text-[#DC2626] hover:border-[#FECACA]'
                              : 'bg-[#FDECEC] text-[#DC2626] border border-[#FECACA] hover:bg-[#EAF7E4] hover:text-[#2F7D18]'
                          } ${isCurrent ? 'opacity-70 cursor-not-allowed' : ''}`}
                        >
                          {u.estado === 'ACTIVO' ? (
                            <>
                              <Check className="w-3 h-3" />
                              <span>Activo</span>
                            </>
                          ) : (
                            <>
                              <X className="w-3 h-3" />
                              <span>Inactivo</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* Acciones */}
                      <td className="py-2.5 px-3.5 text-center border-l border-slate-100 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(u)}
                            className="p-1.5 rounded-full text-[#3D8B1C] hover:bg-[#EAF7E4] transition-colors cursor-pointer"
                            title="Editar usuario"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenReset(u)}
                            className="p-1.5 rounded-full text-amber-600 hover:bg-[#FFF6E0] transition-colors cursor-pointer"
                            title="Restablecer contraseña"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenDelete(u)}
                            disabled={isCurrent}
                            className={`p-1.5 rounded-full transition-colors ${
                              isCurrent
                                ? 'text-slate-300 cursor-not-allowed'
                                : 'text-amber-600 hover:text-[#DC2626] hover:bg-[#FDECEC] cursor-pointer'
                            }`}
                            title={isCurrent ? 'No puedes eliminar tu propia cuenta en sesión' : 'Eliminar usuario'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Barra de Paginación de Usuarios */}
        {filteredUsers.length > 0 && (
          <div className="bg-white px-5 py-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4 text-[11px]">
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-medium">
                Mostrando{' '}
                <strong className="text-[#1B3A57] font-semibold">
                  {userPageSize === -1 ? 1 : (userCurrentPage - 1) * userPageSize + 1}
                </strong>{' '}
                a{' '}
                <strong className="text-[#1B3A57] font-semibold">
                  {userPageSize === -1
                    ? filteredUsers.length
                    : Math.min(userCurrentPage * userPageSize, filteredUsers.length)}
                </strong>{' '}
                de <strong className="text-[#2F7D18] font-semibold">{filteredUsers.length}</strong> usuarios
                <span className="text-slate-400 font-normal"> (Total: {users.length})</span>
              </span>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-medium">Por página:</span>
                <select
                  value={userPageSize}
                  onChange={(e) => setUserPageSize(Number(e.target.value))}
                  className="px-2.5 py-1 bg-white border border-[#D8E2EA] rounded-full font-medium text-[#1B3A57] focus:outline-none focus:border-[#55A529] text-[11px] cursor-pointer"
                >
                  <option value={20}>20</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                  <option value={-1}>Todos ({filteredUsers.length})</option>
                </select>
              </div>

              {userPageSize !== -1 && totalUserPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setUserCurrentPage(1)}
                    disabled={userCurrentPage === 1}
                    className="p-1.5 rounded-full border border-[#D8E2EA] bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                    title="Primera página"
                  >
                    <ChevronsLeft className="w-3.5 h-3.5 text-slate-600" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={userCurrentPage === 1}
                    className="p-1.5 rounded-full border border-[#D8E2EA] bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                    title="Página anterior"
                  >
                    <ChevronLeft className="w-3.5 h-3.5 text-slate-600" />
                  </button>

                  <span className="px-3 py-1 font-semibold text-[#1B3A57] bg-white rounded-full border border-[#D8E2EA] text-[11px]">
                    Pág. {userCurrentPage} de {totalUserPages}
                  </span>

                  <button
                    type="button"
                    onClick={() => setUserCurrentPage((p) => Math.min(totalUserPages, p + 1))}
                    disabled={userCurrentPage === totalUserPages}
                    className="p-1.5 rounded-full border border-[#D8E2EA] bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                    title="Página siguiente"
                  >
                    <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserCurrentPage(totalUserPages)}
                    disabled={userCurrentPage === totalUserPages}
                    className="p-1.5 rounded-full border border-[#D8E2EA] bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                    title="Última página"
                  >
                    <ChevronsRight className="w-3.5 h-3.5 text-slate-600" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ============================================================= */}
      {/* MODAL 1: + NUEVO USUARIO                                      */}
      {/* ============================================================= */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 border border-[#E5ECF2]">
            {/* Cabecera */}
            <div className="bg-[#55A529] text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white text-[#55A529] flex items-center justify-center shadow-xs">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-100">
                    MAESTRO DE USUARIOS
                  </span>
                  <h3 className="text-base font-black uppercase tracking-tight">
                    NUEVO USUARIO
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 rounded-full text-white/70 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4 max-h-[78vh] overflow-y-auto">
              {errorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Nombre completo */}
              <div className="space-y-1">
                <label className="block text-xs font-bold uppercase text-gray-700">
                  Nombre completo *
                </label>
                <input
                  id="input-create-nombre"
                  type="text"
                  required
                  placeholder="Ej. Juan Pérez"
                  value={createForm.nombre}
                  onChange={(e) => setCreateForm({ ...createForm, nombre: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-[#D8E2EA] rounded-full text-xs font-semibold text-[#1B3A57] focus:outline-none focus:border-[#55A529]"
                />
              </div>

              {/* Usuario */}
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold uppercase text-slate-600">
                  Usuario *
                </label>
                <input
                  id="input-create-usuario"
                  type="text"
                  required
                  placeholder="Ej. jperez"
                  autoCapitalize="none"
                  value={createForm.usuario}
                  onChange={(e) => setCreateForm({ ...createForm, usuario: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-[#D8E2EA] rounded-full text-xs font-semibold font-mono text-[#1B3A57] focus:outline-none focus:border-[#55A529]"
                />
              </div>

              {/* Correo Electrónico Corporativo */}
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold uppercase text-slate-600">
                  Correo Electrónico Corporativo (Opcional)
                </label>
                <input
                  id="input-create-email"
                  type="email"
                  placeholder="Ej. jperez@camposol.com.pe"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-[#D8E2EA] rounded-full text-xs font-semibold text-[#1B3A57] focus:outline-none focus:border-[#55A529]"
                />
              </div>

              {/* Contraseña y Confirmar Contraseña */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-semibold uppercase text-slate-600">
                      Contraseña *
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowCreatePass(!showCreatePass)}
                      className="text-[10px] text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showCreatePass ? 'Ocultar' : 'Ver'}
                    </button>
                  </div>
                  <input
                    id="input-create-password"
                    type={showCreatePass ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={createForm.contrasena}
                    onChange={(e) => setCreateForm({ ...createForm, contrasena: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-[#D8E2EA] rounded-full text-xs font-semibold font-mono text-[#1B3A57] focus:outline-none focus:border-[#55A529]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold uppercase text-slate-600">
                    Confirmar contraseña *
                  </label>
                  <input
                    id="input-create-confirm-password"
                    type={showCreatePass ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={createForm.confirmarContrasena}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, confirmarContrasena: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 bg-white border border-[#D8E2EA] rounded-full text-xs font-semibold font-mono text-[#1B3A57] focus:outline-none focus:border-[#55A529]"
                  />
                </div>
              </div>

              {/* Rol */}
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold uppercase text-slate-600">
                  Rol *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setCreateForm({ ...createForm, rol: 'usuario' })}
                    className={`p-2.5 rounded-xl border text-center font-semibold text-xs transition-all cursor-pointer ${
                      createForm.rol === 'usuario'
                        ? 'bg-[#EAF7E4] border-[#55A529] text-[#2F7D18] shadow-xs'
                        : 'bg-[#EEF3F7] border-[#E5ECF2] text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Smartphone className="w-4 h-4 mx-auto mb-1" />
                    <span>USUARIO</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCreateForm({ ...createForm, rol: 'receptor' })}
                    className={`p-2.5 rounded-xl border text-center font-semibold text-xs transition-all cursor-pointer ${
                      createForm.rol === 'receptor'
                        ? 'bg-[#FFF6E0] border-amber-500 text-[#B45309] shadow-xs'
                        : 'bg-[#EEF3F7] border-[#E5ECF2] text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Inbox className="w-4 h-4 mx-auto mb-1" />
                    <span>RECEPTOR</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCreateForm({ ...createForm, rol: 'admin' })}
                    className={`p-2.5 rounded-xl border text-center font-semibold text-xs transition-all cursor-pointer ${
                      createForm.rol === 'admin'
                        ? 'bg-[#E6F3FB] border-[#0082B3] text-[#0082B3] shadow-xs'
                        : 'bg-[#EEF3F7] border-[#E5ECF2] text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4 mx-auto mb-1" />
                    <span>ADMINISTRADOR</span>
                  </button>
                </div>
              </div>

              {/* Área, Fundo y Cultivo */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold uppercase text-slate-600">
                    Área *
                  </label>
                  <select
                    id="select-create-area"
                    value={createForm.area}
                    onChange={(e) => setCreateForm({ ...createForm, area: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-[#D8E2EA] rounded-full text-xs font-semibold text-[#1B3A57] focus:outline-none focus:border-[#55A529]"
                  >
                    <option value="TODAS LAS ÁREAS">TODAS LAS ÁREAS</option>
                    {areas.map((a) => (
                      <option key={a.id} value={a.area}>
                        {a.area}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold uppercase text-slate-600">
                    Fundo *
                  </label>
                  <select
                    id="select-create-fundo"
                    value={createForm.fundo}
                    onChange={(e) => setCreateForm({ ...createForm, fundo: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-[#D8E2EA] rounded-full text-xs font-semibold text-[#1B3A57] focus:outline-none focus:border-[#55A529]"
                  >
                    <option value="TODOS LOS FUNDOS">TODOS LOS FUNDOS</option>
                    {fundos.map((f) => (
                      <option key={f.id} value={f.fundo}>
                        {f.fundo}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold uppercase text-slate-600 flex items-center gap-1">
                    <Sprout className="w-3.5 h-3.5 text-[#55A529]" />
                    <span>Cultivo *</span>
                  </label>
                  <select
                    id="select-create-cultivo"
                    value={createForm.cultivo}
                    onChange={(e) => setCreateForm({ ...createForm, cultivo: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-[#D8E2EA] rounded-full text-xs font-semibold text-[#1B3A57] focus:outline-none focus:border-[#55A529]"
                  >
                    <option value="TODOS LOS CULTIVOS">TODOS LOS CULTIVOS</option>
                    {MAESTRO_CULTIVOS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Estado */}
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold uppercase text-slate-600">
                  Estado *
                </label>
                <div className="flex gap-4 p-2.5 bg-[#EEF3F7] border border-[#E5ECF2] rounded-xl">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold">
                    <input
                      type="radio"
                      name="create-estado"
                      checked={createForm.estado === 'ACTIVO'}
                      onChange={() => setCreateForm({ ...createForm, estado: 'ACTIVO' })}
                      className="text-[#55A529] focus:ring-[#55A529]"
                    />
                    <span className="text-[#2F7D18]">ACTIVO</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold">
                    <input
                      type="radio"
                      name="create-estado"
                      checked={createForm.estado === 'INACTIVO'}
                      onChange={() => setCreateForm({ ...createForm, estado: 'INACTIVO' })}
                      className="text-[#DC2626] focus:ring-[#DC2626]"
                    />
                    <span className="text-[#DC2626]">INACTIVO</span>
                  </label>
                </div>
              </div>

              {/* Botones GUARDAR y CANCELAR */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-full bg-[#F1F5F9] hover:bg-slate-200 text-xs font-semibold text-slate-600 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  id="btn-save-new-user"
                  type="submit"
                  className="px-5 py-2.5 bg-[#22A846] hover:bg-[#1C8E3A] text-white rounded-full text-xs font-semibold shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Guardar</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL 2: EDITAR USUARIO                                       */}
      {/* ============================================================= */}
      {isEditModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 border border-[#E5ECF2]">
            {/* Cabecera */}
            <div className="bg-[#1B3A57] text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#55A529] text-white flex items-center justify-center">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-300">
                    MAESTRO DE USUARIOS
                  </span>
                  <h3 className="text-base font-black uppercase tracking-tight">
                    EDITAR USUARIO
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-1.5 rounded-full text-white/70 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4 max-h-[78vh] overflow-y-auto">
              {errorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Nombre */}
              <div className="space-y-1">
                <label className="block text-xs font-bold uppercase text-gray-700">
                  Nombre completo *
                </label>
                <input
                  id="input-edit-nombre"
                  type="text"
                  required
                  value={editForm.nombre}
                  onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-[#D8E2EA] rounded-full text-xs font-semibold text-[#1B3A57] focus:outline-none focus:border-[#55A529]"
                />
              </div>

              {/* Usuario */}
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold uppercase text-slate-600">
                  Usuario *
                </label>
                <input
                  id="input-edit-usuario"
                  type="text"
                  required
                  autoCapitalize="none"
                  value={editForm.usuario}
                  onChange={(e) => setEditForm({ ...editForm, usuario: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-[#D8E2EA] rounded-full text-xs font-semibold font-mono text-[#1B3A57] focus:outline-none focus:border-[#55A529]"
                />
              </div>

              {/* Correo Electrónico Corporativo */}
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold uppercase text-slate-600">
                  Correo Electrónico Corporativo
                </label>
                <input
                  id="input-edit-email"
                  type="email"
                  placeholder="Ej. jperez@camposol.com.pe"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-[#D8E2EA] rounded-full text-xs font-semibold text-[#1B3A57] focus:outline-none focus:border-[#55A529]"
                />
              </div>

              {/* Opción rápida: Cambiar contraseña */}
              <div className="p-3 bg-[#FFF6E0] border border-[#FDE68A] rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-[#B45309] shrink-0" />
                  <span className="text-xs font-semibold text-[#B45309]">
                    ¿Deseas cambiar la contraseña?
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    handleOpenReset(selectedUser);
                  }}
                  className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-full text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cambiar contraseña
                </button>
              </div>

              {/* Rol */}
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold uppercase text-slate-600">
                  Rol *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditForm({ ...editForm, rol: 'usuario' })}
                    className={`p-2.5 rounded-xl border text-center font-semibold text-xs transition-all cursor-pointer ${
                      editForm.rol === 'usuario'
                        ? 'bg-[#EAF7E4] border-[#55A529] text-[#2F7D18] shadow-xs'
                        : 'bg-[#EEF3F7] border-[#E5ECF2] text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Smartphone className="w-4 h-4 mx-auto mb-1" />
                    <span>USUARIO</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditForm({ ...editForm, rol: 'receptor' })}
                    className={`p-2.5 rounded-xl border text-center font-semibold text-xs transition-all cursor-pointer ${
                      editForm.rol === 'receptor'
                        ? 'bg-[#FFF6E0] border-amber-500 text-[#B45309] shadow-xs'
                        : 'bg-[#EEF3F7] border-[#E5ECF2] text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Inbox className="w-4 h-4 mx-auto mb-1" />
                    <span>RECEPTOR</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditForm({ ...editForm, rol: 'admin' })}
                    className={`p-2.5 rounded-xl border text-center font-semibold text-xs transition-all cursor-pointer ${
                      editForm.rol === 'admin'
                        ? 'bg-[#E6F3FB] border-[#0082B3] text-[#0082B3] shadow-xs'
                        : 'bg-[#EEF3F7] border-[#E5ECF2] text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4 mx-auto mb-1" />
                    <span>ADMINISTRADOR</span>
                  </button>
                </div>
              </div>

              {/* Área, Fundo y Cultivo */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold uppercase text-slate-600">
                    Área *
                  </label>
                  <select
                    id="select-edit-area"
                    value={editForm.area}
                    onChange={(e) => setEditForm({ ...editForm, area: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-[#D8E2EA] rounded-full text-xs font-semibold text-[#1B3A57] focus:outline-none focus:border-[#55A529]"
                  >
                    <option value="TODAS LAS ÁREAS">TODAS LAS ÁREAS</option>
                    {areas.map((a) => (
                      <option key={a.id} value={a.area}>
                        {a.area}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold uppercase text-slate-600">
                    Fundo *
                  </label>
                  <select
                    id="select-edit-fundo"
                    value={editForm.fundo}
                    onChange={(e) => setEditForm({ ...editForm, fundo: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-[#D8E2EA] rounded-full text-xs font-semibold text-[#1B3A57] focus:outline-none focus:border-[#55A529]"
                  >
                    <option value="TODOS LOS FUNDOS">TODOS LOS FUNDOS</option>
                    {fundos.map((f) => (
                      <option key={f.id} value={f.fundo}>
                        {f.fundo}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold uppercase text-slate-600 flex items-center gap-1">
                    <Sprout className="w-3.5 h-3.5 text-[#55A529]" />
                    <span>Cultivo *</span>
                  </label>
                  <select
                    id="select-edit-cultivo"
                    value={editForm.cultivo}
                    onChange={(e) => setEditForm({ ...editForm, cultivo: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-[#D8E2EA] rounded-full text-xs font-semibold text-[#1B3A57] focus:outline-none focus:border-[#55A529]"
                  >
                    <option value="TODOS LOS CULTIVOS">TODOS LOS CULTIVOS</option>
                    {MAESTRO_CULTIVOS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Estado */}
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold uppercase text-slate-600">
                  Estado *
                </label>
                <div className="flex gap-4 p-2.5 bg-[#EEF3F7] border border-[#E5ECF2] rounded-xl">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold">
                    <input
                      type="radio"
                      name="edit-estado"
                      checked={editForm.estado === 'ACTIVO'}
                      onChange={() => setEditForm({ ...editForm, estado: 'ACTIVO' })}
                      className="text-[#55A529] focus:ring-[#55A529]"
                    />
                    <span className="text-[#2F7D18]">ACTIVO</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold">
                    <input
                      type="radio"
                      name="edit-estado"
                      checked={editForm.estado === 'INACTIVO'}
                      onChange={() => setEditForm({ ...editForm, estado: 'INACTIVO' })}
                      className="text-[#DC2626] focus:ring-[#DC2626]"
                    />
                    <span className="text-[#DC2626]">INACTIVO</span>
                  </label>
                </div>
              </div>

              {/* Botones GUARDAR, ELIMINAR y CANCELAR */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2.5">
                {selectedUser && selectedUser.id !== currentAdminUser.id ? (
                  <button
                    id="btn-delete-from-edit-modal"
                    type="button"
                    onClick={() => {
                      setIsEditModalOpen(false);
                      handleOpenDelete(selectedUser);
                    }}
                    className="px-3 py-2 text-xs font-semibold text-[#DC2626] hover:bg-[#FDECEC] rounded-full transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Eliminar usuario</span>
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-4 py-2 rounded-full bg-[#F1F5F9] hover:bg-slate-200 text-xs font-semibold text-slate-600 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    id="btn-save-edit-user"
                    type="submit"
                    className="px-5 py-2.5 bg-[#22A846] hover:bg-[#1C8E3A] text-white rounded-full text-xs font-semibold shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>Guardar</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL 3: RESTABLECER CONTRASEÑA                               */}
      {/* ============================================================= */}
      {isResetModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 border border-gray-200">
            {/* Cabecera */}
            <div className="bg-amber-600 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white text-amber-700 flex items-center justify-center shadow-xs">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-100">
                    SEGURIDAD DE ACCESO
                  </span>
                  <h3 className="text-base font-black uppercase tracking-tight">
                    RESTABLECER CONTRASEÑA
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setIsResetModalOpen(false)}
                className="p-1.5 rounded-full text-white/70 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleResetSubmit} className="p-6 space-y-4">
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-2xl text-xs">
                <span className="text-gray-400 font-bold block text-[10px] uppercase">
                  Usuario seleccionado:
                </span>
                <span className="font-bold text-[#1B3A57] text-sm block">
                  {selectedUser.nombre} (@{selectedUser.usuario})
                </span>
              </div>

              {errorMessage && (
                <div className="p-3 bg-[#FDECEC] border border-[#FECACA] rounded-xl text-xs text-[#DC2626] font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Nueva Contraseña */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-semibold uppercase text-slate-600">
                    Nueva contraseña *
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowResetPass(!showResetPass)}
                    className="text-[10px] text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showResetPass ? 'Ocultar' : 'Ver'}
                  </button>
                </div>
                <input
                  id="input-reset-password"
                  type={showResetPass ? 'text' : 'password'}
                  required
                  placeholder="Ingrese nueva contraseña"
                  value={resetForm.nuevaContrasena}
                  onChange={(e) =>
                    setResetForm({ ...resetForm, nuevaContrasena: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 bg-white border border-[#D8E2EA] rounded-full text-xs font-semibold font-mono text-[#1B3A57] focus:outline-none focus:border-[#55A529]"
                />
              </div>

              {/* Confirmar Contraseña */}
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold uppercase text-slate-600">
                  Confirmar nueva contraseña *
                </label>
                <input
                  id="input-reset-confirm-password"
                  type={showResetPass ? 'text' : 'password'}
                  required
                  placeholder="Repita la nueva contraseña"
                  value={resetForm.confirmarContrasena}
                  onChange={(e) =>
                    setResetForm({ ...resetForm, confirmarContrasena: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 bg-white border border-[#D8E2EA] rounded-full text-xs font-semibold font-mono text-[#1B3A57] focus:outline-none focus:border-[#55A529]"
                />
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed">
                La contraseña se almacenará de forma segura con encriptación SHA-256 y salt. Nunca se almacena en texto plano.
              </p>

              {/* Botones */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsResetModalOpen(false)}
                  className="px-4 py-2 rounded-full bg-[#F1F5F9] hover:bg-slate-200 text-xs font-semibold text-slate-600 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  id="btn-save-reset-password"
                  type="submit"
                  className="px-5 py-2 bg-[#22A846] hover:bg-[#1C8E3A] text-white rounded-full text-xs font-semibold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Guardar</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL 4: CONFIRMACIÓN DE ELIMINACIÓN DE USUARIO               */}
      {/* ============================================================= */}
      {isDeleteModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 border border-[#E5ECF2]">
            {/* Cabecera Roja de Alerta */}
            <div className="bg-[#DC2626] text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white text-[#DC2626] flex items-center justify-center shadow-xs">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-red-100">
                    ACCIÓN IRREVERSIBLE
                  </span>
                  <h3 className="text-base font-bold uppercase tracking-tight">
                    ELIMINAR USUARIO
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="p-1.5 rounded-full text-white/70 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido del modal */}
            <div className="p-6 space-y-4">
              {errorMessage && (
                <div className="p-3 bg-[#FDECEC] border border-[#FECACA] rounded-xl text-xs text-[#DC2626] font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <p className="text-xs text-slate-600 leading-relaxed">
                ¿Está seguro de que desea eliminar permanentemente este usuario del sistema? Esta acción eliminará su cuenta de acceso de forma definitiva.
              </p>

              {/* Ficha resumen del usuario a eliminar */}
              <div className="p-4 bg-[#FDECEC]/60 border border-[#FECACA] rounded-2xl space-y-1.5 text-xs">
                <div className="flex justify-between items-center pb-2 border-b border-red-200/60">
                  <span className="font-semibold text-slate-500 text-[10px] uppercase tracking-wider">
                    Nombre Completo
                  </span>
                  <span className="font-bold text-[#1B3A57] text-sm">
                    {selectedUser.nombre}
                  </span>
                </div>

                <div className="flex justify-between items-center pt-1">
                  <span className="font-bold text-gray-500 text-[10px] uppercase tracking-wider">
                    Usuario
                  </span>
                  <span className="font-mono font-bold text-red-700 bg-white px-2 py-0.5 rounded border border-red-200">
                    @{selectedUser.usuario}
                  </span>
                </div>

                <div className="flex justify-between items-center pt-1">
                  <span className="font-bold text-gray-500 text-[10px] uppercase tracking-wider">
                    Rol Asignado
                  </span>
                  <span className="font-black uppercase text-gray-700">
                    {selectedUser.rol}
                  </span>
                </div>

                <div className="flex justify-between items-center pt-1">
                  <span className="font-bold text-gray-500 text-[10px] uppercase tracking-wider">
                    Área / Fundo / Cultivo
                  </span>
                  <span className="font-semibold text-gray-600">
                    {selectedUser.area} • {selectedUser.fundo} • {selectedUser.cultivo || 'ARÁNDANO'}
                  </span>
                </div>
              </div>

              {/* Botones de acción */}
              <div className="pt-4 border-t border-gray-150 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-gray-600 hover:text-gray-800 uppercase tracking-wider transition-colors cursor-pointer"
                >
                  CANCELAR
                </button>
                <button
                  id="btn-confirm-delete-user"
                  type="button"
                  onClick={handleDeleteConfirm}
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>SÍ, ELIMINAR</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

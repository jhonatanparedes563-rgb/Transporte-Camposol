# Directivas Obligatorias del Proyecto - CAMPOSOL Transporte

## 1. PRINCIPIO DE INMUTABILIDAD Y CONGELAMIENTO (BASELINE LOCK)
- **ESTADO APROBADO CONGELADO**: Todo lo implementado y probado hasta la fecha queda formalmente BLINDADO y CONGELADO.
- Queda **TERMINANTEMENTE PROHIBIDO** modificar, alterar, refactorizar, mover, renombrar o eliminar cualquier pantalla, componente, vista, texto, cálculo, KPI o lógica existente a menos que el usuario lo solicite de manera **explícita y específica** en su mensaje.
- Si el usuario no pide expresamente modificar un componente o pantalla puntual, ese componente es considerado **DE SOLO LECTURA E INTOCABLE**.

## 2. COMPONENTES Y MÓDULOS BAJO PROTECCIÓN ESTRICTA
1. **Reportes & Analítica (`PowerBIAnalyticsView.tsx`)**:
   - 5 KPIs gerenciales (Personal Total, Requerimientos, Fundos Activos, Paraderos Activos, Balance Zonal).
   - Filtros de fecha inicializados por defecto en la fecha del día actual ("Hoy") con selector libre para cambio.
   - Demanda por Horario, Distribución Zonal (Norte/Sur), Flujo (Ingreso/Salida), Top Paraderos, Tabla de Detalle y Exportación.
   - Cero menciones de buses o cálculos hipotéticos de flota no solicitados.
2. **Portal Administrativo (`AdminPortalLayout.tsx`)**:
   - KPIs de Procesos (Solicitudes, Pendientes, Aprobados, Atendidos, Total Personal).
   - Bandeja de requerimientos con filtros, ordenamiento, detalle modal y acciones de estado (Aprobar, Atender, Rechazar).
   - Exportación Excel optimizada (`ExportExcelOptionsModal.tsx` y `excelExportService.ts`) orientada a sumas de pasajeros reales.
3. **Flujo Móvil Solicitante (`UserMobileLayout.tsx`, `UserHomeScreen.tsx`, `NewRequirementWizard.tsx`, `MyRequirementsScreen.tsx`)**:
   - Wizard por pasos (Área, Fundo, Comedor, Paraderos con conteo numérico de pasajeros).
   - Consulta de mis solicitudes y seguimiento.
4. **Módulos de Control y Maestros (`MasterDataManagementScreen.tsx`, `UserManagementScreen.tsx`)**:
   - Catálogos maestros protegidos (Paraderos, Fundos, Áreas, Comedores).
   - Gestión de usuarios y credenciales operativas.

## 3. AISLAMIENTO QUIRÚRGICO DE MODIFICACIONES
- Cuando el usuario solicite un cambio o ajuste:
  - Identificar ÚNICAMENTE el archivo y la línea puntual a cambiar.
  - Aplicar el cambio mínimo estrictamente indispensable para cumplir con la orden.
  - Prohibido agregar "mejoras" no solicitadas, suposiciones de negocio, o tocar otros módulos.

## 4. PROTECCIÓN ABSOLUTA DE DATOS HISTÓRICOS Y CATÁLOGOS
- NUNCA alterar, sobreescribir, reiniciar ni manipular los datos maestros ni los requerimientos históricos guardados en Firestore, SQLite, servidor o LocalStorage.
- Cero regresiones en datos reales.


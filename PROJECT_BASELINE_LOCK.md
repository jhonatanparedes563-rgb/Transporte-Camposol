# CAMPOSOL TRANSPORTE - BASELINE DE CONTROL Y CONGELAMIENTO (PROJECT LOCK)

Fecha de Bloqueo: 2026-09-27
Estado: APROBADO Y CONGELADO

---

## POLÍTICA DE INMUTABILIDAD ESTRICTA (ZERO-UNSOLICITED-CHANGES)

Este documento establece la línea base formal de todo lo construido y aprobado en el sistema CAMPOSOL Transporte.

Cualquier agente, desarrollador o proceso debe seguir obligatoriamente estas reglas:

1. **PROHIBIDO MODIFICAR NADA SIN ORDEN EXPLÍCITA**:
   - Todo módulo, componente, función, estilo y cálculo existente es considerado **INMUTABLE**.
   - No se realizarán refactorizaciones, "limpiezas", rediseños ni adiciones espontáneas.
   - Solo se modificará una línea de código si el usuario indica de forma unívoca y precisa el detalle a alterar.

2. **PROTECCIÓN TOTAL DE DATOS**:
   - Prohibido resetear, sobrescribir o alterar tablas de Firestore, SQLite o almacenamiento local de datos maestros (paraderos, fundos, comedores, áreas) o de solicitudes históricas.

---

## MÓDULOS CONGELADOS Y SUS CARACTERÍSTICAS APROBADAS

### 1. Reportes & Analítica (Power BI Style - `PowerBIAnalyticsView.tsx`)
- **Filtro Temporal**: Por defecto inicializa en el día actual (`getTodayStr()`), con campos interactivos editables para elegir cualquier fecha o rango libre, y botones rápidos (Hoy, Ayer, Mañana, Todo).
- **KPIs Principales**: 5 tarjetas exactas (Personal Total, Requerimientos, Fundos Activos, Paraderos Activos, Balance Zonal).
- **Sin Estimación de Flota**: Sin tarjetas de buses ni cálculos no sustentados en demanda confirmada.
- **Gráficos**: Demanda por Horario (franjas horarias), Distribución Zonal (SUR vs NORTE), Flujo Operativo (Ingreso vs Salida), Top Paraderos.
- **Tabla Analítica**: Paginada, búsqueda reactiva, exportación en Excel estructurada y botón de impresión.

### 2. Portal Administrativo / Coordinación Central (`AdminPortalLayout.tsx`)
- **Bandeja de Procesos**: KPIs de Solicitudes, Pendientes, Aprobados, Atendidos y Total Pasajeros a movilizar.
- **Filtros de Procesos**: Filtro por texto, fecha, turno, fundo, movimiento y estado operativo.
- **Modal de Detalle & Acciones**: Visualización de paraderos y comedores, aprobación, atención con registro de fecha/hora y rechazo con motivo justificado.
- **Exportación Excel Optimizada (`ExportExcelOptionsModal.tsx` / `excelExportService.ts`)**: Hojas orientadas a sumas directas de pasajeros con formato limpio para fórmulas `=SUMA()`.

### 3. Flujo Móvil Solicitante (`UserMobileLayout.tsx`, `UserHomeScreen.tsx`, `NewRequirementWizard.tsx`)
- **Identificación**: Detección de usuario logueado con área pre-cargada.
- **Wizard de Registro**:
  - Paso 1: Fundo, Turno, Horario, Tipo de Movimiento (Ingreso/Salida), Comedor.
  - Paso 2: Selección de paraderos organizados por zona (Norte/Sur) con conteo individual de pasajeros por paradero.
  - Paso 3: Resumen de solicitud y confirmación con código correlativo (`REQ-XXXX`).
- **Mis Solicitudes**: Listado filtrado exclusivamente a los requerimientos del usuario solicitante, con estado en tiempo real (Pendiente, Aprobado, Atendido, Rechazado).

### 4. Mantenimiento de Maestros y Usuarios
- **Maestros (`MasterDataManagementScreen.tsx`)**: Paraderos con georreferenciación y zona (SUR/NORTE), Fundos, Áreas y Comedores.
- **Usuarios (`UserManagementScreen.tsx`)**: Control de accesos por roles (`admin`, `receptor`, `usuario`), credenciales operativas y restablecimiento seguro.

---

Cualquier cambio futuro deberá limitarse estrictamente al componente o línea puntual que el usuario solicite explícitamente.

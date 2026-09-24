# Directivas Obligatorias del Proyecto - CAMPOSOL Transporte

1. **Principio de Modificación Exclusiva y Estricta (Aislamiento Quirúrgico)**:
   - Modificar ÚNICAMENTE el elemento, componente o línea puntual que el usuario solicite de forma explícita en su mensaje.
   - Si el usuario pide cambiar algo, solo se debe cambiar EXACTAMENTE lo pedido.
   - Queda ESTRICTAMENTE PROHIBIDO realizar cambios colaterales, refactorizaciones no solicitadas, adiciones "proactivas", "mejoras" de diseño no pedidas o tocar componentes ajenos al pedido puntual.

2. **Protección Absoluta e Inviolabilidad de Datos**:
   - NUNCA alterar, sobreescribir, reiniciar ni manipular los datos maestros (paraderos, fundos, áreas, comedores) ni los requerimientos históricos guardados por el usuario en Firestore, SQLite, servidor o LocalStorage.
   - Prohibido modificar catálogos, rutas o tablas de base de datos a menos que el usuario lo ordene expresamente.

3. **Alcance Mínimo y Cero Regresiones**:
   - Ajustarse estrictamente al alcance del requerimiento inmediato sin tocar código previo ya probado y aprobado.
   - Preservar al 100% la funcionalidad existente y la interfaz aprobada.

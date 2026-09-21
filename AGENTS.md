# Directivas del Proyecto - CAMPOSOL Transporte

1. **Modificaciones Quirúrgicas y Puntuales**:
   - Realizar modificaciones ÚNICAMENTE en el componente, pantalla o línea específica que el usuario solicite explícitamente.
   - Prohibido realizar refactorizaciones no solicitadas o cambios colaterales en secciones donde ya se ha trabajado.

2. **Protección Total de Datos Maestros**:
   - NUNCA alterar, sobreescribir, reiniciar ni manipular los datos maestros (paraderos, fundos, áreas, comedores) guardados por el usuario o en Firestore/LocalStorage.
   - Mantener intactas las tablas de maestros y la persistencia de configuraciones existentes.

3. **Alcance Estricto**:
   - Ajustarse estrictamente a lo pedido por el usuario, sin añadir ni modificar lógica previa ya validada y aprobada.

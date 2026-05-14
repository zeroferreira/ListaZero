# ListaZero - Reglas de Negocio de Estadísticas

Este documento define cómo deben calcularse las estadísticas del perfil musical para mantener la integridad de los datos.

## 📊 Definiciones de Estadísticas

### 1. Canciones Pedidas (Requested)
- **Definición**: Es el conteo total de veces que un usuario ha solicitado una canción en la historia del canal.
- **Regla de Oro**: Este número **SIEMPRE** debe ser mayor o igual al de "Canciones Reproducidas".
- **Cálculo**: Se busca el nombre del usuario (y todos sus alias fusionados) en la colección de `solicitudes`. Si por algún error de base de datos el conteo es menor al de reproducidas, se igualará al de reproducidas para mantener la coherencia lógica.

### 2. Canciones Reproducidas (Played)
- **Definición**: Es el conteo de canciones que fueron marcadas con el **toggle de reproducción** (marcado como sonado).
- **Cálculo**: Se basa en la colección `userStats` (campo `playedSongs`) y eventos de sistema `togglePlayed`.

### 3. Artistas Únicos
- **Definición**: Cantidad de artistas diferentes que el usuario ha solicitado.
- **Cálculo**: Se extrae de la lista única de artistas en sus solicitudes históricas.

### 4. Días Activos
- **Definición**: Cantidad de días distintos en los que el usuario ha pedido al menos una canción.
- **Cálculo**: Basado en el campo `day` o `fecha` de las solicitudes.

## 🛠️ Notas de Implementación
- Todas las consultas deben considerar los **IDs Fusionados** (alias) para evitar conteos parciales.
- El renderizado de la UI debe esperar a que los cálculos asíncronos terminen para evitar mostrar valores en `0` o `...`.

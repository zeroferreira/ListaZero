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

---

## 🚀 Correcciones y Mejoras Recientes

### 1. Corrección del Efecto de Desenfoque (Blur) en el Menú
* **Problema:** El filtro de desenfoque (`backdrop-filter`) original estaba anidado dentro de un contenedor con su propio contexto de apilamiento, lo que limitaba el desenfoque únicamente a los iconos de la cabecera.
* **Solución:** Implementamos un control de estado global mediante la clase `menu-active` en el `<body>`. Aplicamos transiciones fluidas de `filter` y `opacity` en `styles.css` a componentes principales (lista de canciones, controles, título, caja de búsqueda, etc.). Al activarse el menú, todo el fondo se desenfoca suavemente (`blur(8px)`) y se bloquean eventos de puntero, manteniendo el menú dropdown 100% nítido, legible e interactivo en primer plano.

### 2. Sincronización Bidireccional de Puntos (Cuentas Fusionadas/Vinculadas)
* **Problema:** Había una asimetría matemática entre cuentas enlazadas (por ejemplo, al iniciar sesión como usuario Web vs. usuario de TikTok), provocando pérdidas de bono VIP, duplicación por conteo múltiple de likes/regalos/ajustes manuales en bucles basados en la fusión, e inflación en tiempo real por listeners que sumaban en lugar de consolidar.
* **Solución:**
  * **Helper `fetchIndividualUserStatsDoc`:** Creado para consultar datos puros de un solo alias en Firestore sin disparar la fusión automática interna.
  * **Símétria VIP y Local:** Las verificaciones de rango VIP, fechas de activación de beneficios VIP, y la caché de sesión local (`localData`) ahora se realizan sobre la unión completa de todos los `fusedIds`.
  * **Consolidación sin Duplicados:** Sustituimos las funciones recursivas en los bucles de check-ins, likes, regalos, insignias y bonos manuales por el helper puro, consolidando con precisión los aportes de cada cuenta.
  * **Insignias Optimizadas:** Compartimos un set único (`finalAchievementIds`) para el conteo de puntos y para la renderización de la lista visual de insignias, ahorrando lecturas a Firestore y garantizando el mismo listado visual en todos los perfiles vinculados.
  * **Consolidación por Máximos (`Math.max`):** Cambiamos el resolvedor de puntos y el suscriptor en tiempo real para utilizar `Math.max` en lugar de sumas aritméticas simples (`+`), ya que el documento principal de Firestore ya contiene el consolidado exacto reconstruido. Esto estabiliza las cabeceras y los desgloses en toda la aplicación.

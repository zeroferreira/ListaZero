# Ideas por tema (Zero FM)

Este documento concentra ideas, decisiones pendientes y criterios para que el sistema siga escalando cuando la audiencia crece.

## 1) Tandas / Rounds / Vueltas (lo nuevo)

### Objetivo
- Reducir esperas extremas.
- Evitar que 1–2 usuarios “acaparen” la cola.
- Mantener beneficios VIP sin romper la experiencia de nuevos usuarios.

### Modelo base (por tiempo)
- Crear tandas de 15 minutos.
- Cada solicitud se asigna a una tanda por su hora de entrada.
- La lista muestra separadores por tanda y/o un borde agrupador con el color de acento.

### Reglas que suelen funcionar (combinar)
- Cupo por usuario por tanda (ej.: 1; Super VIP: 2).
- Intercalado por niveles (no “todos los VIP primero” en bloque).
- Bonus por espera (si alguien lleva demasiado, va subiendo prioridad).

### Decisiones pendientes
- Orden de jerarquía oficial (ver sección 2).
- Definir cupos exactos por usuario por tanda.
- Definir si “Top Liker” es permanente del día o de la sesión.
- Definir qué pasa cuando una tanda termina: ¿se congela y se respeta o se mezcla con la siguiente?

## 2) Jerarquía VIP (oficial) y explicación pública

### Insignias implementadas hoy (web)
- z0-platino
- z0-vip
- vip
- donador (temporal)
- z0-fan

### Insignias de sesión (principalmente del bot/cola)
- donador-oro / donador-plata / donador-bronce (Top 3 donadores de la sesión)

### TikTok Superfan (máximo nivel del live)
- Se considera el nivel más alto en el live.
- Pendiente: integrar una fuente de datos para listar automáticamente quiénes lo tienen.

### Propuesta de jerarquía base (para ordenar y resolver “quién va primero”)
1) TikTok Superfan (live)
2) z0-platino
3) z0-vip
4) vip
5) donador
6) z0-fan
7) normal

### Regla de visualización recomendada
- Cada usuario puede tener varias insignias, pero muestra una “principal”.
- Prioridad: selección del usuario (si existe) > jerarquía oficial > ninguna.

## 3) Banda de información (ticker)

### Problema detectado
- Usuarios veían top artista/canción diferentes por usar cálculo local con localStorage.

### Decisión
- Top artista/canción global deben venir solo de Firestore (globalStats/general), sin fallback local.

### Widget OBS
- Banda separada como HTML dedicado para agregar en OBS (Browser Source).

## 4) Overlay de cola (queue_overlay)

### Mejoras visuales
- Destello alrededor del contorno de tarjetas (shine/sweep).
- Corrección para que el estilo “más atenuado” aplique a todas las tarjetas desde la 3ª en adelante, aunque aumente el máximo.

## 5) Insignias en tarjetas (cola y overlay)

### Problema histórico
- Insignias no aparecían por depender de matching entre colecciones.

### Decisión
- Escribir el campo `badge` directamente en cada solicitud para que overlays lean un único origen.

## 6) Ideas futuras (pendientes de diseño)

- Tandas con intercalado por niveles + cupos por usuario.
- Ruleta: VIP y Superfan tienen 1 canción en prioridad; luego entran a la ruleta como todos. Solo Superfan puede “tirar” 2 veces (doble probabilidad).
- Vista pública de jerarquía con listas por insignia (para transparencia).
- Integración real de TikTok Superfan a Firestore para poder listarlo y usarlo en prioridad.

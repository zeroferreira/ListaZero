# 🎵 Zero FM - ListaZero
> **Sistema de Gestión de Cola de Canciones y Overlays Profesionales para Streaming**

[![GitHub v2.2](https://img.shields.io/badge/Version-2.2-blueviolet?style=for-the-badge&logo=github)](https://github.com/zeroferreira/ListaZero)
[![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)

---

## 🚀 Descripción General
**ListaZero** es un ecosistema integral diseñado para streamers (específicamente optimizado para TikTok Live y entornos web) que permite la gestión automatizada de peticiones musicales. El sistema combina una interfaz de usuario intuitiva para los espectadores con un panel administrativo robusto y overlays visualmente impactantes en tiempo real.

## ✨ Características Principales
*   **Gestión en Tiempo Real**: Sincronización instantánea mediante **Firebase Firestore**.
*   **Panel Administrativo Avanzado**: Control total sobre la lista de reproducción, estados de las canciones (reproducidas/omitidas) y orden dinámico.
*   **Sistema de Gamificación**: Puntos, rachas (streaks), insignias (VIP, Superfan) y recompensas personalizadas.
*   **Vinculación Multi-Cuenta**: Integración de perfiles de TikTok y Web para unificar estadísticas y puntos.
*   **Overlays Inmersivos**: Pantallas dinámicas con fondos de partículas animados (`particles.js`) y efectos visuales premium.
*   **Modo DJ Maestro**: Control centralizado que sincroniza el estado "En Vivo" y el código de acceso entre múltiples dispositivos.

---

## 📂 Estructura del Proyecto

### 🖥️ Interfaces de Usuario
*   [`index.html`](index.html): Portal principal donde los usuarios buscan y solicitan canciones.
*   [`lista.html`](lista.html): Centro de mando administrativo. Incluye gestión de VIPs, mantenimiento de sistema y canje de recompensas.

### 🎨 Visuales y Overlays
*   [`overlay.html`](overlay.html): Overlay principal para la canción que suena actualmente.
*   [`queue_overlay.html`](queue_overlay.html): Visualización de la lista de espera (próximas canciones y tiempos).
*   [`particles.js`](particles.js): Motor de partículas interactivo para fondos dinámicos.

### ⚙️ Lógica y Estilos
*   [`styles.css`](styles.css): Sistema de diseño global y temas (Dark/Light).
*   [`stats_ticker_widget.html`](stats_ticker_widget.html): Widget de estadísticas globales en tiempo real.
*   [`tiktok_bot.js`](tiktok_bot.js): Integración con TikTok Live Connector para lectura de eventos.

---

## 🔧 Configuración Técnica

### Firebase
El sistema utiliza Firebase para la persistencia de datos. Asegúrate de configurar las reglas de seguridad en `firestore.rules` para proteger las colecciones:
*   `solicitudes`: Almacena las peticiones de canciones por día.
*   `users`: Perfiles, puntos e insignias.
*   `system/status`: Estado global del streaming (online/offline).
*   `globalStats`: Agregados para el ticker de noticias.

### Modo Admin
Para acceder a las funciones avanzadas en `lista.html`, se requiere autenticación mediante el panel de login integrado, el cual activa los permisos de "Master DJ" basados en el fingerprint del dispositivo.

---

## 🛠️ Desarrollo Reciente (v2.2)
*   **Scroll Fix**: Optimización completa del panel administrativo para navegación táctil y de escritorio sin afectar la cabecera fija.
*   **UI Dinámica**: Implementación de `overscroll-behavior` y `-webkit-overflow-scrolling` para una sensación de aplicación nativa.
*   **Consolidación de Identidad**: Sistema mejorado de alias para unificar puntos de TikTok y Web.

---

## 📝 Licencia
Este proyecto es de uso privado para **Zero FM**. Todos los derechos reservados.

---
*Desarrollado con ❤️ por Zero Ferreira & Antigravity AI*

/**
 * Zero FM - Utility Functions
 * v2.1 Modular
 */

(function () {
    console.log('📦 Cargando utilidades...');

    /**
     * Genera un hash numérico a partir de una cadena
     */
    window.hashCode = function(str) {
        let hash = 0;
        if (!str) return hash;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash;
    };

    /**
     * Generador de números aleatorios con semilla
     */
    window.seedRandom = function(seed) {
        return function () {
            seed = (seed * 9301 + 49297) % 233280;
            return seed / 233280;
        };
    };

    /**
     * Obtiene una fecha válida desde un objeto de documento (Firestore o Local)
     */
    window.getValidDate = function(item) {
        if (!item) return null;
        const dateFields = ['ts', 'timestamp', 'time', 'day', 'created', 'date', 'createdAt'];
        for (const field of dateFields) {
            if (item[field]) {
                try {
                    let date;
                    if (item[field].toDate && typeof item[field].toDate === 'function') {
                        date = item[field].toDate();
                    } else if (item[field].seconds) {
                        date = new Date(item[field].seconds * 1000);
                    } else if (typeof item[field] === 'string' || typeof item[field] === 'number') {
                        date = new Date(item[field]);
                    } else {
                        date = new Date(item[field]);
                    }
                    if (date && !isNaN(date.getTime())) return date;
                } catch (e) {}
            }
        }
        return null;
    };

    /**
     * Obtiene el usuario actual desde el almacenamiento local
     */
    window.getCurrentUser = function() {
        try {
            return localStorage.getItem('currentUser') || 'Usuario';
        } catch (e) {
            return 'Usuario';
        }
    };

    /**
     * Muestra una notificación tipo Toast en pantalla
     */
    window.showNotification = function(message, type = 'info') {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            document.body.appendChild(container);
        }
        const toast = document.createElement('div');
        toast.className = `toast-notification ${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        toast.offsetHeight; // force reflow
        requestAnimationFrame(() => toast.classList.add('show'));
        setTimeout(() => {
            toast.classList.remove('show');
            toast.addEventListener('transitionend', () => toast.remove());
        }, 3000);
    };

    console.log('✅ Utilidades cargadas correctamente');
})();

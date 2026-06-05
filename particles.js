function initParticles() {
  console.log('✨ particles.js: Inicializando...');
  var canvas = document.getElementById('orb-background');
  if (!canvas) {
    console.warn('⚠️ particles.js: No se encontró el canvas #orb-background');
    return;
  }
  var ctx = canvas.getContext('2d');
  if (!ctx) return;
  var width = 0;
  var height = 0;
  var dpr = window.devicePixelRatio || 1;
  var particles = [];
  var particleCount = 600;
  var lastTime = 0;
  var rotationX = 0;
  var rotationY = 0;
  var velocityX = 0.00015;
  var velocityY = 0.00025;
  var lastScrollY = window.scrollY || 0;
  var cachedListScroll = null;
  var currentShape = localStorage.getItem('selectedShape') || 'orb';

  function hexToRgba(hex, alpha) {
    if (!hex) return hex;
    // Si ya es rgb/rgba, solo asegurarnos de que tenga el alpha correcto si es posible, o devolverlo
    if (hex.startsWith('rgb')) {
       if (hex.startsWith('rgba')) {
         // Reemplazar último valor
         return hex.replace(/[\d\.]+\)$/g, alpha + ')');
       } else {
         return hex.replace(')', ', ' + alpha + ')').replace('rgb', 'rgba');
       }
    }
    if (hex[0] !== '#') return hex;
    if (hex.length === 4) {
      hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
    }
    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);
    return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + alpha + ')';
  }

  function getSpherePoint(r) {
    var u = Math.random();
    var v = Math.random();
    var theta = 2 * Math.PI * u;
    var phi = Math.acos(2 * v - 1);
    // Aumentar radio para igualar visualmente al teseracto (aprox 1.3x - reducido de 1.6x)
    var rr = r * 1.3 * (0.8 + 0.2 * Math.random());
    return {
      x: rr * Math.sin(phi) * Math.cos(theta),
      y: rr * Math.cos(phi),
      z: rr * Math.sin(phi) * Math.sin(theta)
    };
  }

  function getTrianglePoint(r) {
    // Ajustar escala del triángulo (reducido ligeramente a 0.9x)
    var s = r * 0.9;
    var verts = [
      {x: s, y: s, z: s},
      {x: -s, y: -s, z: s},
      {x: -s, y: s, z: -s},
      {x: s, y: -s, z: -s}
    ];
    var f = Math.floor(Math.random() * 4);
    var p1 = verts[f];
    var p2 = verts[(f + 1) % 4];
    var p3 = verts[(f + 2) % 4];
    var a = Math.random();
    var b = Math.random();
    if (a + b > 1) { a = 1 - a; b = 1 - b; }
    var x = p1.x + a * (p2.x - p1.x) + b * (p3.x - p1.x);
    var y = p1.y + a * (p2.y - p1.y) + b * (p3.y - p1.y);
    var z = p1.z + a * (p2.z - p1.z) + b * (p3.z - p1.z);
    var noise = (Math.random() - 0.5) * r * 0.1;
    return {x: x + noise, y: y + noise, z: z + noise};
  }

  function getHexagonPoint(r) {
    // Reducir escala del teseracto (aprox 20% menos)
    var sizeOuter = r * 0.8;
    var sizeInner = r * 0.48;
    var useInner = Math.random() < 0.5;
    var s = useInner ? sizeInner : sizeOuter;
    var axis = Math.floor(Math.random() * 3);
    var sign1 = Math.random() < 0.5 ? -1 : 1;
    var sign2 = Math.random() < 0.5 ? -1 : 1;
    var t = Math.random() * 2 - 1;
    var x, y, z;
    if (axis === 0) {
      x = t * s;
      y = sign1 * s;
      z = sign2 * s;
    } else if (axis === 1) {
      y = t * s;
      x = sign1 * s;
      z = sign2 * s;
    } else {
      z = t * s;
      x = sign1 * s;
      y = sign2 * s;
    }
    var noise = (Math.random() - 0.5) * r * 0.1;
    return {x: x + noise, y: y + noise, z: z + noise};
  }

  function getTargetPoint(r) {
    if (currentShape === 'triangle') return getTrianglePoint(r);
    if (currentShape === 'hexagon') return getHexagonPoint(r);
    return getSpherePoint(r);
  }

  function createParticles() {
    var style = getComputedStyle(document.body);
    var accentHex = style.getPropertyValue('--accent-color').trim();
    var isDark = document.body.classList.contains('dark-theme') || document.documentElement.getAttribute('data-theme') === 'dark';
    
    // Usar color de acento si existe, sino fallback a azul
    if (!accentHex || accentHex === 'initial') {
         accentHex = '#007bff';
    }
    
    var accentRgba = hexToRgba(accentHex, 0.9); // Opacidad casi total
    var exists = particles.length > 0;
    var isMobile = window.innerWidth <= 600;
    
    // Obtener cantidad de partículas guardada o usar default
    var savedCount = localStorage.getItem('particleCount');
    var defaultCount = isMobile ? 250 : 600; // Reducido para fluidez en scroll
    var targetCount = savedCount ? parseInt(savedCount) : defaultCount;
    
    if (particles.length !== targetCount) {
       particles = [];
       exists = false;
       particleCount = targetCount;
    }
    
    for (var i = 0; i < particleCount; i++) {
      var t = i / particleCount;
      var color;
      
      // 60% de partículas usan el color de acento
      if (Math.random() < 0.6 && accentRgba) {
        color = accentRgba;
      } else {
        // El resto usa una variación complementaria o grisácea dependiendo del tema
        var hue = 200 + 160 * t;
        // En modo oscuro usar luminosidad y alpha altos
        var lightness = isDark ? '85%' : '60%'; 
        var alpha = isDark ? 0.95 : 0.85;
        color = 'hsla(' + hue + ', 90%, ' + lightness + ', ' + alpha + ')';
      }
      
      var size = (isMobile ? 2.5 : 2) + Math.random(); // Ligeramente más grandes
      var target = getTargetPoint(baseRadius);
      
      if (!exists) {
         particles.push({ 
            x: target.x, y: target.y, z: target.z, 
            tx: target.x, ty: target.y, tz: target.z,
            color: color, size: size 
         });
      } else {
         particles[i].color = color;
         particles[i].tx = target.x;
         particles[i].ty = target.y;
         particles[i].tz = target.z;
         particles[i].size = size;
      }
    }
  }

  // Observar cambios de tema para regenerar colores
  var observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      if (mutation.attributeName === 'class' || mutation.attributeName === 'data-theme') {
         setTimeout(createParticles, 50);
      }
    });
  });
  observer.observe(document.body, { attributes: true });
  observer.observe(document.documentElement, { attributes: true });

  // Exponer función para actualizar partículas desde fuera
  window.updateParticleSystem = function() {
    particles = [];
    createParticles();
  };
  
  // Escuchar cambios de tema (color, transparencia, etc) disparados por el menú
  window.addEventListener('themeChanged', function() {
    // Pequeño delay para asegurar que el DOM/CSS se haya actualizado
    setTimeout(createParticles, 50);
  });

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    baseRadius = Math.min(width, height) * 0.35;
    dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    createParticles();
  }

  function renderFrame(time) {
    if (!lastTime) lastTime = time;
    var delta = time - lastTime;
    lastTime = time;
    
    // Movimiento base tenue (idle) + velocidad dinámica
    rotationX += (velocityX + 0.00005) * delta;
    rotationY += (velocityY + 0.0001) * delta;
    
    velocityX *= 0.98;
    velocityY *= 0.98;
    ctx.clearRect(0, 0, width, height);
    // Centrar partículas en el viewport real
    var centerX = width / 2;
    var centerY = height / 2;
    var cosX = Math.cos(rotationX);
    var sinX = Math.sin(rotationX);
    var cosY = Math.cos(rotationY);
    var sinY = Math.sin(rotationY);
    var fov = baseRadius * 2;
    // ❌ projected array eliminado: sort() era O(n log n) en cada frame
    // Ahora usamos depth fade por alpha (O(1) por partícula)
    
    // Factor de interpolación para transiciones suaves (lerp)
    var lerpFactor = 0.05;

    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      
      // Actualizar posición hacia el objetivo (transición de forma)
      p.x += (p.tx - p.x) * lerpFactor;
      p.y += (p.ty - p.y) * lerpFactor;
      p.z += (p.tz - p.z) * lerpFactor;
      
      var x = p.x;
      var y = p.y;
      var z = p.z;
      var x1 = x * cosY + z * sinY;
      var z1 = -x * sinY + z * cosY;
      var y1 = y * cosX - z1 * sinX;
      var z2 = y * sinX + z1 * cosX;
      var scale = fov / (fov + z2 + baseRadius);
      var px = centerX + x1 * scale;
      var py = centerY + y1 * scale;
      // Depth fade por alpha en lugar de sort() — O(1) por partícula
      var depthAlpha = Math.min(1, Math.max(0.15, (z2 + baseRadius) / (baseRadius * 2)));
      var sz = p.size * scale;
      ctx.globalAlpha = depthAlpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(px, py, sz, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    window.requestAnimationFrame(renderFrame);
  }

  function handleScroll() {
    if (!cachedListScroll) {
      cachedListScroll = document.querySelector('.list-scroll-container');
    }
    var y = cachedListScroll ? cachedListScroll.scrollTop : (window.scrollY || 0);
    var delta = y - lastScrollY;
    lastScrollY = y;
    velocityY += delta * 0.000002;
    velocityX += delta * 0.000001;
  }

  function boostRotation() {
    velocityY += 0.003 * (Math.random() > 0.5 ? 1 : -1);
    velocityX += 0.003 * (Math.random() > 0.5 ? 1 : -1);
  }

  // Escuchar cambios de forma desde el modal de temas
  window.addEventListener('shapeChanged', function(e) {
    if (e.detail && e.detail.shape) {
      currentShape = e.detail.shape;
      createParticles();
    }
  });

  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);
  window.addEventListener('pointerdown', boostRotation, { passive: true });
  window.addEventListener('touchstart', boostRotation, { passive: true });
  
  // Escuchar scroll tanto en window como en el contenedor de la lista
  window.addEventListener('scroll', handleScroll, { passive: true });
  cachedListScroll = document.querySelector('.list-scroll-container');
  if (cachedListScroll) {
    cachedListScroll.addEventListener('scroll', handleScroll, { passive: true });
  }
  window.requestAnimationFrame(renderFrame);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initParticles);
} else {
  initParticles();
}

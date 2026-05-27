/**
 * ==========================================================================
 * Lógica de Animación GSAP - Video Promocional NextProf.AI
 * Diseñado especialmente para la renderización determinista en HyperFrames
 * ==========================================================================
 */

// Inicializar el objeto global de timelines requerido por HyperFrames
window.__timelines = window.__timelines || {};

// Crear el timeline principal (pausado, controlado por el motor de fotogramas)
const tl = gsap.timeline({ paused: true });

// Registrar el timeline con el ID de composición exacto
window.__timelines["nextprof-promo"] = tl;

// Helper para alternar la visibilidad de las escenas de forma limpia
function activateScene(sceneId) {
  const scenes = ["#scene-1", "#scene-2", "#scene-3", "#scene-4"];
  scenes.forEach(id => {
    if (id === sceneId) {
      document.querySelector(id).classList.add("active");
    } else {
      document.querySelector(id).classList.remove("active");
    }
  });
}

// ==========================================================================
// ESCENA 1: EL PROBLEMA (0.0s - 5.0s)
// ==========================================================================

// Al inicio (tiempo 0s), activar la Escena 1
tl.add(() => activateScene("#scene-1"), 0);

// Animación de textos del problema
tl.fromTo(".headline-s1", 
  { opacity: 0, y: 50 }, 
  { opacity: 1, y: 0, duration: 1, ease: "power3.out" }, 
  0.2
);
tl.fromTo(".body-s1", 
  { opacity: 0, y: 30 }, 
  { opacity: 1, y: 0, duration: 1, ease: "power3.out" }, 
  0.5
);

// Animación del CV y líneas internas
tl.fromTo(".bad-cv", 
  { opacity: 0, scale: 0.9, rotateY: -15 }, 
  { opacity: 1, scale: 1, rotateY: 0, duration: 1.2, ease: "back.out(1.2)" }, 
  0.4
);

// Animación del Escáner Láser Rojo (Escaneo de arriba a abajo)
tl.fromTo(".scanner-red", 
  { y: -10 }, 
  { y: 740, duration: 2.2, ease: "power1.inOut" }, 
  1.0
);

// Desvanecer el láser al final del escaneo
tl.to(".scanner-red", { opacity: 0, duration: 0.3 }, 3.1);

// Sello de ATS Rejected (Estampado con rebote e impacto visual)
tl.fromTo(".badge-rejected", 
  { opacity: 0, scale: 2.2 }, 
  { opacity: 1, scale: 1, duration: 0.6, ease: "bounce.out" }, 
  3.2
);

// Mantener la escena estable hasta el final de su duración (5s)
tl.to({}, { duration: 1.5 }); 


// ==========================================================================
// ESCENA 2: LA SOLUCIÓN (5.0s - 10.0s)
// ==========================================================================

// A los 5.0s, activar la Escena 2
tl.add(() => activateScene("#scene-2"), 5.0);

// Glow radial suave
tl.fromTo(".hero-bg-glow", 
  { opacity: 0, scale: 0.8 }, 
  { opacity: 1, scale: 1, duration: 1.5, ease: "power2.out" }, 
  5.1
);

// Logo de NextProf.AI
tl.fromTo(".brand-logo-container", 
  { opacity: 0, scale: 0.7 }, 
  { opacity: 1, scale: 1, duration: 1.0, ease: "back.out(1.5)" }, 
  5.2
);

// Rotación sutil del destello del logo en hover simulado
tl.fromTo(".icon-sparkle-electric", 
  { rotate: -15 }, 
  { rotate: 15, duration: 1.2, ease: "sine.inOut", repeat: -1, yoyo: true }, 
  5.2
);

// Textos de la solución
tl.fromTo(".headline-s2", 
  { opacity: 0, y: 40 }, 
  { opacity: 1, y: 0, duration: 1.0, ease: "power3.out" }, 
  5.5
);
tl.fromTo(".body-s2", 
  { opacity: 0, y: 25 }, 
  { opacity: 1, y: 0, duration: 1.0, ease: "power3.out" }, 
  5.8
);

// Destellos flotantes decorativos
const sparkles = [".sp-1", ".sp-2", ".sp-3"];
sparkles.forEach((selector, i) => {
  tl.fromTo(selector, 
    { opacity: 0, scale: 0 }, 
    { opacity: 0.8, scale: 1.2, duration: 0.8, ease: "back.out(1.5)" }, 
    6.0 + (i * 0.2)
  );
  // Movimiento flotante sutil
  tl.to(selector, { 
    y: "-=25", 
    duration: 1.5, 
    ease: "sine.inOut", 
    repeat: -1, 
    yoyo: true 
  }, 6.8 + (i * 0.1));
});

tl.to({}, { duration: 2.0 });


// ==========================================================================
// ESCENA 3: EL PROCESO (10.0s - 15.0s)
// ==========================================================================

// A los 10.0s, activar la Escena 3
tl.add(() => activateScene("#scene-3"), 10.0);

// Entrada de las columnas
tl.fromTo(".offer-side", 
  { opacity: 0, x: -60 }, 
  { opacity: 1, x: 0, duration: 0.8, ease: "power3.out" }, 
  10.2
);
tl.fromTo(".cv-side", 
  { opacity: 0, x: 60 }, 
  { opacity: 1, x: 0, duration: 0.8, ease: "power3.out" }, 
  10.2
);

// Tarjeta de la oferta
tl.fromTo(".offer-card", 
  { scale: 0.95 }, 
  { scale: 1, duration: 0.8, ease: "back.out(1.2)" }, 
  10.4
);

// --- Fase de Optimización de IA (Velo Shimmer) ---
// Mostrar velo
tl.fromTo(".ia-shimmer-veil", 
  { opacity: 0 }, 
  { opacity: 1, duration: 0.4 }, 
  10.6
);

// Movimiento de luz Shimmer a través del CV
tl.fromTo(".shimmer-sweep", 
  { left: "-100%" }, 
  { left: "150%", duration: 1.2, ease: "power1.inOut" }, 
  10.8
);

// Ocultar velo de IA
tl.to(".ia-shimmer-veil", { opacity: 0, duration: 0.4 }, 12.0);

// Mostrar las habilidades adaptadas del CV (Aparecen de una en una con destellos)
tl.fromTo(".tag-1", { opacity: 0, scale: 0.5 }, { opacity: 1, scale: 1, duration: 0.4, ease: "back.out(1.5)" }, 12.1);
tl.fromTo(".tag-2", { opacity: 0, scale: 0.5 }, { opacity: 1, scale: 1, duration: 0.4, ease: "back.out(1.5)" }, 12.3);
tl.fromTo(".tag-3", { opacity: 0, scale: 0.5 }, { opacity: 1, scale: 1, duration: 0.4, ease: "back.out(1.5)" }, 12.5);

// --- Escaneo Láser Verde ---
tl.fromTo(".scanner-green", 
  { y: -10, opacity: 1 }, 
  { y: 740, duration: 1.4, ease: "power1.inOut" }, 
  12.6
);
tl.to(".scanner-green", { opacity: 0, duration: 0.2 }, 13.9);

// Sello de Éxito: ATS Passed - 98% Match
tl.fromTo(".badge-passed", 
  { opacity: 0, scale: 2.0 }, 
  { opacity: 1, scale: 1, duration: 0.5, ease: "bounce.out" }, 
  13.9
);

// --- Animación de Arrastre Kanban Físico (Drag & Drop) ---
// Resaltar la columna objetivo "Entrevista" al acercarse
tl.to(".col-interview", { className: "+=kanban-column col-interview highlight-target", duration: 0.3 }, 13.0);

// Arrastrar la tarjeta del Kanban a la columna de destino con rotación inercial
tl.to("#dragging-card", {
  x: 320,
  y: 0,
  rotation: 4, // Rotación simulada de inercia física (design.md)
  scale: 1.05,
  boxShadow: "0 20px 30px rgba(30, 27, 75, 0.08)",
  duration: 0.8,
  ease: "power2.inOut"
}, 13.0);

// Sellar la tarjeta en la columna destino
tl.to("#dragging-card", {
  x: 320,
  y: 60,
  rotation: 0,
  scale: 1.0,
  boxShadow: "0 4px 10px rgba(30, 27, 75, 0.04)",
  duration: 0.4,
  ease: "bounce.out"
}, 13.8);

// Retirar el resaltado de la columna una vez soltada
tl.to(".col-interview", { className: "kanban-column col-interview text-growth", duration: 0.2 }, 14.0);

tl.to({}, { duration: 1.0 });


// ==========================================================================
// ESCENA 4: CALL TO ACTION (15.0s - 20.0s)
// ==========================================================================

// A los 15.0s, activar la Escena 4
tl.add(() => activateScene("#scene-4"), 15.0);

// Animación de fondo glow
tl.fromTo("#scene-4 .hero-bg-glow", 
  { opacity: 0, scale: 0.7 }, 
  { opacity: 1, scale: 1.2, duration: 2.0, ease: "power2.out" }, 
  15.1
);

// Logo central en Escena 4
tl.fromTo(".logo-final", 
  { opacity: 0, scale: 0.6 }, 
  { opacity: 1, scale: 1, duration: 1.0, ease: "back.out(1.5)" }, 
  15.2
);

// Título de llamada
tl.fromTo(".headline-s4", 
  { opacity: 0, y: 55 }, 
  { opacity: 1, y: 0, duration: 1.0, ease: "power3.out" }, 
  15.5
);
tl.fromTo(".body-s4", 
  { opacity: 0, y: 35 }, 
  { opacity: 1, y: 0, duration: 1.0, ease: "power3.out" }, 
  15.8
);

// Botón de Llamado a la Acción (CTA)
tl.fromTo(".cta-button-wrapper", 
  { opacity: 0, scale: 0.85 }, 
  { opacity: 1, scale: 1, duration: 1.0, ease: "back.out(1.3)" }, 
  16.2
);

// Brillo pulsante constante detrás del botón CTA
tl.fromTo(".cta-button-glow", 
  { opacity: 0.35, scale: 0.98 }, 
  { opacity: 0.65, scale: 1.05, duration: 1.2, ease: "sine.inOut", repeat: -1, yoyo: true }, 
  17.0
);

// Asegurar que el timeline dure exactamente 20 segundos
tl.to({}, { duration: 3.0 }, 17.0);

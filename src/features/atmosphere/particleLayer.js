const PARTICLE_CDN = "https://cdn.jsdelivr.net/npm/@tsparticles/slim@3/tsparticles.slim.bundle.min.js";

const PARTICLE_PRESETS = {
  crypt_dust: {
    count: 28,
    opacity: 0.12,
    speed: 0.22,
    drift: 0.32,
    color: ["#d8c8a8", "#9ea6a1", "#79695b"],
    repulseDistance: 90,
    repulseDuration: 0.45,
    gravity: 0.06,
  },
  graveyard_mist_dust: {
    count: 40,
    opacity: 0.1,
    speed: 0.18,
    drift: 0.48,
    color: ["#cad2cf", "#a4b0ac", "#7f8d8b"],
    repulseDistance: 105,
    repulseDuration: 0.55,
    gravity: 0.04,
  },
  candlelit_interior_dust: {
    count: 22,
    opacity: 0.14,
    speed: 0.16,
    drift: 0.2,
    color: ["#f0d3a2", "#cf9d63", "#8f694f"],
    repulseDistance: 72,
    repulseDuration: 0.38,
    gravity: 0.03,
  },
};

let activeContainer = null;
let activePreset = "";
let loaderPromise = null;

// Erkennt auf Basis der aktuellen Lage ein ruhiges Staub-Preset, ohne unnoetig hektische Szenen zu erzeugen.
function choosePreset(status = {}, weatherMap = null) {
  const weather = String(status?.weather_label || "").toLowerCase();
  const location = String(status?.location_label || "").toLowerCase();
  const frontHere = Array.isArray(weatherMap?.rows)
    && weatherMap.rows.flat().some((cell) => cell.current && cell.front_here);

  if (weather.includes("fog") || location.includes("grab") || location.includes("moor") || frontHere) {
    return "graveyard_mist_dust";
  }
  if (location.includes("stadt") || location.includes("gate") || weather.includes("clear")) {
    return "candlelit_interior_dust";
  }
  return "crypt_dust";
}

// Baut aus einem Preset eine tsParticles-Konfiguration mit reduzierter, schwerer Staubbewegung.
function buildParticleOptions(presetName, reducedMotion = false) {
  const preset = PARTICLE_PRESETS[presetName] || PARTICLE_PRESETS.crypt_dust;
  const count = reducedMotion ? Math.max(8, Math.floor(preset.count / 4)) : preset.count;
  const opacity = reducedMotion ? Math.min(0.08, preset.opacity) : preset.opacity;
  const speed = reducedMotion ? Math.min(0.08, preset.speed) : preset.speed;

  return {
    autoPlay: true,
    detectRetina: true,
    fullScreen: { enable: false },
    fpsLimit: 48,
    pauseOnBlur: true,
    pauseOnOutsideViewport: true,
    background: { color: "transparent" },
    interactivity: {
      detectsOn: "window",
      events: {
        onHover: {
          enable: !reducedMotion,
          mode: "repulse",
        },
        resize: {
          enable: true,
          delay: 0.35,
        },
      },
      modes: {
        repulse: {
          distance: preset.repulseDistance,
          duration: preset.repulseDuration,
          factor: 40,
          speed: 0.7,
          maxSpeed: 1.15,
        },
      },
    },
    particles: {
      color: { value: preset.color },
      links: { enable: false },
      move: {
        enable: true,
        direction: "bottom",
        speed,
        drift: preset.drift,
        straight: false,
        random: false,
        outModes: {
          default: "out",
        },
        gravity: {
          enable: true,
          acceleration: preset.gravity,
          inverse: false,
          maxSpeed: 0.45,
        },
      },
      number: {
        value: count,
        density: {
          enable: true,
          area: 1200,
        },
      },
      opacity: {
        value: opacity,
        animation: {
          enable: true,
          speed: 0.16,
          minimumValue: opacity * 0.35,
          sync: false,
        },
      },
      shape: {
        type: "circle",
      },
      size: {
        value: { min: 1, max: reducedMotion ? 2.6 : 3.8 },
        animation: {
          enable: true,
          speed: 1.2,
          minimumValue: 0.65,
          sync: false,
        },
      },
    },
  };
}

// Laedt die CDN-Bundle-Datei nur bei Bedarf und laesst die WWW-Oberflaeche sonst im statischen Fallback weiterlaufen.
async function ensureTsParticles() {
  if (window.tsParticles?.load) return window.tsParticles;
  if (loaderPromise) return loaderPromise;
  loaderPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-shellrpg-particles="true"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(window.tsParticles), { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = PARTICLE_CDN;
    script.async = true;
    script.defer = true;
    script.dataset.shellrpgParticles = "true";
    script.addEventListener("load", () => resolve(window.tsParticles), { once: true });
    script.addEventListener("error", reject, { once: true });
    document.head.append(script);
  });
  return loaderPromise;
}

// Initialisiert den Atmosphaeren-Layer mit tsParticles oder einem ruhigen CSS-Fallback.
export async function initializeParticleLayer(targetId = "particle-layer") {
  const node = document.getElementById(targetId);
  if (!node) return;
  node.dataset.particlesMode = "fallback";
}

// Synchronisiert Preset, reduced-motion-Fallback und Reinitialisierung des Canvas-Layers mit der aktuellen Lage.
export async function syncParticleLayer(targetId, status = {}, weatherMap = null) {
  const node = document.getElementById(targetId);
  if (!node) return;

  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
  const presetName = choosePreset(status, weatherMap);

  document.body.dataset.particlePreset = presetName;
  document.body.dataset.motionPreference = reducedMotion ? "reduced" : "full";

  if (reducedMotion) {
    if (activeContainer?.destroy) {
      activeContainer.destroy();
      activeContainer = null;
      activePreset = "";
    }
    node.dataset.particlesMode = "reduced";
    return;
  }

  try {
    const engine = await ensureTsParticles();
    if (!engine?.load) {
      node.dataset.particlesMode = "fallback";
      return;
    }
    if (activeContainer?.destroy && activePreset !== presetName) {
      activeContainer.destroy();
      activeContainer = null;
    }
    if (activeContainer && activePreset === presetName) {
      node.dataset.particlesMode = "live";
      return;
    }
    activeContainer = await engine.load({
      id: targetId,
      options: buildParticleOptions(presetName, reducedMotion),
    });
    activePreset = presetName;
    node.dataset.particlesMode = "live";
  } catch (_) {
    node.dataset.particlesMode = "fallback";
  }
}

// Liefert die Presets zur Doku und fuer moegliche spaetere UI-Schalter in einer klaren Struktur aus.
export function getParticlePresets() {
  return structuredClone ? structuredClone(PARTICLE_PRESETS) : JSON.parse(JSON.stringify(PARTICLE_PRESETS));
}

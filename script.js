// --- Simplified script.js (presets & interpolation removed) ---
// --- Default Params (single style object) ---
let params = {
    particleCount: 120,
    fieldStrength: 0.8,
    turbulence: 0.6,
    cohesion: 0.6,
    interactionRadius: 70,
    decayRate: 0.12,
    v0: 1.0,
    v1: 1.0,
    name: 'Default'
};

let isPlaying = true;
let animationFrameId = null;
let particles = [];
let time = 0;

// --- Noise Functions (UNCHANGED) ---
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (t, a, b) => a + t * (b - a);
const grad = (hash, x, y, z) => {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
};
const permutation = [151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,49,192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180];
const p = new Array(512);
for (let i = 0; i < 256; i++) p[i] = p[i + 256] = permutation[i];

const noise = (x, y, z) => {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;
    x -= Math.floor(x);
    y -= Math.floor(y);
    z -= Math.floor(z);
    const u = fade(x);
    const v = fade(y);
    const w = fade(z);
    const A = (p[X] + Y) & 255;
    const B = (p[X + 1] + Y) & 255;
    return lerp(w,
      lerp(v, lerp(u, grad(p[A + Z], x, y, z), grad(p[B + Z], x - 1, y, z)),
              lerp(u, grad(p[A + Z + 1], x, y - 1, z), grad(p[B + Z + 1], x - 1, y - 1, z))),
      lerp(v, lerp(u, grad(p[A + Z], x, y, z - 1), grad(p[B + Z], x - 1, y, z - 1)),
              lerp(u, grad(p[A + Z + 1], x, y - 1, z - 1), grad(p[B + Z + 1], x - 1, y - 1, z - 1)))
    );
};

// --- Particle Class (mostly unchanged) ---
class Particle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 0.5;
        this.vy = (Math.random() - 0.5) * 0.5;
        this.ax = 0;
        this.ay = 0;
        this.hue = Math.random() * 60 + 160;
        this.life = Math.random();
    }

    update(width, height) {
        this.ax = 0;
        this.ay = 0;

        // Flow field
        const scale1 = 0.003 * params.turbulence;
        const scale2 = 0.003 * params.v0;

        const angle1 = noise(this.x * scale1, this.y * scale1, time * 0.5) * Math.PI * 4;
        const angle2 = noise(this.x * 0.01 * params.v1, this.y * 0.01 * params.v1, time * 0.3 + 100) * Math.PI * 2;
        const fieldForce = params.fieldStrength;

        this.ax += Math.cos(angle1) * fieldForce * 0.15;
        this.ay += Math.sin(angle1) * fieldForce * 0.15;
        this.ax += Math.cos(angle2) * fieldForce * 0.08 * (params.v0 > 1 ? 1 : params.v0);
        this.ay += Math.sin(angle2) * fieldForce * 0.08 * (params.v0 > 1 ? 1 : params.v0);

        // Local interactions
        let nearbyCount = 0;
        let avgX = 0, avgY = 0;
        let repelX = 0, repelY = 0;
        const radiusSq = params.interactionRadius * params.interactionRadius;

        for (let other of particles) {
            if (other === this) continue;

            const dx = other.x - this.x;
            const dy = other.y - this.y;
            const distSq = dx * dx + dy * dy;
            const dist = Math.sqrt(distSq);

            if (distSq < radiusSq && dist > 0.1) {
                nearbyCount++;
                avgX += other.x;
                avgY += other.y;

                if (dist < 20) {
                    const repelForce = (20 - dist) / 20;
                    repelX -= (dx / dist) * repelForce * 0.3;
                    repelY -= (dy / dist) * repelForce * 0.3;
                }
            }
        }

        if (nearbyCount > 0) {
            avgX /= nearbyCount;
            avgY /= nearbyCount;
            const cohesionDx = avgX - this.x;
            const cohesionDy = avgY - this.y;
            this.ax += cohesionDx * params.cohesion * 0.001;
            this.ay += cohesionDy * params.cohesion * 0.001;
        }

        this.ax += repelX;
        this.ay += repelY;

        // Integrate
        this.vx += this.ax;
        this.vy += this.ay;
        this.vx *= 0.97;
        this.vy *= 0.97;
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        const maxSpeed = 2.5;
        if (speed > maxSpeed) {
            this.vx = (this.vx / speed) * maxSpeed;
            this.vy = (this.vy / speed) * maxSpeed;
        }
        this.x += this.vx;
        this.y += this.vy;

        // Wrap
        if (this.x < 0) this.x += width;
        if (this.x > width) this.x -= width;
        if (this.y < 0) this.y += height;
        if (this.y > height) this.y -= height;

        // Color & life
        this.hue = 160 + speed * 15 + (noise(this.x * 0.01, this.y * 0.01, time * 0.2) * 80);
        this.life += 0.01;
    }
}

// --- Drawing & Animation (unchanged logic) ---
function initParticles(width, height) {
    particles = [];
    for (let i = 0; i < params.particleCount; i++) {
        particles.push(new Particle(Math.random() * width, Math.random() * height));
    }
}

function drawConnections(ctx) {
    const distSq = params.interactionRadius * params.interactionRadius;

    for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
            const dx = particles[i].x - particles[j].x;
            const dy = particles[i].y - particles[j].y;
            const dSq = dx * dx + dy * dy;

            if (dSq < distSq) {
                const alpha = (1 - dSq / distSq) * 0.3;
                const avgHue = (particles[i].hue + particles[j].hue) / 2;

                ctx.strokeStyle = `hsla(${avgHue}, 65%, 55%, ${alpha})`;
                ctx.lineWidth = 0.5 + alpha * 1.5;
                ctx.beginPath();
                ctx.moveTo(particles[i].x, particles[i].y);
                ctx.lineTo(particles[j].x, particles[j].y);
                ctx.stroke();
            }
        }
    }
}

function drawParticles(ctx) {
    particles.forEach((p) => {
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        const size = 1.5 + speed * 0.4;

        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, size * 3);
        gradient.addColorStop(0, `hsla(${p.hue}, 80%, 65%, 0.6)`);
        gradient.addColorStop(0.5, `hsla(${p.hue}, 75%, 60%, 0.2)`);
        gradient.addColorStop(1, `hsla(${p.hue}, 70%, 55%, 0)`);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(p.x, p.y, size * 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `hsla(${p.hue}, 90%, 75%, 0.9)`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fill();
    });
}

function animate(ctx, canvas) {
    if (!isPlaying) return;

    const decayAlpha = params.decayRate;
    ctx.fillStyle = `rgba(10, 10, 20, ${decayAlpha})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    time += 0.015;

    particles.forEach(p => p.update(canvas.width, canvas.height));

    drawConnections(ctx);
    drawParticles(ctx);

    animationFrameId = requestAnimationFrame(() => animate(ctx, canvas));
}

// --- Randomize (now directly randomizes params) ---
function randomize() {
    params.particleCount = Math.max(20, Math.round(Math.random() * 300));
    params.fieldStrength = parseFloat((Math.random() * 1.8 + 0.2).toFixed(2));
    params.turbulence = parseFloat((Math.random() * 1.8 + 0.2).toFixed(2));
    params.cohesion = parseFloat((Math.random() * 1.5 + 0.1).toFixed(2));
    params.interactionRadius = Math.round(Math.random() * 120 + 30);
    params.decayRate = parseFloat((Math.random() * 0.35 + 0.02).toFixed(3));
    params.v0 = parseFloat((Math.random() * 2.5 + 0.2).toFixed(2));
    params.v1 = parseFloat((Math.random() * 2.5 + 0.2).toFixed(2));
    params.name = 'Randomized';

    updateUIFromParams();
    initParticles(canvas.width, canvas.height);
}

// --- DOM / UI Interaction Logic (simplified) ---
const canvas = document.getElementById('canvas-root');
const ctx = canvas.getContext('2d');
const playPauseButton = document.getElementById('play-pause-button');
const randomizeButton = document.getElementById('randomize-button');

// Define which keys control which UI elements and their display precision
const inputs = [
    { key: 'particleCount', id: 'particle-count', precision: 0 },
    { key: 'interactionRadius', id: 'interaction-radius', precision: 0 },
    { key: 'fieldStrength', id: 'field-strength', precision: 2 },
    { key: 'cohesion', id: 'cohesion', precision: 2 },
    { key: 'turbulence', id: 'turbulence', precision: 2 },
    { key: 'decayRate', id: 'decay-rate', precision: 3 }
];

function updateUIFromParams() {
    inputs.forEach(item => {
        const inputElement = document.getElementById(`${item.id}-input`);
        const valueElement = document.getElementById(`${item.id}-value`);

        const value = params[item.key];

        if (inputElement) {
            inputElement.value = value;
        }
        if (valueElement) {
            valueElement.textContent = (typeof value === 'number') ? value.toFixed(item.precision) : value;
        }
    });

    // If you have a UI element for the style/name, update it (optional)
    const styleNameEl = document.getElementById('style-name-value');
    if (styleNameEl) styleNameEl.textContent = params.name;
}

function resizeCanvas() {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    initParticles(canvas.width, canvas.height);
}

function setupEventListeners() {
    window.addEventListener('resize', resizeCanvas);

    playPauseButton.addEventListener('click', () => {
        isPlaying = !isPlaying;
        playPauseButton.textContent = isPlaying ? 'Pause' : 'Play';
        if (isPlaying) {
            animate(ctx, canvas);
        } else {
            cancelAnimationFrame(animationFrameId);
        }
    });

    randomizeButton.addEventListener('click', randomize);

    // Input handlers for manual overrides
    inputs.forEach(item => {
        const inputElement = document.getElementById(`${item.id}-input`);
        if (!inputElement) return;

        inputElement.addEventListener('input', (e) => {
            let newValue = parseFloat(e.target.value);
            if (isNaN(newValue)) return;

            // Clamp some sensible ranges
            if (item.key === 'particleCount') {
                newValue = Math.max(1, Math.round(newValue));
                params.particleCount = newValue;
                initParticles(canvas.width, canvas.height);
            } else if (item.key === 'interactionRadius') {
                params.interactionRadius = Math.max(1, newValue);
            } else if (item.key === 'decayRate') {
                params.decayRate = Math.max(0.001, Math.min(0.9, newValue));
            } else {
                params[item.key] = newValue;
            }

            const valueElement = document.getElementById(`${item.id}-value`);
            if (valueElement) valueElement.textContent = params[item.key].toFixed(item.precision);
        });
    });
}

// Scroll animations for content sections (unchanged)
function handleScroll() {
    const sections = document.querySelectorAll('.section');
    const triggerBottom = window.innerHeight / 5 * 4;

    sections.forEach(section => {
        const sectionTop = section.getBoundingClientRect().top;
        if (sectionTop < triggerBottom) {
            section.classList.add('visible');
        }
    });
}

window.addEventListener('scroll', handleScroll);

function initApp() {
    // 1. Set initial UI values
    updateUIFromParams();

    // 2. Set up event listeners
    setupEventListeners();

    // 3. Initial particle setup and start animation
    resizeCanvas(); // Calls initParticles
    animate(ctx, canvas);
}

document.addEventListener('DOMContentLoaded', initApp);

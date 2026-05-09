import { useEffect, useRef } from 'react';

// ── Perlin Noise 3D ──────────────────────────────────────────────────
// Genera ruido orgánico para mover las partículas de forma natural
const _perm = (() => {
    const a = new Uint8Array(256);
    for (let i = 0; i < 256; i++) a[i] = i;
    for (let i = 255; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    const p = new Uint8Array(512);
    for (let i = 0; i < 512; i++) p[i] = a[i & 255];
    return p;
})();

function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
function lerp(t, a, b) { return a + t * (b - a); }
function g(h, x, y, z) {
    h &= 15;
    const u = h < 8 ? x : y, v = h < 4 ? y : (h === 12 || h === 14 ? x : z);
    return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
}
function perlin(x, y, z) {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
    x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
    const u = fade(x), v = fade(y), w = fade(z);
    const A = _perm[X] + Y, AA = _perm[A] + Z, AB = _perm[A + 1] + Z;
    const B = _perm[X + 1] + Y, BA = _perm[B] + Z, BB = _perm[B + 1] + Z;
    return lerp(w,
        lerp(v, lerp(u, g(_perm[AA], x, y, z), g(_perm[BA], x - 1, y, z)),
            lerp(u, g(_perm[AB], x, y - 1, z), g(_perm[BB], x - 1, y - 1, z))),
        lerp(v, lerp(u, g(_perm[AA + 1], x, y, z - 1), g(_perm[BA + 1], x - 1, y, z - 1)),
            lerp(u, g(_perm[AB + 1], x, y - 1, z - 1), g(_perm[BB + 1], x - 1, y - 1, z - 1)))
    );
}

// ── Partícula de humo ────────────────────────────────────────────────
class Puff {
    constructor(cx, cy, options = {}) {
        this.cx = cx;
        this.cy = cy;
        this.ringRadius = options.ringRadius || 0;  // si >0, spawnea en el borde del círculo
        this.spawnRadius = options.spawnRadius || 110;
        this.init();
        // stagger: arranca cada partícula en un punto aleatorio de su ciclo de vida
        // para evitar que todas aparezcan y desaparezcan a la vez
        if (options.stagger) this.life = Math.floor(Math.random() * this.maxLife);
    }

    init() {
        const ang = Math.random() * Math.PI * 2;
        const rad = this.ringRadius > 0
            ? this.ringRadius * (0.85 + Math.random() * 0.25)  // spawn en el borde del halo
            : Math.sqrt(Math.random()) * this.spawnRadius;       // spawn distribuido en zona libre
        this.x = this.cx + Math.cos(ang) * rad;
        this.y = this.cy + Math.sin(ang) * rad * 0.78 + 10;
        this.vx = (Math.random() - 0.5) * 0.50;
        this.vy = -(Math.random() * 0.56 + 0.125);

        this.life = 0;
        this.maxLife = 320 + Math.floor(Math.random() * 400);

        // Partículas pequeñas = aspecto más definido, menos "blob"
        this.sz   = 28 + Math.random() * 38;
        this.grow = 0.06 + Math.random() * 0.08;

        // Opacidad baja por partícula — las hebras se ven por acumulación
        this.peak = 0.028 + Math.random() * 0.034;
        this.op = 0;

        // Gris frío, ligeramente azulado — sin tinte dorado
        const base = 148 + Math.floor(Math.random() * 42);
        this.r = base;
        this.g = base + Math.floor(Math.random() * 6);
        this.b = base + Math.floor(Math.random() * 10);

        this.rot = Math.random() * Math.PI * 2;
        this.rotSpd = (Math.random() - 0.5) * 0.003;
        // Offsets para el ruido Perlin — dan a cada partícula una trayectoria única
        this.ox = Math.random() * 300;
        this.oy = Math.random() * 300;
    }

    update(t) {
        this.life++;
        const p = this.life / this.maxLife;
        const nx = perlin(this.x * 0.005 + this.ox, this.y * 0.005, t * 0.0003);
        const ny = perlin(this.x * 0.005 + this.oy, this.y * 0.005 + 100, t * 0.0003);
        this.vx += nx * 0.125;
        this.vy += ny * 0.0625 - 0.011;
        this.vx *= 0.976;
        this.vy *= 0.976;
        this.x += this.vx;
        this.y += this.vy;
        this.sz += this.grow;
        this.rot += this.rotSpd;

        // Envolvente de opacidad: fade in rápido (10%), sustain, fade out lento (40%)
        if (p < 0.10) this.op = (p / 0.10) * this.peak;
        else if (p > 0.60) this.op = ((1 - p) / 0.40) * this.peak;
        else this.op = this.peak;

        if (this.life >= this.maxLife) this.init();
    }

    draw(ctx) {
        if (this.op < 0.002) return;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rot);
        // Gradiente radial suave → las partículas se funden entre sí formando el humo
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, this.sz);
        const { r, g: gr, b, op } = this;
        grad.addColorStop(0,    `rgba(${r},${gr},${b},${op})`);
        grad.addColorStop(0.20, `rgba(${r},${gr},${b},${op * 0.55})`);
        grad.addColorStop(0.45, `rgba(${r},${gr},${b},${op * 0.15})`);
        grad.addColorStop(0.70, `rgba(${r},${gr},${b},${op * 0.04})`);
        grad.addColorStop(1,    `rgba(${r},${gr},${b},0)`);
        // 'screen' aclara donde se superponen partículas → efecto luz/humo
        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, this.sz, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// ── Componente React ─────────────────────────────────────────────────
export default function SmokeCanvas({ className = '' }) {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const dpr = Math.min(window.devicePixelRatio || 1, 2); // máximo 2x para no sobrecargar GPU
        let W, H, frame = 0, raf;
        let particles = [];

        // Dos focos de humo: halo (columna derecha) y logo de texto (columna izquierda)
        let haloX, haloY, logoX, logoY;

        function resize() {
            const parent = canvas.parentElement;
            W = parent.clientWidth;
            H = parent.clientHeight;
            canvas.width  = W * dpr;
            canvas.height = H * dpr;
            canvas.style.width  = W + 'px';
            canvas.style.height = H + 'px';
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            // Posiciones relativas al tamaño del contenedor (grid 50/50)
            haloX = W * 0.75;
            haloY = H * 0.50;
            logoX = W * 0.28;
            logoY = H * 0.52;

            const haloRadius = Math.min(W * 0.21, H * 0.36);

            // Las puntas de las uñas están en la parte baja del halo
            const tipX = haloX - haloRadius * 0.05;
            const tipY = haloY + haloRadius * 0.55;

            particles = [
                // Humo en el borde del anillo dorado
                ...Array.from({ length: 100 }, () =>
                    new Puff(haloX, haloY, { ringRadius: haloRadius, stagger: true })),
                // Humo denso saliendo de las puntas de las uñas
                ...Array.from({ length: 70 }, () =>
                    new Puff(tipX, tipY, { spawnRadius: 55, stagger: true })),
            ];
        }

        function loop() {
            ctx.clearRect(0, 0, W, H);
            frame++;

            for (const p of particles) { p.update(frame); p.draw(ctx); }

            // 'multiply' oscurece sin borrar el PNG del halo
            ctx.globalCompositeOperation = 'multiply';

            // Sombra profunda centrada en el halo
            const dkHalo = ctx.createRadialGradient(haloX, haloY, 30, haloX, haloY, 280);
            dkHalo.addColorStop(0,    'rgba(1,1,1,0.90)');
            dkHalo.addColorStop(0.35, 'rgba(2,2,2,0.55)');
            dkHalo.addColorStop(0.65, 'rgba(3,3,3,0.20)');
            dkHalo.addColorStop(1,    'rgba(0,0,0,0)');
            ctx.fillStyle = dkHalo;
            ctx.fillRect(0, 0, W, H);

            // Sombra más suave detrás del logo de texto
            const dkLogo = ctx.createRadialGradient(logoX, logoY, 10, logoX, logoY, 260);
            dkLogo.addColorStop(0,    'rgba(0,0,0,0.92)');
            dkLogo.addColorStop(0.30, 'rgba(1,1,1,0.65)');
            dkLogo.addColorStop(0.60, 'rgba(2,2,2,0.28)');
            dkLogo.addColorStop(1,    'rgba(0,0,0,0)');
            ctx.fillStyle = dkLogo;
            ctx.fillRect(0, 0, W, H);

            // Viñeta exterior para dar profundidad cinematográfica
            const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.85);
            vig.addColorStop(0, 'rgba(0,0,0,0)');
            vig.addColorStop(1, 'rgba(0,0,0,0.60)');
            ctx.fillStyle = vig;
            ctx.fillRect(0, 0, W, H);

            ctx.globalCompositeOperation = 'source-over';
            raf = requestAnimationFrame(loop);
        }

        resize();
        loop();
        window.addEventListener('resize', resize);

        // Limpieza al desmontar el componente
        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener('resize', resize);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className={className}
            style={{}}
        />
    );
}
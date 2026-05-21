"use client";

import { useEffect, useRef, useState } from "react";
import type { AnimatedLayer } from "@/lib/themes";

/**
 * Renders an animated background layer. Respects `prefers-reduced-motion` —
 * those users see a still snapshot (one frame) instead of the running
 * animation.
 *
 * Three kinds:
 *   - drift:     a slow horizontal/vertical gradient pan
 *   - noise:     animated SVG turbulence
 *   - particles: floating circles drifting upward (canvas, RAF)
 */
export function AnimatedBackgroundLayer({ layer }: { layer: AnimatedLayer }) {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  if (layer.kind === "drift") {
    return (
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(135deg, ${layer.color}00, ${layer.color}${Math.round(
            layer.intensity * 255
          )
            .toString(16)
            .padStart(2, "0")}, ${layer.color}00)`,
          backgroundSize: "300% 300%",
          animation: reduced ? undefined : `linkfolio-drift ${20 + (1 - layer.intensity) * 20}s ease-in-out infinite`,
        }}
      >
        <style jsx>{`
          @keyframes linkfolio-drift {
            0%, 100% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
          }
        `}</style>
      </div>
    );
  }

  if (layer.kind === "noise") {
    // Animated SVG turbulence — pauses for reduced-motion users.
    const baseFreq = 0.6 + layer.intensity * 0.6;
    const opacity = 0.15 + layer.intensity * 0.35;
    return (
      <svg className="absolute inset-0 w-full h-full" style={{ opacity }}>
        <filter id={`noise-${layer.id}`}>
          <feTurbulence type="fractalNoise" baseFrequency={baseFreq} numOctaves={2} seed={1}>
            {!reduced && (
              <animate
                attributeName="seed"
                values="1;6;11;16;1"
                dur="6s"
                repeatCount="indefinite"
              />
            )}
          </feTurbulence>
          <feColorMatrix
            type="matrix"
            values={`0 0 0 0 ${hexChan(layer.color, 0)}  0 0 0 0 ${hexChan(layer.color, 1)}  0 0 0 0 ${hexChan(layer.color, 2)}  0 0 0 1 0`}
          />
        </filter>
        <rect width="100%" height="100%" filter={`url(#noise-${layer.id})`} />
      </svg>
    );
  }

  // particles
  return <ParticlesCanvas layer={layer} reduced={reduced} />;
}

function hexChan(hex: string, ch: 0 | 1 | 2): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return 1;
  const bytes = m[1];
  const v = parseInt(bytes.slice(ch * 2, ch * 2 + 2), 16);
  return v / 255;
}

function ParticlesCanvas({ layer, reduced }: { layer: AnimatedLayer; reduced: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const parent = canvas.parentElement;
    if (!parent) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    function resize() {
      if (!canvas || !parent) return;
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx?.scale(dpr, dpr);
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(parent);

    const count = Math.round(30 + layer.intensity * 80);
    type Particle = { x: number; y: number; r: number; vy: number; alpha: number };
    const particles: Particle[] = Array.from({ length: count }, () => ({
      x: Math.random() * (canvas.width / dpr),
      y: Math.random() * (canvas.height / dpr),
      r: 1 + Math.random() * 2.5,
      vy: 0.1 + Math.random() * 0.5,
      alpha: 0.2 + Math.random() * 0.6,
    }));

    let raf = 0;
    function frame() {
      if (!ctx || !canvas) return;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      ctx.clearRect(0, 0, w, h);
      for (const p of particles) {
        p.y -= p.vy;
        if (p.y < -4) {
          p.y = h + 4;
          p.x = Math.random() * w;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = layer.color;
        ctx.globalAlpha = p.alpha;
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    }
    if (!reduced) {
      frame();
    } else {
      // One static frame for reduced-motion viewers.
      frame();
      cancelAnimationFrame(raf);
    }
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [layer.color, layer.intensity, reduced]);

  return <canvas ref={canvasRef} className="absolute inset-0" />;
}

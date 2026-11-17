import { useEffect, useRef } from 'react';

interface InteractiveBackgroundProps {
  enabled: boolean;
  subtle?: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hue: string;
}

export function InteractiveBackground({ enabled, subtle = false }: InteractiveBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const spotlightRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (spotlightRef.current) {
        spotlightRef.current.style.transform = `translate3d(${e.clientX - 240}px, ${e.clientY - 240}px, 0)`;
      }
    };
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [enabled]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !enabled) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const onResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', onResize);

    const count = subtle ? 20 : 34;
    const hues = ['rgba(139, 92, 246, 0.55)', 'rgba(59, 130, 246, 0.55)', 'rgba(6, 182, 212, 0.5)'];
    const particles: Particle[] = Array.from({ length: count }, (_, idx) => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.32,
      vy: (Math.random() - 0.5) * 0.32,
      radius: 1.4 + (idx % 3) * 0.6,
      hue: hues[idx % hues.length],
    }));

    let rafId = 0;
    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.hue;
        ctx.fill();

        if (!subtle) {
          for (let j = i + 1; j < particles.length; j++) {
            const q = particles[j];
            const dx = p.x - q.x;
            const dy = p.y - q.y;
            const distSq = dx * dx + dy * dy;
            if (distSq < 19000) {
              const alpha = (1 - distSq / 19000) * 0.18;
              ctx.beginPath();
              ctx.moveTo(p.x, p.y);
              ctx.lineTo(q.x, q.y);
              ctx.strokeStyle = `rgba(99, 102, 241, ${alpha.toFixed(3)})`;
              ctx.lineWidth = 1;
              ctx.stroke();
            }
          }
        }
      }

      rafId = window.requestAnimationFrame(draw);
    };

    rafId = window.requestAnimationFrame(draw);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
    };
  }, [enabled, subtle]);

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 z-0 overflow-hidden transition-opacity duration-300 ${
        subtle ? 'opacity-35 dark:opacity-45' : 'opacity-80 dark:opacity-100'
      }`}
    >
      {/* Subtle architectural grid */}
      <div
        className="absolute inset-0 opacity-[0.35] dark:opacity-[0.18]"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(99, 102, 241, 0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(99, 102, 241, 0.08) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
        }}
      />

      {/* Slowly drifting gradient orbs */}
      <div className="absolute -left-24 -top-24 h-[420px] w-[420px] rounded-full bg-violet-500/15 blur-3xl dark:bg-violet-600/20" />
      <div className="absolute -right-24 top-1/4 h-[440px] w-[440px] rounded-full bg-blue-500/15 blur-3xl dark:bg-blue-600/20" />
      <div className="absolute bottom-0 left-1/3 h-[360px] w-[360px] rounded-full bg-cyan-400/10 blur-3xl dark:bg-cyan-500/15" />

      {/* Mouse-following radial glow */}
      {enabled && (
        <div
          ref={spotlightRef}
          className="hidden h-[480px] w-[480px] rounded-full bg-radial from-violet-500/15 via-blue-500/5 to-transparent blur-2xl lg:block dark:from-violet-500/18 dark:via-cyan-500/8"
        />
      )}

      {/* Animated constellation particles */}
      {enabled && <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />}
    </div>
  );
}

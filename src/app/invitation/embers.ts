import { Component, DestroyRef, ElementRef, afterNextRender, inject, input } from '@angular/core';

interface Ember {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  hue: number;
  phase: number;
}

/**
 * Braises qui montent (canvas 2D). Léger : ~40 particules, DPR plafonné,
 * pause hors écran / onglet caché, désactivé si « réduire les animations ».
 */
@Component({
  selector: 'app-embers',
  template: '<canvas></canvas>',
  host: { class: 'embers-layer', 'aria-hidden': 'true' },
})
export class Embers {
  readonly count = input(40);

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const canvas = host.querySelector('canvas')!;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      let w = 0;
      let h = 0;
      const resize = () => {
        w = host.clientWidth;
        h = host.clientHeight;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      };
      resize();

      const spawn = (p: Ember, anywhere: boolean) => {
        p.x = Math.random() * w;
        p.y = anywhere ? Math.random() * h : h + 8;
        p.r = 0.8 + Math.random() * 2.2;
        p.vx = (Math.random() - 0.5) * 0.35;
        p.vy = 0.35 + Math.random() * 0.9;
        p.life = 0;
        p.max = 180 + Math.random() * 320;
        p.hue = 18 + Math.random() * 28; // orange -> or
        p.phase = Math.random() * 100;
        return p;
      };
      const embers = Array.from({ length: this.count() }, () => spawn({} as Ember, true));

      let raf = 0;
      let visible = true;
      const frame = () => {
        raf = 0;
        if (!visible || document.hidden) return;
        ctx.clearRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'lighter';
        for (const p of embers) {
          p.life++;
          p.y -= p.vy;
          p.x += p.vx + Math.sin((p.life + p.phase) / 35) * 0.35;
          const t = p.life / p.max;
          if (t >= 1 || p.y < -10) {
            spawn(p, false);
            continue;
          }
          const a = Math.sin(Math.PI * t); // apparaît puis s'éteint
          ctx.fillStyle = `hsla(${p.hue},100%,60%,${a * 0.18})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * 3.2, 0, 6.2832);
          ctx.fill();
          ctx.fillStyle = `hsla(${p.hue + 10},100%,${70 + 15 * a}%,${a * 0.95})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, 6.2832);
          ctx.fill();
        }
        raf = requestAnimationFrame(frame);
      };
      const start = () => {
        if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame);
      };

      const ro = new ResizeObserver(resize);
      ro.observe(host);
      const io = new IntersectionObserver(([e]) => {
        visible = e.isIntersecting;
        start();
      });
      io.observe(host);
      document.addEventListener('visibilitychange', start);
      start();

      destroyRef.onDestroy(() => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        io.disconnect();
        document.removeEventListener('visibilitychange', start);
      });
    });
  }
}

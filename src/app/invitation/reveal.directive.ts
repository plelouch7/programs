import { DestroyRef, Directive, ElementRef, afterNextRender, inject } from '@angular/core';

/** Apparition douce au défilement (IntersectionObserver + transition CSS, aucun coût au scroll). */
@Directive({ selector: '[reveal]' })
export class Reveal {
  constructor() {
    const el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);
    // Uniquement dans le navigateur : sans JS, le contenu reste visible.
    afterNextRender(() => {
      if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      el.classList.add('reveal');
      const io = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            el.classList.add('is-visible');
            io.disconnect();
          }
        },
        { rootMargin: '0px 0px -8% 0px' },
      );
      io.observe(el);
      destroyRef.onDestroy(() => io.disconnect());
    });
  }
}

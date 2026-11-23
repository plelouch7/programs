import { Component, DestroyRef, afterNextRender, computed, inject, signal } from '@angular/core';
import { EVENT } from '../event';

const LABELS = ['jours', 'heures', 'min', 'sec'];

@Component({
  selector: 'app-countdown',
  template: `
    @switch (phase()) {
      @case ('pendant') {
        <p class="cd-message">C'est aujourd'hui : l'invasion a commencé.</p>
      }
      @case ('apres') {
        <p class="cd-message">Merci d'avoir été là. Gloire à Dieu !</p>
      }
      @default {
        <p class="countdown-title">Début dans</p>
        <div class="countdown" role="timer" aria-label="Temps restant avant l'événement">
          @for (u of units(); track u.label) {
            <div class="cd-cell">
              <span class="cd-num">
                @for (v of [u.value]; track v) {
                  <span class="cd-digit" animate.enter="tick">{{ v }}</span>
                }
              </span>
              <span class="cd-label">{{ u.label }}</span>
            </div>
          }
        </div>
      }
    }
  `,
})
export class Countdown {
  /** null côté serveur : le décompte démarre dans le navigateur. */
  private readonly now = signal<number | null>(null);

  protected readonly phase = computed(() => {
    const n = this.now();
    if (n === null || n < EVENT.debut.getTime()) return 'avant';
    return n < EVENT.fin.getTime() ? 'pendant' : 'apres';
  });

  protected readonly units = computed(() => {
    const n = this.now();
    if (n === null) return LABELS.map((label) => ({ label, value: '--' }));
    const s = Math.max(0, Math.floor((EVENT.debut.getTime() - n) / 1000));
    const values = [Math.floor(s / 86400), Math.floor((s % 86400) / 3600), Math.floor((s % 3600) / 60), s % 60];
    return LABELS.map((label, i) => ({ label, value: String(values[i]).padStart(2, '0') }));
  });

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      this.now.set(Date.now());
      const id = setInterval(() => this.now.set(Date.now()), 1000);
      destroyRef.onDestroy(() => clearInterval(id));
    });
  }
}

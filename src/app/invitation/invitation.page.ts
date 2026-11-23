import { NgOptimizedImage } from '@angular/common';
import { Component, DestroyRef, OnInit, afterNextRender, computed, inject, input, signal } from '@angular/core';
import { EVENT } from '../event';
import { SeoService } from '../seo.service';
import { Invitation, buildIcs, downloadFile, googleCalendarUrl } from '../utils';
import { Countdown } from './countdown';
import { Embers } from './embers';
import { Reveal } from './reveal.directive';
import { RsvpForm } from './rsvp-form';

@Component({
  selector: 'app-invitation',
  imports: [NgOptimizedImage, Countdown, RsvpForm, Reveal, Embers],
  templateUrl: './invitation.page.html',
  host: { '[class.locked]': '!opened()' },
})
export default class InvitationPage implements OnInit {
  /** Paramètre de route /i/:code et donnée résolue (withComponentInputBinding). */
  readonly code = input<string>('');
  readonly invite = input<Invitation | null>(null);

  protected readonly ev = EVENT;
  protected readonly titleLetters = [...'INVASION'];
  protected readonly principal = EVENT.orateurs[0];
  protected readonly invites = EVENT.orateurs.slice(1);
  /** « A, B et C » */
  protected readonly invitesTexte = this.invites
    .map((o) => o.nom)
    .join(', ')
    .replace(/, ([^,]*)$/, ' et $1');
  protected readonly opened = signal(false);
  protected readonly opening = signal(false);
  protected readonly playing = signal(false);
  protected readonly prenom = computed(() => this.invite()?.prenom ?? '');

  protected readonly waIcon =
    'M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.44-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2-1.42.25-.7.25-1.29.18-1.41-.08-.13-.27-.2-.57-.35m-5.42 7.4h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.89-9.88 2.64 0 5.12 1.03 6.99 2.9a9.82 9.82 0 0 1 2.89 6.99c0 5.45-4.44 9.88-9.88 9.88m8.41-18.3A11.82 11.82 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.68 1.45h.01c6.55 0 11.89-5.34 11.89-11.89a11.82 11.82 0 0 0-3.48-8.41Z';

  private readonly seo = inject(SeoService);
  private audio?: HTMLAudioElement;

  /** Masque la barre d'action quand le formulaire est déjà à l'écran. */
  protected readonly rsvpInView = signal(false);
  protected readonly hasReplied = computed(() => !!this.invite()?.reponse);

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const target = document.getElementById('confirmation');
      if (!target || !('IntersectionObserver' in window)) return;
      const io = new IntersectionObserver(([e]) => this.rsvpInView.set(e.isIntersecting), { threshold: 0.15 });
      io.observe(target);
      destroyRef.onDestroy(() => io.disconnect());
    });
  }

  protected readonly publicUrl = computed(() => this.seo.origin() + '/');
  protected readonly googleCalendar = computed(() => googleCalendarUrl(this.publicUrl()));
  protected readonly shareText = computed(
    () =>
      `🔥 ${EVENT.nom} avec ${EVENT.orateur}\n« ${EVENT.theme} »\n📅 ${EVENT.dateTexte}, ${EVENT.heureTexte}\n📍 ${EVENT.lieu}, Klikanmé (Lomé)\n👉 ${this.publicUrl()}`,
  );
  protected readonly whatsappShare = computed(() => `https://api.whatsapp.com/send?text=${encodeURIComponent(this.shareText())}`);
  protected readonly facebookShare = computed(
    () => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(this.publicUrl())}`,
  );
  protected readonly whatsappContact = `https://api.whatsapp.com/send?phone=${EVENT.whatsapp}&text=${encodeURIComponent(
    `Bonjour, je vous contacte au sujet de l'${EVENT.nom} du ${EVENT.dateTexte.toLowerCase()}.`,
  )}`;

  ngOnInit(): void {
    const prenom = this.prenom();
    const description = `${EVENT.orateur} · « ${EVENT.theme} » · ${EVENT.dateTexte}, ${EVENT.heureTexte} · ${EVENT.lieu}, Klikanmé (Lomé).`;
    this.seo.set({
      title: prenom ? `${prenom}, vous êtes invité(e) — ${EVENT.nom}` : `${EVENT.nom} — ${EVENT.orateur}`,
      description,
      path: this.code() ? `/i/${this.code()}` : '/',
      noindex: !!this.code(),
    });
  }

  protected open(): void {
    if (this.opening()) return;
    this.opening.set(true);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    setTimeout(() => {
      this.opened.set(true);
      window.scrollTo({ top: 0 });
    }, reduced ? 0 : 1650); // sceau, rabat, lettre qui sort, puis fondu
  }

  /** Ancre gérée en JS : avec <base href="/">, un href="#…" quitterait /i/:code. */
  protected goToRsvp(): void {
    document.getElementById('confirmation')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  protected addToCalendar(): void {
    downloadFile('invasion-apostolic-prophetique.ics', buildIcs(this.publicUrl()), 'text/calendar;charset=utf-8');
  }

  protected toggleMusic(): void {
    this.audio ??= Object.assign(new Audio(EVENT.musique), { loop: true, volume: 0.6 });
    if (this.playing()) {
      this.audio.pause();
      this.playing.set(false);
    } else {
      this.audio
        .play()
        .then(() => this.playing.set(true))
        .catch(() => this.playing.set(false));
    }
  }

  protected tel(n: string): string {
    return 'tel:' + n.replace(/\s/g, '');
  }
}

import { DOCUMENT, Injectable, REQUEST, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { environment } from '../environments/environment';
import { EVENT } from './event';

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);
  private readonly request = inject(REQUEST, { optional: true });

  /** Origine publique : SITE_URL, sinon requête SSR, sinon navigateur. */
  origin(): string {
    if (environment.siteUrl) return environment.siteUrl.replace(/\/$/, '');
    if (this.request) return new URL(this.request.url).origin;
    return this.document.location?.origin ?? '';
  }

  set(opts: { title: string; description: string; path: string; noindex?: boolean }): void {
    const url = this.origin() + opts.path;
    const image = this.origin() + EVENT.imageOg;
    this.title.setTitle(opts.title);
    const tags: Record<string, string> = {
      description: opts.description,
      robots: opts.noindex ? 'noindex, nofollow' : 'index, follow',
      'og:type': 'website',
      'og:locale': 'fr_FR',
      'og:site_name': EVENT.nom,
      'og:title': opts.title,
      'og:description': opts.description,
      'og:url': url,
      'og:image': image,
      'og:image:width': '1200',
      'og:image:height': '630',
      'og:image:alt': `${EVENT.nom} — ${EVENT.orateur}`,
      'twitter:card': 'summary_large_image',
      'twitter:title': opts.title,
      'twitter:description': opts.description,
      'twitter:image': image,
    };
    for (const [key, content] of Object.entries(tags)) {
      const attr = key.startsWith('og:') ? 'property' : 'name';
      this.meta.updateTag({ [attr]: key, content }, `${attr}="${key}"`);
    }

    // Liens personnels /i/… : noindex, donc ni canonical ni données structurées
    if (opts.noindex) return;
    this.headElement('link', 'canonical', (el) => {
      el.setAttribute('rel', 'canonical');
      el.setAttribute('href', url);
    });
    this.headElement('script', 'event-jsonld', (el) => {
      el.setAttribute('type', 'application/ld+json');
      el.textContent = JSON.stringify(this.eventJsonLd(url, image));
    });
  }

  /** Crée ou réutilise un élément du <head> (pas de doublon à l'hydratation). */
  private headElement(tag: string, id: string, fill: (el: Element) => void): void {
    const head = this.document.head;
    let el = head.querySelector(`#${id}`);
    if (!el) {
      el = this.document.createElement(tag);
      el.id = id;
      head.appendChild(el);
    }
    fill(el);
  }

  /** Données structurées schema.org/Event (résultats enrichis Google). */
  private eventJsonLd(url: string, image: string) {
    return {
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: EVENT.nom,
      description: `${EVENT.theme}. Avec ${EVENT.orateur}.`,
      url,
      image: [image],
      startDate: EVENT.debut.toISOString(),
      endDate: EVENT.fin.toISOString(),
      eventStatus: 'https://schema.org/EventScheduled',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      inLanguage: 'fr',
      location: {
        '@type': 'Place',
        name: EVENT.lieu,
        address: {
          '@type': 'PostalAddress',
          streetAddress: 'Klikanmé',
          addressLocality: 'Lomé',
          addressCountry: 'TG',
        },
      },
      // les orateurs encore « [À COMPLÉTER] » sont ignorés
      performer: EVENT.orateurs
        .filter((o) => !o.nom.startsWith('['))
        .map((o) => ({ '@type': 'Person', name: o.nom })),
    };
  }
}

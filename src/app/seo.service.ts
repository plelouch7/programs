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
  }
}

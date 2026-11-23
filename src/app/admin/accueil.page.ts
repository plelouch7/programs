import { DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { Presence } from '../utils';
import type { InviteRow, ReponseRow } from './admin.page';
import { AdminService } from './admin.routes';

/** Une personne (ou un groupe) à accueillir : invitation personnelle ou réponse via le lien public. */
interface Entry {
  table: 'invites' | 'reponses';
  id: string;
  nom: string;
  telephone: string | null;
  code: string | null;
  presence: Presence | null;
  attendus: number;
  arrivee_at: string | null;
  presents: number | null;
  haystack: string;
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

@Component({
  selector: 'app-accueil',
  imports: [DatePipe, RouterLink],
  template: `
    <main class="mx-auto max-w-2xl pb-24">
      <div class="sticky top-0 z-10 border-b border-or/30 bg-vin px-4 pt-3 pb-3 shadow-lg">
        <div class="flex items-end justify-between gap-3">
          <div>
            <a routerLink="/admin" class="link text-sm">← Invités</a>
            <h1 class="font-display text-2xl leading-tight tracking-wide">Accueil jour J</h1>
          </div>
          @let s = stats();
          <p class="text-right text-sm leading-tight text-sable" aria-live="polite">
            <span class="font-display text-4xl text-white">{{ s.personnes }}</span>
            <span class="text-lg"> / {{ s.attendus }}</span><br />
            personnes arrivées
          </p>
        </div>
        <input class="field mt-3" type="search" enterkeyhint="search" autocomplete="off" autofocus
          placeholder="Nom, téléphone ou code" aria-label="Rechercher un invité"
          [value]="search()" (input)="search.set($any($event.target).value)" />
      </div>

      @if (loading()) {
        <p class="mt-10 text-center text-sable">Chargement…</p>
      } @else {
        <ul>
          @for (e of filtered(); track e.id) {
            <li class="flex items-center gap-3 border-b border-white/10 px-4 py-3">
              <div class="min-w-0 flex-1" [class.opacity-60]="e.arrivee_at">
                <p class="truncate text-lg font-semibold">{{ e.nom }}</p>
                <p class="text-sm text-sable">
                  @switch (e.presence) {
                    @case ('oui') { <span class="text-[#86efac]">A confirmé · {{ e.attendus }} pers.</span> }
                    @case ('non') { <span class="text-[#fca5a5]">A répondu non</span> }
                    @default { Sans réponse }
                  }
                  @if (e.code) { · <code class="text-or-clair">{{ e.code }}</code> }
                </p>
                @if (e.telephone) { <p class="text-sm text-sable">{{ e.telephone }}</p> }
              </div>

              @if (e.arrivee_at) {
                <div class="flex shrink-0 flex-col items-end gap-1">
                  <span class="badge" data-presence="oui">✓ Arrivé(e) {{ e.arrivee_at | date: 'HH:mm' : 'UTC' }}</span>
                  <div class="flex items-center gap-1" role="group" [attr.aria-label]="'Nombre de personnes présentes pour ' + e.nom">
                    <button type="button" class="size-11 rounded-full border border-or/60 text-xl text-or-clair" (click)="setPresents(e, -1)" aria-label="Une personne de moins">−</button>
                    <span class="w-8 text-center text-lg font-bold">{{ e.presents }}</span>
                    <button type="button" class="size-11 rounded-full border border-or/60 text-xl text-or-clair" (click)="setPresents(e, 1)" aria-label="Une personne de plus">+</button>
                  </div>
                  <button type="button" class="px-1 py-1 text-xs text-sable underline" (click)="undo(e)">Annuler l'arrivée</button>
                </div>
              } @else {
                <button type="button" class="btn-fire btn-sm shrink-0" (click)="checkIn(e)" [disabled]="busy() === e.id">
                  {{ busy() === e.id ? '…' : 'Arrivé(e)' }}
                </button>
              }
            </li>
          } @empty {
            <li class="px-6 py-10 text-center text-sable">
              @if (search()) {
                Personne trouvé(e) pour « {{ search() }} ».<br />Essayez le téléphone ou une autre orthographe.
              } @else {
                Aucun invité.
              }
            </li>
          }
        </ul>
      }

      @if (toast()) {
        <div class="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-sm rounded-xl border border-or/50 bg-bordeaux-dark px-4 py-3 text-center shadow-xl" role="status">
          {{ toast() }}
        </div>
      }
    </main>
  `,
})
export default class AccueilPage implements OnInit, OnDestroy {
  private readonly db = inject(AdminService).client;

  protected readonly entries = signal<Entry[]>([]);
  protected readonly loading = signal(true);
  protected readonly search = signal('');
  protected readonly busy = signal<string | null>(null);
  protected readonly toast = signal('');

  protected readonly filtered = computed(() => {
    const q = fold(this.search().trim());
    if (!q) return this.entries();
    const digits = q.replace(/\D/g, '');
    return this.entries().filter(
      (e) => e.haystack.includes(q) || (digits.length >= 4 && !!e.telephone?.includes(digits)),
    );
  });

  protected readonly stats = computed(() => {
    const list = this.entries();
    return {
      personnes: list.reduce((n, e) => n + (e.arrivee_at ? (e.presents ?? 1) : 0), 0),
      attendus: list.reduce((n, e) => n + (e.presence === 'oui' ? e.attendus : 0), 0),
    };
  });

  // ponytail: rechargement toutes les 30 s pour voir les arrivées pointées sur les autres téléphones ; Supabase Realtime si besoin d'instantané.
  private readonly timer = setInterval(() => document.visibilityState === 'visible' && this.load(), 30_000);

  constructor() {
    inject(Meta).updateTag({ name: 'robots', content: 'noindex, nofollow' });
  }

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
    clearTimeout(this.toastTimer);
  }

  protected async load(): Promise<void> {
    const [inv, rep] = await Promise.all([
      this.db.from('invites').select('*'),
      this.db.from('reponses').select('*'),
    ]);
    this.loading.set(false);
    if (inv.error || rep.error) return this.notify('Erreur de chargement : ' + (inv.error ?? rep.error)!.message);

    const invites = inv.data as InviteRow[];
    const reponses = rep.data as ReponseRow[];
    const byInvite = new Map(reponses.filter((r) => r.invite_id).map((r) => [r.invite_id!, r]));
    const entry = (
      table: Entry['table'],
      row: InviteRow | ReponseRow,
      nom: string,
      telephone: string | null,
      code: string | null,
      r?: ReponseRow,
    ): Entry => ({
      table,
      id: row.id,
      nom,
      telephone,
      code,
      presence: r?.presence ?? null,
      attendus: r?.presence === 'oui' ? r.nombre : 1,
      arrivee_at: row.arrivee_at,
      presents: row.presents,
      haystack: fold([nom, r?.nom, telephone, code].filter(Boolean).join(' ')),
    });

    this.entries.set(
      [
        ...invites.map((i) => {
          const r = byInvite.get(i.id);
          return entry('invites', i, [i.prenom, i.nom].filter(Boolean).join(' '), i.telephone ?? r?.telephone ?? null, i.code, r);
        }),
        ...reponses.filter((r) => !r.invite_id).map((r) => entry('reponses', r, r.nom, r.telephone, null, r)),
      ].sort((a, b) => a.nom.localeCompare(b.nom, 'fr')),
    );
  }

  protected async checkIn(e: Entry): Promise<void> {
    this.busy.set(e.id);
    const { data, error } = await this.db
      .from(e.table)
      .update({ arrivee_at: new Date().toISOString(), presents: e.attendus })
      .eq('id', e.id)
      .is('arrivee_at', null) // déjà pointé sur un autre téléphone : ne pas écraser
      .select('arrivee_at, presents');
    this.busy.set(null);
    if (error) return this.notify('Erreur : ' + error.message);
    if (!data.length) {
      this.notify(`${e.nom} était déjà pointé(e).`);
      return this.load();
    }
    this.patch(e, data[0]);
    this.notify(`Bienvenue ${e.nom} ✔`);
  }

  protected async setPresents(e: Entry, delta: number): Promise<void> {
    const presents = Math.min(50, Math.max(1, (e.presents ?? 1) + delta));
    if (presents === e.presents) return;
    this.patch(e, { presents });
    const { error } = await this.db.from(e.table).update({ presents }).eq('id', e.id);
    if (error) {
      this.patch(e, { presents: e.presents });
      this.notify('Erreur : ' + error.message);
    }
  }

  protected async undo(e: Entry): Promise<void> {
    if (!confirm(`Annuler l'arrivée de ${e.nom} ?`)) return;
    const { error } = await this.db.from(e.table).update({ arrivee_at: null, presents: null }).eq('id', e.id);
    if (error) return this.notify('Erreur : ' + error.message);
    this.patch(e, { arrivee_at: null, presents: null });
  }

  private patch(e: Entry, changes: Partial<Entry>): void {
    this.entries.update((list) => list.map((x) => (x.id === e.id ? { ...x, ...changes } : x)));
  }

  private toastTimer?: ReturnType<typeof setTimeout>;
  private notify(message: string): void {
    this.toast.set(message);
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(''), 3000);
  }
}

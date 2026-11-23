import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Meta } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { EVENT } from '../event';
import { Presence, csvToInvites, downloadFile, normalizeTogoPhone, toCsv, togoPhoneValidator } from '../utils';
import { AdminService } from './admin.routes';

interface InviteRow {
  id: string;
  code: string;
  prenom: string;
  nom: string | null;
  telephone: string | null;
  created_at: string;
}
interface ReponseRow {
  id: string;
  invite_id: string | null;
  nom: string;
  telephone: string;
  nombre: number;
  presence: Presence;
  message: string | null;
  created_at: string;
  updated_at: string;
}

export const PRESENCE_LABEL: Record<Presence, string> = { oui: 'Oui', non: 'Non' };

@Component({
  selector: 'app-admin',
  imports: [ReactiveFormsModule, DatePipe],
  templateUrl: './admin.page.html',
})
export default class AdminPage implements OnInit {
  private readonly db = inject(AdminService).client;
  private readonly router = inject(Router);

  protected readonly labels = PRESENCE_LABEL;
  protected readonly invites = signal<InviteRow[]>([]);
  protected readonly reponses = signal<ReponseRow[]>([]);
  protected readonly loading = signal(true);
  protected readonly toast = signal('');
  protected readonly search = signal('');
  protected readonly tab = signal<'invites' | 'reponses'>('invites');
  protected readonly origin = (environment.siteUrl || location.origin).replace(/\/$/, '');

  protected readonly addForm = new FormGroup({
    prenom: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(80)] }),
    nom: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(80)] }),
    telephone: new FormControl('', { nonNullable: true, validators: [togoPhoneValidator] }),
  });

  protected readonly reponseByInvite = computed(
    () => new Map(this.reponses().filter((r) => r.invite_id).map((r) => [r.invite_id!, r])),
  );

  protected readonly totals = computed(() => {
    const rs = this.reponses();
    const sum = (p: Presence) => rs.filter((r) => r.presence === p).reduce((n, r) => n + r.nombre, 0);
    const count = (p: Presence) => rs.filter((r) => r.presence === p).length;
    return {
      invites: this.invites().length,
      sansReponse: this.invites().filter((i) => !this.reponseByInvite().has(i.id)).length,
      reponses: rs.length,
      oui: count('oui'),
      personnesOui: sum('oui'),
      non: count('non'),
    };
  });

  protected readonly filteredInvites = computed(() => {
    const q = this.search().trim().toLowerCase();
    if (!q) return this.invites();
    return this.invites().filter((i) =>
      [i.prenom, i.nom, i.telephone, i.code].some((v) => v?.toLowerCase().includes(q)),
    );
  });

  protected readonly filteredReponses = computed(() => {
    const q = this.search().trim().toLowerCase();
    if (!q) return this.reponses();
    return this.reponses().filter((r) => [r.nom, r.telephone, r.message].some((v) => v?.toLowerCase().includes(q)));
  });

  constructor() {
    inject(Meta).updateTag({ name: 'robots', content: 'noindex, nofollow' });
  }

  ngOnInit(): void {
    this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    const [inv, rep] = await Promise.all([
      this.db.from('invites').select('*').order('created_at', { ascending: false }),
      this.db.from('reponses').select('*').order('updated_at', { ascending: false }),
    ]);
    this.loading.set(false);
    if (inv.error || rep.error) return this.notify('Erreur de chargement : ' + (inv.error ?? rep.error)!.message);
    this.invites.set(inv.data as InviteRow[]);
    this.reponses.set(rep.data as ReponseRow[]);
  }

  protected link(code: string): string {
    return `${this.origin}/i/${code}`;
  }

  protected whatsappLink(i: InviteRow): string {
    const text =
      `Bonjour ${i.prenom} 🙏🔥\n\nVous êtes personnellement invité(e) à l'*${EVENT.nom}* avec ${EVENT.orateur}.\n` +
      `📅 ${EVENT.dateTexte}, ${EVENT.heureTexte}\n📍 ${EVENT.lieu}, Klikanmé (Lomé)\n\n` +
      `Ouvrez votre invitation et confirmez votre présence ici :\n${this.link(i.code)}`;
    const phone = i.telephone?.replace(/\D/g, '') ?? '';
    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  }

  protected async addInvite(): Promise<void> {
    if (this.addForm.invalid) return this.addForm.markAllAsTouched();
    const v = this.addForm.getRawValue();
    const { data, error } = await this.db
      .from('invites')
      .insert({ prenom: v.prenom.trim(), nom: v.nom.trim() || null, telephone: normalizeTogoPhone(v.telephone) })
      .select()
      .single();
    if (error) return this.notify('Erreur : ' + error.message);
    this.invites.update((list) => [data as InviteRow, ...list]);
    this.addForm.reset();
    this.notify(`${v.prenom} ajouté(e)`);
  }

  protected async importCsv(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const rows = csvToInvites(await file.text());
    if (!rows.length) return this.notify('Aucun invité trouvé dans le fichier.');
    const { error } = await this.db.from('invites').insert(rows);
    if (error) return this.notify("Erreur d'import : " + error.message);
    await this.load();
    this.notify(`${rows.length} invité(s) importé(s)`);
  }

  protected async remove(i: InviteRow): Promise<void> {
    if (!confirm(`Supprimer l'invitation de ${i.prenom} (et sa réponse) ?`)) return;
    const { error } = await this.db.from('invites').delete().eq('id', i.id);
    if (error) return this.notify('Erreur : ' + error.message);
    this.invites.update((list) => list.filter((x) => x.id !== i.id));
    this.reponses.update((list) => list.filter((r) => r.invite_id !== i.id));
  }

  protected async copy(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.notify('Lien copié ✔');
    } catch {
      prompt('Copiez le lien :', text);
    }
  }

  protected exportCsv(): void {
    const header = ['Prénom', 'Nom', 'Téléphone invité', 'Lien', 'Présence', 'Personnes', 'Nom (réponse)', 'Téléphone (réponse)', 'Message', 'Date de réponse'];
    const fmt = (d?: string) => (d ? new Date(d).toLocaleString('fr-FR', { timeZone: 'Africa/Lome' }) : '');
    const rows = this.invites().map((i) => {
      const r = this.reponseByInvite().get(i.id);
      return [i.prenom, i.nom, i.telephone, this.link(i.code), r ? this.labels[r.presence] : 'Sans réponse', r?.nombre, r?.nom, r?.telephone, r?.message, fmt(r?.updated_at)];
    });
    const publics = this.reponses()
      .filter((r) => !r.invite_id)
      .map((r) => ['', '', '', 'Lien public', this.labels[r.presence], r.nombre, r.nom, r.telephone, r.message, fmt(r.updated_at)]);
    downloadFile(`invites-reponses-${new Date().toISOString().slice(0, 10)}.csv`, toCsv([header, ...rows, ...publics]), 'text/csv;charset=utf-8');
  }

  protected downloadTemplate(): void {
    downloadFile('modele-invites.csv', toCsv([['prenom', 'nom', 'telephone'], ['Jean', 'Koffi', '90 00 00 00']]), 'text/csv;charset=utf-8');
  }

  protected async logout(): Promise<void> {
    await this.db.auth.signOut();
    this.router.navigateByUrl('/admin/login');
  }

  private toastTimer?: ReturnType<typeof setTimeout>;
  private notify(message: string): void {
    this.toast.set(message);
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(''), 3000);
  }
}

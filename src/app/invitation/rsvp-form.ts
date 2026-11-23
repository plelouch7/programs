import { Component, ElementRef, OnInit, inject, input, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { EVENT } from '../event';
import { Invitation, Presence, normalizeTogoPhone, rpc, togoPhoneValidator } from '../utils';

@Component({
  selector: 'app-rsvp-form',
  imports: [ReactiveFormsModule],
  templateUrl: './rsvp-form.html',
})
export class RsvpForm implements OnInit {
  readonly code = input('');
  readonly invite = input<Invitation | null>(null);

  protected readonly ev = EVENT;
  protected readonly status = signal<'idle' | 'sending' | 'done' | 'error'>('idle');
  protected readonly errorMessage = signal('');
  protected readonly sentPresence = signal<Presence>('oui');
  protected readonly submitted = signal(false);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly presences: { value: Presence; label: string }[] = [
    { value: 'oui', label: 'Oui, je viens' },
    { value: 'non', label: 'Non, désolé(e)' },
  ];

  protected readonly form = new FormGroup({
    nom: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(120)] }),
    telephone: new FormControl('', { nonNullable: true, validators: [Validators.required, togoPhoneValidator] }),
    nombre: new FormControl(1, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1), Validators.max(20)],
    }),
    presence: new FormControl<Presence>('oui', { nonNullable: true, validators: [Validators.required] }),
    message: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
  });

  ngOnInit(): void {
    const invite = this.invite();
    const r = invite?.reponse;
    if (r) {
      this.form.setValue({
        nom: r.nom,
        telephone: r.telephone.replace(/^\+228/, ''),
        nombre: r.nombre,
        presence: r.presence,
        message: r.message ?? '',
      });
      this.sentPresence.set(r.presence);
      this.status.set('done');
    } else if (invite) {
      this.form.patchValue({ nom: [invite.prenom, invite.nom].filter(Boolean).join(' ') });
    }
  }

  protected showError(name: keyof typeof this.form.controls): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.touched || this.submitted());
  }

  protected step(delta: number): void {
    const c = this.form.controls.nombre;
    c.setValue(Math.min(20, Math.max(1, (Number(c.value) || 1) + delta)));
  }

  async submit(): Promise<void> {
    this.submitted.set(true);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.host.nativeElement.querySelector<HTMLElement>('.ng-invalid:not(form)')?.focus();
      return;
    }
    const v = this.form.getRawValue();
    this.status.set('sending');
    try {
      await rpc('submit_reponse', {
        p_code: this.code() || null,
        p_nom: v.nom.trim(),
        p_telephone: normalizeTogoPhone(v.telephone),
        p_nombre: v.presence === 'non' ? 1 : Number(v.nombre),
        p_presence: v.presence,
        p_message: v.message.trim() || null,
      });
      this.sentPresence.set(v.presence);
      this.status.set('done');
      // Le formulaire se replie : ramener le message de remerciement à l'écran.
      requestAnimationFrame(() => this.host.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    } catch (e) {
      console.error('[rsvp]', e);
      this.errorMessage.set(
        `Impossible d'envoyer votre réponse pour le moment. Vérifiez votre connexion et réessayez, ou appelez l'infoline au ${EVENT.infoline[0]}.`,
      );
      this.status.set('error');
    }
  }

  protected edit(): void {
    this.status.set('idle');
  }
}

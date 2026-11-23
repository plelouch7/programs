import { Component, inject, input, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Meta } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { AdminService } from './admin.routes';

@Component({
  selector: 'app-admin-login',
  imports: [ReactiveFormsModule],
  template: `
    <main class="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5">
      <p class="eyebrow text-center">Espace organisateurs</p>
      <h1 class="section-title text-center">Connexion</h1>
      <form class="card space-y-4" [formGroup]="form" (ngSubmit)="login()">
        <div>
          <label class="field-label" for="email">E-mail</label>
          <input id="email" class="field" type="email" formControlName="email" autocomplete="username" />
        </div>
        <div>
          <label class="field-label" for="password">Mot de passe</label>
          <input id="password" class="field" type="password" formControlName="password" autocomplete="current-password" />
        </div>
        @if (error()) {
          <p class="field-error" role="alert">{{ error() }}</p>
        } @else if (refuse()) {
          <p class="field-error" role="alert">Ce compte n'a pas les droits d'administration.</p>
        }
        <button class="btn-fire w-full" type="submit" [disabled]="loading() || form.invalid">
          {{ loading() ? 'Connexion…' : 'Se connecter' }}
        </button>
      </form>
    </main>
  `,
})
export default class LoginPage {
  readonly refuse = input<string>();
  private readonly admin = inject(AdminService);
  private readonly router = inject(Router);
  protected readonly loading = signal(false);
  protected readonly error = signal('');

  protected readonly form = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  constructor() {
    inject(Meta).updateTag({ name: 'robots', content: 'noindex, nofollow' });
  }

  async login(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    const { error } = await this.admin.client.auth.signInWithPassword(this.form.getRawValue());
    this.loading.set(false);
    if (error) {
      this.error.set('E-mail ou mot de passe incorrect.');
      return;
    }
    this.router.navigateByUrl('/admin');
  }
}

import { Injectable, inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { createClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

/** Client Supabase complet, chargé uniquement dans l'espace admin (lazy). */
@Injectable({ providedIn: 'root' })
export class AdminService {
  readonly client = createClient(environment.supabaseUrl, environment.supabaseAnonKey);
}

/** Exige une session Supabase ET un e-mail présent dans la table admins. */
const adminGuard: CanActivateFn = async () => {
  const { client } = inject(AdminService);
  const router = inject(Router);
  const { data } = await client.auth.getSession();
  if (!data.session) return router.createUrlTree(['/admin/login']);
  const { data: isAdmin } = await client.rpc('is_admin');
  if (isAdmin === true) return true;
  await client.auth.signOut();
  return router.createUrlTree(['/admin/login'], { queryParams: { refuse: 1 } });
};

export default [
  { path: 'login', loadComponent: () => import('./login.page'), title: 'Connexion admin' },
  { path: '', canActivate: [adminGuard], loadComponent: () => import('./admin.page'), title: 'Administration — Invités' },
] satisfies Routes;

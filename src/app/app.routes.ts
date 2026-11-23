import { TransferState, inject, makeStateKey } from '@angular/core';
import { ResolveFn, Routes } from '@angular/router';
import { Invitation, rpc } from './utils';

/** Charge l'invité (côté serveur pour l'aperçu WhatsApp, puis transmis au navigateur). */
const inviteResolver: ResolveFn<Invitation | null> = async (route) => {
  const code = (route.paramMap.get('code') ?? '').toLowerCase();
  const state = inject(TransferState);
  const key = makeStateKey<Invitation | null>(`invite-${code}`);
  if (state.hasKey(key)) return state.get(key, null);
  const invite = await rpc<Invitation | null>('get_invitation', { p_code: code }).catch((e) => {
    console.error('[invite]', e);
    return null;
  });
  state.set(key, invite);
  return invite;
};

const invitationPage = () => import('./invitation/invitation.page');

export const routes: Routes = [
  { path: '', loadComponent: invitationPage },
  { path: 'i/:code', loadComponent: invitationPage, resolve: { invite: inviteResolver } },
  { path: 'admin', loadChildren: () => import('./admin/admin.routes') },
  { path: '**', redirectTo: '' },
];

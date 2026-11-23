import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  { path: 'admin/**', renderMode: RenderMode.Client },
  { path: 'admin', renderMode: RenderMode.Client },
  // Rendu serveur : meta Open Graph personnalisées pour chaque lien partagé sur WhatsApp
  { path: '**', renderMode: RenderMode.Server },
];

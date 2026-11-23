import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';
import { environment } from './environments/environment';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine({
  // TODO: This is a security-sensitive option. Remove if not needed. For more information, see https://angular.dev/best-practices/security#configuring-trusted-proxy-headers
  trustProxyHeaders: ['x-forwarded-host', 'x-forwarded-proto'],
});

/** URL absolue du site : SITE_URL, sinon hôte de la requête. */
const siteOrigin = (req: express.Request) =>
  (environment.siteUrl || `${req.get('x-forwarded-proto') ?? req.protocol}://${req.get('host')}`).replace(/\/$/, '');

app.get('/robots.txt', (req, res) => {
  res
    .type('text/plain')
    .send(`User-agent: *\nDisallow: /admin\nDisallow: /i/\n\nSitemap: ${siteOrigin(req)}/sitemap.xml\n`);
});

// Une seule page publique : les liens /i/… sont personnels et non indexés
app.get('/sitemap.xml', (req, res) => {
  res
    .type('application/xml')
    .send(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${siteOrigin(req)}/</loc></url>\n</urlset>\n`,
    );
});

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);

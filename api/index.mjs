// Fonction Vercel : délègue toutes les pages au serveur Angular SSR.
// Les fichiers statiques (JS, CSS, images) sont servis directement par le CDN de Vercel.
export default async function handler(req, res) {
  const { reqHandler } = await import('../dist/program-event/server/server.mjs');
  return reqHandler(req, res);
}

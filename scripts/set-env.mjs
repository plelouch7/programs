// Génère src/environments/environment.ts depuis les variables d'environnement
// (utile sur Vercel). Ne fait rien si SUPABASE_URL n'est pas définie.
import { writeFileSync } from 'node:fs';

const { SUPABASE_URL, SUPABASE_ANON_KEY, SITE_URL = '' } = process.env;

if (!SUPABASE_URL) {
  console.log('[set-env] SUPABASE_URL absente : environment.ts conservé tel quel.');
  process.exit(0);
}
if (!SUPABASE_ANON_KEY) {
  console.error('[set-env] SUPABASE_ANON_KEY manquante.');
  process.exit(1);
}

const env = { supabaseUrl: SUPABASE_URL, supabaseAnonKey: SUPABASE_ANON_KEY, siteUrl: SITE_URL };
writeFileSync(
  new URL('../src/environments/environment.ts', import.meta.url),
  `// Généré par scripts/set-env.mjs\nexport const environment = ${JSON.stringify(env, null, 2)};\n`,
);
console.log('[set-env] environment.ts généré.');

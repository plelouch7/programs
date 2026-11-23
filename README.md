# Invasion Apostolic & Prophétique — site d'invitation

Site d'invitation en ligne pour la journée **Invasion Apostolic & Prophétique** avec **Dr Edor Norbert**
(samedi 12 décembre 2026, 8h00 – 14h00, Centre Wycliffe Togo, Klikanmé, Lomé).

- Un lien personnel par invité (`/i/ab12cd`) qui affiche son prénom, plus un lien public (`/`).
- Écran « enveloppe », compte à rebours, détails, itinéraire, ajout au calendrier (.ics), orateur, programme.
- Formulaire de confirmation de présence (numéro togolais +228 validé).
- Espace admin protégé (`/admin`) : ajout d'invités (un par un ou CSV), copie du lien, envoi WhatsApp en un clic,
  réponses, totaux, export CSV.
- Aperçu WhatsApp (Open Graph) personnalisé grâce au rendu serveur (SSR) : « Komi, vous êtes invité(e) — … ».

**Technique** : Angular 22 (composants standalone, signals, zoneless, lazy loading), Angular SSR + Express,
Tailwind CSS 4, Reactive Forms, Supabase (Postgres + Auth + RLS).

---

## 1. Installation locale

Prérequis : Node.js 22.22+ ou 24.15+ (`node -v`).

```bash
npm install
npm start            # http://localhost:4200 (développement)
```

Tester le rendu serveur comme en production :

```bash
npm run build
npm run serve:ssr    # http://localhost:4000
```

Tests unitaires (validation du téléphone, CSV, fichier .ics) :

```bash
npm test -- --watch=false
```

## 2. Configurer Supabase

1. Créez un projet gratuit sur <https://supabase.com>.
2. **SQL Editor > New query** : collez le contenu de [`supabase/schema.sql`](supabase/schema.sql).
   **Avant d'exécuter**, remplacez `admin@exemple.com` (dernière ligne) par votre e-mail d'administrateur. Cliquez **Run**.
3. **Authentication > Users > Add user > Create new user** : créez ce compte admin (même e-mail) avec un mot de passe solide,
   cochez « Auto Confirm User ».
4. Recommandé : **Authentication > Sign In / Providers > Email** : désactivez « Allow new users to sign up ».
   (Même sans cela, seul un e-mail présent dans la table `admins` peut lire les données.)

Plusieurs admins ? Ajoutez une ligne par e-mail :

```sql
insert into public.admins (email) values ('autre.admin@exemple.com');
```

### Sécurité (RLS)

| Qui | Accès |
| --- | --- |
| Invité (clé publique) | Uniquement **sa** ligne, via son code : fonction `get_invitation(code)` ; envoi/modification de **sa** réponse via `submit_reponse(...)`. Aucune lecture directe des tables. |
| Lien public | Peut seulement **ajouter** une réponse (`submit_reponse` sans code). |
| Admin connecté (e-mail dans `admins`) | Lecture/écriture complète des tables `invites` et `reponses`. |

Le téléphone est validé côté navigateur **et** par une contrainte SQL (`+228` + 8 chiffres).

## 3. Variables d'environnement

Les clés se trouvent dans **Supabase > Project Settings > API** (ou **API Keys**).

| Variable | Exemple | Rôle |
| --- | --- | --- |
| `SUPABASE_URL` | `https://abcd1234.supabase.co` | URL du projet |
| `SUPABASE_ANON_KEY` | `eyJhbGciOi…` ou `sb_publishable_…` | Clé **publique** (anon / publishable). ⚠️ Jamais la clé `service_role` / `secret`. |
| `SITE_URL` | `https://invasion.vercel.app` | Facultatif : URL publique utilisée dans les liens et l'aperçu WhatsApp (sinon détectée automatiquement). |
| `NG_ALLOWED_HOSTS` | `invasion-apostolic.org,www.invasion-apostolic.org` | À définir **si vous utilisez un nom de domaine personnalisé** (les domaines `*.vercel.app` sont déjà autorisés). |

**En local** : éditez directement [`src/environments/environment.ts`](src/environments/environment.ts).

**En production** : `npm run build` exécute d'abord [`scripts/set-env.mjs`](scripts/set-env.mjs), qui régénère
`environment.ts` à partir de `SUPABASE_URL`, `SUPABASE_ANON_KEY` et `SITE_URL`. Les clés ne sont donc jamais écrites en dur
dans le code source.

## 4. Personnaliser le contenu

Tout le texte de l'événement est dans **[`src/app/event.ts`](src/app/event.ts)** :

- `mapsUrl` : lien Google Maps du lieu (bouton « Itinéraire »).
- `orateurs` : **[À COMPLÉTER]** les 4 orateurs (nom, rôle, photo, biographie). Le premier est mis en avant en haut de la page,
  les autres sont cités dessous (« avec … ») et présentés dans la section « Les orateurs ».
- `verset` : verset du thème (Colossiens 2:14-15).
- `programme` : **[À COMPLÉTER]** horaires et titres (louange, enseignement, prière, délivrance…).
- `musique` : musique de fond facultative (voir ci-dessous).

### Images (dossier `public/`)

Des images **provisoires** sont fournies ; remplacez-les en gardant les mêmes noms :

| Fichier | Format conseillé |
| --- | --- |
| `public/orateur.jpg` (et une photo par orateur, ex. `orateur-2.jpg`, à déclarer dans `orateurs[].photo`) | Portrait 4:5, 600×750 px (visage dans le tiers haut), < 150 Ko |
| `public/og-image.jpg` | Aperçu WhatsApp/Facebook **1200×630 px** (JPG < 300 Ko), composé à partir de l'image de la croix avec le titre, la date et le lieu |
| `public/croix-900.webp`, `public/croix-1536.webp` | Image de fond du haut de page (Colossiens 2:14-15), même image en 900 et 1536 px de large, WebP |
| `public/favicon.ico` | Icône d'onglet |

### Musique de fond (option)

Déposez un MP3 léger (< 2 Mo) dans `public/musique.mp3` puis mettez `musique: '/musique.mp3'` dans `event.ts`.
Un bouton lecture/pause apparaît en bas à gauche ; la musique ne démarre **jamais** automatiquement.

## 5. Ajouter des invités

1. Ouvrez `https://votre-site/admin` et connectez-vous avec le compte admin.
2. **Un par un** : prénom (obligatoire), nom, téléphone → *Ajouter*. Un code unique à 6 caractères est généré.
3. **Par CSV** : *Importer un CSV* (modèle téléchargeable dans la page). Colonnes : `prenom, nom, telephone`
   (séparateur `,` ou `;`, en-tête facultatif) :

   ```csv
   prenom;nom;telephone
   Komi;Mensah;90 11 22 33
   Afi;;
   ```

4. Pour chaque invité :
   - **WhatsApp** ouvre WhatsApp avec un message prêt à envoyer contenant son lien personnel
     (directement vers son numéro s'il est renseigné, sinon vous choisissez le contact).
   - **Copier le lien** copie `https://votre-site/i/<code>`.
5. Les réponses apparaissent dans l'onglet **Réponses** ; les totaux (personnes attendues, non, sans réponse)
   sont en haut. **Exporter CSV** produit un fichier lisible dans Excel (séparateur `;`).

Le lien public `https://votre-site/` fonctionne aussi : la personne saisit son nom et répond.

## 6. Déploiement gratuit sur Vercel

La configuration est incluse : [`vercel.json`](vercel.json) + [`api/index.mjs`](api/index.mjs)
(fichiers statiques servis par le CDN, pages rendues par une fonction Node SSR).

1. Poussez le projet sur GitHub (ou GitLab / Bitbucket).
2. Sur <https://vercel.com> : **Add New > Project**, importez le dépôt. Laissez *Framework Preset* sur **Other**
   (les commandes sont lues dans `vercel.json`).
3. **Environment Variables** : ajoutez `SUPABASE_URL`, `SUPABASE_ANON_KEY` (et `SITE_URL` une fois l'URL connue).
4. **Deploy**. Testez `https://<projet>.vercel.app/` puis un lien `/i/<code>`.
5. Domaine personnalisé : *Settings > Domains*, puis ajoutez `NG_ALLOWED_HOSTS=mondomaine.org,www.mondomaine.org`
   et `SITE_URL=https://mondomaine.org` dans les variables, et redéployez.

### Vérifier l'aperçu WhatsApp

- Collez un lien d'invité dans <https://developers.facebook.com/tools/debug/> (même moteur que WhatsApp) :
  le titre doit contenir le prénom et l'image 1200×630 doit s'afficher.
- WhatsApp met les aperçus en cache : après avoir changé `og-image.jpg`, renommez-le (ex. `og-image-v2.jpg`)
  et mettez à jour `imageOg` dans `event.ts`.

### Autres hébergeurs

Le serveur est un Express standard (`dist/program-event/server/server.mjs`, port `PORT`) : il fonctionne sur tout hébergeur
Node (Render, Railway, Firebase App Hosting…). Exécutez `npm run build` puis `npm run serve:ssr`, avec les mêmes variables
d'environnement.

## 7. Structure

```
src/app/
  event.ts                  ← contenu de l'événement (à personnaliser)
  utils.ts                  ← téléphone +228, appel RPC, .ics, CSV
  seo.service.ts            ← Title + Meta (Open Graph, noindex)
  app.routes.ts             ← routes lazy + resolver de l'invité (TransferState)
  app.routes.server.ts      ← SSR pour / et /i/:code, rendu client pour /admin
  invitation/               ← page d'invitation, compte à rebours, formulaire, animations
  admin/                    ← connexion, guard, tableau de bord
supabase/schema.sql         ← tables, RLS, fonctions
api/index.mjs, vercel.json  ← déploiement Vercel
```

### Notes de conception

- **Performances mobiles** : la page publique n'embarque pas `@supabase/supabase-js` (≈ 50 Ko gzip) ; elle appelle les
  2 fonctions RPC avec `fetch`. Le client Supabase complet n'est chargé que dans l'espace admin. Animations uniquement en
  `transform`/`opacity`, désactivées si l'utilisateur a choisi « réduire les animations ».
- **Animations** : le paquet `@angular/animations` est déprécié depuis Angular 20.2 ; le site utilise donc l'API native
  qui le remplace (`animate.enter` / `animate.leave`) et des transitions CSS déclenchées par `IntersectionObserver`.
- **Compte à rebours** : signal mis à jour chaque seconde, calculé sur l'instant absolu `2026-12-12T08:00:00Z`
  (Lomé = GMT), donc juste quel que soit le fuseau du téléphone.

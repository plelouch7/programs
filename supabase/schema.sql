-- =====================================================================
--  Invasion Apostolic & Prophétique — schéma Supabase
--  À exécuter une fois dans Supabase > SQL Editor > New query > Run.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Administrateurs : e-mails autorisés à voir et gérer toutes les données.
-- Ajoutez le vôtre en bas de ce fichier.
-- ---------------------------------------------------------------------
create table if not exists public.admins (
  email text primary key
);
alter table public.admins enable row level security;
-- Aucune policy : la table n'est lisible par personne via l'API.

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.admins where email = lower(auth.jwt() ->> 'email')
  );
$$;

-- Code d'invitation : 6 caractères sans ambiguïté (pas de l, o, 0, 1).
create or replace function public.gen_code()
returns text
language plpgsql volatile set search_path = public, extensions
as $$
declare
  chars constant text := 'abcdefghijkmnpqrstuvwxyz23456789'; -- 32 caractères
  bytes bytea := gen_random_bytes(6);
  result text := '';
begin
  for i in 0..5 loop
    result := result || substr(chars, 1 + (get_byte(bytes, i) % 32), 1);
  end loop;
  return result;
end;
$$;

-- ---------------------------------------------------------------------
-- Invités
-- ---------------------------------------------------------------------
create table if not exists public.invites (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique default public.gen_code(),
  prenom     text not null check (char_length(prenom) between 1 and 80),
  nom        text check (char_length(nom) <= 80),
  telephone  text check (telephone ~ '^\+228[0-9]{8}$'),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Réponses (une par invité ; plusieurs possibles via le lien public)
-- ---------------------------------------------------------------------
create table if not exists public.reponses (
  id         uuid primary key default gen_random_uuid(),
  invite_id  uuid unique references public.invites (id) on delete cascade,
  nom        text not null check (char_length(nom) between 1 and 120),
  telephone  text not null check (telephone ~ '^\+228[0-9]{8}$'),
  nombre     int  not null check (nombre between 1 and 20),
  presence   text not null check (presence in ('oui', 'non')),
  message    text check (char_length(message) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Accueil le jour J : heure d'arrivée et nombre de personnes réellement venues.
-- Sur l'invité s'il a une invitation personnelle, sinon sur la réponse (lien public).
-- (Base déjà créée ? Exécutez seulement ces 4 lignes.)
-- ---------------------------------------------------------------------
alter table public.invites  add column if not exists arrivee_at timestamptz;
alter table public.invites  add column if not exists presents int check (presents between 1 and 50);
alter table public.reponses add column if not exists arrivee_at timestamptz;
alter table public.reponses add column if not exists presents int check (presents between 1 and 50);

-- ---------------------------------------------------------------------
-- RLS : seul l'admin lit/écrit les tables directement.
-- ---------------------------------------------------------------------
alter table public.invites  enable row level security;
alter table public.reponses enable row level security;

drop policy if exists "admin gere invites" on public.invites;
create policy "admin gere invites" on public.invites
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin gere reponses" on public.reponses;
create policy "admin gere reponses" on public.reponses
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- Accès invité : uniquement SA ligne, via son code (fonctions RPC).
-- ---------------------------------------------------------------------
create or replace function public.get_invitation(p_code text)
returns json
language sql stable security definer set search_path = public
as $$
  select json_build_object(
    'prenom', i.prenom,
    'nom', i.nom,
    'reponse', (
      select json_build_object(
        'nom', r.nom, 'telephone', r.telephone, 'nombre', r.nombre,
        'presence', r.presence, 'message', r.message)
      from public.reponses r where r.invite_id = i.id
    )
  )
  from public.invites i
  where i.code = lower(trim(p_code));
$$;

create or replace function public.submit_reponse(
  p_code text, p_nom text, p_telephone text, p_nombre int, p_presence text, p_message text
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_invite uuid;
begin
  if coalesce(trim(p_code), '') = '' then
    -- Lien public : nouvelle réponse à chaque envoi.
    insert into public.reponses (nom, telephone, nombre, presence, message)
    values (trim(p_nom), p_telephone, p_nombre, p_presence, nullif(trim(p_message), ''));
    return;
  end if;

  select id into v_invite from public.invites where code = lower(trim(p_code));
  if v_invite is null then
    raise exception 'Invitation introuvable';
  end if;

  insert into public.reponses (invite_id, nom, telephone, nombre, presence, message)
  values (v_invite, trim(p_nom), p_telephone, p_nombre, p_presence, nullif(trim(p_message), ''))
  on conflict (invite_id) do update set
    nom = excluded.nom, telephone = excluded.telephone, nombre = excluded.nombre,
    presence = excluded.presence, message = excluded.message, updated_at = now();
end;
$$;

revoke execute on function public.get_invitation(text) from public;
revoke execute on function public.submit_reponse(text, text, text, int, text, text) from public;
grant execute on function public.get_invitation(text) to anon, authenticated;
grant execute on function public.submit_reponse(text, text, text, int, text, text) to anon, authenticated;

-- Droits de table explicites pour le rôle connecté (les nouveaux projets Supabase
-- ne les accordent plus toujours par défaut). Les policies RLS ci-dessus limitent
-- toujours l'accès aux seuls admins ; le rôle anon n'a aucun accès direct aux tables.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.invites, public.reponses to authenticated;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------
-- >>> REMPLACEZ par l'e-mail du compte admin créé dans Authentication > Users
-- ---------------------------------------------------------------------
insert into public.admins (email) values (lower('admin@mailinator.com'))
  on conflict do nothing;

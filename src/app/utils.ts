import { AbstractControl, ValidationErrors } from '@angular/forms';
import { environment } from '../environments/environment';
import { EVENT } from './event';

export type Presence = 'oui' | 'non';

export interface Reponse {
  nom: string;
  telephone: string;
  nombre: number;
  presence: Presence;
  message: string | null;
}

export interface Invitation {
  prenom: string;
  nom: string | null;
  reponse: Reponse | null;
}

/** Retourne « +228XXXXXXXX » ou null si le numéro n'est pas un numéro togolais valide. */
export function normalizeTogoPhone(input: string | null | undefined): string | null {
  let digits = (input ?? '').replace(/[\s.\-()]/g, '');
  if (digits.startsWith('+228')) digits = digits.slice(4);
  else if (digits.startsWith('00228')) digits = digits.slice(5);
  else if (digits.length === 11 && digits.startsWith('228')) digits = digits.slice(3);
  return /^\d{8}$/.test(digits) ? '+228' + digits : null;
}

export function togoPhoneValidator(control: AbstractControl): ValidationErrors | null {
  if (!control.value) return null; // « required » s'en occupe
  return normalizeTogoPhone(control.value) ? null : { togoPhone: true };
}

/** Appel RPC Supabase minimal via fetch (évite de charger supabase-js sur la page publique). */
export async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const key = environment.supabaseAnonKey;
  const headers: Record<string, string> = { apikey: key, 'Content-Type': 'application/json' };
  if (key.startsWith('eyJ')) headers['Authorization'] = `Bearer ${key}`; // ancienne clé anon (JWT)
  const res = await fetch(`${environment.supabaseUrl}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(args),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.message ?? `Erreur ${res.status}`);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

// ---------------------------------------------------------------------------
// Calendrier (.ics)
// ---------------------------------------------------------------------------
const icsDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsText = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (m) => '\\' + m);

export function buildIcs(url: string, now = new Date()): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Invasion Apostolic & Prophetique//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:invasion-apostolic-${icsDate(EVENT.debut)}@invitation`,
    `DTSTAMP:${icsDate(now)}`,
    `DTSTART:${icsDate(EVENT.debut)}`,
    `DTEND:${icsDate(EVENT.fin)}`,
    `SUMMARY:${icsText(EVENT.nom + ' — ' + EVENT.orateur)}`,
    `DESCRIPTION:${icsText(`Thème : « ${EVENT.theme} »\nInfoline : ${EVENT.infoline.join(' / ')}\n${url}`)}`,
    `LOCATION:${icsText(`${EVENT.lieu}, ${EVENT.lieuDetail}`)}`,
    `URL:${url}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:Rappel',
    'TRIGGER:-P1D',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

export function googleCalendarUrl(url: string): string {
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${EVENT.nom} — ${EVENT.orateur}`,
    dates: `${icsDate(EVENT.debut)}/${icsDate(EVENT.fin)}`,
    details: `Thème : « ${EVENT.theme} »\n${url}`,
    location: `${EVENT.lieu}, ${EVENT.lieuDetail}`,
  });
  return `https://calendar.google.com/calendar/render?${p}`;
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------
/** Lecture CSV simple (séparateur , ou ; détecté, guillemets gérés). */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, '');
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? '';
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (quoted) {
      if (c === '"' && clean[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) { row.push(cell.trim()); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && clean[i + 1] === '\n') i++;
      row.push(cell.trim()); cell = '';
      if (row.some((v) => v)) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell.trim());
  if (row.some((v) => v)) rows.push(row);
  return rows;
}

/** Lignes CSV -> invités. Colonnes : prenom, nom, telephone (en-tête facultatif). */
export function csvToInvites(text: string): { prenom: string; nom: string | null; telephone: string | null }[] {
  const rows = parseCsv(text);
  if (rows[0]?.[0] && /^pr[ée]nom/i.test(rows[0][0])) rows.shift();
  return rows
    .filter((r) => r[0])
    .map(([prenom, nom, tel]) => ({
      prenom: prenom.slice(0, 80),
      nom: nom ? nom.slice(0, 80) : null,
      telephone: normalizeTogoPhone(tel),
    }));
}

/** Écriture CSV (séparateur ; pour Excel FR, BOM UTF-8, protection contre l'injection de formules). */
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  const cell = (v: string | number | null | undefined) => {
    let s = v == null ? '' : String(v);
    if (/^[=@\t\r]/.test(s) || /^[+\-](?![\d\s]*$)/.test(s)) s = "'" + s;
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '\uFEFF' + rows.map((r) => r.map(cell).join(';')).join('\r\n');
}

export function downloadFile(name: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

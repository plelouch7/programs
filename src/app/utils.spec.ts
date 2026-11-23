import { buildIcs, csvToInvites, normalizeTogoPhone, parseCsv, toCsv } from './utils';

describe('normalizeTogoPhone', () => {
  it('accepte les formats togolais', () => {
    expect(normalizeTogoPhone('91 94 12 82')).toBe('+22891941282');
    expect(normalizeTogoPhone('+228 98 88 50 42')).toBe('+22898885042');
    expect(normalizeTogoPhone('0022891941282')).toBe('+22891941282');
    expect(normalizeTogoPhone('22891941282')).toBe('+22891941282');
  });
  it('refuse les numéros invalides', () => {
    expect(normalizeTogoPhone('9194128')).toBeNull();
    expect(normalizeTogoPhone('+33 6 12 34 56 78')).toBeNull();
    expect(normalizeTogoPhone('abc')).toBeNull();
    expect(normalizeTogoPhone('')).toBeNull();
  });
});

describe('CSV', () => {
  it('lit , ou ; avec guillemets et en-tête', () => {
    expect(parseCsv('a;"b;c";"d""e"\r\nf;g;h')).toEqual([['a', 'b;c', 'd"e'], ['f', 'g', 'h']]);
    const invites = csvToInvites('prénom,nom,telephone\nJean,Koffi,90 00 00 00\nAma,,\n');
    expect(invites).toEqual([
      { prenom: 'Jean', nom: 'Koffi', telephone: '+22890000000' },
      { prenom: 'Ama', nom: null, telephone: null },
    ]);
  });
  it('échappe et neutralise les formules', () => {
    expect(toCsv([['=1+1', '+22890000000', 'a;b']])).toBe('﻿\'=1+1;+22890000000;"a;b"');
  });
});

describe('buildIcs', () => {
  it('produit un événement en GMT', () => {
    const ics = buildIcs('https://x.test/');
    expect(ics).toContain('DTSTART:20261212T080000Z');
    expect(ics).toContain('DTEND:20261212T140000Z');
    expect(ics).toContain('LOCATION:Salle climatisée du Centre Wycliffe Togo\\, Sise à Klikanmé\\, Lomé (Togo)');
  });
});

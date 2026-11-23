// Toutes les informations de l'événement : modifiez-les ici.
export const EVENT = {
  nom: 'Invasion Apostolic & Prophétique',
  orateur: 'Dr Edor Norbert',
  theme: 'La puissance de la croix contre les esprits de famille et les addictions démoniaques',

  // Heure du Togo = GMT (UTC+0)
  debut: new Date(Date.UTC(2026, 11, 12, 8, 0, 0)),
  fin: new Date(Date.UTC(2026, 11, 12, 14, 0, 0)),
  dateTexte: 'Samedi 12 décembre 2026',
  heureTexte: '8h00 – 14h00',

  lieu: 'Salle climatisée du Centre Wycliffe Togo',
  lieuDetail: 'Sise à Klikanmé, Lomé (Togo)',
  mapsUrl: 'https://maps.app.goo.gl/k9r2Munau55FYu2t9',

  infoline: ['+228 91 94 12 82', '+228 98 88 50 42'],
  whatsapp: '22891941282', // numéro WhatsApp du bouton flottant (sans +)

  // Musique de fond : déposez un fichier dans public/ (ex. public/musique.mp3)
  // puis indiquez '/musique.mp3'. Laissez vide pour masquer le bouton.
  musique: '',

  imageOg: '/og-image.jpg', // 1200×630, dans public/

  // Verset du thème (Louis Segond 1910)
  verset: {
    texte:
      "Il a effacé l'acte dont les ordonnances nous condamnaient et qui subsistait contre nous, et il l'a détruit en le clouant à la croix ; il a dépouillé les dominations et les autorités, et les a livrées publiquement en spectacle, en triomphant d'elles par la croix.",
    reference: 'Colossiens 2:14-15',
  },

  // Les 4 orateurs. Le premier est mis en avant en haut de la page.
  // [À COMPLÉTER] noms, rôles, photos (portrait 600×750 dans public/) et biographies (un paragraphe par ligne).
  orateurs: [
    {
      nom: 'Dr Edor Norbert',
      role: 'Orateur principal',
      photo: '/orateur-edor.webp',
      bio: ['[Biographie à compléter]'],
    },
    { nom: 'Prophète Samuel Maxime ADJE', role: 'Orateur', photo: '/orateur-adje.webp', bio: ['[Biographie à compléter]'] },
    { nom: 'Ens Elom AHIAKOU', role: 'Orateur', photo: '/orateur-ahiakou.webp', bio: ['[Biographie à compléter]'] },
    { nom: 'Prophète Aristide', role: 'Orateur', photo: '/orateur.jpg', bio: ['[Biographie à compléter]'] },
  ],

  // [À COMPLÉTER] Programme de la journée
  programme: [
    { heure: '08h00', titre: 'Accueil & installation', detail: 'Arrivée des participants' },
    { heure: '08h30', titre: 'Louange & adoration', detail: "Entrée dans la présence de Dieu" },
    { heure: '09h30', titre: 'Enseignement', detail: 'Dr Edor Norbert' },
    { heure: '11h30', titre: 'Prière & intercession', detail: 'Combat spirituel' },
    { heure: '12h30', titre: 'Délivrance & ministère prophétique', detail: 'Par la puissance de la croix' },
    { heure: '13h45', titre: 'Bénédiction & clôture', detail: '' },
  ],
};

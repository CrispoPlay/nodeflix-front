import { GenreOption } from './models';

export const GENRE_OPTIONS: GenreOption[] = [
  {
    id: 'drama',
    name: 'Drama',
    mood: 'Historias intensas',
    accent: '#ef4444',
    queries: ['Breaking Bad', 'The Last of Us', 'Succession']
  },
  {
    id: 'crime',
    name: 'Crimen',
    mood: 'Casos, poder y riesgo',
    accent: '#f97316',
    queries: ['Narcos', 'Peaky Blinders', 'Mindhunter']
  },
  {
    id: 'comedy',
    name: 'Comedia',
    mood: 'Ritmo ligero',
    accent: '#facc15',
    queries: ['The Office', 'Brooklyn Nine-Nine', 'Friends']
  },
  {
    id: 'scifi',
    name: 'Ciencia ficcion',
    mood: 'Mundos alternos',
    accent: '#22d3ee',
    queries: ['Stranger Things', 'Dark', 'The Expanse']
  },
  {
    id: 'fantasy',
    name: 'Fantasia',
    mood: 'Magia y linajes',
    accent: '#a78bfa',
    queries: [
      'Game of Thrones',
      'The Witcher',
      'House of the Dragon',
      'His Dark Materials',
      'The Wheel of Time',
      'The Lord of the Rings The Rings of Power',
      'Shadow and Bone',
      'Merlin',
      'Once Upon a Time',
      'The Sandman',
      'American Gods'
    ]
  },
  {
    id: 'mystery',
    name: 'Misterio',
    mood: 'Pistas y giros',
    accent: '#38bdf8',
    queries: ['Sherlock', 'True Detective', 'Only Murders in the Building']
  },
  {
    id: 'horror',
    name: 'Terror',
    mood: 'Tension oscura',
    accent: '#fb7185',
    queries: ['The Haunting', 'American Horror Story', 'From']
  },
  {
    id: 'anime',
    name: 'Anime',
    mood: 'Arcos memorables',
    accent: '#34d399',
    queries: [
      'One Piece',
      'Attack on Titan',
      'Demon Slayer',
      'Jujutsu Kaisen',
      'Naruto Shippuden',
      'Death Note',
      'My Hero Academia',
      'Chainsaw Man',
      'Spy x Family',
      'Dragon Ball Super',
      'Fullmetal Alchemist Brotherhood'
    ]
  },
  {
    id: 'romance',
    name: 'Romance',
    mood: 'Vinculos y deseo',
    accent: '#f472b6',
    queries: ['Bridgerton', 'Normal People', 'Outlander']
  },
  {
    id: 'documentary',
    name: 'Documental',
    mood: 'Historias reales',
    accent: '#2dd4bf',
    queries: ['Planet Earth', 'Chef\'s Table', 'Formula 1 Drive to Survive']
  },
  {
    id: 'action',
    name: 'Accion',
    mood: 'Combate y velocidad',
    accent: '#f43f5e',
    queries: ['The Boys', 'Reacher', 'Jack Ryan']
  },
  {
    id: 'animation',
    name: 'Animacion',
    mood: 'Visual y expresiva',
    accent: '#60a5fa',
    queries: ['Arcane', 'Rick and Morty', 'Avatar The Last Airbender']
  }
];

export const DEFAULT_GENRES = GENRE_OPTIONS.slice(0, 4);

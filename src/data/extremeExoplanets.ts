import type { Exoplanet } from './types';

// Re-export the type for convenience
export type { Exoplanet } from './types';

// Exoplanets ordered by narrative arc: From the Impossible to the Hopeful
// Act 1 (1-3): Hook with impossible weather phenomena
// Act 2 (4-6): Darker, more extreme, mysterious
// Act 3 (7-9): Wonder and contemplation
// Act 4 (10-12): Hope - worlds we might someday reach or inhabit

export const exoplanets: Exoplanet[] = [
  // === ACT 1: IMPOSSIBLE WEATHER ===
  {
    id: 'hd-189733b',
    name: 'HD 189733b',
    type: 'Hot Jupiter',
    category: 'sphere',
    color: '#1E90FF',
    texture: 'hd-189733b.jpg',
    description: 'A beautiful blue world where silicate particles in the atmosphere rain sideways at 5,400 miles per hour.',
    funFacts: [
      'The blue color comes from silicate particles scattering light, not water like Earth',
      'Winds reach speeds of 5,400 mph (8,700 km/h) - 7 times the speed of sound',
      'The glass rain falls sideways due to the extreme wind speeds',
      'It orbits so close to its star that a year lasts only 2.2 Earth days'
    ],
    distanceLightYears: 63,
    hostStar: 'HD 189733',
    orbitalPeriodDays: 2.2,
    discoveryYear: 2005,
    keyFeature: 'Glass rain at 5,400 mph',
    surfaceTemp: '1,200°C'
  },
  {
    id: 'wasp-76b',
    name: 'WASP-76b',
    type: 'Ultra-Hot Jupiter',
    category: 'sphere',
    color: '#8B0000',
    texture: 'wasp-76b.jpg',
    description: 'An infernal world where iron vaporizes on the day side and rains down as liquid metal on the night side.',
    funFacts: [
      'The day side is so hot (2,400°C) that iron exists as vapor in the atmosphere',
      'Iron condenses into liquid droplets as it moves to the cooler night side',
      'The planet is tidally locked - one side always faces its star',
      'Scientists detected iron in the atmosphere using spectroscopy'
    ],
    distanceLightYears: 640,
    hostStar: 'WASP-76',
    orbitalPeriodDays: 1.8,
    discoveryYear: 2013,
    keyFeature: 'Iron rain on the night side',
    surfaceTemp: '2,400°C (day side)'
  },
  {
    id: 'hat-p-7b',
    name: 'HAT-P-7b',
    type: 'Hot Jupiter',
    category: 'sphere',
    color: '#FF6B6B',
    texture: 'hat-p-7b.jpg',
    description: 'A scorching world where clouds of corundum create rain made of rubies and sapphires.',
    funFacts: [
      'Corundum (aluminum oxide) forms clouds in the atmosphere',
      'Ruby and sapphire are both forms of corundum with trace impurities',
      'The planet has violent weather systems visible from Earth',
      'It orbits a star 40% larger and twice as hot as our Sun'
    ],
    distanceLightYears: 1040,
    hostStar: 'HAT-P-7',
    orbitalPeriodDays: 2.2,
    discoveryYear: 2008,
    keyFeature: 'Rains rubies and sapphires',
    surfaceTemp: '2,200°C'
  },

  // === ACT 2: EXTREME & MYSTERIOUS ===
  {
    id: 'tres-2b',
    name: 'TrES-2b',
    type: 'Hot Jupiter',
    category: 'sphere',
    color: '#0a0a0a',
    texture: 'tres-2b.jpg',
    description: 'The darkest known planet, reflecting less than 1% of light - darker than coal or black acrylic paint.',
    funFacts: [
      'Reflects less than 1% of starlight that hits it',
      'Darker than any planet or moon in our solar system',
      'The cause of its extreme darkness is still debated',
      'May have light-absorbing chemicals like vaporized sodium or titanium oxide'
    ],
    distanceLightYears: 750,
    hostStar: 'TrES-2',
    orbitalPeriodDays: 2.5,
    discoveryYear: 2006,
    keyFeature: 'Darkest known planet in the universe',
    surfaceTemp: '1,100°C'
  },
  {
    id: 'kelt-9b',
    name: 'KELT-9b',
    type: 'Ultra-Hot Jupiter',
    category: 'sphere',
    color: '#E6E6FA',
    texture: 'kelt-9b.jpg',
    description: 'The hottest known exoplanet - its day side is hotter than most stars in the galaxy.',
    funFacts: [
      'Day side temperature reaches 4,600K - hotter than many red dwarf stars',
      'Molecules in the atmosphere are torn apart by the extreme heat',
      'The planet is being slowly evaporated by its host star',
      'Its host star is nearly twice as hot as our Sun'
    ],
    distanceLightYears: 670,
    hostStar: 'KELT-9',
    orbitalPeriodDays: 1.5,
    discoveryYear: 2017,
    keyFeature: 'Hotter than most stars',
    surfaceTemp: '4,600K (day side)'
  },
  {
    id: '55-cancri-e',
    name: '55 Cancri e',
    type: 'Super-Earth',
    category: 'sphere',
    color: '#FF4500',
    texture: '55-cancri-e.jpg',
    description: 'Once thought to be made of diamond, now believed to be a volcanic lava world with a mysterious past.',
    funFacts: [
      'Early studies suggested it could be carbon-rich with a diamond interior',
      'More recent research indicates it may be a lava world',
      'Surface temperatures can melt most metals',
      'One side may have a global magma ocean visible from space',
      'The "diamond planet" mystery shows how much we still have to learn'
    ],
    distanceLightYears: 40,
    hostStar: '55 Cancri',
    orbitalPeriodDays: 0.74,
    discoveryYear: 2004,
    keyFeature: 'Lava world with a mysterious past',
    surfaceTemp: '2,300°C (day side)'
  },

  // === ACT 3: WONDER & CONTEMPLATION ===
  {
    id: 'j1407b',
    name: 'J1407b',
    type: 'Super-Saturn',
    category: 'sphere',
    color: '#DAA520',
    texture: 'j1407b.jpg',
    description: 'A planet with a ring system 200 times larger than Saturn\'s - visible from Earth if it were in our solar system.',
    funFacts: [
      'Ring system spans 120 million kilometers in diameter',
      'If placed at Saturn\'s distance, the rings would be visible to the naked eye',
      'The rings may contain a moon roughly the size of Earth',
      'Each ring could represent a gap cleared by an orbiting moon'
    ],
    distanceLightYears: 434,
    hostStar: 'J1407',
    orbitalPeriodDays: 3700,
    discoveryYear: 2012,
    keyFeature: 'Ring system 200x larger than Saturn\'s'
  },
  {
    id: 'kepler-16b',
    name: 'Kepler-16b',
    type: 'Circumbinary Planet',
    category: 'sphere',
    color: '#DEB887',
    texture: 'kepler-16b.jpg',
    description: 'A real-life Tatooine - a world where you would witness two suns setting on the horizon.',
    funFacts: [
      'First confirmed planet orbiting two stars (circumbinary)',
      'Often called a "real-life Tatooine" after the Star Wars planet',
      'Both stars are smaller and cooler than our Sun',
      'The double sunset would cast complex, shifting shadows'
    ],
    distanceLightYears: 245,
    hostStar: 'Kepler-16 (binary)',
    orbitalPeriodDays: 229,
    discoveryYear: 2011,
    keyFeature: 'Double sunset - two suns in the sky'
  },
  {
    id: 'psr-b1620-26b',
    name: 'PSR B1620-26 b',
    type: 'Gas Giant',
    category: 'sphere',
    color: '#4A4A4A',
    texture: 'psr-b1620-26b.jpg',
    description: 'Called "Methuselah" - nearly as old as the universe itself, orbiting a pulsar and white dwarf.',
    funFacts: [
      'Estimated to be 12.7 billion years old - the universe is 13.8 billion',
      'Orbits both a pulsar and a white dwarf star',
      'Located in the ancient globular cluster M4',
      'Nicknamed "Methuselah" after the oldest person in the Bible',
      'Proves that planet formation began very early in cosmic history'
    ],
    distanceLightYears: 12400,
    hostStar: 'PSR B1620-26 (pulsar + white dwarf)',
    orbitalPeriodDays: 36500,
    discoveryYear: 2003,
    keyFeature: 'Nearly as old as the universe'
  },

  // === ACT 4: HOPE - POTENTIALLY HABITABLE ===
  {
    id: 'proxima-centauri-b',
    name: 'Proxima Centauri b',
    type: 'Terrestrial Planet',
    category: 'sphere',
    color: '#8B4513',
    texture: 'proxima-centauri-b.jpg',
    description: 'The closest known exoplanet to Earth - our nearest neighbor in the cosmos.',
    funFacts: [
      'Only 4.24 light-years away - the closest exoplanet to our solar system',
      'Located in the habitable zone of its star',
      'Receives similar amounts of energy as Earth does from the Sun',
      'The star Proxima Centauri is a red dwarf prone to flares',
      'A spacecraft traveling at 10% light speed would take 40+ years to reach it'
    ],
    distanceLightYears: 4.24,
    hostStar: 'Proxima Centauri',
    orbitalPeriodDays: 11.2,
    discoveryYear: 2016,
    keyFeature: 'Closest exoplanet to Earth'
  },
  {
    id: 'kepler-452b',
    name: 'Kepler-452b',
    type: 'Super-Earth',
    category: 'sphere',
    color: '#228B22',
    texture: 'kepler-452b.jpg',
    description: 'Earth\'s cousin - a potentially rocky world in the habitable zone of a Sun-like star.',
    funFacts: [
      'Often called "Earth\'s older cousin" due to similarities',
      'Orbits a G-type star similar to our Sun',
      'A year lasts 385 days - very close to Earth\'s 365',
      'About 60% larger than Earth',
      'Has spent 6 billion years in the habitable zone (longer than Earth)'
    ],
    distanceLightYears: 1400,
    hostStar: 'Kepler-452',
    orbitalPeriodDays: 385,
    discoveryYear: 2015,
    keyFeature: 'Earth\'s cousin in a Sun-like system'
  },
  {
    id: 'trappist-1-system',
    name: 'TRAPPIST-1 System',
    type: 'Planetary System',
    category: 'static',
    color: '#FF6347',
    image: 'trappist-1.jpg',
    description: 'Seven Earth-sized worlds orbiting a single star - with three in the habitable zone.',
    funFacts: [
      'Contains seven Earth-sized rocky planets',
      'Three planets (e, f, g) are in the habitable zone',
      'All seven planets are closer to their star than Mercury is to the Sun',
      'The planets are so close together you could see features of neighboring worlds from their surfaces',
      'Named after the telescope that discovered them in Chile'
    ],
    distanceLightYears: 40,
    hostStar: 'TRAPPIST-1',
    orbitalPeriodDays: 12.4, // Planet e (middle of habitable zone)
    discoveryYear: 2017,
    keyFeature: 'Seven Earth-sized worlds, three habitable'
  }
];

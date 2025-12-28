export interface CelestialObject {
  id: string;
  name: string;
  sizeKm: number; // diameter in kilometers
  type: string;
  category: 'sphere' | 'static';
  color: string; // fallback color
  texture?: string; // filename for sphere textures
  image?: string; // filename for static images
  discoveryDate?: string;
  discoveredBy?: string;
  description: string;
  funFacts: string[];
}

// Objects sorted by size (smallest to largest)
export const celestialObjects: CelestialObject[] = [
  // === DWARF PLANETS & MOONS ===
  {
    id: 'enceladus',
    name: 'Enceladus',
    sizeKm: 504,
    type: 'Natural Satellite',
    category: 'sphere',
    color: '#F5F5F5',
    texture: 'enceladus.jpg',
    discoveryDate: '1789',
    discoveredBy: 'William Herschel',
    description: 'Saturn\'s icy moon with geysers that spray water into space.',
    funFacts: [
      'Enceladus has geysers that shoot water ice into space from its south pole',
      'It has a subsurface ocean that may harbor conditions suitable for life',
      'Despite being only 500 km wide, it\'s one of the most reflective objects in the Solar System',
      'The water from its geysers feeds Saturn\'s E ring'
    ]
  },
  {
    id: 'ceres',
    name: 'Ceres',
    sizeKm: 939,
    type: 'Dwarf Planet',
    category: 'sphere',
    color: '#8B7355',
    texture: 'ceres.jpg',
    discoveryDate: '1801',
    discoveredBy: 'Giuseppe Piazzi',
    description: 'The largest object in the asteroid belt between Mars and Jupiter.',
    funFacts: [
      'Ceres contains about one-third of the total mass of the asteroid belt',
      'It has a water-ice rich mantle and may have a subsurface ocean',
      'NASA\'s Dawn spacecraft orbited Ceres from 2015 to 2018',
      'Ceres has mysterious bright spots (likely salt deposits) in Occator crater'
    ]
  },
  {
    id: 'pluto',
    name: 'Pluto',
    sizeKm: 2376,
    type: 'Dwarf Planet',
    category: 'sphere',
    color: '#D4A373',
    texture: 'pluto.jpg',
    discoveryDate: '1930',
    discoveredBy: 'Clyde Tombaugh',
    description: 'A dwarf planet in the Kuiper belt with a heart-shaped glacier.',
    funFacts: [
      'Pluto has a heart-shaped region called Tombaugh Regio',
      'Its largest moon Charon is so big that Pluto and Charon orbit a common center of mass',
      'A year on Pluto lasts 248 Earth years',
      'New Horizons revealed active geology including nitrogen ice glaciers'
    ]
  },
  {
    id: 'europa',
    name: 'Europa',
    sizeKm: 3121,
    type: 'Natural Satellite',
    category: 'sphere',
    color: '#D4C5A9',
    texture: 'europa.jpg',
    discoveryDate: '1610',
    discoveredBy: 'Galileo Galilei',
    description: 'Jupiter\'s moon with a subsurface ocean beneath its icy crust.',
    funFacts: [
      'Europa may have twice as much water as all of Earth\'s oceans combined',
      'Its surface is one of the smoothest in the Solar System',
      'Tidal heating from Jupiter keeps its subsurface ocean liquid',
      'NASA\'s Europa Clipper mission launched in October 2024 and will study this moon'
    ]
  },
  {
    id: 'moon',
    name: 'Moon',
    sizeKm: 3474,
    type: 'Natural Satellite',
    category: 'sphere',
    color: '#C0C0C0',
    texture: 'moon.jpg',
    discoveryDate: 'Prehistoric',
    discoveredBy: 'N/A',
    description: 'Earth\'s only natural satellite and the fifth largest moon in the Solar System.',
    funFacts: [
      'The Moon is gradually moving away from Earth at about 3.8 cm per year',
      '12 humans have walked on the Moon between 1969 and 1972',
      'The Moon has moonquakes caused by tidal stresses from Earth',
      'The same side of the Moon always faces Earth due to tidal locking'
    ]
  },
  {
    id: 'io',
    name: 'Io',
    sizeKm: 3643,
    type: 'Natural Satellite',
    category: 'sphere',
    color: '#FFDB58',
    texture: 'io.jpg',
    discoveryDate: '1610',
    discoveredBy: 'Galileo Galilei',
    description: 'Jupiter\'s volcanic moon - the most geologically active body in the Solar System.',
    funFacts: [
      'Io has over 400 active volcanoes, more than any other body in the Solar System',
      'Its surface is constantly being reshaped by volcanic activity',
      'Tidal heating from Jupiter causes its intense volcanic activity',
      'Io\'s volcanoes can eject plumes up to 500 km high'
    ]
  },
  {
    id: 'mercury',
    name: 'Mercury',
    sizeKm: 4879,
    type: 'Planet',
    category: 'sphere',
    color: '#8C7853',
    texture: 'mercury.jpg',
    discoveryDate: 'Prehistoric',
    discoveredBy: 'N/A',
    description: 'The smallest planet and closest to the Sun.',
    funFacts: [
      'Mercury has the most eccentric orbit of all planets',
      'A day on Mercury (sunrise to sunrise) lasts 176 Earth days',
      'Despite being closest to the Sun, Mercury has ice in permanently shadowed craters',
      'It has no atmosphere to retain heat, so temperatures vary from -173°C to 427°C'
    ]
  },
  {
    id: 'titan',
    name: 'Titan',
    sizeKm: 5149,
    type: 'Natural Satellite',
    category: 'sphere',
    color: '#FFA500',
    texture: 'titan.jpg',
    discoveryDate: '1655',
    discoveredBy: 'Christiaan Huygens',
    description: 'Saturn\'s largest moon with a thick atmosphere and liquid methane lakes.',
    funFacts: [
      'Titan is the only moon with a substantial atmosphere (denser than Earth\'s)',
      'It has lakes and rivers of liquid methane and ethane',
      'Titan is larger than the planet Mercury',
      'The Huygens probe landed on Titan in 2005, the farthest landing from Earth ever achieved'
    ]
  },
  {
    id: 'ganymede',
    name: 'Ganymede',
    sizeKm: 5268,
    type: 'Natural Satellite',
    category: 'sphere',
    color: '#A8987C',
    texture: 'ganymede.jpg',
    discoveryDate: '1610',
    discoveredBy: 'Galileo Galilei',
    description: 'The largest moon in the Solar System, even bigger than Mercury.',
    funFacts: [
      'Ganymede is the only moon known to have its own magnetic field',
      'It has a subsurface ocean that may contain more water than Earth',
      'Ganymede is the ninth-largest object in the Solar System',
      'Its surface shows both old, heavily cratered regions and younger, grooved terrain'
    ]
  },
  {
    id: 'mars',
    name: 'Mars',
    sizeKm: 6779,
    type: 'Planet',
    category: 'sphere',
    color: '#CD5C5C',
    texture: 'mars.jpg',
    discoveryDate: 'Prehistoric',
    discoveredBy: 'N/A',
    description: 'The Red Planet, home to the largest volcano in the Solar System.',
    funFacts: [
      'Mars has the largest volcano in the Solar System: Olympus Mons (25 km high)',
      'A day on Mars is only 37 minutes longer than an Earth day',
      'Mars has polar ice caps made of water ice and carbon dioxide',
      'More missions have been sent to Mars than any other planet'
    ]
  },
  {
    id: 'venus',
    name: 'Venus',
    sizeKm: 12104,
    type: 'Planet',
    category: 'sphere',
    color: '#FFC649',
    texture: 'venus.jpg',
    discoveryDate: 'Prehistoric',
    discoveredBy: 'N/A',
    description: 'The hottest planet with a crushing atmosphere of carbon dioxide.',
    funFacts: [
      'Venus rotates backwards (retrograde rotation) compared to most planets',
      'A day on Venus (243 Earth days) is longer than its year (225 Earth days)',
      'Surface temperature is 462°C, hot enough to melt lead',
      'Venus is the brightest natural object in the night sky after the Moon'
    ]
  },
  {
    id: 'earth',
    name: 'Earth',
    sizeKm: 12742,
    type: 'Planet',
    category: 'sphere',
    color: '#4169E1',
    texture: 'earth.jpg',
    discoveryDate: 'N/A',
    discoveredBy: 'N/A',
    description: 'Our home planet, the only known world with life.',
    funFacts: [
      'Earth is the only planet not named after a deity',
      'The Earth\'s core is as hot as the surface of the Sun (~5500°C)',
      'Earth has over 8.7 million species (estimated)',
      'The oldest rocks on Earth are over 4 billion years old'
    ]
  },
  {
    id: 'neptune',
    name: 'Neptune',
    sizeKm: 49244,
    type: 'Planet',
    category: 'sphere',
    color: '#4169E1',
    texture: 'neptune.jpg',
    discoveryDate: '1846',
    discoveredBy: 'Johann Galle & Urbain Le Verrier',
    description: 'The windiest planet with supersonic winds.',
    funFacts: [
      'Neptune has the strongest winds in the Solar System, reaching 2,100 km/h',
      'It was the first planet located through mathematical predictions',
      'A year on Neptune lasts 165 Earth years',
      'Neptune has completed only one orbit since its discovery in 1846'
    ]
  },
  {
    id: 'uranus',
    name: 'Uranus',
    sizeKm: 50724,
    type: 'Planet',
    category: 'sphere',
    color: '#4FD0E7',
    texture: 'uranus.jpg',
    discoveryDate: '1781',
    discoveredBy: 'William Herschel',
    description: 'The tilted ice giant that rotates on its side.',
    funFacts: [
      'Uranus rotates on its side with an axial tilt of 98 degrees',
      'It has 27 known moons, all named after characters from Shakespeare and Pope',
      'A year on Uranus lasts 84 Earth years',
      'Uranus was the first planet discovered with a telescope'
    ]
  },
  {
    id: 'saturn',
    name: 'Saturn',
    sizeKm: 116460,
    type: 'Planet',
    category: 'sphere',
    color: '#EAD6B8',
    texture: 'saturn.jpg',
    discoveryDate: 'Prehistoric',
    discoveredBy: 'N/A',
    description: 'The ringed planet with the most spectacular ring system.',
    funFacts: [
      'Saturn\'s rings are made of billions of pieces of ice and rock',
      'Saturn is less dense than water - it would float if placed in a giant bathtub',
      'A day on Saturn lasts only 10.7 hours',
      'Saturn has 146 confirmed moons, more than any other planet'
    ]
  },
  {
    id: 'jupiter',
    name: 'Jupiter',
    sizeKm: 139820,
    type: 'Planet',
    category: 'sphere',
    color: '#C88B3A',
    texture: 'jupiter.jpg',
    discoveryDate: 'Prehistoric',
    discoveredBy: 'N/A',
    description: 'The largest planet with a storm larger than Earth.',
    funFacts: [
      'Jupiter\'s Great Red Spot is a storm that has raged for at least 400 years',
      'Jupiter has 95 confirmed moons',
      'It has the shortest day of all planets (9.9 hours)',
      'Jupiter\'s mass is greater than all other planets combined'
    ]
  },

  // === STARS ===
  {
    id: 'proxima-centauri',
    name: 'Proxima Centauri',
    sizeKm: 200000,
    type: 'Red Dwarf Star',
    category: 'sphere',
    color: '#FF6347',
    texture: 'proxima-centauri.jpg',
    discoveryDate: '1915',
    discoveredBy: 'Robert Innes',
    description: 'The closest star to our Solar System at 4.24 light-years away.',
    funFacts: [
      'Proxima Centauri is part of the Alpha Centauri triple star system',
      'It has at least two confirmed exoplanets, including one in the habitable zone',
      'Despite being the closest star, it\'s too dim to see with the naked eye',
      'It would take over 6,000 years to reach with current technology'
    ]
  },
  {
    id: 'sun',
    name: 'Sun',
    sizeKm: 1392700,
    type: 'Yellow Dwarf Star',
    category: 'sphere',
    color: '#FDB813',
    texture: 'sun.jpg',
    discoveryDate: 'Prehistoric',
    discoveredBy: 'N/A',
    description: 'Our home star that provides light and energy to Earth.',
    funFacts: [
      'The Sun contains 99.86% of the mass in the Solar System',
      'It fuses 600 million tons of hydrogen into helium every second',
      'The Sun\'s core temperature is about 15 million °C',
      'Light from the Sun takes 8 minutes and 20 seconds to reach Earth'
    ]
  },
  {
    id: 'sirius-a',
    name: 'Sirius A',
    sizeKm: 2381400,
    type: 'Main Sequence Star',
    category: 'sphere',
    color: '#FFFFFF',
    texture: 'sirius-a.jpg',
    discoveryDate: 'Prehistoric',
    discoveredBy: 'N/A',
    description: 'The brightest star in Earth\'s night sky.',
    funFacts: [
      'Sirius is actually a binary star system with a white dwarf companion',
      'It\'s twice as massive as the Sun and 25 times more luminous',
      'Ancient Egyptians based their calendar on the heliacal rising of Sirius',
      'Sirius is only 8.6 light-years away'
    ]
  },
  {
    id: 'pollux',
    name: 'Pollux',
    sizeKm: 12135000,
    type: 'Orange Giant Star',
    category: 'sphere',
    color: '#FFB366',
    texture: 'pollux.jpg',
    discoveryDate: 'Prehistoric',
    discoveredBy: 'N/A',
    description: 'The brightest star in the constellation Gemini.',
    funFacts: [
      'Pollux has an exoplanet nearly 3 times the mass of Jupiter',
      'It has evolved off the main sequence and is now a giant star',
      'Pollux is 34 light-years from Earth',
      'Despite being "Beta Geminorum," it\'s brighter than Alpha Geminorum (Castor)'
    ]
  },
  {
    id: 'arcturus',
    name: 'Arcturus',
    sizeKm: 35600000,
    type: 'Red Giant Star',
    category: 'sphere',
    color: '#FF7F00',
    texture: 'arcturus.jpg',
    discoveryDate: 'Prehistoric',
    discoveredBy: 'N/A',
    description: 'The brightest star in the northern celestial hemisphere.',
    funFacts: [
      'Arcturus is moving rapidly through our galaxy at 122 km/s',
      'It\'s about 7.1 billion years old, older than our Sun',
      'Arcturus is 36.7 light-years away',
      'Its light was used to open the 1933 Chicago World\'s Fair'
    ]
  },
  {
    id: 'sagittarius-a-star',
    name: 'Sagittarius A*',
    sizeKm: 44000000,
    type: 'Supermassive Black Hole',
    category: 'static',
    color: '#000000',
    image: 'sagittarius-a.png',
    discoveryDate: '1974',
    discoveredBy: 'Bruce Balick & Robert Brown',
    description: 'The supermassive black hole at the center of the Milky Way.',
    funFacts: [
      'It has a mass of about 4 million times that of the Sun',
      'The Event Horizon Telescope captured its first image in 2022',
      'Stars near it orbit at speeds up to 8% the speed of light',
      'It\'s about 26,000 light-years from Earth'
    ]
  },
  {
    id: 'aldebaran',
    name: 'Aldebaran',
    sizeKm: 61400000,
    type: 'Red Giant Star',
    category: 'sphere',
    color: '#FF6B35',
    texture: 'aldebaran.jpg',
    discoveryDate: 'Prehistoric',
    discoveredBy: 'N/A',
    description: 'The "Eye of the Bull" in the constellation Taurus.',
    funFacts: [
      'Aldebaran is about 44 times larger than the Sun',
      'It\'s been known since ancient times and appears in many mythologies',
      'The star is 65 light-years away',
      'Aldebaran has a faint red dwarf companion star'
    ]
  },
  {
    id: 'rigel',
    name: 'Rigel',
    sizeKm: 109710000,
    type: 'Blue Supergiant Star',
    category: 'sphere',
    color: '#9BB0FF',
    texture: 'rigel.jpg',
    discoveryDate: 'Prehistoric',
    discoveredBy: 'N/A',
    description: 'The brightest star in the constellation Orion.',
    funFacts: [
      'Rigel is about 120,000 times more luminous than the Sun',
      'Despite being designated Beta Orionis, it often appears brighter than Alpha (Betelgeuse)',
      'Rigel is actually a multiple star system with at least 4 stars',
      'It\'s approximately 860 light-years from Earth'
    ]
  },
  {
    id: 'betelgeuse',
    name: 'Betelgeuse',
    sizeKm: 1234000000,
    type: 'Red Supergiant Star',
    category: 'sphere',
    color: '#FF4500',
    texture: 'betelgeuse.jpg',
    discoveryDate: 'Prehistoric',
    discoveredBy: 'N/A',
    description: 'A massive red supergiant that will soon explode as a supernova.',
    funFacts: [
      'If placed at the center of our Solar System, Betelgeuse would extend past Jupiter\'s orbit',
      'It could go supernova anytime in the next 100,000 years',
      'Betelgeuse dims and brightens irregularly as it pulsates',
      'It\'s losing mass at a rate of 1 Earth mass every 10,000 years'
    ]
  },
  {
    id: 'uy-scuti',
    name: 'UY Scuti',
    sizeKm: 2376000000,
    type: 'Red Hypergiant Star',
    category: 'sphere',
    color: '#FF0000',
    texture: 'uy-scuti.jpg',
    discoveryDate: '1860',
    discoveredBy: 'Bonn Observatory',
    description: 'One of the largest known stars by radius.',
    funFacts: [
      'If placed in our Solar System, UY Scuti would extend beyond Saturn\'s orbit',
      'It would take a plane 1,000+ years to fly around it',
      'The star is slowly losing its outer layers',
      'It\'s located about 9,500 light-years away in Scutum constellation'
    ]
  },
  {
    id: 'stephenson-2-18',
    name: 'Stephenson 2-18',
    sizeKm: 2832000000,
    type: 'Red Hypergiant Star',
    category: 'sphere',
    color: '#8B0000',
    texture: 'stephenson-2-18.jpg',
    discoveryDate: '1990',
    discoveredBy: 'Stephenson\'s survey',
    description: 'Possibly the largest known star in the universe by radius.',
    funFacts: [
      'If placed at the Sun\'s position, it would extend to Saturn\'s orbit',
      'It\'s part of the massive open cluster Stephenson 2',
      'Located about 19,000 light-years away',
      'Its exact size is uncertain due to its distance and dimness'
    ]
  },

  // === BLACK HOLES (by event horizon size) ===
  {
    id: 'ton-618',
    name: 'TON 618',
    sizeKm: 389400000000,
    type: 'Supermassive Black Hole',
    category: 'static',
    color: '#000000',
    image: 'ton618.png',
    discoveryDate: '1957',
    discoveredBy: 'Tonantzintla Observatory',
    description: 'One of the most massive black holes ever discovered.',
    funFacts: [
      'TON 618 has a mass of 66 billion times that of the Sun',
      'Its event horizon diameter is about 40 times the distance from the Sun to Neptune',
      'It powers an extremely luminous quasar',
      'Located over 10 billion light-years away'
    ]
  },

  // === NEBULAE ===
  {
    id: 'cats-eye-nebula',
    name: 'Cat\'s Eye Nebula',
    sizeKm: 29160000000000,
    type: 'Planetary Nebula',
    category: 'static',
    color: '#00CED1',
    image: 'cats-eye-nebula.jpg',
    discoveryDate: '1786',
    discoveredBy: 'William Herschel',
    description: 'A complex planetary nebula with intricate structures.',
    funFacts: [
      'It\'s about 3,000 light-years away',
      'The nebula is expanding at 16.4 km/s',
      'Its structure suggests the central star is actually a binary system',
      'The nebula is about 1,000 years old'
    ]
  },
  {
    id: 'helix-nebula',
    name: 'Helix Nebula',
    sizeKm: 58320000000000,
    type: 'Planetary Nebula',
    category: 'static',
    color: '#FF69B4',
    image: 'helix-nebula.jpg',
    discoveryDate: '1824',
    discoveredBy: 'Karl Ludwig Harding',
    description: 'The "Eye of God" - one of the closest planetary nebulae to Earth.',
    funFacts: [
      'It\'s about 695 light-years away, making it one of the closest bright planetary nebulae',
      'The nebula is roughly 2.5 light-years in diameter',
      'It\'s often called the "Eye of God" or "Eye of Sauron"',
      'The central white dwarf is about the size of Earth but extremely dense'
    ]
  },
  {
    id: 'crab-nebula',
    name: 'Crab Nebula',
    sizeKm: 104071000000000,
    type: 'Supernova Remnant',
    category: 'static',
    color: '#FF6347',
    image: 'crab-nebula.jpg',
    discoveryDate: '1731',
    discoveredBy: 'John Bevis',
    description: 'The remnant of a supernova explosion witnessed by astronomers in 1054 AD.',
    funFacts: [
      'The supernova that created it was visible in daylight for 23 days in 1054 AD',
      'It contains the Crab Pulsar, a neutron star spinning 30 times per second',
      'The nebula is still expanding at about 1,500 km/s',
      'Chinese and Arab astronomers recorded the "guest star" that created it'
    ]
  },
  {
    id: 'orion-nebula',
    name: 'Orion Nebula',
    sizeKm: 233280000000000,
    type: 'Emission Nebula',
    category: 'static',
    color: '#FF1493',
    image: 'orion-nebula.jpg',
    discoveryDate: '1610',
    discoveredBy: 'Nicolas-Claude Fabri de Peiresc',
    description: 'A stellar nursery where new stars are being born.',
    funFacts: [
      'Visible to the naked eye as the middle "star" in Orion\'s sword',
      'Contains over 700 stars in various stages of formation',
      'It\'s about 1,344 light-years away',
      'The Trapezium Cluster at its heart contains very young, massive stars'
    ]
  },
  {
    id: 'carina-nebula',
    name: 'Carina Nebula',
    sizeKm: 1166400000000000,
    type: 'Emission Nebula',
    category: 'static',
    color: '#DC143C',
    image: 'carina-nebula.jpg',
    discoveryDate: '1751-1752',
    discoveredBy: 'Nicolas-Louis de Lacaille',
    description: 'A massive star-forming region containing some of the most massive stars known.',
    funFacts: [
      'Contains Eta Carinae, one of the most massive and luminous stars known',
      'It\'s about 7,500 light-years away',
      'The nebula is roughly 300 light-years across',
      'Home to the "Mystic Mountain" pillar of gas and dust'
    ]
  },
  {
    id: 'tarantula-nebula',
    name: 'Tarantula Nebula',
    sizeKm: 1749600000000000,
    type: 'Emission Nebula',
    category: 'static',
    color: '#FF0000',
    image: 'tarantula-nebula.jpg',
    discoveryDate: '1751-1752',
    discoveredBy: 'Nicolas-Louis de Lacaille',
    description: 'The most active star-forming region in the Local Group of galaxies.',
    funFacts: [
      'Located in the Large Magellanic Cloud',
      'If it were as close as the Orion Nebula, it would cast shadows on Earth',
      'Contains R136, a super star cluster with some of the most massive stars known',
      'Supernova 1987A occurred on its outskirts'
    ]
  },

  // === GALAXIES ===
  {
    id: 'small-magellanic-cloud',
    name: 'Small Magellanic Cloud',
    sizeKm: 69811200000000000,
    type: 'Dwarf Galaxy',
    category: 'static',
    color: '#B0C4DE',
    image: 'small-magellanic-cloud.jpg',
    discoveryDate: '964 AD',
    discoveredBy: 'Abd al-Rahman al-Sufi',
    description: 'A dwarf galaxy orbiting the Milky Way.',
    funFacts: [
      'It\'s about 200,000 light-years away',
      'Contains several hundred million stars',
      'Visible to the naked eye from the Southern Hemisphere',
      'It\'s gravitationally bound to the Large Magellanic Cloud'
    ]
  },
  {
    id: 'large-magellanic-cloud',
    name: 'Large Magellanic Cloud',
    sizeKm: 130900800000000000,
    type: 'Satellite Galaxy',
    category: 'static',
    color: '#4682B4',
    image: 'large-magellanic-cloud.jpg',
    discoveryDate: '964 AD',
    discoveredBy: 'Abd al-Rahman al-Sufi',
    description: 'The largest satellite galaxy of the Milky Way.',
    funFacts: [
      'It\'s about 163,000 light-years away',
      'Contains about 30 billion stars',
      'Home to the Tarantula Nebula, the most active star-forming region nearby',
      'Visible to the naked eye from the Southern Hemisphere as a faint cloud'
    ]
  },
  {
    id: 'milky-way',
    name: 'Milky Way',
    sizeKm: 978280320000000000,
    type: 'Barred Spiral Galaxy',
    category: 'static',
    color: '#F0E68C',
    image: 'milky-way.jpg',
    discoveryDate: 'Prehistoric',
    discoveredBy: 'N/A',
    description: 'Our home galaxy containing 100-400 billion stars.',
    funFacts: [
      'The Milky Way is about 13.6 billion years old',
      'It contains 100-400 billion stars',
      'The Solar System takes 225-250 million years to complete one orbit',
      'It\'s on a collision course with Andromeda, merging in about 4.5 billion years'
    ]
  },
  {
    id: 'andromeda',
    name: 'Andromeda Galaxy',
    sizeKm: 2174421120000000000,
    type: 'Spiral Galaxy',
    category: 'static',
    color: '#DDA0DD',
    image: 'andromeda.jpg',
    discoveryDate: '964 AD',
    discoveredBy: 'Abd al-Rahman al-Sufi',
    description: 'The nearest major galaxy to the Milky Way.',
    funFacts: [
      'Andromeda is approaching the Milky Way at about 110 km/s',
      'It contains approximately 1 trillion stars',
      'Visible to the naked eye from dark locations',
      'It\'s about 2.5 million light-years away'
    ]
  },
  {
    id: 'ic-1101',
    name: 'IC 1101',
    sizeKm: 58968100000000000000,
    type: 'Supergiant Elliptical Galaxy',
    category: 'static',
    color: '#FFD700',
    image: 'ic-1101.jpg',
    discoveryDate: '1790',
    discoveredBy: 'William Herschel',
    description: 'One of the largest known galaxies in the observable universe.',
    funFacts: [
      'IC 1101 is about 6 million light-years in diameter',
      'It contains an estimated 100 trillion stars',
      'Located about 1 billion light-years away',
      'It\'s the central galaxy of the Abell 2029 galaxy cluster'
    ]
  },

  // === LARGE SCALE STRUCTURES ===
  {
    id: 'bootes-void',
    name: 'Boötes Void',
    sizeKm: 3122130000000000000000,
    type: 'Supervoid',
    category: 'static',
    color: '#0a0a14',
    image: 'bootes-void.png',
    discoveryDate: '1981',
    discoveredBy: 'Robert Kirshner et al.',
    description: 'One of the largest known voids in the universe - a vast, nearly empty region of space.',
    funFacts: [
      'Spans approximately 330 million light-years in diameter',
      'Contains only about 60 galaxies, where 2,000 would be expected',
      'Sometimes called "The Great Nothing" due to its emptiness',
      'If the Milky Way were at its center, we wouldn\'t have known other galaxies existed until the 1960s'
    ]
  },
  {
    id: 'laniakea',
    name: 'Laniakea Supercluster',
    sizeKm: 4891401600000000000000,
    type: 'Galaxy Supercluster',
    category: 'static',
    color: '#00BFFF',
    image: 'laniakea.jpg',
    discoveryDate: '2014',
    discoveredBy: 'R. Brent Tully et al.',
    description: 'Our home supercluster containing 100,000 galaxies.',
    funFacts: [
      'Laniakea means "immense heaven" in Hawaiian',
      'Contains about 100,000 galaxies',
      'Spans 520 million light-years',
      'Contains approximately 10^17 solar masses'
    ]
  },
  {
    id: 'observable-universe',
    name: 'Observable Universe',
    sizeKm: 879847800000000000000000,
    type: 'Universe',
    category: 'static',
    color: '#191970',
    image: 'observable-universe.jpg',
    discoveryDate: 'N/A',
    discoveredBy: 'N/A',
    description: 'The entire observable universe - everything we can possibly see.',
    funFacts: [
      'The observable universe is about 93 billion light-years in diameter',
      'It contains an estimated 2 trillion galaxies',
      'The universe is about 13.8 billion years old',
      'The actual universe may be much larger than what we can observe'
    ]
  }
];

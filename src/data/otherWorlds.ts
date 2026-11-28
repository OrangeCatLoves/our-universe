// Skies of Other Worlds: what you would see standing on the surface of eight worlds.
// The scene for each one (terrain, sky, suns, moons, effects) lives in
// components/other-worlds/worlds.ts under the same id.

export interface OtherWorld {
  id: string;
  name: string;
  place: string;          // where you are standing
  dayLength: string;      // how long one day (sunrise to sunrise) lasts there
  description: string;
  facts: string[];
}

export const otherWorlds: OtherWorld[] = [
  {
    id: 'moon',
    name: 'The Moon',
    place: 'Lunar highlands, facing Earth',
    dayLength: 'A day here lasts 29.5 Earth days',
    description:
      'Earth hangs in a black sky, four times wider than the Moon looks from home. Because the Moon always keeps the same face toward us, Earth never rises or sets here: it just hangs in place, going through phases.',
    facts: [
      'The sky stays black even at noon: with no air, there is nothing to scatter sunlight.',
      'Earth looks about 2 degrees wide from here, nearly four times the size of a full Moon from Earth.',
      'Earth shows phases opposite to the Moon\'s: when Earth is "full" here, people on Earth see a new Moon.',
      'Shadows are pitch black, because no air carries light into them.',
    ],
  },
  {
    id: 'mars',
    name: 'Mars',
    place: 'Gale Crater, at sunset',
    dayLength: 'A day here lasts 24 hours 37 minutes',
    description:
      'The Martian day sky is a dusty butterscotch, but sunsets glow blue: fine dust scatters blue light forward, close around the Sun. Watch for Phobos racing across the sky, and Earth shining as the evening star.',
    facts: [
      'NASA\'s Curiosity rover photographed these blue sunsets from Gale Crater.',
      'The Sun looks about two-thirds as wide as it does from Earth.',
      'Phobos orbits faster than Mars spins, so it rises in the west and sets in the east, twice a day.',
      'After sunset, Earth is the brightest "star" in the sky, with the Moon beside it if you zoom in.',
    ],
  },
  {
    id: 'io',
    name: 'Io',
    place: 'Volcanic plains facing Jupiter',
    dayLength: 'A day here lasts 42.5 hours',
    description:
      'Jupiter spans 19 degrees of sky, nearly 40 times wider than the Moon looks from Earth, and it never moves. Io is the most volcanic place known: on the horizon, a plume of sulfur rises hundreds of kilometres into space.',
    facts: [
      'Io has over 400 active volcanoes, heated by the tides Jupiter raises in its rock.',
      'Plumes like Pele\'s rise up to 300 km high and fall back as colourful sulfur frost.',
      'Once every Io day, the Sun slides behind Jupiter: a two-hour total eclipse.',
      'There are no impact craters: eruptions repave the whole surface over and over.',
    ],
  },
  {
    id: 'enceladus',
    name: 'Enceladus',
    place: 'Near the south pole "tiger stripes"',
    dayLength: 'A day here lasts 33 hours',
    description:
      'Saturn looms enormous, its rings seen almost exactly edge-on as a thin bright line, because Enceladus orbits right in the ring plane. Beyond the horizon, geysers blast water ice into space from an ocean hidden under the ice.',
    facts: [
      'Enceladus is the most reflective world in the Solar System: its fresh snow bounces back almost all the sunlight that hits it.',
      'The geysers feed Saturn\'s E ring with ice particles.',
      'The Cassini spacecraft flew through the plumes and tasted salts and organic molecules from the ocean below.',
      'Enceladus is so small (504 km wide) that the horizon is less than a kilometre away.',
    ],
  },
  {
    id: 'titan',
    name: 'Titan',
    place: 'The shore of a methane sea',
    dayLength: 'A day here lasts 16 Earth days',
    description:
      'Titan is the only moon with a thick atmosphere, wrapped in an orange haze so dense that Saturn, huge overhead, is hidden from view. Rivers and seas of liquid methane fill the lowlands; the ground is water ice, frozen as hard as rock.',
    facts: [
      'The air pressure is 1.5 times Earth\'s and the cold air is about four times denser: with wings strapped to your arms you could fly.',
      'At about -180 °C, methane falls as rain and fills seas as large as the Great Lakes.',
      'In 2005 the Huygens probe landed on Titan and photographed rounded pebbles of ice.',
      'Daylight here is about as bright as dusk on Earth.',
    ],
  },
  {
    id: 'pluto',
    name: 'Pluto',
    place: 'Sputnik Planitia, facing Charon',
    dayLength: 'A day here lasts 6.4 Earth days',
    description:
      'Pluto and its moon Charon always face each other, so Charon hangs fixed in the sky, seven times wider than the full Moon looks from Earth. The Sun is just a brilliant star, yet its light still lifts thin blue layers of haze.',
    facts: [
      'Noon on Pluto is about as bright as it is on Earth a few minutes after sunset.',
      'New Horizons photographed more than 20 layers of blue haze in Pluto\'s thin air.',
      'The smooth plain here is a glacier of frozen nitrogen, slowly churning in giant cells.',
      'The mountains on the horizon are made of water ice, as tall as the Rockies.',
    ],
  },
  {
    id: 'proxima-b',
    name: 'Proxima Centauri b',
    place: 'On the line between day and night',
    dayLength: 'The star never moves: one side always faces it',
    description:
      'The nearest exoplanet probably keeps one face toward its red dwarf star, so here, on the line between day and night, it is always sunset. The star looks three times wider than our Sun, and two bright points overhead are the suns of Alpha Centauri.',
    facts: [
      'Proxima Centauri b is 4.2 light-years away, the closest planet known outside our Solar System.',
      'Its year lasts only 11 Earth days: it orbits far closer to its star than Mercury does to the Sun.',
      'Red dwarfs flare: the star can suddenly brighten for minutes at a time.',
      'Alpha Centauri A and B, two Sun-like stars, would shine brighter than any planet does in our sky.',
      'Whether it has air or water is still unknown. This view imagines a thin atmosphere and a frozen shore.',
    ],
  },
  {
    id: 'kepler-16b',
    name: 'Kepler-16b',
    place: 'On an imagined moon, at sunset',
    dayLength: 'A day here lasts about 30 hours (imagined)',
    description:
      'Kepler-16b circles two stars at once, an orange one and a small red one, so every day ends with a double sunset and two shadows behind everything. The planet is a gas giant, so this view stands on an imagined rocky moon with the giant planet in its sky.',
    facts: [
      'Discovered in 2011, it was the first planet seen circling two ordinary stars, nicknamed "Tatooine".',
      'The two stars circle each other every 41 days, so their spacing in the sky keeps changing.',
      'Kepler-16b is about the size of Saturn and takes 229 days to circle both stars.',
      'With two suns, everything casts two shadows of different colours.',
    ],
  },
];

// Black Holes theme: a journey from "what is a black hole?" to the most massive known.
// Masses in solar masses; distances in light-years (light-travel distance for the far ones).
// Event-horizon sizes are computed from mass: Schwarzschild radius = 2.95 km per solar mass.
// How each one looks (camera, gas, jets, sky, grade) lives in components/black-holes/looks.ts.

export interface BlackHole {
  id: string;
  name: string;
  type: string;
  massSolar: number | null;     // null for the introduction
  massNote?: string;            // e.g. "36 + 29 merged into 62"
  distanceLy: number | null;
  discovered: string;
  keyFeature: string;
  description: string;
  funFacts: string[];
}

export const blackHoles: BlackHole[] = [
  {
    id: 'what-is-a-black-hole',
    name: 'What Is a Black Hole?',
    type: 'Introduction',
    massSolar: null,
    distanceLy: null,
    discovered: 'Predicted by general relativity, 1916',
    keyFeature: 'Gravity so strong that not even light can escape',
    description:
      'A region where so much mass is packed into so little space that nothing can climb back out. Everything you see here is real light, bent by gravity. Drag to look around it.',
    funFacts: [
      'Event horizon: the point of no return. The black "shadow" is about 2.6 times wider than the horizon itself, because light that passes too close is captured too.',
      'Photon ring: the thin bright ring at the shadow\'s edge, made of light that looped around the black hole before escaping.',
      'Accretion disk: gas spiralling inward, heated to millions of degrees.',
      'The disk seems to arch over the top and under the bottom: that is its far side, seen via light bent around the hole.',
      'One side is brighter: gas moving toward you is beamed forward (relativistic Doppler effect).',
    ],
  },
  {
    id: 'gaia-bh1',
    name: 'Gaia BH1',
    type: 'Stellar-mass black hole (dormant)',
    massSolar: 9.6,
    distanceLy: 1560,
    discovered: '2022 (Gaia spacecraft data)',
    keyFeature: 'The nearest known black hole to Earth',
    description:
      'A silent black hole with no glowing disk. It was found only because a Sun-like star circles it. Watch how its gravity warps the starlight behind it.',
    funFacts: [
      'At about 1,560 light-years away, it is the closest black hole known.',
      'It is not feeding, so it gives off no X-rays: astronomers found it from the wobble of its companion star in Gaia data.',
      'Its companion, a star much like our Sun, orbits it every 186 days.',
      'Its event horizon is only about 57 km across.',
    ],
  },
  {
    id: 'cygnus-x-1',
    name: 'Cygnus X-1',
    type: 'Stellar-mass black hole (X-ray binary)',
    massSolar: 21.2,
    distanceLy: 7200,
    discovered: '1964 as an X-ray source; accepted as a black hole by 1972',
    keyFeature: 'The first object widely accepted as a black hole',
    description:
      'A black hole tearing gas from a giant blue companion star. The stolen gas forms a disk so hot it shines in X-rays.',
    funFacts: [
      'Its companion, the blue supergiant HDE 226868, is around 40 times the mass of the Sun.',
      'The two orbit each other every 5.6 days.',
      'Stephen Hawking bet Kip Thorne in 1974 that it was not a black hole, and conceded in 1990.',
      'Its event horizon is about 125 km across.',
    ],
  },
  {
    id: 'v404-cygni',
    name: 'V404 Cygni',
    type: 'Stellar-mass black hole (outbursting)',
    massSolar: 9,
    distanceLy: 7800,
    discovered: '1938 outburst; confirmed as a black hole in 1992',
    keyFeature: 'Erupts in violent outbursts every few decades',
    description:
      'A restless black hole that sleeps for decades, then flares wildly as gas from its companion floods in. Its disk flickers as clumps of gas fall in.',
    funFacts: [
      'Its 2015 outburst briefly made it one of the brightest X-ray sources in the sky.',
      'X-rays from that outburst lit up surrounding dust clouds, creating giant glowing rings.',
      'Its brightness can change within minutes as clumps of gas fall in.',
      'In 2015 its jets were seen wobbling, swinging around within minutes: its disk is tilted against the black hole\'s spin.',
      'In 2024 a third, distant star was found orbiting the pair, suggesting the black hole formed without a violent supernova kick.',
    ],
  },
  {
    id: 'gw150914',
    name: 'GW150914',
    type: 'Black hole merger',
    massSolar: 62,
    massNote: '36 + 29 Suns, merging into 62',
    distanceLy: 1.3e9,
    discovered: '14 September 2015 (LIGO)',
    keyFeature: 'The first gravitational waves ever detected',
    description:
      'Two black holes spiralling into each other, 1.3 billion years ago. They have no disk, so you see them only by how they bend the stars. Their final plunge shook space itself.',
    funFacts: [
      'Two black holes of about 36 and 29 Suns spiralled together and merged into one of about 62.',
      'About 3 Suns\' worth of mass was turned into gravitational-wave energy in a fraction of a second.',
      'At its peak it gave off more power, in gravitational waves, than all the stars in the observable universe combined.',
      'The signal, turned into sound, is the famous rising "chirp": listen for it each time the pair merges.',
      'Its discovery earned the 2017 Nobel Prize in Physics.',
    ],
  },
  {
    id: 'sagittarius-a-star',
    name: 'Sagittarius A*',
    type: 'Supermassive black hole',
    massSolar: 4.3e6,
    distanceLy: 26700,
    discovered: '1974 (Bruce Balick & Robert Brown)',
    keyFeature: 'The black hole at the heart of our galaxy',
    description:
      'The Milky Way\'s own giant, 4.3 million times the mass of the Sun. It is surprisingly quiet, sipping only a trickle of gas, so its glow is faint and ruddy.',
    funFacts: [
      'The Event Horizon Telescope captured its first image in 2022.',
      'Stars whipping around it at thousands of km/s revealed its mass, earning the 2020 Nobel Prize in Physics.',
      'Its event horizon would fit comfortably inside the orbit of Mercury.',
      'We see it nearly face-on, so its glow forms a ring around the shadow.',
      'It flares several times a day: in 2018 astronomers watched hot spots circling just outside its event horizon at about a third of the speed of light.',
    ],
  },
  {
    id: 'm87-star',
    name: 'M87*',
    type: 'Supermassive black hole',
    massSolar: 6.5e9,
    distanceLy: 53.5e6,
    discovered: 'Jet seen in 1918; first black hole image in 2019',
    keyFeature: 'The first black hole ever photographed',
    description:
      'A monster 6.5 billion times the mass of the Sun at the centre of the galaxy Messier 87. It fires a jet of particles moving at nearly the speed of light.',
    funFacts: [
      'The Event Horizon Telescope revealed its glowing ring in April 2019, the first image of a black hole.',
      'Its jet stretches about 5,000 light-years into space.',
      'Its event horizon is about 4 times wider than the orbit of Neptune.',
      'It sits in the giant elliptical galaxy Messier 87, in the Virgo Cluster.',
    ],
  },
  {
    id: 'ton-618',
    name: 'TON 618',
    type: 'Ultramassive black hole (quasar)',
    massSolar: 6.6e10,
    distanceLy: 10.4e9,
    discovered: '1957 (Tonantzintla Observatory); quasar identified in 1970',
    keyFeature: 'One of the most massive black holes known',
    description:
      'An ultramassive black hole of about 66 billion Suns, powering one of the brightest quasars in the universe. Its light left it more than 10 billion years ago.',
    funFacts: [
      'Its quasar shines about 140 trillion times brighter than the Sun.',
      'Its event horizon is about 2,600 AU across: over 40 times the width of Neptune\'s orbit.',
      'Its mass is estimated from the speed of gas swirling around it.',
      'Its light has travelled for over 10 billion years to reach us.',
    ],
  },
  {
    id: 'phoenix-a',
    name: 'Phoenix A',
    type: 'Ultramassive black hole',
    massSolar: 1e11,
    distanceLy: 5.8e9,
    discovered: 'Mass estimated in the 2010s',
    keyFeature: 'Possibly the largest black hole known',
    description:
      'At the heart of the Phoenix Cluster lies what may be the biggest black hole of all, perhaps 100 billion times the mass of the Sun. Its sheer size is hard to imagine.',
    funFacts: [
      'Its mass is estimated at up to 100 billion Suns, though the estimate is indirect and uncertain.',
      'It sits in the central galaxy of the Phoenix Cluster, one of the most massive galaxy clusters known.',
      'Its host galaxy forms stars at a furious rate: hundreds of Suns\' worth every year.',
      'Its event horizon could be nearly 4,000 AU across.',
    ],
  },
];

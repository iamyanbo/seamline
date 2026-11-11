import {THEMES} from './illusion-themes.js';
import {MORE} from './illusion-themes-more.js';

// Lift galleries use the materials, homes and atmosphere of their existing chapter.
// Slender open railings preserve the exact crossings in these established puzzles.
export const LIFT_THEMES=Object.fromEntries(['snow','ice','glow','cloud','stars','space'].map(key=>[
  `${key}-lifts`,{...(MORE[key]??THEMES[key]),walkway:undefined,walkwayDecoration:undefined}
]));

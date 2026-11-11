// Illusion levels: floating paths in the sky. Any two open edges that face each other count as
// joined once they line up inside a frame, seen from an eye with a clear view of both (see
// illusion-geometry.js). Every line-up counts, not only the ones a level was built around.

// A straight run of n plain cubes from (x,y,z), stepping by (dx,0,dz): open on every side.
const run=(x,y,z,dx,dz,n)=>Array.from({length:n},(_,i)=>[x+dx*i,y,z+dz*i]);
// The same run as a walkway, with low rails along its sides: open only at its two ends.
const walk=(x,y,z,dx,dz,n)=>run(x,y,z,dx,dz,n).map(b=>[...b,'rail',dx,dz]);
// A stair at (x,y,z) climbing one level towards (dx,dz).
const stair=(x,y,z,dx,dz)=>[x,y,z,'stair',dx,dz];
// A round column h blocks tall standing on (x,y,z).
const column=(x,y,z,h)=>Array.from({length:h},(_,k)=>[x,y+k,z,'column']);
// A three-by-three ring of blocks standing across x=0, centred on (0,y+1,z), with a one-block hole in the
// middle. Its sill and top are walkways across it, so they never join the path running through it.
const ringX=(y,z)=>[[0,y,z-1,'rail',1,0],[0,y,z,'rail',1,0],[0,y,z+1,'rail',1,0],[0,y+1,z-1],[0,y+1,z+1],[0,y+2,z-1,'rail',1,0],[0,y+2,z,'rail',1,0],[0,y+2,z+1,'rail',1,0]];

// The player sends the walker anywhere it can reach (tap or pinch a block); it heads for the goal by
// itself once there is a way.
// Optional level parts:
//   movers: beams that turn about a vertical axis through `pivot` by `angle` degrees when the walker is
//     sent onto the plate at `trigger`. `positions` 2 flips between two positions; 4 keeps turning round.
//     A plate on a beam rides with it, and so does a walker standing on it. A beam cannot turn into
//     a block that is in the way. A faint outline shows where a beam turns to next.
//     `travel: [0,dy,0]` makes a vertical lift instead. `linked` lists other mover indices driven by
//     the same plate, allowing one counterweight to rise as the other descends.
//   shy: pearl stones that vanish while a photo is up that shows them but cannot see them (they are hidden
//     behind something from that view). A photo can't be dropped while a stone would come back on the walker.
//   fresh: a chapter or idea opening. It still participates in the progression checks.
//   set: an architectural landmark (a castle, tower or gate). It has no difficulty exemption.
//   palette: which place the level is in (its sky, stones and theme). Campaign order and chapter sizes
//     are defined separately so new routes can join the journey without changing saved level indices.
//   portraitView: an optional opening angle for tall screens; Fit keeps the player's current angle.
// The levels were found by searching for layouts with long shortest solutions and no dead ends, then
// checked with illusion-solver.mjs (npm run solve), which prints each level's shortest solution.

import {LIFT_LEVELS} from './illusion-levels-lifts.js';
export const LEVELS=[
  // Home: the first ideas, one at a time. (Teaching levels may be short; the tests hold the rest to at least 8 moves.)
  {
    name:'First Light',intro:true,
    hint:'Find where the two paths meet.',
    frames:1,palette:5,
    view:{yaw:30,pitch:30},
    blocks:[...walk(0,0,0,1,0,3),...walk(6,2,0,1,0,3)],
    start:[0,0,0],goal:[8,2,0]
  },
  {
    name:'Two at Once',title:'Across, Then Around',intro:true,
    hint:'Cross to the corner before changing your photograph.',
    frames:1,palette:5,
    view:{yaw:40,pitch:30},
    // The two crossings face different ways. With one print, the traveller must
    // reach the corner before replacing the way in with the way out.
    blocks:[[-4,1,0,'rail',1,0,'end'],[-3,1,0,'rail',1,0],
      [0,0,0,'rail',-1,0,'turn',0,1],...walk(0,0,1,0,1,2),
      [0,2,6,'rail',0,1],[0,2,7,'rail',0,-1,'end']],
    start:[-4,1,0],goal:[0,2,7]
  },
  {
    name:'Look Down',title:'Above and Below',intro:true,
    hint:'From above, both corners can become one path.',
    frames:1,palette:5,
    view:{yaw:30,pitch:30},
    // Three floors form a bent path from above. Both perpendicular crossings
    // must fit in the same print; the outer floors cannot connect directly.
    blocks:[[-4,2,0,'rail',1,0,'end'],...walk(-3,2,0,1,0,2),
      [-1,0,0,'rail',-1,0,'turn',0,1],...walk(-1,0,1,0,1,2),
      [-1,3,3,'rail',0,1],[-1,3,4,'rail',0,-1,'end']],
    start:[-4,2,0],goal:[-1,3,4]
  },
  {
    name:'The Photo Waits',title:'One Photo, Two Shores',intro:true,
    hint:'The same photo can hold your way onto the lift and your way off it.',
    frames:1,palette:5,
    view:{yaw:40,pitch:30},
    // One exposure contains a current boarding crossing and a future landing.
    // Riding changes which crossing the original photo holds.
    blocks:[[-4,0,-2,'rail',1,0,'end'],[-3,0,-2,'rail',1,0],
      [2,4,4,'rail',0,1],[2,4,5,'rail',0,-1,'end'],...column(1,1,3,3)],
    movers:[{blocks:[[0,1,0,'rail',-1,0,'turn',0,1],[0,1,1,'rail',0,1]],
      pivot:[0,1,0],travel:[0,2,0],positions:2,trigger:[0,1,1]}],
    start:[-4,0,-2],goal:[2,4,5]
  },
  {
    name:'Bird\'s Eye',intro:true,
    hint:'Ride, then look down.',
    frames:1,palette:5,
    view:{yaw:40,pitch:30},
    // Found by search and checked by illusion-solver.mjs.
    blocks:[[0,0,-1],[0,0,-2],[-1,0,2,'rail',0,1],[-1,0,3,'rail',0,1],[-1,0,4,'rail',0,1]],
    movers:[{'blocks':[[-1,2,1,'rail',-1,0],[-2,2,1,'rail',-1,0],[-3,2,1,'rail',-1,0]],'pivot':[-1,2,1],'angle':-90,'positions':2,'trigger':[-3,2,1]}],
    start:[0,0,-1],goal:[-1,0,4]
  },
  // Castle: pearl stones that hide when a photo cannot see them.
  {
    name:'Out of Sight',intro:true,fresh:true,
    hint:'Pearl stones vanish when a photo can\'t see them.',
    frames:1,palette:0,
    view:{yaw:30,pitch:28},
    // Built by hand: seen from behind the wall, the pearl stone is hidden, so it goes.
    blocks:[[0,0,0],[1,0,0],[2,0,0],[3,0,0],[4,0,0],[2,0,-1],[2,1,-1],[2,2,-1]],
    shy:[[2,1,0]],
    start:[0,0,0],goal:[4,0,0]
  },
  {
    name:'Castle',set:true,
    hint:'Let the bridge down. The gate is shy.',
    frames:1,palette:0,
    view:{yaw:35,pitch:26},
    // Built by hand: the drawbridge swings down from the plate, and the pearl portcullis is hidden under
    // the lintel from right above, so a photo from there lifts it.
    blocks:[...walk(0,0,6,0,-1,3),[0,0,0,'rail',0,1],...walk(0,0,-1,0,-1,2),
      ...[-2,-1,1,2].flatMap(x=>[0,1,2].map(y=>[x,y,0])),[0,2,0],[-2,3,0],[2,3,0]],
    movers:[{blocks:walk(0,0,3,1,0,3),pivot:[0,0,3],angle:90,positions:2,trigger:[0,0,4]}],
    shy:[[0,1,0]],
    start:[0,0,6],goal:[0,0,-2]
  },
  {
    // Rail entrances leave a visible opening at the exact connection views.
    name:"Two Keys",
    hint:"Two plates, two beams.",
    frames:2,
    palette:0,
    view:{"yaw":40,"pitch":30},
    blocks:[[4,2,1,"rail",0,1],[4,2,2,"rail",0,1],[4,2,3,"rail",0,1],[-2,2,1,"rail",1,0],[-1,2,1,"rail",1,0],[0,2,1,"rail",1,0],[2,0,4,"rail",0,-1],[2,0,3,"rail",0,-1],[2,0,2,"rail",0,-1]],
    movers:[{"blocks":[[1,-3,2],[2,-3,2],[3,-3,2]],"pivot":[1,-3,2],"angle":90,"positions":4,"trigger":[4,2,3]},{"blocks":[[-2,-1,-3],[-2,-1,-4],[-2,-1,-5]],"pivot":[-2,-1,-3],"angle":-90,"positions":2,"trigger":[-2,2,1]}],
    start:[4,2,1],
    goal:[2,0,2],
    railScale:0.8
  },
  {
    name:'Hide and Seek',
    hint:'Some stones are in the way. Some are not.',
    frames:1,palette:0,
    view:{yaw:40,pitch:30},
    // Found by search and checked by illusion-solver.mjs.
    blocks:[[-4,-1,2,'rail',0,-1],[-4,-1,1,'rail',0,-1],[-4,-1,0,'rail',0,-1],[2,0,3],[3,0,3],[4,0,3],[3,1,2],[3,2,2],[3,3,3]],
    movers:[{'blocks':[[-2,1,1],[-3,1,1],[-4,1,1]],'pivot':[-2,1,1],'angle':90,'positions':2,'trigger':[2,0,3]}],
    shy:[[3,1,3]],
    start:[-4,-1,2],goal:[4,0,3]
  },
  {
    name:'Moonlit Path',
    hint:'A stone is in the way. Look at it from the right side.',
    frames:1,palette:0,
    view:{yaw:35,pitch:30},
    // Found by search and checked by illusion-solver.mjs.
    blocks:[[3,-1,0,'rail',0,-1],[3,-1,-1,'rail',0,-1],[3,-1,-2,'rail',0,-1],[-3,-2,2,'rail',-1,0],[-4,-2,2,'rail',-1,0],[-2,-1,-1,'rail',-1,0],[-3,-1,-1,'rail',-1,0],[1,0,-2,'rail',0,-1],[1,0,-3,'rail',0,-1],[1,0,-4,'rail',0,-1],[1,0,-5,'rail',0,-1],[2,1,-4],[2,2,-4]],
    movers:[{'blocks':[[2,2,0,'rail',1,0],[3,2,0,'rail',1,0],[4,2,0,'rail',1,0]],'pivot':[2,2,0],'angle':-90,'positions':4,'trigger':[4,2,0]}],
    shy:[[1,1,-4]],
    start:[3,-1,0],goal:[1,0,-5]
  },
  // Beach: ferries: ride a beam across the water.
  {
    // Campaign lifts and hidden-stone paths, checked with the shared solver.
    name:"Passenger",
    title:"Rising Tide",
    frames:1,
    palette:6,
    intro:true,
    view:{"yaw":40,"pitch":30},
    hint:"Ride up, then find the way ashore.",
    blocks:[[-4,1,0,"rail",1,0,"end"],[-3,1,0,"rail",1,0],[1,0,5,"rail",0,1],[1,0,6,"rail",0,-1,"end"]],
    movers:[{"blocks":[[0,0,0,"rail",1,0],[1,0,0,"rail",-1,0,"turn",0,1],[1,0,1,"rail",0,1]],"pivot":[0,0,0],"travel":[0,2,0],"positions":2,"trigger":[0,0,0]}],
    start:[-4,1,0],
    goal:[1,0,6]
  },
  {
    // Platform placement checked with exact joins; original shortest solution length retained.
    name:"Ferryman",
    hint:"The beam will carry you.",
    frames:2,
    palette:6,
    view:{"yaw":35,"pitch":30},
    blocks:[[2,-2,0,"rail",0,-1],[2,-2,-1,"rail",0,-1],[2,-1,-2,"stair",0,-1],[-2,2,-5,"rail",1,0],[-1,2,-5,"rail",1,0],[2,3,-1],[1,3,-1],[0,3,-1]],
    movers:[{"blocks":[[6,-1,0,"rail",0,-1],[6,-1,-1,"rail",0,-1],[6,-1,-2,"rail",0,-1],[6,-1,-3,"rail",0,-1]],"pivot":[6,-1,0],"angle":-90,"positions":2,"trigger":[1,3,-1]},{"blocks":[[4,2,5],[5,2,5],[6,2,5]],"pivot":[4,2,5],"angle":-90,"positions":4,"trigger":[6,2,5]}],
    start:[2,-2,0],
    goal:[-1,2,-5]
  },
  {
    // Campaign lifts and hidden-stone paths, checked with the shared solver.
    name:"Low Tide",
    hint:"Hide the pearl stone to reach the tide control.",
    frames:2,
    palette:6,
    view:{"yaw":35,"pitch":30},
    blocks:[[3,-2,2],[3,-2,1],[3,-1,0,"stair",0,-1],[-1,-2,-4,"rail",0,1],[-1,-2,-3,"rail",0,1],[-1,-1,-2,"stair",0,1],[-8,2,5],[3,3,-4,"rail",-1,0],[2,3,-4,"rail",-1,0],[1,3,-4,"rail",-1,0],[0,3,-4,"rail",-1,0],[-1,4,-4,"stair",-1,0],[-2,4,-4,"rail",-1,0],[3,3,-3,"column"],[3,4,-3,"column"],[3,5,-3,"column"]],
    movers:[{"blocks":[[4,0,5,"rail",-1,0],[3,0,5],[2,0,5],[1,1,5,"stair",-1,0]],"pivot":[4,0,5],"angle":-90,"positions":4,"trigger":[3,0,5]}],
    start:[-1,-2,-3],
    goal:[-2,4,-4],
    shy:[[3,4,-4]]
  },
  {
    name:'Swing Gate',
    hint:'One photo at a time.',
    frames:1,palette:6,
    view:{yaw:-40,pitch:30},
    // Found by search and checked by illusion-solver.mjs: the shortest solution is 11 moves, with no dead ends.
    blocks:[...walk(-5,-5,0,1,0,4),...walk(-3,-1,9,1,0,4),...run(-4,3,8,0,1,1),...run(-3,2,1,0,-1,2),stair(-3,3,-1,0,-1)],
    movers:[
      {blocks:[...run(-1,2,-3,-1,0,4)],pivot:[-1,2,-3],angle:-90,positions:4,trigger:[-3,2,-3]},
      {blocks:[...walk(-3,0,2,-1,0,4)],pivot:[-3,0,2],angle:90,positions:2,trigger:[-4,-5,0]}
    ],
    start:[-3,2,1],goal:[-3,-1,9]
  },
  {
    name:'Harbour',
    hint:'Three rides. Keep a photo for the way back.',
    frames:2,palette:6,
    view:{yaw:35,pitch:30},
    // Found by search and checked by illusion-solver.mjs.
    blocks:[...run(-3,2,5,-1,0,3),stair(-6,3,5,-1,0),...run(-7,3,5,-1,0,2),...walk(-4,2,-2,0,-1,1),...walk(1,0,-2,-1,0,4),stair(-3,0,-2,1,0),...walk(-4,-1,-2,-1,0,1),...walk(2,-2,6,1,0,3),stair(5,-2,6,-1,0),...walk(6,-3,6,1,0,2)],
    movers:[
      {blocks:[...walk(0,-2,0,1,0,4)],pivot:[0,-2,0],angle:90,positions:4,trigger:[4,2,4]},
      {blocks:[...walk(5,2,4,-1,0,3)],pivot:[5,2,4],angle:-90,positions:4,trigger:[3,2,4]}
    ],
    start:[-3,2,5],goal:[-4,2,-2]
  },
  // Kyoto: stairs up and down between the paths.
  {
    // Rail entrances leave a visible opening at the exact connection views.
    name:"Spiral",
    set:true,
    hint:"Follow the terraces around the tower.",
    frames:1,
    palette:1,
    view:{"yaw":35,"pitch":24},
    blocks:[[0,0,0],[0,1,0],[0,2,0],[0,3,0],[0,4,0],[0,5,0],[0,6,0],[0,7,0,"column"],[-1,6,-1,"rail",1,0],[0,6,-1,"rail",1,0],[2,4,-1,"rail",-1,0,"turn",0,1],[2,4,0,"rail",0,1],[1,2,2,"rail",0,-1,"turn",-1,0],[0,2,2,"rail",1,0],[-1,0,1,"rail",1,0,"turn",0,-1],[-1,0,0,"rail",0,1]],
    start:[-1,6,-1],
    goal:[-1,0,0],
    railScale:0.9,
    railSetback:0.16
  },
  {
    name:'Temple Steps',fresh:true,
    hint:'Up the steps, and down again.',
    frames:2,palette:1,
    view:{yaw:35,pitch:30},
    // Found by search and checked by illusion-solver.mjs.
    // The middle landing has visible rails: a side entrance would bypass the two turning stairs.
    blocks:[[0,-1,0],[0,-1,-1,'rail',0,-1],[0,-1,-2],stair(0,0,-3,0,-1),...walk(-1,-2,4,-1,0,2),stair(-3,-1,4,-1,0),...walk(5,4,4,0,1,4),...walk(4,0,4,1,0,2),stair(6,0,4,-1,0),...walk(7,-1,4,1,0,1)],
    movers:[
      {blocks:[...walk(-2,1,1,1,0,4),stair(2,2,1,1,0)],pivot:[-2,1,1],angle:90,positions:4,trigger:[-3,-2,-3]},
      {blocks:[...walk(-3,-2,-1,0,-1,4)],pivot:[-3,-2,-1],angle:90,positions:2,trigger:[-1,-2,4]}
    ],
    start:[4,0,4],goal:[5,4,7]
  },
  {
    // Platform placement checked with exact joins; original shortest solution length retained.
    name:"Three Keys",
    hint:"Some views only open after a turn.",
    frames:1,
    palette:1,
    view:{"yaw":30,"pitch":30},
    blocks:[[-3,-1,4,"rail",0,1],[-3,0,5,"stair",0,1],[-3,0,6,"rail",0,1],[-3,0,7,"rail",0,1],[0,0,-4],[1,-1,6,"rail",0,1],[-2,4,5,"rail",1,0],[-1,4,5,"stair",-1,0],[0,3,5,"rail",1,0],[1,3,5,"rail",1,0]],
    movers:[{"blocks":[[-1,-2,2],[-2,-2,2],[-3,-2,2]],"pivot":[-1,-2,2],"angle":90,"positions":2,"trigger":[-4,-2,-1]},{"blocks":[[-4,-2,-3,"rail",0,1],[-4,-2,-2,"rail",0,1],[-4,-2,-1,"rail",0,1],[-4,-1,0,"stair",0,1]],"pivot":[-4,-2,-3],"angle":-90,"positions":2,"trigger":[1,-1,6]},{"blocks":[[6,2,-2,"rail",-1,0],[5,2,-2,"rail",-1,0],[4,2,-2,"rail",-1,0],[3,2,-2,"rail",-1,0]],"pivot":[6,2,-2],"angle":90,"positions":4,"trigger":[-3,0,6]}],
    start:[0,0,-4],
    goal:[1,3,5]
  },
  {
    // Rail entrances leave a visible opening at the exact connection views.
    name:"Stepping Stones",
    title:"Gate Avenue",
    hint:"The last view joins the whole avenue.",
    frames:1,
    palette:1,
    view:{"yaw":40,"pitch":28},
    composition:{"kind":"gate-avenue","gates":[[-2,3,2],[-3,4,1],[-4,5,-1]],"reveal":{"dir":[-1,1,0],"at":[-3,4,1],"zoom":3.8}},
    blocks:[[4,2,4,"rail",-1,0],[3,2,4,"rail",-1,0],[2,2,4,"rail",-1,0],[-2,3,2,"rail",0,1],[-2,3,3,"rail",0,1],[-4,0,3,"rail",1,0],[-3,0,3,"rail",1,0],[-2,1,3,"stair",1,0],[-5,0,-7,"rail",1,0],[-2,1,1,"rail",1,0],[-1,1,1,"rail",1,0],[0,1,1,"rail",1,0],[1,1,1,"rail",1,0],[6,3,-2,"rail",-1,0],[5,3,-2,"rail",-1,0],[4,3,-2,"stair",1,0],[3,2,-2,"rail",-1,0],[2,2,-2,"rail",-1,0],[-3,4,1,"rail",0,-1],[-3,4,0,"rail",0,-1],[-4,5,-1,"rail",0,-1],[-4,5,-2,"rail",0,1,"end"]],
    movers:[{"blocks":[[2,-1,6,"rail",1,0],[3,-1,6,"rail",1,0],[4,-1,6,"rail",1,0]],"pivot":[2,-1,6],"angle":90,"positions":2,"trigger":[4,-1,6]}],
    start:[-5,0,-7],
    goal:[-4,5,-2],
    railScale:0.7,
    railSetback:0.12
  },
  {
    // Campaign lifts and hidden-stone paths, checked with the shared solver.
    name:"Moss Garden",
    hint:"The garden keeps its switch behind a shy stone.",
    frames:1,
    palette:1,
    view:{"yaw":35,"pitch":30},
    blocks:[[-7,2,-6,"rail",-1,0],[-8,2,-6,"rail",-1,0],[-9,3,-6,"stair",-1,0],[-10,3,-6,"rail",-1,0],[7,-7,1,"rail",-1,0],[6,-7,1,"rail",-1,0],[5,-7,1,"rail",-1,0],[4,-7,1,"rail",-1,0],[3,-7,1,"stair",1,0],[2,-8,1,"rail",-1,0],[1,-8,1,"rail",-1,0],[1,0,5,"rail",0,1],[1,0,6,"rail",0,1],[1,0,7,"stair",0,-1],[1,-1,8,"rail",0,1],[-5,1,1,"rail",0,-1],[-5,1,0,"rail",0,-1],[-5,1,-1,"rail",0,-1],[-5,1,-2,"rail",0,-1],[-4,1,1,"column"],[-4,2,1,"column"],[-4,3,1,"column"]],
    movers:[{"blocks":[[5,-1,0],[5,-1,1],[5,-1,2],[5,-1,3],[5,0,4,"stair",0,1]],"pivot":[5,-1,0],"angle":-90,"positions":4,"trigger":[5,-7,1]},{"blocks":[[3,3,5],[3,3,4],[3,3,3],[3,3,2]],"pivot":[3,3,5],"angle":-90,"positions":4,"trigger":[-5,1,-1]}],
    start:[-5,1,-2],
    goal:[1,-1,8],
    railScale:0.6,
    railSetback:0.12,
    shy:[[-5,2,1]]
  },
  // Desert: turntables that keep going round.
  {
    name:'Round and Round',intro:true,fresh:true,
    hint:'This one keeps turning.',
    frames:1,palette:2,
    view:{yaw:40,pitch:30},
    // Found by search and checked by illusion-solver.mjs.
    blocks:[[-3,2,-4,'rail',0,-1],[-3,2,-5,'rail',0,-1],[0,0,-2],[-1,0,-2],[-2,0,-2],[4,-2,-3,'rail',1,0],[5,-2,-3,'rail',1,0]],
    movers:[{blocks:[[-3,2,-2,'rail',1,0],[-2,2,-2,'rail',1,0],[-1,2,-2,'rail',1,0]],pivot:[-3,2,-2],angle:-90,positions:4,trigger:[0,0,-2]}],
    start:[-3,2,-4],goal:[5,-2,-3]
  },
  {
    // Authored progression pass: every open edge still follows the shared exact geometry rules.
    name:"Moon Gate",
    set:true,
    hint:"Turn the gate, then cross the side court.",
    frames:1,
    palette:2,
    view:{"yaw":55,"pitch":26},
    blocks:[[0,-1,5,"rail",0,-1],[0,-1,4,"rail",0,-1],[0,-1,3,"rail",0,-1],[0,2,-3,"rail",0,-1],[0,2,-4,"rail",0,-1],[0,2,-5,"rail",0,1,"turn",-1,0],[-3,3,-5,"rail",-1,0],[-4,3,-5,"rail",-1,0],[-5,4,-8,"rail",-1,0],[-6,4,-8,"rail",-1,0],[-7,4,-8,"rail",1,0,"end"],[-5,5,-9,"column"]],
    movers:[{"blocks":[[0,0,-1,"rail",1,0],[0,0,0,"rail",1,0],[0,0,1,"rail",1,0],[0,1,-1],[0,1,1],[0,2,-1,"rail",1,0],[0,2,0,"rail",1,0],[0,2,1,"rail",1,0]],"pivot":[0,0,0],"angle":90,"positions":2,"trigger":[0,-1,3]}],
    start:[0,-1,5],
    goal:[-7,4,-8],
    composition:{"kind":"moon-courts","spans":[{"a":[0,-1,5],"b":[0,-1,3]},{"a":[-5,4,-8],"b":[-7,4,-8]}]}
  },
  {
    // Campaign lifts and hidden-stone paths, checked with the shared solver.
    name:"Sundial",
    hint:"Hide the stone to make room on the lower terrace.",
    frames:1,
    palette:2,
    view:{"yaw":35,"pitch":30},
    blocks:[[-3,-2,-4],[-2,-2,-4],[-1,-2,-4],[0,-2,-4],[1,-2,-4,"stair",-1,0],[2,-3,-4],[1,3,-7,"rail",1,0],[2,3,-7,"rail",1,0],[3,3,-7,"rail",1,0],[4,3,-7,"rail",1,0],[5,4,-7,"stair",1,0],[6,4,-7,"rail",1,0],[5,2,-4,"rail",-1,0],[4,2,-4,"rail",-1,0],[-3,-2,1],[-3,-2,2],[-3,-1,3,"stair",0,1],[-3,-1,4],[4,2,-3,"column"],[4,3,-3,"column"],[4,4,-3,"column"]],
    movers:[{"blocks":[[0,4,0,"rail",-1,0],[-1,4,0,"rail",-1,0],[-2,4,0,"rail",-1,0],[-3,5,0,"stair",-1,0]],"pivot":[0,4,0],"angle":-90,"positions":4,"trigger":[1,3,-7]}],
    start:[-3,-1,4],
    goal:[5,2,-4],
    shy:[[4,3,-4]]
  },
  {
    // Platform placement checked with exact joins; original shortest solution length retained.
    name:"Clockwork",
    hint:"Order matters.",
    frames:1,
    palette:2,
    view:{"yaw":35,"pitch":30},
    blocks:[[5,1,-3,"rail",0,1],[5,1,-2,"rail",0,1],[5,2,-1,"stair",0,1],[5,2,0,"rail",0,1],[0,2,-7,"rail",0,-1],[0,2,-8,"rail",0,-1],[0,2,-9,"rail",0,-1],[0,2,-10,"rail",0,-1],[4,-1,0,"rail",-1,0],[6,1,5,"rail",1,0]],
    movers:[{"blocks":[[-6,-1,-4],[-7,-1,-4],[-8,-1,-4]],"pivot":[-6,-1,-4],"angle":90,"positions":2,"trigger":[5,1,-2]},{"blocks":[[3,-3,-6,"rail",0,-1],[3,-3,-7,"rail",0,-1],[3,-3,-8,"rail",0,-1],[3,-3,-9,"rail",0,-1]],"pivot":[3,-3,-6],"angle":-90,"positions":4,"trigger":[-7,-1,-4]},{"blocks":[[1,-2,1,"rail",0,-1],[1,-2,0,"rail",0,-1],[1,-2,-1,"rail",0,-1],[1,-2,-2,"rail",0,-1]],"pivot":[1,-2,1],"angle":90,"positions":4,"trigger":[4,-1,0]}],
    start:[0,2,-7],
    goal:[6,1,5]
  },
  {
    // Authored crossing and finale composition; validated against every legal open-edge join.
    name:"Turntable",
    hint:"Which way should the stair face?",
    frames:2,
    palette:2,
    view:{"yaw":-35,"pitch":32},
    blocks:[[6,3,2],[6,3,3],[6,3,4],[6,4,5,"stair",0,1],[-1,2,1,"rail",-1,0],[-2,2,1,"rail",-1,0],[-3,2,1,"rail",-1,0],[1,1,1,"rail",0,1],[1,1,2,"rail",0,1],[1,1,3,"rail",0,1],[-1,-2,-1,"rail",0,1],[-1,-2,0,"rail",0,1],[-1,-2,1,"rail",0,1],[-1,-2,2,"rail",0,1],[-3,-4,-5,"rail",0,1],[-3,-4,-4,"rail",0,1]],
    movers:[{"blocks":[[-5,6,-7,"rail",0,1],[-5,6,-6,"rail",0,1],[-5,6,-5,"rail",0,1],[-5,7,-4,"stair",0,1]],"pivot":[-5,6,-7],"angle":90,"positions":4,"trigger":[1,1,1]}],
    start:[-1,-2,-1],
    goal:[-1,2,1],
    composition:{"kind":"chapter-finale","archMovers":true,"spans":[{"a":[-3,2,1],"b":[-2,2,1]},{"a":[-2,2,1],"b":[-1,2,1]}],"reveal":{"dir":[-0.11111111111111106,0.44444444444444436,-0.888888888888889],"at":[-2.75,3,-1],"focus":[[-5,6,-7],[-3,2,1],[-2,2,1],[-1,2,1]]}}
  },
  // Santorini: high and low: steps on the cliffs.
  {
    // Campaign lifts and hidden-stone paths, checked with the shared solver.
    name:"Blue Door",
    title:"Cliff Lifts",
    frames:1,
    palette:7,
    intro:false,
    view:{"yaw":40,"pitch":30},
    hint:"Raise one lift, uncover the button, and lower the other.",
    blocks:[[-4,1,0,"rail",1,0,"end"],[-3,1,0,"rail",1,0],[1,0,5,"rail",0,1],[1,0,6,"rail",0,-1,"turn",1,0],[2,0,6,"rail",1,0],[7,0,0,"rail",0,1],[7,0,-1,"rail",0,1,"end"],[2,1,5,"column"],[2,2,5,"column"],[2,3,5,"column"]],
    movers:[{"blocks":[[0,0,0,"rail",1,0],[1,0,0,"rail",-1,0,"turn",0,1],[1,0,1,"rail",0,1]],"pivot":[0,0,0],"travel":[0,2,0],"positions":2,"trigger":[0,0,0]},{"blocks":[[6,0,6,"rail",1,0],[7,0,6,"rail",-1,0,"turn",0,-1],[7,0,5,"rail",0,-1]],"pivot":[6,0,6],"travel":[0,-2,0],"positions":2,"trigger":[2,0,6]}],
    start:[-4,1,0],
    goal:[7,0,-1],
    shy:[[2,1,6]],
    fresh:true
  },
  {
    // Campaign lifts and hidden-stone paths, checked with the shared solver.
    name:"White Steps",
    hint:"One lift rises while the other falls. Photograph the route between them.",
    frames:1,
    palette:7,
    view:{"yaw":35,"pitch":28},
    blocks:[[-2,0,0,"rail",1,0],[-1,0,0,"rail",1,0],[7,2,-7,"rail",1,0],[8,3,-7,"stair",1,0],[9,3,-7,"rail",-1,0,"turn",0,1],[9,2,-3,"rail",0,1],[9,3,-2,"stair",0,1],[9,3,-1,"rail",0,-1,"turn",1,0],[11,2,-1,"rail",1,0],[12,3,-1,"stair",1,0],[13,3,-1,"rail",-1,0,"turn",0,-1],[13,2,-3,"rail",0,-1],[13,2,-4,"rail",0,1,"end"]],
    movers:[{"blocks":[[0,0,0,"rail",1,0],[1,0,0,"rail",-1,0,"turn",0,-1],[1,0,-1,"rail",0,-1]],"pivot":[0,0,0],"travel":[0,2,0],"positions":2,"trigger":[0,0,0],"linked":[1]},{"blocks":[[1,2,-6,"rail",0,1],[1,2,-7,"rail",0,1,"turn",1,0],[2,2,-7,"rail",1,0],[3,2,-7,"rail",1,0]],"pivot":[1,2,-6],"travel":[0,-2,0],"positions":2,"linked":[0]}],
    start:[-2,0,0],
    goal:[13,2,-4],
    title:"Counterweight Court"
  },
  {
    name:'Cliff Path',
    hint:'Every stair leads somewhere.',
    frames:1,palette:7,
    view:{yaw:35,pitch:30},
    // Found by search and checked by illusion-solver.mjs.
    blocks:[...walk(1,-2,-7,0,-1,2),stair(1,-1,-9,0,-1),...walk(0,2,-2,0,1,4),stair(0,3,2,0,1),...walk(0,3,3,0,1,1),...run(-4,0,3,0,-1,1),...walk(4,-1,4,0,-1,1),...walk(0,-3,0,1,0,4),stair(4,-3,0,-1,0),...walk(5,-4,0,1,0,2)],
    movers:[
      {blocks:[...run(3,1,6,0,-1,4)],pivot:[3,1,6],angle:90,positions:2,trigger:[1,-2,-8]},
      {blocks:[...walk(-3,5,-3,0,-1,4)],pivot:[-3,5,-3],angle:-90,positions:2,trigger:[-4,0,3]}
    ],
    start:[6,-4,0],goal:[4,-1,4]
  },
  {
    name:'Windmills',
    hint:'Up, across, and up again.',
    frames:1,palette:7,
    view:{yaw:35,pitch:30},
    // Found by search and checked by illusion-solver.mjs.
    blocks:[...walk(-1,-2,2,-1,0,2),stair(-3,-1,2,-1,0),...walk(0,3,-1,0,-1,3),...walk(5,-1,3,0,-1,2),stair(5,0,1,0,-1),...run(-3,1,0,0,-1,4),stair(-3,2,-4,0,-1)],
    movers:[
      {blocks:[...run(3,-2,-1,0,1,4),stair(3,-1,3,0,1)],pivot:[3,-2,-1],angle:90,positions:2,trigger:[-2,-2,2]},
      {blocks:[...run(2,3,2,0,-1,3)],pivot:[2,3,2],angle:-90,positions:4,trigger:[2,3,0]}
    ],
    start:[-3,1,0],goal:[0,3,-1]
  },
  {
    // Terraces repositioned for visible, unobstructed crossings; solution length retained.
    name:"Bell Tower",
    hint:"Find the view that brings the courts together.",
    frames:1,
    palette:7,
    view:{"yaw":35,"pitch":30},
    blocks:[[0,2,-1,"rail",-1,0],[-1,2,-1,"rail",-1,0],[0,3,2,"rail",0,1],[0,3,3,"rail",0,1],[0,3,4,"rail",0,1],[0,4,5,"stair",0,1],[0,4,6,"rail",0,1],[0,4,7,"rail",0,1],[0,1,1],[-2,0,-1,"rail",-1,0],[-3,0,-1,"rail",-1,0],[-4,0,-1,"rail",-1,0],[4,-3,5,"rail",1,0],[5,-3,5,"stair",-1,0],[6,-4,5,"rail",1,0],[0,5,8,"rail",0,1],[0,5,9,"rail",0,-1,"turn",1,0],[1,6,9,"rail",1,0],[2,6,9,"rail",-1,0,"end"]],
    movers:[{"blocks":[[2,0,2,"rail",0,-1],[2,0,1,"rail",0,-1],[2,0,0,"rail",0,-1],[2,1,-1,"stair",0,-1]],"pivot":[2,0,2],"angle":-90,"positions":2,"trigger":[4,-3,5]}],
    start:[0,2,-1],
    goal:[2,6,9],
    composition:{"kind":"chapter-court","archMovers":true,"spans":[{"a":[0,5,8],"b":[0,5,9]},{"a":[1,6,9],"b":[2,6,9]}],"reveal":{"dir":[0,1,6.123233995736766e-17],"focus":[[2,6,9],[-1.5,2.5,-1],[-1.5,0.5,-1],[0,3.5,1.5],[0,1.5,1.5],[0,4.5,7.5],[0,5.5,7.5],[0.5,5.5,9],[0.5,6.5,9]],"at":[0,4,4.777777777777778]}},
    title:"Bell Court"
  },
  // Venice: swing bridges that open one way and back.
  {
    // Authored progression pass: every open edge still follows the shared exact geometry rules.
    name:"Endless Stair",
    set:true,
    hint:"Find each terrace around the canal tower.",
    frames:1,
    palette:3,
    view:{"yaw":-50,"pitch":30},
    blocks:[[0,0,0],[0,1,0],[0,2,0],[0,3,0],[0,4,0],[0,5,0],[0,6,0],[0,7,0,"column"],[-1,6,-1,"rail",1,0],[0,6,-1,"rail",1,0],[2,4,-1,"rail",-1,0,"turn",0,1],[2,4,0,"rail",0,1],[1,2,2,"rail",0,-1,"turn",-1,0],[0,2,2,"rail",1,0],[-1,0,1,"rail",1,0,"turn",0,-1],[-1,0,0,"rail",0,1],[1,-2,-4,"rail",0,1,"end"],[1,1,-1,"column"]],
    start:[-1,6,-1],
    goal:[1,-2,-4],
    title:"Canal Tower",
    composition:{"kind":"canal-tower"}
  },
  {
    name:'Canal',fresh:true,
    hint:'The bridge swings out, and swings back.',
    frames:1,palette:3,
    view:{yaw:35,pitch:30},
    // Found by search and checked by illusion-solver.mjs.
    blocks:[...walk(0,1,1,0,1,1),...run(-6,3,1,0,1,3),...walk(1,-2,4,0,-1,3),stair(1,-1,1,0,-1),...walk(1,-1,0,0,-1,2),...walk(-1,3,3,0,-1,2)],
    movers:[
      {blocks:[...walk(6,-1,-2,1,0,3)],pivot:[6,-1,-2],angle:90,positions:2,trigger:[-6,3,1]},
      {blocks:[...run(1,-1,-6,1,0,3),stair(4,0,-6,1,0)],pivot:[1,-1,-6],angle:-90,positions:2,trigger:[8,-1,-2]}
    ],
    start:[0,1,1],goal:[1,-1,-1]
  },
  {
    name:'Gondola',
    hint:'Two bridges. Each one goes back and forth.',
    frames:1,palette:3,
    view:{yaw:35,pitch:30},
    // Found by search and checked by illusion-solver.mjs.
    blocks:[...walk(3,0,5,0,-1,3),...run(1,2,5,0,-1,2),...walk(-5,-4,5,0,-1,2),...walk(3,2,-1,1,0,3),stair(6,3,-1,1,0)],
    movers:[
      {blocks:[...walk(0,1,-3,-1,0,4),stair(-4,2,-3,-1,0)],pivot:[0,1,-3],angle:90,positions:2,trigger:[1,2,5]},
      {blocks:[...run(-1,0,-5,0,-1,3),stair(-1,1,-8,0,-1)],pivot:[-1,0,-5],angle:-90,positions:2,trigger:[-5,-4,4]}
    ],
    start:[3,2,-1],goal:[3,0,5]
  },
  {
    // Terraces repositioned for visible, unobstructed crossings; solution length retained.
    name:"Two Bridges",
    title:"Crossed Bridges",
    hint:"One bridge carries the other bridge’s switch.",
    frames:1,
    palette:3,
    view:{"yaw":35,"pitch":30},
    composition:{"kind":"paired-bridges"},
    blocks:[[1,4,-7],[0,4,-7],[-1,4,-7],[-2,5,-7,"stair",-1,0],[-3,5,-7],[-4,5,-7],[3,-3,4,"rail",-1,0],[2,-3,4,"rail",-1,0],[1,-3,4,"rail",-1,0],[-5,3,-1,"rail",1,0],[-4,3,-1,"rail",1,0],[-3,3,-1,"rail",1,0],[-2,3,-1,"rail",1,0],[-4,-3,4,"rail",1,0],[-3,-3,4,"rail",1,0],[-2,-3,4,"rail",1,0],[-1,-3,4,"rail",1,0],[0,2,2,"column"],[0,3,2,"column"]],
    movers:[{"blocks":[[2,3,6],[1,3,6],[0,3,6],[-1,3,6],[-2,4,6,"stair",-1,0]],"pivot":[2,3,6],"angle":-90,"positions":2,"trigger":[-4,3,-1]},{"blocks":[[-2,-1,1],[-2,-1,2],[-2,-1,3]],"pivot":[-2,-1,1],"angle":-90,"positions":2,"trigger":[0,3,6]}],
    start:[-4,5,-7],
    goal:[-1,-3,4]
  },
  {
    name:'Lagoon',
    hint:'Go back the way you came. It leads somewhere new now.',
    frames:1,palette:3,
    view:{yaw:35,pitch:30},
    // Found by search and checked by illusion-solver.mjs.
    blocks:[...run(3,1,2,-1,0,1),...walk(-4,2,-4,0,-1,2),...run(-3,0,3,1,0,4),...walk(-6,3,0,1,0,1),stair(-5,3,0,-1,0)],
    movers:[
      {blocks:[...walk(-4,-2,6,0,1,4),stair(-4,-1,10,0,1)],pivot:[-4,-2,6],angle:90,positions:2,trigger:[5,0,-9]},
      {blocks:[...run(6,0,-9,-1,0,3)],pivot:[6,0,-9],angle:-90,positions:2,trigger:[-4,2,-4]}
    ],
    start:[3,1,2],goal:[-6,3,0]
  },
  // Lantern night: two photos at once.
  {
    // Authored progression pass: every open edge still follows the shared exact geometry rules.
    name:"Two Photos",
    intro:true,
    fresh:true,
    hint:"Keep the first crossing while you open the second.",
    frames:2,
    palette:8,
    view:{"yaw":40,"pitch":30},
    blocks:[[3,0,3,"rail",1,0],[4,0,3,"rail",1,0],[-1,0,4,"rail",1,0],[0,0,4,"rail",1,0],[-14,-2,6,"rail",1,0],[-15,-2,6,"rail",1,0,"end"]],
    movers:[{"blocks":[[-2,-2,-3],[-2,-2,-2,"rail",0,1],[-2,-2,-1,"rail",0,-1,"turn",1,0]],"pivot":[-2,-2,-3],"angle":-90,"positions":4,"trigger":[0,0,4]},{"blocks":[[-5,2,6,"rail",0,1],[-5,2,7,"rail",0,1],[-5,2,8,"rail",0,1],[-5,2,9,"rail",0,-1,"end"]],"pivot":[-5,2,6],"angle":90,"positions":2,"trigger":[-5,2,9]}],
    start:[3,0,3],
    goal:[-15,-2,6],
    title:"Lantern Courts",
    composition:{"kind":"lantern-courts","archMovers":true}
  },
  {
    // Lantern Exchange joins the main journey here, after the two-photo lesson.
    // One held view connects both turning bridges. Opening the control gate replaces
    // that photo, so the player must return to the first bridge and rebuild the route.
    // Keep the original save key and level number; the revised shortest path is 12 actions.
    name:'Paper Lights',title:'Lantern Exchange',palette:8,frames:1,
    hint:'Open the gate, then rebuild the crossing.',view:{yaw:-30,pitch:32},portraitView:{yaw:35,pitch:36},
    blocks:[[-5,0,-3,'rail',1,0,'end'],[-4,0,-3,'rail',1,0],
      [-3,0,-6,'rail',0,1],[-3,0,-7,'rail',0,1,'turn',-1,0],
      ...[1,2,3].map(y=>[-3,y,-8,'rail',1,0,'end']),
      [-13,-4,-13,'rail',1,0],[-14,-4,-13,'rail',1,0,'end']],
    shy:[[-3,1,-7]],
    movers:[
      {pivot:[0,2,0],angle:90,positions:2,blocks:walk(0,2,0,1,0,3),trigger:[2,2,0]},
      {pivot:[-7,-2,-10],angle:-90,positions:2,blocks:walk(-7,-2,-10,0,1,3),trigger:[-3,0,-7]}
    ],
    start:[-5,0,-3],goal:[-14,-4,-13]
  },
  {
    name:'Lantern Bridge',
    hint:'One photo for each beam.',
    frames:2,palette:8,
    view:{yaw:35,pitch:30},
    // Found by search and checked by illusion-solver.mjs.
    blocks:[...walk(5,4,-4,1,0,3),...walk(8,1,1,0,1,2),...walk(-3,3,3,-1,0,4),stair(-7,3,3,1,0),...walk(-8,2,3,-1,0,2),...run(-2,3,-7,0,1,3)],
    movers:[
      {blocks:[...walk(0,3,-3,1,0,4)],pivot:[0,3,-3],angle:-90,positions:2,trigger:[-4,3,3]},
      {blocks:[...run(-1,-1,1,-1,0,3)],pivot:[-1,-1,1],angle:-90,positions:4,trigger:[5,4,-4]}
    ],
    start:[-2,3,-7],goal:[8,1,1]
  },
  {
    // Platform placement checked with exact joins; original shortest solution length retained.
    name:"Tea House",
    hint:"Keep one photo, change the other.",
    frames:2,
    palette:8,
    view:{"yaw":35,"pitch":30},
    blocks:[[-10,4,3,"rail",-1,0],[-11,4,3,"rail",-1,0],[-1,-1,2],[0,0,2,"stair",1,0],[1,0,2],[5,-2,-1,"rail",-1,0],[4,-2,-1,"rail",-1,0],[3,-2,-1,"rail",-1,0],[2,-2,-1,"rail",-1,0],[1,-1,-1,"stair",-1,0],[0,3,2,"rail",0,-1],[0,3,1,"rail",0,-1],[0,3,0,"rail",0,-1],[0,3,-1,"rail",0,-1],[-5,2,3,"column"],[-5,3,3,"column"]],
    movers:[{"blocks":[[1,-1,-5,"rail",-1,0],[0,-1,-5,"rail",-1,0],[-1,-1,-5,"rail",-1,0]],"pivot":[1,-1,-5],"angle":-90,"positions":4,"trigger":[6,1,3]},{"blocks":[[4,1,3,"rail",1,0],[5,1,3,"rail",1,0],[6,1,3,"rail",1,0],[7,2,3,"stair",1,0]],"pivot":[4,1,3],"angle":-90,"positions":2,"trigger":[-11,4,3]}],
    start:[5,-2,-1],
    goal:[0,3,-1]
  },
  {
    // Authored crossing and finale composition; validated against every legal open-edge join.
    name:"Moon Festival",
    hint:"Two photos, two beams, and plenty of time.",
    frames:2,
    palette:8,
    view:{"yaw":35,"pitch":30},
    blocks:[[1,-2,3,"rail",1,0],[2,-2,3,"rail",1,0],[3,-2,3,"rail",1,0],[4,-2,3,"stair",-1,0],[3,-4,6,"rail",0,1],[3,-4,7,"rail",0,1],[3,-4,8,"rail",0,1],[-3,3,3,"rail",1,0],[-2,3,3,"stair",-1,0],[-1,2,3,"rail",1,0]],
    movers:[{"blocks":[[1,1,-3,"rail",1,0],[2,1,-3,"rail",1,0],[3,1,-3,"rail",1,0],[4,2,-3,"stair",1,0]],"pivot":[1,1,-3],"angle":-90,"positions":4,"trigger":[2,-3,-2]},{"blocks":[[2,-3,-4],[2,-3,-3],[2,-3,-2],[2,-2,-1,"stair",0,1]],"pivot":[2,-3,-4],"angle":90,"positions":4,"trigger":[3,1,-3]}],
    start:[1,-2,3],
    goal:[3,-4,6],
    composition:{"kind":"chapter-finale","archMovers":true,"spans":[],"reveal":{"dir":[-0.24806946917841702,0.7442084075352506,-0.6201736729460423],"at":[2,-1,3],"focus":[[1,2,0],[3,-4,6]]}}
  },
  // Snowy mountains: long winter walks between snowy columns.
  {
    name:'Sleigh Ride',fresh:true,
    hint:'Look past the columns, then ride.',
    frames:1,palette:10,
    view:{yaw:35,pitch:30},
    // Found by search and checked by illusion-solver.mjs.
    blocks:[...walk(-2,-3,3,-1,0,2),stair(-4,-3,3,1,0),...walk(-4,2,5,0,-1,1),stair(-4,2,4,0,1),...walk(1,0,3,1,0,1),...run(1,-2,0,-1,0,4),...column(4,0,2,2),...column(-1,-1,2,2)],
    movers:[
      {blocks:[...run(-2,5,6,0,-1,4)],pivot:[-2,5,6],angle:-90,positions:2,trigger:[-3,-3,3]},
      {blocks:[...run(3,2,-1,0,-1,4)],pivot:[3,2,-1],angle:-90,positions:2,trigger:[-2,-2,0]}
    ],
    start:[1,-2,0],goal:[-4,2,5]
  },
  {
    name:'Snow Pines',
    hint:'Back over the snow you came by.',
    frames:1,palette:10,
    view:{yaw:35,pitch:30},
    // Found by search and checked by illusion-solver.mjs.
    blocks:[...walk(6,-1,7,0,-1,2),...walk(0,1,-1,0,-1,1),stair(0,2,-2,0,-1),...walk(-3,-1,-3,0,1,2),...column(2,5,3,1),...column(4,2,4,2)],
    movers:[
      {blocks:[...walk(-4,-3,-4,-1,0,3)],pivot:[-4,-3,-4],angle:90,positions:4,trigger:[-4,-1,0]},
      {blocks:[...walk(-5,-1,0,1,0,4)],pivot:[-5,-1,0],angle:-90,positions:2,trigger:[6,-1,6]}
    ],
    start:[0,1,-1],goal:[-3,-1,-2]
  },
  {
    name:'Long Winter',
    hint:'One crossing at a time.',
    frames:1,palette:10,
    view:{yaw:35,pitch:30},
    // Found by search and checked by illusion-solver.mjs.
    blocks:[...walk(-4,7,-5,1,0,1),...walk(3,-4,4,0,-1,4),stair(3,-4,0,0,1),...walk(3,-5,-1,0,-1,1),...walk(1,-1,3,0,1,1),stair(1,-1,4,0,-1),...walk(1,-2,5,0,1,2),...walk(1,0,-2,-1,0,4),...run(1,3,-5,1,0,2),stair(3,4,-5,1,0),...run(4,4,-5,1,0,2),...walk(-1,-4,-1,1,0,1),...column(-5,2,4,1),...column(-1,-1,-5,1)],
    movers:[
      {blocks:[...walk(-4,4,2,0,-1,3)],pivot:[-4,4,2],angle:90,positions:2,trigger:[3,-4,1]}
    ],
    start:[1,0,-2],goal:[-1,-4,-1]
  },
  {
    // Platform placement checked with exact joins; original shortest solution length retained.
    name:"Woodsmoke",
    hint:"A long walk. Look again after every turn.",
    frames:1,
    palette:10,
    view:{"yaw":35,"pitch":30},
    blocks:[[1,3,-3,"rail",-1,0],[0,4,-3,"stair",-1,0],[4,3,0,"rail",-1,0],[3,3,0,"rail",-1,0],[2,3,0,"rail",-1,0],[1,3,0,"rail",-1,0],[-5,-1,1,"rail",0,1],[-5,-1,2,"stair",0,-1],[3,-1,2,"rail",1,0],[4,0,2,"stair",1,0],[5,0,2,"rail",1,0],[6,0,2,"rail",1,0],[1,-6,-2,"rail",0,-1],[1,-6,-3,"rail",0,-1],[1,-6,-4,"rail",0,-1],[1,-6,-5,"rail",0,-1],[1,-5,-6,"stair",0,-1],[1,-5,-7,"rail",0,-1],[1,-5,-8,"rail",0,-1],[-3,1,3,"column"],[-3,2,3,"column"],[-3,3,3,"column"],[3,5,1,"column"],[3,6,1,"column"],[3,7,1,"column"]],
    movers:[{"blocks":[[-3,4,-7],[-3,4,-8],[-3,4,-9],[-3,4,-10]],"pivot":[-3,4,-7],"angle":90,"positions":2,"trigger":[-5,-1,1]},{"blocks":[[-1,0,-1,"rail",1,0],[0,0,-1,"rail",1,0],[1,0,-1,"rail",1,0]],"pivot":[-1,0,-1],"angle":-90,"positions":4,"trigger":[1,-6,-4]}],
    start:[1,3,-3],
    goal:[1,3,0]
  },
  {
    name:'Snowdrift',
    hint:'Ride, walk back, and ride again.',
    frames:1,palette:10,
    view:{yaw:35,pitch:30},
    // Found by search and checked by illusion-solver.mjs.
    blocks:[...walk(1,2,-5,1,0,4),stair(5,2,-5,-1,0),...walk(2,-2,-1,-1,0,4),...walk(-3,4,-7,1,0,1),stair(-2,4,-7,-1,0),...walk(-1,3,-7,1,0,2),...walk(-2,-3,-6,1,0,3),...run(4,-3,6,0,1,4),stair(4,-2,10,0,1),...run(4,-2,11,0,1,2),...column(-5,7,2,1),...column(0,4,0,1)],
    movers:[
      {blocks:[...walk(4,-1,3,0,1,4)],pivot:[4,-1,3],angle:90,positions:2,trigger:[0,-3,-6]},
      {blocks:[...walk(5,4,0,0,-1,3),stair(5,5,-3,0,-1)],pivot:[5,4,0],angle:90,positions:4,trigger:[5,4,-1]}
    ],
    start:[4,-2,12],goal:[2,-2,-1]
  },
  // Ice palace: riding beams across the ice.
  {
    // Platform placement checked with exact joins; original shortest solution length retained.
    name:"Frozen Lake",
    fresh:true,
    hint:"Ride, look, ride again.",
    frames:2,
    palette:9,
    view:{"yaw":35,"pitch":30},
    blocks:[[0,-3,5,"rail",0,1],[0,-3,6,"rail",0,1],[3,-3,-6,"rail",1,0],[4,-3,-6,"rail",1,0],[5,-3,-6,"rail",1,0],[6,-2,-6,"stair",1,0],[7,-2,-6,"rail",1,0],[3,1,5,"rail",1,0],[4,1,5,"rail",1,0],[5,1,5,"rail",1,0],[6,1,5,"rail",1,0],[7,2,5,"stair",1,0],[8,2,5,"rail",1,0],[9,2,5,"rail",1,0],[0,-2,-2,"rail",-1,0],[-1,-2,-2,"rail",-1,0],[-2,-1,-2,"stair",-1,0],[-3,-1,-2,"rail",-1,0],[-4,-1,-2,"rail",-1,0]],
    movers:[{"blocks":[[-5,-4,2,"rail",1,0],[-4,-4,2,"rail",1,0],[-3,-4,2,"rail",1,0],[-2,-4,2,"rail",1,0]],"pivot":[-5,-4,2],"angle":90,"positions":4,"trigger":[-4,-4,2]},{"blocks":[[-2,1,-5,"rail",-1,0],[-3,1,-5,"rail",-1,0],[-4,1,-5,"rail",-1,0]],"pivot":[-2,1,-5],"angle":90,"positions":2,"trigger":[5,-3,-6]}],
    start:[-4,-1,-2],
    goal:[0,-3,5]
  },
  {
    // Platform placement checked with exact joins; original shortest solution length retained.
    name:"Glacier",
    hint:"Four rides. Look again after each one.",
    frames:1,
    palette:9,
    view:{"yaw":35,"pitch":30},
    blocks:[[2,-5,-10,"rail",-1,0],[1,-5,-10,"rail",-1,0],[0,-5,-10,"rail",-1,0],[-1,-5,-10,"rail",-1,0],[-2,-5,-10,"stair",1,0],[-3,-6,-10,"rail",-1,0],[-7,-1,-2,"rail",0,1],[-7,-1,-1,"rail",0,1],[-7,-1,0,"stair",0,-1],[-10,0,-4,"rail",-1,0],[-11,0,-4,"rail",-1,0],[-12,1,-4,"stair",-1,0],[-13,1,-4,"rail",-1,0],[-14,1,-4,"rail",-1,0],[4,0,3,"rail",0,1],[4,1,4,"stair",0,1],[4,1,5,"rail",0,1]],
    movers:[{"blocks":[[6,4,3,"rail",-1,0],[5,4,3,"rail",-1,0],[4,4,3,"rail",-1,0],[3,4,3,"rail",-1,0]],"pivot":[6,4,3],"angle":-90,"positions":4,"trigger":[4,4,3]},{"blocks":[[-2,3,0],[-2,3,1],[-2,3,2],[-2,4,3,"stair",0,1]],"pivot":[-2,3,0],"angle":-90,"positions":2,"trigger":[-7,-1,-2]}],
    start:[-3,-6,-10],
    goal:[4,1,5]
  },
  {
    // Campaign lifts and hidden-stone paths, checked with the shared solver.
    name:"Clear Ice",
    hint:"Photograph the pillar to open the ice passage.",
    frames:1,
    palette:9,
    view:{"yaw":35,"pitch":30},
    blocks:[[4,-3,-6,"rail",1,0],[5,-3,-6,"stair",-1,0],[6,-4,-6,"rail",1,0],[7,-4,-6,"rail",1,0],[0,-5,2,"rail",0,-1],[0,-5,1,"rail",0,-1],[0,-5,0,"rail",0,-1],[0,-5,-1,"stair",0,1],[-3,-1,2,"rail",0,-1],[-3,-1,1,"rail",0,-1],[3,-1,-5,"rail",-1,0],[2,-1,-5,"rail",-1,0],[-4,-1,-2,"rail",-1,0],[-5,-1,-2,"rail",-1,0],[-6,-1,-2,"rail",-1,0],[-7,-1,-2,"stair",1,0],[-8,-2,-2,"rail",-1,0],[-2,-1,1,"column"],[-2,0,1,"column"],[-2,1,1,"column"]],
    movers:[{"blocks":[[0,-1,5,"rail",-1,0],[-1,-1,5,"rail",-1,0],[-2,-1,5,"rail",-1,0],[-3,-1,5,"rail",-1,0]],"pivot":[0,-1,5],"angle":-90,"positions":4,"trigger":[-2,-1,5]},{"blocks":[[5,2,-3,"rail",-1,0],[4,2,-3,"rail",-1,0],[3,2,-3,"rail",-1,0],[2,2,-3,"rail",-1,0]],"pivot":[5,2,-3],"angle":90,"positions":2,"trigger":[0,-5,2]}],
    start:[4,-3,-6],
    goal:[-3,-1,2],
    shy:[[-3,0,1]]
  },
  {
    name:'Skating',
    hint:'Round the pond and back.',
    frames:1,palette:9,
    view:{yaw:35,pitch:30},
    // Found by search and checked by illusion-solver.mjs.
    blocks:[...walk(3,-5,-6,-1,0,4),stair(-1,-5,-6,1,0),...walk(-2,-6,-6,-1,0,1),...walk(-9,-1,-1,0,1,2),stair(-9,-1,1,0,-1),...walk(-9,-2,2,0,1,1),...walk(5,-2,-4,0,-1,1),stair(5,-2,-5,0,1),...walk(5,-3,-6,0,-1,1),...walk(-4,1,-4,-1,0,1),...walk(1,-2,2,0,1,4),stair(1,-1,6,0,1)],
    movers:[
      {blocks:[...walk(5,2,5,0,-1,4),stair(5,3,1,0,-1)],pivot:[5,2,5],angle:-90,positions:4,trigger:[5,2,2]},
      {blocks:[...run(-3,2,0,0,1,3),stair(-3,3,3,0,1)],pivot:[-3,2,0],angle:-90,positions:4,trigger:[-9,-2,2]}
    ],
    start:[-4,1,-4],goal:[1,-2,2]
  },
  {
    // Platform placement checked with exact joins; original shortest solution length retained.
    name:"Northern Lights",
    hint:"Look from high above, and from low down.",
    frames:1,
    palette:9,
    view:{"yaw":35,"pitch":30},
    blocks:[[3,-5,-6,"rail",-1,0],[2,-5,-6,"rail",-1,0],[1,-5,-6,"rail",-1,0],[0,-5,-6,"stair",1,0],[11,-1,-2,"rail",0,-1],[11,-1,-3,"rail",0,-1],[11,-1,-4,"rail",0,-1],[11,-1,-5,"rail",0,-1],[-9,1,-6,"rail",-1,0],[-10,1,-6,"rail",-1,0],[-11,1,-6,"stair",1,0],[1,0,1,"rail",0,1],[1,0,2,"rail",0,1],[1,0,3,"rail",0,1]],
    movers:[{"blocks":[[4,2,3,"rail",0,-1],[4,2,2,"rail",0,-1],[4,2,1,"rail",0,-1],[4,2,0,"rail",0,-1]],"pivot":[4,2,3],"angle":90,"positions":4,"trigger":[4,2,2]},{"blocks":[[-3,2,0],[-3,2,1],[-3,2,2],[-3,3,3,"stair",0,1]],"pivot":[-3,2,0],"angle":90,"positions":2,"trigger":[3,-5,-6]}],
    start:[-10,1,-6],
    goal:[1,0,3]
  },
  // Glow forest: beams that carry stairs.
  {
    // Rail entrances leave a visible opening at the exact connection views.
    name:"Fireflies",
    fresh:true,
    hint:"The stairs turn with the beam.",
    frames:1,
    palette:11,
    view:{"yaw":35,"pitch":30},
    blocks:[[-5,-1,4,"rail",-1,0],[-6,0,4,"stair",-1,0],[-7,0,4,"rail",-1,0],[2,-1,-6,"rail",-1,0],[1,-1,-6,"rail",-1,0],[0,0,-6,"stair",-1,0],[-1,0,-6,"rail",-1,0],[-2,0,-6,"rail",-1,0],[-4,0,-2,"rail",-1,0],[-5,0,-2,"stair",1,0],[0,-1,0,"rail",1,0],[1,-1,0,"rail",1,0],[2,-1,0,"rail",1,0],[3,-1,0,"stair",-1,0],[4,-2,0,"rail",1,0],[5,-2,0,"rail",1,0]],
    movers:[{"blocks":[[-2,-1,2,"rail",0,1],[-2,-1,3,"rail",0,1],[-2,-1,4,"rail",0,1],[-2,0,5,"stair",0,1]],"pivot":[-2,-1,2],"angle":-90,"positions":2,"trigger":[-4,0,-2]},{"blocks":[[3,7,2,"rail",-1,0],[2,7,2,"rail",-1,0],[1,7,2,"rail",-1,0],[0,8,2,"stair",-1,0]],"pivot":[3,7,2],"angle":90,"positions":4,"trigger":[1,-1,0]}],
    start:[-7,0,4],
    goal:[2,-1,-6],
    railScale:0.8
  },
  {
    // Campaign lifts and hidden-stone paths, checked with the shared solver.
    name:"Glow Worms",
    hint:"A pearl stone guards the forest control.",
    frames:1,
    palette:11,
    view:{"yaw":35,"pitch":30},
    blocks:[[-1,-3,4],[0,-3,4],[1,-3,4],[2,-3,4,"stair",-1,0],[3,-4,4],[0,2,1,"rail",-1,0],[-1,2,1,"rail",-1,0],[-2,2,1,"rail",-1,0],[-3,2,1,"rail",-1,0],[-4,2,1,"stair",1,0],[4,0,2,"rail",0,1],[1,-4,-5,"rail",0,1],[1,-4,-4,"rail",0,1],[1,-4,-3,"rail",0,1],[-1,-3,3,"column"],[-1,-2,3,"column"],[-1,-1,3,"column"]],
    movers:[{"blocks":[[-2,-1,-6],[-2,-1,-5],[-2,-1,-4],[-2,0,-3,"stair",0,1]],"pivot":[-2,-1,-6],"angle":90,"positions":4,"trigger":[-2,-1,-4]},{"blocks":[[9,4,0,"rail",0,-1],[9,4,-1,"rail",0,-1],[9,4,-2,"rail",0,-1],[9,5,-3,"stair",0,-1]],"pivot":[9,4,0],"angle":-90,"positions":4,"trigger":[-1,-3,4]}],
    start:[1,-4,-5],
    goal:[-3,2,1],
    shy:[[-1,-2,4]]
  },
  {
    name:'Mushroom Ring',
    hint:'Two turning stairs. Take them in turn.',
    frames:1,palette:11,
    view:{yaw:35,pitch:30},
    // Found by search and checked by illusion-solver.mjs.
    // Two railed landings preserve the turning-stair route while other open side joins remain valid.
    blocks:[...walk(-1,4,1,1,0,1),...walk(-4,-1,1,0,1,1),...run(6,3,1,0,-1,2),stair(6,4,-1,0,-1),...walk(-2,-1,-3,0,-1,4),...run(3,-1,4,0,-1,2),...walk(3,-1,2,0,-1,2),stair(3,-1,0,0,1)],
    movers:[
      {blocks:[...walk(-4,-3,-5,-1,0,4),stair(-8,-2,-5,-1,0)],pivot:[-4,-3,-5],angle:90,positions:4,trigger:[3,-1,4]},
      {blocks:[...walk(-2,1,3,1,0,3),stair(1,2,3,1,0)],pivot:[-2,1,3],angle:90,positions:4,trigger:[-2,-1,-3]}
    ],
    start:[-1,4,1],goal:[-4,-1,1]
  },
  {
    // Platform placement checked with exact joins; original shortest solution length retained.
    name:"Moss Lamp",
    hint:"Up one stair, back down the other.",
    frames:1,
    palette:11,
    view:{"yaw":35,"pitch":30},
    blocks:[[2,-1,4,"rail",0,1],[2,-1,5,"rail",0,1],[2,-1,6,"rail",0,1],[1,1,2,"rail",0,1],[1,1,3,"rail",0,1],[1,1,4,"rail",0,1],[1,1,5,"rail",0,1],[1,2,-5,"rail",-1,0],[0,2,-5,"rail",-1,0],[-7,1,0],[-7,1,1],[-7,2,2,"stair",0,1],[-7,2,3]],
    movers:[{"blocks":[[-3,1,0,"rail",0,1],[-3,1,1,"rail",0,1],[-3,1,2,"rail",0,1],[-3,2,3,"stair",0,1]],"pivot":[-3,1,0],"angle":90,"positions":2,"trigger":[2,-1,6]},{"blocks":[[-5,4,-5,"rail",1,0],[-4,4,-5,"rail",1,0],[-3,4,-5,"rail",1,0],[-2,5,-5,"stair",1,0]],"pivot":[-5,4,-5],"angle":90,"positions":2,"trigger":[-3,1,1]}],
    start:[0,2,-5],
    goal:[1,1,5]
  },
  {
    name:'Night Garden',
    hint:'A little at a time.',
    frames:1,palette:11,
    view:{yaw:35,pitch:30},
    // Found by search and checked by illusion-solver.mjs.
    blocks:[...walk(4,5,-5,-1,0,4),...run(6,-3,-5,-1,0,1),stair(5,-2,-5,-1,0),...walk(5,0,-3,0,-1,2),stair(5,1,-5,0,-1),...walk(5,1,-6,0,-1,1),...run(-5,-1,0,-1,0,1),stair(-6,0,0,-1,0),...walk(5,-3,4,0,-1,1),...walk(0,7,6,0,-1,4),stair(0,8,2,0,-1)],
    movers:[
      {blocks:[...walk(0,4,1,1,0,3),stair(3,5,1,1,0)],pivot:[0,4,1],angle:-90,positions:4,trigger:[5,-3,4]},
      {blocks:[...run(-1,-2,5,0,1,3),stair(-1,-1,8,0,1)],pivot:[-1,-2,5],angle:-90,positions:2,trigger:[0,7,3]}
    ],
    start:[4,5,-5],goal:[6,-3,-5]
  },
  // Cloud kingdom: floating courtyards and three-beam puzzles.
  {
    // Authored progression pass: every open edge still follows the shared exact geometry rules.
    name:"Relativity",
    title:"Cloud Courtyard",
    set:true,
    frames:1,
    palette:12,
    view:{"yaw":25,"pitch":28},
    blocks:[[0,-2,-4,"rail",0,1,"end"],[0,-2,-3,"rail",0,1],[-4,2,0,"rail",1,0,"end"],[-3,2,0,"rail",1,0],[2,2,4,"rail",0,1],[2,2,5,"rail",0,-1,"end"],[-5,-3,6,"rail",1,0],[-4,-3,6,"rail",-1,0,"end"]],
    start:[0,-2,-4],
    goal:[-4,-3,6],
    composition:{"kind":"cloud-courtyard","archMovers":true,"spans":[{"a":[0,-2,-4],"b":[0,-2,-3]},{"a":[-4,2,0],"b":[-3,2,0]},{"a":[2,2,4],"b":[2,2,5]},{"a":[-5,-3,6],"b":[-4,-3,6]}]},
    movers:[{"blocks":[[0,0,0,"rail",0,1],[0,0,1,"rail",0,1],[0,0,2,"rail",0,1],[0,0,3,"rail",0,-1,"end"]],"pivot":[0,0,0],"angle":90,"positions":2,"trigger":[0,0,3]},{"blocks":[[2,4,0,"rail",1,0],[3,4,0,"rail",1,0],[4,4,0,"rail",1,0],[5,4,0,"rail",-1,0,"end"]],"pivot":[2,4,0],"angle":90,"positions":2,"trigger":[5,4,0]},{"blocks":[[-9,-1,0,"rail",0,-1],[-9,-1,-1,"rail",0,-1],[-9,-1,-2,"rail",0,-1],[-9,-1,-3,"rail",0,1,"end"]],"pivot":[-9,-1,0],"angle":90,"positions":2,"trigger":[-9,-1,-3]}],
    hint:"Three galleries, three transfers."
  },
  {
    name:'Three Winds',
    composition:{archMovers:true},fresh:true,
    hint:'Three beams. Find which one goes first.',
    frames:1,palette:12,
    view:{yaw:35,pitch:30},
    // Found by search and checked by illusion-solver.mjs.
    blocks:[...walk(-1,-1,3,0,-1,4),stair(-1,0,-1,0,-1),...walk(0,5,0,1,0,2),stair(2,6,0,1,0),...walk(3,6,0,1,0,2),...run(3,-1,1,-1,0,1),...walk(-4,3,0,0,-1,4),stair(-4,4,-4,0,-1)],
    movers:[
      // A rail on this moving landing keeps the three-beam sequence necessary.
      {blocks:[[2,2,5],[2,2,4,'rail',0,-1],...run(2,2,3,0,-1,2)],pivot:[2,2,5],angle:-90,positions:2,trigger:[3,-4,-2]},
      {blocks:[...run(5,-1,-1,0,-1,3)],pivot:[5,-1,-1],angle:90,positions:2,trigger:[0,5,0]},
      {blocks:[...walk(4,-4,-2,-1,0,3)],pivot:[4,-4,-2],angle:90,positions:4,trigger:[2,2,2]}
    ],
    start:[-4,3,-3],goal:[-1,-1,0]
  },
  {
    // Platform placement checked with exact joins; original shortest solution length retained.
    name:"Above the Clouds",
    hint:"Three beams, one way through.",
    frames:1,
    palette:12,
    view:{"yaw":35,"pitch":30},
    blocks:[[1,-2,-8],[0,-2,-8],[-1,-2,-8],[-2,-2,-8],[11,-4,0,"rail",0,1],[11,-4,1,"rail",0,1],[11,-4,2,"rail",0,1],[11,-4,3,"stair",0,-1],[2,-2,2],[1,-2,2],[0,-2,2],[-1,-2,2],[4,2,-5,"rail",-1,0],[3,2,-5,"rail",-1,0],[2,2,-5,"rail",-1,0],[1,2,-5,"stair",1,0],[0,1,-5,"rail",-1,0],[-1,1,-5,"rail",-1,0]],
    movers:[{"blocks":[[-7,5,2,"rail",0,-1],[-7,5,1,"rail",0,-1],[-7,5,0,"rail",0,-1],[-7,5,-1,"rail",0,-1]],"pivot":[-7,5,2],"angle":-90,"positions":2,"trigger":[3,2,-5]},{"blocks":[[-4,-1,-1],[-4,-1,0],[-4,-1,1],[-4,-1,2]],"pivot":[-4,-1,-1],"angle":-90,"positions":4,"trigger":[0,-2,-8]},{"blocks":[[3,0,1,"rail",-1,0],[2,0,1,"rail",-1,0],[1,0,1,"rail",-1,0]],"pivot":[3,0,1],"angle":90,"positions":2,"trigger":[0,1,-5]}],
    start:[-2,-2,-8],
    goal:[11,-4,2]
  },
  {
    name:'High Garden',
    title:'Cloud Arcade',hint:'One view completes the arcade.',
    frames:1,palette:12,
    view:{yaw:35,pitch:30},
    // After the three-beam sequence, one photo closes all three gaps of the broken arcade.
    composition:{kind:'cloud-arcade',spans:[{a:[-8,1,2],b:[-8,1,4]},{a:[-10,2,6],b:[-10,2,7]},{a:[-12,3,9],b:[-12,3,10]}],reveal:{dir:[-2,1,1],at:[-10,2,6],zoom:4.8}},
    blocks:[...walk(-4,-2,5,1,0,3),...walk(-8,1,4,0,-1,3),...walk(3,0,1,-1,0,3),...run(4,0,-6,-1,0,3),
      ...walk(-10,2,6,0,1,2),[-12,3,9,'rail',0,1],[-12,3,10,'rail',0,-1,'end']],
    movers:[
      {blocks:[...run(-4,-1,-1,1,0,3),stair(-1,0,-1,1,0)],pivot:[-4,-1,-1],angle:-90,positions:4,trigger:[-3,1,-6]},
      {blocks:[...walk(-4,1,-6,1,0,4)],pivot:[-4,1,-6],angle:90,positions:2,trigger:[2,0,-6]},
      {blocks:[...walk(0,3,7,0,1,4)],pivot:[0,3,7],angle:-90,positions:2,trigger:[-2,-2,5]}
    ],
    start:[1,0,1],goal:[-12,3,10]
  },
  {
    // Terraces repositioned for visible, unobstructed crossings; solution length retained.
    name:"Cloud Palace",
    hint:"Three beams, one way through.",
    frames:1,
    palette:12,
    view:{"yaw":35,"pitch":30},
    blocks:[[0,-6,-6,"rail",0,1],[0,-6,-5,"rail",0,1],[0,-6,-4,"rail",0,1],[-4,2,-7,"rail",1,0],[-5,-1,0,"rail",1,0],[-4,0,0,"stair",1,0],[5,-4,0,"rail",1,0],[6,-4,0,"rail",1,0],[7,-4,0,"rail",1,0],[8,-4,0,"rail",1,0],[9,-4,0,"stair",-1,0],[10,-5,0,"rail",1,0],[11,-5,0,"rail",1,0],[3,-2,0,"rail",0,1],[3,-2,1,"rail",0,1],[3,-2,2,"rail",0,1],[3,-2,3,"rail",0,1]],
    movers:[{"blocks":[[-5,-3,0,"rail",0,-1],[-5,-3,-1,"rail",0,-1],[-5,-3,-2,"rail",0,-1],[-5,-2,-3,"stair",0,-1]],"pivot":[-5,-3,0],"angle":-90,"positions":4,"trigger":[-5,-1,0]},{"blocks":[[2,4,1,"rail",0,-1],[2,4,0,"rail",0,-1],[2,4,-1,"rail",0,-1],[2,4,-2,"rail",0,-1],[2,5,-3,"stair",0,-1]],"pivot":[2,4,1],"angle":-90,"positions":2,"trigger":[-5,-3,-1]},{"blocks":[[-5,3,4,"rail",0,-1],[-5,3,3,"rail",0,-1],[-5,3,2,"rail",0,-1],[-5,3,1,"rail",0,-1]],"pivot":[-5,3,4],"angle":90,"positions":4,"trigger":[-5,3,2]}],
    start:[3,-2,0],
    goal:[11,-5,0]
  },
  // The stars: everything so far, on longer walks.
  {
    // Authored progression pass: every open edge still follows the shared exact geometry rules.
    name:"Impossible Triangle",
    set:true,
    hint:"Turn both arms to complete the triangle.",
    frames:1,
    palette:4,
    view:{"yaw":45,"pitch":30},
    blocks:[[8,0,1,"rail",0,1],[8,0,2,"rail",0,1],[8,0,3,"rail",0,1],[7,1,8,"stair",-1,0],[6,1,8,"rail",1,0,"turn",0,-1],[6,2,7,"stair",0,-1],[6,2,6,"rail",0,1,"turn",-1,0],[5,3,6,"stair",-1,0],[4,3,6,"rail",1,0,"turn",0,-1],[4,4,5,"stair",0,-1],[4,4,4,"rail",0,1],[-1,-2,-2,"rail",1,0],[0,-2,-2,"rail",1,0],[1,-2,-2,"rail",1,0],[2,-2,-2,"rail",1,0],[0,0,-1,"rail",0,1,"end"],[-4,0,-2,"rail",1,0,"end"],[-3,0,-2,"rail",1,0]],
    start:[-4,0,-2],
    goal:[0,0,-1],
    movers:[{"blocks":[[8,0,0,"rail",-1,0,"turn",0,-1],[8,0,-1,"rail",0,-1],[8,0,-2,"rail",0,-1],[8,0,-3,"rail",0,-1]],"pivot":[8,0,0],"angle":90,"positions":2,"trigger":[8,0,-3]},{"blocks":[[8,0,8,"rail",1,0,"turn",0,-1],[9,0,8,"rail",1,0],[10,0,8,"rail",1,0],[11,0,8,"rail",1,0],[12,0,8,"rail",1,0]],"pivot":[8,0,8],"angle":90,"positions":2,"trigger":[8,0,2]}],
    composition:{"kind":"triangle","archMovers":true,"spans":[{"a":[8,0,0],"b":[8,0,3]}],"reveal":{"dir":[1,1,1],"at":[4,1,3],"zoom":6.8}}
  },
  {
    // Terraces repositioned for visible, unobstructed crossings; solution length retained.
    name:"Sky Bridge",
    fresh:true,
    hint:"Turn the beams in the right order.",
    frames:2,
    palette:4,
    view:{"yaw":-40,"pitch":30},
    blocks:[[-1,-3,1,"rail",-1,0],[-2,-2,1,"stair",-1,0],[-1,3,1,"rail",1,0],[0,3,1,"rail",1,0],[6,-1,2,"rail",0,1],[6,-1,3,"rail",0,1],[6,-1,4,"rail",0,1],[6,-1,5,"rail",0,1],[4,-1,-1],[4,-1,-2,"stair",0,1]],
    movers:[{"blocks":[[4,-4,-5,"rail",0,1],[4,-4,-4,"rail",0,1],[4,-4,-3,"rail",0,1],[4,-4,-2,"rail",0,1]],"pivot":[4,-4,-5],"angle":-90,"positions":4,"trigger":[-1,1,5]},{"blocks":[[0,1,5,"rail",-1,0],[-1,1,5,"rail",-1,0],[-2,1,5,"rail",-1,0],[-3,1,5,"rail",-1,0]],"pivot":[0,1,5],"angle":-90,"positions":4,"trigger":[4,-4,-3]}],
    start:[-1,-3,1],
    goal:[6,-1,2],
    railScale:0.9
  },
  {
    name:'Shooting Star',
    hint:'Plan a little, then go.',
    frames:1,palette:4,
    view:{yaw:35,pitch:30},
    // Found by search and checked by illusion-solver.mjs.
    blocks:[...walk(-8,-1,1,0,1,1),stair(-8,-1,2,0,-1),...run(5,-1,-5,0,-1,4),...walk(-5,1,-5,1,0,4),stair(-1,1,-5,-1,0),...walk(2,-2,2,0,1,3)],
    movers:[
      {blocks:[...walk(4,2,4,-1,0,4),stair(0,3,4,-1,0)],pivot:[4,2,4],angle:90,positions:2,trigger:[-2,3,3]},
      {blocks:[...run(-2,3,1,0,1,3),stair(-2,4,4,0,1)],pivot:[-2,3,1],angle:-90,positions:4,trigger:[-8,-1,1]}
    ],
    start:[-2,1,-5],goal:[2,-2,2]
  },
  {
    // Authored progression pass: every open edge still follows the shared exact geometry rules.
    name:"Constellation",
    hint:"Two photos, columns and beams. Join the dots.",
    frames:2,
    palette:4,
    view:{"yaw":35,"pitch":30},
    blocks:[[5,0,5,"rail",0,-1],[5,0,4,"rail",0,-1],[5,0,3,"rail",0,-1],[5,0,2,"rail",0,-1],[5,1,1,"stair",0,-1],[5,1,0,"rail",0,-1],[-3,0,-3,"rail",0,-1],[-3,1,-4,"stair",0,-1],[1,-3,3,"rail",0,1],[1,-3,4,"rail",0,1],[1,-3,5,"rail",0,1],[1,-3,6,"rail",0,1],[1,-2,7,"stair",0,1],[1,-2,8,"rail",0,1],[-2,-3,-1,"rail",0,-1],[-2,-3,-2,"stair",0,1],[-2,-4,-3,"rail",0,-1],[-2,-4,-4,"rail",0,-1],[-2,0,-1,"column"],[-2,1,-1,"column"],[-2,2,-1,"column"]],
    movers:[{"blocks":[[-4,0,1,"rail",0,-1],[-4,0,0,"rail",0,-1],[-4,0,-1,"rail",0,-1]],"pivot":[-4,0,1],"angle":90,"positions":4,"trigger":[-4,0,-1]},{"blocks":[[4,4,-2,"rail",0,1],[4,4,-1,"rail",0,1],[4,4,0,"rail",0,1],[4,5,1,"stair",0,1]],"pivot":[4,4,-2],"angle":90,"positions":4,"trigger":[5,0,5]}],
    start:[-2,-4,-4],
    goal:[-3,0,-3]
  },
  {
    name:'Long Way Home',
    hint:'Everything at once.',
    frames:1,palette:4,
    view:{yaw:-30,pitch:30},
    // Found by search and checked by illusion-solver.mjs: the shortest solution is 25 moves, with no dead ends.
    blocks:[...walk(3,-9,-9,-1,0,4),...walk(-8,-4,-4,0,1,3),stair(-8,-4,-1,0,-1),...walk(-8,-5,0,0,1,1),...walk(-1,-2,0,0,1,2),stair(-1,-2,2,0,-1),...walk(-1,-3,3,0,1,2),...run(-10,0,-5,0,1,4),...walk(7,0,2,0,1,2)],
    movers:[
      {blocks:[...walk(6,2,2,-1,0,4),stair(2,3,2,-1,0)],pivot:[6,2,2],angle:-90,positions:4,trigger:[5,2,2]},
      {blocks:[...run(-3,2,0,0,1,3),stair(-3,3,3,0,1)],pivot:[-3,2,0],angle:90,positions:2,trigger:[-8,-4,-4]}
    ],
    start:[-1,-2,0],goal:[7,0,2]
  },
  // Space: orbits: beams that swing out into the dark.
  {
    // Authored progression pass: every open edge still follows the shared exact geometry rules.
    name:"Carousel",
    fresh:true,
    hint:"The inner beam controls the outer dock.",
    frames:1,
    palette:13,
    view:{"yaw":40,"pitch":30},
    blocks:[[-3,-2,-3],[-4,-2,-3],[-5,-2,-3],[0,-1,0,"rail",0,-1],[0,-1,-1,"rail",0,-1],[2,-2,-3,"rail",0,1],[2,-2,-2,"rail",0,1],[14,-2,-5,"rail",0,1],[14,-2,-4,"rail",0,1],[1,0,1,"rail",1,0],[2,0,1,"rail",1,0]],
    movers:[{"blocks":[[-4,-1,2,"rail",0,-1],[-4,-1,1,"rail",0,-1],[-4,-1,0,"rail",0,-1]],"pivot":[-4,-1,2],"angle":-90,"positions":4,"trigger":[-4,-1,0]},{"blocks":[[2,2,2,"rail",1,0],[3,2,2,"rail",1,0],[4,2,2,"rail",1,0],[5,2,2,"rail",-1,0,"end"]],"pivot":[2,2,2],"angle":-90,"positions":2,"trigger":[1,0,1]}],
    start:[-3,-2,-3],
    goal:[14,-2,-5],
    title:"Double Orbit"
  },
  {
    // Rail entrances leave a visible opening at the exact connection views.
    name:"Orbit",
    hint:"Find the view that brings the courts together.",
    frames:1,
    palette:13,
    view:{"yaw":35,"pitch":30},
    blocks:[[-2,2,-4,"rail",0,-1],[-2,2,-5,"stair",0,1],[-2,1,-6,"rail",0,-1],[6,1,1,"rail",0,1],[-5,3,0,"rail",-1,0],[-3,1,-1],[-3,1,0],[-3,1,1],[-3,1,2],[12,-1,8,"rail",0,1],[12,-1,9,"rail",0,-1,"turn",1,0],[16,-2,12,"rail",1,0],[17,-2,12,"rail",-1,0,"end"]],
    movers:[{"blocks":[[0,-3,-1,"rail",-1,0],[-1,-3,-1,"rail",-1,0],[-2,-3,-1,"rail",-1,0],[-3,-3,-1,"rail",-1,0]],"pivot":[0,-3,-1],"angle":-90,"positions":4,"trigger":[-3,1,1]},{"blocks":[[3,2,-3,"rail",-1,0],[2,2,-3,"rail",-1,0],[1,2,-3,"rail",-1,0],[0,3,-3,"stair",-1,0]],"pivot":[3,2,-3],"angle":-90,"positions":2,"trigger":[-5,3,0]}],
    start:[-2,1,-6],
    goal:[17,-2,12],
    composition:{"kind":"chapter-court","archMovers":true,"spans":[{"a":[12,-1,8],"b":[12,-1,9]},{"a":[16,-2,12],"b":[17,-2,12]}],"reveal":{"dir":[-0.6882472016116854,0.2294157338705618,-0.6882472016116853],"at":[11.666666666666666,-0.6666666666666666,7.333333333333333],"focus":[[6,1,1],[12,-1,8],[12,-1,9],[16,-2,12],[17,-2,12]],"yaw":0}},
    title:"Orbit",
    railScale:0.9
  },
  {
    // Exact joins retain the original three switches and two rides.
    name:"Planetrise",
    hint:"Watch both beams before you move.",
    frames:1,
    palette:13,
    view:{"yaw":-40,"pitch":30},
    blocks:[[-4,3,-1,"rail",0,1],[-4,3,0,"rail",0,1],[-4,4,1,"stair",0,1],[-4,-4,-3,"rail",1,0],[-3,-4,-3,"rail",1,0],[-2,-4,-3,"stair",-1,0],[-1,-5,-3,"rail",1,0],[0,3,-4],[0,3,-5],[0,3,-6,"stair",0,1],[0,2,-7],[-1,0,0,"rail",0,-1],[-1,0,-1,"rail",0,-1],[-1,0,-2,"stair",0,1],[-1,-1,-3,"rail",0,-1],[-1,-1,-4,"rail",0,-1],[-6,-1,6,"rail",0,-1],[-6,-1,5,"rail",0,-1],[-6,0,4,"stair",0,-1],[-6,0,3,"rail",0,-1],[-6,0,2,"rail",0,-1],[-4,1,-3],[-4,1,-2],[-4,1,-1]],
    movers:[{"blocks":[[4,3,-3,"rail",0,-1],[4,3,-4,"rail",0,-1],[4,3,-5,"rail",0,-1]],"pivot":[4,3,-3],"angle":-90,"positions":2,"trigger":[-1,-1,-4]},{"blocks":[[1,2,3,"rail",-1,0],[0,2,3,"rail",-1,0],[-1,2,3,"rail",-1,0]],"pivot":[1,2,3],"angle":90,"positions":2,"trigger":[0,2,3]}],
    start:[-4,3,-1],
    goal:[-4,-4,-3]
  },
  {
    name:'Moonwalk',
    hint:'Slowly. Each beam comes round again.',
    frames:1,palette:13,
    view:{yaw:35,pitch:30},
    // Found by search and checked by illusion-solver.mjs.
    blocks:[...walk(-4,-2,4,0,-1,3),stair(-4,-1,1,0,-1),...walk(-4,-1,0,0,-1,2),...walk(-5,-2,-4,-1,0,3),stair(-8,-2,-4,1,0),...walk(-5,1,5,0,1,2),...walk(-1,1,3,0,-1,3),...walk(-7,-1,5,0,1,1),stair(-7,-1,6,0,-1),...walk(-7,-2,7,0,1,1),...walk(2,1,4,0,1,4),stair(2,2,8,0,1),...walk(2,2,9,0,1,1)],
    movers:[
      {blocks:[...run(3,-2,1,1,0,3)],pivot:[3,-2,1],angle:90,positions:4,trigger:[-1,1,3]},
      {blocks:[...walk(4,0,-1,1,0,4),stair(8,1,-1,1,0)],pivot:[4,0,-1],angle:90,positions:4,trigger:[5,0,-1]}
    ],
    start:[2,1,4],goal:[-7,-2,-4]
  },
  {
    // Terraces repositioned for visible, unobstructed crossings; solution length retained.
    name:"Far Side",
    hint:"The last stop. Plan the order before you press.",
    frames:1,
    palette:13,
    view:{"yaw":35,"pitch":30},
    blocks:[[3,-3,-4,"rail",-1,0],[2,-3,-4,"rail",-1,0],[1,-3,-4,"rail",-1,0],[0,-3,-4,"stair",1,0],[-6,-1,0,"rail",0,1],[-6,-1,1,"rail",0,1],[-6,-1,2,"stair",0,-1],[0,0,3],[0,0,2],[0,0,1],[0,0,0,"stair",0,1],[0,-1,-1],[-4,-1,-5,"rail",-1,0],[0,-3,2,"rail",0,1],[0,-3,3,"rail",0,1],[0,-3,4,"rail",0,1],[0,-3,5,"rail",0,1]],
    movers:[{"blocks":[[6,3,5,"rail",1,0],[7,3,5,"rail",1,0],[8,3,5,"rail",1,0],[9,3,5,"rail",1,0],[10,4,5,"stair",1,0]],"pivot":[6,3,5],"angle":90,"positions":4,"trigger":[1,-3,-4]},{"blocks":[[-2,2,0],[-2,2,-1],[-2,2,-2]],"pivot":[-2,2,0],"angle":-90,"positions":4,"trigger":[-6,-1,1]}],
    start:[-4,-1,-5],
    goal:[0,-3,2],
    composition:{"kind":"chapter-finale","archMovers":true,"spans":[],"reveal":{"dir":[-0.5070925528371101,0.8451542547285165,-0.16903085094570341],"focus":[[0,-3,2],[0,-2.5,1.5],[-3,2.5,0.5]],"at":[-1,-1,1.3333333333333333]}}
  },
  ...LIFT_LEVELS
];

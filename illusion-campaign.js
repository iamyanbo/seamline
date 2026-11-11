// Presentation order is separate from stable level indices used by existing saves.
// Lift routes join familiar places at the corresponding point in their difficulty curve.
const INSERTIONS=new Map([
  ['Long Winter',['Seedling Lift']],
  ['Clear Ice',['Upper Conservatory','Service Shaft']],
  ['Northern Lights',['Split Shift']],
  ['Moss Lamp',['Reef Elevator']],
  ['Night Garden',['Pearl Gate']],
  ['High Garden',['Canopy Exchange','Pressure Hall','Balanced Boughs','Clockwork Crossing']],
  ['Shooting Star',['Undertow']],
  ['Long Way Home',['Glasshouse Summit']],
  ['Moonwalk',['Tidal Balance']],
  ['Far Side',['The Great Escapement','Sanctuary Ascent']]
]);
export function campaignOrder(levels){
  const byName=new Map(levels.map((L,i)=>[L.name,i])),inserted=new Set([...INSERTIONS.values()].flat()),order=[];
  for(const [i,L] of levels.entries()){
    if(inserted.has(L.name))continue;
    order.push(i);
    for(const name of INSERTIONS.get(L.name)??[])if(byName.has(name))order.push(byName.get(name));
  }
  // A standalone preview or a future campaign without an anchor still keeps every level.
  for(let i=0;i<levels.length;i++)if(!order.includes(i))order.push(i);
  return order;
}
export const campaignNumber=(order,index)=>order.indexOf(index)+1;


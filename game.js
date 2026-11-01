import {
  SAVE_KEY, CROP_GROW_MS, DECOR, QUESTS, createState, safeState, cropPhase,
  cropProgress, interactPlot, collectEgg, collectApple, sellGoods, buySeeds,
  addDecoration, removeLastDecoration, claimQuest, levelForXP, nextLevelPercent
} from './logic.js';

const $ = id => document.getElementById(id);
const dom = {
  viewport: $('viewport'), loading: $('loadingScreen'), modal: $('modalBackdrop'),
  modalTitle: $('modalTitle'), modalKicker: $('modalKicker'), modalContent: $('modalContent'),
  nearbyTitle: $('nearbyTitle'), nearbyHint: $('nearbyHint'), nearbyIcon: $('nearbyIcon'),
  interact: $('interactButton'), toast: $('toastWrap'),
};
let THREE;
try {
  THREE = await import('https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js');
} catch (err) {
  console.warn('Primary 3D library CDN unavailable. Trying backup.', err);
  THREE = await import('https://unpkg.com/three@0.180.0/build/three.module.js');
}

let saveData;
try { saveData = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); }
catch { saveData = null; }
const state = safeState(saveData);
const player = new THREE.Vector3(state.player.x, 0, state.player.z);
const world = new THREE.Scene();
world.background = new THREE.Color(0xa7d3d3);
world.fog = new THREE.FogExp2(0xa7d3d3, 0.012);
const camera = new THREE.PerspectiveCamera(64, 1, .08, 140);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference:'default' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
renderer.setSize(dom.viewport.clientWidth, dom.viewport.clientHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.27;
dom.viewport.appendChild(renderer.domElement);
const hemi = new THREE.HemisphereLight(0xe9f8ff, 0x69916e, 2.55);
world.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0c2, 2.6);
sun.position.set(-20, 33, 19);
sun.castShadow = true;
sun.shadow.mapSize.set(1024,1024);
sun.shadow.camera.left = -40; sun.shadow.camera.right = 40;
sun.shadow.camera.top = 40; sun.shadow.camera.bottom = -40;
sun.shadow.camera.near = 1; sun.shadow.camera.far = 100;
sun.shadow.bias = -0.00018;
world.add(sun);

const mat = (color, roughness=.9, metalness=0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
const M = {
  grass:mat(0x9fca91), grass2:mat(0x90bc80), soil:mat(0x77513d), soilDark:mat(0x624733),
  wood:mat(0xc09362), woodDark:mat(0x866549), leaf:mat(0x61996d), leaf2:mat(0x76ad78),
  leaf3:mat(0x85b781), gold:mat(0xffcd62), rose:mat(0xe99488), white:mat(0xfff5e5),
  shadow:mat(0x526d56), glass:mat(0x8cc9c3,.3), wall:mat(0xf0b9a2), roof:mat(0x967365),
  water:mat(0x74bdd0,.26), purple:mat(0x9d8ac1), green:mat(0x4f8e5d), stone:mat(0xb5b1a0),
};
function mesh(geo, material, parent=world) {
  const o = new THREE.Mesh(geo, material); o.castShadow = true; o.receiveShadow = true; parent.add(o); return o;
}
function box(w,h,d, material, x,y,z, parent=world) {
  const o=mesh(new THREE.BoxGeometry(w,h,d),material,parent); o.position.set(x,y,z); return o;
}
function ball(r, material, x,y,z, parent=world, ws=12, hs=8) {
  const o=mesh(new THREE.SphereGeometry(r,ws,hs),material,parent); o.position.set(x,y,z); return o;
}
function cyl(rt,rb,h, material, x,y,z, parent=world, seg=9) {
  const o=mesh(new THREE.CylinderGeometry(rt,rb,h,seg),material,parent); o.position.set(x,y,z); return o;
}
const rng = (()=>{let seed=82345;return ()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);})();

// Base terrain, footpaths, fence, flowers and hills.
box(96,.5,96,M.grass,0,-.28,0).receiveShadow=true;
const pathMat=mat(0xd7bc8e);
for(let i=0;i<18;i++) {
  const z=11-i*1.05;
  const step=box(2.8,.05,.82,pathMat,-5.5+(Math.sin(i*.18))*1.35,-.012,z);
  step.rotation.y=.13;
}
for(let i=0;i<24;i++){
  const x=-6+i*.54;
  box(.37,.03,.39,pathMat,x,-.01,8+(Math.sin(i*.4))*.1);
}
for(let i=0;i<95;i++){
  const x=(rng()-.5)*72, z=(rng()-.5)*72;
  if(Math.hypot(x,z)<11 || (x > 9 && x<20 && z>-14 && z<1) || (x<-6 && x>-19 && z<-5 && z>-18))continue;
  if(rng()<.62){
    const t=ball(.11+rng()*.09,rng()>.5?M.rose:M.white,x,.13,z,world,7,5);
    const stem=cyl(.04,.04,.25,M.leaf,x,.12,z,world,6);
  } else {
    const blade=cyl(.02,.05,.33,M.leaf2,x,.14,z,world,5);
    blade.rotation.z=(rng()-.5)*.6;
  }
}
function tree(x,z,scale=1,kind='oak'){
  const group = new THREE.Group(); group.position.set(x,0,z); group.scale.setScalar(scale); world.add(group);
  cyl(.32,.47,3.3,M.woodDark,0,1.65,0,group,8);
  if(kind==='pine'){
    for(let i=0;i<3;i++) {
      const cone=mesh(new THREE.ConeGeometry(1.5-i*.28,2.75,7),i===1?M.leaf2:M.leaf,group);
      cone.position.y=3+i*.82;
    }
  } else {
    ball(1.6,M.leaf,0,3.4,0,group);
    ball(1.28,M.leaf2,-.85,3.6,.4,group);
    ball(1.28,M.leaf3,.72,3.7,-.2,group);
    ball(1.04,M.leaf2,.5,4.5,.1,group);
  }
  return group;
}
for(let i=0;i<75;i++) {
  let x=(rng()-.5)*88,z=(rng()-.5)*88;
  if(Math.hypot(x,z)<24 || (x>14&&x<30&&z>11&&z<30)) continue;
  tree(x,z,.65+rng()*.65,rng()>.7?'pine':'oak');
}
// Small pond and bridge.
const pond = mesh(new THREE.CircleGeometry(7.9,40), M.water);
pond.rotation.x = -Math.PI/2; pond.scale.set(1.15,.86,1); pond.position.set(21,.018,20);
const pondBank=mesh(new THREE.RingGeometry(7.78,8.75,40),mat(0xe2d3a3));
pondBank.rotation.x=-Math.PI/2; pondBank.position.set(21,.008,20); pondBank.scale.set(1.15,.86,1);
for(let i=0;i<7;i++){
 const theta = i*Math.PI*2/7;
 const x=21+Math.cos(theta)*9,z=20+Math.sin(theta)*7.8;
 if(x<31&&z<32)tree(x,z,.62,'pine');
}
// Background gentle hills.
for(let i=0;i<9;i++){
 const a=i/9*Math.PI*2;
 const hill=mesh(new THREE.ConeGeometry(11+rng()*5,18+rng()*7,8),mat(i%2?0x85ae91:0x91b99d));
 hill.position.set(Math.cos(a)*74,4,Math.sin(a)*74);
 hill.rotation.y=a;
}
const clouds=[];
for(let i=0;i<8;i++){
 const cloud=new THREE.Group();
 const cm=mat(0xffffff);
 for(let c=0;c<4;c++)ball(1.6+(c%2)*.4,cm,c*1.6,0,(c%2)*.3,cloud,10,8);
 cloud.position.set((rng()-.5)*85,18+rng()*9,(rng()-.5)*75);
 cloud.scale.setScalar(.85+rng());world.add(cloud);clouds.push(cloud);
}
// Cottage and interior silhouette.
const house=new THREE.Group();house.position.set(-12,0,-11);world.add(house);
const houseWall=box(8,4.1,6.8,M.wall,0,2.1,0,house);
box(8.7,.3,7.3,M.white,0,.16,0,house);
const roof=mesh(new THREE.ConeGeometry(6.15,3,4),M.roof,house);
roof.rotation.y=Math.PI/4;roof.position.y=5.45;
box(1.5,2.6,.18,M.woodDark,0,1.45,3.53,house);
ball(.14,M.gold,.55,1.45,3.65,house);
for(let x of [-2.7,2.7]){
 box(1.35,1.42,.11,M.white,x,2.6,3.55,house);
 box(1.08,1.15,.15,M.glass,x,2.61,3.64,house);
 box(.09,1.27,.2,M.white,x,2.6,3.71,house);
 box(1.3,.09,.2,M.white,x,2.6,3.73,house);
}
box(.9,2.5,.8,M.roof,2.8,6.1,-1.5,house);
box(9,.2,2.8,M.wood,-.2,.13,4.25,house);
const roofFlower=ball(.38,M.rose,-3.8,.54,4.8,house);
// small walkway to door
for(let i=0;i<5;i++)box(1.45,.04,.66,pathMat,-12,.02,-5.2+i*.88);
// Small shop / wooden crate stand
const stall=new THREE.Group();stall.position.set(8,0,7);world.add(stall);
box(5,.5,2.5,M.wood,0,1.4,0,stall);
for(let x of [-2,2])for(let z of [-1,1])cyl(.12,.14,3.5,M.woodDark,x,1.75,z,stall);
const awning=box(5.8,.3,3.5,M.rose,0,3.6,0,stall);
for(let x of [-1.6,0,1.6])box(.72,.33,3.55,M.white,x,3.63,0,stall);
for(let x of [-1.4,0,1.4]){
 box(.95,.44,.9,M.woodDark,x,1.9,.1,stall);
 ball(.26,M.gold,x,2.24,.2,stall);
}
// shop name with no external textures: subtle cart sign icon geometry
ball(.25,M.gold,0,4.14,0,stall);
// Farm beds 4 × 3
const plotPlaces=[];
const plotModels=[];
for(let row=0;row<3;row++)for(let col=0;col<4;col++) {
  const x=-3.9+col*2.6,z=-8.1+row*2.55;
  plotPlaces.push({x,z});
  const g=new THREE.Group();g.position.set(x,.04,z);world.add(g);
  box(2.05,.18,1.86,M.woodDark,0,0,0,g);
  box(1.77,.2,1.56,M.soil,0,.08,0,g);
  for(let k=-1;k<=1;k++){
    const ridge=box(.12,.02,1.45,M.soilDark,k*.5,.195,0,g);
  }
  const crop=new THREE.Group();g.add(crop);
  plotModels.push({root:g,crop,phase:'',progress:-1});
}
function refreshPlots(now){
 for(let i=0;i<state.plots.length;i++){
  const phase=cropPhase(state.plots[i],now),p=plotModels[i];
  const percent=cropProgress(state.plots[i],now);
  const displayPhase= phase==='growing'?(percent<50?'sprout':'grown'):phase;
  if(displayPhase===p.phase)continue;
  p.phase=displayPhase;
  while(p.crop.children.length){
    const child=p.crop.children[0];p.crop.remove(child);
    child.traverse(x=>{if(x.isMesh)x.geometry.dispose();});
  }
  if(phase==='empty')continue;
  for(let j=0;j<5;j++) {
    const x=(j-2)*.32,z=(j%2?-.4:.39);
    if(phase==='ready'){
      const veg=mesh(new THREE.ConeGeometry(.23,.56,7),mat(0xed874b),p.crop);
      veg.rotation.x=Math.PI;veg.position.set(x,.40,z);
    }
    const stalk=cyl(.045,.055,displayPhase==='sprout'?.27:.47,M.leaf,x,displayPhase==='sprout'?.34:.53,z,p.crop,6);
    for(let a=0;a<3;a++){
      const leaf=ball(displayPhase==='sprout'?.11:.23,a%2?M.leaf2:M.leaf3,x+Math.cos(a*2.1)*.18,displayPhase==='sprout'?.48:.72,z+Math.sin(a*2.1)*.16,p.crop,7,5);
      leaf.scale.set(1,.45,.7);
    }
  }
 }
}
// Chickens, pen and nests
const coop=new THREE.Group();coop.position.set(15,0,-7);world.add(coop);
box(5.7,.13,4.5,mat(0xb4cf84),0,.04,0,coop);
for(let x=-2.8;x<=2.8;x+=.95){
  for(let z of [-2.27,2.27])box(.10,.9,.10,M.wood,x,.48,z,coop);
}
for(let z=-2.27;z<=2.27;z+=.92){
  for(let x of [-2.8,2.8])box(.10,.9,.10,M.wood,x,.48,z,coop);
}
for(let z of [-2.27,2.27]){
  box(5.6,.12,.12,M.wood,0,.42,z,coop);
  box(5.6,.12,.12,M.wood,0,.82,z,coop);
}
for(let x of [-2.8,2.8]){
  box(.12,.12,4.5,M.wood,x,.42,0,coop);
  box(.12,.12,4.5,M.wood,x,.82,0,coop);
}
const chickens=[];
for(let i=0;i<3;i++){
  const bird=new THREE.Group();coop.add(bird);
  ball(.38,M.white,0,.5,0,bird);
  ball(.28,M.white,0,.82,-.23,bird);
  const beak=mesh(new THREE.ConeGeometry(.12,.3,4),M.gold,bird);
  beak.rotation.x=-Math.PI/2;beak.position.set(0,.78,-.54);
  for(let k=-1;k<=1;k++)ball(.10,M.rose,k*.12,1.09,-.22,bird,7,6);
  for(let side of [-1,1])ball(.045,M.woodDark,side*.17,.91,-.43,bird,8,6);
  chickens.push(bird);
}
const nestSpots=[{x:12.9,z:-4.4},{x:15,z:-4.4},{x:17.1,z:-4.4}];
const eggObjects=[];
for(let i=0;i<3;i++){
 const g=new THREE.Group();g.position.set(nestSpots[i].x,.1,nestSpots[i].z);world.add(g);
 cyl(.43,.48,.25,M.woodDark,0,.08,0,g,10);
 const egg=ball(.21,M.white,0,.38,0,g);egg.scale.y=1.3;
 eggObjects.push(egg);
}
// Fruit tree, floating harvest fruit visible if available.
const appleTree=tree(-20,5,1.15);
const appleFruit=[];
for(let i=0;i<5;i++){
 const o=ball(.24,M.rose,-20+(i%2?-.8:.8),3.4+(i%3)*.35,5+(i-2)*.3);
 appleFruit.push(o);
}
// Player avatar
const avatar=new THREE.Group();world.add(avatar);
const legs=[];
for(let d of [-.22,.22]){
 const leg=box(.28,.75,.35,mat(0x7c907e),d,.47,0,avatar);legs.push(leg);
 box(.35,.16,.56,M.woodDark,d,.12,-.1,avatar);
}
box(.91,1.08,.54,mat(0xf1b99a),0,1.28,0,avatar);
for(let d of [-.58,.58]){
 const arm=box(.24,.85,.28,M.white,d,1.24,0,avatar);arm.rotation.z=d>0?-.12:.12;
}
ball(.44,mat(0xffe4bd),0,2.11,0,avatar,14,12);
const hair=ball(.455,mat(0x604739),0,2.32,.06,avatar,14,10);
hair.scale.y=.6;
for(let d of [-.14,.14])ball(.045,M.woodDark,d,2.12,-.40,avatar,8,6);
box(.54,.72,.22,mat(0x819da3),0,1.3,.37,avatar);
// Unique scenery accents: pinwheels around home.
for(let i=0;i<3;i++){
 let x=-18+i*2,z=-3;
 cyl(.025,.025,1.4,M.wood,x,.7,z);
 const flower=ball(.2,i%2?M.gold:M.rose,x,1.5,z,world,8,6);
}

const decorationSlots=[
 {x:-18,z:-5.2},{x:-16,z:-3.3},{x:-13.8,z:-3.3},{x:-10.3,z:-3.3},
 {x:-8,z:-3.3},{x:-6.8,z:-6.2},{x:-19,z:-10},{x:-6.7,z:-10},
];
const decorationModels=[];
let decorationSignature = null;
function makeDecoration(kind,spot){
 const g=new THREE.Group();g.position.set(spot.x,0,spot.z);world.add(g);
 if(kind==='flower'){
  cyl(.4,.32,.54,mat(0xce967a),0,.28,0,g);
  for(let i=0;i<4;i++){
    cyl(.035,.035,.55,M.leaf,(i-1.5)*.14,.81,0,g,6);
    ball(.16,i%2?M.rose:M.gold,(i-1.5)*.14,1.16,0,g,8,6);
  }
 } else if(kind==='bench'){
  box(2,.2,.63,M.wood,0,.73,0,g);
  box(2,.75,.17,M.wood,0,1.13,.27,g);
  for(let x of [-.8,.8])for(let z of [-.2,.2])box(.14,.74,.14,M.woodDark,x,.37,z,g);
 } else if(kind==='lamp'){
  cyl(.12,.19,2,M.woodDark,0,1,0,g);
  const light=ball(.32,M.gold,0,2.17,0,g,10,8);
  const point=new THREE.PointLight(0xffd88e,.55,4);point.position.y=2.2;g.add(point);
  mesh(new THREE.ConeGeometry(.46,.35,6),M.woodDark,g).position.y=2.48;
 }
 return g;
}
function renderDecorations(){
 const signature = JSON.stringify(state.decorations);
 if (signature === decorationSignature) return;
 decorationSignature = signature;
 for(const group of decorationModels){
   world.remove(group);
   group.traverse(obj=>{if(obj.isMesh)obj.geometry.dispose();});
 }
 decorationModels.length=0;
 for(const item of state.decorations)decorationModels.push(makeDecoration(item.kind,decorationSlots[item.slot]));
}
const wallColors={peach:0xf0b9a2,mint:0xb6d0b3,lavender:0xcbb9d8,cream:0xf2dfb4};
function setHouseColor() { houseWall.material.color.setHex(wallColors[state.houseColor]); }
setHouseColor();renderDecorations();

// Floating mystery gift appears occasionally; no expiry pressure.
const gift=new THREE.Group();gift.position.set(19,0,8);world.add(gift);
box(.82,.7,.82,M.purple,0,.5,0,gift);
box(.15,.74,.84,M.gold,0,.5,0,gift);
box(.85,.74,.15,M.gold,0,.5,0,gift);
box(.92,.17,.92,M.purple,0,.93,0,gift);
ball(.18,M.gold,0,1.15,0,gift);

function maybeGift(now){
 if(!state.giftPending && now - state.lastGiftAt > 110_000){
   state.giftPending=true;state.lastGiftAt=now;
   notify('🎁 Một món quà bí ẩn đã xuất hiện gần khu vườn!');
   save();
 }
 gift.visible=state.giftPending;
}
function interactGift(){
 if(!state.giftPending)return {ok:false, message:'Quà đã được mở.'};
 state.giftPending=false;state.lastGiftAt=Date.now();
 state.inventory.seeds+=4;state.coins+=40;state.xp+=10;
 return {ok:true,message:'Quà bí ẩn: +4 hạt giống, +40 Coins, +10 XP!'};
}

const interactables=[];
plotPlaces.forEach((p,i)=>interactables.push({kind:'plot',index:i,icon:'🥕',name:'Luống cà rốt',x:p.x,z:p.z,radius:2.05}));
nestSpots.forEach((p,i)=>interactables.push({kind:'nest',index:i,icon:'🥚',name:'Ổ trứng gà',x:p.x,z:p.z,radius:2.0}));
interactables.push({kind:'shop',icon:'🛍️',name:'Cửa hàng nông trại',x:8,z:9.5,radius:3.5});
interactables.push({kind:'house',icon:'🏡',name:'Ngôi nhà nhỏ',x:-12,z:-6.2,radius:3.1});
interactables.push({kind:'apple',icon:'🍎',name:'Cây táo ngọt',x:-20,z:5,radius:3.4});
interactables.push({kind:'gift',icon:'🎁',name:'Rương quà bí ẩn',x:19,z:8,radius:2.4});
const ring=mesh(new THREE.RingGeometry(.82,1.04,40),new THREE.MeshBasicMaterial({color:0xfff7bd,side:THREE.DoubleSide,transparent:true,opacity:.88}));
ring.rotation.x=-Math.PI/2;ring.position.y=.18;ring.visible=false;
let nearest=null;
function getNearest(){
 let best=null,bestDist=999;
 for(const entry of interactables){
  if(entry.kind==='gift'&&!state.giftPending)continue;
  const dist=Math.hypot(player.x-entry.x,player.z-entry.z);
  if(dist<entry.radius&&dist<bestDist){best=entry;bestDist=dist;}
 }
 return best;
}
function updateNearest(){
 nearest=getNearest();
 ring.visible=!!nearest;
 if(!nearest){
  dom.nearbyIcon.textContent='🧭';dom.nearbyTitle.textContent='Đi dạo quanh khu vườn';
  dom.nearbyHint.textContent='Đi đến luống đất, chuồng gà hoặc cửa hàng để tương tác.';
  dom.interact.disabled=true;dom.interact.textContent='Đến gần để tương tác';return;
 }
 ring.position.x=nearest.x;ring.position.z=nearest.z;
 dom.interact.disabled=false;dom.nearbyIcon.textContent=nearest.icon;
 dom.nearbyTitle.textContent=nearest.name;
 let hint='Nhấn E hoặc chạm nút bên cạnh';
 if(nearest.kind==='plot'){
  const p=state.plots[nearest.index],phase=cropPhase(p);
  hint=phase==='empty'?`Gieo hạt (còn ${state.inventory.seeds} hạt)`:phase==='ready'?'Cà rốt đã chín, thu hoạch ngay!':p.watered?`Đang phát triển ${cropProgress(p)}%`:`Đang phát triển ${cropProgress(p)}%, hãy tưới nước`;
 } else if(nearest.kind==='nest'){
  const sec=Math.ceil((state.nests[nearest.index].readyAt-Date.now())/1000);
  hint=sec<=0?'Có trứng mới, nhặt thôi!':`Đợi gà đẻ thêm trứng (${sec} giây)`;
 } else if(nearest.kind==='apple')hint=Date.now()>=state.appleReadyAt?'Hái 2 quả táo chín':'Cây đang ra trái mới';
 else if(nearest.kind==='house')hint='Mở bảng thay màu nhà và trang trí sân';
 else if(nearest.kind==='shop')hint='Mua hạt giống hoặc bán nông sản';
 else if(nearest.kind==='gift')hint='Mở rương để nhận quà bất ngờ';
 dom.nearbyHint.textContent=hint;
 dom.interact.textContent='E · Tương tác';
}
function interact(){
 if(!nearest||!dom.modal.classList.contains('hidden'))return;
 let result;
 if(nearest.kind==='plot')result=interactPlot(state,nearest.index);
 if(nearest.kind==='nest')result=collectEgg(state,nearest.index);
 if(nearest.kind==='apple')result=collectApple(state);
 if(nearest.kind==='gift')result=interactGift();
 if(nearest.kind==='shop')return showShop();
 if(nearest.kind==='house')return showBuild();
 if(result){notify(result.message,!result.ok);refresh();save();updateNearest();}
}

// Movement + camera. Desktop: click 3D view to lock pointer; on touch: drag on scene to look.
const down=new Set();
let yaw=0,pitch=.22,firstPerson=false;
let modalOpen=false,dragging=false,lastPointerX=0,lastPointerY=0,touchStarted=false;
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
function setView(){
 firstPerson=!firstPerson;
 avatar.visible=!firstPerson;
 notify(firstPerson?'Đã chuyển sang góc nhìn thứ nhất.':'Đã chuyển sang góc nhìn thứ ba.');
}
function rotateCamera(dx,dy){
 yaw-=dx*.0035;
 pitch=clamp(pitch+dy*.0023,-.25,.84);
}
renderer.domElement.addEventListener('click',()=>{
 if(modalOpen||!window.matchMedia('(pointer: fine)').matches)return;
 if(document.pointerLockElement!==renderer.domElement && renderer.domElement.requestPointerLock){
  renderer.domElement.requestPointerLock().catch(()=>{});
 }
});
renderer.domElement.addEventListener('pointerdown',e=>{
 if(e.pointerType==='mouse'&&document.pointerLockElement===renderer.domElement)return;
 touchStarted=e.pointerType!=='mouse';dragging=true;lastPointerX=e.clientX;lastPointerY=e.clientY;
 renderer.domElement.setPointerCapture?.(e.pointerId);
});
renderer.domElement.addEventListener('pointermove',e=>{
 if(modalOpen)return;
 if(document.pointerLockElement===renderer.domElement){rotateCamera(e.movementX,e.movementY);return;}
 if(dragging){rotateCamera(e.clientX-lastPointerX,e.clientY-lastPointerY);lastPointerX=e.clientX;lastPointerY=e.clientY;}
});
renderer.domElement.addEventListener('pointerup',()=>{dragging=false;});
renderer.domElement.addEventListener('pointercancel',()=>{dragging=false;});
window.addEventListener('keydown',e=>{
 if(e.target instanceof HTMLElement && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;
 const key=e.key.toLowerCase();
 if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','e','v','b','h','escape'].includes(key))e.preventDefault();
 if(modalOpen){if(key==='escape')closeModal();return;}
 down.add(key);
 if(e.repeat)return;
 if(key==='e')interact();
 if(key==='v')setView();
 if(key==='b')showShop();
 if(key==='h')showBuild();
 if(key==='escape'&&document.pointerLockElement)document.exitPointerLock();
});
window.addEventListener('keyup',e=>{down.delete(e.key.toLowerCase());});
window.addEventListener('blur',()=>down.clear());
for(const btn of document.querySelectorAll('[data-move]')){
 const key=btn.getAttribute('data-move');
 btn.addEventListener('pointerdown',e=>{e.preventDefault();down.add(key);btn.setPointerCapture?.(e.pointerId);});
 for(const event of ['pointerup','pointercancel','lostpointercapture'])btn.addEventListener(event,()=>down.delete(key));
}
function collides(x,z){
 if(Math.abs(x)>34||Math.abs(z)>34)return true;
 if(x>-16.45&&x<-7.55&&z>-14.7&&z<-8.1)return true;
 if(x>12.05&&x<17.95&&z>-9.5&&z<-5.2)return true;
 const pondX=(x-21)/8.65,pondZ=(z-20)/6.65;
 if(pondX*pondX+pondZ*pondZ<1)return true;
 return false;
}
let elapsed=0;
function animatePlayer(dt){
 const forward=(down.has('w')||down.has('arrowup')?1:0)-(down.has('s')||down.has('arrowdown')?1:0);
 const strafe=(down.has('d')||down.has('arrowright')?1:0)-(down.has('a')||down.has('arrowleft')?1:0);
 const speed=5.3;
 const len=Math.hypot(forward,strafe)||1;
 const mx=(-Math.sin(yaw)*forward+Math.cos(yaw)*strafe)/len*dt*speed;
 const mz=(-Math.cos(yaw)*forward-Math.sin(yaw)*strafe)/len*dt*speed;
 if(!collides(player.x+mx,player.z))player.x+=mx,player.z+=mz;
 else {
  if(!collides(player.x+mx,player.z))player.x+=mx;
  if(!collides(player.x,player.z+mz))player.z+=mz;
 }
 const moving=!!(forward||strafe);
 if(moving)elapsed+=dt*12;
 avatar.position.set(player.x,moving?Math.sin(elapsed)*.045:0,player.z);
 avatar.rotation.y=yaw;
 legs[0].rotation.x=moving?Math.sin(elapsed)*.32:0;
 legs[1].rotation.x=moving?-Math.sin(elapsed)*.32:0;
 if(firstPerson){
  const direction=new THREE.Vector3(-Math.sin(yaw)*Math.cos(pitch),-Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch));
  camera.position.set(player.x,1.72,player.z);
  camera.lookAt(camera.position.clone().add(direction));
 } else {
  const distance=6.8;
  const wanted=new THREE.Vector3(player.x+Math.sin(yaw)*distance,3.6+pitch*4.2,player.z+Math.cos(yaw)*distance);
  camera.position.lerp(wanted,Math.min(1,dt*7));
  camera.lookAt(player.x,1.65,player.z);
 }
}

function save(){
 state.player={x:player.x,z:player.z};
 try {localStorage.setItem(SAVE_KEY,JSON.stringify(state));return true;}
 catch {notify('Không thể tự lưu. Hãy xuất file Save để sao lưu.',true);return false;}
}
function exportSave(){
 save();const data=JSON.stringify(state,null,2),blob=new Blob([data],{type:'application/json'});
 const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='my-little-world-save.json';a.click();
 setTimeout(()=>URL.revokeObjectURL(a.href),2500);
 notify('Đã xuất file Save. Hãy giữ file này để sao lưu.');
}
async function importSave(file){
 if(!file)return;
 if(file.size>250_000){notify('File Save quá lớn hoặc không hợp lệ.',true);return;}
 try{
  const raw=JSON.parse(await file.text());
  if(raw?.version!==1||!Array.isArray(raw.plots)){throw new Error('Invalid save');}
  const clean=safeState(raw);
  localStorage.setItem(SAVE_KEY,JSON.stringify(clean));
  location.reload();
 }catch{notify('Không đọc được file Save hợp lệ phiên bản 0.1.',true);}
}
function notify(message,bad=false){
 const node=document.createElement('div');node.className='toast'+(bad?' bad':'');node.textContent=message;dom.toast.appendChild(node);
 setTimeout(()=>node.remove(),3200);
}
function refresh(){
 $('coinsValue').textContent=state.coins.toLocaleString('vi-VN');
 $('levelValue').textContent=levelForXP(state.xp);
 $('xpLabel').textContent=`${state.xp%100} / 100 XP`;
 $('xpBar').style.width=`${nextLevelPercent(state.xp)}%`;
 $('seedCount').textContent=state.inventory.seeds;
 $('carrotCount').textContent=state.inventory.carrots;
 $('eggCount').textContent=state.inventory.eggs;
 $('appleCount').textContent=state.inventory.apples;
 setHouseColor();
 renderDecorations();
}

function openModal(kicker,title){
 document.exitPointerLock?.();
 modalOpen=true;down.clear();
 dom.modal.classList.remove('hidden');
 dom.modalKicker.textContent=kicker;dom.modalTitle.textContent=title;
 dom.modalContent.replaceChildren();
}
function closeModal(){modalOpen=false;dom.modal.classList.add('hidden');down.clear();}
$('closeModal').addEventListener('click',closeModal);
dom.modal.addEventListener('click',e=>{if(e.target===dom.modal)closeModal();});
function createNode(tag,text,cls){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node;}
function paragraph(text,cls=''){const p=createNode('p',text,cls);dom.modalContent.appendChild(p);return p;}
function actionButton(label,fn,cls='primary-btn'){
 const button=createNode('button',label,cls);button.type='button';button.addEventListener('click',fn);return button;
}
function product(grid,icon,name,descr,button,fn){
 const card=createNode('article',undefined,'product');
 card.appendChild(createNode('div',icon,'product-icon'));
 card.appendChild(createNode('h3',name));card.appendChild(createNode('p',descr));
 card.appendChild(actionButton(button,fn));grid.appendChild(card);
}
function perform(fn,after){
 const result=fn();notify(result.message,!result.ok);if(result.ok){refresh();save();}
 if(after)after();
}
function showShop(){
 openModal('CỬA HÀNG NÔNG TRẠI','Một chút mua sắm 🛒');
 paragraph('Gieo trồng, chăn nuôi rồi mang nông sản đến đây bán. Bạn không cần làm nhiệm vụ nếu chỉ muốn dạo chơi.','modal-note');
 const grid=createNode('div',undefined,'modal-grid');dom.modalContent.appendChild(grid);
 product(grid,'🌱','Hạt giống cà rốt','5 hạt giống · Cây lớn sau khoảng 30–45 giây.','Mua · 30 🪙',()=>perform(()=>buySeeds(state),showShop));
 product(grid,'🧺','Bán tất cả nông sản','Cà rốt 8 Coins · Trứng 12 Coins · Táo 10 Coins.','Bán nông sản',()=>perform(()=>sellGoods(state),showShop));
 product(grid,'🏡','Trang trí nhà','Mua ghế, chậu hoa, đèn vườn và thay màu tường.','Mở trang trí',showBuild);
 product(grid,'🎁','Quà bí ẩn','Thỉnh thoảng có rương quà xuất hiện gần vườn.','Xem nhiệm vụ',showQuests);
}
function showBuild(){
 openModal('GÓC SÁNG TẠO','Nhà là nơi để yêu 🌷');
 paragraph('Trang trí 8 vị trí định sẵn ở sân vườn. Bản sau sẽ hỗ trợ kéo thả, xoay và xây tường tự do.','modal-note');
 dom.modalContent.appendChild(createNode('h3','Sơn lại ngôi nhà'));
 const colors=createNode('div',undefined,'color-options');dom.modalContent.appendChild(colors);
 for(const [id,label,code] of [['peach','🍑 Hồng đào','#eab1a0'],['mint','🍃 Xanh mint','#b6d0b3'],['lavender','💜 Tím pastel','#cbb9d8'],['cream','🧁 Kem sữa','#f2dfb4']]){
  const b=actionButton(label,()=>{state.houseColor=id;refresh();save();showBuild();notify(`Đã đổi màu nhà: ${label}.`);});
  b.style.borderLeft=`7px solid ${code}`;
  if(id===state.houseColor)b.classList.add('selected');
  colors.appendChild(b);
 }
 dom.modalContent.appendChild(createNode('h3',`Trang trí sân (${state.decorations.length}/8)`));
 const grid=createNode('div',undefined,'modal-grid');dom.modalContent.appendChild(grid);
 for(const [kind,details] of Object.entries(DECOR)){
  product(grid,details.icon,details.title,`Mua và đặt vào vị trí trống tiếp theo.`,`Đặt · ${details.price} 🪙`,()=>perform(()=>addDecoration(state,kind),showBuild));
 }
 const row=createNode('div',undefined,'button-row');row.style.marginTop='13px';dom.modalContent.appendChild(row);
 row.appendChild(actionButton('↶ Dọn món vừa đặt (hoàn 50%)',()=>perform(()=>removeLastDecoration(state),showBuild),'secondary-btn'));
}
function showQuests(){
 openModal('NHỮNG NIỀM VUI NHỎ','Nhiệm vụ tự chọn 📜');
 paragraph('Hoàn thành bất cứ khi nào bạn thích. Không có thời hạn, không bị phạt khi bỏ qua.','modal-note');
 for(const q of QUESTS){
  const row=createNode('div',undefined,'quest-row');dom.modalContent.appendChild(row);
  row.appendChild(createNode('span',q.icon));
  const desc=createNode('div');row.appendChild(desc);
  desc.appendChild(createNode('strong',q.title));
  desc.appendChild(createNode('p',`${Math.min(state.quests[q.id],q.goal)}/${q.goal} · Thưởng ${q.reward} Coins + 20 XP`));
  const button=actionButton(state.quests.claimed[q.id]?'Đã nhận':`Nhận thưởng`,()=>perform(()=>claimQuest(state,q.id),showQuests));
  button.disabled=state.quests.claimed[q.id]||state.quests[q.id]<q.goal;
  row.appendChild(button);
 }
}
function showHelp(){
 openModal('HƯỚNG DẪN CHƠI','Cứ chơi theo cách của bạn ☀️');
 const tips=[
  'W / A / S / D hoặc các phím mũi tên: di chuyển.',
  'Nhấp vào thế giới 3D để khóa chuột; rê chuột để quan sát. Nhấn Esc để thoát khóa chuột.',
  'Nhấn E hoặc nút “Tương tác” khi đến gần vật thể.',
  'Nhấn V đổi First-person / Third-person, B mở cửa hàng, H mở trang trí.',
  'Đến 12 luống đất màu nâu: gieo hạt → tưới nước → thu hoạch.',
  'Đến chuồng gà phía bên phải để nhặt trứng; tìm cây táo gần căn nhà.',
  'Mua hạt giống, bán nông sản để kiếm Coins; thay màu nhà, đặt đồ ở sân.',
  'Game tự lưu định kỳ trên thiết bị. Hãy xuất file Save nếu muốn sao lưu.',
 ];
 const list=createNode('ol',undefined,'tips');for(const t of tips)list.appendChild(createNode('li',t));dom.modalContent.appendChild(list);
 const row=createNode('div',undefined,'button-row');dom.modalContent.appendChild(row);
 row.appendChild(actionButton('⬇ Xuất file Save',exportSave));
 const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.className='hidden';
 input.addEventListener('change',e=>importSave(e.target.files?.[0]));
 row.appendChild(actionButton('⬆ Nhập file Save',()=>input.click(),'secondary-btn'));
 row.appendChild(input);
 paragraph('Ghi chú: Game v0.1 chỉ có trang trí ở những vị trí định sẵn, chưa có xây nhà tự do, lái thuyền hay NPC hội thoại.','modal-note');
}
$('shopButton').addEventListener('click',showShop);
$('buildButton').addEventListener('click',showBuild);
$('questsButton').addEventListener('click',showQuests);
$('viewButton').addEventListener('click',setView);
$('saveButton').addEventListener('click',()=>notify(save()?'Đã lưu tiến độ trên thiết bị này!':'Lưu chưa thành công.',false));
$('helpButton').addEventListener('click',showHelp);
dom.interact.addEventListener('click',interact);
window.addEventListener('beforeunload',save);

// Game loop: movement independent of FPS; crops and eggs update on real elapsed time, including offline.
const clock=new THREE.Clock();
let lastSlowTick=0,lastSave=0;
function frame(){
 requestAnimationFrame(frame);
 const dt=Math.min(clock.getDelta(),.06);
 animatePlayer(modalOpen?0:dt);
 const t=clock.elapsedTime;
 for(let i=0;i<chickens.length;i++){
  const bird=chickens[i];bird.position.set(Math.sin(t*.7+i*2.9)*1.1,0,Math.cos(t*.9+i*2.2)*.72);
  bird.rotation.y=t*.3+i*2.2;
 }
 for(let i=0;i<clouds.length;i++){ clouds[i].position.x+=dt*(.06+i*.012); if(clouds[i].position.x>56)clouds[i].position.x=-55; }
 const lightDay=(Math.sin(t/160)+1)/2;
 sun.intensity=1.85+lightDay*1.15;
 if(t-lastSlowTick>0.28){
  lastSlowTick=t;
  const now=Date.now();
  refreshPlots(now);
  for(let i=0;i<eggObjects.length;i++)eggObjects[i].visible=state.nests[i].readyAt<=now;
  appleFruit.forEach(o=>o.visible=state.appleReadyAt<=now);
  maybeGift(now);updateNearest();
  $('timeLabel').textContent=lightDay>.45?'☀️ Ngày nắng':'🌙 Chiều êm';
 }
 if(t-lastSave>12){lastSave=t;save();}
 gift.rotation.y+=dt*.9;
 gift.position.y=.14+Math.sin(t*2)*.16;
 renderer.render(world,camera);
}
function resized(){
 const w=dom.viewport.clientWidth,h=dom.viewport.clientHeight;
 camera.aspect=w/Math.max(1,h);camera.updateProjectionMatrix();renderer.setSize(w,h);
}
window.addEventListener('resize',resized);
resized();
refresh();refreshPlots(Date.now());maybeGift(Date.now());updateNearest();
frame();
dom.loading.classList.add('hidden');
setTimeout(()=>notify('Chào mừng! Hãy đến luống đất để gieo hạt 🌱'),800);
// First visit: instructions are optional. Don't force quests, do not lock movement.

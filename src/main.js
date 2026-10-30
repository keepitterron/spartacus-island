import '@fontsource/fredoka/latin-400.css';
import '@fontsource/fredoka/latin-500.css';
import '@fontsource/fredoka/latin-600.css';
import '@fontsource/fredoka/latin-700.css';
import './style.css';
import * as THREE from 'three';
import {$,angLerp,V} from './core/util.js';
import {renderer,scene,camera,canvas,followSun} from './core/renderer.js';
import {G,cur} from './core/state.js';
import {burst,updParts} from './core/fx.js';
import {overlayOpen,armButton} from './core/ui.js';
import {bindInput} from './core/input.js';
import {continueIsland,loadSave} from './core/save.js';
import {addTerrain} from './world/terrain.js';
import {updOcean} from './world/ocean.js';
import {buildSky,updSky} from './world/sky.js';
import {updShip} from './world/ship.js';
import {P,SPAWN,stepPlayer,updRescue} from './player/player.js';
import {animDog} from './player/dog.js';
import {POWERS,updFruits} from './systems/powers.js';
import {updPickups} from './systems/collect.js';
import {updDigs,updDigging} from './systems/digs.js';
import {updFloaters,updPlacing} from './systems/items.js';
import {updHooks,updSwing,updSwingLine} from './systems/hooks.js';
import {updGrowers,updClimb,updZip} from './systems/vines.js';
import {updHat} from './systems/hat.js';
import {updGull} from './npcs/gull.js';
import {updMango} from './npcs/mango.js';
import {updWasabi} from './npcs/wasabi.js';
import {initTasks,renderTasks,showWin,hideWin} from './game/tasks.js';
import {bark,doAction,updPrompt,updWoof} from './game/actions.js';
import {interact} from './game/interact.js';
import {startGame,restartFromBeginning} from './game/flow.js';
import {orbitCamera,updCamera} from './game/camera.js';
import island1 from './islands/island1/index.js';
import island2 from './islands/island2/index.js';
import island3 from './islands/island3/index.js';
import island4 from './islands/island4/index.js';

/* ---------- world ---------- */
// Islands in play order. To add one, see docs/islands.md.
const ISLANDS=[island1,island2,island3,island4];
for(const I of ISLANDS){G.islands[I.id]=I;initTasks(I);addTerrain(I.zMax,I.height);}
// Build order matters: all scenery shares one seeded random sequence (see core/util.js rand).
for(const I of ISLANDS)I.build();
buildSky();
for(const I of ISLANDS)I.buildLate?.();
P.pos.copy(island1.spawn);SPAWN.copy(island1.spawn);

/* ---------- HUD + menus ---------- */
renderTasks();
$('#listToggle').addEventListener('click',()=>{const l=$('#list');l.classList.toggle('closed');$('#listToggle').setAttribute('aria-expanded',!l.classList.contains('closed'));});
if(innerWidth<500)$('#list').classList.add('closed');
armButton($('#restartLink'),'Tap again to restart from island 1',restartFromBeginning);

const contIsland=continueIsland(ISLANDS.length);
if(contIsland>=2){$('#cont').textContent=`Continue: Island ${contIsland}`;$('#cont').classList.remove('hidden');}
// with a save to lose, starting over needs a second tap
if(contIsland>=2&&loadSave().island>=2)armButton($('#play'),'Tap again to start over',()=>startGame(1));
else $('#play').addEventListener('click',()=>startGame(1));
$('#cont').addEventListener('click',()=>startGame(contIsland));
$('#winExplore').addEventListener('click',()=>{hideWin();canvas.focus();});
$('#winGo').addEventListener('click',()=>cur().exit.run());
$('#restart').addEventListener('click',restartFromBeginning);

bindInput({
  onKey(k){
    if(G.state==='start'){if(k==='enter'||k===' ')startGame(contIsland);return;}
    const cs=G.cutscenes[G.state];if(cs){if(k==='enter'||k===' '||k==='escape')cs.skip?.();return;}
    if(overlayOpen())return; // let Enter/Space press the focused panel button
    if(k===' ')P.jumpBuf=.15;if(k==='b')bark();if(k==='f'||k==='enter')doAction();},
  onJump(){P.jumpBuf=.15;},onBark:bark,onAct:doAction,
});

/* ---------- loop ---------- */
const clock=new THREE.Clock();
function frame(){requestAnimationFrame(frame);const dt=Math.min(clock.getDelta(),1/30);G.T+=dt;update(dt);renderer.render(scene,camera);}
function update(dt){
  updOcean();updSky(dt);updShip(dt,G.state==='bubble');
  updPickups(dt);updFruits(dt);updDigs(dt);updHooks(dt);updGrowers(dt);updHat(dt);
  updGull(dt);updMango(dt);updWasabi(dt);
  cur().update?.(dt);
  updFloaters(dt);updParts(dt);updWoof(dt);
  followSun(G.state==='start'?V(0,0,0):P.pos);
  if(G.state==='start'){orbitCamera();animDog(dt,0);return;}
  const cs=G.cutscenes[G.state];if(cs){cs.update(dt);animDog(dt,0);updPrompt();return;}

  P.barkCd-=dt;P.barkT-=dt;
  if(G.state==='rescue')updRescue(dt);
  else if(P.swing){updSwing(dt);interact(dt);}
  else if(P.climb){updClimb(dt);interact(dt);}
  else if(P.zip){updZip(dt);interact(dt);}
  else{stepPlayer(dt);interact(dt);updDigging(dt);updPlacing(dt);}
  const sp=G.state==='play'&&!P.swing&&!P.climb&&!P.zip?Math.hypot(P.vel.x,P.vel.z):0;
  if(sp>.6&&P.digT<=0)P.yaw=angLerp(P.yaw,Math.atan2(P.vel.x,P.vel.z),Math.min(1,dt*12));
  if(P.power&&sp>2&&P.grounded){P.sparkT-=dt;if(P.sparkT<0){P.sparkT=.12;burst(P.pos.clone().add(V(0,.3,0)),2,POWERS[P.power].col.slice(1),1,1.5,.6,.7,.2);}}
  // celebration: confetti for ~2.4 s, then the island's win panel
  if(G.celebT>=0){G.celebT+=dt;if(G.celebT<2.4&&Math.floor(G.celebT*4)!==Math.floor((G.celebT-dt)*4))burst(P.pos.clone().add(V(0,3,0)),26,[0xff9fb2,0xffd84d,0x7fd8ee,0x8a5cf6,0x6ccb5f],7,5,2.2,1.4,.25,true);
    if(G.celebT>2.8){showWin(G.celebIsland);G.celebT=-1;}}
  updPrompt();
  animDog(dt,G.state==='rescue'?3:sp);
  updSwingLine();
  updCamera(dt);
}
frame();

/* ---------- debug: ?debug (always on in dev) ---------- */
if(import.meta.env.DEV||new URLSearchParams(location.search).has('debug')){G.debug=true;
  import('./game/debug.js').then(m=>m.installDebug());}

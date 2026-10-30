import {$,clamp,V} from '../core/util.js';
import {scene} from '../core/renderer.js';
import {G,cur,playing,inCutscene} from '../core/state.js';
import {sfx,ac} from '../core/audio.js';
import {textSprite} from '../core/fx.js';
import {P} from '../player/player.js';
import {drop,grabAction} from '../systems/items.js';
import {digAction} from '../systems/digs.js';
import {swingAction} from '../systems/hooks.js';
import {allDone} from './tasks.js';

// The context button (F / green button). Whatever is first in this list wins:
//   1. the island's exit (Sail / Dive / Ride), once its to-do list is done
//   2. the island's own actions(p)  (give an item, open a gate, grow, chop…)
//   3. swing, drop, grab, dig
export function currentAction(){
  if(!playing()||P.digT>0||P.placing||P.swing||P.climb||P.zip)return null;
  const I=cur(),p=P.pos;
  if(I.exit&&allDone(I)&&I.exit.at(p))return{label:I.exit.label,fn:I.exit.run};
  return I.actions?.(p)||swingAction()||(P.carry?{label:'Drop',fn:drop}:null)||grabAction(p)||digAction(p);
}
export function doAction(){if(G.state==='start')return;ac();const a=currentAction();if(a)a.fn();}

let lastLabel;
export function updPrompt(){const a=currentAction(),label=a?a.label:null;
  if(label!==lastLabel){lastLabel=label;const pr=$('#prompt'),btn=$('#btnAct');
    if(label){pr.firstChild.innerHTML=`<kbd>F</kbd> ${label}`;pr.classList.add('show');btn.textContent=label;btn.classList.remove('off');}
    else{pr.classList.remove('show');btn.textContent=P.carry?'Drop':'Grab';btn.classList.add('off');}}}

// Woof! Islands react in bark(p) (wake the gull, call Mango, find hidden crabs…)
let woof=null,woofT=0;
export function bark(){if(G.state==='start'||inCutscene()||P.barkCd>0)return;P.barkCd=.45;P.barkT=.35;sfx.bark();
  if(!woof){woof=textSprite('WOOF!','#ffd84d');woof.scale.set(3.2,.8,1);scene.add(woof);}woofT=.8;
  cur().bark?.(P.pos);}
export function updWoof(dt){
  if(woof&&woofT>0){woofT-=dt;woof.visible=true;woof.position.copy(P.pos).add(V(0,2.6+(.8-woofT)*1.2,0));woof.material.opacity=clamp(woofT/.4,0,1);const s=1.6+(.8-woofT);woof.scale.set(s*2,s/2,1);}else if(woof)woof.visible=false;}

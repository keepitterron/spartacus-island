// Every sound is synthesised with WebAudio, so there are no audio files to load.
let AC=null;
// browsers only allow audio after a user gesture: call ac() from input handlers to unlock it
export function ac(){if(!AC){try{AC=new (window.AudioContext||window.webkitAudioContext)();}catch(e){}}if(AC&&AC.state==='suspended')AC.resume().catch(()=>{});return AC;}
function tone(f0,f1,dur,type='sine',vol=.2,delay=0){const a=ac();if(!a)return;const t=a.currentTime+delay,o=a.createOscillator(),g=a.createGain();o.type=type;o.frequency.setValueAtTime(f0,t);o.frequency.exponentialRampToValueAtTime(f1,t+dur);
  g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+.012);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(g).connect(a.destination);o.start(t);o.stop(t+dur+.05);}
function noise(dur,freq,vol,delay=0){const a=ac();if(!a)return;const t=a.currentTime+delay,n=Math.floor(a.sampleRate*dur),b=a.createBuffer(1,n,a.sampleRate),d=b.getChannelData(0);for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*(1-i/n);
  const s=a.createBufferSource();s.buffer=b;const f=a.createBiquadFilter();f.type='bandpass';f.frequency.value=freq;const g=a.createGain();g.gain.value=vol;s.connect(f).connect(g).connect(a.destination);s.start(t);}
export const sfx={
  bark(){tone(640,300,.11,'sawtooth',.09);noise(.07,1400,.25);tone(720,340,.12,'sawtooth',.08,.15);noise(.07,1500,.2,.15);},
  jump(){tone(300,560,.12,'triangle',.08);},
  boing(){tone(180,900,.28,'sine',.18);tone(360,1400,.2,'triangle',.05,.05);},
  bone(){[880,1175,1568].forEach((f,i)=>tone(f,f*1.01,.16,'triangle',.12,i*.07));},
  splash(){noise(.6,500,.5);noise(.3,1800,.2,.05);},
  pop(){tone(900,1900,.07,'sine',.16);},
  ding(){[1,2.4,3.9].forEach((m,i)=>tone(660*m,655*m,1.8-i*.45,'sine',.2/(i+1)));tone(523,520,1.6,'sine',.12,.5);},
  gull(){tone(1400,850,.16,'triangle',.08);tone(1550,950,.16,'triangle',.08,.2);},
  parrot(){tone(1800,1100,.1,'square',.05);tone(2000,1300,.12,'square',.05,.13);},
  win(){[523,659,784,1047,784,1047,1319].forEach((f,i)=>tone(f,f,.24,'triangle',.13,i*.12));},
  fruit(){[392,523,659,784].forEach((f,i)=>tone(f,f*1.5,.18,'sine',.12,i*.06));},
  scratch(){noise(.09,2600,.18);},
  grab(){tone(500,750,.08,'triangle',.1);},
  drop(){tone(300,180,.1,'triangle',.1);noise(.06,700,.15);},
  thunk(){tone(160,90,.18,'triangle',.18);noise(.12,400,.3);[523,784].forEach((f,i)=>tone(f,f,.15,'triangle',.1,.2+i*.1));},
  creak(){tone(220,140,.5,'sawtooth',.05);[659,880,1175,1568].forEach((f,i)=>tone(f,f,.25,'sine',.12,.4+i*.1));},
  stretch(){tone(200,1200,.35,'triangle',.12);tone(400,1600,.3,'sine',.06,.05);},
  horn(){tone(220,215,.7,'sawtooth',.07);tone(277,272,.7,'sawtooth',.05);},
  grow(){tone(260,780,.8,'triangle',.1);noise(.5,3000,.08);[523,659,784,1047].forEach((f,i)=>tone(f,f,.2,'sine',.08,.5+i*.08));},
  zip(){noise(.9,1800,.18);tone(700,300,.9,'sine',.05);},
  buzz(){tone(180,190,.5,'sawtooth',.04);tone(240,230,.4,'sawtooth',.03,.1);},
  splashy(){noise(.4,900,.3);[392,523,659].forEach((f,i)=>tone(f,f,.2,'sine',.08,.2+i*.1));},
  chop(){noise(.12,4000,.25);tone(900,500,.12,'triangle',.08);},
  grumble(){tone(110,80,.6,'sawtooth',.08);tone(130,90,.5,'sawtooth',.06,.25);},
  whale(){tone(180,320,1.4,'sine',.14);tone(320,200,1.6,'sine',.1,1.2);}
};

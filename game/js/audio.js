/* =====================================================================
   audio.js — 100% procedural WebAudio. No assets.
   Vol 1 §1.9 (tone & audio direction), Vol 6 §6.x.6 (boss music)
   ===================================================================== */
'use strict';
const Audio_ = {
  ctx:null, master:null, sfxBus:null, musBus:null, drone:null,
  ready:false, musicOn:false, currentTrack:null, nodes:[],
  init(){
    if(this.ready) return;
    const AC = window.AudioContext||window.webkitAudioContext; if(!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.gain.value = 0.9; this.master.connect(this.ctx.destination);
    this.sfxBus = this.ctx.createGain(); this.sfxBus.gain.value = SETTINGS.sfx;   this.sfxBus.connect(this.master);
    this.musBus = this.ctx.createGain(); this.musBus.gain.value = SETTINGS.music;  this.musBus.connect(this.master);
    // a shared noise buffer (whooshes, impacts, rain)
    const len = this.ctx.sampleRate*2, buf = this.ctx.createBuffer(1,len,this.ctx.sampleRate), d=buf.getChannelData(0);
    for(let i=0;i<len;i++) d[i]=Math.random()*2-1;
    this.noise = buf;
    this.ready=true;
  },
  resume(){ this.init(); if(this.ctx && this.ctx.state==='suspended') this.ctx.resume(); },
  setVol(){ if(!this.ready) return; this.sfxBus.gain.value=SETTINGS.sfx; this.musBus.gain.value=SETTINGS.music; },
  t(){ return this.ctx.currentTime },

  /* ---------- primitives ---------- */
  tone(freq,dur,{type='sine',gain=0.2,attack=0.005,decay=null,detune=0,bus=null,glide=null}={}){
    if(!this.ready) return;
    const c=this.ctx,o=c.createOscillator(),g=c.createGain(),t=c.currentTime;
    o.type=type; o.frequency.setValueAtTime(freq,t); o.detune.value=detune;
    if(glide) o.frequency.exponentialRampToValueAtTime(Math.max(20,glide),t+dur);
    g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(gain,t+attack);
    g.gain.exponentialRampToValueAtTime(0.0008,t+dur);
    o.connect(g); g.connect(bus||this.sfxBus); o.start(t); o.stop(t+dur+0.05);
    return o;
  },
  noiseHit(dur,{gain=0.25,freq=1200,q=1,type='bandpass',bus=null,sweep=null}={}){
    if(!this.ready) return;
    const c=this.ctx,s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain(),t=c.currentTime;
    s.buffer=this.noise; s.loop=true;
    f.type=type; f.frequency.setValueAtTime(freq,t); f.Q.value=q;
    if(sweep) f.frequency.exponentialRampToValueAtTime(Math.max(60,sweep),t+dur);
    g.gain.setValueAtTime(gain,t); g.gain.exponentialRampToValueAtTime(0.0008,t+dur);
    s.connect(f); f.connect(g); g.connect(bus||this.sfxBus); s.start(t); s.stop(t+dur+0.05);
  },

  /* ---------- gameplay SFX ---------- */
  swing(heavy=false,stance=false){
    this.noiseHit(heavy?0.22:0.14,{gain:heavy?0.16:0.11,freq:heavy?900:1500,sweep:heavy?180:420,q:0.9,type:'bandpass'});
    if(stance) this.tone(heavy?180:240,0.14,{type:'triangle',gain:0.07,glide:heavy?90:140});
  },
  hit(flesh=false,heavy=false,blocked=false){
    if(blocked){ this.noiseHit(0.13,{gain:0.2,freq:2400,sweep:900,q:2.4,type:'bandpass'}); this.tone(320,0.09,{type:'square',gain:0.06}); return }
    this.noiseHit(heavy?0.20:0.11,{gain:heavy?0.34:0.24,freq:flesh?420:760,sweep:flesh?90:180,q:0.8,type:'lowpass'});
    this.tone(flesh?92:130,heavy?0.17:0.10,{type:'sine',gain:heavy?0.30:0.19,glide:flesh?44:60});
    if(heavy) this.noiseHit(0.30,{gain:0.11,freq:220,q:0.6,type:'lowpass'});
  },
  crit(){ this.tone(880,0.22,{type:'sawtooth',gain:0.16,glide:220}); this.noiseHit(0.30,{gain:0.3,freq:1600,sweep:200,q:1.2}); this.tone(140,0.34,{type:'sine',gain:0.3,glide:52}); },
  parry(){ this.tone(1560,0.30,{type:'sine',gain:0.20,glide:2400}); this.noiseHit(0.22,{gain:0.22,freq:3600,q:3.2}); this.tone(780,0.4,{type:'triangle',gain:0.10}); },
  roll(){ this.noiseHit(0.20,{gain:0.13,freq:640,sweep:220,q:0.7,type:'bandpass'}); },
  step(){ this.noiseHit(0.05,{gain:0.045,freq:320+Math.random()*180,q:1.1,type:'bandpass'}); },
  guard(){ this.noiseHit(0.09,{gain:0.12,freq:1500,sweep:600,q:2.0}); },
  guardBreak(){ this.tone(180,0.5,{type:'sawtooth',gain:0.20,glide:52}); this.noiseHit(0.42,{gain:0.26,freq:900,sweep:120,q:0.7}); },
  postureBreak(){ this.tone(70,0.7,{type:'sine',gain:0.36,glide:34}); this.noiseHit(0.5,{gain:0.3,freq:1100,sweep:150,q:0.8}); this.tone(420,0.5,{type:'triangle',gain:0.10,glide:110}); },
  drink(){ this.tone(240,0.34,{type:'sine',gain:0.14,glide:520}); this.noiseHit(0.3,{gain:0.09,freq:900,sweep:2200,q:1.4}); this.tone(660,0.5,{type:'triangle',gain:0.09}); },
  gem(){ this.tone(520,0.5,{type:'sine',gain:0.10,glide:780}); this.noiseHit(0.4,{gain:0.06,freq:2200,q:2.0}); },
  heal(){ [523,659,784,1046].forEach((f,i)=>setTimeout(()=>this.tone(f,0.6,{type:'sine',gain:0.10}),i*70)); },
  levelUp(){ [261,329,392,523,659,784].forEach((f,i)=>setTimeout(()=>{this.tone(f,1.1,{type:'triangle',gain:0.12});this.tone(f*2,0.9,{type:'sine',gain:0.05})},i*110));
    this.noiseHit(1.4,{gain:0.10,freq:600,sweep:2600,q:0.8,bus:this.musBus}); },
  bonfire(){ this.noiseHit(2.2,{gain:0.10,freq:420,sweep:1400,q:0.6}); [196,261,329].forEach((f,i)=>setTimeout(()=>this.tone(f,2.4,{type:'sine',gain:0.09}),i*220)); },
  cast(){ this.noiseHit(0.4,{gain:0.10,freq:1600,sweep:400,q:1.4}); this.tone(300,0.42,{type:'triangle',gain:0.09,glide:700}); },
  spell(heavy=false){ this.tone(heavy?180:420,heavy?0.5:0.3,{type:'sawtooth',gain:0.11,glide:heavy?60:180});
    this.noiseHit(heavy?0.5:0.28,{gain:0.16,freq:heavy?700:1400,sweep:heavy?110:300,q:0.9}); },
  fire(){ this.noiseHit(0.55,{gain:0.19,freq:820,sweep:150,q:0.55,type:'lowpass'}); this.tone(120,0.4,{type:'sawtooth',gain:0.07,glide:48}); },
  dark(){ this.tone(96,0.7,{type:'sine',gain:0.20,glide:38}); this.noiseHit(0.6,{gain:0.14,freq:340,sweep:80,q:0.7,type:'lowpass'});
    this.tone(1240,0.5,{type:'triangle',gain:0.05,glide:620,detune:-30}); },
  bow(){ this.noiseHit(0.14,{gain:0.19,freq:2600,sweep:520,q:2.6}); this.tone(180,0.1,{type:'square',gain:0.05,glide:90}); },
  sever(){ this.noiseHit(0.5,{gain:0.30,freq:1800,sweep:220,q:1.0}); this.tone(880,0.4,{type:'sawtooth',gain:0.12,glide:120});
    [392,523,659].forEach((f,i)=>setTimeout(()=>this.tone(f,0.9,{type:'triangle',gain:0.10}),i*120)); },
  die(){ this.tone(150,1.6,{type:'sine',gain:0.20,glide:38}); this.noiseHit(1.4,{gain:0.16,freq:520,sweep:60,q:0.5,type:'lowpass'}); },
  soulPickup(n=1){ this.tone(1400+Math.min(n,20)*40,0.18,{type:'sine',gain:0.075,glide:2100}); this.tone(2100,0.14,{type:'triangle',gain:0.035}); },
  ui(sel=false){ this.tone(sel?660:440,0.07,{type:'square',gain:0.045}); },
  want(){ this.tone(74,0.9,{type:'sine',gain:0.22,glide:30}); this.tone(1110,0.7,{type:'triangle',gain:0.05,glide:380,detune:24}); },
  resonance(r){ [0,330,494,659,880].slice(0,r+2).forEach((f,i)=>setTimeout(()=>this.tone(f,1.0,{type:'triangle',gain:0.09}),i*90)); },

  /* ---------- boss roars (Vol 6) ---------- */
  roar(big=false){
    const d=big?2.0:1.3;
    this.tone(big?52:78,d,{type:'sawtooth',gain:0.24,glide:big?26:38});
    this.tone(big?78:110,d*0.8,{type:'square',gain:0.10,glide:big?40:56,detune:-18});
    this.noiseHit(d,{gain:0.20,freq:big?340:620,sweep:big?70:120,q:0.5,type:'lowpass'});
  },
  phaseShift(){ this.tone(40,2.4,{type:'sine',gain:0.34,glide:22}); this.noiseHit(2.0,{gain:0.24,freq:900,sweep:90,q:0.5});
    [110,165,220,330].forEach((f,i)=>setTimeout(()=>this.tone(f,1.8,{type:'sawtooth',gain:0.09}),i*160)); },
  anvil(){ this.noiseHit(0.24,{gain:0.30,freq:2800,sweep:700,q:3.4}); this.tone(210,0.2,{type:'square',gain:0.10,glide:80}); },

  /* ---------- ambient / music ----------
     Vol 6 §6.x.6: BPM and key per boss. A generative ostinato over a drone. */
  startAmbient(region){
    if(!this.ready) return; this.stopMusic();
    const c=this.ctx, t=c.currentTime;
    const g=c.createGain(); g.gain.value=0; g.gain.linearRampToValueAtTime(0.16,t+3); g.connect(this.musBus);
    const filt=c.createBiquadFilter(); filt.type='lowpass'; filt.frequency.value=280; filt.Q.value=1.2; filt.connect(g);
    const oscs=[55,82.4,110,164.8].map((f,i)=>{
      const o=c.createOscillator(); o.type=i%2?'sine':'triangle'; o.frequency.value=f; o.detune.value=(i-1.5)*7;
      const og=c.createGain(); og.gain.value=[0.5,0.3,0.22,0.12][i]; o.connect(og); og.connect(filt); o.start(t); return o;
    });
    // slow filter drift = "the world breathing"
    const lfo=c.createOscillator(),lg=c.createGain(); lfo.frequency.value=0.045; lg.gain.value=90;
    lfo.connect(lg); lg.connect(filt.frequency); lfo.start(t);
    this.currentTrack={g,oscs:[...oscs,lfo],kind:'ambient'}; this.musicOn=true;
  },
  startBossMusic(boss){
    if(!this.ready) return; this.stopMusic();
    const c=this.ctx, t=c.currentTime;
    const cfg={vharos:{bpm:62,root:146.83,name:'D minor',perc:false},      // Vol 6 §6.1.6
               karrag:{bpm:96,root:110.00,name:'A minor 7/8',perc:true},   // Vol 6 §6.2.6 — anvil ostinato
               sovereign:{bpm:54,root:98.00,name:'G minor',perc:false}}[boss]||{bpm:72,root:110};
    const g=c.createGain(); g.gain.value=0; g.gain.linearRampToValueAtTime(0.30,t+1.2); g.connect(this.musBus);
    const oscs=[];
    // drone fifth
    [cfg.root,cfg.root*1.5,cfg.root*2].forEach((f,i)=>{
      const o=c.createOscillator(); o.type=i?'triangle':'sawtooth'; o.frequency.value=f; o.detune.value=(i-1)*9;
      const og=c.createGain(); og.gain.value=[0.20,0.13,0.07][i];
      const lp=c.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=i?900:520;
      o.connect(og); og.connect(lp); lp.connect(g); o.start(t); oscs.push(o);
    });
    // generative ostinato on a scheduler
    const spb=60/cfg.bpm; let step=0, next=t+0.1, timer=null;
    const scale=[0,2,3,5,7,8,10]; // natural minor
    const sched=()=>{
      while(next < c.currentTime+0.4){
        const s=step%16, at=next;
        if(cfg.perc && (s===0||s===3||s===7||s===10||s===14)) this.scheduleAnvil(at,0.16);
        if(s%2===0){
          const n=scale[(s*3+ (Math.random()<0.3?1:0))%7];
          this.scheduleNote(cfg.root*2*Math.pow(2,n/12), at, spb*0.9, 0.075, 'triangle');
        }
        if(s===0||s===8) this.scheduleNote(cfg.root/2, at, spb*2.2, 0.13, 'sine');
        if(boss==='vharos' && s===6) this.scheduleVoice(at,0.05);   // the single off-stage voice
        step++; next+=spb/2;
      }
      timer=setTimeout(sched,90);
    };
    sched();
    this.currentTrack={g,oscs,kind:'boss',stop:()=>clearTimeout(timer)}; this.musicOn=true;
  },
  scheduleNote(f,at,dur,gain,type='triangle'){
    const c=this.ctx,o=c.createOscillator(),g=c.createGain();
    o.type=type;o.frequency.setValueAtTime(f,at);
    g.gain.setValueAtTime(0,at);g.gain.linearRampToValueAtTime(gain,at+0.02);g.gain.exponentialRampToValueAtTime(0.0008,at+dur);
    o.connect(g);g.connect(this.musBus);o.start(at);o.stop(at+dur+0.05);
  },
  scheduleAnvil(at,gain){
    const c=this.ctx,s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();
    s.buffer=this.noise; f.type='bandpass'; f.frequency.setValueAtTime(2600,at); f.Q.value=4;
    g.gain.setValueAtTime(gain,at); g.gain.exponentialRampToValueAtTime(0.0008,at+0.22);
    s.connect(f);f.connect(g);g.connect(this.musBus);s.start(at);s.stop(at+0.3);
    this.scheduleNote(110,at,0.18,gain*0.7,'square');
  },
  scheduleVoice(at,gain){
    const c=this.ctx,o=c.createOscillator(),o2=c.createOscillator(),g=c.createGain(),f=c.createBiquadFilter();
    o.type='sine'; o2.type='triangle';
    const n=[293.66,349.23,440,523.25][Math.floor(Math.random()*4)];
    o.frequency.setValueAtTime(n,at); o2.frequency.setValueAtTime(n*1.005,at);
    f.type='bandpass'; f.frequency.value=n*2.2; f.Q.value=2;
    g.gain.setValueAtTime(0,at); g.gain.linearRampToValueAtTime(gain,at+0.5); g.gain.linearRampToValueAtTime(0,at+2.4);
    o.connect(f);o2.connect(f);f.connect(g);g.connect(this.musBus);
    o.start(at);o2.start(at);o.stop(at+2.6);o2.stop(at+2.6);
  },
  stopMusic(){
    if(!this.currentTrack) return;
    const tr=this.currentTrack; this.currentTrack=null; this.musicOn=false;
    try{ tr.stop&&tr.stop(); tr.g.gain.cancelScheduledValues(this.t());
      tr.g.gain.setValueAtTime(tr.g.gain.value,this.t());
      tr.g.gain.linearRampToValueAtTime(0.0001,this.t()+0.7);
      setTimeout(()=>tr.oscs.forEach(o=>{try{o.stop()}catch(e){}}),900);
    }catch(e){}
  },
  fadeMusicTo(v,dur=1.5){ if(this.currentTrack&&this.ready){ const g=this.currentTrack.g,t=this.t();
    g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value,t); g.gain.linearRampToValueAtTime(v,t+dur); } },
};

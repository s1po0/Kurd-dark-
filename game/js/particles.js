/* =====================================================================
   particles.js — VFX pool + screen shake + floating text + camera
   Vol 6 (arena fx), Vol 9 (hit feedback), Vol 1 §1.9 (ash & ember tone)
   ===================================================================== */
'use strict';
const FX = {
  parts:[], texts:[], MAX:900,
  emit(x,y,n,opt={}){
    if(this.parts.length>this.MAX) return;
    for(let i=0;i<n;i++){
      const a = opt.dir!==undefined ? opt.dir + rnd(opt.spread||TAU,-(opt.spread||TAU)) : rnd(TAU);
      const sp = rnd(opt.spd||90, (opt.spd||90)*0.25);
      this.parts.push({
        x, y, vx:Math.cos(a)*sp + (opt.vx||0), vy:Math.sin(a)*sp + (opt.vy||0),
        life: rnd(opt.life||0.6,(opt.life||0.6)*0.4), t:0,
        r: rnd(opt.r||2.6,(opt.r||2.6)*0.4), col: Array.isArray(opt.col)?pick(opt.col):(opt.col||'#e2703a'),
        grav: opt.grav??120, drag: opt.drag??1.6, kind: opt.kind||'dot', spin: rnd(6,-6),
        glow: opt.glow??false, fade: opt.fade??1, shrink: opt.shrink??1,
      });
    }
  },
  update(dt){
    for(let i=this.parts.length-1;i>=0;i--){
      const p=this.parts[i]; p.t+=dt;
      if(p.t>=p.life){ this.parts.splice(i,1); continue }
      p.vy += p.grav*dt;
      p.vx -= p.vx*p.drag*dt; p.vy -= p.vy*p.drag*dt*0.5;
      p.x += p.vx*dt; p.y += p.vy*dt;
      if(p.kind==='ground'){ p.vy=0; p.grav=0 }
    }
    for(let i=this.texts.length-1;i>=0;i--){
      const t=this.texts[i]; t.t+=dt; if(t.t>=t.life) this.texts.splice(i,1);
      else { t.y += t.vy*dt; t.vy -= t.vy*2.2*dt }
    }
  },
  text(x,y,str,col='#e8cf94',size=13,vy=-46,life=0.95){
    if(this.texts.length>90) this.texts.shift();
    this.texts.push({x,y,str,col,size,vy,life,t:0});
  },
  clear(){ this.parts.length=0; this.texts.length=0 },

  /* ---- named effects ---- */
  ash(x,y,n=10){ this.emit(x,y,n,{col:['#6d6357','#8a7f70','#4a423a'],spd:38,life:2.6,r:1.8,grav:-9,drag:0.5,kind:'ground'}) },
  ember(x,y,n=14){ this.emit(x,y,n,{col:['#e2703a','#c8862a','#ffd08a'],spd:70,life:1.1,r:2.2,grav:-42,glow:true}) },
  blood(x,y,dir,n=16){ this.emit(x,y,n,{col:['#8e1f1f','#c8453f','#5d1414'],dir,spread:1.1,spd:190,life:0.7,r:2.6}) },
  hitSpark(x,y,dir,n=10){ this.emit(x,y,n,{col:['#fff2d0','#e8cf94','#c8a35a'],dir,spread:0.9,spd:250,life:0.28,r:2.0,glow:true}) },
  blockSpark(x,y,dir){ this.emit(x,y,12,{col:['#cfe3ff','#8fb4e0','#ffffff'],dir,spread:1.2,spd:210,life:0.24,r:1.8,glow:true}) },
  parryFlash(x,y){ this.emit(x,y,26,{col:['#ffffff','#ffe9b0','#c8a35a'],spd:280,life:0.35,r:2.6,glow:true,grav:0});
    this.emit(x,y,10,{col:['#fff'],spd:60,life:0.5,r:9,glow:true,grav:0,kind:'ground'}) },
  postureBreak(x,y){ this.emit(x,y,40,{col:['#ffd08a','#e2703a','#fff2d0'],spd:240,life:0.9,r:3.2,glow:true,grav:60}) },
  soul(x,y,n=8){ this.emit(x,y,n,{col:['#cfe8d8','#9fd8c0','#e8fff4'],spd:52,life:1.4,r:2.0,grav:-24,glow:true}) },
  fire(x,y,n=16){ this.emit(x,y,n,{col:['#ffd08a','#e2703a','#8e2a12'],spd:120,life:0.55,r:3.4,grav:-140,glow:true}) },
  dark(x,y,n=18){ this.emit(x,y,n,{col:['#9a6fd0','#4a2d6b','#1a0f24'],spd:100,life:0.9,r:3.6,grav:-30,glow:true}) },
  lightning(x,y){ this.emit(x,y,22,{col:['#ffffff','#cfe8ff','#8fb4e0'],spd:300,life:0.22,r:2.0,glow:true,grav:0}) },
  frost(x,y,n=10){ this.emit(x,y,n,{col:['#cfeeff','#9fd8ee','#ffffff'],spd:70,life:1.2,r:2.2,grav:-14,glow:true}) },
  poison(x,y,n=8){ this.emit(x,y,n,{col:['#9ac87f','#4c6b3a','#6fae63'],spd:40,life:1.6,r:2.4,grav:-18}) },
  dust(x,y,n=6){ this.emit(x,y,n,{col:['#6d6357','#4a423a'],spd:60,life:0.5,r:2.6,grav:40}) },
  sever(x,y){ this.emit(x,y,44,{col:['#ffd08a','#e2703a','#8e1f1f','#fff2d0'],spd:290,life:1.1,r:3.0,glow:true});
    this.emit(x,y,16,{col:['#8e1f1f','#c8453f'],spd:170,life:1.6,r:3.4}) },
  levelUp(x,y){ this.emit(x,y,60,{col:['#e8cf94','#fff2d0','#c8a35a'],spd:120,life:1.8,r:2.6,grav:-70,glow:true}) },
  bonfireRest(x,y){ this.emit(x,y,50,{col:['#e2703a','#ffd08a','#c8862a'],spd:100,life:2.2,r:2.6,grav:-60,glow:true}) },
  death(x,y){ this.emit(x,y,70,{col:['#6d6357','#4a423a','#8a7f70','#2a241d'],spd:130,life:2.4,r:3.0,grav:40});
    this.emit(x,y,26,{col:['#cfe8d8','#9fd8c0'],spd:70,life:2.0,r:2.2,grav:-40,glow:true}) },
  want(x,y){ this.emit(x,y,30,{col:['#9a6fd0','#4a2d6b','#c9a8f0'],spd:140,life:1.4,r:3.0,grav:-50,glow:true}) },

  draw(g,cam){
    g.save();
    for(const p of this.parts){
      const k=1-p.t/p.life, a=Math.pow(k,p.fade);
      const r=p.r*(p.shrink?k:1);
      const sx=p.x-cam.x, sy=p.y-cam.y;
      if(sx<-40||sy<-40||sx>cam.w+40||sy>cam.h+40) continue;
      g.globalAlpha=a;
      if(p.glow){ g.shadowBlur=8; g.shadowColor=p.col } else g.shadowBlur=0;
      g.fillStyle=p.col;
      if(p.kind==='ground'){ g.beginPath(); g.arc(sx,sy,r,0,TAU); g.fill() }
      else { g.fillRect(sx-r,sy-r,r*2,r*2) }
    }
    g.globalAlpha=1; g.shadowBlur=0;
    if(SETTINGS.dmgNumbers){
      g.textAlign='center';
      for(const t of this.texts){
        const k=1-t.t/t.life;
        g.globalAlpha=Math.min(1,k*2.2);
        g.font=`${t.size}px "Iowan Old Style",Georgia,serif`;
        g.lineWidth=3; g.strokeStyle='rgba(0,0,0,.85)';
        const sx=t.x-cam.x, sy=t.y-cam.y;
        g.strokeText(t.str,sx,sy); g.fillStyle=t.col; g.fillText(t.str,sx,sy);
      }
      g.globalAlpha=1;
    }
    g.restore();
  },
};

/* ---------- camera with shake and lock-on framing ---------- */
const Cam = {
  x:0,y:0,w:960,h:540, shake:0, shakeT:0, tx:0,ty:0, lead:0.34,
  set(w,h){ this.w=w; this.h=h },
  follow(t,dt,aim){
    let gx=t.x-this.w/2, gy=t.y-this.h/2;
    if(aim){ gx=lerp(gx, aim.x-this.w/2, this.lead*0.5); gy=lerp(gy, aim.y-this.h/2, this.lead*0.5) }
    this.tx=gx; this.ty=gy;
    const s = 1-Math.pow(0.0016,dt);
    this.x=lerp(this.x,this.tx,s); this.y=lerp(this.y,this.ty,s);
    if(this.shake>0){
      this.shakeT-=dt;
      const amp = SETTINGS.shake ? this.shake : this.shake*0.25;
      this.x += rnd(amp,-amp); this.y += rnd(amp,-amp);
      if(this.shakeT<=0) this.shake=Math.max(0,this.shake-8*dt*60);
    }
    this.shake=Math.max(0,this.shake-26*dt);
  },
  kick(amt,dur=0.22){ if(!SETTINGS.shake) return; this.shake=Math.max(this.shake,amt); this.shakeT=Math.max(this.shakeT,dur) },
  clampTo(w,h){ this.x=clamp(this.x,0,Math.max(0,w-this.w)); this.y=clamp(this.y,0,Math.max(0,h-this.h)) },
  apply(g){ g.translate(-Math.round(this.x),-Math.round(this.y)) },
};

/* ---------- hitstop (the souls "impact freeze") ---------- */
const HitStop = { t:0, set(f){ if(SETTINGS.hitstop) this.t=Math.max(this.t,f/FPS) }, tick(dt){ if(this.t>0){this.t-=dt;return true} return false } };

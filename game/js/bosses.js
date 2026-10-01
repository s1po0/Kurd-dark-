/* =====================================================================
   bosses.js — the three fully realised encounters of Vol 6
   §6.1 Vharos, the Ashen Herald      (22 moves, tail severance)
   §6.2 Karrag, the Ember-Forged      (24 moves, crown severance)
   §6.0 The Hollow Sovereign          (tutorial boss, 10 moves)
   Every move obeys the boss grammar: ≥12 frames of telegraph, reads are
   delayed, one arena transformation, one severable part.
   ===================================================================== */
'use strict';

/* move shape: {n, w, tele, act, rec, dmg, pd, post, rng, arc, kind, ...}
   tele/act/rec are FRAMES at 60 fps — Vol 6 move tables */
class Boss extends Actor {
  constructor(id,x,y,zone){
    const B=BOSSES[id];
    super(x,y,id==='sovereign'?20:26);
    this.id=id; this.def_=B; this.name=B.n; this.zone=zone;
    this.isBoss=true; this.team='enemy';
    this.maxHp=Math.round(B.hp*(1+(Game.ascetic[zone.id]||0)*0.25));
    this.hp=this.maxHp;
    this.dmgMul=B.grade>=5?1.0:0.9;
    this.poise=B.poise; this.threshold=poiseThreshold(B.poise);
    this.grade=B.grade; this.mitigation=poiseMitigation(B.poise);
    this.maxPostureOverride=B.posture; this.posture=0;
    this.def=60+B.poise*1.1; this.res={fire:id==='karrag'?70:14,dark:22,lightning:10,phys:0};
    this.soulValue=Math.round(B.souls*ASCETIC[Game.ascetic[zone.id]||0].souls);
    this.phase=0; this.phaseT=0; this.transition=0;
    this.moves=[]; this.move=null; this.moveT=0; this.cd=1.2; this.strafeDir=1; this.strafeT=2;
    this.moveCd={}; this.guarding=false; this.parryT=0; this.guardStab=100; this.shield=null; this.leapH=0; this.hitT=0;
    this.readT=0; this.punish=null; this.bossStaggered=false;
    this.part = B.part? {n:B.part.n, type:B.part.dmgType, hp:(B.part.hp||Math.round(this.maxHp*0.11)),
      max:(B.part.hp||Math.round(this.maxHp*0.11)), sev:false, reward:B.part.reward} : null;
    this.arena=B.arena||null; this.entered=false; this.dead2=false;
    this.facing=Math.PI/2; this.bob=0; this.rageT=0;
    this.addsT=0; this.hazards=[]; this.pillars=[];
    this.music=B.music; this.introduced=false;
    this.hitSet=new Set();
  }
  get maxPosture(){ return this.maxPostureOverride }
  get phaseFrac(){ return this.hp/this.maxHp }

  introduce(){
    if(this.introduced) return; this.introduced=true;
    Game.bossFight=this; Audio_.startBossMusic(this.id); Audio_.roar(this.grade>=4);
    Cam.kick(12,.7);
    Game.toast(this.name.toUpperCase(),3.2);
  }

  update(dt,t,player){
    if(this.dead){ this.dying+=dt; return }
    this.tickStatus(dt);
    this.hitT=Math.max(0,(this.hitT||0)-dt);
    if(this.hitSet.size && (!this.move || this.moveT>this.move.tele+this.move.act+this.move.rec)) this.hitSet.clear();

    /* ---------- phase gate (Vol 6 §6.0 rule 6) ---------- */
    const gates=this.def_.phases;
    if(this.phase<gates.length-1 && this.phaseFrac<=gates[this.phase+1].at && this.transition<=0){
      this.beginTransition(gates[this.phase+1].n);
    }
    if(this.transition>0){ this.tickTransition(dt,player); return }
    if(this.stagger>0){ this.state='stagger'; this.move=null; return }

    /* ---------- input reading (Vol 6 §6.0 rule 2/3) ---------- */
    this.readT-=dt;
    if(!player.dead){
      if((player.drink||player.gemT>0||player.cast) && this.readT<=0){
        this.readT=1.6; this.punish={t:0.62, kind:'heal'};   // DELAYED — never a guaranteed punish
      }
      if(player.state==='roll' && this.move && this.moveT<this.move.tele && Math.random()<dt*2.6){
        this.moveT -= 8/FPS;                                  // hold the swing for roll recovery
        this.punish={t:0.1,kind:'roll'};
      }
    }
    if(this.punish){ this.punish.t-=dt; if(this.punish.t<=0) this.punish=null }

    /* ---------- move execution ---------- */
    if(this.move){ this.tickMove(dt,t,player); return }

    this.cd-=dt;
    const d=dist(this,player);
    const ang=Math.atan2(player.y-this.y,player.x-this.x);
    this.facing = this.move? this.facing : lerp(this.facing,this.facing+angDiff(this.facing,ang),Math.min(1,dt*7));

    /* ---------- positioning ---------- */
    const want=this.preferredRange();
    if(d>want+18){
      const sp=this.speed()*dt;
      this.x+=Math.cos(ang)*sp; this.y+=Math.sin(ang)*sp; this.state='walk'; this.bob+=dt*4;
    } else if(d<want-40){
      const sp=this.speed()*0.55*dt;
      this.x-=Math.cos(ang)*sp; this.y-=Math.sin(ang)*sp; this.state='walk';
    } else {
      this.strafeT-=dt; if(this.strafeT<=0){ this.strafeT=rnd(2.6,1.1); this.strafeDir*=-1 }
      const sa=ang+Math.PI/2*this.strafeDir, sp=this.speed()*0.62*dt;
      this.x+=Math.cos(sa)*sp; this.y+=Math.sin(sa)*sp; this.state='strafe'; this.bob+=dt*5;
    }
    this.contain();

    /* ---------- pick a move ---------- */
    if(this.cd<=0){
      const m=this.pickMove(d,player);
      if(m) this.startMove(m,player,d);
      else this.cd=0.25;
    }
    /* ---------- add summons ---------- */
    this.addsT-=dt;
    if(this.addsT<=0){ this.addsT=rnd(26,16); this.tryAdds(player) }
  }
  contain(){
    const a=this.arena;
    if(a){ this.x=clamp(this.x,a.x+this.r,a.x+a.w-this.r); this.y=clamp(this.y,a.y+this.r,a.y+a.h-this.r) }
    else World.contain(this);
  }
  speed(){ return (this.id==='sovereign'?96:this.id==='karrag'?84:104) * (this.phase>0?1.16:1) * (1+Game.ascetic[this.zone.id]*0.04) }
  preferredRange(){
    const m=this.nextPref||null;
    return this.id==='karrag'? 66 : this.id==='vharos'? 78 : 52;
  }
  pickMove(d,player){
    const pool=this.moves.filter(m=>{
      if(m.phase!==undefined && m.phase!==this.phase) return false;
      if(m.phaseMin!==undefined && this.phase<m.phaseMin) return false;
      if(m.cd && (this.moveCd[m.n]||0)>0) return false;
      if(m.minD!==undefined && d<m.minD) return false;
      if(m.maxD!==undefined && d>m.maxD) return false;
      return true;
    });
    if(!pool.length) return null;
    if(this.punish){
      const p=pool.find(m=>m.punishable!==false && (m.maxD===undefined||d<=m.maxD+50));
      if(p){ this.punish=null; return p }
    }
    let tot=pool.reduce((a,m)=>a+m.w,0), r=Math.random()*tot;
    for(const m of pool){ r-=m.w; if(r<=0) return m }
    return pool[0];
  }
  startMove(m,player,d){
    this.move=m; this.moveT=0; this.hitSet.clear();
    this.state='attack';
    this.moveCd=this.moveCd||{}; if(m.cd) this.moveCd[m.n]=m.cd;
    this.facing=Math.atan2(player.y-this.y,player.x-this.x);
    this.startPos={x:this.x,y:this.y};
    this.targetPos = m.dash? {x:this.x+Math.cos(this.facing)*(m.dash),y:this.y+Math.sin(this.facing)*(m.dash)} : null;
    if(m.roar) { Audio_.roar(true); Cam.kick(9,.5) }
    Audio_.swing(m.dmg>150,m.post>40);
    if(m.anvil) Audio_.anvil();
    this.cd = (m.rec+m.tele+2)/FPS*rnd(1.25,0.72)/(1+Game.aggression*0.35);
  }
  tickMove(dt,t,player){
    const m=this.move;
    this.moveT+=dt;
    const tele=m.tele/FPS, act=m.act/FPS, rec=m.rec/FPS;
    // movement during the move
    if(m.dash && this.moveT>tele && this.moveT<tele+act*0.8 && this.targetPos){
      const k=Math.min(1,(this.moveT-tele)/(act*0.8));
      this.x=lerp(this.startPos.x,this.targetPos.x,k); this.y=lerp(this.startPos.y,this.targetPos.y,k);
      this.contain();
      if(Math.random()<dt*40) FX.dust(this.x,this.y+this.r*0.6,2);
    }
    if(m.turn && this.moveT<tele){
      const a=Math.atan2(player.y-this.y,player.x-this.x);
      this.facing=lerp(this.facing,this.facing+angDiff(this.facing,a),Math.min(1,dt*m.turn));
    }
    // active frames: resolve
    if(this.moveT>=tele && this.moveT<tele+act){
      const p=(this.moveT-tele)/act;
      this.resolveActive(dt,t,player,m,p);
    }
    if(this.moveT>=tele+act+rec){
      this.onMoveEnd(m,player);
      this.move=null; this.state='idle';
    }
  }
  resolveActive(dt,t,player,m,p){ /* overridden per boss */ }
  onMoveEnd(m,player){}
  hitPlayer(player,m,mult=1,type='phys'){
    if(player.dead||player.iframe>0) return;
    Game.applyHit(player,this,{
      dmg:(m.dmg||120)*mult*this.dmgMul*(1+(Game.ascetic[this.zone.id]||0)*0.14),
      poiseDmg:(m.pd||40), posture:0, type, knock:m.knock||16,
      burn:m.burn||0, poison:m.poison||0, boss:true});
  }
  /* ---------- phase transition: invulnerable, and it MOVES THE FIGHT ---------- */
  beginTransition(name){
    this.transition=3.4; this.transName=name; this.move=null; this.state='transition';
    this.invuln=3.4; Audio_.phaseShift(); Audio_.roar(true); Cam.kick(16,1.4);
    Game.toast(name.toUpperCase(),3.0);
    FX.postureBreak(this.x,this.y);
    this.phase++;
  }
  tickTransition(dt,player){
    this.transition-=dt;
    this.bob+=dt*10;
    if(Math.random()<dt*70) FX.ember(this.x+rnd(40,-40),this.y+rnd(40,-40),2);
    if(this.id==='vharos' && this.phase===1) this.transformArenaVharos(dt);
    if(this.id==='karrag' && this.phase===1) this.transformArenaKarrag(dt);
    if(this.id==='sovereign' && this.phase===1) this.transformArenaSovereign(dt);
    if(this.transition<=0){
      this.invuln=0; this.state='idle'; this.cd=0.7; this.bossStaggered=false; this.posture=0;
      Audio_.roar(false);
    }
  }
  transformArenaVharos(dt){
    // Vol 6 §6.1.5 — the nave floods with standing ash; four pillars rise and STAY
    if(!this._p2){ this._p2=true;
      const a=this.arena;
      const pts=[[0.22,0.26],[0.78,0.26],[0.22,0.74],[0.78,0.74]];
      for(const [u,v] of pts){
        const px=a.x+a.w*u, py=a.y+a.h*v;
        this.pillars.push({x:px,y:py,r:26,h:0});
        World.solids.push({x:px-24,y:py-24,w:48,h:48,pillar:true});
      }
      Game.arenaTint={col:'rgba(110,96,78,0.14)'};
    }
    for(const p of this.pillars) p.h=Math.min(1,p.h+dt*0.5);
  }
  transformArenaKarrag(dt){
    // Vol 6 §6.2.5 — the furnace floor breaks open. Molten patches, permanent.
    if(!this._p2){ this._p2=true;
      const a=this.arena;
      for(let i=0;i<9;i++){
        const px=a.x+rnd(a.w-60,30), py=a.y+rnd(a.h-60,30);
        World.hazards.push({x:px,y:py,w:rnd(110,54),h:rnd(90,44),t:'molten',dmg:34,boss:true});
      }
      Game.arenaTint={col:'rgba(226,112,58,0.12)'};
      Audio_.anvil(); Audio_.anvil();
    }
  }
  transformArenaSovereign(dt){
    // Vol 6 §6.0 — the throne collapses into the arena and becomes cover
    if(!this._p2){ this._p2=true;
      const a=this.arena;
      for(let i=0;i<5;i++){
        const px=a.x+rnd(a.w-70,40), py=a.y+rnd(a.h-70,40);
        World.solids.push({x:px,y:py,w:34,h:26,debris:true});
        FX.death(px,py);
      }
      Game.arenaTint={col:'rgba(90,60,50,0.13)'};
    }
  }
  tryAdds(player){}
  beginDeath(){
    if(this.dead) return;
    this.dead=true; this.dying=0.0001; this.state='dying';
    Game.onBossDeath(this);
  }
  /* ---------- severance (Vol 3 §3.9 / Vol 6 §6.x.5) ---------- */
  partPos(t){
    const a=this.facing+Math.PI+Math.sin(t*1.4)*0.34;
    return {x:this.x+Math.cos(a)*this.r*1.5, y:this.y+Math.sin(a)*this.r*1.5, ang:a};
  }
  hitPart(dmg,type,src){
    if(!this.part||this.part.sev) return false;
    const ok = this.part.type==='ANY' || type===this.part.type ||
      (this.part.type==='SLASH' && ['phys'].includes(type));
    if(!ok){ FX.text(this.part.x||this.x,this.y-this.r-20,'WRONG TYPE','#8d8271',10,-30,.9); return false }
    this.part.hp-=dmg*(type===this.part.type?1:0.45);
    if(this.part.hp<=0){
      this.part.sev=true; Audio_.sever(); Cam.kick(14,.8); FX.sever(this.x,this.y);
      Game.onSeverance(this);
    }
    return true;
  }

  draw(g,cam,t){
    const sx=this.x-cam.x, sy=this.y-cam.y;
    if(sx<-260||sy<-260||sx>cam.w+260||sy>cam.h+260) return;
    const dying=this.dead?Math.min(1,this.dying/3.0):0;
    g.save(); g.translate(sx,sy);
    g.globalAlpha=.5; g.fillStyle='#000';
    g.beginPath(); g.ellipse(0,this.r*0.8,this.r*(1.1-dying*0.2),this.r*0.46,0,0,TAU); g.fill();
    g.globalAlpha=1;
    if(dying>0){ g.globalAlpha=1-dying*0.9; g.rotate(dying*0.5); g.scale(1+dying*0.3,1-dying*0.35) }
    if(this.transition>0){
      const p=1-this.transition/3.4;
      g.save(); g.globalAlpha=0.30+0.25*Math.sin(t*11);
      g.fillStyle=this.phaseColor(); g.beginPath(); g.arc(0,0,this.r*(1.7+p*1.5),0,TAU); g.fill(); g.restore();
    }
    this.drawBody(g,t,dying);
    // telegraph
    if(this.move && this.moveT<this.move.tele/FPS){
      const p=this.moveT/(this.move.tele/FPS);
      this.drawTelegraph(g,p,t);
    } else if(this.move && this.moveT<(this.move.tele+this.move.act)/FPS){
      this.drawActive(g,t);
    }
    // severable part
    if(this.part){
      const pp=this.partPos(t);
      g.save(); g.translate(pp.x-this.x,pp.y-this.y); g.rotate(pp.ang);
      if(!this.part.sev){
        g.strokeStyle=this.phaseColor(); g.lineWidth=this.id==='vharos'?9:7;
        g.beginPath(); g.moveTo(0,0);
        g.quadraticTo(this.r*0.9,Math.sin(t*2.6)*7,this.r*1.7,Math.sin(t*2.6+1)*4); g.stroke();
        g.strokeStyle='rgba(255,255,255,.18)'; g.lineWidth=2;
        g.beginPath(); g.moveTo(0,-2); g.quadraticTo(this.r*0.9,Math.sin(t*2.6)*7-2,this.r*1.7,Math.sin(t*2.6+1)*4); g.stroke();
        // part health (Vol 9 §9.2 — the severance readout)
        const w=34;
        g.rotate(-pp.ang);
        g.fillStyle='rgba(0,0,0,.7)'; g.fillRect(-w/2,-this.r*1.5,w,4);
        g.fillStyle='#e2a34a'; g.fillRect(-w/2+1,-this.r*1.5+1,(w-2)*Math.max(0,this.part.hp/this.part.max),2);
        g.fillStyle='#8d8271'; g.font='7px "SFMono-Regular",Menlo,monospace'; g.textAlign='center';
        g.fillText(this.part.n.toUpperCase()+' · '+this.part.type,0,-this.r*1.5-4); g.textAlign='left';
      } else {
        g.strokeStyle='#5d1414'; g.lineWidth=6;
        g.beginPath(); g.moveTo(0,0); g.lineTo(this.r*0.5,3); g.stroke();
      }
      g.restore();
    }
    // posture/riposte
    if(this.stagger>0){
      g.strokeStyle='rgba(255,208,138,.95)'; g.lineWidth=2;
      for(let i=0;i<5;i++){ const a=t*7+i*1.26;
        g.beginPath(); g.arc(Math.cos(a)*this.r*1.4,-this.r*1.7+Math.sin(a)*4,2.6,0,TAU); g.stroke() }
      g.fillStyle='#ffd08a'; g.font='9px "SFMono-Regular",Menlo,monospace'; g.textAlign='center';
      g.fillText('RIPOSTE [F]',0,-this.r*2.3); g.textAlign='left';
    }
    g.restore();
  }
  phaseColor(){ return this.phase>0? (this.id==='karrag'?'#ff8a3a':this.id==='vharos'?'#c8b89a':'#9a6fd0') : '#e2703a' }
  drawBody(){}
  drawTelegraph(){}
  drawActive(){}
}

/* =====================================================================
   §6.1 · VHAROS, THE ASHEN HERALD
   Arena: the nave of the Sunken Cathedral, 44×24 tiles, four pillars.
   Phase I announces; Phase II the ash answers.
   ===================================================================== */
class Vharos extends Boss {
  constructor(x,y,zone){
    super('vharos',x,y,zone);
    this.r=26;
    this.moves=[
      /* ---- PHASE I : 1–11 ---- */
      {n:"Herald's Sweep",  w:20, phase:0, tele:26, act:8,  rec:34, dmg:130, pd:34, rng:118, arc:2.3, kind:'arc'},
      {n:'Ash Cascade',     w:16, phase:0, tele:34, act:14, rec:40, dmg:150, pd:44, rng:96,  arc:1.5, kind:'slam', shock:true},
      {n:"Herald's Step",   w:14, phase:0, tele:18, act:10, rec:30, dmg:110, pd:26, dash:190, rng:70, arc:1.3, kind:'lunge'},
      {n:'Summon Ash',      w:10, phase:0, tele:40, act:10, rec:46, dmg:0,   pd:0,  kind:'summon'},
      {n:'Triple Toll',     w:12, phase:0, tele:16, act:24, rec:38, dmg:82,  pd:20, rng:104, arc:1.7, kind:'combo', hits:3},
      {n:"Herald's Grasp",  w:8,  phase:0, tele:30, act:8,  rec:52, dmg:230, pd:70, rng:82,  arc:0.9, kind:'grab', punishable:true},
      {n:'Ashen Walk',      w:8,  phase:0, tele:22, act:30, rec:26, dmg:0,   pd:0,  kind:'reposition'},
      {n:'Cinder Volley',   w:10, phase:0, tele:28, act:12, rec:36, dmg:96,  pd:22, rng:520, kind:'projectiles', count:5, burn:26},
      {n:'Nave Slam',       w:9,  phase:0, tele:36, act:10, rec:44, dmg:170, pd:52, rng:130, arc:TAU, kind:'nova'},
      {n:'Herald\u2019s Decree',w:6, phase:0, tele:44, act:6, rec:56, dmg:0, pd:0, kind:'roar', roar:true, postureAura:60},
      {n:'Pike Thrust',     w:11, phase:0, tele:20, act:6,  rec:32, dmg:126, pd:30, rng:170, arc:0.42, kind:'thrust', dash:60},
      /* ---- PHASE II : 12–22 (Vol 6 §6.1.4) ---- */
      {n:'Ash Pillar',      w:16, phaseMin:1, tele:24, act:10, rec:30, dmg:180, pd:48, kind:'pillars', count:5, cd:6},
      {n:"Herald's Judgment",w:14,phaseMin:1, tele:40, act:56, rec:44, dmg:140, pd:40, kind:'beam', cd:9},
      {n:'Ashen Rain',      w:14, phaseMin:1, tele:34, act:26, rec:38, dmg:110, pd:30, kind:'rain', count:14, burn:22},
      {n:"Herald's Toll",   w:12, phaseMin:1, tele:22, act:16, rec:36, dmg:190, pd:56, dash:330, rng:80, arc:1.2, kind:'charge'},
      {n:'Ash Nova',        w:10, phaseMin:1, tele:38, act:12, rec:48, dmg:210, pd:64, rng:170, arc:TAU, kind:'nova', ring:true},
      {n:'Convergence Cry', w:8,  phaseMin:1, tele:46, act:8,  rec:54, dmg:0,   pd:0,  kind:'roar', roar:true, postureAura:90, cd:14},
      {n:'Summon Herald\u2019s Choir',w:9,phaseMin:1,tele:44,act:12,rec:50,dmg:0,pd:0,kind:'summon',count:3,cd:22},
      {n:'Ash Guillotine',  w:11, phaseMin:1, tele:30, act:10, rec:42, dmg:240, pd:70, rng:110, arc:1.1, kind:'slam', shock:true},
      {n:'Herald\u2019s Arc (wide)',w:12,phaseMin:1,tele:24,act:10,rec:34,dmg:160,pd:44,rng:150,arc:3.0,kind:'arc'},
      {n:'Cinder Storm',    w:9,  phaseMin:1, tele:36, act:34, rec:42, dmg:88,  pd:24, kind:'rain', count:22, burn:26, cd:12},
      {n:'Last Announcement',w:6, phaseMin:1, tele:52, act:14, rec:60, dmg:300, pd:90, rng:190, arc:TAU, kind:'nova', ring:true, cd:26},
    ];
  }
  resolveActive(dt,t,player,m,p){
    const key=m.n+'|'+Math.floor(p*(m.hits||1));
    switch(m.kind){
      case 'arc': case 'thrust': case 'lunge': case 'charge': case 'slam': case 'grab':
        if(!this.hitSet.has(key) && this.arcCheck(player,m)){
          this.hitSet.add(key); this.hitPlayer(player,m,1,'phys');
        }
        if(m.shock && p>0.6 && !this.hitSet.has('shock')){
          this.hitSet.add('shock'); this.shockwave(m.rng*1.7,90,m.pd*0.6); Cam.kick(10,.4); Audio_.hit(false,true);
          FX.dust(this.x+Math.cos(this.facing)*m.rng*0.7,this.y+Math.sin(this.facing)*m.rng*0.7,26);
        }
        break;
      case 'combo': {
        const idx=Math.min((m.hits||3)-1,Math.floor(p*(m.hits||3)));
        if(!this.hitSet.has('c'+idx)){
          const a=this.facing+(idx-1)*0.42;
          if(arcHits(this.x,this.y,a,1.7,m.rng,player.x,player.y,player.r)){ this.hitSet.add('c'+idx); this.hitPlayer(player,m,1,'phys') }
          FX.hitSpark(this.x+Math.cos(a)*m.rng*0.8,this.y+Math.sin(a)*m.rng*0.8,a,10);
          Audio_.swing(idx===2);
        }
        break; }
      case 'nova':
        if(!this.hitSet.has('nova')){
          const rr=m.rng*(m.ring? (0.35+p*0.9) : 1);
          if(dist(this,player)<rr+player.r){ this.hitSet.add('nova'); this.hitPlayer(player,m,1,'phys') }
          else if(p>0.92) this.hitSet.add('nova');
        }
        if(m.ring){ Cam.kick(6,.3); if(Math.random()<dt*30) FX.ember(this.x,this.y,2) }
        break;
      case 'projectiles': {
        const idx=Math.floor(p*(m.count||5));
        if(!this.hitSet.has('p'+idx)){
          this.hitSet.add('p'+idx);
          const a=this.facing+rnd(0.34,-0.34);
          Game.spawnProjectile(this.x+Math.cos(a)*this.r,this.y+Math.sin(a)*this.r,a,{
            spd:400,dmg:m.dmg*this.dmgMul,type:'fire',team:'enemy',src:this,pd:m.pd,life:1.6,burn:m.burn,orb:'ash'});
          Audio_.fire();
        }
        break; }
      case 'rain': {
        const idx=Math.floor(p*(m.count||12));
        if(!this.hitSet.has('r'+idx)){
          this.hitSet.add('r'+idx);
          const a=this.arena;
          const tx = a? a.x+rnd(a.w) : this.x+rnd(360,-360);
          const ty = a? a.y+rnd(a.h) : this.y+rnd(300,-300);
          Game.spawnHazard({x:tx,y:ty,r:34,delay:0.62,life:0.5,dmg:m.dmg*this.dmgMul,pd:m.pd,type:'fire',
            src:this,burn:m.burn,kind:'ashfall'});
        }
        break; }
      case 'pillars': {
        const idx=Math.floor(p*(m.count||5));
        if(!this.hitSet.has('pl'+idx)){
          this.hitSet.add('pl'+idx);
          // read the player's CURRENT position, then delay — reactable by moving (Vol 6 §6.1.3)
          Game.spawnHazard({x:player.x,y:player.y,r:44,delay:0.85,life:0.7,dmg:m.dmg*this.dmgMul,pd:m.pd,
            type:'phys',src:this,kind:'pillar'});
        }
        break; }
      case 'beam': {
        // a sweeping line: rotate across the arena, damage on contact each frame
        const a0=this.beamA0!==undefined?this.beamA0:(this.beamA0=this.facing-1.05);
        const a=a0+p*2.1;
        this.beamAng=a;
        const len=520;
        if(segHitsCircle(this.x,this.y,this.x+Math.cos(a)*len,this.y+Math.sin(a)*len,player.x,player.y,player.r)){
          if(!this.hitSet.has('b'+Math.floor(p*8))){ this.hitSet.add('b'+Math.floor(p*8)); this.hitPlayer(player,m,0.62,'fire') }
        }
        break; }
      case 'summon':
        if(!this.hitSet.has('s')){ this.hitSet.add('s'); this.doSummon(m) }
        break;
      case 'roar':
        if(!this.hitSet.has('roar')){ this.hitSet.add('roar');
          this.shockwave(300,m.postureAura||60,0,true); Audio_.roar(true); Cam.kick(12,.6);
          FX.postureBreak(this.x,this.y); }
        break;
      case 'reposition':
        if(!this.hitSet.has('rp')){ this.hitSet.add('rp');
          const a=this.arena; if(a){ this.x=a.x+rnd(a.w*0.8,a.w*0.1); this.y=a.y+rnd(a.h*0.8,a.h*0.1) }
          FX.ash(this.x,this.y,26); Audio_.noiseHit?.(0.4,{gain:0.12,freq:800,sweep:200});
        }
        break;
    }
  }
  arcCheck(player,m){
    const a = m.kind==='combo'? this.facing : this.facing;
    return arcHits(this.x,this.y,a,m.arc||1.6,m.rng+this.r*0.5,player.x,player.y,player.r);
  }
  onMoveEnd(m){ if(m.kind==='beam') this.beamA0=undefined }
  shockwave(radius,posture,pd,aura=false){
    const p=Game.player;
    if(dist(this,p)<radius){
      if(aura){ p.posture+=posture; p.postureT=POSTURE_DECAY_DELAY;
        if(p.posture>=p.maxPosture){ p.posture=0; p.postureImmune=POSTURE_IMMUNE; p.stagger=POSTURE_STAGGER; p.state='stagger';
          Audio_.postureBreak(); FX.postureBreak(p.x,p.y); Game.toast('POSTURE BROKEN BY THE DECREE') } }
      else Game.applyHit(p,this,{dmg:90*this.dmgMul,poiseDmg:pd,type:'phys',knock:22,boss:true});
    }
    FX.ember(this.x,this.y,30);
  }
  doSummon(m){
    const n=m.count||(this.phase?3:2);
    for(let i=0;i<n;i++){
      const a=this.arena, x=a? a.x+rnd(a.w-40,20):this.x+rnd(120,-120), y=a? a.y+rnd(a.h-40,20):this.y+rnd(100,-100);
      Game.spawnEnemy(this.phase?'hollowk':'wretch',x,y,{hpMult:0.8,soulsMult:0.5,spawn:true,bossAdd:true});
      FX.dark(x,y,16);
    }
    Audio_.dark(); Game.toast('THE ASH ANSWERS');
  }
  tryAdds(player){ if(this.phase>=1 && Game.enemies.filter(e=>e.bossAdd&&!e.dead).length<3) this.doSummon({count:1}) }

  drawBody(g,t,dying){
    const r=this.r, ph=this.phase;
    const step=Math.sin(this.bob)*2;
    // ash aura in phase II
    if(ph>=1){
      const gr=g.createRadialGradient(0,0,r*0.4,0,0,r*2.6);
      gr.addColorStop(0,'rgba(200,184,154,.20)'); gr.addColorStop(1,'rgba(200,184,154,0)');
      g.fillStyle=gr; g.beginPath(); g.arc(0,0,r*2.6,0,TAU); g.fill();
    }
    // cloak
    g.fillStyle=this.hitFlash>0?'#fff':(ph?'#8f8474':'#6d6357');
    g.beginPath();
    g.moveTo(-r*0.95,r*1.05+step*0.3); g.lineTo(-r*0.62,-r*0.75); g.lineTo(0,-r*1.18);
    g.lineTo(r*0.62,-r*0.75); g.lineTo(r*0.95,r*1.05+step*0.3);
    g.quadraticTo(0,r*1.45,-r*0.95,r*1.05+step*0.3); g.fill();
    // herald's sash
    g.fillStyle=ph?'#c8a35a':'#8a6a3a';
    g.beginPath(); g.moveTo(-r*0.5,-r*0.5); g.lineTo(r*0.42,r*0.6); g.lineTo(r*0.18,r*0.78); g.lineTo(-r*0.7,-r*0.3); g.closePath(); g.fill();
    // head + crown of ash
    g.fillStyle=this.hitFlash>0?'#fff':'#3a322a';
    g.beginPath(); g.arc(Math.cos(this.facing)*3,Math.sin(this.facing)*3-r*0.86,r*0.40,0,TAU); g.fill();
    g.fillStyle=ph?'#e8cf94':'#b0a48c';
    for(let i=0;i<5;i++){ const a=-Math.PI*0.85+i*Math.PI*0.175;
      g.save(); g.translate(Math.cos(this.facing)*3,Math.sin(this.facing)*3-r*0.86); g.rotate(a+Math.PI/2);
      g.fillRect(-1.4,-r*0.62-(i===2?6:0),2.8,r*0.42); g.restore() }
    // eyes
    g.fillStyle=ph?'#ffe9b0':'#e2703a'; g.globalAlpha=.85+.15*Math.sin(t*5);
    g.fillRect(Math.cos(this.facing)*3-4.5,Math.sin(this.facing)*3-r*0.92,3,3);
    g.fillRect(Math.cos(this.facing)*3+1.5,Math.sin(this.facing)*3-r*0.92,3,3);
    g.globalAlpha=1;
    // the ash pike
    g.save(); g.rotate(this.facing);
    const L=r*3.0;
    g.fillStyle='#4a3f30'; g.fillRect(-r*0.2,-2.2,L,4.4);
    g.fillStyle=ph?'#e8cf94':'#b9b0a0';
    g.beginPath(); g.moveTo(L,-6); g.lineTo(L+r*0.9,0); g.lineTo(L,6); g.closePath(); g.fill();
    g.fillStyle='rgba(226,112,58,.5)'; g.fillRect(L-4,-1.4,r*0.9,2.8);
    g.restore();
  }
  drawTelegraph(g,p,t){
    const m=this.move;
    g.save(); g.rotate(this.facing);
    if(m.kind==='arc'||m.kind==='thrust'||m.kind==='combo'||m.kind==='grab'||m.kind==='charge'||m.kind==='lunge'){
      const arc=m.arc||1.4;
      g.fillStyle=`rgba(226,112,58,${0.10+0.24*p})`;
      g.beginPath(); g.moveTo(0,0); g.arc(0,0,m.rng*(0.6+0.4*p),-arc/2,arc/2); g.closePath(); g.fill();
      g.strokeStyle=`rgba(255,208,138,${0.35+0.55*p})`; g.lineWidth=2;
      g.beginPath(); g.arc(0,0,m.rng*(0.6+0.4*p),-arc/2,arc/2); g.stroke();
    } else if(m.kind==='nova'){
      const rr=m.rng*(m.ring?(0.3+p*0.9):1);
      g.strokeStyle=`rgba(255,208,138,${0.30+0.5*p})`; g.lineWidth=3;
      g.beginPath(); g.arc(0,0,rr,0,TAU); g.stroke();
      g.fillStyle=`rgba(226,112,58,${0.06+0.12*p})`; g.beginPath(); g.arc(0,0,rr,0,TAU); g.fill();
    } else if(m.kind==='slam'){
      g.fillStyle=`rgba(226,112,58,${0.14+0.3*p})`;
      g.beginPath(); g.ellipse(m.rng*0.72,0,m.rng*0.5,m.rng*0.34,0,0,TAU); g.fill();
      g.strokeStyle=`rgba(255,208,138,${0.4+0.5*p})`; g.lineWidth=2; g.stroke();
    } else if(m.kind==='beam'){
      const a0=this.beamA0!==undefined?this.beamA0:this.facing-1.05;
      g.rotate(-this.facing); g.rotate(a0);
      g.fillStyle=`rgba(255,180,90,${0.08+0.16*p})`;
      g.beginPath(); g.moveTo(0,-4); g.lineTo(520,-16); g.lineTo(520,16); g.lineTo(0,4); g.closePath(); g.fill();
      g.strokeStyle=`rgba(255,226,170,${0.3+0.5*p})`; g.lineWidth=1.4; g.stroke();
    } else {
      g.strokeStyle=`rgba(154,111,208,${0.3+0.5*p})`; g.lineWidth=2;
      g.beginPath(); g.arc(0,0,this.r*(1.5+p),0,TAU); g.stroke();
    }
    g.restore();
  }
  drawActive(g,t){
    const m=this.move;
    g.save(); g.rotate(this.facing);
    if(m.kind==='beam' && this.beamAng!==undefined){
      g.rotate(-this.facing); g.rotate(this.beamAng);
      const gr=g.createLinearGradient(0,0,520,0);
      gr.addColorStop(0,'rgba(255,226,170,.85)'); gr.addColorStop(1,'rgba(226,112,58,0)');
      g.fillStyle=gr; g.beginPath(); g.moveTo(0,-9); g.lineTo(520,-22); g.lineTo(520,22); g.lineTo(0,9); g.closePath(); g.fill();
    } else if(m.kind!=='summon'&&m.kind!=='reposition'){
      g.strokeStyle='rgba(255,240,210,.55)'; g.lineWidth=m.dmg>180?6:3.4;
      g.beginPath(); g.arc(0,0,(m.rng||110)*0.96,-(m.arc||1.5)/2,(m.arc||1.5)/2); g.stroke();
    }
    g.restore();
  }
}

/* =====================================================================
   §6.2 · KARRAG, THE EMBER-FORGED
   He is still working. The percussion of his fight is his hammer.
   ===================================================================== */
class Karrag extends Boss {
  constructor(x,y,zone){
    super('karrag',x,y,zone);
    this.r=30;
    this.moves=[
      /* ---- PHASE I : the Sovereign's Anvil (1–14) ---- */
      {n:'Anvil Slam',       w:20, phase:0, tele:30, act:8,  rec:38, dmg:190, pd:64, rng:130, arc:1.4, kind:'slam', shock:true, anvil:true},
      {n:'Forge Spin',       w:14, phase:0, tele:26, act:26, rec:40, dmg:150, pd:52, rng:140, arc:TAU, kind:'spin'},
      {n:'Molten Spit',      w:14, phase:0, tele:28, act:10, rec:34, dmg:140, pd:34, rng:520, kind:'projectiles', count:3, burn:34},
      {n:'Crown Sweep',      w:12, phase:0, tele:24, act:8,  rec:34, dmg:160, pd:48, rng:150, arc:2.6, kind:'arc'},
      {n:'Ember Stomp',      w:12, phase:0, tele:32, act:10, rec:40, dmg:170, pd:60, rng:160, arc:TAU, kind:'nova'},
      {n:'Bellows Roar',     w:8,  phase:0, tele:40, act:22, rec:44, dmg:120, pd:36, rng:420, kind:'cone', burn:40, anvil:true},
      {n:"Sovereign's Grip", w:8,  phase:0, tele:26, act:8,  rec:50, dmg:250, pd:80, rng:96, arc:0.9, kind:'grab', punishable:true},
      {n:'Slag Trail',       w:10, phase:0, tele:22, act:34, rec:30, dmg:110, pd:30, kind:'trail', burn:30, cd:8},
      {n:'Quench Step',      w:8,  phase:0, tele:18, act:26, rec:26, dmg:0,   pd:0,  kind:'reposition'},
      {n:'Hammer Combo',     w:12, phase:0, tele:18, act:30, rec:40, dmg:120, pd:44, rng:130, arc:1.6, kind:'combo', hits:3, anvil:true},
      {n:'Forge Call',       w:9,  phase:0, tele:44, act:12, rec:52, dmg:0,   pd:0,  kind:'summon', count:2, cd:20},
      {n:'Iron Verdict',     w:10, phase:0, tele:36, act:10, rec:46, dmg:210, pd:70, rng:120, arc:1.0, kind:'slam', shock:true, anvil:true},
      {n:'Cinder Charge',    w:10, phase:0, tele:24, act:18, rec:38, dmg:180, pd:58, dash:300, rng:90, arc:1.1, kind:'charge'},
      {n:'Anvil Ring',       w:8,  phase:0, tele:38, act:12, rec:46, dmg:160, pd:54, rng:200, arc:TAU, kind:'nova', ring:true, anvil:true},
      /* ---- PHASE II : MOLTEN (15–24) ---- */
      {n:'Molten Crown',     w:14, phaseMin:1, tele:34, act:14, rec:42, dmg:230, pd:70, rng:170, arc:TAU, kind:'nova', ring:true, burn:44},
      {n:'Pour the Keep',    w:14, phaseMin:1, tele:40, act:40, rec:46, dmg:150, pd:44, kind:'beam', burn:34, cd:9},
      {n:'Forge Leap',       w:12, phaseMin:1, tele:32, act:16, rec:44, dmg:260, pd:80, rng:190, arc:TAU, kind:'leap'},
      {n:'Slag Wave',        w:12, phaseMin:1, tele:28, act:12, rec:38, dmg:180, pd:56, rng:520, kind:'wave', count:4, burn:30},
      {n:'Ember Summon',     w:9,  phaseMin:1, tele:42, act:12, rec:48, dmg:0, pd:0, kind:'summon', count:3, cd:18},
      {n:'White Heat',       w:10, phaseMin:1, tele:46, act:8,  rec:54, dmg:0, pd:0, kind:'roar', roar:true, postureAura:90, cd:14},
      {n:'Anvil Flurry',     w:12, phaseMin:1, tele:16, act:36, rec:40, dmg:130, pd:48, rng:140, arc:1.7, kind:'combo', hits:4, anvil:true},
      {n:'Crown Guillotine', w:11, phaseMin:1, tele:32, act:10, rec:44, dmg:280, pd:86, rng:130, arc:1.1, kind:'slam', shock:true, anvil:true},
      {n:'Molten Charge',    w:10, phaseMin:1, tele:22, act:20, rec:40, dmg:220, pd:66, dash:380, rng:96, arc:1.2, kind:'charge', burn:30},
      {n:'The Last Pour',    w:6,  phaseMin:1, tele:54, act:16, rec:60, dmg:340, pd:100,rng:230, arc:TAU, kind:'nova', ring:true, cd:26},
    ];
  }
  resolveActive(dt,t,player,m,p){
    const key=m.n+Math.floor(p*10);
    switch(m.kind){
      case 'slam': case 'arc': case 'grab': case 'charge': case 'thrust': case 'lunge':
        if(!this.hitSet.has(m.n)){
          if(arcHits(this.x,this.y,this.facing,m.arc||1.5,m.rng+this.r*0.4,player.x,player.y,player.r)){
            this.hitSet.add(m.n); this.hitPlayer(player,m,1,'phys'); if(m.burn) player.addStatus('burn',m.burn);
          }
        }
        if(m.shock && p>0.55 && !this.hitSet.has('sh')){
          this.hitSet.add('sh'); Audio_.anvil(); Cam.kick(13,.5);
          FX.fire(this.x+Math.cos(this.facing)*m.rng*0.7,this.y+Math.sin(this.facing)*m.rng*0.7,30);
          this.shockwave(m.rng*1.6,m.dmg*0.42,m.pd*0.5);
        }
        break;
      case 'combo': {
        const idx=Math.min((m.hits||3)-1,Math.floor(p*(m.hits||3)));
        if(!this.hitSet.has('c'+idx)){
          this.hitSet.add('c'+idx); Audio_.anvil();
          const a=this.facing+(idx%2?0.5:-0.5);
          if(arcHits(this.x,this.y,a,1.7,m.rng,player.x,player.y,player.r)) this.hitPlayer(player,m,1,'phys');
          FX.hitSpark(this.x+Math.cos(a)*m.rng*0.75,this.y+Math.sin(a)*m.rng*0.75,a,12);
          Cam.kick(5,.2);
        }
        break; }
      case 'spin':
        if(!this.hitSet.has('sp'+Math.floor(p*4))){
          this.hitSet.add('sp'+Math.floor(p*4));
          this.facing+=TAU/5;
          if(arcHits(this.x,this.y,this.facing,TAU,m.rng,player.x,player.y,player.r)) this.hitPlayer(player,m,0.6,'phys');
          FX.fire(this.x,this.y,8);
        }
        break;
      case 'nova':
        if(!this.hitSet.has('n')){
          const rr=m.rng*(m.ring?(0.3+p*0.95):1);
          if(dist(this,player)<rr+player.r){ this.hitSet.add('n'); this.hitPlayer(player,m,1,m.burn?'fire':'phys');
            if(m.burn) player.addStatus('burn',m.burn) }
          else if(p>0.9) this.hitSet.add('n');
        }
        if(m.ring&&Math.random()<dt*26) FX.fire(this.x,this.y,2);
        break;
      case 'cone':
        if(!this.hitSet.has('cn'+Math.floor(p*6))){
          this.hitSet.add('cn'+Math.floor(p*6));
          if(arcHits(this.x,this.y,this.facing,0.72,m.rng*(0.4+p*0.6),player.x,player.y,player.r))
            { this.hitPlayer(player,m,0.5,'fire'); player.addStatus('burn',m.burn) }
          FX.fire(this.x+Math.cos(this.facing)*m.rng*p*0.7,this.y+Math.sin(this.facing)*m.rng*p*0.7,6);
        }
        break;
      case 'projectiles': {
        const idx=Math.floor(p*(m.count||3));
        if(!this.hitSet.has('p'+idx)){ this.hitSet.add('p'+idx);
          const a=this.facing+rnd(0.3,-0.3);
          Game.spawnProjectile(this.x+Math.cos(a)*this.r,this.y+Math.sin(a)*this.r,a,{
            spd:340,dmg:m.dmg*this.dmgMul,type:'fire',team:'enemy',src:this,pd:m.pd,life:1.8,burn:m.burn,orb:'molten'});
          Audio_.fire(); }
        break; }
      case 'wave': {
        const idx=Math.floor(p*(m.count||4));
        if(!this.hitSet.has('w'+idx)){ this.hitSet.add('w'+idx);
          for(let k=-1;k<=1;k++){
            const a=this.facing+k*0.34;
            Game.spawnProjectile(this.x+Math.cos(a)*this.r,this.y+Math.sin(a)*this.r,a,{
              spd:280,dmg:m.dmg*this.dmgMul,type:'fire',team:'enemy',src:this,pd:m.pd,life:2.0,burn:m.burn,orb:'wave',wide:true});
          }
          Audio_.fire(); }
        break; }
      case 'trail':
        if(!this.hitSet.has('t'+Math.floor(p*10))){
          this.hitSet.add('t'+Math.floor(p*10));
          World.hazards.push({x:this.x-26,y:this.y-26,w:52,h:52,t:'molten',dmg:26,bossTrail:true,life:9});
          FX.fire(this.x,this.y,8); Audio_.fire();
        }
        break;
      case 'leap':
        if(p<0.4){ this.y-=dt*40; this.leapH=(this.leapH||0)+dt*220 }
        else {
          this.leapH=Math.max(0,(this.leapH||0)-dt*520);
          if(p>0.72 && !this.hitSet.has('l')){
            this.hitSet.add('l'); Audio_.anvil(); Cam.kick(16,.7);
            FX.fire(this.x,this.y,50); FX.dust(this.x,this.y,30);
            this.shockwave(m.rng,m.dmg,m.pd);
            for(let i=0;i<6;i++){ const a=i/6*TAU;
              World.hazards.push({x:this.x+Math.cos(a)*90-24,y:this.y+Math.sin(a)*90-24,w:48,h:48,t:'molten',dmg:24,bossTrail:true,life:7}) }
          }
        }
        break;
      case 'beam': {
        const a0=this.beamA0!==undefined?this.beamA0:(this.beamA0=this.facing-1.15);
        const a=a0+p*2.3; this.beamAng=a;
        if(segHitsCircle(this.x,this.y,this.x+Math.cos(a)*540,this.y+Math.sin(a)*540,player.x,player.y,player.r)){
          if(!this.hitSet.has('b'+Math.floor(p*7))){ this.hitSet.add('b'+Math.floor(p*7));
            this.hitPlayer(player,m,0.6,'fire'); player.addStatus('burn',m.burn) }
        }
        break; }
      case 'summon': if(!this.hitSet.has('s')){ this.hitSet.add('s');
        for(let i=0;i<(m.count||2);i++){ const a=this.arena;
          const x=a?a.x+rnd(a.w-40,20):this.x+rnd(140,-140), y=a?a.y+rnd(a.h-40,20):this.y+rnd(120,-120);
          Game.spawnEnemy(this.phase?'pyro':'hollow',x,y,{hpMult:0.85,soulsMult:0.6,spawn:true,bossAdd:true}); FX.fire(x,y,18) }
        Audio_.roar(false); Game.toast('THE FORGE CALLS ITS WORKERS'); } break;
      case 'roar': if(!this.hitSet.has('r')){ this.hitSet.add('r');
        this.shockwave(320,m.postureAura,0,true); Audio_.roar(true); Cam.kick(13,.6); FX.fire(this.x,this.y,44); } break;
      case 'reposition': if(!this.hitSet.has('rp')){ this.hitSet.add('rp');
        const a=this.arena; if(a){ this.x=a.x+rnd(a.w*0.8,a.w*0.1); this.y=a.y+rnd(a.h*0.8,a.h*0.1) }
        FX.fire(this.x,this.y,30); } break;
    }
  }
  onMoveEnd(m){ if(m.kind==='beam') this.beamA0=undefined; if(m.kind==='leap') this.leapH=0 }
  shockwave(radius,dmg,pd,aura=false){
    const p=Game.player;
    if(dist(this,p)<radius){
      if(aura){ p.posture+=pd; p.postureT=POSTURE_DECAY_DELAY;
        if(p.posture>=p.maxPosture){ p.posture=0; p.postureImmune=POSTURE_IMMUNE; p.stagger=POSTURE_STAGGER; p.state='stagger';
          Audio_.postureBreak(); FX.postureBreak(p.x,p.y); Game.toast('POSTURE BROKEN BY WHITE HEAT') } }
      else Game.applyHit(p,this,{dmg:dmg*this.dmgMul,poiseDmg:pd,type:'fire',knock:26,boss:true,burn:26});
    }
  }
  tryAdds(player){ if(Game.enemies.filter(e=>e.bossAdd&&!e.dead).length<3)
    { this.hitSet.delete('s'); } }

  drawBody(g,t,dying){
    const r=this.r*(1+(this.leapH||0)*0.0016), ph=this.phase;
    // heat haze
    const gr=g.createRadialGradient(0,0,r*0.3,0,0,r*(ph?3.0:2.2));
    gr.addColorStop(0,`rgba(255,140,50,${ph?0.26:0.14})`); gr.addColorStop(1,'rgba(255,140,50,0)');
    g.fillStyle=gr; g.beginPath(); g.arc(0,0,r*(ph?3.0:2.2),0,TAU); g.fill();
    // body: a squat forged mass
    g.fillStyle=this.hitFlash>0?'#fff':(ph?'#7a3a1c':'#5c4433');
    g.beginPath();
    g.moveTo(-r,r*0.9); g.lineTo(-r*0.86,-r*0.5); g.lineTo(-r*0.3,-r); g.lineTo(r*0.3,-r);
    g.lineTo(r*0.86,-r*0.5); g.lineTo(r,r*0.9); g.closePath(); g.fill();
    // glowing seams
    g.strokeStyle=ph?'rgba(255,190,90,.95)':'rgba(226,112,58,.65)'; g.lineWidth=ph?3:2;
    for(let i=-2;i<=2;i++){
      g.beginPath(); g.moveTo(i*r*0.34,-r*0.7);
      g.lineTo(i*r*0.34+Math.sin(t*2+i)*3,r*0.7); g.stroke();
    }
    // the crown (severable, STRIKE)
    g.save(); g.translate(0,-r*1.02);
    g.fillStyle=ph?'#ffd08a':'#c8a35a';
    for(let i=0;i<7;i++){ const x=(i-3)*r*0.24;
      g.beginPath(); g.moveTo(x-r*0.1,0); g.lineTo(x,-r*0.42-(i%2?0:8)); g.lineTo(x+r*0.1,0); g.closePath(); g.fill() }
    g.fillRect(-r*0.86,-2,r*1.72,5);
    g.restore();
    // eyes
    g.fillStyle='#fff2d0'; g.globalAlpha=.9;
    g.fillRect(-r*0.34,-r*0.62,5,4); g.fillRect(r*0.2,-r*0.62,5,4); g.globalAlpha=1;
    // hammer
    g.save(); g.rotate(this.facing);
    g.fillStyle='#4a3826'; g.fillRect(r*0.1,-3,r*2.2,6);
    g.fillStyle=ph?'#e2703a':'#8a7f70';
    g.fillRect(r*2.0,-r*0.62,r*0.9,r*1.24);
    g.fillStyle='rgba(255,208,138,.5)'; g.fillRect(r*2.0+r*0.1,-r*0.5,r*0.7,r*0.3);
    g.restore();
  }
  drawTelegraph(g,p,t){
    const m=this.move;
    g.save(); g.rotate(this.facing);
    const col=m.burn? '255,150,60' : '226,112,58';
    if(m.kind==='slam'){
      g.fillStyle=`rgba(${col},${0.14+0.3*p})`;
      g.beginPath(); g.ellipse(m.rng*0.7,0,m.rng*0.55,m.rng*0.4,0,0,TAU); g.fill();
      g.strokeStyle=`rgba(255,226,170,${0.4+0.5*p})`; g.lineWidth=2.4; g.stroke();
    } else if(m.kind==='nova'||m.kind==='leap'){
      const rr=m.rng*(m.ring?(0.3+p*0.95):1);
      g.strokeStyle=`rgba(255,200,110,${0.3+0.5*p})`; g.lineWidth=3.4;
      g.beginPath(); g.arc(0,0,rr,0,TAU); g.stroke();
      g.fillStyle=`rgba(${col},${0.06+0.14*p})`; g.beginPath(); g.arc(0,0,rr,0,TAU); g.fill();
    } else if(m.kind==='arc'||m.kind==='grab'||m.kind==='charge'||m.kind==='combo'||m.kind==='spin'){
      const arc=m.arc||1.5;
      g.fillStyle=`rgba(${col},${0.10+0.26*p})`;
      g.beginPath(); g.moveTo(0,0); g.arc(0,0,m.rng*(0.55+0.45*p),-arc/2,arc/2); g.closePath(); g.fill();
      g.strokeStyle=`rgba(255,226,170,${0.35+0.55*p})`; g.lineWidth=2;
      g.beginPath(); g.arc(0,0,m.rng*(0.55+0.45*p),-arc/2,arc/2); g.stroke();
    } else if(m.kind==='cone'){
      g.fillStyle=`rgba(255,140,50,${0.08+0.22*p})`;
      g.beginPath(); g.moveTo(0,0); g.arc(0,0,m.rng*(0.4+p*0.6),-0.36,0.36); g.closePath(); g.fill();
    } else if(m.kind==='beam'){
      const a0=this.beamA0!==undefined?this.beamA0:this.facing-1.15;
      g.rotate(-this.facing); g.rotate(a0);
      g.fillStyle=`rgba(255,170,70,${0.08+0.18*p})`;
      g.beginPath(); g.moveTo(0,-10); g.lineTo(540,-34); g.lineTo(540,34); g.lineTo(0,10); g.closePath(); g.fill();
    } else { g.strokeStyle=`rgba(255,180,90,${0.3+0.5*p})`; g.lineWidth=2;
      g.beginPath(); g.arc(0,0,r0(this)*(1.4+p),0,TAU); g.stroke() }
    g.restore();
  }
  drawActive(g,t){
    const m=this.move;
    g.save(); g.rotate(this.facing);
    if(m.kind==='beam'&&this.beamAng!==undefined){
      g.rotate(-this.facing); g.rotate(this.beamAng);
      const gr=g.createLinearGradient(0,0,540,0);
      gr.addColorStop(0,'rgba(255,240,190,.9)'); gr.addColorStop(1,'rgba(226,90,30,0)');
      g.fillStyle=gr; g.beginPath(); g.moveTo(0,-14); g.lineTo(540,-40); g.lineTo(540,40); g.lineTo(0,14); g.closePath(); g.fill();
    } else if(m.kind==='slam'||m.kind==='arc'||m.kind==='combo'||m.kind==='spin'){
      g.strokeStyle='rgba(255,240,210,.6)'; g.lineWidth=m.dmg>200?7:4;
      g.beginPath(); g.arc(0,0,(m.rng||120)*0.95,-(m.arc||1.5)/2,(m.arc||1.5)/2); g.stroke();
    } else if(m.kind==='cone'){
      g.fillStyle='rgba(255,180,90,.30)';
      g.beginPath(); g.moveTo(0,0); g.arc(0,0,m.rng,-0.36,0.36); g.closePath(); g.fill();
    }
    g.restore();
  }
}
const r0=b=>b.r;

/* =====================================================================
   §6.0 · THE HOLLOW SOVEREIGN — the teaching boss
   Ten moves. Every one of them is a lesson the game will ask for later.
   ===================================================================== */
class Sovereign extends Boss {
  constructor(x,y,zone){
    super('sovereign',x,y,zone);
    this.r=20;
    this.moves=[
      {n:'Slow Slash',     w:22, phase:0, tele:30, act:6,  rec:38, dmg:88,  pd:22, rng:78, arc:1.5, kind:'arc', lesson:'A 30-frame telegraph. Roll on frame 20.'},
      {n:'Overhead Slam',  w:18, phase:0, tele:42, act:8,  rec:48, dmg:132, pd:38, rng:86, arc:1.1, kind:'slam', shock:true, lesson:'Long windup, long recovery. This is your punish window.'},
      {n:'Throne Lunge',   w:14, phase:0, tele:22, act:10, rec:34, dmg:104, pd:28, dash:150, rng:66, arc:1.0, kind:'charge', lesson:'It closes distance. Do not be where it started.'},
      {n:'Crown Throw',    w:12, phase:0, tele:26, act:8,  rec:36, dmg:96,  pd:20, rng:420, kind:'projectiles', count:2, lesson:'A projectile has travel time. Walk sideways.'},
      {n:'Hollow Grasp',   w:10, phase:0, tele:32, act:8,  rec:54, dmg:170, pd:52, rng:70, arc:0.9, kind:'grab', punishable:true, lesson:'This is the heal read. It only fires when you drink.'},
      {n:'Ashen Sweep',    w:12, phase:0, tele:28, act:10, rec:40, dmg:110, pd:32, rng:110, arc:2.7, kind:'arc', lesson:'Wide arc. Roll THROUGH it, not away.'},
      {n:'Regal Step',     w:8,  phase:0, tele:16, act:20, rec:24, dmg:0,   pd:0,  kind:'reposition', lesson:'Bosses reposition. So must you.'},
      {n:'Empty Decree',   w:8,  phase:0, tele:40, act:8,  rec:46, dmg:0,   pd:0,  kind:'roar', postureAura:52, lesson:'Posture damage with no hit. Guard does not stop it.'},
      {n:'Sovereign Combo',w:12, phase:0, tele:20, act:22, rec:38, dmg:78,  pd:24, rng:84, arc:1.6, kind:'combo', hits:2, lesson:'Two hits, one recovery. Wait for the second.'},
      {n:'Last Rite',      w:6,  phase:0, tele:48, act:10, rec:56, dmg:190, pd:60, rng:140, arc:TAU, kind:'nova', ring:true, lesson:'A ring nova. Distance is the answer.'},
      /* ---- PHASE II ---- */
      {n:'What Wears the Crown',w:16,phaseMin:1,tele:26,act:10,rec:36,dmg:150,pd:44,rng:120,arc:TAU,kind:'nova',lesson:'Phase II is faster, not harder. Same grammar.'},
      {n:'Hollow Nova',    w:14, phaseMin:1, tele:34, act:12, rec:42, dmg:170, pd:50, rng:170, arc:TAU, kind:'nova', ring:true},
      {n:'Crown of Ash',   w:12, phaseMin:1, tele:24, act:8,  rec:34, dmg:140, pd:40, rng:96, arc:1.7, kind:'arc'},
      {n:'Sovereign Leap', w:12, phaseMin:1, tele:30, act:14, rec:44, dmg:190, pd:58, rng:150, arc:TAU, kind:'leap'},
      {n:'Throne Call',    w:9,  phaseMin:1, tele:42, act:10, rec:48, dmg:0, pd:0, kind:'summon', count:2, cd:20},
      {n:'Grasp of Names', w:10, phaseMin:1, tele:28, act:8,  rec:50, dmg:220, pd:66, rng:80, arc:0.9, kind:'grab', punishable:true},
    ];
    this.lessonShown={};
  }
  resolveActive(dt,t,player,m,p){
    switch(m.kind){
      case 'arc': case 'grab': case 'charge':
        if(!this.hitSet.has(m.n) && arcHits(this.x,this.y,this.facing,m.arc||1.5,m.rng+this.r*0.4,player.x,player.y,player.r)){
          this.hitSet.add(m.n); this.hitPlayer(player,m,1,'phys');
        } break;
      case 'slam':
        if(!this.hitSet.has(m.n) && arcHits(this.x,this.y,this.facing,m.arc||1.2,m.rng,player.x,player.y,player.r)){
          this.hitSet.add(m.n); this.hitPlayer(player,m,1,'phys');
        }
        if(m.shock&&p>0.6&&!this.hitSet.has('sh')){ this.hitSet.add('sh'); Cam.kick(8,.35);
          FX.dust(this.x+Math.cos(this.facing)*m.rng*0.7,this.y+Math.sin(this.facing)*m.rng*0.7,20);
          if(dist(this,player)<m.rng*1.5) Game.applyHit(player,this,{dmg:m.dmg*0.4*this.dmgMul,poiseDmg:m.pd*0.5,type:'phys',knock:14,boss:true});
        } break;
      case 'combo': {
        const idx=Math.min((m.hits||2)-1,Math.floor(p*(m.hits||2)));
        if(!this.hitSet.has('c'+idx)){ this.hitSet.add('c'+idx); Audio_.swing(idx>0);
          const a=this.facing+(idx?-0.45:0.45);
          if(arcHits(this.x,this.y,a,1.6,m.rng,player.x,player.y,player.r)) this.hitPlayer(player,m,1,'phys'); }
        break; }
      case 'nova':
        if(!this.hitSet.has('n')){
          const rr=m.rng*(m.ring?(0.3+p*0.95):1);
          if(dist(this,player)<rr+player.r){ this.hitSet.add('n'); this.hitPlayer(player,m,1,'phys') }
          else if(p>0.9) this.hitSet.add('n');
        } break;
      case 'leap':
        if(p<0.42) this.leapH=(this.leapH||0)+dt*200;
        else { this.leapH=Math.max(0,(this.leapH||0)-dt*460);
          if(p>0.74&&!this.hitSet.has('l')){ this.hitSet.add('l'); Cam.kick(11,.5); FX.dust(this.x,this.y,34);
            if(dist(this,player)<m.rng) this.hitPlayer(player,m,1,'phys') } }
        break;
      case 'projectiles': {
        const idx=Math.floor(p*(m.count||2));
        if(!this.hitSet.has('p'+idx)){ this.hitSet.add('p'+idx);
          const a=this.facing+rnd(0.2,-0.2);
          Game.spawnProjectile(this.x+Math.cos(a)*this.r,this.y+Math.sin(a)*this.r,a,{spd:330,dmg:m.dmg*this.dmgMul,
            type:'phys',team:'enemy',src:this,pd:m.pd,life:1.6,orb:'crown'}); Audio_.swing(true) }
        break; }
      case 'roar': if(!this.hitSet.has('r')){ this.hitSet.add('r');
        if(dist(this,player)<300){ player.posture+=m.postureAura; player.postureT=POSTURE_DECAY_DELAY;
          if(player.posture>=player.maxPosture){ player.posture=0; player.postureImmune=POSTURE_IMMUNE;
            player.stagger=POSTURE_STAGGER; player.state='stagger'; Audio_.postureBreak(); FX.postureBreak(player.x,player.y) } }
        Audio_.roar(false); Cam.kick(7,.4); FX.ash(this.x,this.y,26); } break;
      case 'summon': if(!this.hitSet.has('s')){ this.hitSet.add('s');
        for(let i=0;i<(m.count||2);i++){ const a=this.arena;
          Game.spawnEnemy('wretch',a?a.x+rnd(a.w-30,15):this.x+rnd(120,-120),a?a.y+rnd(a.h-30,15):this.y+rnd(100,-100),
            {hpMult:0.7,soulsMult:0.4,spawn:true,bossAdd:true}) }
        Game.toast('THE THRONE IS NOT EMPTY'); } break;
      case 'reposition': if(!this.hitSet.has('rp')){ this.hitSet.add('rp');
        const a=this.arena; if(a){ this.x=a.x+rnd(a.w*0.75,a.w*0.15); this.y=a.y+rnd(a.h*0.75,a.h*0.15) }
        FX.ash(this.x,this.y,24) } break;
    }
  }
  onMoveEnd(m){
    if(m.lesson && !this.lessonShown[m.n]){
      this.lessonShown[m.n]=true; Game.toast('§6.0 · '+m.lesson,3.4);
    }
    if(m.kind==='leap') this.leapH=0;
  }
  startMove(m,player,d){ super.startMove(m,player,d);
    if(m.lesson && !this.lessonShown[m.n]){ this.lessonShown[m.n]=true; Game.toast('§6.0 · '+m.lesson,3.6) } }
  tryAdds(){}

  drawBody(g,t,dying){
    const r=this.r*(1+(this.leapH||0)*0.002), ph=this.phase;
    // the hollow silhouette: thin, crowned, wrong
    g.fillStyle=this.hitFlash>0?'#fff':(ph?'#4a3f52':'#3f3a33');
    g.beginPath();
    g.moveTo(-r*0.8,r*1.1); g.lineTo(-r*0.5,-r*0.9); g.lineTo(0,-r*1.2);
    g.lineTo(r*0.5,-r*0.9); g.lineTo(r*0.8,r*1.1);
    g.quadraticTo(0,r*1.5,-r*0.8,r*1.1); g.fill();
    // ribs
    g.strokeStyle='rgba(217,205,180,.30)'; g.lineWidth=1.4;
    for(let i=0;i<4;i++){ g.beginPath(); g.moveTo(-r*0.5,r*0.1+i*7); g.quadraticTo(0,r*0.3+i*7,r*0.5,r*0.1+i*7); g.stroke() }
    // head
    g.fillStyle=this.hitFlash>0?'#fff':'#c9b79a';
    g.beginPath(); g.arc(Math.cos(this.facing)*2.4,Math.sin(this.facing)*2.4-r*0.95,r*0.36,0,TAU); g.fill();
    // crown (phase II: it is wearing something else)
    g.fillStyle=ph?'#9a6fd0':'#8a7f70';
    for(let i=0;i<5;i++){ const x=(i-2)*r*0.24;
      g.beginPath(); g.moveTo(x-r*0.09,-r*1.16); g.lineTo(x,-r*1.16-r*0.42-(i===2?7:0)); g.lineTo(x+r*0.09,-r*1.16); g.closePath(); g.fill() }
    g.fillRect(-r*0.6,-r*1.16,r*1.2,4);
    // eyes
    g.fillStyle=ph?'#c9a8f0':'#e2703a'; g.globalAlpha=.8+.2*Math.sin(t*4);
    g.fillRect(-r*0.24,-r*1.0,3,3); g.fillRect(r*0.1,-r*1.0,3,3); g.globalAlpha=1;
    // sword
    g.save(); g.rotate(this.facing);
    g.fillStyle='#4a3f30'; g.fillRect(r*0.2,-2,r*0.7,4);
    g.fillStyle=ph?'#b79ae0':'#a89c85';
    g.beginPath(); g.moveTo(r*0.9,-3.4); g.lineTo(r*2.5,-1.4); g.lineTo(r*2.7,0); g.lineTo(r*2.5,1.4); g.lineTo(r*0.9,3.4); g.closePath(); g.fill();
    g.fillStyle='rgba(255,255,255,.22)'; g.fillRect(r*1.0,-1.4,r*1.5,1.2);
    g.restore();
  }
  drawTelegraph(g,p,t){
    const m=this.move;
    g.save(); g.rotate(this.facing);
    if(m.kind==='nova'||m.kind==='leap'){
      const rr=m.rng*(m.ring?(0.3+p*0.95):1);
      g.strokeStyle=`rgba(200,163,90,${0.3+0.5*p})`; g.lineWidth=2.6;
      g.beginPath(); g.arc(0,0,rr,0,TAU); g.stroke();
      g.fillStyle=`rgba(200,163,90,${0.05+0.12*p})`; g.beginPath(); g.arc(0,0,rr,0,TAU); g.fill();
    } else if(m.kind==='slam'){
      g.fillStyle=`rgba(200,163,90,${0.13+0.28*p})`;
      g.beginPath(); g.ellipse(m.rng*0.66,0,m.rng*0.5,m.rng*0.36,0,0,TAU); g.fill();
      g.strokeStyle=`rgba(232,207,148,${0.4+0.5*p})`; g.lineWidth=2; g.stroke();
    } else if(m.kind!=='projectiles'&&m.kind!=='summon'&&m.kind!=='reposition'&&m.kind!=='roar'){
      const arc=m.arc||1.4;
      g.fillStyle=`rgba(200,163,90,${0.10+0.24*p})`;
      g.beginPath(); g.moveTo(0,0); g.arc(0,0,m.rng*(0.6+0.4*p),-arc/2,arc/2); g.closePath(); g.fill();
      g.strokeStyle=`rgba(232,207,148,${0.35+0.55*p})`; g.lineWidth=2;
      g.beginPath(); g.arc(0,0,m.rng*(0.6+0.4*p),-arc/2,arc/2); g.stroke();
    } else {
      g.strokeStyle=`rgba(200,163,90,${0.25+0.4*p})`; g.lineWidth=1.6;
      g.beginPath(); g.arc(0,0,this.r*(1.5+p),0,TAU); g.stroke();
    }
    g.restore();
  }
  drawActive(g,t){
    const m=this.move;
    g.save(); g.rotate(this.facing);
    g.strokeStyle='rgba(255,240,210,.5)'; g.lineWidth=3;
    g.beginPath(); g.arc(0,0,(m.rng||90)*0.94,-(m.arc||1.5)/2,(m.arc||1.5)/2); g.stroke();
    g.restore();
  }
}

const BOSS_CLASS={vharos:Vharos,karrag:Karrag,sovereign:Sovereign};

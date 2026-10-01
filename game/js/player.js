/* =====================================================================
   player.js — Actor base + the Ashen Hollow
   Vol 2 (stats) · Vol 3 (combat matrix) · Vol 4 (magic) · Vol 7 (healing)
   ===================================================================== */
'use strict';

/* =====================================================================
   ACTOR — shared body, poise budget, damage resolution
   ===================================================================== */
class Actor {
  constructor(x,y,r=12){
    this.x=x; this.y=y; this.r=r; this.vx=0; this.vy=0;
    this.hp=1; this.maxHp=1; this.dead=false; this.dying=0;
    this.facing=Math.PI/2; this.aim=0;
    this.poise=0; this.poiseDmg=0; this.poiseReset=0;
    this.posture=0; this.postureT=0; this.postureImmune=0;
    this.iframe=0; this.stagger=0; this.hitFlash=0; this.knock={x:0,y:0};
    this.state='idle'; this.anim=0; this.stepT=0;
    this.status={}; this.invuln=0;
    this.team='enemy'; this.name='?';
    this.bob=0; this.lean=0;
  }
  get maxPosture(){ return 100 + this.poise*1.5 }          // Vol 3 §3.6.4
  spendSta(v){ return true }
  canAct(){ return !this.dead && this.dying<=0 && this.stagger<=0 && ['idle','run','walk','strafe'].includes(this.state) }

  /* ---------- the single damage entry point ---------- */
  takeHit(o){
    if(this.dead||this.iframe>0||this.invuln>0) return null;
    const src=o.src, atk=o.atk||src;
    let dmg=o.dmg||0, pd=o.poiseDmg||0, post=o.posture||0;

    /* --- guard (Vol 3 §3.5) --- */
    let blocked=false, parried=false, guardBreak=false;
    if(this.guarding && this.shield && this.facingTarget(atk)){
      if(this.parryT>0){ parried=true }
      else {
        blocked=true;
        const stab=this.guardStab||100;
        dmg *= Math.max(0.10, 1 - stab/100*0.9);
        this.sta -= o.staDmg!==undefined?o.staDmg:dmg*0.55;
        pd *= 0.15; post *= 0.2;
        if(this.sta<=0){ guardBreak=true; this.sta=0; pd=this.threshold*1.2; post*=3 }
      }
    }

    /* --- mitigation: true poise buys damage reduction (Vol 3 §3.7.4) --- */
    const mit = this.mitigation||0;
    const def = this.def||0;
    const resist = (this.res&&o.type)? (this.res[o.type]||0) : 0;
    let out = Math.max(1, Math.round( dmg * (1-mit) * (1 - Math.min(0.6, def/(def+260))) * (1 - Math.min(0.8,resist/100)) ));
    if(this.res?.physPct && (o.type==='phys'||!o.type)) out=Math.round(out*(1-this.res.physPct));
    if(o.mult) out=Math.round(out*o.mult);

    /* --- poise budget (Vol 3 §3.7.3) --- */
    let staggered=false;
    if(!parried && pd>0){
      this.poiseDmg += pd; this.poiseReset = 3.0;
      if(this.poiseDmg >= this.threshold){
        staggered=true; this.poiseDmg=0;
        this.stagger = o.boss? 4.0 : (this.isBoss? 0 : 0.72);   // bosses stagger once per phase
        if(this.isBoss && this.bossStaggered) staggered=false;
        if(this.isBoss) this.bossStaggered=true;
      }
    }
    /* --- posture (only enemies and the player's guard have it) --- */
    if(post>0 && this.postureImmune<=0){
      this.posture += post; this.postureT = POSTURE_DECAY_DELAY;
      if(this.posture >= this.maxPosture){
        this.posture=0; this.postureImmune=POSTURE_IMMUNE;
        this.stagger = this.isBoss? 4.0 : POSTURE_STAGGER;
        this.postureBroken=true; staggered=true;
        if(this.team==='player'){ Audio_.postureBreak(); Cam.kick(11,.4); FX.postureBreak(this.x,this.y) }
        else { Audio_.postureBreak(); Cam.kick(9,.35); FX.postureBreak(this.x,this.y); Game.toast('POSTURE BREAK — riposte (F)') }
      }
    }
    if(guardBreak){ Audio_.guardBreak(); Cam.kick(8,.3); Game.toast(this.team==='player'?'GUARD BROKEN':'GUARD BROKEN') }
    if(parried){
      this.stagger = 1.1; this.posture=Math.max(this.posture,this.maxPosture*0.6);
      out=0; dmg=0;
      Audio_.parry(); FX.parryFlash(this.x,this.y); Cam.kick(7,.28); HitStop.set(9);
      if(atk&&atk.onParry) atk.onParry(this);
      if(this.team==='player') Game.toast('PARRIED');
      return {blocked:true,parried:true,dmg:0,staggered:true};
    }

    this.hp -= out; this.hitFlash=0.16;
    if(o.knock){ const d=norm(this.x-atk.x,this.y-atk.y); this.knock.x+=d.x*o.knock; this.knock.y+=d.y*o.knock }
    if(o.bleed)   this.addStatus('bleed',   o.bleed);
    if(o.poison)  this.addStatus('poison',  o.poison);
    if(o.burn)    this.addStatus('burn',    o.burn);
    if(o.frost)   this.addStatus('frost',   o.frost);
    if(staggered && !this.isBoss) this.state='stagger';

    /* feedback */
    const dir=Math.atan2(this.y-atk.y,this.x-atk.x);
    if(this.team==='player'){
      Audio_.hit(false,out>60); Cam.kick(blocked?3:Math.min(12,3+out*0.05),.2); HitStop.set(blocked?3:out>90?7:5);
      if(blocked) FX.blockSpark(this.x,this.y,dir+Math.PI); else FX.blood(this.x,this.y,dir,10);
      Game.hurtFlash(out/Math.max(1,this.maxHp));
    } else {
      Audio_.hit(true,out>80,blocked);
      if(blocked) FX.blockSpark(this.x,this.y,dir+Math.PI);
      else { FX.hitSpark(this.x,this.y,dir,out>90?14:8); FX.blood(this.x,this.y,dir,6) }
      HitStop.set(blocked?2:out>120?6:4); Cam.kick(blocked?1.5:Math.min(6,1.5+out*0.02),.14);
    }
    if(!blocked && SETTINGS.dmgNumbers)
      FX.text(this.x+rnd(8,-8), this.y-this.r-8, (o.crit?'✦ ':'')+out, o.crit?'#ffd08a':(o.type==='dark'?'#c9a8f0':o.type==='fire'?'#ffb84a':o.type==='lightning'?'#cfe8ff':'#e9e0cd'), o.crit?17:13, -52, o.crit?1.3:0.95);

    if(this.hp<=0 && !this.dead) this.beginDeath();
    return {dmg:out,blocked,staggered,guardBreak,parried:false};
  }
  facingTarget(t){ return Math.abs(angDiff(this.facing, Math.atan2(t.y-this.y,t.x-this.x))) < 1.35 }

  addStatus(k,amt){
    if(STATUS[k].build>=8){ this.status[k]=(this.status[k]||0)+1; return }
    const s=this.status[k]=this.status[k]||{v:0,t:0};
    s.v+=amt;
    if(s.v>=STATUS[k].build){ s.v=0; this.triggerStatus(k) }
  }
  triggerStatus(k){
    if(k==='bleed'){ const d=Math.round(this.maxHp*0.30); this.hp-=d; this.hitFlash=.2;
      FX.blood(this.x,this.y,rnd(TAU),26); Audio_.hit(true,true);
      FX.text(this.x,this.y-this.r-14,'BLEED '+d,'#c8453f',15,-40,1.2);
      if(this.team==='player') Game.hurtFlash(.3);
      if(this.hp<=0&&!this.dead) this.beginDeath() }
    else if(k==='poison'||k==='toxic'){ this.status[k]={dot:(k==='toxic'?0.04:0.015),t:(k==='toxic'?40:30)} }
    else if(k==='frost'){ this.status[k]={t:12}; FX.frost(this.x,this.y,16); Audio_.tone?.(900,.4,{type:'triangle',gain:.07,glide:300}) }
    else if(k==='burn'){ this.status[k]={dot:0.025,t:6}; FX.fire(this.x,this.y,14) }
    else if(k==='hollow'){ Game.addSigil() }
  }
  tickStatus(dt){
    for(const k of Object.keys(this.status)){
      const s=this.status[k];
      if(typeof s==='number'){ if(s>=STATUS[k].build) this.triggerStatus(k); continue }
      if(s.t!==undefined){ s.t-=dt; if(s.dot){ this.hp-=this.maxHp*s.dot*dt; this.hitFlash=Math.max(this.hitFlash,.05);
          if(Math.random()<dt*6) FX.poison(this.x,this.y,1);
          if(this.hp<=0&&!this.dead) this.beginDeath() }
        if(s.t<=0) delete this.status[k] }
    }
    if(this.poiseReset>0){ this.poiseReset-=dt; if(this.poiseReset<=0) this.poiseDmg=0 }
    if(this.postureT>0){ this.postureT-=dt } else if(this.posture>0){ this.posture=Math.max(0,this.posture-POSTURE_DECAY*dt) }
    if(this.postureImmune>0) this.postureImmune-=dt;
    if(this.iframe>0) this.iframe-=dt;
    if(this.hitFlash>0) this.hitFlash-=dt;
    if(this.invuln>0) this.invuln-=dt;
    if(this.stagger>0){
      this.stagger-=dt;
      if(this.stagger<=0){ this.state='idle'; this.postureBroken=false; if(this.isBoss)this.bossStaggered=false }
    }
    // knockback
    if(this.knock.x||this.knock.y){
      this.x+=this.knock.x*dt*9; this.y+=this.knock.y*dt*9;
      this.knock.x*=Math.pow(0.0009,dt); this.knock.y*=Math.pow(0.0009,dt);
      if(Math.abs(this.knock.x)<1){this.knock.x=0;this.knock.y=0}
    }
  }
  beginDeath(){ if(this.dead) return; this.dead=true; this.dying=0.0001; this.state='dying' }
}

/* =====================================================================
   PLAYER — the Ashen Hollow
   ===================================================================== */
class Player extends Actor {
  constructor(){
    super(0,0,11);
    this.team='player'; this.name='Ashen Hollow';
    this.level=3; this.souls=0; this.bank=0;
    this.stats={VIG:10,ATT:10,END:10,STR:10,DEX:10,VIT:10,INT:10,FTH:10,ADP:10};
    this.classId='hollow';
    this.inv={ items:{}, weapons:['Broken Straight Sword'], armor:['Tattered Rags'], shields:['Cracked Kite Shield'],
               rings:[], spells:[], keys:{} };
    this.gear={rh:'Broken Straight Sword',lh:'Cracked Kite Shield',arm:'Tattered Rags',legs:null,rings:[]};
    this.upgrades={}; this.infusion={};
    this.attuned=[]; this.quickslot=[null,null,null,null]; this.qs=0;
    this.estus=5; this.estusMax=5; this.ashEstus=0; this.gems=0; this.shards=0; this.ashShards=0;
    this.allocation={estus:5,ash:0};
    this.sigils=0; this.hollowing=0;
    this.want=0; this.resonance=0;
    this.covenant='None'; this.covRank={};
    this.bloodstain=null; this.lastBonfire=null;
    this.deaths=0; this.kills=0; this.bossesKilled=[]; this.severed=[];
    this.twoHand=false; this.lockTarget=null;
    this.sta=100; this.fp=100;
    this.combo=0; this.comboT=0; this.chainWindow=0;
    this.atk=null; this.roll=null; this.cast=null; this.drink=null;
    this.guarding=false; this.parryT=0; this.parryCd=0;
    this.art=null; this.artCd=0;
    this.stanceT=0; this.stanceHits=0; this.stanceActive=false;
    this.gemT=0; this.gemUses=0;
    this.tempPoise=0; this.tempPoiseT=0;
    this.resin=null; this.resinT=0;
    this.resting=0; this.time=0;
    this.ember=false;
    this.recalc();
  }
  /* ---------- Vol 2 §2.3: recompute every derived number ---------- */
  recalc(){
    const prevHp=this.maxHp, prevSta=this.maxSta, prevFp=this.maxFp;
    const d=derive(this.stats,this.gear,{covenant:this.covenant,tempPoise:this.tempPoise});
    this.d=d;
    this.maxHp=d.hp; this.maxFp=d.fp; this.maxSta=d.sta;
    this.poise=d.poise; this.grade=d.grade; this.threshold=d.threshold; this.mitigation=d.mitigation;
    this.def=d.def; this.res=d.res; this.shield=null;
    this.guardStab=d.guardStability;
    if(this.gear.lh && SHIELDS[this.gear.lh]){ this.shield=SHIELDS[this.gear.lh]; this.parryable=d.parryable }
    else this.parryable=false;
    this.slots=spellSlots(this.stats.ATT);
    this.hp=prevHp? clamp(this.hp*(this.maxHp/prevHp),1,this.maxHp) : this.maxHp;
    this.sta=prevSta? clamp(this.sta*(this.maxSta/prevSta),0,this.maxSta) : this.maxSta;
    this.fp=prevFp? clamp(this.fp*(this.maxFp/prevFp),0,this.maxFp) : this.maxFp;
    this.estusMax = clamp(5 + this.shards + (d.estusBonus||0), 1, ESTUS_MAX);
    return d;
  }
  get level_(){ return Object.values(this.stats).reduce((a,b)=>a+b,0)-LVL_BASE }
  get soulCost(){ return SOUL_LEVEL_COST(this.level_+1) }
  get rhWeapon(){
    const n=this.gear.rh; if(!n||!WEAPONS[n]) return null;
    return Object.assign({name:n}, WEAPONS[n]);
  }
  get lhWeapon(){
    const n=this.gear.lh; if(!n||!WEAPONS[n]||SHIELDS[n]) return null;
    return Object.assign({name:n}, WEAPONS[n]);
  }
  get catalyst(){
    for(const w of [this.rhWeapon,this.lhWeapon]) if(w&&w.cat) return w;
    return null;
  }
  /* ---------- Vol 3 §3.6.2: Power Stance eligibility (1.5× requirement) ---------- */
  get powerStance(){
    const a=this.rhWeapon,b=this.lhWeapon;
    if(!a) return null;
    if(b){
      if(a===b&&!a.dual) return null;
      if(a.c!==b.c) return null;                                // same weapon class
      if(!a.dual && !this.twoHand) return null;                 // twinblades, or two-handing one weapon
    } else if(!this.twoHand) return null;                       // empty left hand: only a two-handed weapon can stance
    if(!b || a===b){
      /* two-handing a single weapon — the 1.5× rule on whichever stat it demands */
      const stat = (a.req.STR||0)>=(a.req.DEX||0)?'STR':'DEX';
      const need = Math.ceil(Math.max(a.req.STR||0,a.req.DEX||0)*PS_REQ_MULT);
      if(this.stats[stat] < need) return {ok:false,need,stat,name:a.name};
      return {ok:true,need,stat,name:a.name,w:a,twoHand:true};
    }
    for(const st of ['STR','DEX']){
      const n=Math.ceil(Math.max(a.req[st]||0,b.req[st]||0)*PS_REQ_MULT);
      if(this.stats[st]<n) return {ok:false,need:n,stat:st,name:a.name+' + '+b.name};
    }
    return {ok:true,need:0,stat:'—',name:a.name+' + '+b.name,w:a,w2:b};
  }
  get stanceReady(){ const p=this.powerStance; return p&&p.ok }

  /* ---------- damage output ---------- */
  attackDamage(w,heavy=false,art=false){
    const up=this.upgrades[w.name]||0, inf=this.infusion[w.name]||null;
    const d=weaponDamage(w.name,this.stats,up,inf);
    let phys=d.phys;
    const mul = art? 1 : heavy? 1.55 : this.combo>=2? 1.18 : 1.0;
    phys=Math.round(phys*mul);
    const extra=Object.assign({},d.extra);
    if(this.resin){ extra[this.resin.t]=(extra[this.resin.t]||0)+Math.round(d.total*0.30) }
    // bleed on katanas
    const bleed = w.bleed? w.bleed : 0;
    return {phys,extra,bleed,total:phys+Object.values(extra).reduce((a,b)=>a+b,0)};
  }
  poiseDamageOf(w,heavy,art,stance){
    let p=(w.poise||8)*(heavy?1.6:1)*(art?1.4:1)*(this.combo>=2?1.1:1);
    if(stance) p *= this.stanceHits>=2? PS_FINISHER_MULT : PS_POSTURE_MULT;
    return Math.round(p);
  }

  /* ---------- input ---------- */
  update(dt,t){
    this.time+=dt;
    if(this.dead){ this.dying+=dt; return }
    this.tickStatus(dt);

    /* stamina: Vol 3 §3.2.4 — 46/s at END 10, +0.4 per END, delayed, ×0.35 while guarding */
    if(this.staDelay>0) this.staDelay-=dt;
    else if(this.sta<this.maxSta){
      const m = this.guarding? GUARD_REGEN_MULT : (this.cast||this.drink)? CAST_REGEN_MULT : 1;
      const cov = COVENANTS[this.covenant]?.bonus?.staRegen||0;
      const frost = this.status.frost? 0.82 : 1;
      this.sta=Math.min(this.maxSta,this.sta + this.d.staRegen*m*frost*(1+cov)*dt);
    }
    if(this.res.blessed && this.hp<this.maxHp) this.hp=Math.min(this.maxHp,this.hp+this.res.blessed*dt);
    if(this.resinT>0){ this.resinT-=dt; if(this.resinT<=0) this.resin=null }
    if(this.tempPoiseT>0){ this.tempPoiseT-=dt; if(this.tempPoiseT<=0){ this.tempPoise=0; this.recalc() } }
    if(this.artCd>0) this.artCd-=dt;
    if(this.parryCd>0) this.parryCd-=dt;
    if(this.chainWindow>0){ this.chainWindow-=dt; if(this.chainWindow<=0) this.combo=0 }
    if(this.stanceT>0){ this.stanceT-=dt; if(this.stanceT<=0){ this.stanceActive=false; this.stanceHits=0 } }
    if(this.gemT>0) this.tickGem(dt);
    if(this.resting>0){ this.resting-=dt; if(this.resting<=0) Game.endRest(); return }

    const mv=Input.move();
    let wantMove = mv.mag>0.15;

    /* ---- state handlers ---- */
    if(this.drink){ this.tickDrink(dt); return }
    if(this.cast){ this.tickCast(dt); return }
    if(this.roll){ this.tickRoll(dt); return }
    if(this.atk){ this.tickAttack(dt); return }
    if(this.art){ this.tickArt(dt); return }
    if(this.stagger>0){ this.state='stagger'; this.moveBy(0,0,dt); return }

    /* ---- guard / parry ---- */
    this.guarding=false;
    if(this.shield && Input.held('guard') && this.sta>0 && !this.twoHand){
      this.guarding=true; this.state='guard';
      this.staDelay=Math.max(this.staDelay,0.1);
    }
    if(Input.hit('parry') && this.parryable && this.parryCd<=0 && this.spendSta(PARRY.total*0.16)){
      this.state='parry'; this.parryT=PARRY.total/FPS; this.parryFrame=0; this.parryCd=0.55;
      this.facing=this.aimAngle(); Audio_.swing(); return;
    }
    if(this.parryT>0){
      this.parryT-=dt; this.parryFrame++;
      if(this.parryFrame>PARRY.total){ this.parryT=0; this.state='idle' }
      return;
    }

    /* ---- roll / backstep ---- */
    if(Input.hit('roll')){
      const back = this.guarding;
      const cost = back? BACKSTEP.cost : this.d.rollCost;
      if(this.spendSta(cost)){
        const tier=this.d.tier;
        const dirAng = wantMove? Math.atan2(mv.y,mv.x) : (back? this.facing+Math.PI : this.facing);
        this.roll={t:0,total:(back?BACKSTEP.total:tier.total)/FPS,back,
          iframe:(back?BACKSTEP.iframe:this.d.iframe)/FPS,
          dist:back?BACKSTEP.dist:tier.dist, ang:dirAng};
        this.iframe=this.roll.iframe; this.state=back?'backstep':'roll';
        this.facing=back?this.facing:dirAng;
        Audio_.roll(); FX.dust(this.x,this.y+this.r*0.6,5);
        this.staDelay=STA_DELAY;
        this.combo=0;
        return;
      }
    }

    /* ---- estus / life gem / quickslots ---- */
    if(Input.hit('estus')) { if(this.estus>0) this.startDrink(); else Game.toast('The flask is empty. Rest at a bonfire.') ; return }
    if(Input.hit('gem'))   { if(this.gems>0) this.startGem();   else Game.toast('No Life Gems remain.') ; return }
    for(let i=0;i<4;i++) if(Input.hit('item'+(i+1))) this.qs=i;
    /* the selected quickslot is consumed with the interact button, so a thrown Firebomb
       and a riposte share one key without ever colliding (F near an enemy ripostes first —
       Game.update only routes here when no prompt is in range) */
    if(Input.hit('interact')){
      const q=this.quickslot[this.qs];
      if(q){ Game.useItem(q); return }
    }

    /* ---- weapon art (Vol 3 §3.3) ---- */
    if(Input.hit('art')){ this.tryWeaponArt(); return }

    /* ---- two-hand (Vol 3 §3.6) ---- */
    if(Input.hit('twoHand')){
      const w=this.rhWeapon;
      if(w && !w.cat && !w.ranged){ this.twoHand=!this.twoHand;
        Game.toast(this.twoHand?'Two-handed — Power Stance available':'One-handed'); Audio_.ui(true) }
      else Game.toast('Thou cannot two-hand that.');
      return;
    }
    if(Input.hit('lockon')){ Game.cycleLock(); return }

    /* ---- attacks ---- */
    const light=Input.hit('light'), heavy=Input.hit('heavy');
    if(light||heavy){
      const w=this.rhWeapon;
      if(!w||w.cat){ this.tryCast(heavy); return }
      if(w.ranged){ this.tryShoot(w,heavy); return }
      /* Power Stance: a heavy swing while a stance is available opens the combo (Vol 3 §3.6.3) */
      if(heavy && this.stanceReady && !this.stanceActive){ if(this.startStance()) return }
      const cost=(3.4+w.w*1.5)*(heavy?1.85:1)*(this.twoHand?1.15:1);
      if(!this.spendSta(cost)){ Game.toast('Not enough stamina'); return }
      this.startAttack(w,heavy);
      return;
    }

    /* ---- movement ---- */
    if(wantMove){
      const walking = Input.held('walk');
      const sprint  = Input.held('sprint') && !walking && this.sta>1;
      let spd = walking? WALK*0.55 : sprint? RUN : WALK;
      if(this.guarding) spd*=0.52;
      if(this.lockTarget) spd*=0.94;
      const hz=World.hazardAt(this.x,this.y);
      if(hz?.slow) spd*=hz.slow;
      if(this.gemT>0) spd*= Math.max(GEM_FLOOR, 1-GEM_PENALTY*this.gemUses);
      if(this.twoHand) spd*=0.94;
      if(this.loadPct>=100) spd*=0.42;
      this.moveBy(mv.x*spd,mv.y*spd,dt);
      this.facing = this.lockTarget? Math.atan2(this.lockTarget.y-this.y,this.lockTarget.x-this.x) : Math.atan2(mv.y,mv.x);
      this.state = sprint?'run':walking?'walk':'run';
      if(sprint){ this.sta-=13*dt; this.staDelay=Math.max(this.staDelay,0.25) }
      this.stepT-=dt*spd/WALK;
      if(this.stepT<=0){ this.stepT=0.42; Audio_.step(); FX.dust(this.x,this.y+this.r*0.7,1) }
    } else {
      this.moveBy(0,0,dt);
      this.state=this.guarding?'guard':'idle';
      if(this.lockTarget) this.facing=Math.atan2(this.lockTarget.y-this.y,this.lockTarget.x-this.x);
    }
    this.aim=this.facing;
  }
  get loadPct(){ return this.d.load }
  spendSta(v){ if(this.sta<v) return false; this.sta-=v; this.staDelay=STA_DELAY; return true }
  moveBy(vx,vy,dt){
    this.x+=vx*dt; this.y+=vy*dt;
    World.contain(this);
    this.bob += Math.hypot(vx,vy)*dt*0.06;
  }
  /* ---------- roll / backstep integration (Vol 3 §3.7.1) ----------
     distance and i-frames are both fixed by tier; ADP scales the frames. */
  tickRoll(dt){
    const r=this.roll; r.t+=dt;
    const pr=clamp(r.t/r.total,0,1);
    const bell=Math.sin(pr*Math.PI);                      // fast out, soft landing
    const spd=(r.dist/r.total)*bell*2.0;
    this.moveBy(Math.cos(r.ang)*spd,Math.sin(r.ang)*spd,dt);
    if(pr>0.86) this.iframe=0;                            // recovery frames are not invulnerable
    if(Math.random()<dt*24) FX.dust(this.x,this.y+this.r*0.6,1);
    if(r.t>=r.total){ this.roll=null; this.state='idle' }   // staDelay from the roll startup stays: no free stamina
  }
  aimAngle(){
    if(this.lockTarget) return Math.atan2(this.lockTarget.y-this.y,this.lockTarget.x-this.x);
    if(Input.aimWorld) return Math.atan2(Input.aimWorld.y-this.y,Input.aimWorld.x-this.x);
    return this.facing;
  }

  /* ---------- attacks ---------- */
  startAttack(w,heavy){
    const stance = this.stanceReady && (this.twoHand||!!this.lhWeapon) && this.stanceHits>0;
    const fr=w.fr.map(f=>f/FPS);
    const range = w.c==='pike'? 62 : w.c==='great'? 54 : w.c==='twinblade'? 40 : 46;
    const spread= w.c==='great'? 2.0 : w.c==='pike'? 0.5 : w.c==='twinblade'? 2.5 : 1.7;
    this.facing=this.aimAngle();
    const pd=this.poiseDamageOf(w,heavy,false,stance);
    this.atk={w,heavy,stance,fr,t:0,range,spread,hit:false,
      dmg:this.attackDamage(w,heavy), pd,
      posture: Math.round(pd*(stance? (this.stanceHits>=2?PS_FINISHER_MULT:PS_POSTURE_MULT) : NON_STANCE_POSTURE)),
      swing: heavy? -1 : (this.combo%2? 1 : -1)};
    this.state=heavy?'heavy':'light';
    Audio_.swing(heavy,stance);
    this.staDelay=STA_DELAY;
  }
  tickAttack(dt){
    const a=this.atk; a.t+=dt;
    const [s,ac,r]=a.fr;
    if(a.t>=s && a.t<s+ac && !a.hit){
      const hits=Game.hitArc(this.x,this.y,this.facing,a.spread,a.range+this.r,this,a.pd,a.dmg,
        {heavy:a.heavy,stance:a.stance,posture:a.posture,weapon:a.w,type:'phys'});
      if(hits) { a.hit=true; this.combo=Math.min(3,this.combo+1); this.chainWindow=0.55;
        if(a.stance){ this.stanceHits++; this.stanceT=1.1 } }
    }
    if(a.t>=s+ac*0.5 && a.t<s+ac+0.12 && !a.trail){ a.trail=true }
    if(a.t>=s+ac+r){
      this.atk=null; this.state='idle';
      // combo chaining: pressing attack during recovery continues the chain
      if(this.chainWindow>0 && (Input.held('light')||Input.held('heavy'))) { /* next frame starts a new swing */ }
    }
  }
  /* ---------- Power Stance combo (Vol 3 §3.6.3) ---------- */
  startStance(){
    const p=this.powerStance; if(!p||!p.ok) return false;
    if(!this.spendSta(24)) return false;
    this.stanceActive=true; this.stanceHits=1; this.stanceT=1.6;
    const w=p.w;
    this.facing=this.aimAngle();
    this.atk={w,heavy:false,stance:true,fr:[w.fr[0]*0.9/FPS,7/FPS,w.fr[2]*0.8/FPS],t:0,
      range:52,spread:2.6,hit:false,dmg:this.attackDamage(w,false),
      pd:Math.round((w.poise||12)*PS_POSTURE_MULT),posture:Math.round((w.poise||12)*PS_POSTURE_MULT),swing:1,stanceFinish:false};
    this.state='stance'; Audio_.swing(false,true); Audio_.tone(320,.2,{type:'triangle',gain:.08});
    return true;
  }
  stanceFinisher(){
    const p=this.powerStance; if(!p||!p.ok) return;
    if(!this.spendSta(30)) return;
    const w=p.w;
    this.facing=this.aimAngle();
    this.atk={w,heavy:true,stance:true,fr:[14/FPS,8/FPS,26/FPS],t:0,range:60,spread:2.9,hit:false,
      dmg:this.attackDamage(w,true), pd:Math.round((w.poise||12)*PS_FINISHER_MULT),
      posture:Math.round((w.poise||12)*PS_FINISHER_MULT),swing:-1,stanceFinish:true};
    this.state='stance'; this.stanceHits=0; this.stanceActive=false;
    Audio_.swing(true,true); Cam.kick(4,.2);
  }

  /* ---------- weapon arts (Vol 3 §3.3) ---------- */
  tryWeaponArt(){
    const w=this.rhWeapon;
    if(!w||!w.art){ Game.toast('This weapon has no Art.'); return }
    if(this.artCd>0) return;
    const inf=INFUSIONS.find(i=>i.id===this.infusion[w.name]);
    let fp=w.art.fp*(inf?.fp??1);
    const ashen=inf?.art?1:0;
    if(this.fp<fp){ Game.toast('Not enough FP'); return }
    this.fp-=fp; this.artCd=0.5;
    const art=w.art;
    this.facing=this.aimAngle();
    if(w.c==='bow'){ this.tryShoot(w,true,art); return }
    if(art.n==='Stance'||art.n==='Stomp'){
      // a guard-breaking overhead: big posture, short invuln on the step-in
      this.art={t:0,total:0.62,phase:0,w,art,dmg:this.attackDamage(w,true,true),
        pd:this.poiseDamageOf(w,true,true,this.stanceReady),range:58,spread:2.2,ashen};
      this.state='art'; this.iframe=Math.max(this.iframe,0.14);
      Audio_.swing(true,true); Audio_.tone(180,.4,{type:'sawtooth',gain:.10,glide:70});
      FX.ember(this.x,this.y,10);
    } else if(art.n==='Iai'){
      this.art={t:0,total:0.72,phase:0,w,art,dmg:this.attackDamage(w,true,true),
        pd:this.poiseDamageOf(w,true,true,false),range:130,spread:0.42,dash:150,ashen};
      this.state='art'; Audio_.tone(1400,.3,{type:'sine',gain:.09,glide:300});
    } else if(art.n==='Blessed Strike'||art.n==='Forge Strike'){
      this.art={t:0,total:0.66,phase:0,w,art,dmg:this.attackDamage(w,true,true),
        pd:this.poiseDamageOf(w,true,true,false),range:56,spread:TAU*0.5,aoe:true,ashen};
      this.state='art'; Audio_.swing(true,true);
      if(art.n==='Blessed Strike'){ this.hp=Math.min(this.maxHp,this.hp+Math.round(this.maxHp*0.05)); FX.ember(this.x,this.y,18) }
    } else if(art.n==='Pierce the Ash'){
      this.art={t:0,total:0.70,phase:0,w,art,dmg:this.attackDamage(w,true,true),
        pd:this.poiseDamageOf(w,true,true,false),range:150,spread:0.3,dash:110,ashen};
      this.state='art'; Audio_.swing(true,true);
    } else if(art.n==='Volley'){
      this.tryShoot(w,true,art);
    }
    if(!this.art){ Game.toast(art.n+' — no effect'); this.fp+=fp }
  }
  tickArt(dt){
    const a=this.art; a.t+=dt;
    if(a.dash && a.t<0.26){ const s=a.dash*dt/0.26; this.moveBy(Math.cos(this.facing)*s,Math.sin(this.facing)*s,dt) }
    if(a.t>a.total*0.42 && !a.hit){
      a.hit=true;
      const dmg=Object.assign({},a.dmg); dmg.phys=Math.round(dmg.phys*a.art.dmg);
      Game.hitArc(this.x,this.y,this.facing,a.spread,a.range+this.r,this,
        a.pd*(a.art.n==='Stance'||a.art.n==='Stomp'?1.3:1),dmg,
        {heavy:true,art:true,ashen:a.ashen,posture:a.art.posture||Math.round(a.pd*1.3),weapon:a.w,
         type:a.w.c==='pike'?'pierce':'phys'});
      if(a.aoe) FX.ember(this.x+Math.cos(this.facing)*40,this.y+Math.sin(this.facing)*40,26);
      Cam.kick(6,.24); Audio_.hit(false,true);
    }
    if(a.t>=a.total){ this.art=null; this.state='idle' }
  }

  /* ---------- bows ---------- */
  tryShoot(w,heavy,art){
    if(!Game.ammo){ Game.toast('No arrows.'); return }
    if(!this.spendSta(heavy?20:12)) return;
    this.facing=this.aimAngle();
    const n = art&&art.n==='Volley'? 3 : 1;
    for(let i=0;i<n;i++) setTimeout(()=>{
      if(this.dead) return;
      const dmg=this.attackDamage(w,heavy);
      Game.spawnProjectile(this.x,this.y,this.facing+rnd(0.06,-0.06)*(i>0?1:0),{
        spd:660,dmg:dmg.phys*(art?art.dmg:1),type:'phys',team:'player',src:this,
        pd:this.poiseDamageOf(w,heavy,false,false),life:1.1,arrow:true});
      Audio_.bow();
    }, i*(art&&art.n==='Volley'?110:0));
    this.state='idle';
  }

  /* ---------- casting (Vol 4 §4.2) ---------- */
  tryCast(heavy){
    const cat=this.catalyst;
    if(!cat){ Game.toast('Equip a catalyst to cast.'); return }
    const list=this.attuned.filter(Boolean);
    if(!list.length){ Game.toast('Attune a spell first (Menu → Attunement).'); return }
    // quickslots 1–4 select the attuned spell; heavy cast picks the second slot
    const idx = clamp(heavy? 1 : this.qs, 0, list.length-1);
    this.castSpell(list[idx]||list[0],cat);
  }
  castSpell(name,cat){
    const S=SPELLS[name]; if(!S) return;
    if(S.sch!==cat.cat.school && cat.cat.school!=='pyro'){ Game.toast('Wrong catalyst for '+name+'.'); return }
    if(this.fp<S.fp){ Game.toast('Not enough FP'); return }
    if(S.want && this.want+S.want>WANT_MAX+ (COVENANTS[this.covenant]?.bonus?.wantRegen?1:0)){ Game.toast('WANT is full — it will not take more.'); return }
    if(S.cost){ const c=Math.round(this.maxHp*S.cost); this.hp-=c; FX.dark(this.x,this.y,20); if(this.hp<=0){this.beginDeath();return} }
    this.fp-=S.fp;
    if(S.want){ this.want=Math.min(WANT_MAX,this.want+S.want); this.checkResonance() }
    /* CAST_FRAMES = BASE × CATALYST_SPEED × ADP_MOD × DEX_MOD × MOVEMENT_MOD × LOAD_MOD */
    const frames=CAST_FRAMES(S.fr,cat.cat.speed,this.d.adpMod,this.d.dexMod,1.0,this.d.loadMod);
    this.cast={name,S,cat,t:0,total:frames/FPS,phase:0};
    this.state='cast'; this.staDelay=Math.max(this.staDelay,0.2);
    Audio_.cast();
  }
  tickCast(dt){
    const c=this.cast; c.t+=dt;
    if(c.t>=c.total && !c.done){
      c.done=true;
      const S=c.S, ang=this.aimAngle();
      const dmg=spellDamage(c.name,this.stats,c.cat.cat)*(1+this.d.spellDmg)*(1+RES_LADDER[this.resonance].bonus*(S.t==='dark'?1:0));
      if(S.kind==='self'){
        const h=Math.round((S.heal||0)*(1+this.stats.FTH*0.004));
        this.hp=Math.min(this.maxHp,this.hp+h); FX.text(this.x,this.y-24,'+'+h,'#9ac87f',15,-40,1.1);
        FX.ember(this.x,this.y,20); Audio_.heal();
      } else if(S.kind==='bolt'||S.kind==='homing'||S.kind==='blast'||S.kind==='arc'||S.kind==='beam'){
        const n=S.count||1;
        for(let i=0;i<n;i++){
          const a=ang+rnd(0.16,-0.16)*(n>1?1:0);
          Game.spawnProjectile(this.x+Math.cos(a)*14,this.y+Math.sin(a)*14,a,{
            spd:S.spd||520,dmg:Math.round(dmg/n),type:S.t,team:'player',src:this,
            pd:S.posture||26,life:(S.rng||400)/(S.spd||520),kind:S.kind,homing:S.kind==='homing',
            radius:S.radius||0,burn:S.burn||0,drain:S.drain||0,school:S.sch,col:SPELL_COL[S.sch]});
        }
        Audio_.spell(dmg>400);
        if(S.t==='dark'){ Audio_.dark(); FX.dark(this.x+Math.cos(ang)*18,this.y+Math.sin(ang)*18,14) }
        if(S.t==='fire'){ Audio_.fire(); FX.fire(this.x+Math.cos(ang)*18,this.y+Math.sin(ang)*18,14) }
        if(S.t==='lightning'){ Audio_.tone?.(1800,.2,{gain:.08}); FX.lightning(this.x+Math.cos(ang)*18,this.y+Math.sin(ang)*18) }
        Cam.kick(dmg>500?6:3,.2);
      }
      this.cast=null; this.state='idle';
    }
  }
  checkResonance(){
    const r = this.want>=6?3 : this.want>=4?2 : this.want>=2?1 : 0;
    if(r!==this.resonance){
      this.resonance=r; Audio_.resonance(r);
      if(r>0) Game.toast('RESONANCE '+r+' — +'+Math.round(RES_LADDER[r].bonus*100)+'% dark damage'+(r===3?' · poise Grade ≤2 cannot stagger thee':''));
      FX.want(this.x,this.y,18);
    }
  }

  /* ---------- healing (Vol 7 §7.1 / §7.2) ---------- */
  startDrink(){
    if(this.drink||this.cast||this.roll) return;
    this.estus--;
    this.drink={t:0,total:ESTUS_FRAMES(this.stats.ADP)/FPS,kind:'estus'};
    this.state='drink'; Audio_.drink();
    this.staDelay=STA_DELAY;
  }
  tickDrink(dt){
    const d=this.drink; d.t+=dt;
    if(Math.random()<dt*22) FX.ember(this.x,this.y-6,1);
    if(d.t>=d.total){
      const h=ESTUS_HEAL(Game.estusUpg);
      this.hp=Math.min(this.maxHp,this.hp+h);
      FX.text(this.x,this.y-26,'+'+h,'#e8cf94',16,-44,1.2); FX.ember(this.x,this.y,22);
      Audio_.heal(); this.drink=null; this.state='idle';
    }
  }
  startGem(){
    if(this.gems<=0) return;
    this.gems--; this.gemT=GEM_TIME; this.gemUses++;
    this.state='idle'; Audio_.gem();
    Game.toast('Life Gem — '+GEM_HEAL+' HP over '+GEM_TIME+' s. Movement −'+(this.gemUses*GEM_PENALTY*100).toFixed(0)+'%');
  }
  tickGem(dt){
    this.gemT-=dt;
    const rate=GEM_HEAL/GEM_TIME;
    this.hp=Math.min(this.maxHp,this.hp+rate*dt);
    if(Math.random()<dt*10) FX.emit(this.x,this.y,1,{col:['#cfe8c0','#9fd8c0'],spd:22,life:1.0,r:2,grav:-24,glow:true});
    if(this.gemT<=0){ this.gemT=0; this.gemUses=Math.max(0,this.gemUses-1) }
  }

  /* ---------- death (Vol 7 §7.8) ---------- */
  beginDeath(){
    if(this.dead) return;
    this.dead=true; this.dying=0.0001; this.state='dying';
    this.deaths++;
    Audio_.die(); Audio_.stopMusic();
    FX.death(this.x,this.y);
    Game.onPlayerDeath();
  }

  /* ---------- rendering ---------- */
  draw(g,cam,t){
    const sx=this.x-cam.x, sy=this.y-cam.y;
    if(sx<-80||sy<-80||sx>cam.w+80||sy>cam.h+80) return;
    const dying=this.dead? Math.min(1,this.dying/1.5):0;
    g.save(); g.translate(sx,sy);
    // shadow
    g.globalAlpha=0.42; g.fillStyle='#000';
    g.beginPath(); g.ellipse(0,this.r*0.72,this.r*(1-dying*0.3),this.r*0.42*(1-dying*0.4),0,0,TAU); g.fill();
    g.globalAlpha=1;
    if(dying>0){ g.globalAlpha=1-dying; g.rotate(dying*1.2) }

    // roll: the body tucks
    const rolling=this.state==='roll'||this.state==='backstep';
    if(rolling){ const p=this.roll.t/this.roll.total; g.rotate(p*TAU*(this.roll.back?-0.6:1)); g.scale(1-0.18*Math.sin(p*Math.PI),1-0.18*Math.sin(p*Math.PI)) }

    const A=ARMOR[this.gear.arm]||ARMOR['Tattered Rags'];
    const bodyCol = BIOME_BODY[this.gear.arm]||'#4a4238';
    const step=Math.sin(this.bob*2)*1.6*(this.state==='run'?1:this.state==='walk'?0.5:0.15);

    // cloak / body
    g.fillStyle=this.hitFlash>0? '#ffffff' : bodyCol;
    g.beginPath(); g.ellipse(0,step*0.3,this.r*0.98,this.r*1.12,0,0,TAU); g.fill();
    // armour highlight by set
    g.fillStyle='rgba(255,255,255,.10)';
    g.beginPath(); g.ellipse(-this.r*0.28,-this.r*0.34,this.r*0.44,this.r*0.34,0,0,TAU); g.fill();
    // poise grade rim (Vol 9 §9.1: the Poise Diamond is also readable on the body)
    if(SETTINGS.showPoise && this.poise>0){
      const gc=['#4a4a4a','#7d8a5c','#8a7a4a','#b08a45','#c98a3a','#e2a34a'][this.grade];
      g.strokeStyle=gc; g.lineWidth=1.4; g.globalAlpha=0.55+0.25*Math.sin(t*2);
      g.beginPath(); g.arc(0,0,this.r+3.2,0,TAU); g.stroke(); g.globalAlpha=1;
    }
    // i-frame shimmer
    if(this.iframe>0){ g.strokeStyle='rgba(207,227,255,.55)'; g.lineWidth=2;
      g.beginPath(); g.arc(0,0,this.r+6,0,TAU); g.stroke() }
    // head
    g.fillStyle=this.hitFlash>0?'#fff':'#c9b79a';
    g.beginPath(); g.arc(Math.cos(this.facing)*2.4,Math.sin(this.facing)*2.4-this.r*0.30,this.r*0.46,0,TAU); g.fill();
    // hollowing (Vol 1 §1.4)
    if(this.sigils>0){ g.fillStyle='rgba(60,20,20,.5)';
      for(let i=0;i<this.sigils;i++) g.fillRect(-this.r*0.5+i*3.4,this.r*0.2,2,2) }

    /* ---- weapon ---- */
    const w=this.rhWeapon;
    if(w){
      const swing=this.atk? this.atkT01() : this.art? this.art.t/this.art.total : 0;
      const act=this.atk||this.art;
      let ang=this.facing;
      if(act){
        const s=act.atk?act.atk.swing:1;
        ang = this.facing + (swing-0.5)*(act.atk?act.atk.spread*1.5:2.4)*s;
      }
      const L = w.c==='great'?34 : w.c==='pike'?44 : w.c==='bow'?20 : w.c==='catalyst'?14 : 24;
      g.save(); g.rotate(ang);
      // two-handed / power stance: draw the off-hand weapon too
      const dual = this.twoHand? 1 : (this.lhWeapon&&!SHIELDS[this.gear.lh]? 2 : 1);
      for(let k=0;k<dual;k++){
        g.save();
        if(dual===2) g.rotate(k? -0.30- (act?swing*0.9:0) : 0.30+(act?swing*0.9:0));
        g.translate(this.r*0.62, k&&dual===2? 4 : -4);
        g.fillStyle='#2a2118'; g.fillRect(-2,-1.6,7,3.2);                 // grip
        g.fillStyle= w.cat? '#6a4a8a' : this.resin? RESIN_COL[this.resin.t] : '#b9b0a0';
        if(w.cat){ g.beginPath(); g.arc(L*0.7,0,6,0,TAU); g.fill();
          g.fillStyle='rgba(200,163,90,.6)'; g.beginPath(); g.arc(L*0.7,0,3+Math.sin(t*4)*1.2,0,TAU); g.fill() }
        else if(w.c==='bow'){ g.strokeStyle='#8a7355'; g.lineWidth=2.4;
          g.beginPath(); g.arc(0,0,L*0.9,-1.0,1.0); g.stroke() }
        else { g.beginPath(); g.moveTo(4,-2.6); g.lineTo(L,-1.1); g.lineTo(L+3,0); g.lineTo(L,1.1); g.lineTo(4,2.6); g.closePath(); g.fill();
          g.fillStyle='rgba(255,255,255,.30)'; g.fillRect(6,-1.2,L-6,1.0) }
        g.restore();
      }
      g.restore();
      // swing arc
      if(act && swing>0.12 && swing<0.86){
        const sp=(act.atk?act.atk.spread:2.2);
        g.save(); g.rotate(this.facing);
        g.strokeStyle=act.atk&&act.atk.stance? 'rgba(255,208,138,.62)' : 'rgba(233,224,205,.34)';
        g.lineWidth= act.atk&&act.atk.heavy? 5 : 3;
        g.beginPath();
        const a0=-sp/2+sp*(swing-0.12)/0.74*(act.atk?act.atk.swing:1);
        g.arc(0,0,(act.atk?act.atk.range:56)*0.92, Math.min(a0,a0+sp*0.5), Math.max(a0,a0+sp*0.5));
        g.stroke(); g.restore();
      }
    }
    /* ---- shield on the left arm ---- */
    if(this.shield && !this.twoHand){
      g.save(); g.rotate(this.facing);
      g.translate(this.r*0.5, 8); g.rotate(this.guarding? -0.5:0.2);
      const big=this.shield.poise>=14;
      g.fillStyle=big?'#4a4238':'#5c5142';
      g.beginPath();
      if(big) g.rect(-4,-11,10,22); else { g.moveTo(-3,-8); g.lineTo(6,-6); g.lineTo(6,6); g.lineTo(-3,8); g.closePath() }
      g.fill();
      g.strokeStyle='#8a7f70'; g.lineWidth=1.2; g.stroke();
      if(this.guarding){ g.strokeStyle='rgba(207,227,255,.5)'; g.lineWidth=2;
        g.beginPath(); g.arc(2,0,15,-1.1,1.1); g.stroke() }
      g.restore();
    }
    /* ---- casting glow ---- */
    if(this.cast){
      const p=this.cast.t/this.cast.total;
      const col=SPELL_COL[this.cast.S.sch];
      g.save(); g.rotate(this.facing); g.translate(this.r+12,0);
      g.globalAlpha=0.35+0.5*p; g.fillStyle=col;
      g.beginPath(); g.arc(0,0,3+13*p,0,TAU); g.fill();
      g.globalAlpha=0.9; g.beginPath(); g.arc(0,0,1.6+4*p,0,TAU); g.fill();
      g.restore(); g.globalAlpha=1;
    }
    /* ---- drinking ---- */
    if(this.drink){
      const p=this.drink.t/this.drink.total;
      g.fillStyle='#e2a33a'; g.globalAlpha=0.5+0.5*Math.sin(p*18);
      g.beginPath(); g.arc(Math.cos(this.facing)*8,-this.r*0.9,3.4,0,TAU); g.fill(); g.globalAlpha=1;
    }
    /* ---- stagger / posture break ---- */
    if(this.stagger>0){
      g.strokeStyle='rgba(255,208,138,.75)'; g.lineWidth=1.6;
      for(let i=0;i<3;i++){ const a=t*7+i*2.1;
        g.beginPath(); g.arc(Math.cos(a)*this.r*1.5,-this.r*1.7+Math.sin(a)*3,1.8,0,TAU); g.stroke() }
    }
    /* ---- lock-on reticle ---- */
    if(this.lockTarget){
      g.strokeStyle='rgba(200,163,90,.5)'; g.lineWidth=1;
      g.beginPath(); g.arc(0,0,this.r+9,t*2,t*2+1.2); g.stroke();
      g.beginPath(); g.arc(0,0,this.r+9,t*2+Math.PI,t*2+Math.PI+1.2); g.stroke();
    }
    g.restore();
  }
  atkT01(){ if(!this.atk) return 0; const [s,a,r]=this.atk.fr; return clamp(this.atk.t/(s+a+r),0,1) }
}
const SPELL_COL={sorc:'#9fd8ee',mira:'#ffe9b0',pyro:'#ffb84a',hex:'#c9a8f0'};
const RESIN_COL={fire:'#e2703a',lightning:'#ffe9b0',dark:'#9a6fd0',magic:'#9fd8ee'};
const BIOME_BODY={
  'Tattered Rags':'#4a4238','Pilgrim Rags':'#52483c','Acolyte Robes':'#6a6252','Pyromancer Wraps':'#6d4526',
  'Hexwife Set':'#4a3a52','Sellsword Set':'#4d4a3c','Warden Set':'#4a5240','Artificer Set':'#5a4a38',
  'Ashen Knight Set':'#6b6558','Drakeblood Set':'#5c4a3a','Remnant Dragon Set':'#6e5a3c',
};

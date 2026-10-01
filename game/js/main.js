/* =====================================================================
   main.js — the game: state machine, zone spawning, combat resolution,
   bonfires, ascetics, severance, endings, save, and the render loop.
   ===================================================================== */
'use strict';
let SETTINGS = Set_.load();
const Flags = {};

const Game = {
  state:'title', player:null, preview:null,
  enemies:[], bosses:[], projectiles:[], drops:[], bonfires:[], links:[], npcs:[], fogGates:[], inter:[],
  tokens:[], bossFight:null, arenaLock:null,
  ascetic:{}, asceticEcho:{}, litBonfires:{}, pickedItems:{}, bossFlags:{},
  estusUpg:0, playTime:0, lastSave:0, t:0, acc:0, last:0, fps:60, frameMs:0,
  aggression:0, slowmo:0, arenaTint:null, introT:0, cycle:0,
  talkNpcRef:null, bloodstain:null, _deathToken:null,

  /* ================= boot ================= */
  boot(){
    const cv=$('#cv'); this.ctx=cv.getContext('2d',{alpha:false});
    this.resize(); addEventListener('resize',()=>this.resize());
    Input.init(cv);
    UI.init();
    this.bindGlobalKeys();
    this.last=performance.now();
    requestAnimationFrame(t=>this.loop(t));
    setTimeout(()=>$('#ovBoot').classList.remove('show'),260);
  },
  resize(){
    const cv=$('#cv');
    const ar=16/9, w=innerWidth, h=innerHeight;
    let cw=w, ch=w/ar; if(ch>h){ ch=h; cw=h*ar }
    cw=Math.floor(cw*SETTINGS.screenScale); ch=Math.floor(ch*SETTINGS.screenScale);
    cv.style.width=Math.min(w,cw)+'px'; cv.style.height=Math.min(h,ch)+'px';
    const dpr=Math.min(2,devicePixelRatio||1);
    cv.width=Math.round(960*dpr); cv.height=Math.round(540*dpr);
    this.ctx.setTransform(dpr,0,0,dpr,0,0);
    Cam.set(960,540);
    this.scale=960/cv.getBoundingClientRect().width;
  },
  bindGlobalKeys(){
    addEventListener('keydown',e=>{
      if(e.code==='Escape'||e.code==='Tab'){
        e.preventDefault();
        if(this.state!=='play') return;
        if(UI.menuOpen) this.closeMenu(); else this.openMenu();
      }
      if(this.state!=='play'||UI.menuOpen) return;
      if(e.code==='KeyZ') this.openMenu('stats');
      if(e.code==='KeyM') this.openMenu('map');
      if(e.code==='KeyB') this.gesture();
    });
  },

  /* ================= state transitions ================= */
  toTitle(){ this.state='title'; UI.show('#ovTitle'); $('#btnContinue').disabled=!Save.exists();
    Audio_.stopMusic(); this.clearEntities() },
  openMenu(tab){ if(this.state!=='play')return; UI.openMenu(tab||'stats'); Audio_.fadeMusicTo(0.06,0.4) },
  closeMenu(){ UI.menuOpen=false; UI.bf=null; UI.show(null); Audio_.fadeMusicTo(0.30,0.5); this.save() },
  clearEntities(){ this.enemies=[];this.bosses=[];this.projectiles=[];this.drops=[];this.bonfires=[];
    this.links=[];this.npcs=[];this.fogGates=[];this.inter=[];this.tokens=[];this.bossFight=null;this.arenaLock=null;
    FX.clear() },

  /* ================= new game ================= */
  previewPlayer(cls){
    const p=new Player();
    const st={}; ATTRS.forEach((a,i)=>st[a.k]=cls.s[i]);
    p.stats=st; p.classId=cls.id;
    p.gear={rh:cls.gear.rh,lh:cls.gear.lh,arm:cls.gear.arm,legs:null,rings:[]};
    p.inv.weapons=[cls.gear.rh,cls.gear.lh].filter(Boolean);
    p.inv.armor=[cls.gear.arm];
    if(SHIELDS[cls.gear.lh]) p.inv.shields=[cls.gear.lh];
    p.recalc(); p.hp=p.maxHp; p.fp=p.maxFp; p.sta=p.maxSta;
    return p;
  },
  startNewGame(cls){
    Audio_.resume();
    const p=this.previewPlayer(cls);
    this.player=p;
    p.inv.items={};
    for(const g of (START_GIFTS[cls.gift]||[])) p.inv.items[g]=(p.inv.items[g]||0)+1;
    // class-specific opening kit
    if(cls.gear.rh&&WEAPONS[cls.gear.rh]?.cat) p.inv.spells.push(...this.startingSpells(cls));
    p.estusMax=p.estus=5; p.gems=Math.max(0,(p.inv.items['Life Gem']||0)); p.inv.items['Life Gem']=0;
    p.attuned=[]; p.quickslot=[null,null,null,null];
    if(p.inv.items['Ember']){ p.quickslot[0]='Ember'; p.inv.items['Ember']-- ; if(!p.inv.items['Ember'])delete p.inv.items['Ember'] }
    if(p.gems>0) p.quickslot[1]='Life Gem';
    Object.assign(Flags,{sovereignDead:false,karragDead:false,vharosDead:false,cathedralKey:false,childMet:false});
    this.ascetic={}; this.asceticEcho={}; this.litBonfires={}; this.pickedItems={}; this.bossFlags={};
    this.estusUpg=0; this.playTime=0; this.cycle=0;
    World.loaded.clear();
    this.enterZone('R01','pit',true);
    p.x=20*TS; p.y=94*TS;
    this.state='play'; UI.show(null); $('#hud').classList.remove('hidden');
    this.litBonfires['bf_waking']=true; this.lastBonfire='bf_waking'; p.lastBonfire='bf_waking';
    Audio_.startAmbient('R01');
    this.toast('THE ASHEN BARRENS · SL '+p.level_,3.0);
    setTimeout(()=>this.toast('Vol 3 §3.7 — thou art rolling '+p.d.tier.n+' ('+p.d.iframe+' i-frames). Vitality buys frames.',4.0),3200);
    this.save();
  },
  startingSpells(cls){
    return ({acol:['Heal'],ember:['Fireball'],hex:['Dark Orb'],pilg:['Soul Arrow','Heal'],arti:[]})[cls.id]||[];
  },

  /* ================= zones ================= */
  enterZone(id,at='default',fresh=false){
    const z=ZONES[id]; if(!z) return;
    World.enter(id,null,fresh);
    this.clearEntities(); this.arenaTint=null;
    // reset transient boss hazards from the previous zone
    this.bonfires=(z.bonfires||[]).map(b=>new Bonfire(b,z));
    this.links=(z.links||[]).map(l=>new ZoneLink(l,z));
    this.drops=(z.items||[]).filter(it=>!this.pickedItems[id+'|'+(it.n||it.x)]).map(it=>new ItemDrop(it,z));
    this.npcs=(z.npcs||[]).map(n=>new NPC(n,z));
    if(z.boss){
      this.fogGates=[new FogGate(Object.assign({x:z.boss.fogGate.x,y:z.boss.fogGate.y,
        w:z.boss.fogGate.w,h:z.boss.fogGate.h},{}),z)];
    } else this.fogGates=[];
    // enemies
    const asc=this.ascetic[id]||0, A=ASCETIC[Math.min(4,asc)];
    for(const e of (z.encounters||[])) this.spawnEnemy(e.t,e.x,e.y,{hpMult:A.hp,dmgMult:A.dmg,soulsMult:A.souls});
    // boss
    if(z.boss && !Flags[z.boss.id+'Dead']) this.spawnBoss(z.boss.id,z.boss.x,z.boss.y,z);
    // A4 Kindled Echo (Vol 7 §7.3.4)
    if(asc>=4){
      const name=ECHOES[(this.asceticEcho[id]||0)%ECHOES.length];
      const e=this.spawnEnemy('elite_matriarch', z.rooms[2]?z.rooms[2].x+z.rooms[2].w/2:z.rooms[0].x+100,
        z.rooms[2]?z.rooms[2].y+z.rooms[2].h/2:z.rooms[0].y+100,
        {hpMult:A.hp*2.2,dmgMult:A.dmg*1.3,soulsMult:A.souls*3});
      if(e){ e.name='Kindled Echo · '+name; e.elite={n:'Kindled Echo · '+name}; e.echo=true; e.col='#e2a34a';
        this.toast('A KINDLED ECHO WALKS: '+name.toUpperCase(),3.4) }
    }
    // arrival position
    const p=this.player;
    if(p){
      if(at==='pit'){ p.x=20*TS; p.y=94*TS }
      else if(at==='north'){ p.x=67*TS; p.y=79*TS }
      else if(at==='south'){ p.x=29*TS; p.y=64*TS }
      else if(at==='gate'){ p.x=67*TS; p.y=76*TS }
      else if(at==='forge'){ p.x=22*TS; p.y=10*TS }
      else if(at==='crypt'){ p.x=62*TS; p.y=-16*TS }
      else if(at==='cathedral'){ p.x=26*TS; p.y=78*TS }
      else if(at==='approach'){ p.x=70*TS; p.y=4*TS }
      else if(at==='vharosNave'){ p.x=92*TS; p.y=-24*TS }
      else if(at==='mouth'){ p.x=4*TS; p.y=10*TS }
      else if(at==='default'){ const bf=this.bonfires.find(b=>b.id===this.lastBonfire&&b.zone===id)||this.bonfires[0];
        if(bf){p.x=bf.x;p.y=bf.y+26} }
      World.contain(p);
      Cam.x=p.x-Cam.w/2; Cam.y=p.y-Cam.h/2;
    }
    // re-seal corridors that are still locked
    UI.show(null);
    if(!fresh) Audio_.startAmbient(id);
    this.zoneIntro(z);
  },
  zoneIntro(z){
    this.introT=3.6;
    this.toast(z.id+' · '+z.n.toUpperCase()+' · SL '+z.sl,3.4);
  },
  checkLinks(){
    const p=this.player;
    for(const l of this.links){
      if(p.x>l.x&&p.x<l.x+l.w&&p.y>l.y&&p.y<l.y+l.h){
        if(l.blocked){
          if(!l._told||this.t-l._told>3){ l._told=this.t; this.toast(l.msg||'Sealed.',3.0); Audio_.ui(false) }
          // push back out
          const cx=l.x+l.w/2, cy=l.y+l.h/2, d=norm(p.x-cx,p.y-cy);
          p.x=cx+d.x*(Math.max(l.w,l.h)/2+p.r+2); p.y=cy+d.y*(Math.max(l.w,l.h)/2+p.r+2);
          World.contain(p);
          return;
        }
        if(!l._cd||this.t-l._cd>1){ l._cd=this.t; this.enterZone(l.to,l.at); this.save(); return }
      }
    }
  },

  /* ================= spawning ================= */
  spawnEnemy(type,x,y,opt={}){
    const a=this.ascetic[World.zoneId]||0;
    const e=new Enemy(type,x,y,Object.assign({hpMult:ASCETIC[a].hp,dmgMult:ASCETIC[a].dmg,soulsMult:ASCETIC[a].souls},opt));
    this.enemies.push(e); return e;
  },
  spawnBoss(id,x,y,zone){
    const C=BOSS_CLASS[id]; if(!C) return null;
    const b=new C(x,y,zone);
    b.arena=zone.boss?.arena||null;
    this.bosses.push(b); return b;
  },
  spawnProjectile(x,y,ang,o){
    this.projectiles.push(Object.assign({x,y,ang,vx:Math.cos(ang)*(o.spd||400),vy:Math.sin(ang)*(o.spd||400),
      t:0,life:o.life||1.4,r:o.wide?9:5,hit:false},o));
  },
  spawnHazard(o){ this.inter.push(Object.assign({kind:'hazard',t:0,r:o.r},o)) },

  /* ================= combat resolution ================= */
  tokens_(){ return this.tokens.filter(e=>!e.dead) },
  tokenCount(){ return this.tokens_.length },
  takeToken(e){ this.tokens.push(e); return 'attack' },
  releaseToken(e){ this.tokens=this.tokens.filter(x=>x!==e) },

  /* the player's melee arc */
  hitArc(x,y,ang,spread,range,src,poiseDmg,dmg,opt={}){
    let any=false;
    const targets=[...this.enemies,...this.bosses];
    for(const e of targets){
      if(e.dead||e.spawnT>0) continue;
      if(e===Game.bossFight && Game.bossFight.invuln>0) continue;
      if(!arcHits(x,y,ang,spread,range,e.x,e.y,e.r)) continue;
      any=true;
      // severance: the arc must reach the part and the type must match (Vol 3 §3.9)
      if(e.part && !e.part.sev){
        const pp=e.partPos(this.t);
        if(Math.hypot(pp.x-x,pp.y-y)<range+e.r*0.6){
          const w=opt.weapon, cls=w?w.c:null;
          const t = cls==='strike'?'STRIKE' : cls==='pike'?'PIERCE' : cls==='bow'?'PIERCE' : 'SLASH';
          e.hitPart(dmg.total||dmg.phys||0, opt.art? 'ANY' : t, src);
        }
      }
      this.applyHit(e,src,{dmg:dmg.phys||dmg,extra:dmg.extra,poiseDmg,type:opt.type||'phys',
        crit:src.postureBrokenFor||false,bleed:dmg.bleed||0,burn:dmg.burn||0,
        knock:(opt.heavy?22:12)*(opt.art?1.5:1),posture:opt.posture||0,
        mult:src.stanceActive&&opt.stance?1.0:1, weapon:opt.weapon, art:opt.art});
    }
    // projectiles in flight can be batted down (Vol 3 §3.5.6)
    for(const pr of this.projectiles){
      if(pr.hit||pr.team==='player') continue;
      if(arcHits(x,y,ang,spread,range,pr.x,pr.y,pr.r+6)){
        pr.hit=true; any=true; FX.hitSpark(pr.x,pr.y,ang,8); Audio_.guard();
        this.spawnProjectile(x,y,ang+rnd(0.5,-0.5),Object.assign({},pr,{team:'player',src,spd:pr.spd*0.8,t:0,hit:false}));
      }
    }
    return any;
  },
  applyHit(target,src,o){
    if(target.dead) return null;
    let dmg=o.dmg||0;
    const p=this.player; if(!p) return null;
    if(target.team==='enemy'&&src===p){
      if(o.extra) for(const [k,v] of Object.entries(o.extra)) dmg+=v;
      if(o.weapon) dmg+=o.weapon._bonus||0;
      if(p.resin) dmg=Math.round(dmg*1.30);
      dmg=Math.round(dmg*(1+p.d.spellDmg*0));
      if(p.resonance>=3&&o.type==='dark') dmg=Math.round(dmg*1.32);
    }
    const res=target.takeHit({dmg,poiseDmg:o.poiseDmg||0,posture:o.posture||0,type:o.type||'phys',
      knock:o.knock||0,src,atk:src,mult:o.mult,crit:o.crit,bleed:o.bleed,burn:o.burn,poison:o.poison,
      staDmg:o.staDmg,boss:o.boss});
    if(!res) return null;
    if(res.parried && src===p){ /* player parried an enemy */ }
    if(res.parried && target===p){ /* enemy parried the player — not implemented, players can't be parried */ }
    if(target.team==='enemy'&&src===p){
      if(o.type==='dark'||o.extra?.dark){ p.want=Math.min(WANT_MAX,p.want+0.34); p.checkResonance() }
      if(p.stanceActive) p.stanceT=Math.max(p.stanceT,0.9);
      if(res.staggered&&target.isBoss) this.toast('BOSS STAGGERED — riposte with F',2.4);
    }
    if(target===p&&res.staggered) UI.toast('THY POISE BUDGET EMPTIED',1.8);
    return res;
  },
  tryRiposte(){
    const p=this.player;
    let best=null,bd=1e9;
    for(const e of [...this.enemies,...this.bosses]){
      if(e.dead||e.stagger<=0) continue;
      const d=dist(p,e); if(d<e.r+p.r+30 && d<bd){bd=d;best=e}
    }
    if(!best) return false;
    const w=p.rhWeapon;
    const base=w&&w.dmg? this.playerAttackDamage(w,true).phys : 90+p.stats.STR*1.6;
    const dmg=Math.round(base*PARRY.riposte*(best.isBoss?0.55:1));
    best.invuln=0;
    best.takeHit({dmg,poiseDmg:0,type:'phys',crit:true,knock:0,src:p,atk:p,mult:1});
    Audio_.crit(); Cam.kick(14,.5); HitStop.set(12);
    FX.blood(best.x,best.y,rnd(TAU),30); FX.hitSpark(best.x,best.y,Math.atan2(best.y-p.y,best.x-p.x),20);
    FX.text(best.x,best.y-best.r-16,'RIPOSTE '+dmg,'#ffd08a',19,-40,1.4);
    best.stagger=0; best.postureBroken=false; best.riposteable=false;
    return true;
  },
  playerAttackDamage(w,heavy){ return this.player.attackDamage(w,heavy) },

  /* ================= projectiles & hazards ================= */
  updateProjectiles(dt){
    for(let i=this.projectiles.length-1;i>=0;i--){
      const pr=this.projectiles[i]; pr.t+=dt;
      if(pr.homing && pr.team==='player'){
        let best=null,bd=1e9;
        for(const e of [...this.enemies,...this.bosses]){ if(e.dead)continue; const d=dist(pr,e); if(d<320&&d<bd){bd=d;best=e} }
        if(best){ const a=Math.atan2(best.y-pr.y,best.x-pr.x);
          const cur=Math.atan2(pr.vy,pr.vx); const na=cur+clamp(angDiff(cur,a),-2.4*dt,2.4*dt);
          const s=Math.hypot(pr.vx,pr.vy); pr.vx=Math.cos(na)*s; pr.vy=Math.sin(na)*s }
      }
      pr.x+=pr.vx*dt; pr.y+=pr.vy*dt;
      if(Math.random()<dt*40){
        const c=pr.col||(pr.type==='fire'?'#ffb84a':pr.type==='dark'?'#9a6fd0':pr.type==='lightning'?'#cfe8ff':'#cfe3d8');
        FX.emit(pr.x,pr.y,1,{col:[c],spd:16,life:0.4,r:pr.wide?4:2.4,grav:0,glow:true,drag:2});
      }
      let dead=pr.t>pr.life;
      // world collision
      if(!dead && !World.onFloor(pr.x,pr.y,0)){ dead=true; FX.hitSpark(pr.x,pr.y,pr.ang,6) }
      // entity collision
      if(!dead){
        const list = pr.team==='player'? [...this.enemies,...this.bosses] : [this.player];
        for(const e of list){
          if(e.dead||e.iframe>0||e.invuln>0) continue;
          if(Math.hypot(e.x-pr.x,e.y-pr.y) < e.r+pr.r){
            pr.hit=true; dead=true;
            if(pr.radius){ // blast
              for(const e2 of list){ if(e2.dead) continue;
                if(Math.hypot(e2.x-pr.x,e2.y-pr.y)<pr.radius+e2.r)
                  this.applyHit(e2,pr.src,{dmg:pr.dmg,poiseDmg:pr.pd,type:pr.type,knock:22,burn:pr.burn}) }
              FX.fire(pr.x,pr.y,30); Audio_.spell(true); Cam.kick(8,.3);
            } else {
              this.applyHit(e,pr.src,{dmg:pr.dmg,poiseDmg:pr.pd,type:pr.type,knock:pr.arrow?8:14,burn:pr.burn,drain:pr.drain});
              if(pr.drain && pr.src===this.player){
                const h=Math.round(pr.dmg*pr.drain); this.player.hp=Math.min(this.player.maxHp,this.player.hp+h);
                FX.text(this.player.x,this.player.y-26,'+'+h,'#c9a8f0',14,-40,1.0);
              }
            }
            break;
          }
        }
      }
      if(dead) this.projectiles.splice(i,1);
    }
    // timed hazards (ash pillars, ashfall)
    for(let i=this.inter.length-1;i>=0;i--){
      const h=this.inter[i];
      if(h.kind!=='hazard'){ continue }
      h.t+=dt;
      if(h.t>=h.delay && !h.erupted){
        h.erupted=true;
        const p=this.player;
        if(Math.hypot(p.x-h.x,p.y-h.y)<h.r+p.r && p.iframe<=0)
          this.applyHit(p,h.src,{dmg:h.dmg,poiseDmg:h.pd,type:h.type,knock:20,burn:h.burn,boss:true});
        if(h.kind==='pillar'){ FX.dust(h.x,h.y,34); Audio_.hit(false,true); Cam.kick(7,.3);
          World.solids.push({x:h.x-16,y:h.y-16,w:32,h:32,pillar:true,life:22}) }
        else { FX.fire(h.x,h.y,26); Audio_.fire(); Cam.kick(4,.2) }
      }
      if(h.t>h.delay+h.life) this.inter.splice(i,1);
    }
    // decaying solids & boss trail hazards
    for(let i=World.solids.length-1;i>=0;i--){ const s=World.solids[i];
      if(s.life!==undefined){ s.life-=dt; if(s.life<=0){ FX.dust(s.x+16,s.y+16,10); World.solids.splice(i,1) } } }
    for(let i=World.hazards.length-1;i>=0;i--){ const h=World.hazards[i];
      if(h.life!==undefined){ h.life-=dt; if(h.life<=0) World.hazards.splice(i,1) } }
  },
  drawProjectiles(g,cam){
    for(const pr of this.projectiles){
      const sx=pr.x-cam.x, sy=pr.y-cam.y;
      if(sx<-40||sy<-40||sx>cam.w+40||sy>cam.h+40) continue;
      g.save(); g.translate(sx,sy); g.rotate(Math.atan2(pr.vy,pr.vx));
      const c=pr.col||(pr.type==='fire'?'#ffb84a':pr.type==='dark'?'#9a6fd0':pr.type==='lightning'?'#eaf4ff':'#cfe3d8');
      g.shadowBlur=12; g.shadowColor=c;
      if(pr.arrow){ g.fillStyle='#8a7355'; g.fillRect(-9,-1,16,2);
        g.fillStyle=c; g.beginPath(); g.moveTo(7,-3); g.lineTo(13,0); g.lineTo(7,3); g.closePath(); g.fill() }
      else if(pr.orb==='wave'){ g.fillStyle=c; g.globalAlpha=.8; g.fillRect(-14,-4,28,8) }
      else { g.fillStyle=c; g.beginPath(); g.arc(0,0,pr.r+Math.sin(pr.t*30)*1.2,0,TAU); g.fill();
        g.fillStyle='rgba(255,255,255,.85)'; g.beginPath(); g.arc(0,0,pr.r*0.4,0,TAU); g.fill() }
      g.restore();
    }
    // hazard warnings
    for(const h of this.inter){
      if(h.kind!=='hazard') continue;
      const sx=h.x-cam.x, sy=h.y-cam.y;
      if(sx<-120||sy<-120||sx>cam.w+120||sy>cam.h+120) continue;
      if(!h.erupted){
        const p=clamp(h.t/h.delay,0,1);
        g.strokeStyle=`rgba(255,180,90,${0.35+0.5*p})`; g.lineWidth=2;
        g.beginPath(); g.arc(sx,sy,h.r*(0.4+0.6*p),0,TAU); g.stroke();
        g.fillStyle=`rgba(226,112,58,${0.10+0.16*p})`; g.beginPath(); g.arc(sx,sy,h.r,0,TAU); g.fill();
      } else {
        const p=1-clamp((h.t-h.delay)/h.life,0,1);
        if(h.kind==='pillar'){
          g.fillStyle=`rgba(140,124,100,${p})`; g.beginPath(); g.arc(sx,sy,16+10*p,0,TAU); g.fill();
          g.fillStyle=`rgba(90,78,62,${p})`; g.fillRect(sx-14,sy-30*p,28,30*p);
        } else {
          g.fillStyle=`rgba(255,180,90,${p*0.7})`; g.beginPath(); g.arc(sx,sy,h.r*(1.4-0.4*p),0,TAU); g.fill();
        }
      }
    }
  },

  /* ================= death, souls, bloodstain ================= */
  onPlayerDeath(){
    const p=this.player;
    this.slowmo=1.0;
    UI.deathFade(true);
    if(p.souls>0){
      this.bloodstain={zone:World.zoneId,x:p.x,y:p.y,souls:p.souls,n:'thy bloodstain'};
      p.souls=0;
    } else this.bloodstain=null;
    Audio_.stopMusic();
    // the death screen is a real 1.7 s beat — but it must never fire if the player
    // has already been brought back (a stale timer used to strand the game in 'dead').
    const token = this._deathToken = Symbol('death');
    setTimeout(()=>{
      if(this._deathToken!==token || !p.dead) return;
      UI.show('#ovDeath');
      $('#deathTip').textContent=pick(TIPS);
      this.state='dead';
    },1700);
  },
  respawn(){
    const p=this.player;
    this._deathToken=null;                    // cancel any pending death screen
    p.dead=false; p.dying=0; p.state='idle';
    p.hp=p.maxHp; p.fp=p.maxFp; p.sta=p.maxSta;
    p.poiseDmg=0; p.posture=0; p.stagger=0; p.iframe=1.0; p.invuln=1.0;
    Object.keys(p.status).forEach(k=>delete p.status[k]);
    p.gemT=0; p.gemUses=0; p.want=Math.max(0,p.want-1); p.checkResonance();
    p.estus=p.estusMax; p.gems=Math.min(GEM_CARRY,p.inv.items['Life Gem']||0);
    UI.deathFade(false); UI.show(null); $('#hud').classList.remove('hidden');
    const bf=this.allBonfires().find(b=>b.id===this.lastBonfire)||this.allBonfires()[0];
    if(bf){ this.enterZone(bf.zone.id,bf.zone.hub?'south':'default'); p.x=bf.x; p.y=bf.y+26; World.contain(p) }
    this.state='play'; this.bossFight=null; this.arenaLock=null;
    Audio_.startAmbient(World.zoneId);
    this.save();
  },
  allBonfires(){ return Object.values(ZONES).flatMap(z=>(z.bonfires||[]).map(b=>({...b,zone:z}))) },
  collectBloodstain(){
    const p=this.player; if(!p) return;
    if(p.dead||p.dying>0) return;              // you cannot pick up your own stain while lying on it
    if(!this.bloodstain) return;
    if(this.bloodstain.zone!==World.zoneId) return;
    if(Math.hypot(p.x-this.bloodstain.x,p.y-this.bloodstain.y)>26) return;
    p.souls+=this.bloodstain.souls;
    FX.text(p.x,p.y-30,'+'+fmt(this.bloodstain.souls)+' SOULS RECOVERED','#cfe8d8',15,-40,1.6);
    FX.soul(p.x,p.y,26); Audio_.levelUp();
    this.bloodstain=null; this.save();
  },

  /* ================= kills & rewards ================= */
  onEnemyDeath(e){
    const p=this.player;
    p.kills++;
    const cov=COVENANTS[p.covenant]?.bonus;
    const souls=Math.round(e.soulValue*(cov?.souls||1)*p.d.soulsMult*(1+Game.ascetic[World.zoneId]*0.0));
    FX.soul(e.x,e.y,12); Audio_.die();
    setTimeout(()=>{
      if(p.dead) return;
      p.souls+=souls; p.bank+=souls;
      FX.text(e.x,e.y-10,'+'+fmt(souls),'#cfe8d8',12,-34,1.2);
      Audio_.soulPickup(Math.min(20,souls/100));
      if(p.resonance>=3&&p.want>0){ p.fp=Math.min(p.maxFp,p.fp+12) }
    },420);
    if(e.echo){ this.toast('THE KINDLED ECHO IS QUIET AGAIN',3.0); Flags['echo_'+e.name]=true }
    if(e.part&&!e.part.sev&&e.elite){ /* part survives death unsevered */ }
    if(e.part?.sev){ /* handled in onSeverance */ }
    this.releaseToken(e);
  },
  onBossDeath(b){
    const p=this.player;
    this.slowmo=2.6; p.kills++;
    Audio_.stopMusic(); Audio_.roar(true);
    Cam.kick(18,1.6);
    FX.death(b.x,b.y); FX.ember(b.x,b.y,60);
    Flags[b.id+'Dead']=true;
    p.bossesKilled.push(b.id);
    // unlock what the boss was blocking (Vol 5 §5.2.3 one-way doors)
    if(b.id==='sovereign') Flags.cathedralKey=true;
    if(b.id==='karrag') Flags.cathedralKey=true;
    if(b.id==='vharos'){ Flags.cathedralKey=true }
    // remove arena solids/hazards the boss added
    World.solids=World.solids.filter(s=>!s.pillar);
    World.hazards=World.hazards.filter(h=>!h.boss&&!h.bossTrail);
    this.arenaLock=null;
    setTimeout(()=>{
      if(this.state!=='play') return;
      const souls=b.soulValue;
      p.souls+=souls; p.bank+=souls;
      this.toast(fmt(souls)+' SOULS',3.0);
      FX.text(b.x,b.y-40,'+'+fmt(souls),'#e8cf94',20,-30,2.4);
      const soulItem={sovereign:'Sovereign Soul',karrag:'Karrag Soul',vharos:'Vharos Soul'}[b.id];
      if(soulItem){ p.inv.items[soulItem]=(p.inv.items[soulItem]||0)+1 }
      if(b.id==='vharos'){ this.toast('THE BRICKED DOOR OPENS BEHIND THEE',3.4) }
      if(b.id==='karrag'){ this.toast('THE FORNACE FLOOR COLLAPSES INTO THE CATHEDRAL',3.4) }
      if(b.id==='sovereign'){ this.toast('THE ROAD TO EMBER KEEP IS OPEN',3.4) }
      this.bossFight=null; this.save();
    },2600);
  },
  onSeverance(b){
    const p=this.player;
    p.severed.push(b.part.n);
    this.toast('SEVERED · '+b.part.n.toUpperCase()+' — '+b.part.reward,4.0);
    this.slowmo=Math.max(this.slowmo,1.4);
    const give={
      "Herald's Tail":{w:"Herald's Ash Pike"},
      "Forge Crown":{w:"Artificer's Hammer",item:'Ember-Forged Crown'},
      "Tail":{w:"Uchigatana"},
    }[b.part.n];
    if(give?.w && !p.inv.weapons.includes(give.w)) p.inv.weapons.push(give.w);
    if(give?.item) p.inv.items[give.item]=(p.inv.items[give.item]||0)+1;
    p.inv.items[b.part.n]=(p.inv.items[b.part.n]||0)+1;
    this.save();
  },

  /* ================= bonfires ================= */
  nearestInteract(){
    const p=this.player; let best=null,bd=1e9,kind=null;
    const test=(o,k,r)=>{ const d=Math.hypot(p.x-o.x,p.y-o.y); if(d<r&&d<bd){bd=d;best=o;kind=k} };
    for(const b of this.bonfires) test(b,'bonfire',44);
    for(const n of this.npcs) test(n,'npc',40);
    for(const d of this.drops) if(!d.taken) test(d,'item',30);
    for(const f of this.fogGates) test({x:f.x+f.w/2,y:f.y+f.h/2,n:'the fog gate',_fog:f},'fog',Math.max(f.w,f.h)*0.7);
    for(const l of this.links) test({x:l.x+l.w/2,y:l.y+l.h/2,n:l.n,_link:l,blocked:l.blocked,msg:l.msg,to:l.to,at:l.at},'link',Math.max(l.w,l.h)*0.8);
    if(this.bloodstain&&this.bloodstain.zone===World.zoneId) test(this.bloodstain,'blood',34);
    if(World.zoneId==='R04'&&Flags.vharosDead){
      const th={x:90*TS,y:-32*TS};
      if(Math.hypot(p.x-th.x,p.y-th.y)<70){ best={threshold:true,x:th.x,y:th.y}; kind='ending'; bd=0 }
    }
    return best?{o:best,kind,d:bd}:null;
  },
  interact(){
    const n=this.nearestInteract(); if(!n) return;
    const p=this.player;
    switch(n.kind){
      case 'bonfire': this.restAt(n.o); break;
      case 'npc': UI.npcMenu(n.o); this.talkNpcRef=n.o; n.o.talkIdx=0; break;
      case 'item': this.pickup(n.o); break;
      case 'fog': this.enterBossArena(n.o._fog||n.o); break;
      case 'blood': this.collectBloodstain(); break;
      case 'ending': this.showEndingChoice(); break;
      case 'link': { const l=n.o._link||n.o;
        if(l.blocked) this.toast(l.msg||'Sealed.',3.0); else this.enterZone(l.to,l.at); this.save(); break }
    }
  },
  pickup(d){
    const p=this.player; const g=d.give; d.taken=true;
    this.pickedItems[World.zoneId+'|'+(d.n||d.x)]=true;
    FX.soul(d.x,d.y,14); Audio_.soulPickup(12);
    let msg=d.n;
    if(g.souls){ p.souls+=g.souls; p.bank+=g.souls; msg=d.n+' (+'+fmt(g.souls)+')' }
    if(g.item){ p.inv.items[g.item]=(p.inv.items[g.item]||0)+(g.n||1);
      if(g.item==='Life Gem') p.gems=Math.min(GEM_CARRY,(p.inv.items['Life Gem']||0));
      if(g.item==='Estus Shard'){ p.shards++; p.recalc(); p.estusMax=clamp(5+p.shards,1,ESTUS_MAX); msg+=' — Estus pool +1' }
      if(g.item==='Bonfire Ascetic') msg+=' — burn it at a bonfire' }
    if(g.w && !p.inv.weapons.includes(g.w)){ p.inv.weapons.push(g.w); msg=d.n+' (weapon)' }
    if(g.a && !p.inv.armor.includes(g.a)){ p.inv.armor.push(g.a); msg=d.n+' (armour set)' }
    if(g.r && !p.inv.rings.includes(g.r)){ p.inv.rings.push(g.r); msg=d.n+' (ring)' }
    if(g.spell && !p.inv.spells.includes(g.spell)){ p.inv.spells.push(g.spell); msg=d.n+' — attune it' }
    if(g.ammo) this.ammo=true;
    this.toast(msg,2.6); this.drops=this.drops.filter(x=>x!==d); this.save();
  },
  restAt(bf){
    const p=this.player;
    this.lastBonfire=bf.id; p.lastBonfire=bf.id; this.litBonfires[bf.id]=true; bf.lit=true;
    UI.bonfireMenu(bf);
    Audio_.bonfire(); FX.bonfireRest(bf.x,bf.y);
  },
  kindle(){
    const p=this.player, bf=UI.bf; if(!bf) return;
    const cost=1000+(bf.kindled||0)*1500;
    if(p.souls<cost){ this.toast('Kindling costs '+fmt(cost)+' souls.'); return }
    p.souls-=cost; bf.kindled=(bf.kindled||0)+1; p.shards+=5; p.recalc();
    p.estusMax=clamp(p.allocation.estus+(p.d.estusBonus||0),1,ESTUS_MAX);
    Audio_.bonfire(); FX.bonfireRest(bf.x,bf.y);
    this.toast('KINDLED · Estus pool +5 ('+p.estusMax+' charges)',3.0); this.save(); UI.renderBonfire();
  },
  rest(){
    const p=this.player, bf=UI.bf;
    p.hp=p.maxHp; p.fp=p.maxFp; p.sta=p.maxSta;
    p.estus=p.estusMax; p.gems=Math.min(GEM_CARRY,p.inv.items['Life Gem']||0);
    Object.keys(p.status).forEach(k=>{ if(k!=='hollow') delete p.status[k] });
    p.gemT=0; p.gemUses=0; p.poiseDmg=0; p.posture=0;
    p.want=Math.max(0,p.want-2); p.checkResonance();
    // respawn the region (Vol 7 §7.1.1) — bosses stay dead
    const z=World.zone;
    this.enemies=this.enemies.filter(e=>e.bossAdd&&false);
    const asc=this.ascetic[z.id]||0,A=ASCETIC[asc];
    for(const e of (z.encounters||[])) this.spawnEnemy(e.t,e.x,e.y,{hpMult:A.hp,dmgMult:A.dmg,soulsMult:A.souls});
    this.tokens=[];
    this.drops=(z.items||[]).filter(it=>!this.pickedItems[z.id+'|'+(it.n||it.x)]).map(it=>new ItemDrop(it,z));
    FX.bonfireRest(p.x,p.y); Audio_.bonfire();
    this.toast('RESTED · '+z.n.toUpperCase()+' A'+asc,2.4);
    this.save(); this.closeMenu();
  },
  warp(bfId){
    const bf=this.allBonfires().find(b=>b.id===bfId); if(!bf) return;
    this.lastBonfire=bfId; this.player.lastBonfire=bfId; this.litBonfires[bfId]=true;
    this.enterZone(bf.zone.id,'default');
    const p=this.player; p.x=bf.x; p.y=bf.y+26; World.contain(p);
    this.closeMenu(); this.toast('WARPED · '+bf.n.toUpperCase(),2.2); this.save();
  },
  burnAscetic(bfId){
    const p=this.player;
    if((p.inv.items['Bonfire Ascetic']||0)<=0){ this.toast('Thou hast no Bonfire Ascetic.'); return }
    const z=World.zone, cur=this.ascetic[z.id]||0;
    if(cur>=4){ this.toast('This region is already at A4 — the maximum (Vol 7 §7.3.3).'); return }
    p.inv.items['Bonfire Ascetic']--;
    this.ascetic[z.id]=cur+1;
    if(cur+1>=4) this.asceticEcho[z.id]=(this.asceticEcho[z.id]||0)+1;
    Audio_.phaseShift(); Cam.kick(10,.8); FX.ember(p.x,p.y,50);
    this.toast('BONFIRE ASCETIC BURNED · '+z.n.toUpperCase()+' → A'+(cur+1),3.6);
    this.rest();
    const A=ASCETIC[cur+1];
    setTimeout(()=>this.toast(`HP ×${A.hp.toFixed(2)} · DAMAGE ×${A.dmg.toFixed(2)} · SOULS ×${A.souls.toFixed(2)}`,3.4),1200);
    if(cur+1>=4) setTimeout(()=>this.toast('A4 · a Kindled Echo now walks here (Vol 7 §7.3.4)',3.6),2600);
    this.save();
  },
  burnAsceticGlobal(){
    // from the ending screen: NG+ for the whole cycle (Vol 7 §7.3.5 — the ladder stops at NG+7)
    if(this.cycle>=NG_PLUS_MAX){ this.toast('NG+'+NG_PLUS_MAX+' is the end of the ladder. The fire will not take thee further.',3.6); return false }
    this.cycle++;
    for(const id of Object.keys(ZONES)) this.ascetic[id]=Math.min(4,(this.ascetic[id]||0)+1);
    this.player.dead=false; this.player.dying=0; this.player.hp=this.player.maxHp;
    this.state='play'; UI.show(null); $('#hud').classList.remove('hidden');
    this.enterZone('R01','pit');
    this.toast('A NEW CYCLE · NG+'+this.cycle+' · EVERY REGION RAISED',3.4);
    Audio_.startAmbient('R01'); this.save();
    return true;
  },

  /* ================= bosses ================= */
  enterBossArena(fog){
    const z=World.zone; if(!z.boss) return;
    if(Flags[z.boss.id+'Dead']){ this.toast('The arena is quiet. Nothing here wants thee now.'); fog.open=true; return }
    fog.open=true;
    const b=this.bosses.find(x=>x.id===z.boss.id);
    if(!b) return;
    this.bossFight=b; this.arenaLock=z.boss.arena;
    b.introduce();
    this.toast('§6 · '+b.def_.phases[0].n.toUpperCase(),3.0);
  },
  leaveBoss(){ this.bossFight=null; this.arenaLock=null; Audio_.startAmbient(World.zoneId); this.closeMenu() },

  /* ================= endings ================= */
  showEndingChoice(){
    const p=this.player;
    const ok=id=>this.endingUnlocked(id);
    this.menuOpen=true; UI.menuOpen=true;
    $('#menuTabs').innerHTML='<button data-tab="end" class="on">The Threshold</button>';
    $('#menuBody').innerHTML=`<h6 class="sec">Three endings are reachable — Vol 1 §1.7</h6>
      <div class="note">Thou standest at the wound in the nave. Vharos is dead and the Flame is unattended.
        Choose. Vol 1 §1.7 specifies six endings; three are in this slice, and the hidden one is tracked honestly below.</div>
      ${ENDINGS.map(e=>{
        const can=ok(e.id);
        const why=e.id==='relink'?`FTH ${p.stats.FTH}/30 · Warriors of Sunlight rank ${(p.covRank['Warriors of Sunlight']||0)}/2`
          :e.id==='throne'?`WANT ${p.want}/${WANT_MAX} (need ≥4)`
          :`sigils ${p.sigils}/5 · covenants at rank 2+ ${Object.values(p.covRank).filter(v=>v>=2).length}/2 · Kindled Echoes ${Object.keys(Flags).filter(k=>k.startsWith('echo_')).length}/14`;
        return `<div class="pick ${can?'on':''}" style="margin-bottom:9px">
          <h4 style="color:${e.col}">${e.n} ${can?'':'<span class="tag off">LOCKED</span>'}</h4>
          <p>${e.kick}</p><p style="color:#6b6154">${why}</p>
          ${can?`<div class="rw"><button data-pick="ending" data-v="${e.id}">Choose this ending</button></div>`:''}
        </div>`}).join('')}
      <h6 class="sec">Or walk away</h6>
      <div class="note"><button data-pick="closeTalk">Leave the Threshold unchosen — the world continues, the bonfires stay lit,
        and Vol 5 §5.5.13 (The Want Beneath) opens behind thee.</button></div>`;
    UI.show('#ovMenu');
  },
  /* The ending gate is authoritative here, not only in the menu markup: an ending whose
     requirement is not met cannot be taken even if something calls chooseEnding directly.
     Vol 1 §1.7 / Vol 8 §8.8. */
  endingUnlocked(id){
    const p=this.player; if(!p) return false;
    if(id==='relink')  return p.stats.FTH>=30 || (p.covenant==='Warriors of Sunlight'&&(p.covRank[p.covenant]||0)>=2);
    if(id==='throne')  return p.want>=4;
    if(id==='usurper') return p.sigils>=5
      && Object.values(p.covRank).filter(v=>v>=2).length>=2
      && Object.keys(Flags).filter(k=>k.startsWith('echo_')).length>=14;
    return false;
  },
  chooseEnding(id){
    if(!this.endingUnlocked(id)){
      const e=ENDINGS.find(x=>x.id===id);
      this.toast('The Threshold refuses thee. '+(e?e.req:''),3.4);
      return false;
    }
    this.closeMenu();
    this.state='ending'; Audio_.stopMusic();
    Audio_.tone(98,6,{type:'sine',gain:0.18}); Audio_.tone(147,6,{type:'triangle',gain:0.10});
    UI.endingScreen(id);
    this.ending=id;
    Save.wipe(); $('#btnContinue').disabled=true;
    return true;
  },

  /* ================= menu actions ================= */
  levelUp(attr){
    const p=this.player;
    if(p.souls<p.soulCost){ this.toast('Not enough souls.'); return }
    if(p.stats[attr]>=99){ this.toast(attr+' is at the hard cap.'); return }
    p.souls-=p.soulCost; p.stats[attr]++;
    const before=p.maxHp;
    p.recalc();
    if(p.maxHp>before) p.hp+=p.maxHp-before;
    Audio_.levelUp(); FX.levelUp(p.x,p.y); Cam.kick(4,.3);
    this.toast('LEVEL '+p.level_+' · '+attr+' '+p.stats[attr],2.0);
    this.save(); UI.renderTab();
  },
  allocate(v){
    const p=this.player; const pool=5+p.shards;
    const [k,s]=v.split('');
    if(k==='estus'){ const d=s==='+'?1:-1;
      const next=p.allocation.estus+d;
      if(next<0||next+p.allocation.ash*2>pool) { this.toast('The pool is '+pool+' points (1 per Estus, 2 per Ashen).'); return }
      p.allocation.estus=next }
    else { const d=s==='+'?1:-1; const next=p.allocation.ash+d;
      if(next<0||p.allocation.estus+next*2>pool){ this.toast('The pool is '+pool+' points.'); return }
      p.allocation.ash=next }
    p.estusMax=clamp(p.allocation.estus+(p.d.estusBonus||0),1,ESTUS_MAX);
    p.ashEstus=p.allocation.ash;
    p.estus=Math.min(p.estus,p.estusMax);
    this.save(); UI.renderBonfire();
  },
  cycleGear(slot){
    const p=this.player;
    let list;
    if(slot==='rh') list=p.inv.weapons.filter(w=>WEAPONS[w]&&!WEAPONS[w].cat);
    else if(slot==='lh') list=[null,...p.inv.weapons.filter(w=>WEAPONS[w]&&!WEAPONS[w].cat),...p.inv.shields.filter(s=>SHIELDS[s])];
    else if(slot==='arm') list=p.inv.armor.filter(a=>ARMOR[a]&&ARMOR[a].piece!=='legs');
    else if(slot==='legs') list=[null,...p.inv.armor.filter(a=>ARMOR[a]?.piece==='legs')];
    else if(slot==='cat') list=p.inv.weapons.filter(w=>WEAPONS[w]?.cat);
    if(!list||!list.length){ this.toast('Nothing to equip there yet.'); return }
    const cur=p.gear[slot==='cat'?'rh':slot];
    const i=list.indexOf(cur);
    const next=list[(i+1)%list.length];
    if(slot==='cat'){ p.gear.rh=next; if(next&&WEAPONS[next]?.cat) p.gear.lh=null }
    else p.gear[slot]=next;
    // equipping a catalyst in the right hand frees the left
    if(slot==='rh'&&WEAPONS[next]?.cat) p.gear.lh=null;
    p.recalc(); Audio_.ui(true); this.save(); UI.renderTab();
    this.toast(slot.toUpperCase()+': '+(next||'empty')+' — '+p.d.weight+'/'+p.d.cap+' = '+p.d.load+'% '+p.d.tier.n,2.4);
  },
  cycleRing(i){
    const p=this.player;
    const list=[null,...p.inv.rings.filter(r=>RINGS[r])];
    const cur=p.gear.rings[i];
    const next=list[(list.indexOf(cur)+1)%list.length];
    p.gear.rings[i]=next; p.gear.rings=p.gear.rings.filter((x,k)=>x||k<i||p.gear.rings.slice(k+1).some(Boolean));
    p.gear.rings.length=4;
    p.recalc(); Audio_.ui(true); this.save(); UI.renderTab();
    this.toast('Ring '+(i+1)+': '+(next||'empty'),1.8);
  },
  bindQuick(item){
    const p=this.player;
    const i=p.quickslot.indexOf(item);
    if(i>=0) p.quickslot[i]=null;
    else { const e=p.quickslot.indexOf(null); if(e>=0) p.quickslot[e]=item; else p.quickslot[p.qs]=item }
    this.save(); UI.renderTab();
  },
  useItem(item){
    const p=this.player, C=CONSUMABLES[item];
    if((p.inv.items[item]||0)<=0) return;
    if(!C||C.use==='none'){ this.toast('It cannot be used. Vhenn might want it.'); return }
    p.inv.items[item]--; if(!p.inv.items[item]) delete p.inv.items[item];
    switch(C.use){
      case 'ember': p.ember=true; this.toast('EMBERED — thou canst be invaded, and thou seest thy own light (Vol 8 §8.3)',3.0);
        FX.ember(p.x,p.y,40); Audio_.bonfire(); break;
      case 'gem': p.gems=Math.min(GEM_CARRY,(p.inv.items['Life Gem']||0)+1); p.inv.items['Life Gem']=(p.inv.items['Life Gem']||0)+1; p.startGem(); break;
      case 'resin': p.resin={t:C.t}; p.resinT=60; this.toast(C.n+' — +30% '+C.t+' for 60 s',2.4); FX.emit(p.x,p.y,20,{col:[RESIN_COL[C.t]],spd:60,life:1,r:2.4,glow:true}); break;
      case 'lure': this.enemies.forEach(e=>{ if(!e.dead&&dist(e,p)<600){ e.home={x:p.x+rnd(120,-120),y:p.y+rnd(120,-120)}; e.seenPlayer=false } });
        this.toast('Alluring Skull — attention drawn elsewhere',2.2); break;
      case 'throw': {
        const a=p.aimAngle();
        this.spawnProjectile(p.x,p.y,a,{spd:420,dmg:C.dmg,type:C.t,team:'player',src:p,pd:20,life:0.9,radius:60,col:'#ffb84a'});
        Audio_.swing(true); break }
      case 'shard': p.shards++; p.recalc(); this.toast('Estus Shard — pool +1 (now '+p.estusMax+' charges)',2.6); break;
      case 'ashard': p.ashShards++; this.toast('Ashen Estus Shard — pool +2',2.6); break;
      case 'ascetic': this.toast('Burn it at a bonfire (Rest → Ascetic).',2.6); p.inv.items[item]=(p.inv.items[item]||0)+1; break;
    }
    this.save(); if(UI.menuOpen) UI.renderTab();
  },
  consumeSoul(item){
    const p=this.player;
    const v={'Soul of a Lost Undead':400,'Soul of a Nameless Soldier':900,'Soul of a Forge-Warden':1600,
      'Soul of a Drowned Deacon':2400,'Sovereign Soul':6000,'Karrag Soul':19000,'Vharos Soul':24000}[item]||500;
    if((p.inv.items[item]||0)<=0) return;
    p.inv.items[item]--; if(!p.inv.items[item]) delete p.inv.items[item];
    p.souls+=v; p.bank+=v; Audio_.soulPickup(20); FX.soul(p.x,p.y,20);
    this.toast('+'+fmt(v)+' souls',2.0); this.save(); UI.renderTab();
  },
  attune(spell){
    const p=this.player;
    if(!p.inv.spells.includes(spell)) return;
    const S=SPELLS[spell];
    for(const [k,v] of Object.entries(S.req)) if(p.stats[k]<v){ this.toast(spell+' needs '+k+' '+v+'.'); return }
    const list=p.attuned.filter(Boolean);
    if(list.includes(spell)) { p.attuned[list.indexOf(spell)]=null; this.save(); UI.renderTab(); return }
    if(list.length>=p.slots){ this.toast('Only '+p.slots+' slots at ATT '+p.stats.ATT+'.'); return }
    const i=p.attuned.indexOf(null);
    if(i>=0) p.attuned[i]=spell; else p.attuned.push(spell);
    Audio_.ui(true); this.save(); UI.renderTab();
  },
  upgradeWeapon(w){
    const p=this.player, up=p.upgrades[w]||0;
    if(up>=10) return;
    const need=up<6?'Titanite Shard':up<9?'Titanite Chunk':'Titanite Slab';
    if((p.inv.items[need]||0)<1){ this.toast(need+' required.'); return }
    const cost=UPG_COST(up);
    if(p.souls<cost){ this.toast('Not enough souls.'); return }
    p.souls-=cost; p.inv.items[need]--; if(!p.inv.items[need]) delete p.inv.items[need];
    p.upgrades[w]=up+1;
    Audio_.anvil(); Audio_.ui(true); Cam.kick(3,.2); FX.ember(p.x,p.y,14);
    this.toast(w+' → +'+(up+1)+' · '+weaponDamage(w,p.stats,up+1,p.infusion[w]).total+' damage',2.6);
    this.save(); UI.renderTab();
  },
  infuse(w,inf){
    const p=this.player;
    p.infusion[w]= p.infusion[w]===inf? null : inf;
    Audio_.ui(true); this.save(); UI.renderTab();
    const I=INFUSIONS.find(i=>i.id===inf);
    this.toast(w+' → '+(p.infusion[w]?I.n:'no infusion')+' · '+weaponDamage(w,p.stats,p.upgrades[w]||0,p.infusion[w]).total+' damage',2.4);
  },
  swear(cov){
    const p=this.player;
    if(cov!=='None'){
      const c=COVENANTS[cov];
      // requirements (Vol 8 §8.4)
      let ok=false,why='';
      if(cov==='Warriors of Sunlight') ok=p.stats.FTH>=25||p.bossesKilled.length>0, why='FTH 25, or a boss slain as a phantom';
      if(cov==='Darkwraith') ok=(p.inv.items['Cracked Red Eye Orb']||0)>0||p.want>=3, why='a Cracked Red Eye Orb, or WANT ≥ 3';
      if(cov==='Blue Sentinels') ok=true, why='';
      if(cov==='Dragon Remnants') ok=(p.inv.items['Dragon Head']||0)>0||p.stats.STR>=16, why='the Dragon Head, or STR 16';
      if(cov==='Forest Guardians') ok=true, why='';
      if(!ok){ this.toast(cov+' refuses thee: '+why); return }
      if(p.covenant!=='None'&&p.covenant!==cov){ p.sin=(p.sin||0)+1; this.toast('Betrayal. Sin +1 (Vol 8 §8.6)',2.6) }
    }
    p.covenant=cov; p.covRank[cov]=p.covRank[cov]||0;
    p.recalc(); Audio_.bonfire(); FX.ember(p.x,p.y,30);
    this.toast('OATH: '+cov.toUpperCase()+' — '+COVENANTS[cov].perk,4.0);
    this.save(); UI.renderTab();
  },
  transpose(item){
    const p=this.player;
    const out={"Herald's Tail":{w:"Herald's Ash Pike"},"Ember-Forged Crown":{w:"Artificer's Hammer"},
      "Lurker's Barb":{w:"Uchigatana"},"Soul of Vharos":{souls:24000},"Soul of Karrag":{souls:19000},
      "Soul of the Hollow Sovereign":{souls:6000}}[item];
    if(!out) return;
    if(p.inv.items[item]) { p.inv.items[item]--; if(!p.inv.items[item]) delete p.inv.items[item] }
    p.severed=p.severed.filter(s=>s!==item);
    if(out.w&&!p.inv.weapons.includes(out.w)) p.inv.weapons.push(out.w);
    if(out.souls){ p.souls+=out.souls; p.bank+=out.souls }
    Audio_.sever(); this.toast('TRANSPOSED · '+item+' → '+(out.w||fmt(out.souls)+' souls'),3.4);
    this.save(); UI.renderBonfire();
  },
  takeGift(npcId){
    const npc=this.npcs.find(n=>n.id===npcId); if(!npc||!npc.gift) return;
    if(Flags[npc.gift.once]){ this.toast('The child has nothing else.'); return }
    Flags[npc.gift.once]=true; Flags.childMet=true;
    this.player.inv.items[npc.gift.item]=(this.player.inv.items[npc.gift.item]||0)+npc.gift.n;
    this.toast('Received: '+npc.gift.item+' — it does nothing, and that is the point',3.4);
    Audio_.ui(true); this.save(); UI.closeMenu();
  },
  talkNpc(id){
    const npc=this.talkNpcRef||this.npcs.find(n=>n.id===id); if(!npc) return;
    npc.talkIdx=((npc.talkIdx||0)+1)%npc.talk.length;
    Audio_.ui(); UI.renderTalk(npc);
    if(id==='child'&&npc.talkIdx===0){ /* fourth meeting lights a bonfire — Vol 5 §5.5.5 */ }
  },
  closeTalk(){ UI.talkNpcRef=null; this.talkNpcRef=null; this.closeMenu() },
  gesture(){
    const p=this.player;
    const g=['Point Forward','Praise the Sun','Proper Bow','Well, what is it!','Toast','Dignified Bow','Curl Up','Stretch Out'];
    const name=g[Math.floor(Math.random()*g.length)];
    this.toast('Gesture · '+name+' (34 exist — Vol 8 §8.7)',2.0);
    FX.ember(p.x,p.y,10); Audio_.ui(true);
  },
  cycleLock(){
    const p=this.player;
    const cands=[...this.enemies,...this.bosses].filter(e=>!e.dead&&dist(p,e)<460);
    if(!cands.length){ p.lockTarget=null; Audio_.ui(false); return }
    cands.sort((a,b)=>{
      const aa=Math.abs(angDiff(p.facing,Math.atan2(a.y-p.y,a.x-p.x)))+dist(p,a)/900;
      const bb=Math.abs(angDiff(p.facing,Math.atan2(b.y-p.y,b.x-p.x)))+dist(p,b)/900;
      return aa-bb });
    const i=cands.indexOf(p.lockTarget);
    p.lockTarget=cands[(i+1)%cands.length];
    Audio_.ui(true);
  },
  addSigil(){
    const p=this.player;
    p.hollowing++;
    if(p.hollowing>=8){ p.hollowing=0; p.sigils=Math.min(8,p.sigils+1);
      this.toast('A DARK SIGIL APPEARS ('+p.sigils+'/8) — hollowing advances (Vol 1 §1.4)',3.4);
      Audio_.dark(); FX.dark(p.x,p.y,30); this.save() }
  },
  toast(m,d=2.4){ UI.toast(m,d) },
  hurtFlash(a){ UI.hurtFlash(a) },
  playTimeStr(){ const s=Math.floor(this.playTime);
    return String(Math.floor(s/3600)).padStart(2,'0')+':'+String(Math.floor(s/60)%60).padStart(2,'0')+':'+String(s%60).padStart(2,'0') },

  /* ================= save ================= */
  save(){
    const p=this.player; if(!p||this.state==='title') return;
    const d={v:1, zone:World.zoneId, px:p.x, py:p.y, t:this.playTime, estusUpg:this.estusUpg, cycle:this.cycle,
      ascetic:this.ascetic, echo:this.asceticEcho, lit:this.litBonfires, picked:this.pickedItems,
      flags:Flags, blood:this.bloodstain, ammo:this.ammo, lastBonfire:this.lastBonfire,
      p:{stats:p.stats,gear:p.gear,inv:p.inv,upgrades:p.upgrades,infusion:p.infusion,attuned:p.attuned,
         quickslot:p.quickslot,qs:p.qs,souls:p.souls,bank:p.bank,estus:p.estus,gems:p.gems,shards:p.shards,
         ashShards:p.ashShards,allocation:p.allocation,sigils:p.sigils,hollowing:p.hollowing,want:p.want,
         resonance:p.resonance,covenant:p.covenant,covRank:p.covRank,sin:p.sin,indict:p.indict,
         deaths:p.deaths,kills:p.kills,bossesKilled:p.bossesKilled,severed:p.severed,classId:p.classId,
         hp:p.hp,fp:p.fp,sta:p.sta}};
    Save.write(d); this.lastSave=this.t;
  },
  loadGame(){
    const d=Save.read(); if(!d){ this.toast('No save.'); return }
    Audio_.resume();
    const p=new Player();
    Object.assign(p,d.p);
    p.stats=Object.assign({},d.p.stats); p.gear=Object.assign({},d.p.gear);
    p.inv=JSON.parse(JSON.stringify(d.p.inv));
    this.player=p;
    Object.assign(Flags,d.flags||{});
    this.ascetic=d.ascetic||{}; this.asceticEcho=d.echo||{}; this.litBonfires=d.lit||{};
    this.pickedItems=d.picked||{}; this.bloodstain=d.blood||null; this.ammo=d.ammo;
    this.estusUpg=d.estusUpg||0; this.playTime=d.t||0; this.cycle=d.cycle||0; this.lastBonfire=d.lastBonfire||'bf_waking';
    p.recalc(); p.hp=clamp(d.p.hp||p.maxHp,1,p.maxHp); p.fp=d.p.fp??p.maxFp; p.sta=d.p.sta??p.maxSta;
    p.dead=false; p.dying=0; this._deathToken=null;      // never inherit a pending death screen
    this.enterZone(d.zone||'R01','default',true);
    p.x=d.px||p.x; p.y=d.py||p.y; World.contain(p);
    this.state='play'; UI.show(null); $('#hud').classList.remove('hidden');
    Audio_.startAmbient(World.zoneId);
    this.toast('JOURNEY RESUMED · '+World.zone.n.toUpperCase(),2.6);
  },

  /* ================= the loop ================= */
  loop(now){
    requestAnimationFrame(t=>this.loop(t));
    let dt=(now-this.last)/1000; this.last=now;
    const fms=performance.now();
    dt=Math.min(dt,0.1);
    this.frameMs=this.frameMs*0.9+(performance.now()-now)*0.1;
    if(this.state==='play'&&!UI.menuOpen&&!UI.codexOpen&&!UI.setOpen){
      this.playTime+=dt;
      // fixed-step simulation
      let sim=Math.min(dt,this.slowmo>0? dt*0.42 : dt);
      if(this.slowmo>0) this.slowmo-=dt;
      if(HitStop.tick(sim)) sim=0;
      this.acc+=sim;
      let steps=0;
      while(this.acc>=1/FPS && steps<4){ this.update(1/FPS); this.acc-=1/FPS; steps++ }
      if(steps===0&&sim>0) { /* render-only frame */ }
    } else if(this.state==='play'){ this.acc=0 }
    this.render(dt);
    Input.pollPad(); Input.endFrame();
    if(this.t-this.lastSave>25&&this.state==='play'){ this.save() }
  },

  update(dt){
    this.t+=dt;
    const p=this.player; if(!p) return;
    const sc=this.scale||1;
    Input.aimWorld={x:Input.mx*sc+Cam.x, y:Input.my*sc+Cam.y};

    /* ---------- interaction prompt & riposte, both on F (Vol 3 §3.5.5) ---------- */
    const n=this.nearestInteract();
    if(n){
      const o=n.o;
      const label = n.kind==='bonfire' ? 'Rest at '+(o.n||'the bonfire')
        : n.kind==='npc'    ? 'Speak with '+(o.n||'them')
        : n.kind==='item'   ? 'Take '+(o.n||'it')
        : n.kind==='fog'    ? 'Enter the fog gate'
        : n.kind==='blood'  ? 'Recover thy souls ('+fmt(o.souls||0)+')'
        : n.kind==='ending' ? 'The Threshold — choose an ending'
        : n.kind==='link'   ? (o.blocked?'✕ ':'→ ')+(o.n||'travel')
        : 'Interact';
      UI.prompt(true,n.kind==='item'?'·':'F',label);
      if(n.kind==='item'){ if(Math.hypot(p.x-o.x,p.y-o.y)<22) this.pickup(o) }
      else if(Input.hit('interact')) this.interact();
    } else {
      UI.prompt(false);
      if(Input.hit('interact')) this.tryRiposte();
    }

    /* ---------- Power Stance combo (Vol 3 §3.6.3): heavy opens it, light or heavy finishes ---------- */
    if(p.stanceActive && !p.atk && (Input.hit('light')||Input.hit('heavy'))) p.stanceFinisher();

    /* ---------- player ---------- */
    const wasDead=p.dead;
    p.update(dt,this.t);
    if(p.dead&&!wasDead) return;

    /* ---------- hazards ---------- */
    const hz=World.hazardAt(p.x,p.y);
    if(hz&&hz.dmg){
      p.hp-=hz.dmg*dt*(1-p.d.mitigation);
      p.hitFlash=Math.max(p.hitFlash,0.05);
      if(hz.t==='want'){ p.want=Math.min(WANT_MAX,p.want+dt*0.35); p.checkResonance() }
      if(Math.random()<dt*8) FX.fire(p.x,p.y,1);
      if(p.hp<=0&&!p.dead) p.beginDeath();
    }

    /* ---------- WANT regen (Vol 4 §4.5) ---------- */
    const inCombat = !!this.bossFight || this.enemies.some(e=>!e.dead&&e.seenPlayer);
    if(p.want<WANT_MAX){
      const rate = inCombat? WANT_REGEN_IN : WANT_REGEN_OUT;
      const mult = COVENANTS[p.covenant]?.bonus?.wantRegen||1;
      p.wantT=(p.wantT||0)+dt*mult;
      if(p.wantT>=rate){ p.wantT=0; p.want=Math.min(WANT_MAX,p.want+1); p.checkResonance() }
    }

    /* ---------- entities ---------- */
    for(const e of this.enemies){ e.update(dt,this.t,p); e.observe(p,dt) }
    for(const b of this.bosses){
      if(!b.introduced && dist(b,p)<b.r+180) b.introduce();
      b.update(dt,this.t,p);
    }
    for(const b of this.bonfires) b.update(dt);
    for(const d of this.drops) d.update(dt);
    for(const nn of this.npcs) nn.update(dt);
    for(const f of this.fogGates) f.update(dt);
    this.updateProjectiles(dt);

    /* ---------- boss fog gate trigger by walking ---------- */
    for(const f of this.fogGates){
      if(!f.open && p.x>f.x&&p.x<f.x+f.w&&p.y>f.y&&p.y<f.y+f.h) this.enterBossArena(f);
    }

    /* ---------- arena lock ---------- */
    if(this.arenaLock&&this.bossFight&&!this.bossFight.dead){
      const a=this.arenaLock;
      const inside=p.x>a.x-8&&p.x<a.x+a.w+8&&p.y>a.y-8&&p.y<a.y+a.h+8;
      if(!inside){
        p.x=clamp(p.x,a.x+p.r,a.x+a.w-p.r); p.y=clamp(p.y,a.y+p.r,a.y+a.h-p.r);
        if(!this._lockMsg||this.t-this._lockMsg>3){ this._lockMsg=this.t; this.toast('The arena will not let thee leave.',2.6) }
      }
    } else if(this.arenaLock&&(!this.bossFight||this.bossFight.dead)) this.arenaLock=null;

    /* ---------- cleanup ---------- */
    this.enemies=this.enemies.filter(e=>!(e.dead&&e.dying>1.4));
    this.bosses=this.bosses.filter(b=>!(b.dead&&b.dying>7));
    if(this.bloodstain&&this.bloodstain.zone===World.zoneId) this.collectBloodstain();
    this.checkLinks();

    /* ---------- aggression (Vol 7 §7.3) ---------- */
    this.aggression=(this.ascetic[World.zoneId]||0)*0.12;

    /* ---------- camera ---------- */
    Cam.follow(p,dt,p.lockTarget||Input.aimWorld);
    FX.update(dt);
    p.hpGhost = p.hpGhost===undefined? p.hp : lerp(p.hpGhost,p.hp,1-Math.pow(0.02,dt));
  },

  /* ================= render ================= */
  render(dt){
    const g=this.ctx, p=this.player;
    if(this.state==='title'||!p){
      g.fillStyle='#070504'; g.fillRect(0,0,960,540);
      // title embers
      for(let i=0;i<80;i++){
        const x=(hash2(i,3,11)*960+this.t*7)%960;
        const y=540-((this.t*(10+i%9*4)+hash2(i,7,13)*540)%600);
        g.globalAlpha=0.10+0.30*hash2(i,9,17)*(y>0?1:0);
        g.fillStyle=i%4?'#e2703a':'#c8a35a'; g.fillRect(x,y,1.8,1.8);
      }
      g.globalAlpha=1;
      this.t+=dt;
      UI.hud&&$('#hud').classList.add('hidden');
      return;
    }
    this.t+= (UI.menuOpen?dt*0.25:0);
    World.draw(g,Cam,this.t);
    // bloodstain
    if(this.bloodstain&&this.bloodstain.zone===World.zoneId){
      const sx=this.bloodstain.x-Cam.x, sy=this.bloodstain.y-Cam.y;
      g.save(); g.translate(sx,sy);
      g.globalAlpha=0.5+0.3*Math.sin(this.t*3);
      const gr=g.createRadialGradient(0,0,2,0,0,26);
      gr.addColorStop(0,'rgba(207,232,216,.75)'); gr.addColorStop(1,'rgba(207,232,216,0)');
      g.fillStyle=gr; g.beginPath(); g.arc(0,0,26,0,TAU); g.fill();
      g.fillStyle='#cfe8d8'; g.beginPath(); g.arc(0,0,4,0,TAU); g.fill();
      g.restore(); g.globalAlpha=1;
    }
    // ending threshold marker
    if(World.zoneId==='R04'&&Flags.vharosDead){
      const sx=90*TS-Cam.x, sy=-32*TS-Cam.y;
      g.save(); g.translate(sx,sy);
      g.globalAlpha=0.35+0.25*Math.sin(this.t*1.6);
      const gr=g.createRadialGradient(0,0,4,0,0,60);
      gr.addColorStop(0,'rgba(232,207,148,.6)'); gr.addColorStop(1,'rgba(232,207,148,0)');
      g.fillStyle=gr; g.beginPath(); g.arc(0,0,60,0,TAU); g.fill();
      g.globalAlpha=1; g.fillStyle='#e8cf94'; g.font='9px "SFMono-Regular",Menlo,monospace'; g.textAlign='center';
      g.fillText('THE THRESHOLD',0,-64); g.textAlign='left'; g.restore();
    }
    // depth-sorted entities
    const list=[];
    for(const d of this.drops) if(!d.taken) list.push(d);
    for(const b of this.bonfires) list.push(b);
    for(const nn of this.npcs) list.push(nn);
    for(const l of this.links) list.push(l);
    for(const f of this.fogGates) list.push(f);
    for(const e of this.enemies) list.push(e);
    for(const b of this.bosses) list.push(b);
    list.push(p);
    list.sort((a,b)=>a.y-b.y);
    for(const o of list) o.draw(g,Cam,this.t);
    // solids drawn above the floor but below entities' heads
    for(const s of World.solids){
      const sx=s.x-Cam.x, sy=s.y-Cam.y;
      if(sx<-80||sy<-80||sx>960+80||sy>540+80) continue;
      g.fillStyle=s.pillar?'#4a4238':'#3a3228';
      g.fillRect(sx,sy-s.h*0.6,s.w,s.h*1.6);
      g.fillStyle=s.pillar?'#5c5347':'#4a4238';
      g.fillRect(sx,sy-s.h*0.6,s.w,5);
    }
    this.drawProjectiles(g,Cam);
    FX.draw(g,Cam);
    // arena tint from the transformation
    if(this.arenaTint){ g.fillStyle=this.arenaTint.col; g.fillRect(0,0,960,540) }
    // boss arena boundary
    if(this.arenaLock){
      const a=this.arenaLock;
      g.strokeStyle='rgba(226,112,58,.20)'; g.lineWidth=2; g.setLineDash([10,8]); g.lineDashOffset=-this.t*20;
      g.strokeRect(a.x-Cam.x,a.y-Cam.y,a.w,a.h); g.setLineDash([]);
    }
    // zone intro card
    if(this.introT>0){
      this.introT-=dt;
      const k=clamp(this.introT/3.6,0,1);
      g.globalAlpha=Math.min(1,k*3)*(1-Math.pow(1-k,3))*0.9;
      g.fillStyle='rgba(6,5,4,.72)'; g.fillRect(0,196,960,84);
      g.fillStyle='#e8cf94'; g.font='400 26px "Iowan Old Style",Georgia,serif'; g.textAlign='center';
      g.letterSpacing='6px';
      g.fillText(World.zone.n.toUpperCase(),480,236);
      g.letterSpacing='2px';
      g.fillStyle='#8d8271'; g.font='10px "SFMono-Regular",Menlo,monospace';
      g.fillText(World.zone.id+' · SL '+World.zone.sl+' · '+World.zone.age+' · '+(World.zone.bonfires?.length||0)+' bonfires',480,258);
      g.letterSpacing='0px'; g.textAlign='left'; g.globalAlpha=1;
    }
    if(SETTINGS.crt){
      g.globalAlpha=0.05; g.fillStyle='#000';
      for(let y=0;y<540;y+=3) g.fillRect(0,y,960,1);
      g.globalAlpha=1;
    }
    if(SETTINGS.showFps){
      g.fillStyle='#6b6154'; g.font='9px "SFMono-Regular",Menlo,monospace';
      g.fillText('entities '+(this.enemies.length+this.bosses.length+this.projectiles.length)+' · fx '+FX.parts.length+
        ' · frame '+this.frameMs.toFixed(2)+'ms · '+(1/Math.max(0.001,dt)).toFixed(0)+'fps',8,532);
    }
    UI.hud();
  },
};


/* ================= go ================= */
addEventListener('DOMContentLoaded',()=>{ Game.boot() });
if(document.readyState!=='loading') Game.boot();

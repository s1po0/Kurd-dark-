/* =====================================================================
   enemies.js — the seven enemy archetypes (Vol 3 §3.10) with the boss
   grammar applied to trash: telegraph → commit → recover, input reading,
   attack tokens, posture, and severance.
   ===================================================================== */
'use strict';
const ATTACK_TOKENS = 2;      // Vol 3 §3.10.7 — how many enemies may commit at once

class Enemy extends Actor {
  constructor(type,x,y,opt={}){
    const isElite = typeof type==='string' && type.startsWith('elite_');
    const E = isElite ? ELITES[type.slice(6)] : null;
    const T = ENEMY_TYPES[E ? E.base : type];
    if(!T) throw new Error('unknown enemy type: '+type);
    super(x,y,(E? T.r*E.r : T.r));
    this.type=type; this.T=T; this.elite=E||null;
    this.name = E? E.n : T.n;
    this.maxHp = Math.round(T.hp * (E?E.hp:1) * (opt.hpMult||1));
    this.hp=this.maxHp;
    this.dmgMul = (E?E.dmg:1) * (opt.dmgMult||1);
    this.soulValue = Math.round(T.souls * (E?E.souls:1) * (opt.soulsMult||1));
    this.spd = T.spd * (E?E.spd:1);
    this.poise = T.poise; this.threshold=poiseThreshold(this.poise);
    this.grade=T.grade; this.mitigation=poiseMitigation(this.poise);
    this.def = 12 + T.poise*1.4; this.res={};
    this.aggro = T.aggro;
    this.col = E? '#8a6a4a' : T.col;
    this.state='idle'; this.home={x,y};
    this.target=null; this.moveT=0; this.wanderA=rnd(TAU); this.wanderT=rnd(3);
    this.moves=T.moves.map(m=>Object.assign({},m));
    this.atk=null; this.atkCd=rnd(1.2); this.token=null;
    this.readT=0; this.readKind=null; this.punish=false;
    this.postureBroken=false; this.riposteable=false;
    this.seenPlayer=false; this.alertT=0;
    this.part = E? {n:E.partName, hp:E.partHpMax||Math.round(this.maxHp*0.14), max:E.partHpMax||Math.round(this.maxHp*0.14), sev:false, reward:E.partReward} : null;
    this.hitT=0; this.spawnT=opt.spawn?0.6:0;
    this.guarding=false; this.parryT=0; this.guardStab=100; this.shield=null; this.parryable=false;
    this.patrol = opt.patrol||null;
    this.facing=rnd(TAU);
    this.ranged = this.moves.some(m=>m.proj);
    this.dropItems = opt.drops||null;
  }
  get isRiposteable(){ return this.postureBroken || this.riposteable }

  update(dt,t,player){
    if(this.spawnT>0){ this.spawnT-=dt; return }
    if(this.dead){ this.dying+=dt; return }
    this.tickStatus(dt);
    this.hitT=Math.max(0,this.hitT-dt);
    if(this.stagger>0){ this.state='stagger'; return }
    if(this.atkCd>0) this.atkCd-=dt;
    if(this.readT>0) this.readT-=dt;

    const d=dist(this,player);
    /* ---------- perception ---------- */
    if(!player.dead){
      const stealth = player.status.hidden? 0.35 : 1;
      if(!this.seenPlayer && d<this.aggro*stealth){ this.seenPlayer=true; this.alertT=0.55; Audio_.tone?.(220,.12,{gain:.03}) }
      if(this.seenPlayer && d>this.aggro*2.6) { this.seenPlayer=false; this.target=null }
    } else this.seenPlayer=false;
    this.target = this.seenPlayer? player : null;

    if(!this.target){
      /* idle / patrol — Vol 3 §3.10.2: enemies own their space */
      this.wanderT-=dt;
      if(this.wanderT<=0){ this.wanderT=rnd(3.4,1.4); this.wanderA=rnd(TAU) }
      const hx=this.patrol? this.home.x+Math.cos(this.wanderA)*this.patrol : this.home.x;
      const hy=this.patrol? this.home.y+Math.sin(this.wanderA)*this.patrol : this.home.y;
      const hd=Math.hypot(hx-this.x,hy-this.y);
      if(hd>6){
        const s=this.spd*0.32*dt;
        this.x+=(hx-this.x)/hd*s; this.y+=(hy-this.y)/hd*s;
        this.facing=Math.atan2(hy-this.y,hx-this.x); this.state='walk';
        this.bob+=dt*3;
      } else this.state='idle';
      World.contain(this);
      return;
    }

    /* ---------- combat ---------- */
    this.state='chase';
    const ang=Math.atan2(player.y-this.y,player.x-this.x);
    this.facing = this.atk? this.facing : ang;

    // attack token arbitration (Vol 3 §3.10.7)
    if(this.token==='attack'){}
    else if(Game.tokenCount()<ATTACK_TOKENS && d< (this.ranged?340:80)) { this.token=Game.takeToken(this) }
    if(d>420 && this.token){ Game.releaseToken(this); this.token=null }

    const m=this.pickMove(d,player);
    if(this.atk){ this.tickAttack(dt,player); return }

    if(m && this.token==='attack' && this.atkCd<=0){
      this.startMove(m,player); return;
    }
    /* movement: approach, keep range for casters, strafe for knights */
    let desired = this.ranged? 260 : (this.T.grade>=2? 40 : 26);
    let spd=this.spd;
    if(player.status.hidden) spd*=0.7;
    if(d>desired+8){
      this.x+=Math.cos(ang)*spd*dt; this.y+=Math.sin(ang)*spd*dt; this.state='run'; this.bob+=dt*7;
    } else if(d<desired-24 && !this.ranged){
      this.x-=Math.cos(ang)*spd*0.6*dt; this.y-=Math.sin(ang)*spd*0.6*dt; this.state='walk';
    } else {
      // strafe — the archetype that makes you move, not mash
      const sa=ang+Math.PI/2*(this.strafeDir||1);
      this.x+=Math.cos(sa)*spd*0.55*dt; this.y+=Math.sin(sa)*spd*0.55*dt; this.state='walk'; this.bob+=dt*4;
      this.strafeT=(this.strafeT||0)-dt;
      if(this.strafeT<=0){ this.strafeT=rnd(2.2,0.8); this.strafeDir=-this.strafeDir||1 }
    }
    World.contain(this);
    // separation from other enemies so they never stack into one hitbox
    for(const o of Game.enemies){
      if(o===this||o.dead) continue;
      const dd=dist(this,o), min=this.r+o.r;
      if(dd<min&&dd>0.01){ const p=(min-dd)/dd*0.5;
        this.x+=(this.x-o.x)*p; this.y+=(this.y-o.y)*p }
    }
  }

  /* ---------- Vol 3 §3.10.6 · input reading ----------
     Reads never fire a guaranteed punish. They fire a DELAYED response,
     so the player is punished for the recovery, not for the input. */
  observe(player,dt){
    if(!this.target) { this.readKind=null; return }
    // heal read
    if((player.drink||player.gemT>0||player.cast) && this.readT<=0 && Math.random()<dt*2.6){
      this.readKind='heal'; this.readT=1.0; this.punish=true;
      const m=this.moves.find(m=>!m.proj&&m.rng>34)||this.moves[0];
      if(m && dist(this,player)<m.rng+70){ this.atkCd=Math.min(this.atkCd,0.28) }
    }
    // roll-into read: delay the swing so it lands on roll recovery
    if((player.state==='roll') && this.atk && this.atk.t<this.atk.m.fr[0]/FPS && Math.random()<dt*3.4){
      this.atk.delay=(this.atk.delay||0)+7/FPS; this.readKind='roll';
    }
    // estus-at-range read for casters
    if(this.ranged && player.drink && this.readT<=0 && Math.random()<dt*2.0){
      this.readKind='rangedHeal'; this.readT=1.1; this.atkCd=Math.min(this.atkCd,0.16);
    }
  }
  pickMove(d,player){
    const avail=this.moves.filter(m=>{
      if(m.rng===0) return false;
      if(m.proj) return d<m.rng && d>90;
      return d<m.rng+this.r+player.r+6;
    });
    if(!avail.length) return null;
    // weighted pick, biased toward the read response
    if(this.punish){
      const p=avail.find(m=>m.rng>d)||avail[0];
      this.punish=false; return p;
    }
    let tot=avail.reduce((a,m)=>a+m.w,0), r=Math.random()*tot;
    for(const m of avail){ r-=m.w; if(r<=0) return m }
    return avail[0];
  }
  startMove(m,player){
    const fr=m.fr.map(f=>f/FPS);
    this.atk={m,t:0,fr,delay:0,hits:0,hitSet:new Set()};
    this.state='attack'; this.atkCd=rnd(1.5,0.7)/(1+Game.aggression*0.4);
    this.facing=Math.atan2(player.y-this.y,player.x-this.x);
    if(m.dash){ this.dashV={x:Math.cos(this.facing),y:Math.sin(this.facing)} }
    Audio_.swing(m.pd>40);
    if(m.guard){ Audio_.guard() }
  }
  tickAttack(dt,player){
    const a=this.atk; a.t+=dt;
    const [s,ac,r]=a.fr;
    const t0=a.t-(a.delay||0);
    if(a.m.dash && t0>s && t0<s+ac){
      const sp=(a.m.rng*2.4)*dt;
      this.x+=this.dashV.x*sp; this.y+=this.dashV.y*sp; World.contain(this);
    }
    if(t0>=s && t0<s+ac){
      // resolve every frame of the active window, once per target per hit
      for(let h=a.hits; h<(a.m.hits||1); h++){
        if(a.hitSet.has(h)) continue;
        if(t0 < s + (ac*(h+1)/(a.m.hits||1)) - ac/(a.m.hits||1)*0.5) continue;
        a.hitSet.add(h);
        const dmg=(this.T.dmg[0]+Math.random()*(this.T.dmg[1]-this.T.dmg[0]))*a.m.dmg*this.dmgMul;
        if(a.m.proj){
          Game.spawnProjectile(this.x+Math.cos(this.facing)*this.r,this.y+Math.sin(this.facing)*this.r,this.facing,{
            spd:a.m.proj.spd,dmg,type:a.m.proj.t,team:'enemy',src:this,
            pd:a.m.pd,life:a.m.rng/a.m.proj.spd,burn:a.m.proj.burn||0,arrow:true});
          Audio_.bow();
        } else if(a.m.aoe){
          if(dist(this,player)<a.m.rng){
            Game.applyHit(player,this,{dmg,poiseDmg:a.m.pd,type:'phys',knock:6,poison:a.m.poison?34:0});
          }
          FX.poison(this.x,this.y,18); Audio_.spell(false);
        } else {
          if(arcHits(this.x,this.y,this.facing,a.m.rng>60?1.2:1.9,a.m.rng+this.r,player.x,player.y,player.r))
            Game.applyHit(player,this,{dmg,poiseDmg:a.m.pd,type:'phys',knock:a.m.pd>40?14:7,
              poison:a.m.poison?34:0, bleed:0});
        }
      }
    }
    if(t0>=s+ac+r){
      this.atk=null; this.state='idle';
      if(this.token){ Game.releaseToken(this); this.token=null }
      if(a.m.flee){ const ang=Math.atan2(this.y-player.y,this.x-player.x);
        this.x+=Math.cos(ang)*40; this.y+=Math.sin(ang)*40; World.contain(this) }
    }
  }
  onParried(){ this.riposteable=true; this.postureBroken=true; this.stagger=Math.max(this.stagger,1.4) }

  beginDeath(){
    if(this.dead) return;
    this.dead=true; this.dying=0.0001; this.state='dying';
    if(this.token) Game.releaseToken(this);
    Game.onEnemyDeath(this);
  }

  /* ---------- rendering ---------- */
  draw(g,cam,t){
    const sx=this.x-cam.x, sy=this.y-cam.y;
    if(sx<-70||sy<-70||sx>cam.w+70||sy>cam.h+70) return;
    const dying=this.dead?Math.min(1,this.dying/1.1):0;
    g.save(); g.translate(sx,sy);
    if(this.spawnT>0){ g.globalAlpha=1-this.spawnT/0.6 }
    // shadow
    g.globalAlpha*=0.45; g.fillStyle='#000';
    g.beginPath(); g.ellipse(0,this.r*0.75,this.r*(1-dying*0.2),this.r*0.42,0,0,TAU); g.fill();
    g.globalAlpha=this.spawnT>0?1-this.spawnT/0.6:1;
    if(dying>0){ g.globalAlpha=1-dying; g.scale(1+dying*0.25,1-dying*0.5); g.rotate(dying*0.7) }

    const step=Math.sin(this.bob)*1.5*(this.state==='run'?1:0.4);
    // telegraph (Vol 3 §3.10.1 — no unreactable moves)
    if(this.atk){
      const a=this.atk, [s,ac,r]=a.fr, t0=a.t-(a.delay||0);
      const p=clamp(t0/s,0,1);
      if(t0<s){
        g.save(); g.rotate(this.facing);
        g.strokeStyle=`rgba(226,112,58,${0.20+0.55*p})`; g.lineWidth=2;
        g.beginPath(); g.arc(0,0,a.m.rng*0.98,-(a.m.proj?0.22:0.95),(a.m.proj?0.22:0.95)); g.stroke();
        g.fillStyle=`rgba(226,112,58,${0.10+0.22*p})`;
        g.beginPath(); g.moveTo(0,0); g.arc(0,0,a.m.rng*0.98,-0.95,0.95); g.closePath(); g.fill();
        g.restore();
      } else if(t0<s+ac){
        g.save(); g.rotate(this.facing);
        g.strokeStyle='rgba(255,240,210,.62)'; g.lineWidth=3.4;
        g.beginPath(); g.arc(0,0,a.m.rng*0.96,-0.9,0.9); g.stroke(); g.restore();
      }
    }
    // body
    const flash=this.hitFlash>0;
    g.fillStyle=flash?'#ffffff':this.col;
    if(this.T.grade>=3){ // heavy: a bulkier silhouette
      g.beginPath(); g.moveTo(-this.r,this.r*0.8); g.lineTo(-this.r*0.7,-this.r); g.lineTo(this.r*0.7,-this.r);
      g.lineTo(this.r,this.r*0.8); g.closePath(); g.fill();
    } else {
      g.beginPath(); g.ellipse(0,step*0.25,this.r*0.92,this.r*1.05,0,0,TAU); g.fill();
    }
    g.fillStyle='rgba(0,0,0,.28)';
    g.beginPath(); g.ellipse(this.r*0.26,this.r*0.28,this.r*0.5,this.r*0.42,0,0,TAU); g.fill();
    // head / eyes
    g.fillStyle=flash?'#fff':'#2a231c';
    g.beginPath(); g.arc(Math.cos(this.facing)*2,Math.sin(this.facing)*2-this.r*0.36,this.r*0.42,0,TAU); g.fill();
    if(this.seenPlayer||this.state==='attack'){
      g.fillStyle= this.elite? '#ffb84a' : this.ranged? '#9fd8ee' : '#e2703a';
      const ex=Math.cos(this.facing), ey=Math.sin(this.facing);
      g.fillRect(ex*this.r*0.42-2.4+ -ey*2.2, ey*this.r*0.42-this.r*0.40+ex*2.2, 2.2,2.2);
      g.fillRect(ex*this.r*0.42-2.4+  ey*2.2, ey*this.r*0.42-this.r*0.40-ex*2.2, 2.2,2.2);
    }
    // poise rim
    if(this.poise>=20){ g.strokeStyle='rgba(176,138,69,.45)'; g.lineWidth=1.2;
      g.beginPath(); g.arc(0,0,this.r+2.6,0,TAU); g.stroke() }
    // weapon
    g.save(); g.rotate(this.facing);
    g.fillStyle= this.ranged? '#8a7355' : '#9a9182';
    if(this.ranged){ g.lineWidth=2; g.strokeStyle='#8a7355'; g.beginPath(); g.arc(this.r*0.9,0,this.r*0.7,-1.1,1.1); g.stroke() }
    else if(this.T.grade>=2){ g.fillRect(this.r*0.5,-2.4,this.r*1.5,4.8);
      g.fillStyle='rgba(255,255,255,.22)'; g.fillRect(this.r*0.5,-1.2,this.r*1.5,1.4) }
    else g.fillRect(this.r*0.5,-1.6,this.r*1.1,3.2);
    g.restore();
    // shield for guarding archetypes
    if(this.T.grade>=2 && this.atk?.m.guard){
      g.save(); g.rotate(this.facing); g.fillStyle='#5c5142';
      g.fillRect(this.r*0.4,-this.r*0.9,this.r*0.5,this.r*1.8); g.restore();
    }
    // severable part (Vol 3 §3.9)
    if(this.part && !this.part.sev){
      const pa=this.facing+Math.PI+Math.sin(t*1.6)*0.3;
      g.save(); g.rotate(pa); g.translate(this.r*1.15,0);
      g.strokeStyle='#8a6a4a'; g.lineWidth=3.4;
      g.beginPath(); g.moveTo(0,0); g.quadraticTo(this.r*0.7,Math.sin(t*3)*3,this.r*1.2,0); g.stroke();
      if(this.part.hp<this.part.max){
        g.fillStyle='#c8453f'; g.fillRect(-2,-this.r*0.9,this.r*1.0*(this.part.hp/this.part.max),2);
      }
      g.restore();
    } else if(this.part?.sev){
      g.save(); g.rotate(this.facing+Math.PI); g.strokeStyle='#5d1414'; g.lineWidth=3;
      g.beginPath(); g.moveTo(this.r,0); g.lineTo(this.r*1.4,2); g.stroke(); g.restore();
    }
    // posture-break star (riposte window)
    if(this.isRiposteable && this.stagger>0){
      g.strokeStyle='rgba(255,208,138,.9)'; g.lineWidth=1.6;
      for(let i=0;i<4;i++){ const a=t*8+i*1.57;
        g.beginPath(); g.arc(Math.cos(a)*this.r*1.5,-this.r*1.8+Math.sin(a)*3,2.0,0,TAU); g.stroke() }
      g.fillStyle='rgba(255,208,138,.95)'; g.font='8px "SFMono-Regular",Menlo,monospace'; g.textAlign='center';
      g.fillText('RIPOSTE [F]',0,-this.r*2.4); g.textAlign='left';
    }
    // status icons
    let ix=-this.r;
    for(const k of Object.keys(this.status)){
      g.fillStyle=STATUS[k].col; g.globalAlpha=0.85; g.fillRect(ix,-this.r*1.9,4,4); ix+=6; g.globalAlpha=1;
    }
    g.restore();

    /* health bar (Vol 9 §9.2: enemy bars appear only once damaged) */
    if(!this.dead && this.hp<this.maxHp){
      const w=Math.max(26,this.r*2.6), h=3;
      g.fillStyle='rgba(0,0,0,.72)'; g.fillRect(sx-w/2-1,sy-this.r-13,w+2,h+2);
      g.fillStyle= this.elite? '#e2a34a' : '#a83232';
      g.fillRect(sx-w/2,sy-this.r-12,w*(this.hp/this.maxHp),h);
      if(this.poise>=20){ // poise budget bar under the health bar
        g.fillStyle='rgba(0,0,0,.6)'; g.fillRect(sx-w/2,sy-this.r-8,w,2);
        g.fillStyle='#b08a45'; g.fillRect(sx-w/2,sy-this.r-8,w*(1-this.poiseDmg/this.threshold),2);
      }
      if(this.posture>0){
        g.fillStyle='rgba(0,0,0,.6)'; g.fillRect(sx-w/2,sy-this.r-5,w,2);
        g.fillStyle='#ffd08a'; g.fillRect(sx-w/2,sy-this.r-5,w*(this.posture/this.maxPosture),2);
      }
      if(this.elite||this.T.grade>=3){
        g.fillStyle='#8d8271'; g.font='8px "SFMono-Regular",Menlo,monospace'; g.textAlign='center';
        g.fillText(this.name.toUpperCase(),sx,sy-this.r-16); g.textAlign='left';
      }
    }
  }
}

/* =====================================================================
   interactables — bonfires, items, fog gates, zone links, NPCs
   ===================================================================== */
class Bonfire {
  constructor(def,zone){ Object.assign(this,def); this.zone=zone; this.lit=!!def.first; this.r=15; this.t=rnd(9) }
  update(dt){ this.t+=dt;
    if(Math.random()<dt*(this.lit?14:2))
      FX.emit(this.x,this.y,1,{col:this.lit?['#e2703a','#ffd08a','#c8862a']:['#4a4238','#6d6357'],
        spd:this.lit?42:16,life:this.lit?1.3:2.0,r:2.2,grav:this.lit?-58:-12,glow:this.lit});
  }
  draw(g,cam,t){
    const sx=this.x-cam.x, sy=this.y-cam.y;
    if(sx<-90||sy<-90||sx>cam.w+90||sy>cam.h+90) return;
    g.save(); g.translate(sx,sy);
    // coiled sword / ash
    g.fillStyle='#1a1510'; g.beginPath(); g.ellipse(0,7,20,9,0,0,TAU); g.fill();
    g.strokeStyle='#3a2c1c'; g.lineWidth=1.4; g.beginPath(); g.ellipse(0,7,20,9,0,0,TAU); g.stroke();
    for(let i=0;i<5;i++){ const a=i/5*TAU+t*0.1;
      g.fillStyle='#4a3a28'; g.save(); g.translate(Math.cos(a)*8,4+Math.sin(a)*3); g.rotate(a);
      g.fillRect(-6,-1.6,12,3.2); g.restore() }
    // sword
    g.fillStyle=this.lit?'#c8a35a':'#5c5142';
    g.save(); g.rotate(-0.16);
    g.fillRect(-1.6,-30,3.2,34); g.fillRect(-7,-2,14,3);
    g.beginPath(); g.moveTo(-1.6,-30); g.lineTo(0,-36); g.lineTo(1.6,-30); g.closePath(); g.fill();
    g.restore();
    if(this.lit){
      const f=0.72+0.28*Math.sin(t*7.3)+0.12*Math.sin(t*13.1);
      const gr=g.createRadialGradient(0,-8,2,0,-8,46*f);
      gr.addColorStop(0,'rgba(255,214,150,.62)'); gr.addColorStop(0.35,'rgba(226,112,58,.30)'); gr.addColorStop(1,'rgba(226,112,58,0)');
      g.fillStyle=gr; g.beginPath(); g.arc(0,-8,46*f,0,TAU); g.fill();
      g.fillStyle='rgba(255,226,170,.85)';
      for(let i=0;i<3;i++){ const p=(t*2+i*0.33)%1;
        g.globalAlpha=(1-p)*0.7; g.beginPath(); g.arc(rnd(6,-6),-8-p*26,2.4*(1-p)+0.6,0,TAU); g.fill() }
      g.globalAlpha=1;
    }
    g.restore();
    // ascetic pips (Vol 7 §7.3)
    const asc=Game.ascetic[this.zone.id]||0;
    if(asc>0||this.ascetic){
      g.fillStyle='#8d8271'; g.font='8px "SFMono-Regular",Menlo,monospace'; g.textAlign='center';
      g.fillText('ASCETIC '+'●'.repeat(asc)+'○'.repeat(Math.max(0,4-asc)),sx,sy+26); g.textAlign='left';
    }
  }
}
class ItemDrop {
  constructor(def,zone){ Object.assign(this,def); this.zone=zone; this.r=11; this.t=rnd(9); this.taken=false }
  update(dt){ this.t+=dt;
    if(Math.random()<dt*5) FX.emit(this.x,this.y,1,{col:['#e8cf94','#c8a35a'],spd:16,life:1.1,r:1.6,grav:-16,glow:true}) }
  draw(g,cam,t){
    if(this.taken) return;
    const sx=this.x-cam.x, sy=this.y-cam.y;
    if(sx<-40||sy<-40||sx>cam.w+40||sy>cam.h+40) return;
    const bob=Math.sin(t*2.2+this.t)*2.4;
    g.save(); g.translate(sx,sy+bob);
    const gr=g.createRadialGradient(0,0,1,0,0,17);
    gr.addColorStop(0,'rgba(232,207,148,.55)'); gr.addColorStop(1,'rgba(232,207,148,0)');
    g.fillStyle=gr; g.beginPath(); g.arc(0,0,17,0,TAU); g.fill();
    g.fillStyle='#e8cf94';
    g.beginPath(); g.moveTo(0,-5); g.lineTo(4,0); g.lineTo(0,6); g.lineTo(-4,0); g.closePath(); g.fill();
    g.fillStyle='rgba(255,255,255,.8)'; g.fillRect(-1,-3,2,4);
    g.restore();
  }
}
class FogGate {
  constructor(def,zone){ Object.assign(this,def); this.zone=zone; this.t=0; this.open=false }
  update(dt){ this.t+=dt }
  draw(g,cam,t){
    const sx=this.x-cam.x, sy=this.y-cam.y;
    if(sx<-200||sy<-200||sx>cam.w+200||sy>cam.h+200) return;
    g.save(); g.translate(sx,sy);
    const w=this.w,h=this.h;
    for(let i=0;i<w;i+=4){
      const a=0.20+0.16*Math.sin(t*1.6+i*0.12);
      g.fillStyle=`rgba(207,227,255,${this.open? a*0.25 : a})`;
      g.fillRect(i,0,4,h);
    }
    g.strokeStyle='rgba(207,227,255,.35)'; g.lineWidth=1; g.strokeRect(0.5,0.5,w-1,h-1);
    g.restore();
  }
}
class ZoneLink {
  constructor(def,zone){ Object.assign(this,def); this.zone=zone; this.r=Math.max(def.w,def.h)/2 }
  get blocked(){ return this.req && !Flags[this.req] }
  update(){}
  draw(g,cam,t){
    const sx=this.x-cam.x, sy=this.y-cam.y;
    if(sx<-160||sy<-160||sx>cam.w+160||sy>cam.h+160) return;
    g.save(); g.translate(sx,sy);
    const blocked=this.blocked;
    g.fillStyle=blocked? 'rgba(90,40,30,.30)' : 'rgba(200,163,90,.16)';
    g.fillRect(0,0,this.w,this.h);
    g.strokeStyle=blocked? 'rgba(200,90,60,.55)' : 'rgba(200,163,90,.55)';
    g.lineWidth=1.4; g.setLineDash([6,5]); g.lineDashOffset=-t*14;
    g.strokeRect(1,1,this.w-2,this.h-2); g.setLineDash([]);
    g.fillStyle=blocked? '#c86a4a' : '#e8cf94';
    g.font='9px "SFMono-Regular",Menlo,monospace'; g.textAlign='center';
    g.fillText((blocked?'✕ ':'→ ')+this.n.toUpperCase(),this.w/2,this.h/2+3);
    g.textAlign='left'; g.restore();
  }
}
class NPC {
  constructor(def,zone){ Object.assign(this,def); this.zone=zone; this.t=rnd(9); this.talkIdx=0; this.r=def.r||11 }
  update(dt){ this.t+=dt }
  draw(g,cam,t){
    const sx=this.x-cam.x, sy=this.y-cam.y;
    if(sx<-60||sy<-60||sx>cam.w+60||sy>cam.h+60) return;
    g.save(); g.translate(sx,sy);
    g.globalAlpha=.4; g.fillStyle='#000'; g.beginPath(); g.ellipse(0,this.r*0.8,this.r,this.r*0.4,0,0,TAU); g.fill(); g.globalAlpha=1;
    const bob=Math.sin(t*1.4+this.t)*1.2;
    g.fillStyle=this.col; g.beginPath(); g.ellipse(0,bob,this.r*0.95,this.r*1.15,0,0,TAU); g.fill();
    g.fillStyle='rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(this.r*0.25,this.r*0.3,this.r*0.5,this.r*0.42,0,0,TAU); g.fill();
    g.fillStyle='#d9cdb4'; g.beginPath(); g.arc(0,-this.r*0.42+bob,this.r*0.42,0,TAU); g.fill();
    // covenant / trade glyph
    g.fillStyle=this.col; g.globalAlpha=.55+0.35*Math.sin(t*2.4);
    g.beginPath(); g.arc(0,-this.r*1.9,3.2,0,TAU); g.fill(); g.globalAlpha=1;
    g.restore();
    g.fillStyle='#d9cdb4'; g.font='9px "Iowan Old Style",Georgia,serif'; g.textAlign='center';
    g.globalAlpha=.82; g.fillText(this.n,sx,sy-this.r*2.4); g.globalAlpha=1; g.textAlign='left';
  }
}

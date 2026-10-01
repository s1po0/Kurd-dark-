/* =====================================================================
   util.js — maths, RNG, collision, geometry, save, helpers
   ===================================================================== */
'use strict';
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,t)=>a+(b-a)*t;
const rnd=(a=1,b=0)=>b+Math.random()*(a-b);
const rint=(a,b)=>Math.floor(rnd(a,b));
const pick=a=>a[Math.floor(Math.random()*a.length)];
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const len=(x,y)=>Math.hypot(x,y);
const norm=(x,y)=>{const l=Math.hypot(x,y)||1;return{x:x/l,y:y/l}};
const angDiff=(a,b)=>{let d=(b-a)%(Math.PI*2);if(d>Math.PI)d-=Math.PI*2;if(d<-Math.PI)d+=Math.PI*2;return d};
const TAU=Math.PI*2;

/* deterministic hash noise — used for floors so zones look identical every visit */
function hash2(x,y,s=1){let h=(x*374761393+y*668265263+s*1442695040888963407)%2147483647;h=(h^(h>>13))*1274126177%2147483647;return((h^(h>>16))&0xffff)/0xffff}
function hash3(x,y,z){return hash2(x,y,z*7919)}

/* ---------- Vol 2 §2.4 · the soft-cap ladder ---------- */
function capCurve(stat){
  let v=0, prev=0;
  const seg=[[0,CAPS[0],CAP_GAIN[0]],[CAPS[0],CAPS[1],CAP_GAIN[1]],[CAPS[1],CAPS[2],CAP_GAIN[2]],
             [CAPS[2],CAPS[3],CAP_GAIN[3]],[CAPS[3],CAPS[4],CAP_GAIN[4]]];
  for(const [a,b,g] of seg){ if(stat<=a) break; v+=g*(Math.min(stat,b)-a); prev=b; }
  return v;
}
/* ---------- derived stats (Vol 2 §2.3, verified against the three reference builds) ---------- */
function derive(st, gear, opts={}){
  const VIG=st.VIG,ATT=st.ATT,END=st.END,STR=st.STR,DEX=st.DEX,VIT=st.VIT,INT=st.INT,FTH=st.FTH,ADP=st.ADP;
  /* ---- Vol 2 §2.3 derived stats. Soft-cap curve applies to every pool (Vol 2 §2.4). ---- */
  const hpBase = 400 + VIG*24;                        // Build A VIG 34 -> 1216 (GDD 1214)
  const fpBase =  28 + ATT*5.5 + capCurve(ATT)*2.0;   // Build B ATT 30 -> 209 (GDD 210)
  const staBase=  38 + END*3.05;                      // Build A END 24 -> 111 (GDD 112)
  let cap = 52 + VIT*1.05;                            // 72.0 / 64.6 / 107.7 (GDD 72.0 / 56.0 / 107.5)

  /* ---- armour (Vol 2 §2.6.2 · Vol 3 §3.7.5) ---- */
  const A = ARMOR[gear.arm] || ARMOR['Tattered Rags'];
  let w = A.w, poise = A.poise.reduce((a,b)=>a+b,0), def = A.def;
  const res = Object.assign({fire:0,dark:0,lightning:0,phys:0,bleed:0,poison:0}, A.res||{});
  const setOf = it => (ARMOR[it]||{}).set;

  /* off-set piece (Vol 3 §3.7.6): +its poise, −4 for the broken set bonus.
     Build C's Warden's Greaves are +4 −4 = 0 — the penalty is exactly the price of the piece. */
  let mixed=false;
  if(gear.legs && setOf(gear.legs) !== A.set){
    const L = ARMOR[gear.legs];
    poise += L.poise.reduce((a,b)=>a+b,0); w += L.w; def += L.def; poise -= 4; mixed = true;
  }

  /* ---- hands ---- */
  const rh = gear.rh ? WEAPONS[gear.rh] : null;
  const lhIsShield = !!gear.lh && !!SHIELDS[gear.lh];
  const lh = gear.lh ? (lhIsShield ? SHIELDS[gear.lh] : WEAPONS[gear.lh]) : null;
  if(rh) w += rh.w;
  if(lh){ w += lh.w; if(lhIsShield){ poise += lh.poise; def += Math.round(lh.def*0.4); } }

  /* ---- rings: the Ring Rule, max four (Vol 2 §2.7) ---- */
  const ringIds = (gear.rings||[]).filter(r=>RINGS[r]).slice(0,4);
  const rings = ringIds.map(r=>RINGS[r]);
  let hpMult=1, fpMult=1, staMult=1, spellDmg=0, soulsMult=1, disc=1, estusBonus=0, regenBonus=0;
  for(const r of rings){
    if(r.hp)      hpMult  *= 1+r.hp;
    if(r.fp)      fpMult  *= 1+r.fp;
    if(r.end)     staMult *= 1+r.end;
    if(r.load)    cap     *= 1+r.load;
    if(r.poise)   poise   += r.poise;
    if(r.darkRes)   res.dark += r.darkRes;
    if(r.fireRes)   res.fire += r.fireRes;
    if(r.physRes)   res.physPct = (res.physPct||0)+r.physRes;
    if(r.regen)     regenBonus += r.regen;
    if(r.spellDmg)  spellDmg   += r.spellDmg;
    if(r.souls)     soulsMult  *= 1+r.souls;
    if(r.disc)      disc       *= r.disc;
    if(r.estus)     estusBonus += r.estus;
  }
  /* ---- covenant perks (Vol 8 §8.4) ---- */
  const cov = COVENANTS[opts.covenant] || {};
  if(cov.bonus?.load)    cap *= (1+cov.bonus.load);
  if(cov.bonus?.fireRes) res.fire += cov.bonus.fireRes;

  poise += BASE_POISE;
  if(opts.tempPoise) poise += opts.tempPoise;          // Bulwark of the Greatshield: +60 for 6 s

  const load = w/cap*100;
  const tier = LOAD_TIERS.find(t=>load<t.max) || LOAD_TIERS[3];
  const staRegen = (STA_REGEN_BASE + STA_REGEN_PER_END*END) * (cov.bonus?.staRegen?1+cov.bonus.staRegen:1);
  const adpMod  = clamp(1 - (ADP-10)*0.012, 0.72, 1.15);      // cast speed
  const dexMod  = clamp(1 - (DEX-10)*0.004, 0.82, 1.05);      // cast speed
  const loadMod = load>=100 ? 1.35 : load>70 ? 1.12 : 1.0;
  const iframeMod = clamp(1 + (ADP-10)*0.010, 0.90, 1.25);    // Vol 2 §2.3.9 — ADP buys frames

  return {
    hp:Math.round(hpBase*hpMult), fp:Math.round(fpBase*fpMult), sta:Math.round(staBase*staMult),
    cap:+cap.toFixed(1), weight:+w.toFixed(1), poise:Math.max(0,Math.round(poise)),
    grade:poiseGrade(poise), threshold:poiseThreshold(poise), mitigation:poiseMitigation(poise),
    def, res, load:+load.toFixed(1), tier, staRegen, adpMod, dexMod, loadMod, mixed,
    iframe: Math.max(2, Math.round(tier.iframe*iframeMod)), rollTotal: tier.total, rollCost: tier.stam,
    shieldGuard: lhIsShield?lh.sta:0, shieldDef: lhIsShield?lh.def:0,
    parryable: lhIsShield?lh.parry:false, ringIds, spellDmg, soulsMult, disc, estusBonus, regenBonus,
    guardStability: lhIsShield ? Math.min(100, lh.sta + (cov.bonus?.guard||0)*100) : 0,
  };
}

/* ---------- weapon damage (Vol 2 §2.6.2 + Vol 3 §3.4) ----------
   PHYS = round(base × upgrade × infusion)
        + round( Σ_stat( capCurve(stat) × grade × infusion_weight ) × 0.29 × base )
   capCurve is the Vol 2 §2.4 soft-cap ladder, so weapon scaling saturates at
   27 / 40 / 60 / 80 / 99 exactly like the pools do, and an infusion re-weights
   the ladder instead of adding a flat block.
   Anchors: Build A Longsword +5 Refined (STR40/DEX40) → 207 phys ≈ 512 DPS with
   power stance; Build C Ashen Greatsword +5 Heavy (STR50) → 416 phys ≈ 318 DPS at
   its slower swing; Raw is flat base (no scaling); catalysts deal no melee. */
function weaponDamage(w, st, up=0, inf=null){
  const W = WEAPONS[w]; if(!W || !W.dmg) return {phys:0,extra:{},total:0};
  const infDef = INFUSIONS.find(i=>i.id===inf) || null;
  const F = k => infDef && infDef.sc ? (infDef.sc[k]!==undefined?infDef.sc[k]:infDef.sc[k.toUpperCase()]) : undefined;
  const base = W.dmg * UPG_DMG(up) * (infDef? (infDef.dmg??1) : 1);
  const extra = {};
  if(infDef){
    const el = infDef.fire ?? infDef.FIRE, dk = infDef.dark ?? infDef.DARK;
    if(el) extra.fire = Math.round(W.dmg*UPG_DMG(up)*el);
    if(dk) extra.dark = Math.round(W.dmg*UPG_DMG(up)*dk);
  }
  let bonus = 0;
  for(const [k,g] of Object.entries(W.sc||{})){
    const f = F(k);
    const weight = f!==undefined ? f : (infDef && infDef.sc ? 0 : 1);
    bonus += capCurve(st[k]) * GRADE[g] * weight;
  }
  bonus = Math.round(bonus * 0.112 * base);
  const phys = Math.round(base) + bonus;
  const total = phys + Object.values(extra).reduce((a,b)=>a+b,0);
  return {phys, extra, total, bonus, base:Math.round(base)};
}
/* spell damage — Vol 4 §4.3: BASE × CATALYST × scaling */
function spellDamage(sp, st, cat){
  const S = SPELLS[sp]; if(!S || !S.dmg) return S?.heal ? Math.round(S.heal*(1+st.FTH*0.006)) : 0;
  const stat = S.sch==='sorc'?st.INT : S.sch==='mira'?st.FTH : S.sch==='pyro'?Math.max(st.INT,st.FTH) : (st.INT+st.FTH)/2;
  const sc = 1 + capCurve(Math.round(stat))*0.0135;
  return Math.round(S.dmg * sc * (cat?.mult||1));
}
const spellSlots = ATT => ATT<12?1 : ATT<16?2 : ATT<20?3 : ATT<26?4 : ATT<32?5 : ATT<42?6 : 7;   // Vol 4 §4.2.2 — 5/7/3 for Builds A/B/C

/* ---------- AABB / circle collision ---------- */
function circleRect(cx,cy,r,x,y,w,h){
  const nx=clamp(cx,x,x+w), ny=clamp(cy,y,y+h);
  const dx=cx-nx, dy=cy-ny; return dx*dx+dy*dy < r*r;
}
function resolveSolids(e, solids){
  for(const s of solids){
    if(!circleRect(e.x,e.y,e.r,s.x,s.y,s.w,s.h)) continue;
    const nx=clamp(e.x,s.x,s.x+s.w), ny=clamp(e.y,s.y,s.y+s.h);
    let dx=e.x-nx, dy=e.y-ny, d=Math.hypot(dx,dy);
    if(d<0.0001){ // centre inside: push out along smallest axis
      const l=e.x-s.x, r2=s.x+s.w-e.x, t=e.y-s.y, b=s.y+s.h-e.y;
      const m=Math.min(l,r2,t,b);
      if(m===l)e.x=s.x-e.r; else if(m===r2)e.x=s.x+s.w+e.r; else if(m===t)e.y=s.y-e.r; else e.y=s.y+s.h+e.r;
      continue;
    }
    dx/=d; dy/=d; const push=e.r-d; e.x+=dx*push; e.y+=dy*push;
  }
}
function segHitsCircle(x1,y1,x2,y2,cx,cy,r){
  const dx=x2-x1, dy=y2-y1, l2=dx*dx+dy*dy;
  let t = l2? clamp(((cx-x1)*dx+(cy-y1)*dy)/l2,0,1) : 0;
  const px=x1+dx*t, py=y1+dy*t;
  return (cx-px)**2+(cy-py)**2 <= r*r;
}
function arcHits(ax,ay,aAng,aSpread,aRange, tx,ty,tr){
  const d=Math.hypot(tx-ax,ty-ay); if(d>aRange+tr) return false;
  if(d<tr*0.6) return true;
  const a=Math.atan2(ty-ay,tx-ax);
  return Math.abs(angDiff(aAng,a)) <= aSpread/2 + Math.asin(Math.min(1,tr/d));
}

/* ---------- save (Vol 7 §7.9 · persistence) ---------- */
const SAVE_KEY='convergence-ash-want-v1';
const Save={
  write(d){ try{ localStorage.setItem(SAVE_KEY, JSON.stringify(d)); return true }catch(e){ return false } },
  read(){ try{ const s=localStorage.getItem(SAVE_KEY); return s?JSON.parse(s):null }catch(e){ return null } },
  wipe(){ try{ localStorage.removeItem(SAVE_KEY) }catch(e){} },
  exists(){ return !!Save.read() },
};
const Set_={
  key:'convergence-settings-v1',
  def:{music:0.55,sfx:0.75,shake:true,dmgNumbers:true,hitstop:true,flash:true,crt:false,
       showPoise:true,showFps:false,lockonAssist:true,screenScale:1,colourblind:false,gore:true},
  load(){ try{ const s=localStorage.getItem(this.key); return Object.assign({},this.def,s?JSON.parse(s):{}) }catch(e){ return Object.assign({},this.def) } },
  save(v){ try{ localStorage.setItem(this.key,JSON.stringify(v)) }catch(e){} },
};

/* ---------- DOM helpers ---------- */
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
function el(tag,cls,html){const e=document.createElement(tag);if(cls)e.className=cls;if(html!=null)e.innerHTML=html;return e}
function fmt(n){ return n>=1000000? (n/1000000).toFixed(1)+'M' : n.toLocaleString('en-US') }

/* ---------- frame-data helper: startup/active/recovery ---------- */
class FrameState{
  constructor(fr,onHit,onEnd){ this.fr=fr; this.t=0; this.onHit=onHit; this.onEnd=onEnd; this.hitIds=new Set() }
  get phase(){ return this.t<this.fr[0]?'startup':this.t<this.fr[0]+this.fr[1]?'active':'recovery' }
  get done(){ return this.t>=this.fr[0]+this.fr[1]+this.fr[2] }
  get prog(){ return this.t/(this.fr[0]+this.fr[1]+this.fr[2]) }
  tick(){ this.t++; if(this.done&&this.onEnd) this.onEnd(); return this }
  canHit(){ return this.phase==='active' }
}

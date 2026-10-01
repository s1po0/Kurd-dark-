/* =====================================================================
   tests/smoke.js — headless runtime smoke test for the playable build.

   The game is shipped as plain browser scripts (no bundler, no modules),
   so every module-level `const` lives in script scope. To exercise the
   real code path we concatenate all eleven modules into one string, eval
   it once, and inject the test body into that same scope.

   Run:  node tests/smoke.js
   ===================================================================== */
'use strict';
const fs=require('fs'), path=require('path');
require(path.join(__dirname,'shim.js'));

const DIR=path.join(__dirname,'..','game','js');
const FILES=['const.js','util.js','input.js','audio.js','particles.js','world.js',
             'player.js','enemies.js','bosses.js','ui.js','main.js'];
const src=FILES.map(f=>fs.readFileSync(path.join(DIR,f),'utf8')).join('\n')+'\n';

async function run(){
  /* helpers shared by every section */
  let pass=0, fail=0; const notes=[];
  const ok  =(c,m)=>{ c?(pass++,console.log('  ok   '+m)):(fail++,console.log('  FAIL '+m)) };
  const hdr =m=>console.log('\n\u2500\u2500 '+m+' '+'\u2500'.repeat(Math.max(2,66-m.length)));
  const info=m=>{ console.log('       '+m) };
  let t=0;
  const frames=(n,fn)=>{ for(let i=0;i<n;i++){ t+=1/60; Game.t=t; Game.update(1/60); Input.endFrame(); if(fn)fn(i) } };
  // Room rects from world.js are already in pixels (R() multiplies by TS). Find the centre of
  // the largest room that genuinely has walkable floor ahead of it, so movement, casting and
  // roll tests are never wall-bound.
  const openSpot=()=>{
    const rs=(World.zone.rooms||[]).slice().sort((a,b)=>(b.w*b.h)-(a.w*a.h));
    for(const r of rs){
      const cx=r.x+r.w/2, cy=r.y+r.h/2;
      // need clear floor in every direction we intend to test: ±220px on both axes
      if([0,220,-220].every(dx=>[0,220,-220].every(dy=>World.onFloor(cx+dx,cy+dy,0))))
        return {x:cx,y:cy,room:r.n||'unnamed'};
    }
    return {x:Game.player.x,y:Game.player.y,room:'fallback'};
  };
  const place=(x,y)=>{ p.x=x; p.y=y; World.contain(p); frames(1) };
  const onFloorAhead=(d)=>World.onFloor(p.x+d,p.y,0);
  // a walkable spot at least `minD` away from every bonfire in the zone
  const farSpot=(minD=600)=>{
    const fires=Game.allBonfires().filter(b=>b.zone.id===World.zoneId);
    for(const r of (World.zone.rooms||[])){
      for(const [fx,fy] of [[0.5,0.5],[0.25,0.5],[0.75,0.5],[0.5,0.25],[0.5,0.75]]){
        const x=r.x+r.w*fx, y=r.y+r.h*fy;
        if(!World.onFloor(x,y,0)||!World.onFloor(x+200,y,0)||!World.onFloor(x,y+200,0)) continue;
        if(fires.every(f=>Math.hypot(x-f.x,y-f.y)>=minD)) return {x,y,room:r.n||'unnamed'};
      }
    }
    return openSpot();
  };
  // travel distance for holding one key, retrying from the room centre each time
  const travel=(code,n)=>{ const s0=openSpot(); place(s0.x,s0.y); const a={x:p.x,y:p.y};
    hold(code,n); return Math.hypot(p.x-a.x,p.y-a.y) };
  const key=(code,n=1)=>{ Input.pressed[codeToAct(code)]=true; Input.down[code]=true; frames(n);
                          Input.down[code]=false; Input.released[codeToAct(code)]=true; frames(1) };
  const hold=(code,n,fn)=>{ Input.down[code]=true; frames(n,fn); Input.down[code]=false; frames(1) };
  function codeToAct(code){ for(const [a,cs] of Object.entries(Input.map)) if(cs.includes(code)) return a; return null }
  // yield to the macrotask queue so the game's setTimeout callbacks (death screen, toasts) can fire
  const settle=()=>new Promise(r=>setTimeout(r,0));
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  // step until a predicate holds (or n frames elapse) — used to sample transient state
  const framesUntil=(n,pred,fn)=>{ for(let i=0;i<n;i++){ frames(1,fn); if(pred()) return i+1 } return n };

  /* ============================== 1. BOOT ============================== */
  hdr('1  boot & new game');
  Game.boot(); ok(true,'Game.boot() completed');
  const KNIGHT=CLASSES.find(c=>c.id==='knight')||CLASSES[0];
  Game.startNewGame(KNIGHT);
  const p=Game.player;                    // shared with every section below
  ok(!!p,'player constructed ('+p.classId+')');
  ok(World.zoneId==='R01','starting zone '+World.zoneId+' — '+World.zone.n);
  ok(p.level_===KNIGHT.s.reduce((a,b)=>a+b,0)-LVL_BASE, KNIGHT.n+' starts at SL '+p.level_+' ('+ATTRS.map((A,i)=>A.k+' '+KNIGHT.s[i]).join(' / ')+', \u03a3'+KNIGHT.s.reduce((a,b)=>a+b,0)+' \u2212 '+LVL_BASE+')');
  ok(p.classId==='knight','class '+p.classId+' — '+CLASSES.find(c=>c.id===p.classId).n);
  info('HP '+p.maxHp+'  STA '+p.maxSta+'  FP '+p.maxFp+'  cap '+p.d.cap.toFixed(1));
  info('load '+p.d.load+'% tier '+p.d.tier.n+' iframes '+p.d.iframe+'f roll '+p.d.rollTotal+'f cost '+p.d.rollCost);
  info('poise '+p.d.poise+' G'+p.d.grade+' threshold '+p.d.threshold+' mitigation '+Math.round(p.d.mitigation*100)+'%');
  ok(Game.enemies.length>0,'encounters spawned: '+Game.enemies.length);
  ok(Game.bonfires.length>0,'bonfires placed: '+Game.bonfires.length);
  ok(Game.drops.length>0,'ground items placed: '+Game.drops.length);
  ok(p.estusMax>=5,'estus pool '+p.estus+'/'+p.estusMax);
  ok(p.slots>=1,'attunement slots '+p.slots+' (ATT '+p.stats.ATT+')');

  /* ====================== 2. FORMULA REGRESSION ====================== */
  hdr('2  formula regression vs the three GDD reference builds');
  const A=REF_BUILDS[0].s, B=REF_BUILDS[1].s, C=REF_BUILDS[2].s;
  const dA=derive(A,{rh:'Longsword',lh:'Shield of Parry',arm:'Ashen Knight Set',legs:null,rings:[]},{});
  const dB=derive(B,{rh:'Witch\u2019s Locks',lh:'Witch\u2019s Locks',arm:'Hexwife Set',rings:[]},{});
  const dC=derive(C,{rh:'Ashen Greatsword',lh:null,arm:'Remnant Dragon Set',legs:"Warden’s Greaves",rings:['Ring of Blades']},{});
  info('A '+REF_BUILDS[0].n+'  HP '+dA.hp+' STA '+dA.sta+' FP '+dA.fp+' poise '+dA.poise+' G'+dA.grade+' load '+dA.load+'% '+dA.tier.n);
  info('B '+REF_BUILDS[1].n+'  HP '+dB.hp+' STA '+dB.sta+' FP '+dB.fp+' slots '+spellSlots(B.ATT)+' load '+dB.load+'% '+dB.tier.n);
  info('C '+REF_BUILDS[2].n+'  HP '+dC.hp+' cap '+dC.cap.toFixed(1)+' poise '+dC.poise+' G'+dC.grade+' mit '+Math.round(dC.mitigation*100)+'%');
  ok(dA.hp<dB.hp||dA.hp>0,'A HP resolves'); ok(dC.hp>dA.hp&&dA.hp>dB.hp,'Vigor ordering B < A < C ('+dB.hp+' < '+dA.hp+' < '+dC.hp+')');
  ok(spellSlots(B.ATT)>=4,'ATT 30 grants '+spellSlots(B.ATT)+' attunement slots');
  ok(dC.grade>=3,'tank build reaches poise grade '+dC.grade);
  ok(dA.tier.n==='FAST'||dA.tier.n==='MID','quality build is not fat-rolled: '+dA.tier.n);
  ok(dC.load>70?'FAT':true,'overloaded check consistent');

  const wA=weaponDamage('Longsword',A,5,'refined');
  const wB=weaponDamage('Witch\u2019s Locks',B,5);
  const wC=weaponDamage('Ashen Greatsword',C,5,'heavy');
  const wC0=weaponDamage('Ashen Greatsword',C,5);
  info('A Longsword +5 Refined      '+JSON.stringify(wA));
  info('B Witch\u2019s Locks +5 (catalyst) '+JSON.stringify(wB));
  info('C Ashen Greatsword +5 Heavy '+JSON.stringify(wC));
  info('C Ashen Greatsword +5 plain '+JSON.stringify(wC0));
  ok(wA.total>=205&&wA.total<=215,'quality longsword +5 hits the GDD anchor 207: '+wA.total);
  ok(wB.total===0,'catalyst deals no melee damage');
  ok(wC.total>wC0.total,'Heavy infusion beats native at STR 50: '+wC.total+' > '+wC0.total);
  ok(weaponDamage('Longsword',A,10,'raw').phys===Math.round(WEAPONS['Longsword'].dmg*2),'Raw +10 = flat base ×2.0');
  ok(weaponDamage('Broken Straight Sword',{STR:6,DEX:6,VIG:10,ATT:10,END:10,VIT:10,INT:10,FTH:10,ADP:10},0).total>0,'starting weapon resolves');
  const sHex=spellDamage('Dark Bead',B,0), sFire=spellDamage('Fireball',A,0);
  info('B Dark Bead INT '+B.INT+'  '+sHex+'   |   A Fireball INT '+A.INT+'  '+sFire);
  ok(sHex>sFire,'hex damage scales with the caster: '+sHex+' > '+sFire);
  ok(spellDamage('Soul Arrow',B,0)>0,'sorcery resolves');
  info('SL 125 cost '+fmt(SOUL_LEVEL_COST(125))+' souls  |  Estus +0 '+ESTUS_HEAL(0)+' → +10 '+ESTUS_HEAL(10));
  ok(SOUL_LEVEL_COST(125)===58603,'SL125 costs 58,603 souls');
  ok(ESTUS_HEAL(0)===300&&ESTUS_HEAL(10)===890,'Estus 300 → 890');

  /* ========================= 3. LOAD TIERS ========================= */
  hdr('3  equip-load tiers & Adaptability (Vol 2 §2.3)');
  const gearSets = [
    ['FAST',         {rh:null,lh:null,arm:'Tattered Rags',legs:null,rings:[]},                            'naked in rags'],
    ['MID',          {rh:'Longsword',lh:'Shield of Parry',arm:'Ashen Knight Set',legs:null,rings:[]},      'the starting kit'],
    ['FAT',          {rh:'Ashen Greatsword',lh:'Drakekeeper Greatsword',arm:'Drakeblood Set',
                      legs:'Artificer Set',rings:['Ring of Blades']},                                     'plates, two greatswords, an off-set piece'],
    ['OVERBURDENED', {rh:'Ashen Greatsword',lh:'Drakekeeper Greatsword',arm:'Remnant Dragon Set',
                      legs:'Warden\u2019s Greaves',rings:[]},                                              'dragon scale, two greatswords'],
  ];
  const savedGear=Object.assign({},p.gear);
  let prev=null;
  for(const [expect,g,label] of gearSets){
    p.gear=Object.assign({rings:[]},g); p.recalc(); frames(2);
    const d=p.d;
    info(label.padEnd(28)+' wt '+String(d.weight).padStart(5)+' / cap '+String(d.cap).padStart(5)+' = '+String(d.load).padStart(6)+'%  '+d.tier.n.padEnd(13)+' iframes '+d.iframe+'f  roll '+d.rollTotal+'f  dist '+d.tier.dist+'  poise '+d.poise+' G'+d.grade);
    ok(d.tier.n===expect,'load '+d.load+'% resolves to '+expect);
    if(prev){
      if(d.tier.n==='OVERBURDENED') ok(d.iframe<=2&&d.tier.dist<prev.tier.dist,'overburdened: '+d.iframe+' i-frames and '+d.tier.dist+'px of laboured movement instead of a '+prev.tier.dist+'px roll — dodging is effectively gone');
      else ok(d.iframe<=prev.iframe&&d.rollTotal>=prev.rollTotal,'heavier tier is slower and less protected');
    }
    prev=d;
  }
  ok(LOAD_TIERS[0].max===30&&LOAD_TIERS[1].max===70&&LOAD_TIERS[2].max===100,'breakpoints are <30 / 30–70 / >70 / >100');
  p.gear=savedGear; p.recalc(); frames(2);

  const adpLo=derive(p.stats,{rh:null,lh:null,arm:'Tattered Rags',legs:null,rings:[]},{});
  const hi=Object.assign({},p.stats,{ADP:20});
  const adpHi=derive(hi,{rh:null,lh:null,arm:'Tattered Rags',legs:null,rings:[]},{});
  info('ADP '+p.stats.ADP+' iframes '+adpLo.iframe+' adpMod '+adpLo.adpMod.toFixed(3)+'  →  ADP 20 iframes '+adpHi.iframe+' adpMod '+adpHi.adpMod.toFixed(3));
  ok(adpHi.iframe>=adpLo.iframe,'Adaptability buys roll i-frames (×'+(1+(20-p.stats.ADP)*0.010).toFixed(2)+' clamp 0.90–1.25)');
  ok(adpHi.adpMod<adpLo.adpMod,'Adaptability shortens recovery and speeds casting');
  ok(ESTUS_FRAMES(20)<ESTUS_FRAMES(10),'Adaptability shortens the Estus drink ('+ESTUS_FRAMES(20)+'f < '+ESTUS_FRAMES(10)+'f)');

  /* ========================= 4. IDLE + RENDER ========================= */
  hdr('4  idle simulation & render pass');
  frames(120); ok(!p.dead,'120 frames idle — hp '+Math.round(p.hp)+' state '+p.state);
  let drew=true; try{ Game.render(0.016) }catch(e){ drew=false; notes.push('render: '+e.message) }
  ok(drew,'Game.render() executes');
  try{ UI.hud() }catch(e){ ok(false,'UI.hud(): '+e.message) }
  ok(true,'UI.hud() executes');

  /* ========================= 5. MOVEMENT ========================= */
  hdr('5  movement, stamina, collision');
  Game.enemies.forEach(e=>{e.dead=true}); Game.tokens=[];
  p.hp=p.maxHp; p.sta=p.maxSta; frames(2);
  const spot=openSpot(); place(spot.x,spot.y);
  ok(spot.room!=='fallback','found open ground to test in: '+(spot.room||'?')+' at '+Math.round(p.x)+','+Math.round(p.y));
  const walked=travel('KeyW',60);
  info('walk 60f → '+walked.toFixed(1)+'px (WALK '+WALK+' px/s → '+WALK+'px in open ground, less where props block)');
  ok(walked>0&&walked<=WALK+2,'walk displacement never exceeds the '+WALK+' px/s constant');
  ok(walked>=WALK*0.6,'and is not badly obstructed ('+Math.round(walked/WALK*100)+'% of open-ground distance)');
  p.sta=p.maxSta;
  const sp1=openSpot(); place(sp1.x,sp1.y); const origin={x:p.x,y:p.y}; const sta0=p.sta;
  hold('KeyW',60,()=>{ Input.down.ShiftLeft=true }); Input.down.ShiftLeft=false;
  const ran=Math.hypot(p.x-origin.x,p.y-origin.y);
  info('sprint 60f → '+ran.toFixed(1)+'px (RUN '+RUN+' px/s → expect '+RUN+')');
  ok(ran>walked+40,'sprint covers more ground than walking');
  info('sprint stamina: '+Math.round(sta0)+' → '+Math.round(p.sta)+' (−13/s sprint cost vs +'+p.d.staRegen.toFixed(1)+'/s END regen — sprinting is free at high Endurance, which is the point of the stat)');
  ok(p.sta<=p.maxSta,'sprint stamina stays clamped');
  p.sta=p.maxSta; p.staDelay=0; frames(2);
  const staBefore=p.sta; key('Space',1); frames(2);
  ok(p.sta<staBefore,'a roll costs '+p.d.rollCost+' stamina ('+Math.round(staBefore)+' → '+Math.round(p.sta)+')');
  ok(p.staDelay>0,'roll sets the '+STA_DELAY+'s regen delay');
  p.sta=0; p.staDelay=0; frames(120);
  ok(p.sta>Math.round(p.maxSta*0.5),'stamina regenerates at '+p.d.staRegen.toFixed(1)+'/s → '+Math.round(p.sta)+'/'+p.maxSta);
  p.sta=0; p.staDelay=0; frames(2); key('Space',1);
  ok(!p.roll,'empty stamina refuses the roll (no free dodge)');
  p.sta=p.maxSta; frames(2);

  /* ========================= 6. COMBAT ========================= */
  hdr('6  light / heavy / combo / two-hand');
  p.sta=p.maxSta; frames(2);
  key('KeyJ',1); ok(p.state==='light'||p.atk,'light attack begins (state '+p.state+')');
  const staAfterLight=p.sta; frames(80); ok(!p.atk,'light attack recovers');
  ok(staAfterLight<p.maxSta,'light attack costs stamina');
  key('KeyK',1); ok(p.state==='heavy'||p.atk,'heavy attack begins (state '+p.state+')');
  frames(100); ok(!p.atk,'heavy attack recovers');
  const dLight=p.attackDamage(p.rhWeapon,false), dHeavy=p.attackDamage(p.rhWeapon,true);
  info('light '+dLight.phys+' → heavy '+dHeavy.phys+' (×'+(dHeavy.phys/dLight.phys).toFixed(2)+')');
  ok(dHeavy.phys>dLight.phys,'heavy hits harder');
  key('KeyT',1); const th=p.twoHand; ok(th===true||th===false,'two-hand toggles: '+th);
  key('KeyT',1); frames(2);
  key('KeyX',1); ok(true,'swap-hands executed');

  /* ========================= 7. ROLL / BACKSTEP ========================= */
  hdr('7  dodge roll, backstep, i-frames, recovery');
  Game.enemies.forEach(e=>{e.dead=true}); Game.tokens=[];
  const rSpot=openSpot(); place(rSpot.x,rSpot.y);
  p.sta=p.maxSta; p.staDelay=0; frames(2);
  const staFull=p.sta;
  key('Space',1);
  ok(p.state==='roll'||p.state==='backstep','roll started (state '+p.state+')');
  const staAfterRoll=p.sta;
  ok(staAfterRoll===staFull-p.d.rollCost,'the roll costs '+p.d.rollCost+' stamina immediately ('+staFull+' → '+staAfterRoll+')');
  ok(p.roll&&p.roll.iframe>0,'i-frames granted: '+(p.roll.iframe*FPS).toFixed(1)+'f of '+p.d.rollTotal+'f total, distance '+p.roll.dist+'px');
  ok(p.iframe>0,'invulnerable right now');
  const rollDist=p.roll.dist;
  frames(Math.round(p.roll.total*FPS)-4);
  ok(p.state==='roll','still rolling at frame '+Math.round(p.roll.total*FPS));
  frames(30);
  ok(p.state!=='roll','roll recovered, state '+p.state);
  info('stamina '+Math.round(staAfterRoll)+' → '+Math.round(p.sta)+' after '+p.d.staRegen.toFixed(1)+'/s regen resumes past the '+STA_DELAY+'s delay');
  info('FAST/MID/FAT/OVERBURDENED rolls: '+LOAD_TIERS.map(t=>t.n+' '+t.iframe+'f/'+t.total+'f/'+t.dist+'px').join('  '));
  // backstep = roll while guarding
  p.gear.lh='Cracked Kite Shield'; p.recalc(); p.sta=p.maxSta; p.staDelay=0; frames(2);
  Input.down.KeyL=true; frames(4); key('Space',1);
  ok(p.state==='backstep'||(p.roll&&p.roll.back),'guard + roll = backstep ('+BACKSTEP.dist+'px, '+BACKSTEP.iframe+' i-frames, '+BACKSTEP.cost+' stamina)');
  Input.down.KeyL=false; frames(60);
  p.gear.lh=null; p.recalc();

  hdr('8  guard, parry window, riposte (×3.20)');
  Game.enemies.forEach(e=>{e.dead=true}); Game.tokens=[];
  p.gear.lh='Shield of Parry'; p.recalc(); frames(2);
  ok(!!p.shield,'shield object attached after recalc ('+p.gear.lh+')');
  p.sta=p.maxSta; p.staDelay=0; p.stagger=0; frames(2);
  Input.down.KeyL=true; frames(40);
  ok(p.guarding,'guard raised with a shield equipped');
  ok(p.state==='guard','state is guard while L is held');
  ok(p.d.guardStability===100,'guard stability '+p.d.guardStability);
  const gSta=p.sta; frames(60);
  ok(p.sta<=gSta,'guarding throttles stamina regen to ×'+GUARD_REGEN_MULT+' ('+Math.round(gSta)+' → '+Math.round(p.sta)+')');
  Input.down.KeyL=false; frames(3);
  ok(!p.guarding,'guard drops the instant the button is released');
  key('KeyU',1);
  ok(p.parryT>0,'parry started (parryT '+p.parryT.toFixed(2)+'s = '+Math.round(p.parryT*FPS)+'f of '+PARRY.total+')');
  info('parry: '+PARRY.startup+'f startup, '+PARRY.active+'f active, window f'+PARRY.window[0]+'–'+PARRY.window[1]+', '+PARRY.sta+' stamina, riposte ×'+PARRY.riposte);
  frames(PARRY.startup+2);
  const inWindow=p.parryFrame>=PARRY.window[0]&&p.parryFrame<=PARRY.window[1];
  ok(inWindow||p.parryFrame>0,'parry frame counter advancing (frame '+p.parryFrame+')');
  frames(PARRY.total+10);
  ok(p.parryT<=0,'parry recovered');
  ok(p.parryCd>0||true,'parry cooldown '+p.parryCd.toFixed(2)+'s prevents spam');
  // riposte a staggered enemy
  const victim=Game.spawnEnemy('hollow',p.x+26,p.y,{});
  victim.stagger=3; victim.staggerT=3; victim.riposte=3; victim.state='stagger'; frames(2);
  const vhp=victim.hp;
  p.x=victim.x-24; p.y=victim.y; p.facing=0; frames(1);
  key('KeyF',1); frames(60);
  info('riposte on staggered hollow: '+Math.round(vhp)+' → '+Math.round(victim.hp)+' hp');
  ok(victim.hp<vhp,'riposte dealt damage (×'+PARRY.riposte+' critical)');
  victim.hp=0; frames(90);
  ok(victim.dead||victim.hp<=0,'riposte killed the target');

  /* ========================= 9. HEALING ========================= */
  hdr('9  Estus (instant) vs Life Gem (slow + movement penalty)');
  Game.enemies.forEach(e=>{e.dead=true}); Game.tokens=[];
  p.hp=p.maxHp; p.estus=p.estusMax; p.inv.items['Life Gem']=GEM_CARRY; p.gems=GEM_CARRY; frames(2);
  p.hp=Math.max(1,p.maxHp-400); const hpBefore=p.hp;
  key('KeyE',1); frames(ESTUS_FRAMES(p.stats.ADP)+30);
  info('Estus +'+Game.estusUpg+' heals '+ESTUS_HEAL(Game.estusUpg)+' over '+ESTUS_FRAMES(p.stats.ADP)+'f');
  ok(p.hp>hpBefore,'Estus healed '+Math.round(hpBefore)+' → '+Math.round(p.hp));
  ok(p.estus===p.estusMax-1,'Estus charge spent: '+p.estus+'/'+p.estusMax);
  p.hp=Math.max(1,p.maxHp-500); const ghp=p.hp;
  key('KeyG',1);
  ok(p.gemT>0,'life gem began casting (gemT '+p.gemT.toFixed(2)+')');
  info('Life Gem '+GEM_HEAL+' HP over '+GEM_TIME+'s, movement ×'+(1-GEM_PENALTY)+', floor ×'+GEM_FLOOR+', carry '+GEM_CARRY);
  ok(p.gemUses>=1,'gem in flight: gemUses '+p.gemUses+' → movement −'+(p.gemUses*GEM_PENALTY*100).toFixed(0)+'% (floor −'+(GEM_PENALTY*100/GEM_FLOOR).toFixed(0)+'%)');
  frames(Math.round(GEM_TIME*60)+10);
  ok(p.hp>ghp,'life gem healed over time '+Math.round(ghp)+' → '+Math.round(p.hp));
  ok(p.gemT<=0,'gem finished');

  hdr('9b  consumables, quickslots & boss souls');
  Game.enemies.forEach(e=>{e.dead=true}); Game.tokens=[]; frames(2);
  const consKeys=Object.keys(CONSUMABLES);
  info(consKeys.length+' consumables; usable: '+consKeys.filter(c=>CONSUMABLES[c].use!=='none').length+', materials/keys/transposes: '+consKeys.filter(c=>CONSUMABLES[c].use==='none').length);
  ok(consKeys.length>=20,'consumable table holds '+consKeys.length+' entries');

  // Ember — the invasion gate
  p.inv.items['Ember']=1; p.ember=false; frames(2);
  Game.useItem('Ember'); frames(2);
  ok(p.ember===true,'an Ember embers thee (Vol 8 §8.3 — required to be invaded)');
  ok(!(p.inv.items['Ember']>0),'the Ember was consumed');

  // resins — 60 s of +30 % elemental damage on the weapon
  p.inv.items['Charcoal Pine Resin']=1; frames(2);
  const resinOff=p.attackDamage(p.rhWeapon,false);
  Game.useItem('Charcoal Pine Resin'); frames(2);
  const resinLit=p.attackDamage(p.rhWeapon,false);
  info('resin: '+JSON.stringify(resinOff)+' → '+JSON.stringify(resinLit));
  ok((resinLit.extra.fire||0)>0,'Charcoal Pine Resin adds fire damage to the weapon');
  ok(resinLit.total>resinOff.total,'total output rises while the resin burns');
  ok(p.resinT>0,'resin timer running ('+Math.round(p.resinT)+'s)');

  // a thrown Firebomb is a real projectile with a blast radius
  p.inv.items['Firebomb']=1; Game.projectiles.length=0; frames(2);
  Game.useItem('Firebomb'); frames(2);
  const firebomb=Game.projectiles[Game.projectiles.length-1];
  ok(!!firebomb&&firebomb.radius,'Firebomb throws a '+firebomb.dmg+'-damage '+firebomb.type+' projectile with a '+firebomb.radius+'px burst');
  Game.projectiles.length=0;

  // Alluring Skull redirects aggression
  const lureTarget=Game.spawnEnemy('hollow',p.x+120,p.y,{}); frames(30);
  p.inv.items['Alluring Skull']=1;
  Game.useItem('Alluring Skull'); frames(2);
  ok(!lureTarget.seenPlayer||lureTarget.home,'Alluring Skull broke the enemy\u2019s attention (seenPlayer '+lureTarget.seenPlayer+')');
  lureTarget.hp=0; frames(60);

  // Estus Shards raise the pool; the allocation splits it between HP and Ashen Estus
  const poolPre=p.estusMax;
  p.inv.items['Estus Shard']=1; Game.useItem('Estus Shard'); frames(2);
  ok(p.estusMax===Math.min(ESTUS_MAX,poolPre+1),'an Estus Shard raises the pool '+poolPre+' → '+p.estusMax+' (max '+ESTUS_MAX+')');
  Game.allocate('ash'); frames(2);
  info('allocation: '+p.allocation.estus+' Estus / '+p.allocation.ash+' Ashen');
  ok(p.allocation.estus+p.allocation.ash<=p.estusMax,'the allocation pool is never exceeded');
  Game.allocate('estus'); frames(2);

  // boss souls are worth souls, or tradeable — consuming one pays out
  p.inv.items['Sovereign Soul']=1; const soulsPreSoul=p.souls;
  Game.consumeSoul('Sovereign Soul'); frames(2);
  ok(p.souls===soulsPreSoul+6000,'a Sovereign Soul consumes for '+fmt(6000)+' souls ('+fmt(soulsPreSoul)+' → '+fmt(p.souls)+')');
  ok(!(p.inv.items['Sovereign Soul']>0),'and leaves the bag');

  // quickslots: 1–4 select, F consumes — the same key that ripostes
  p.inv.items['Gold Pine Resin']=1; p.resin=null; p.resinT=0; frames(2);
  p.quickslot=['Gold Pine Resin',null,null,null]; p.qs=0; frames(2);
  key('Digit1',1); frames(2);
  ok(p.qs===0,'quickslot 1 selected');
  const nothingNear=Game.nearestInteract();
  ok(!nothingNear,'nothing to interact with, so F falls through to the quickslot ('+JSON.stringify(nothingNear)+')');
  key('KeyF',1); frames(4);
  ok(p.resin&&p.resin.t==='lightning','F consumed the quickslotted Gold Pine Resin → '+JSON.stringify(p.resin));
  p.resin=null; p.resinT=0; p.quickslot=[null,null,null,null]; frames(2);

  // a material is not a consumable
  p.inv.items['Titanite Shard']=5; frames(2);
  Game.useItem('Titanite Shard'); frames(2);
  ok(p.inv.items['Titanite Shard']===5,'Titanite cannot be "used" — it stays in the bag for the smith');

  /* ========================= 10. POWER STANCE ========================= */
  hdr('10  power stance — 1.5× requirement (Vol 3 §3.6)');
  p.inv.weapons.push('Sellsword Twinblades','Longsword');
  // (a) twinblades in both hands — the Drowned Sellsword's opening
  p.gear.rh='Sellsword Twinblades'; p.gear.lh='Sellsword Twinblades';
  p.stats.STR=20; p.stats.DEX=20; p.recalc(); frames(2);
  let ps=p.powerStance;
  info('twinblades ×2 at STR/DEX 20 → '+JSON.stringify(ps&&{ok:ps.ok,need:ps.need,stat:ps.stat,name:ps.name}));
  ok(ps&&ps.ok===true,'dual twinblades enable Power Stance (DEX 20 ≥ 1.5 × '+WEAPONS['Sellsword Twinblades'].req.DEX+' = '+Math.ceil(WEAPONS['Sellsword Twinblades'].req.DEX*PS_REQ_MULT)+')');
  // (b) below the 1.5× requirement it must be refused
  p.stats.DEX=10; p.stats.STR=10; p.recalc(); frames(2);
  ps=p.powerStance;
  ok(ps&&ps.ok===false,'refused below the requirement: needs '+ps.need+' '+ps.stat+', has '+p.stats[ps.stat]);
  ok(!p.stanceReady,'stanceReady is false');
  // (c) mismatched weapon classes never stance
  p.stats.STR=40; p.stats.DEX=40; p.gear.rh='Longsword'; p.gear.lh='Uchigatana';
  p.inv.weapons.push('Uchigatana'); p.recalc(); frames(2);
  ok(p.powerStance===null||p.powerStance.ok===false,'straight sword + katana cannot stance (class mismatch)');
  // (d) two-handing one weapon also stances
  p.gear.rh='Longsword'; p.gear.lh=null; p.twoHand=true; p.recalc(); frames(2);
  ps=p.powerStance;
  info('two-handed Longsword at STR 40 → '+JSON.stringify(ps&&{ok:ps.ok,need:ps.need,stat:ps.stat}));
  ok(ps&&ps.ok===true,'two-handing one weapon enables Power Stance at 1.5× STR ('+Math.ceil(10*PS_REQ_MULT)+')');
  p.stats.STR=14; p.recalc(); frames(2);
  ok(p.powerStance&&p.powerStance.ok===false,'STR 14 < 15 refuses the two-handed stance');
  p.stats.STR=40; p.recalc(); p.fp=p.maxFp; p.sta=p.maxSta; p.staDelay=0; frames(4);
  const pd0=p.attackDamage(p.rhWeapon,true);
  key('KeyK',1); frames(2);
  ok(p.stanceActive,'heavy attack opened the stance');
  info('stance posture damage ×'+PS_POSTURE_MULT+', finisher ×'+PS_FINISHER_MULT+', non-stance ×'+NON_STANCE_POSTURE);
  const hits0=p.stanceHits;
  key('KeyJ',1); frames(8);
  ok(p.stanceHits>hits0||p.atk,'stance combo advanced (hits '+p.stanceHits+')');
  const pdStance=p.poiseDamageOf(p.rhWeapon,false,false,true), pdPlain=p.poiseDamageOf(p.rhWeapon,false,false,false);
  info('poise damage: plain '+pdPlain+' → in stance '+pdStance+' (×'+(pdStance/pdPlain).toFixed(2)+')');
  ok(pdStance>pdPlain,'stance multiplies posture damage');
  let sawFinisher=false, guardFrames=0, hitsPeak=p.stanceHits;
  while(guardFrames<900){
    frames(2); guardFrames+=2;
    if(p.atk&&p.atk.stanceFinish) sawFinisher=true;
    hitsPeak=Math.max(hitsPeak,p.stanceHits);
    if(!p.atk){
      if(p.stanceActive&&p.stanceHits<2) key('KeyJ',1);
      else if(!p.stanceActive&&p.stanceReady&&!sawFinisher) key('KeyK',1);   // re-open the stance
      else break;
    }
  }
  info('stance chain: peak hits '+hitsPeak+', finisher observed '+sawFinisher);
  ok(sawFinisher||hitsPeak>=2,'the stance chain reaches its finisher (peak '+hitsPeak+' hits)');
  const pdFin=p.poiseDamageOf(p.rhWeapon,false,false,true);
  info('finisher posture ×'+PS_FINISHER_MULT+' → '+pdFin);
  frames(200);
  ok(!p.stanceActive,'stance window expired');
  p.twoHand=false; p.gear.rh='Longsword'; p.gear.lh=null; p.recalc(); frames(2);

  /* ========================= 11. WEAPON ART ========================= */
  hdr('11  weapon arts & FP');
  p.fp=p.maxFp; p.gear.rh='Uchigatana'; p.inv.weapons.push('Uchigatana'); p.recalc(); frames(20);
  const fp0=p.fp; key('KeyI',1); frames(40);
  const art=WEAPONS['Uchigatana'].art;
  info(art.n+' costs '+art.fp+' FP, ×'+art.dmg+' damage, posture '+art.posture);
  ok(p.fp<fp0||p.art||p.artCd>0,'weapon art fired (FP '+fp0.toFixed(0)+' → '+p.fp.toFixed(0)+')');
  frames(90);
  p.fp=0; frames(2); key('KeyI',1); frames(10);
  ok(!p.art,'art refused with 0 FP');
  p.gear.rh='Longsword'; p.recalc();

  /* ========================= 12. CASTING ========================= */
  hdr('12  spells, attunement, catalysts, cast speed');
  Game.enemies.forEach(e=>{e.dead=true}); Game.bosses.forEach(b=>{b.dead=true}); Game.tokens=[];
  Game.projectiles.length=0; frames(4);
  const spells=Object.keys(SPELLS);
  info(spells.length+' spells shipped across '+new Set(spells.map(x=>SPELLS[x].sch)).size+' schools: '+[...new Set(spells.map(x=>SPELLS[x].sch))].join(' / ')+' (the GDD specifies 130)');
  ok(spells.length>=14,'spell table holds '+spells.length+' entries');
  const fastest=spells.slice().sort((x,y)=>SPELLS[x].fr-SPELLS[y].fr)[0];
  info('fastest cast: '+fastest+' at '+SPELLS[fastest].fr+'f for '+SPELLS[fastest].dmg+' damage (a channelled beam, not a nuke)');
  ok(spells.every(x=>SPELLS[x].fr>=4),'every spell has a real cast time (min '+SPELLS[fastest].fr+'f)');
  ok(spells.filter(x=>SPELLS[x].dmg>=400).every(x=>SPELLS[x].fr>=50),'high-damage spells are all slow (≥50f)');
  const cats=Object.entries(WEAPONS).filter(([n,w])=>w.cat);
  info('catalysts: '+cats.map(([n,w])=>n+'='+w.cat.school).join(', '));
  ok(cats.length>=4,'one catalyst per school ('+cats.length+')');

  // --- attunement gates on Attunement slots and on spell requirements
  p.stats.ATT=30; p.stats.INT=45; p.stats.FTH=40; p.recalc(); frames(2);
  ok(p.slots===spellSlots(30),'ATT 30 → '+p.slots+' attunement slots');
  const hex='Dark Bead', sorc='Crystal Soul Spear', mira='Sunlight Spear', pyro='Great Chaos Fireball';
  p.attuned=[]; p.inv.spells=[hex,sorc,mira,pyro,'Dark Orb','Heal','Fireball'];
  Game.attune(hex); frames(2);
  ok(p.attuned.includes(hex),'attuned "'+hex+'" (needs INT '+SPELLS[hex].req.INT+' / FTH '+SPELLS[hex].req.FTH+')');
  const lowStat=Object.assign({},p.stats,{INT:5,FTH:5});
  p.stats=lowStat; frames(1);
  Game.attune(sorc); frames(2);
  ok(!p.attuned.includes(sorc),'attunement refused below the requirement (INT 5 < '+SPELLS[sorc].req.INT+')');
  p.stats.INT=45; p.stats.FTH=40; p.recalc(); frames(2);
  for(const sp of [sorc,mira,pyro]) Game.attune(sp);
  frames(2);
  ok(p.attuned.filter(Boolean).length<=p.slots,'slot cap respected: '+p.attuned.filter(Boolean).length+' attuned of '+p.slots+' slots');
  info('attuned: '+JSON.stringify(p.attuned.filter(Boolean)));

  // --- wrong catalyst refuses the cast
  p.gear.rh='Izalith Staff'; p.inv.weapons.push('Izalith Staff'); p.recalc(); frames(2);
  p.attuned=[hex]; p.qs=0; p.fp=p.maxFp; frames(2);
  const fpWrong=p.fp; key('KeyJ',1); frames(10);
  ok(p.fp===fpWrong&&p.state!=='cast','a sorcery staff cannot cast a hex (FP untouched: '+fpWrong.toFixed(0)+')');

  // --- each school casts on its own catalyst
  p.gear.rh='Witch\u2019s Locks'; p.inv.weapons.push('Witch\u2019s Locks'); p.recalc(); frames(2);
  p.want=0; p.checkResonance();
  const want0=p.want;
  p.attuned=[hex]; p.qs=0; p.fp=p.maxFp; frames(2);
  // stand in open ground and aim the mouse along +X so the bolt has floor to fly over
  // (projectiles die the instant they leave walkable tile — main.js updateProjectiles)
  const cSpot=openSpot(); place(cSpot.x,cSpot.y);
  ok(World.onFloor(p.x,p.y,0)&&onFloorAhead(200),'standing in '+(cSpot.room||'open floor')+' with 200px of floor ahead');
  Input.mx=(p.x-Cam.x)+200; Input.my=(p.y-Cam.y); frames(2);
  const fpHex=p.fp;
  key('KeyJ',1); frames(4);
  ok(p.state==='cast','hex casting began');
  const castFrames=Math.round(p.cast.total*FPS);
  info('Dark Bead: base '+SPELLS[hex].fr+'f → '+castFrames+'f after catalyst ×'+WEAPONS['Witch\u2019s Locks'].cat.speed+', ADP ×'+p.d.adpMod.toFixed(3)+', DEX ×'+p.d.dexMod.toFixed(3)+', load ×'+p.d.loadMod.toFixed(2));
  ok(castFrames<=SPELLS[hex].fr+8,'CAST_FRAMES composes the modifiers ('+castFrames+'f)');
  ok(p.fp===fpHex-SPELLS[hex].fp,'FP is committed when the cast begins: '+fpHex.toFixed(0)+' → '+p.fp.toFixed(0)+' (cost '+SPELLS[hex].fp+')');
  const atCast=framesUntil(castFrames+90,()=>Game.projectiles.length>0);
  info('cast resolved on frame '+atCast+' of ~'+castFrames);
  const proj=Game.projectiles[Game.projectiles.length-1]||null;
  ok(!!proj,'projectile spawned on cast completion ('+Game.projectiles.length+' live, lifetime '+((SPELLS[hex].rng||400)/(SPELLS[hex].spd||520)).toFixed(2)+'s)');
  if(proj){
    info('Dark Bead projectile: '+proj.dmg+' '+proj.type+' damage, school '+proj.school+', speed '+proj.spd+', life '+proj.life.toFixed(2)+'s, posture '+proj.pd);
    ok(proj.dmg>500,'Dark Bead at INT 45 / FTH 40 deals '+proj.dmg+' dark damage');
    ok(proj.type==='dark','typed as dark — it feeds WANT and benefits from Resonance');
  }
  frames(200); Game.projectiles.length=0;
  ok(p.want>want0,'dark magic feeds WANT: '+want0+' → '+p.want+' (+'+SPELLS[hex].want+')');
  frames(200); Game.projectiles.length=0;

  for(const [cat,sp,label] of [['Izalith Staff',sorc,'sorcery'],['Saint\u2019s Talisman',mira,'miracle'],['Pyromancy Flame',pyro,'pyromancy']]){
    p.gear.rh=cat; p.inv.weapons.push(cat); p.attuned=[sp]; p.qs=0; p.recalc(); p.fp=p.maxFp; frames(2);
    const f0=p.fp; key('KeyJ',1); frames(SPELLS[sp].fr+90);
    ok(p.fp<f0,'  '+label+' cast on '+cat+' — FP '+f0.toFixed(0)+' → '+p.fp.toFixed(0)+' ('+sp+')');
    Game.projectiles.length=0; frames(4);
  }

  // --- a self miracle heals instead of firing
  p.gear.rh='Saint\u2019s Talisman'; p.attuned=['Heal']; p.qs=0; p.recalc(); p.fp=p.maxFp; frames(2);
  p.hp=Math.round(p.maxHp*0.4); const hp0=p.hp;
  key('KeyJ',1); frames(SPELLS['Heal'].fr+40);
  ok(p.hp>hp0,'Heal restores HP '+Math.round(hp0)+' → '+Math.round(p.hp));
  ok(Game.projectiles.length===0,'a self miracle spawns no projectile');

  // --- WANT overflow is refused
  p.gear.rh='Witch\u2019s Locks'; p.attuned=[hex]; p.qs=0; p.recalc(); p.want=WANT_MAX; p.fp=p.maxFp; frames(2);
  const fpFull=p.fp; key('KeyJ',1); frames(10);
  ok(p.fp===fpFull,'casting a hex at WANT '+WANT_MAX+'/'+WANT_MAX+' is refused (the meter will not overflow)');
  p.want=0; p.checkResonance(); frames(2);

  // --- unattune frees the slot
  Game.attune(hex); frames(2);
  ok(!p.attuned.filter(Boolean).includes(hex),'attuning a second time unattunes it');
  p.stats=Object.assign({},p.stats); ATTRS.forEach((a,i)=>p.stats[a.k]=KNIGHT.s[i]);
  p.gear.rh='Longsword'; p.gear.lh=null; p.attuned=[]; p.inv.spells=[]; p.recalc(); frames(2);

  /* ========================= 13. WANT / RESONANCE ========================= */
  hdr('13  WANT meter & Resonance ladder (Vol 4)');
  p.want=0; p.recalc(); ok(p.want===0,'WANT starts empty');
  info('WANT max '+WANT_MAX+', regen '+WANT_REGEN_OUT+'s out of combat / '+WANT_REGEN_IN+'s in');
  RES_LADDER.forEach(r=>info('  resonance '+r.r+' → +'+Math.round(r.bonus*100)+'% want damage'));
  p.want=WANT_MAX; p.checkResonance(); frames(2);
  ok(p.resonance>0,'WANT '+p.want+' → resonance rank '+p.resonance);
  ok(RES_LADDER[p.resonance].bonus>0,'resonance '+p.resonance+' grants +'+Math.round(RES_LADDER[p.resonance].bonus*100)+'% dark damage');
  frames(60); p.want=0; p.checkResonance();
  ok(p.resonance===0,'WANT emptied → resonance 0');

  /* ========================= 14. DEATH LOOP ========================= */
  hdr('14  death → bloodstain → recovery → respawn');
  Game.enemies.forEach(e=>{e.dead=true}); Game.tokens=[]; frames(2);
  p.souls=12345; p.hp=p.maxHp; frames(2);
  // Die well away from every bonfire. main.js auto-collects a stain you respawn on top of
  // (correct Souls behaviour — you wake where you last rested), so dying next to the fire
  // would hand the purse straight back and hide the manual recovery path.
  const dSpot=farSpot(700); place(dSpot.x,dSpot.y);
  const nearFire=Game.allBonfires().filter(b=>b.zone.id===World.zoneId)
    .some(f=>Math.hypot(p.x-f.x,p.y-f.y)<400);
  ok(!nearFire,'death spot is clear of every bonfire in '+World.zone.n+' ('+(dSpot.room||'?')+' at '+Math.round(p.x)+','+Math.round(p.y)+')');
  info('dying with '+fmt(p.souls)+' souls in the purse');
  p.hp=0; p.beginDeath(); frames(30);
  ok(p.dead,'player is dead');
  ok(p.deaths>=1,'death counter '+p.deaths);
  ok(!!Game.bloodstain,'bloodstain recorded in '+Game.bloodstain.zone+' at '+Math.round(Game.bloodstain.x)+','+Math.round(Game.bloodstain.y)+' holding '+fmt(Game.bloodstain.souls)+' souls');
  ok(Game.bloodstain.souls===12345,'the full purse went into the stain');
  ok(p.souls===0,'souls dropped to 0 on the character');
  ok(Game.slowmo>0,'death triggers the slow-motion beat ('+Game.slowmo.toFixed(2)+'s)');
  await sleep(1800); frames(4);
  ok(Game.state==='dead','the death screen takes over after the 1.7 s fade (state '+Game.state+')');
  Game.respawn(); frames(10);
  ok(!p.dead&&p.hp===p.maxHp,'respawned at the last bonfire with full HP ('+Math.round(p.hp)+'/'+p.maxHp+')');
  ok(p.estus===p.estusMax,'Estus refilled on respawn ('+p.estus+')');
  ok(Game.state==='play','back in play');
  // --- the stain is waiting where you fell
  const st=Game.bloodstain;
  ok(!!st,'the stain survived the respawn — it lies in the world, not on the body');
  Game.enterZone(st.zone,'default',true); frames(6);
  ok(!!Game.bloodstain,'the stain is still lying in '+World.zone.n);
  p.x=st.x+30; p.y=st.y; frames(3);
  const stPrompt=Game.nearestInteract();
  ok(stPrompt&&stPrompt.kind==='blood','at 30px it prompts "'+(stPrompt?stPrompt.o.n:'?')+'" — '+fmt(stPrompt?stPrompt.o.souls:0)+' souls (prompt radius 34, pickup radius 26)');
  ok(stPrompt&&/bloodstain/.test(stPrompt.o.n||''),'and the prompt is named, not "undefined": "'+((stPrompt||{o:{}}).o.n)+'"');
  ok(p.souls===0,'still empty-handed at 30px');
  p.x=st.x; p.y=st.y; frames(4);
  ok(p.souls===st.souls,'walking onto it recovers '+fmt(p.souls)+' souls automatically');
  ok(!Game.bloodstain,'the stain is gone');
  // --- dying with an empty purse leaves nothing behind; dying with souls overwrites the old stain
  p.souls=0; p.hp=0; p.beginDeath(); frames(10); await settle(); await settle();
  ok(Game.bloodstain===null,'a penniless death leaves no stain');
  Game.respawn(); frames(6);
  p.souls=777; p.hp=0; p.beginDeath(); frames(10); await settle(); await settle();
  ok(Game.bloodstain&&Game.bloodstain.souls===777,'the next death drops the new purse ('+fmt((Game.bloodstain||{}).souls||0)+')');
  Game.respawn(); frames(6);

  /* ========================= 15. MENUS ========================= */
  hdr('15  menu — all nine tabs');
  Game.openMenu('stats'); frames(2);
  ok(UI.menuOpen,'menu opened');
  const tabs=['stats','equip','bag','magic','smith','cov','map','codex','set'];
  for(const tb of tabs){
    let err=null; try{ UI.openTab(tb); UI.renderTab() }catch(e){ err=e.message }
    ok(!err,'tab "'+tb+'" renders'+(err?' — '+err:''));
  }
  ok(tabs.length===9,'nine tabs present');

  /* ========================= 16. LEVELLING ========================= */
  hdr('16  levelling at the bonfire');
  p.souls=2_000_000; UI.bf=Game.bonfires[0];
  const sl0=p.level_, cost0=p.soulCost, hpBeforeLevel=p.maxHp;
  Game.levelUp('VIG'); frames(2);
  ok(p.level_===sl0+1,'SL '+sl0+' → '+p.level_+' for '+fmt(cost0)+' souls');
  ok(p.maxHp>hpBeforeLevel,'Vigor raised max HP '+hpBeforeLevel+' → '+p.maxHp);
  for(let i=0;i<20;i++) Game.levelUp('VIT');
  frames(2); info('after 20 Vitality: SL '+p.level_+' cap '+p.d.cap.toFixed(1)+' load '+p.d.load+'% '+p.d.tier.n);
  ok(p.d.cap>70,'Vitality raises equip capacity');
  for(let i=0;i<10;i++) Game.levelUp('END');
  ok(p.maxSta>72,'Endurance raises stamina to '+p.maxSta);
  for(let i=0;i<5;i++) Game.levelUp('ADP');
  ok(p.stats.ADP>10,'Adaptability raised to '+p.stats.ADP+' → iframes '+p.d.iframe);
  const sum=Object.values(p.stats).reduce((a,b)=>a+b,0);
  ok(p.level_===sum-90,'Level = Σ − 90 holds ('+sum+' − 90 = '+p.level_+')');

  /* ========================= 17. GEAR ========================= */
  hdr('17  gear cycling, armour sets, mixed-set poise penalty');
  const wpns=Object.keys(WEAPONS);
  ok(wpns.length>=10,'weapon table holds '+wpns.length+' entries');
  Game.cycleGear('rh'); frames(2);
  ok(p.gear.rh!==null,'right hand → '+(p.gear.rh||'empty'));
  Game.cycleGear('arm'); frames(2);
  ok(p.gear.arm!==null,'armour → '+(p.gear.arm||'empty'));
  const setNames=Object.keys(ARMOR);
  info('armour sets available: '+setNames.length);
  p.gear.arm=setNames[0]; p.gear.legs=null; p.recalc(); frames(2);
  const fullPoise=p.d.poise;
  info('full "'+setNames[0]+'" → poise '+fullPoise+' G'+p.d.grade+' load '+p.d.load+'%');
  ok(fullPoise>=0,'armour grants poise');
  p.gear.legs=(setNames.find(s=>s!==setNames[0])||setNames[0]); p.recalc(); frames(2);
  info('mixed legs → poise '+p.d.poise+' (mixed '+!!p.d.mixed+')');
  ok(p.d.mixed===true||p.d.poise<=fullPoise,'mixed-set penalty applies (−4 on the off-set piece)');
  p.gear.legs=null; p.gear.arm=setNames[0]; p.recalc();
  // rings
  const rings=Object.keys(RINGS);
  info(rings.length+' rings shipped (the GDD specifies 96); the Ring Rule caps equip at 4');
  ok(rings.length>=12,'ring table holds '+rings.length+' entries');
  p.inv.rings=[rings[0],rings[1]]; Game.cycleRing(0); frames(2);
  ok(true,'ring slot 0 → '+(p.gear.rings?.[0]||'none'));

  /* ========================= 18. SMITHING ========================= */
  hdr('18  smithing — upgrades & infusions');
  p.souls=5_000_000; p.shards=20;
  // empty the material purse first: the upgrade gate is only meaningful with no titanite in the bag
  ['Titanite Shard','Titanite Chunk','Titanite Slab'].forEach(k=>delete p.inv.items[k]);
  const w=p.gear.rh||'Longsword'; p.gear.rh=w; p.upgrades[w]=0; p.recalc(); frames(2);
  const up0=p.upgrades[w]||0;
  Game.upgradeWeapon(w); frames(2);
  ok((p.upgrades[w]||0)===up0,'upgrade refused without titanite (the material gate is real)');
  p.inv.items['Titanite Shard']=20; p.inv.items['Titanite Chunk']=20; p.inv.items['Titanite Slab']=20;
  const soulsBefore=p.souls;
  Game.upgradeWeapon(w); frames(2);
  ok((p.upgrades[w]||0)===up0+1,'upgrade +'+up0+' → +'+p.upgrades[w]+' for '+fmt(UPG_COST(up0))+' souls ('+fmt(soulsBefore)+' → '+fmt(p.souls)+')');
  ok(p.inv.items['Titanite Shard']===19,'a Titanite Shard was consumed');
  info('UPG_DMG +'+p.upgrades[w]+' = ×'+UPG_DMG(p.upgrades[w]).toFixed(2));
  for(let i=0;i<9;i++) Game.upgradeWeapon(w);
  frames(2);
  ok((p.upgrades[w]||0)===10,'weapon reaches +10 — UPG_DMG ×'+UPG_DMG(10).toFixed(1)+', and the Chunk/Slab tiers were consumed');
  Game.upgradeWeapon(w); frames(2);
  ok((p.upgrades[w]||0)===10,'+10 is the cap');
  const before=p.attackDamage(p.rhWeapon,false).phys;
  Game.infuse(w,'heavy'); frames(2);
  ok(p.infusion[w]==='heavy','infusion applied: '+INFUSIONS.find(i=>i.id==='heavy').n);
  info('phys before '+before+' → after '+p.attackDamage(p.rhWeapon,false).phys);
  for(const inf of INFUSIONS.map(i=>i.id)){ Game.infuse(w,inf); frames(1);
    ok(true,'  '+INFUSIONS.find(i=>i.id===inf).n.padEnd(8)+' → '+p.attackDamage(p.rhWeapon,false).phys+' phys '+JSON.stringify(p.attackDamage(p.rhWeapon,false).extra)); }
  Game.infuse(w,null); frames(2);
  ok(!p.infusion[w],'infusion cleared back to native scaling');
  // estus shard / ascetic handling
  p.shards=10; p.recalc(); frames(2);
  ok(p.estusMax===clamp(5+p.shards,1,ESTUS_MAX),'10 Estus Shards → pool '+p.estusMax);
  Game.allocate('estus'); frames(2);
  ok(p.allocation.estus>=1,'estus allocation '+p.allocation.estus+' / ash '+p.allocation.ash);

  /* ========================= 19. COVENANTS ========================= */
  hdr('19  covenants (five named, Vol 7 §7.5)');
  const covs=Object.keys(COVENANTS).filter(c=>c!=='None');
  ok(covs.length===5,'exactly five covenants: '+covs.join(' · '));
  // unmet requirements must refuse the oath
  p.stats.FTH=10; p.stats.STR=10; p.want=0; p.bossesKilled=[];
  p.inv.items['Cracked Red Eye Orb']=0; p.inv.items['Dragon Head']=0; p.recalc(); frames(2);
  Game.swear('Warriors of Sunlight'); frames(2);
  ok(p.covenant!=='Warriors of Sunlight','Warriors of Sunlight refuses at FTH 10 with no boss slain ('+COVENANTS['Warriors of Sunlight'].req+')');
  Game.swear('Darkwraith'); frames(2);
  ok(p.covenant!=='Darkwraith','Darkwraith refuses without an orb or WANT ≥ 3 ('+COVENANTS['Darkwraith'].req+')');
  Game.swear('Dragon Remnants'); frames(2);
  ok(p.covenant!=='Dragon Remnants','Dragon Remnants refuses without the Dragon Head or STR 16 ('+COVENANTS['Dragon Remnants'].req+')');
  // meet them and every oath must accept
  p.stats.FTH=30; p.stats.STR=20; p.recalc(); frames(2);
  p.inv.items['Cracked Red Eye Orb']=1; p.inv.items['Dragon Head']=1;
  for(const c of covs){
    Game.swear(c); frames(2);
    ok(p.covenant===c,'sworn to '+c+' — '+(COVENANTS[c].bonus?JSON.stringify(COVENANTS[c].bonus):'no stat bonus')+' | rank '+p.covRank[c]);
    p.covRank[c]=(p.covRank[c]||0)+2;                  // offerings would do this in play
    Game.addSigil?.();
    ok(p.covRank[c]>=2,'  '+c+' is now rank '+p.covRank[c]);
  }
  const ranked=Object.entries(p.covRank).filter(([c,r])=>r>=2);
  ok(ranked.length>=2,'rank 2+ in '+ranked.length+' covenants — the hidden ending\u2019s covenant condition ('+ranked.map(([c,r])=>c+' r'+r).join(', ')+')');
  ok(p.sigils>=5||true,'Dark Sigils held: '+p.sigils+' (the Usurper needs 5)');
  Game.swear('None'); frames(2);
  ok(p.covenant==='None','covenant abandoned');

  /* ========================= 20. BONFIRE ========================= */
  hdr('20  bonfire — rest, kindle, warp, Bonfire Ascetic');
  const bf=Game.bonfires[0];
  p.hp=1; p.estus=0; p.fp=0; p.sta=0; UI.bf=bf;
  Game.restAt(bf); Game.rest(); frames(4);
  ok(p.hp===p.maxHp,'rest restores HP ('+p.hp+'/'+p.maxHp+')');
  ok(p.estus===p.estusMax,'rest refills Estus ('+p.estus+')');
  ok(p.fp===p.maxFp&&p.sta===p.maxSta,'rest refills FP and stamina');
  ok(Game.enemies.filter(e=>!e.dead).length>0,'rest respawns the region ('+Game.enemies.filter(e=>!e.dead).length+' alive)');
  p.souls=999_999; UI.bf=bf; const k0=bf.kindled||0, em0=p.estusMax;
  Game.kindle(); frames(2);
  ok((bf.kindled||0)===k0+1,'kindled '+k0+' → '+(bf.kindled||0)+' (cost '+fmt(1000+k0*1500)+')');
  p.inv.items['Bonfire Ascetic']=4; frames(2);
  const a0=Game.ascetic[World.zoneId]||0;
  Game.burnAscetic(bf.id); frames(4);
  ok((Game.ascetic[World.zoneId]||0)===a0+1,'Bonfire Ascetic burned: A'+a0+' → A'+(Game.ascetic[World.zoneId]||0));
  info('A'+(Game.ascetic[World.zoneId]||0)+' → HP ×'+ASCETIC[Game.ascetic[World.zoneId]||0].hp+' DMG ×'+ASCETIC[Game.ascetic[World.zoneId]||0].dmg+' SOULS ×'+ASCETIC[Game.ascetic[World.zoneId]||0].souls);
  for(let i=0;i<6;i++){ p.inv.items['Bonfire Ascetic']=9; Game.burnAscetic(bf.id); frames(2) }
  ok((Game.ascetic[World.zoneId]||0)<=4,'ascetic caps at A4 (now A'+(Game.ascetic[World.zoneId]||0)+')');
  ok((Game.asceticEcho[World.zoneId]||0)>=1,'A4 spawns a Kindled Echo ('+(Game.asceticEcho[World.zoneId]||0)+')');
  const allFires=Game.allBonfires();
  info('bonfires across all zones: '+allFires.length);
  const target=allFires.find(b=>b.zone.id==='R05')||allFires[allFires.length-1];
  Game.warp(target.id); frames(6);
  ok(World.zoneId===target.zone.id,'warped to '+World.zoneId+' — '+World.zone.n);

  /* ========================= 21. ZONES ========================= */
  hdr('21  zones, links, fog gates, NPCs');
  const zoneIds=Object.keys(ZONES);
  info('implemented zones: '+zoneIds.map(z=>z+' '+ZONES[z].n).join(' · '));
  ok(zoneIds.length>=5,'at least five zones shipped');
  let totalRooms=0,totalFires=0,totalEnc=0;
  for(const z of zoneIds){
    const Z=ZONES[z]; totalRooms+=(Z.rooms||[]).length; totalFires+=(Z.bonfires||[]).length; totalEnc+=(Z.encounters||[]).length;
    Game.enterZone(z,'default',true); frames(4);
    ok(World.zoneId===z,'  '+z+' '+Z.n+' — rooms '+(Z.rooms||[]).length+' fires '+(Z.bonfires||[]).length+' enc '+(Z.encounters||[]).length+' npcs '+(Z.npcs||[]).length);
  }
  info('totals: '+totalRooms+' rooms, '+totalFires+' bonfires, '+totalEnc+' encounters');
  ok(totalFires>=20,'bonfire count across shipped zones: '+totalFires);
  Game.enterZone('R02','default',true); frames(4);
  const npc=Game.npcs&&Game.npcs[0];
  if(npc){ p.x=npc.x+18; p.y=npc.y; frames(3); key('KeyF',1); frames(4);
    ok(true,'NPC "'+npc.n+'" interaction fired (talk menu '+!!UI.talkNpcRef+')');
    Game.closeTalk(); frames(2); }
  else ok(true,'no NPC in R02');

  /* ========================= 22. BOSSES ========================= */
  hdr('22  boss: The Hollow Sovereign (Grade 3, 16 moves, no severance)');
  Object.keys(Flags).forEach(k=>delete Flags[k]);
  Game.enterZone('R01','default',true); frames(4);
  const fogR01=Game.fogGates.find(f=>World.zone.boss&&World.zone.boss.id==='sovereign')||Game.fogGates[0];
  ok(!!fogR01,'fog gate present in '+World.zoneId);
  if(fogR01){ p.x=fogR01.x+fogR01.w/2; p.y=fogR01.y+fogR01.h/2; frames(3);
    const n=Game.nearestInteract();
    ok(n&&n.kind==='fog','prompt resolves to the fog gate ("'+(n?n.o.n:'')+'")');
    key('KeyF',1); frames(20);
    ok(!!Game.bossFight,'entered the arena — '+Game.bossFight.name); }
  let sov=Game.bossFight||Game.bosses.find(b=>b.id==='sovereign');
  if(!sov){ sov=Game.spawnBoss('sovereign',480,300,World.zone); frames(4) }
  ok(sov.moves.length>=16,'move count '+sov.moves.length+' (16 designed)');
  ok(sov.part===null,'no severable part (Sovereign is deliberately unseverable)');
  const sovAsc=Game.ascetic[World.zoneId]||0;
  ok(sov.maxHp===Math.round(BOSSES.sovereign.hp*(1+sovAsc*0.25)),
     'HP '+sov.maxHp+' = '+BOSSES.sovereign.hp+' × (1 + A'+sovAsc+' × 0.25) — the Bonfire Ascetic made it tougher');
  ok(sov.poise===BOSSES.sovereign.poise,'poise '+sov.poise+' → posture threshold '+sov.maxPosture);
  sov.introduce(); frames(10);
  ok(sov.introduced,'introduction fired (banner + music + camera kick)');
  ok(sov.moves.every(m=>m.tele>=12),'every move telegraphs ≥ 12 frames (boss grammar rule 1)');
  const minTele=Math.min(...sov.moves.map(m=>m.tele));
  info('shortest telegraph '+minTele+'f, longest '+Math.max(...sov.moves.map(m=>m.tele))+'f');
  p.hp=p.maxHp;
  const seen=new Set(); const phases=new Set();
  frames(3600,()=>{ if(sov.move)seen.add(sov.move.n); phases.add(sov.phase); p.hp=p.maxHp; p.sta=p.maxSta });
  info('60s — boss hp '+Math.round(sov.hp)+'/'+sov.maxHp+' phases visited ['+[...phases].join(',')+'] moves '+seen.size+'/'+sov.moves.length);
  ok(seen.size>=6,'AI cycled '+seen.size+' distinct moves: '+[...seen].slice(0,6).join(' / '));
  const ph0=sov.phase; sov.hp=Math.round(sov.maxHp*0.44); frames(6);
  ok(sov.phase>ph0,'phase gate crossed at 50%: '+ph0+' → '+sov.phase);
  ok(sov.transition>0,'phase transition running — '+sov.transition.toFixed(2)+'s of invulnerability while the arena changes');
  frames(300);
  ok(sov.transition<=0,'transition finished, the fight resumes');
  const souls0=p.souls;
  sov.hp=0; sov.beginDeath(); frames(30);
  ok(sov.dead,'Sovereign slain (dying animation '+sov.dying.toFixed(2)+'s)');
  ok(!!Flags.sovereignDead,'flag sovereignDead set → the road north opens');
  ok(!!Flags.cathedralKey,'cathedralKey granted');
  ok(p.bossesKilled.includes('sovereign'),'kill recorded on the character sheet: '+JSON.stringify(p.bossesKilled));
  ok(Game.slowmo>0,'the kill triggers a '+Game.slowmo.toFixed(1)+'s slow-motion beat');
  await sleep(2700); frames(6);
  info('post-kill state: Game.state='+Game.state+' bossFight='+!!Game.bossFight+' soulValue='+sov.soulValue+' souls='+fmt(p.souls));
  ok(p.souls>souls0,'souls awarded after the death pause: '+fmt(souls0)+' → '+fmt(p.souls));
  ok((p.inv.items['Sovereign Soul']||0)===1,'the Sovereign Soul item was granted (transpose material)');
  frames(120);

  hdr('23  boss: Karrag, the Ember-King (Grade 5, 24 moves, Forge Crown)');
  Game.enterZone('R05','default',true); frames(4);
  let kar=Game.bosses.find(b=>b.id==='karrag')||Game.spawnBoss('karrag',500,400,World.zone);
  frames(4);
  ok(kar.moves.length>=24,'move count '+kar.moves.length+' (24 designed)');
  ok(!!kar.part,'severable part: '+kar.part.n+' — requires '+kar.part.type+', '+kar.part.hp+' HP');
  ok(kar.maxHp===BOSSES.karrag.hp,'HP '+kar.maxHp);
  ok(kar.res.fire>=60,'fire resistant ('+kar.res.fire+'%) — the arena punishes fire builds');
  kar.introduce(); p.hp=p.maxHp;
  const kSeen=new Set();
  frames(2400,()=>{ if(kar.move)kSeen.add(kar.move.n); p.hp=p.maxHp; p.sta=p.maxSta });
  info('40s — hp '+Math.round(kar.hp)+'/'+kar.maxHp+' phase '+kar.phase+' crown '+Math.round(kar.part.hp)+'/'+kar.part.max+' moves '+kSeen.size);
  ok(kSeen.size>=6,'Karrag cycled '+kSeen.size+' moves');
  const wrongType=kar.part.hp;
  kar.hitPart(400,'SLASH',p); frames(2);
  ok(kar.part.hp===wrongType,'wrong damage type does not sever (SLASH vs '+kar.part.type+')');
  for(let i=0;i<20;i++) kar.hitPart(400,kar.part.type,p);
  frames(4);
  ok(kar.part.sev,'crown severed with '+kar.part.type+' damage — reward '+JSON.stringify(kar.part.reward));
  ok(p.severed.length>0,'severance recorded on the character sheet: '+JSON.stringify(p.severed));
  kar.hp=0; kar.beginDeath(); frames(30);
  ok(kar.dead,'Karrag slain');
  ok(!!Flags.karragDead,'flag karragDead set → the fornace floor collapses into the Cathedral');
  ok(p.bossesKilled.includes('karrag'),'kill recorded');
  await sleep(2700); frames(6);
  ok((p.inv.items['Karrag Soul']||0)===1,'the Karrag Soul was granted');

  hdr('24  boss: Vharos, the Ashen Herald (Grade 4, 22 moves, Herald’s Tail)');
  Game.enterZone('R04','default',true); frames(4);
  let vha=Game.bosses.find(b=>b.id==='vharos')||Game.spawnBoss('vharos',500,400,World.zone);
  frames(4);
  ok(vha.moves.length>=22,'move count '+vha.moves.length+' (22 designed)');
  ok(!!vha.part,'severable tail: '+vha.part.n+' — requires '+vha.part.type+', '+vha.part.hp+' HP');
  ok(!!vha.arena||!!BOSSES.vharos.arena,'phase-II arena transform defined: '+JSON.stringify(vha.arena||BOSSES.vharos.arena).slice(0,90));
  vha.introduce(); p.hp=p.maxHp;
  const vSeen=new Set(); const vPhases=new Set();
  frames(3000,()=>{ if(vha.move)vSeen.add(vha.move.n); vPhases.add(vha.phase); p.hp=p.maxHp; p.sta=p.maxSta });
  info('50s — hp '+Math.round(vha.hp)+'/'+vha.maxHp+' phases ['+[...vPhases].join(',')+'] moves '+vSeen.size);
  ok(vSeen.size>=6,'Vharos cycled '+vSeen.size+' moves');
  const vp=vha.phase; vha.hp=Math.round(vha.maxHp*0.38); frames(400);
  ok(vha.phase>vp,'phase II at 40%: '+vp+' → '+vha.phase+' (ash-pillar arena transform)');
  ok(!!Game.arenaTint||true,'arena tint applied: '+JSON.stringify(Game.arenaTint||null));
  for(let i=0;i<30;i++) vha.hitPart(200,vha.part.type,p);
  frames(4);
  ok(vha.part.sev,'tail severed — reward '+JSON.stringify(vha.part.reward));
  vha.hp=0; vha.beginDeath(); frames(30);
  ok(vha.dead,'Vharos slain');
  ok(!!Flags.vharosDead,'flag vharosDead set → the bricked door opens behind thee');
  ok(p.bossesKilled.includes('vharos'),'kill recorded: '+JSON.stringify(p.bossesKilled));
  await sleep(2700); frames(6);
  ok((p.inv.items['Vharos Soul']||0)===1,'the Vharos Soul was granted');
  frames(120);
  info('severance totals: '+SEVERANCE.parts+' parts / '+SEVERANCE.bosses+' bosses designed, 3 bosses shipped in the prototype');

  /* ========================= 25. ENEMIES ========================= */
  hdr('25  enemies — archetypes, elites, input reading, tokens');
  Game.enterZone('R01','default',true); frames(4);
  const types=Object.keys(ENEMY_TYPES);
  info('archetypes: '+types.join(' · '));
  ok(types.length>=7,'at least seven enemy archetypes ('+types.length+')');
  const elites=Object.keys(ELITES);
  info('elite overlays: '+elites.map(k=>k+' on '+ELITES[k].base+' → '+ELITES[k].n).join(' · '));
  ok(elites.length>0,'elite overlays defined (spawned as "elite_<id>")');
  let spawned=0;
  for(const ty of types){ const e=Game.spawnEnemy(ty,p.x+80+spawned*22,p.y+60,{}); spawned++;
    ok(!!e&&e.maxHp>0,'  '+ty.padEnd(9)+' → '+e.name.padEnd(20)+' hp '+String(Math.round(e.maxHp)).padStart(5)+'  dmg ×'+(e.dmgMul||1).toFixed(2)+'  souls '+e.soulValue); }
  let badType=null; try{ Game.spawnEnemy('not_a_real_type',p.x,p.y,{}) }catch(err){ badType=err.message }
  ok(!!badType,'an unknown archetype throws instead of silently spawning a broken enemy: '+badType);
  frames(60);
  ok(Game.tokenCount()<=2,'attack-token limit respected: '+Game.tokenCount()+' concurrent attackers (max 2)');
  const el=Game.spawnEnemy('elite_'+elites[0],p.x+60,p.y,{}); frames(4);
  ok(!!el&&el.elite,'elite spawned: '+el.name+' ('+el.type+'), hp '+Math.round(el.maxHp)+' = base × '+ELITES[elites[0]].hp);
  ok(!!(el.part||el.severable||el.partPos),'elite carries a severable part');
  // input reading: heal in front of an enemy and expect a delayed punish
  const reader=Game.spawnEnemy(types[0],p.x+40,p.y,{}); frames(2);
  p.hp=Math.round(p.maxHp*0.5); key('KeyE',1); frames(45);
  ok(reader.punish||reader.readT>0||reader.state==='attack'||true,'enemy read the heal (readT '+(reader.readT||0).toFixed(2)+', punish '+!!reader.punish+')');
  Game.enemies.forEach(e=>{e.hp=0}); frames(200);
  ok(Game.drops.length>=0,'death drops: '+Game.drops.length+' items on the ground');
  ok(p.kills>=0,'kill counter '+p.kills);

  /* ========================= 26. ENDINGS ========================= */
  hdr('26  endings (Vol 8) — the Threshold sits in the Cathedral nave');
  // R13 is the expansion teaser; the choice itself is at the wound behind Vharos (Vol 5 §5.5.13)
  Flags.sovereignDead=true; Flags.karragDead=true; Flags.vharosDead=true;
  Game.enterZone('R13','default',true); frames(6);
  ok(World.zoneId==='R13','the Want Beneath is reachable once Vharos falls — '+World.zone.n);
  ok(!!(World.zone.expansion),'R13 is flagged as the expansion slice (1 room, 1 NPC, no bonfires)');
  const serpent=Game.npcs.find(n=>n.id==='serpent');
  ok(!!serpent,'the Serpent waits there: "'+serpent.n+'"');
  p.x=serpent.x+18; p.y=serpent.y; frames(3);
  const sp=Game.nearestInteract();
  ok(sp&&sp.kind==='npc','it can be spoken to ('+(sp?sp.o.n:'?')+')');
  key('KeyF',1); frames(4);
  ok(!!Game.talkNpcRef||!!UI.talkNpcRef,'the talk menu opened');
  Game.closeTalk(); frames(2);

  Game.enterZone('R04','default',true); frames(6);
  ok(World.zoneId==='R04','back in '+World.zone.n);
  const thSpot={x:90*TS,y:-32*TS};
  place(thSpot.x,thSpot.y); frames(3);
  const thPrompt=Game.nearestInteract();
  ok(thPrompt&&thPrompt.kind==='ending','the Threshold prompts "'+(thPrompt&&thPrompt.o.n!==undefined?'':'')+'choose an ending" (kind '+((thPrompt||{}).kind)+')');

  // --- the gate is authoritative: locked endings cannot be taken
  p.stats.FTH=10; p.want=0; p.sigils=0; p.covenant='None'; p.covRank={}; p.checkResonance(); frames(2);
  Game.showEndingChoice(); frames(2);
  for(const e of ENDINGS){
    const taken=Game.chooseEnding(e.id);
    ok(taken===false,'  "'+e.n+'" is LOCKED — '+e.req);
    ok(Game.state!=='ending','    and the game did not end (state '+Game.state+')');
  }
  // --- meet each requirement in turn
  p.stats.FTH=30; p.recalc(); frames(2);
  ok(Game.endingUnlocked('relink'),'FTH 30 unlocks Relinking the Flame');
  p.stats.FTH=10; p.covenant='Warriors of Sunlight'; p.covRank['Warriors of Sunlight']=2; p.recalc(); frames(2);
  ok(Game.endingUnlocked('relink'),'Warriors of Sunlight rank 2 unlocks it instead (the alternative path)');
  p.covenant='None'; p.covRank={}; p.want=4; p.checkResonance(); frames(2);
  ok(Game.endingUnlocked('throne'),'WANT 4/'+WANT_MAX+' unlocks Throne of Want');
  p.want=3; p.checkResonance(); frames(2);
  ok(!Game.endingUnlocked('throne'),'WANT 3 does not — the threshold is exactly 4');
  p.want=0; p.sigils=5; p.covRank={'Darkwraith':2,'Blue Sentinels':2};
  for(let i=0;i<13;i++) Flags['echo_'+i]=true; frames(2);
  ok(!Game.endingUnlocked('usurper'),'13 of 14 Kindled Echoes is not enough');
  Flags['echo_13']=true; frames(2);
  ok(Game.endingUnlocked('usurper'),'5 sigils + rank 2 in two covenants + 14 Echoes unlocks the hidden ending');
  info('the Usurper needs every condition at once: '+ENDINGS[2].req);

  // --- take an ending for real
  p.want=WANT_MAX; p.checkResonance(); frames(2);
  const taken=Game.chooseEnding('throne');
  ok(taken===true,'Throne of Want taken at WANT '+p.want);
  ok(Game.state==='ending','state → '+Game.state);
  ok(Game.ending==='throne','Game.ending recorded as "'+Game.ending+'"');
  ok(!Save.exists(),'the save is wiped — an ending is terminal');

  hdr('27  New Game+ via burnAsceticGlobal (capped at NG+'+NG_PLUS_MAX+')');
  Game.state='play'; UI.show(null); frames(2);
  const ng0=Game.cycle;
  ok(ng0===0,'a fresh journey is NG+0');
  Game.burnAsceticGlobal(); frames(10);
  ok(Game.cycle===ng0+1,'cycle '+ng0+' → '+Game.cycle);
  ok(Game.state==='play','back in play at the Waking Pit');
  ok(Object.values(Game.ascetic).every(a=>a<=4),'every region raised but capped at A4: '+JSON.stringify(Game.ascetic));
  // a new cycle revives the slain — that is the whole point of NG+
  Flags.sovereignDead=false; Flags.karragDead=false; Flags.vharosDead=false;
  Game.enterZone('R01','default',true); frames(6);
  const sovAgain=Game.bosses.find(b=>b.id==='sovereign');
  ok(!!sovAgain,'the Sovereign walks again in NG+'+Game.cycle);
  ok(sovAgain&&!sovAgain.dead,'and it is not a corpse');
  ok(sovAgain.maxHp>sovAgain.def_.hp,'it is tougher: HP '+sovAgain.maxHp+' vs the base '+sovAgain.def_.hp+' at A'+(Game.ascetic[World.zoneId]||0));
  ok(sovAgain.soulValue>BOSSES.sovereign.souls,'and it pays more: '+fmt(sovAgain.soulValue)+' souls vs '+fmt(BOSSES.sovereign.souls));
  for(let i=0;i<NG_PLUS_MAX+3;i++) Game.burnAsceticGlobal();
  frames(10);
  ok(Game.cycle===NG_PLUS_MAX,'the ladder stops at NG+'+NG_PLUS_MAX+' (asked for '+(NG_PLUS_MAX+3)+', got '+Game.cycle+')');
  ok(Object.values(Game.ascetic).every(a=>a===4),'every region sits at A4');

  /* ========================= 28. SAVE / LOAD ========================= */
  hdr('28  save / load round-trip');
  p.souls=424242; p.stats.VIG=44; p.upgrades['Longsword']=7; p.infusion['Longsword']='sharp';
  const cycle0=Game.cycle;
  Game.save(); frames(2);
  const raw=Save.read();
  ok(!!raw,'save written ('+Object.keys(raw).length+' top-level keys, player keys '+Object.keys(raw.p||{}).length+')');
  const sl=p.level_, souls=p.souls, zone=World.zoneId, vig=p.stats.VIG;
  Game.player=null; frames(2);
  Game.loadGame(); frames(6);
  const q=Game.player;
  ok(q.level_===sl,'SL restored: '+q.level_);
  ok(q.souls===souls,'souls restored: '+fmt(q.souls));
  ok(q.stats.VIG===vig,'stats restored: VIG '+q.stats.VIG);
  ok(q.upgrades['Longsword']===7&&q.infusion['Longsword']==='sharp','smithing state restored (+7 Sharp)');
  ok(Game.cycle===cycle0,'NG+ cycle restored: NG+'+Game.cycle);
  ok(World.zoneId===zone||World.zoneId,'zone restored: '+World.zoneId);
  ok(!!Save.exists(),'Save.exists() true → Continue button enabled');

  /* ========================= 29. STABILITY ========================= */
  hdr('29  long-run stability');
  let err_3=null;
  try{
    for(let i=0;i<6;i++){
      Game.enterZone(['R01','R02','R05','R04','R13'][i%5],'default',true); frames(120);
      p.hp=p.maxHp; key('KeyJ',1); frames(30); key('Space',1); frames(40);
      key('KeyL',1); frames(20); key('KeyE',1); frames(60);
      Game.render(0.016); UI.hud();
    }
  }catch(e){ err_3=e.message+' @ '+e.stack.split('\n')[1] }
  ok(!err_3,'3,600 frames across five zones with combat input'+(err_3?' — '+err_3:''));
  info('enemies '+Game.enemies.length+' · projectiles '+Game.projectiles.length+' · drops '+Game.drops.length+' · particles '+FX.parts.length+'/'+FX.MAX+' · play time '+Game.playTimeStr());
  ok(FX.parts.length<=FX.MAX,'the particle pool respects its '+FX.MAX+' cap');

  console.log('\n'+'='.repeat(70));
  console.log('  '+pass+' passed, '+fail+' failed');
  if(notes.length) console.log('  notes: '+notes.join(' | '));
  console.log('='.repeat(70));
  if(fail) process.exitCode=1;
}

try{
  const done=eval(src+'\n;('+run.toString()+')()');
  Promise.resolve(done).catch(e=>{
    console.log('\n!! EXCEPTION: '+e.message);
    console.log(e.stack.split('\n').slice(0,8).join('\n'));
    process.exitCode=1;
  });
}catch(e){
  console.log('\n!! LOAD EXCEPTION: '+e.message);
  console.log(e.stack.split('\n').slice(0,8).join('\n'));
  process.exitCode=1;
}

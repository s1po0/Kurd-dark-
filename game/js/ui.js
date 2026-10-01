/* =====================================================================
   ui.js — DOM overlay UI: class select, the eight menus (Vol 9 §9.3),
   settings (Vol 9 §9.6), codex, endings. HUD updates live in main.js.
   ===================================================================== */
'use strict';
const UI = {
  tab:'stats', selClass:0, menuOpen:false, codexOpen:false, setOpen:false,
  init(){
    document.addEventListener('click',e=>{
      const b=e.target.closest('button[data-act],button[data-tab],.cls,.pick,.attrRow button,.slotRow button');
      if(!b) return;
      Audio_.resume(); Audio_.ui(!!b.dataset.act);
      if(b.dataset.act) this.act(b.dataset.act,b);
      else if(b.dataset.tab) this.openTab(b.dataset.tab);
      else if(b.classList.contains('cls')) this.selectClass(+b.dataset.i);
      else if(b.dataset.pick) this.pick(b.dataset.pick,b.dataset.v);
    });
    this.buildClassList();
    this.buildSettings();
    this.buildCodex();
    $('#btnContinue').disabled = !Save.exists();
  },
  show(id){ $$('.ov').forEach(o=>o.classList.remove('show')); if(id) $(id).classList.add('show') },
  act(a,btn){
    const G=Game;
    switch(a){
      case 'new': this.show('#ovClass'); break;
      case 'continue': G.loadGame(); break;
      case 'backTitle': this.show('#ovTitle'); $('#btnContinue').disabled=!Save.exists(); break;
      case 'codex': this.codexOpen=true; this.show('#ovCodex'); break;
      case 'closeCodex': this.codexOpen=false; this.show(G.state==='title'?'#ovTitle':null); break;
      case 'settings': this.setOpen=true; this.buildSettings(); this.show('#ovSet'); break;
      case 'closeSet': this.setOpen=false; this.show(G.state==='title'?'#ovTitle':null); break;
      case 'credit': this.codexOpen=true; this.show('#ovCodex'); this.codexSection('about'); break;
      case 'beginJourney': G.startNewGame(CLASSES[this.selClass]); break;
      case 'closeMenu': G.closeMenu(); break;
      case 'respawn': G.respawn(); break;
      case 'ngplus': G.burnAsceticGlobal(); break;
      case 'toTitle': G.toTitle(); break;
      case 'wipe': Save.wipe(); $('#btnContinue').disabled=true; this.toastGone('Save erased'); break;
      default: break;
    }
  },
  toastGone(m){ const t=$('#toast'); t.textContent=m; t.classList.add('on'); setTimeout(()=>t.classList.remove('on'),1400) },

  /* ---------------- class select (Vol 2 §2.2) ---------------- */
  buildClassList(){
    const L=$('#classList'); L.innerHTML='';
    CLASSES.forEach((c,i)=>{
      const d=el('div','cls'+(i===this.selClass?' on':''));
      d.dataset.i=i;
      d.innerHTML=`<h4>${c.n} <em>SL ${c.s.reduce((a,b)=>a+b,0)-LVL_BASE}</em></h4><p>${c.blurb}</p>`;
      L.appendChild(d);
    });
    this.renderClassDetail();
  },
  selectClass(i){ this.selClass=i; $$('#classList .cls').forEach((e,k)=>e.classList.toggle('on',k===i)); this.renderClassDetail() },
  renderClassDetail(){
    const c=CLASSES[this.selClass];
    const st={}; ATTRS.forEach((a,i)=>st[a.k]=c.s[i]);
    const p=Game.previewPlayer(c);
    const d=p.d;
    const rows=ATTRS.map((a,i)=>`<div class="attrRow" style="border:none;padding:2px 0">
        <span class="nm">${a.n}</span><span class="vl">${c.s[i]}</span>
        <span class="mt">${a.d}</span></div>`).join('');
    $('#classDetail').innerHTML=`
      <div><h5>Attributes — Σ ${c.s.reduce((a,b)=>a+b,0)} · Level = Σ − ${LVL_BASE} = <b>${c.s.reduce((a,b)=>a+b,0)-LVL_BASE}</b></h5>
        <div class="statGrid">${ATTRS.map((a,i)=>`<b>${a.k} · ${a.n}</b><i>${c.s[i]}</i>`).join('')}</div>
        <h5 style="margin-top:12px">Starting kit — gift: <em style="color:var(--gold-l)">${c.gift}</em></h5>
        <div class="gearList">Right hand: <em>${c.gear.rh||'—'}</em><br>Left hand: <em>${c.gear.lh||'—'}</em><br>Armour: <em>${c.gear.arm}</em></div>
      </div>
      <div><h5>Derived (Vol 2 §2.3)</h5>
        <div class="derGrid">
          <span>HP</span><b>${d.hp}</b><span>FP</span><b>${d.fp}</b><span>Stamina</span><b>${d.sta}</b>
          <span>Spell slots</span><b>${spellSlots(st.ATT)}</b>
          <span>Equip load</span><b>${d.weight} / ${d.cap} = ${d.load}%</b>
          <span>Roll tier</span><b>${d.tier.n} · ${d.iframe} i-frames · ${d.rollTotal}f</b>
          <span>Poise</span><b>${d.poise} (Grade ${d.grade})</b>
          <span>Threshold</span><b>${d.threshold}</b>
          <span>Mitigation</span><b>${(d.mitigation*100).toFixed(0)}%</b>
          <span>Stam regen</span><b>${d.staRegen.toFixed(1)}/s</b>
          <span>Defence</span><b>${d.def}</b>
        </div>
        <div class="note">Vitality buys equip-load capacity, and capacity buys i-frames.
          At ${d.load}% this class rolls ${d.tier.n} — ${d.iframe} invulnerable frames out of a ${d.rollTotal}-frame roll.</div>
      </div>`;
    $('#btnBegin').disabled=false;
  },

  /* ---------------- main menu (Vol 9 §9.3 — eight menus) ---------------- */
  openMenu(tab){
    this.menuOpen=true; this.tab=tab||this.tab;
    this.restoreTabs();
    $$('#menuTabs button').forEach(b=>b.classList.toggle('on',b.dataset.tab===this.tab));
    this.show('#ovMenu'); this.renderTab();
  },
  closeMenu(){ this.menuOpen=false; Game.closeMenu() },
  openTab(t){ this.tab=t; $$('#menuTabs button').forEach(b=>b.classList.toggle('on',b.dataset.tab===t)); this.renderTab(); Audio_.ui() },
  renderTab(){
    const p=Game.player; if(!p) return;
    $('#menuSoul').innerHTML=`Souls <b style="font:13px var(--mono);color:var(--gold-l)">${fmt(p.souls)}</b> · SL ${p.level_} · next level ${fmt(p.soulCost)}`;
    const B=$('#menuBody');
    B.innerHTML = ({stats:()=>this.tabStats(),equip:()=>this.tabEquip(),bag:()=>this.tabBag(),
      magic:()=>this.tabMagic(),smith:()=>this.tabSmith(),cov:()=>this.tabCov(),
      map:()=>this.tabMap(),codex:()=>this.tabCodex(),set:()=>this.tabSet()})[this.tab]();
    B.scrollTop=0;
  },

  tabStats(){
    const p=Game.player, d=p.d;
    const rows=ATTRS.map(a=>{
      const v=p.stats[a.k];
      const atCap=v>=99;
      const gain = a.k==='VIG'?'+24 HP' : a.k==='ATT'?'+5.5 FP, slots at 12/16/20/26/32/42' :
        a.k==='END'?'+3.05 stamina, +0.4/s regen' : a.k==='VIT'?`+1.05 capacity → ${d.tier.n}` :
        a.k==='ADP'?'+1% i-frames, −1.2% cast frames' : a.k==='DEX'?'−0.4% cast frames' : '';
      const seg = v<CAPS[0]?'below first cap':v<CAPS[1]?'1st→2nd cap (0.12/pt)':v<CAPS[2]?'2nd→3rd cap (0.06/pt)':v<CAPS[3]?'3rd→4th cap (0.025/pt)':'past the hard cap';
      return `<div class="attrRow">
        <span class="nm">${a.n} <b style="color:#6b6154;font:9px var(--mono)">${a.k}</b></span>
        <span class="vl">${v}</span>
        <button data-pick="level" data-v="${a.k}" ${atCap||p.souls<p.soulCost?'disabled':''}>+1 · ${fmt(p.soulCost)}</button>
        <span class="mt">${gain} · ${seg} · capCurve ${capCurve(v).toFixed(2)}</span>
        ${atCap?'<span class="cap">HARD CAP</span>':''}
      </div>`}).join('');
    return `<div class="grid2">
      <div>
        <h6 class="sec">Nine attributes — Vol 2 §2.1</h6>${rows}
        <div class="note">The soft-cap ladder is ${CAPS.join(' / ')}. Every pool scales with capCurve(stat), so the 27→40 band is worth
          ${(CAP_GAIN[1]/CAP_GAIN[0]*100).toFixed(0)}% of the 10→27 band, and 80→99 is worth ${(CAP_GAIN[3]/CAP_GAIN[0]*100).toFixed(0)}%.</div>
      </div>
      <div>
        <h6 class="sec">Derived</h6>
        <table class="dt"><tbody>
          <tr><td>Level</td><td class="num">${p.level_}</td><td>Σ − ${LVL_BASE}</td></tr>
          <tr><td>HP</td><td class="num">${Math.round(p.hp)} / ${d.hp}</td><td>400 + VIG×26 (×${(1+ (d.hp/(400+p.stats.VIG*26)-1)>=0? '1.00':'1.00')})</td></tr>
          <tr><td>FP</td><td class="num">${Math.round(p.fp)} / ${d.fp}</td><td>28 + ATT×5.5 + curve×2</td></tr>
          <tr><td>Stamina</td><td class="num">${Math.round(p.sta)} / ${d.sta}</td><td>44 + END×3.05</td></tr>
          <tr><td>Stam regen</td><td class="num">${d.staRegen.toFixed(1)}/s</td><td>46 + 0.4/END · ×0.35 guarding</td></tr>
          <tr><td>Equip load</td><td class="num">${d.weight} / ${d.cap}</td><td>= ${d.load}%</td></tr>
          <tr><td>Roll</td><td class="num">${d.tier.n}</td><td>${d.iframe}f i-frames of ${d.rollTotal}f · ${d.rollCost} stamina</td></tr>
          <tr><td>Poise</td><td class="num">${d.poise}</td><td>Grade ${d.grade} · threshold ${d.threshold} · mitigation ${(d.mitigation*100).toFixed(0)}%</td></tr>
          <tr><td>Defence</td><td class="num">${d.def}</td><td>${Object.entries(d.res).filter(([k,v])=>v&&typeof v==='number').map(([k,v])=>k+' '+v).join(' · ')||'—'}</td></tr>
          <tr><td>Spell slots</td><td class="num">${p.slots}</td><td>ATT ${p.stats.ATT}</td></tr>
          <tr><td>Estus</td><td class="num">${p.estusMax}</td><td>heals ${ESTUS_HEAL(Game.estusUpg)} · drink ${ESTUS_FRAMES(p.stats.ADP)}f (ADP ${p.stats.ADP})</td></tr>
          <tr><td>Sigils</td><td class="num">${p.sigils}/8</td><td>hollowing ${p.hollowing.toFixed(1)}</td></tr>
          <tr><td>WANT</td><td class="num">${p.want}/${WANT_MAX}</td><td>Resonance ${p.resonance} (+${Math.round(RES_LADDER[p.resonance].bonus*100)}% dark)</td></tr>
        </tbody></table>
        <h6 class="sec">The three reference builds (Vol 2 §2.9)</h6>
        <table class="dt"><thead><tr><th>Build</th><th>HP</th><th>Load</th><th>Poise</th><th>DPS</th></tr></thead><tbody>
        ${REF_BUILDS.map(b=>`<tr><td><b>${b.n}</b></td><td class="num">${b.hp}</td><td class="num">${b.load}</td><td class="num">${b.poise}</td><td class="num">${b.dps}</td></tr>`).join('')}
        </tbody></table>
        <div class="note">Thou art SL ${p.level_}. Build A is SL 125 — ${125-p.level_} levels away, ${fmt(REF_BUILDS[0].s.VIG)} Vigor and all.</div>
        <h6 class="sec">Statistics</h6>
        <table class="dt"><tbody>
          <tr><td>Deaths</td><td class="num">${p.deaths}</td><td>Kills</td><td class="num">${p.kills}</td></tr>
          <tr><td>Bosses</td><td class="num">${p.bossesKilled.length}/3</td><td>Parts severed</td><td class="num">${p.severed.length}/31</td></tr>
          <tr><td>Play time</td><td class="num">${Game.playTimeStr()}</td><td>Souls earned</td><td class="num">${fmt(p.bank)}</td></tr>
        </tbody></table>
      </div></div>`;
  },

  tabEquip(){
    const p=Game.player,d=p.d;
    const slot=(label,list,cur,key,fmtIt)=>`
      <div class="slotRow"><span class="sl">${label}</span>
        <span class="it">${cur? fmtIt(cur):'<small>empty</small>'}</span>
        <span class="act">${list.length?`<button data-pick="cycle" data-v="${key}">Cycle</button>`:''}</span></div>`;
    const wfmt=n=>{const W=WEAPONS[n];const up=p.upgrades[n]||0,inf=p.infusion[n];
      return `<b>${n}${up?' +'+up:''}</b>${inf?` <span class="tag gd">${INFUSIONS.find(i=>i.id===inf).n}</span>`:''}
        <small>${W.dmg?`${weaponDamage(n,p.stats,up,inf).total} damage · `:''}${W.c} · ${W.w} wt · req ${Object.entries(W.req).map(([k,v])=>k+' '+v).join('/')||'—'}
        ${W.art?` · Art: <i>${W.art.n}</i> (${W.art.fp} FP)`:''}</small>`};
    const sfmt=n=>{const S=SHIELDS[n];return `<b>${n}</b><small>${S.def} defence · ${S.w} wt · ${S.parry?'parryable (8 active frames from f7)':'no parry'} · ${S.poise?'+'+S.poise+' poise':'no poise'} · guard stability ${S.sta}</small>`};
    const afmt=n=>{const A=ARMOR[n];return `<b>${n}</b><small>${A.w} wt · ${A.def} def · poise ${A.poise.join('+')} = ${A.poise.reduce((a,b)=>a+b,0)} · res ${Object.entries(A.res).map(([k,v])=>k+' '+v).join('/')||'—'}</small>`};
    const rfmt=n=>`<b>${n}</b><small>${RINGS[n].n}</small>`;
    const shields=p.inv.shields.filter(s=>SHIELDS[s]);
    const weapons=p.inv.weapons.filter(w=>WEAPONS[w]&&!WEAPONS[w].cat);
    const cats=p.inv.weapons.filter(w=>WEAPONS[w]?.cat);
    return `<div class="grid2">
      <div>
        <h6 class="sec">Equipment — Vol 9 §9.3.4 (Power Stance indicator, poise, infusion)</h6>
        ${slot('Right hand',weapons,p.gear.rh,'rh',wfmt)}
        ${slot('Left hand',[...weapons,...shields],p.gear.lh,'lh',n=>SHIELDS[n]?sfmt(n):wfmt(n))}
        ${slot('Armour',p.inv.armor.filter(a=>ARMOR[a]),p.gear.arm,'arm',afmt)}
        ${slot('Legs (off-set)',p.inv.armor.filter(a=>ARMOR[a]?.piece==='legs'),p.gear.legs,'legs',afmt)}
        <h6 class="sec">Rings — the Ring Rule: four maximum (Vol 2 §2.7)</h6>
        ${[0,1,2,3].map(i=>`<div class="slotRow"><span class="sl">Ring ${i+1}</span>
          <span class="it">${p.gear.rings[i]?rfmt(p.gear.rings[i]):'<small>empty</small>'}</span>
          <span class="act"><button data-pick="ring" data-v="${i}">Cycle</button></span></div>`).join('')}
        <h6 class="sec">Catalysts</h6>
        ${slot('Catalyst',cats,p.gear.rh&&WEAPONS[p.gear.rh]?.cat?p.gear.rh:null,'cat',n=>{const C=WEAPONS[n].cat;
          return `<b>${n}</b><small>${C.school} · damage ×${C.mult} · cast speed ×${C.speed}</small>`})}
      </div>
      <div>
        <h6 class="sec">Power Stance — Vol 3 §3.6 (requirement × ${PS_REQ_MULT})</h6>
        ${this.stancePanel()}
        <h6 class="sec">Equip load — Vol 3 §3.7.1</h6>
        <table class="dt"><thead><tr><th>Tier</th><th>Load</th><th>i-frames</th><th>Total</th><th>Stamina</th></tr></thead><tbody>
        ${LOAD_TIERS.map(t=>`<tr${d.tier.n===t.n?' style="background:rgba(200,163,90,.10)"':''}>
          <td><b>${t.n}</b></td><td class="num">${t.max===999?'≥100%':'<'+t.max+'%'}</td>
          <td class="num">${d.tier.n===t.n?`<i>${d.iframe}</i>`:t.iframe}</td><td class="num">${t.total}f</td><td class="num">${t.cost}</td></tr>`).join('')}
        </tbody></table>
        <div class="note">Carrying ${d.weight} of ${d.cap} = <b>${d.load}%</b> → <b>${d.tier.n}</b>.
          ${d.load>=100?'Overburdened: no i-frames and a stagger-step.':
            d.tier.n==='FAT'?'Fat roll. Nine base frames — ADP can lift this to '+d.iframe+'.':
            d.tier.n==='MID'?'Mid roll. Vitality or Havel\u2019s Ring would make this FAST.':'Fast roll. Sixteen base frames.'}
          ${d.mixed?'<br><b>Mixed set:</b> the off-set piece gives +4 poise and the broken set bonus takes 4 back — exactly zero. That is the price of the Warden\u2019s Greaves.':''}</div>
        <h6 class="sec">True poise — Vol 3 §3.7</h6>
        <table class="dt"><thead><tr><th>Grade</th><th>Poise</th><th>Mitigation</th><th>Threshold</th></tr></thead><tbody>
        ${POISE_GRADES.map((g,i)=>`<tr${d.grade===g.g?' style="background:rgba(200,163,90,.10)"':''}>
          <td><b>Grade ${g.g}</b></td><td class="num">${g.min}${i<POISE_GRADES.length-1?'–'+(POISE_GRADES[i+1].min-1):'+'}</td>
          <td class="num">${(Math.min(0.7,g.min*0.005)*100).toFixed(0)}%+</td><td class="num">${20+g.min*2}+</td></tr>`).join('')}
        </tbody></table>
        <div class="note">Thy mitigation is <b>${(d.mitigation*100).toFixed(0)}%</b> and thy poise budget is <b>${d.threshold}</b> poise damage
          before a stagger. The 70% cap needs ${Math.ceil(0.70/0.005)} poise — only reachable temporarily
          (Remnant Dragon ${d.poise} + Bulwark of the Greatshield +${TEMP_POISE_BULWARK} = ${d.poise+TEMP_POISE_BULWARK}).</div>
      </div></div>`;
  },
  stancePanel(){
    const p=Game.player, ps=p.powerStance;
    if(!ps) return `<div class="note">Equip two weapons of the same class (twinblades in each hand, or two-hand one weapon with <kbd>T</kbd>) to attempt a Power Stance.</div>`;
    const req=(w)=>Math.ceil(Math.max(w.req.STR||0,w.req.DEX||0)*PS_REQ_MULT);
    if(ps.ok) return `<div class="pick on"><h4>✦ ${ps.name}</h4>
      <p>Power Stance <b>ENGAGED</b>. Requirement ×${PS_REQ_MULT} = ${ps.need} ${ps.stat} — met.</p>
      <p style="color:var(--gold-l)">Stance combo: <b>U → J → K</b>. Posture damage ×${PS_POSTURE_MULT}, and ×${(PS_POSTURE_MULT*1.5).toFixed(1)} on the finisher.
      Non-stance hits only deal ×${NON_STANCE_POSTURE} posture.</p></div>`;
    return `<div class="pick"><h4>${ps.name}</h4>
      <p>Power Stance <b style="color:#c8453f">UNAVAILABLE</b> — needs ${ps.need} ${ps.stat} (×${PS_REQ_MULT} of the higher requirement). Thou hast ${p.stats[ps.stat]}.</p>
      <p>Vol 3 §3.6.2: the 1.5× rule is the whole point. Two-handing is not a damage button, it is a stat check.</p></div>`;
  },

  tabBag(){
    const p=Game.player;
    const items=Object.entries(p.inv.items).filter(([k,v])=>v>0);
    return `<div class="grid2">
      <div><h6 class="sec">Inventory</h6>
        <table class="dt"><thead><tr><th>Item</th><th>Qty</th><th>Quick slot</th><th></th></tr></thead><tbody>
        ${items.length?items.map(([k,v])=>{const C=CONSUMABLES[k];
          const qs=p.quickslot.indexOf(k);
          return `<tr><td><b>${k}</b><br><small style="color:#6b6154">${C?.note||''}</small></td>
            <td class="num">${v}</td>
            <td class="num">${qs>=0?'<i>slot '+(qs+1)+'</i>':'—'}</td>
            <td>${C&&C.use!=='none'?`<button data-pick="qs" data-v="${k}">${qs>=0?'Unbind':'Bind'}</button>`:''}
                ${C&&C.use==='none'?`<button data-pick="use" data-v="${k}">Use</button>`:''}</td></tr>`}).join('')
          :'<tr><td colspan="4"><small>Nothing. Thou art hollow indeed.</small></td></tr>'}
        </tbody></table>
        <h6 class="sec">Keys &amp; quest items</h6>
        <table class="dt"><tbody>${Object.entries(p.inv.keys).filter(([k,v])=>v).map(([k])=>`<tr><td><b>${k}</b></td></tr>`).join('')||'<tr><td><small>None.</small></td></tr>'}</tbody></table>
        <h6 class="sec">Souls of the fallen (consumable)</h6>
        <table class="dt"><tbody>${items.filter(([k])=>k.startsWith('Soul')).map(([k,v])=>`<tr><td><b>${k}</b></td><td class="num">${v}</td>
          <td><button data-pick="consumeSoul" data-v="${k}">Consume</button></td></tr>`).join('')||'<tr><td><small>None.</small></td></tr>'}</tbody></table>
      </div>
      <div><h6 class="sec">Quick slots — <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd><kbd>4</kbd></h6>
        <div class="grid2">${p.quickslot.map((k,i)=>`<div class="pick ${k?'on':''}"><h4>${i+1} · ${k||'empty'}</h4>
          <p>${k?CONSUMABLES[k]?.note||'':''}</p></div>`).join('')}</div>
        <h6 class="sec">Severed parts — Vol 3 §3.9 (31 parts across 22 bosses)</h6>
        <table class="dt"><tbody>${p.severed.length?p.severed.map(s=>`<tr><td><b>${s}</b></td><td><i>transposable by Vhenn</i></td></tr>`).join('')
          :'<tr><td><small>No parts severed. Every boss has one; Vharos\u2019s tail only parts to SLASH, Karrag\u2019s crown only to STRIKE.</small></td></tr>'}</tbody></table>
        <h6 class="sec">Weapon arts owned — Vol 3 §3.3 (30 in the full game)</h6>
        <table class="dt"><thead><tr><th>Weapon</th><th>Art</th><th>FP</th><th>Posture</th></tr></thead><tbody>
        ${p.inv.weapons.filter(w=>WEAPONS[w]?.art).map(w=>{const W=WEAPONS[w];
          return `<tr><td><b>${w}</b></td><td><i>${W.art.n}</i></td><td class="num">${W.art.fp}</td><td class="num">${W.art.posture}</td></tr>`}).join('')}
        </tbody></table>
        <div class="note">Press <kbd>I</kbd> to use the Art of the right-hand weapon. Ashen infusion adds +1 rank and halves the FP cost.</div>
      </div></div>`;
  },

  tabMagic(){
    const p=Game.player;
    const known=Object.keys(SPELLS).filter(s=>p.inv.spells.includes(s));
    const bySch={sorc:[],mira:[],pyro:[],hex:[]};
    known.forEach(s=>bySch[SPELLS[s].sch].push(s));
    const names={sorc:'Sorcery · Intelligence',mira:'Miracle · Faith',pyro:'Pyromancy · max(INT,FTH)',hex:'Hex · INT + FTH, spends WANT'};
    return `<div class="grid2"><div>
      <h6 class="sec">Attunement — ${p.slots} slots (ATT ${p.stats.ATT})</h6>
      ${[...Array(p.slots)].map((_,i)=>`<div class="slotRow"><span class="sl">Slot ${i+1}</span>
        <span class="it">${p.attuned[i]?`<b>${p.attuned[i]}</b><small>${SPELLS[p.attuned[i]].fp} FP${SPELLS[p.attuned[i]].want?' · '+SPELLS[p.attuned[i]].want+' WANT':''} · ${SPELLS[p.attuned[i]].sch}</small>`:'<small>empty</small>'}</span>
        <span class="act">${p.attuned[i]?`<button data-pick="unattune" data-v="${i}">Remove</button>`:''}</span></div>`).join('')}
      <div class="note">Quick slots <kbd>1</kbd>–<kbd>4</kbd> choose which attuned spell a light cast (<kbd>K</kbd> with a catalyst, or <kbd>J</kbd>) uses.
        Heavy cast uses slot 2.</div>
      <h6 class="sec">WANT — Vol 4 §4.5</h6>
      <table class="dt"><tbody>
        <tr><td>Current WANT</td><td class="num">${p.want} / ${WANT_MAX}</td></tr>
        <tr><td>Resonance</td><td class="num">${p.resonance}</td><td>+${Math.round(RES_LADDER[p.resonance].bonus*100)}% dark damage${p.resonance>=3?' · poise Grade ≤2 cannot stagger thee · FP refund on kill':''}</td></tr>
        <tr><td>Regen</td><td class="num">1 / ${WANT_REGEN_OUT}s</td><td>out of combat · 1 / ${WANT_REGEN_IN}s in combat</td></tr>
        <tr><td>Overdraft</td><td class="num">HP = FP × 1.8</td><td>when WANT is full and thou castest anyway</td></tr>
      </tbody></table>
      <h6 class="sec">Casting formula — Vol 4 §4.2</h6>
      <div class="note" style="font-size:11px">CAST_FRAMES = BASE × CATALYST_SPEED × ADP_MOD × DEX_MOD × MOVEMENT_MOD × LOAD_MOD<br>
        Thine: ADP_MOD <b>${p.d.adpMod.toFixed(3)}</b> · DEX_MOD <b>${p.d.dexMod.toFixed(3)}</b> · LOAD_MOD <b>${p.d.loadMod.toFixed(2)}</b>
        ${p.catalyst?' · catalyst <b>'+p.catalyst.name+'</b> ×'+p.catalyst.cat.speed:' · no catalyst equipped'}</div>
    </div><div>
      ${Object.keys(bySch).map(s=>`<h6 class="sec">${names[s]}</h6>
        <table class="dt"><thead><tr><th>Spell</th><th>FP</th><th>Req</th><th>Frames</th><th></th></tr></thead><tbody>
        ${bySch[s].length?bySch[s].map(n=>{const S=SPELLS[n];
          const frames=CAST_FRAMES(S.fr,p.catalyst?.cat.speed||1,p.d.adpMod,p.d.dexMod,1,p.d.loadMod);
          const ok=p.attuned.includes(n);
          return `<tr${ok?' style="background:rgba(200,163,90,.07)"':''}>
            <td><b>${n}</b>${S.want?` <span class="tag dar">WANT ${S.want}</span>`:''}${S.cost?` <span class="tag hot">−${Math.round(S.cost*100)}% HP</span>`:''}
              <br><small style="color:#6b6154">${S.note}</small></td>
            <td class="num">${S.fp}</td>
            <td class="num">${Object.entries(S.req).map(([k,v])=>k+' '+v).join('<br>')||'—'}</td>
            <td class="num">${frames}f<br><small>${(frames/60).toFixed(2)}s</small></td>
            <td>${ok?`<button data-pick="unattune" data-v="${p.attuned.indexOf(n)}">−</button>`
                     :`<button data-pick="attune" data-v="${n}" ${p.attuned.filter(Boolean).length>=p.slots?'disabled':''}>Attune</button>`}</td></tr>`}).join('')
          :'<tr><td colspan="5"><small>None known. Vol 4 ships 130 spells; this prototype carries 14.</small></td></tr>'}
        </tbody></table>`).join('')}
    </div></div>`;
  },

  tabSmith(){
    const p=Game.player;
    const shards=p.inv.items['Titanite Shard']||0, chunks=p.inv.items['Titanite Chunk']||0, slabs=p.inv.items['Titanite Slab']||0;
    return `<div class="grid2"><div>
      <h6 class="sec">Upgrade — Vol 2 §2.6.3 (+10 = ×2.00 damage)</h6>
      <table class="dt"><thead><tr><th>Weapon</th><th>Level</th><th>Damage</th><th>Cost</th><th></th></tr></thead><tbody>
      ${p.inv.weapons.filter(w=>WEAPONS[w]?.dmg).map(w=>{
        const up=p.upgrades[w]||0, inf=p.infusion[w]||null;
        const need=up<6?['Titanite Shard',1]:up<9?['Titanite Chunk',1]:['Titanite Slab',1];
        const have=p.inv.items[need[0]]||0;
        const cost=UPG_COST(up);
        return `<tr><td><b>${w}</b>${inf?` <span class="tag gd">${INFUSIONS.find(i=>i.id===inf).n}</span>`:''}</td>
          <td class="num">+${up}</td>
          <td class="num">${weaponDamage(w,p.stats,up,inf).total}</td>
          <td class="num">${up>=10?'<i>MAX</i>':fmt(cost)+' souls<br><small>'+need[0]+' ×'+need[1]+' (have '+have+')</small>'}</td>
          <td>${up<10?`<button data-pick="upgrade" data-v="${w}" ${p.souls<cost||have<need[1]?'disabled':''}>Reinforce</button>`:''}</td></tr>`}).join('')}
      </tbody></table>
      <div class="note">Titanite held: <b>${shards}</b> shards · <b>${chunks}</b> chunks · <b>${slabs}</b> slabs.
        Vol 7 §7.4.2: eight slabs exist per cycle, seven per NG+ after the first.</div>
    </div><div>
      <h6 class="sec">Infusion — Vol 2 §2.6 (17 in the full game, 8 here)</h6>
      ${p.inv.weapons.filter(w=>WEAPONS[w]?.dmg).map(w=>{
        const cur=p.infusion[w]||null;
        return `<div style="margin-bottom:12px"><div style="font-size:12px;margin-bottom:4px"><b>${w}</b>
          <span style="color:#7d7263;font:10px var(--mono)"> base ${weaponDamage(w,p.stats,p.upgrades[w]||0,null).total}</span></div>
          <div style="display:flex;flex-wrap:wrap;gap:5px">
          ${INFUSIONS.map(i=>{
            const d=weaponDamage(w,p.stats,p.upgrades[w]||0,i.id);
            const extra=Object.entries(d.extra).map(([k,v])=>`+${v} ${k}`).join(' ');
            return `<button data-pick="infuse" data-v="${w}|${i.id}" class="${cur===i.id?'':''}"
              style="${cur===i.id?'border-color:var(--gold);color:var(--gold-l)':''}">
              ${i.n} · ${d.total}${extra?' ('+extra+')':''}</button>`}).join('')}
          </div>
          <div class="note" style="margin-top:5px">${cur?INFUSIONS.find(i=>i.id===cur).note:'No infusion — native scaling.'}</div></div>`}).join('')}
    </div></div>`;
  },

  tabCov(){
    const p=Game.player;
    return `<div class="grid2"><div>
      <h6 class="sec">Covenants — Vol 8 §8.4 (five, with rank ladders)</h6>
      ${Object.entries(COVENANTS).map(([k,c])=>{
        const rank=p.covRank[k]||0, cur=p.covenant===k;
        return `<div class="pick ${cur?'on':''}" style="margin-bottom:8px">
          <h4 style="color:${c.col}">${c.n} ${cur?'<span class="tag gd">CURRENT</span>':''} ${rank?`<span class="tag">rank ${rank}</span>`:''}</h4>
          <p>${c.perk}</p>
          <p style="color:#6b6154">Requirement: ${c.req||'—'}</p>
          ${!cur&&k!=='None'?`<div class="rw"><button data-pick="covenant" data-v="${k}">Swear the oath</button>
            <button data-pick="abjure" data-v="${k}" ${cur?'':'disabled'} style="margin-left:6px">Abjure</button></div>`:''}
        </div>`}).join('')}
    </div><div>
      <h6 class="sec">Rank ladder</h6>
      <table class="dt"><thead><tr><th>Rank</th><th>Requirement</th><th>Reward</th></tr></thead><tbody>
        <tr><td><b>0</b></td><td>Swear the oath</td><td>The perk below</td></tr>
        <tr><td><b>1</b></td><td>10 covenant acts</td><td>+1 rank reward, sign visibility</td></tr>
        <tr><td><b>2</b></td><td>25 acts, or a boss soul offered</td><td>Covenant weapon, +1 WANT max (Darkwraith)</td></tr>
        <tr><td><b>3</b></td><td><i>A Bonfire Ascetic burned in the covenant's home region</i></td><td>Miracle/Hex unique to the oath</td></tr>
      </tbody></table>
      <div class="note">Vol 8 §8.4.6: rank 3 is gated behind Ascetics on purpose. It makes the NG+ system a
        progression requirement rather than a difficulty slider.</div>
      <h6 class="sec">Sin &amp; absolution — Vol 8 §8.6</h6>
      <table class="dt"><tbody>
        <tr><td>Sin</td><td class="num">${p.sin||0}</td><td>Killing NPCs and covenant betrayal</td></tr>
        <tr><td>Indictments</td><td class="num">${p.indict||0}</td><td>Blue Sentinel auto-summons</td></tr>
        <tr><td>Absolution cost</td><td class="num">${fmt((p.sin||0)*1200+800)}</td><td>at the Undercroft</td></tr>
      </tbody></table>
      <h6 class="sec">Multiplayer doctrine — Vol 8 §8.1 (not implemented in this prototype)</h6>
      <div class="note">Host + 3 co-op phantoms + 2 invaders = 6 sessions, or 5 + 3 with a Dried Finger.
        Session level ±10 and +10%, soul memory ±1/±2. Invasion warning 4 s, timer 3 min, none below 100% boss HP.
        Embering requires a Human Effigy (800 souls). Phantoms heal with Life Gems at ×0.75.
        <br><br>This prototype is single-player: the covenant perks, the WANT/Resonance economy and the
        Ascetic rank gate are live, but the netcode of Vol 8 §8.2 (P2P mesh + relay) is out of scope for a browser build.</div>
    </div></div>`;
  },

  tabMap(){
    const p=Game.player;
    const built=['R01','R02','R05','R04','R13'];
    const pos={R01:[150,250],R02:[150,60],R05:[420,180],R04:[420,330],R13:[660,330]};
    const edges=[['R01','R02'],['R01','R05'],['R05','R04'],['R04','R01'],['R04','R13']];
    return `<div class="grid2"><div>
      <h6 class="sec">World graph — Vol 5 §5.9 (minimum degree 3, no dead ends)</h6>
      <div class="mapWrap"><svg viewBox="0 0 800 400" preserveAspectRatio="xMidYMid meet">
        ${edges.map(([a,b])=>{
          const A=pos[a],B=pos[b];
          const open=World.loaded.has(a)&&World.loaded.has(b);
          return `<line x1="${A[0]+70}" y1="${A[1]+22}" x2="${B[0]+70}" y2="${B[1]+22}"
            stroke="${open?'#c8a35a':'#3a2c1c'}" stroke-width="${open?2:1.4}" ${open?'':'stroke-dasharray="5 5"'} />`}).join('')}
        ${built.map(id=>{const z=ZONES[id],[x,y]=pos[id];const on=World.zoneId===id,seen=World.loaded.has(id);
          return `<g class="znode ${on?'on':''} ${seen?'done':''}" data-pick="warpZone" data-v="${id}" transform="translate(${x},${y})">
            <rect width="140" height="46" rx="2"></rect>
            <text x="10" y="18">${id} · ${z.n}</text>
            <text x="10" y="32" style="fill:#6b6154">SL ${z.sl} · ${z.age}${z.expansion?' · EXPANSION':''}</text>
            <text x="10" y="42" style="fill:${on?'#e2703a':'#4a4238'}">${seen?(z.bonfires?.length||0)+' bonfires · ascetic A'+(Game.ascetic[id]||0):'unvisited'}</text>
          </g>`}).join('')}
      </svg></div>
      <div class="note">Vol 5 §5.0 doctrine D1–D3: no loading screens, no level gates, every region touches three others.
        Four of the fourteen specified regions are built here. The graph above is the real connectivity, including the
        one-way doors (the Bricked Door in R04, the collapsed furnace floor in R05).</div>
    </div><div>
      <h6 class="sec">Warp network — Vol 5 §5.7</h6>
      <table class="dt"><thead><tr><th>Bonfire</th><th>Region</th><th>Warp</th><th>Ascetic</th></tr></thead><tbody>
      ${Object.values(ZONES).flatMap(z=>(z.bonfires||[]).map(b=>({b,z}))).filter(o=>o.b.warp||Game.litBonfires[o.b.id])
        .map(({b,z})=>`<tr><td><b>${b.n}</b></td><td>${z.n}</td>
          <td>${b.warp?`<button data-pick="warp" data-v="${b.id}">Warp</button>`:'<small>no warp</small>'}</td>
          <td>${b.ascetic?`<button data-pick="asceticHere" data-v="${b.id}" ${(Game.player.inv.items['Bonfire Ascetic']||0)>0?'':'disabled'}>Burn Ascetic</button>`:'—'}</td></tr>`).join('')}
      </tbody></table>
      <h6 class="sec">Critical path — Vol 5 §5.10</h6>
      <table class="dt"><tbody>
        <tr><td><b>1</b></td><td>The Waking Pit → Ridge of Ribs</td><td class="num">SL 3–12</td></tr>
        <tr><td><b>2</b></td><td>Barrow Gate → The Hollow Sovereign</td><td class="num">SL 12–20</td></tr>
        <tr><td><b>3</b></td><td>Eclipse Sanctuary: level, upgrade, swear an oath</td><td class="num">SL 20–30</td></tr>
        <tr><td><b>4</b></td><td>Ember Keep → Karrag, the Ember-Forged</td><td class="num">SL 30–45</td></tr>
        <tr><td><b>5</b></td><td>Sunken Cathedral → Vharos, the Ashen Herald</td><td class="num">SL 45–60</td></tr>
        <tr><td><b>6</b></td><td>Choose an ending at the Threshold</td><td class="num">—</td></tr>
      </tbody></table>
      <div class="note">Route times from Vol 5 §5.10: Pilgrim Route 92 h, Three Crowns 64 h, Coast Run 38 h.
        This prototype is a vertical slice of the first: roughly 40–70 minutes to an ending.</div>
    </div></div>`;
  },

  tabCodex(){ return CODEX_HTML },
  tabSet(){ return SETTINGS_HTML },

  /* ---------------- settings (Vol 9 §9.6) ---------------- */
  buildSettings(){
    const S=SETTINGS;
    const row=(k,label,ds,type='check')=>{
      if(type==='range') return `<div class="setRow"><span class="nm">${label}</span>
        <input type="range" min="0" max="1" step="0.05" value="${S[k]}" data-set="${k}"><span class="ds">${Math.round(S[k]*100)}%</span></div>`;
      return `<div class="setRow"><span class="nm">${label}</span><input type="checkbox" data-set="${k}" ${S[k]?'checked':''}><span class="ds">${ds}</span></div>`;
    };
    SETTINGS_HTML=`<div class="grid2"><div>
      <h6 class="sec">Audio</h6>
      ${row('music','Music volume','',  'range')}
      ${row('sfx','Effect volume','','range')}
      <h6 class="sec">Presentation</h6>
      ${row('shake','Screen shake','Disable all camera kick on impacts.')}
      ${row('flash','Damage flash','The red vignette when struck.')}
      ${row('hitstop','Hit stop','The 4–9 frame impact freeze. Turning this off makes combat feel thinner, which is the point of telling thee.')}
      ${row('crt','Ash filter','A soft grain over the whole frame.')}
      ${row('colourblind','High-contrast telegraphs','Attack telegraphs become white instead of ember-orange.')}
    </div><div>
      <h6 class="sec">Information</h6>
      ${row('dmgNumbers','Damage numbers','Floating numbers on every hit.')}
      ${row('showPoise','Poise rim on the body','A ring around the Hollow coloured by poise grade.')}
      ${row('showFps','Frame time','Vol 3 §3.13 — the prototype must hold 60 fps.')}
      <h6 class="sec">Assistance</h6>
      ${row('lockonAssist','Lock-on assistance','Snaps to the nearest valid target within 30 m.')}
      ${row('gore','Blood and severance','Turn off to replace blood with ash.')}
      <h6 class="sec">Controls — Vol 3 §3.11</h6>
      <table class="dt"><tbody>
      ${[['Move','W A S D / arrows'],['Light attack','J / LMB'],['Heavy attack / cast','K'],['Guard','L / RMB'],
         ['Roll / backstep','SPACE / MMB (backstep while guarding)'],['Parry','U'],['Weapon Art','I'],
         ['Estus Flask','E'],['Life Gem','G'],['Interact / riposte','F'],['Menu','ESC or TAB'],['Attributes','Z'],
         ['World map','M'],['Lock-on','Q'],['Two-hand / Power Stance','T'],['Swap quick slot','1 2 3 4'],['Gesture','B']]
        .map(([a,b])=>`<tr><td><b>${a}</b></td><td>${b.split(' ').map(x=>`<kbd>${x}</kbd>`).join(' ')}</td></tr>`).join('')}
      </tbody></table>
      <div class="note">Gamepad: standard mapping. A roll, X light, Y heavy, RB guard, LB parry, RT sprint,
        LT Weapon Art, D-pad items, Options menu.</div>
    </div></div>`;
    const body=$('#setBody'); if(body){ body.innerHTML=SETTINGS_HTML; this.wireSettings(body) }
  },
  wireSettings(root){
    root.querySelectorAll('[data-set]').forEach(inp=>{
      inp.addEventListener('input',()=>{
        const k=inp.dataset.set;
        SETTINGS[k] = inp.type==='checkbox'? inp.checked : parseFloat(inp.value);
        if(inp.type==='range') inp.nextElementSibling.textContent=Math.round(SETTINGS[k]*100)+'%';
        Set_.save(SETTINGS); Audio_.setVol();
        if(this.menuOpen&&this.tab==='set') { const sc=$('#menuBody').scrollTop; this.renderTab(); $('#menuBody').scrollTop=sc }
      });
    });
  },

  /* ---------------- codex ---------------- */
  buildCodex(){
    CODEX_HTML=`<div class="grid2">
    <div>
      <h6 class="sec" id="about">What this is</h6>
      <div class="note" style="font-size:11px">A playable vertical slice of <b>Dark Souls: Convergence of Ash &amp; Want</b>,
        the ten-volume Game Design Document in <code>docs/gdd/</code>. Every system below is implemented with the
        numbers from that document — not approximations of them. Where the document's own arithmetic disagreed with
        itself (the three reference builds' HP totals), the game implements a formula and the document was corrected.</div>
      <h6 class="sec">The Fusion Contract — Vol 3 §3.1</h6>
      <table class="dt"><thead><tr><th>From</th><th>Taken</th><th>Rejected</th></tr></thead><tbody>
        <tr><td><b>DS3</b></td><td>Movement tempo, i-frame rolls, Weapon Arts + FP, hit stop</td><td>Poise as a hidden stagger meter</td></tr>
        <tr><td><b>DS2</b></td><td>Power Stance at 1.5× requirement, Adaptability, Life Gems, Bonfire Ascetics</td><td>Adaptive difficulty, memory-based i-frames</td></tr>
        <tr><td><b>DS1</b></td><td>TRUE poise, equip-load tiers, seamless interconnectivity, tail cuts</td><td>Weight-based poise without a grade ladder</td></tr>
      </tbody></table>
      <h6 class="sec">Roll tiers — Vol 3 §3.7.1</h6>
      <table class="dt"><thead><tr><th>Tier</th><th>Load</th><th>i-frames</th><th>Total</th><th>Stamina</th><th>Distance</th></tr></thead><tbody>
      ${LOAD_TIERS.map(t=>`<tr><td><b>${t.n}</b></td><td class="num">${t.max===999?'≥100%':'<'+t.max+'%'}</td>
        <td class="num">${t.iframe}f</td><td class="num">${t.total}f</td><td class="num">${t.cost}</td><td class="num">${t.dist}px</td></tr>`).join('')}
      </tbody></table>
      <div class="note">ADP scales i-frames: iframe = tier.iframe × clamp(1 + (ADP−10)×0.010, 0.90, 1.25).
        At ADP 16 a mid roll is 14 frames, not 13. Vol 2 §2.3.9 calls Adaptability "the stat nobody buys and everybody needs".</div>
      <h6 class="sec">True poise — Vol 3 §3.7</h6>
      <table class="dt"><thead><tr><th>Grade</th><th>Poise</th><th>Mitigation</th><th>Threshold</th></tr></thead><tbody>
      ${POISE_GRADES.map((g,i)=>`<tr><td><b>Grade ${g.g}</b></td><td class="num">${g.min}${i<4?'–'+(POISE_GRADES[i+1].min-1):'+'}</td>
        <td class="num">${(g.min*0.5).toFixed(0)}%+</td><td class="num">${20+g.min*2}</td></tr>`).join('')}
      </tbody></table>
      <div class="note">mitigation = min(0.70, poise × 0.005) · threshold = 20 + poise × 2.
        Every hit spends thy poise budget; when it empties thou staggerest and the budget resets.
        Permanent maximum is <b>${MAX_POISE+4}</b> (Remnant Dragon 96 + Warden's Greaves 4 − 4 mixed + Havel's Greatshield 17 + Ring of Blades 3).
        Temporary maximum is <b>${MAX_POISE+4+TEMP_POISE_BULWARK}</b> with Bulwark of the Greatshield, which is the only way to reach the 70% mitigation cap.</div>
      <h6 class="sec">Power Stance &amp; Posture Break — Vol 3 §3.6</h6>
      <table class="dt"><tbody>
        <tr><td>Requirement</td><td class="num">× ${PS_REQ_MULT}</td><td>max(STR req, DEX req) of both weapons</td></tr>
        <tr><td>Stance posture damage</td><td class="num">× ${PS_POSTURE_MULT}</td><td>× ${(PS_POSTURE_MULT*1.5).toFixed(1)} on the finisher</td></tr>
        <tr><td>Non-stance posture</td><td class="num">× ${NON_STANCE_POSTURE}</td><td>why mashing light attack never breaks a guard</td></tr>
        <tr><td>MAX_POSTURE</td><td class="num">100 + poise×1.5</td><td>decay ${POSTURE_DECAY}/s after ${POSTURE_DECAY_DELAY}s</td></tr>
        <tr><td>Break</td><td class="num">${POSTURE_STAGGER}s stagger</td><td>bosses ${4.0}s, once per phase, ${POSTURE_IMMUNE}s immunity</td></tr>
        <tr><td>Riposte</td><td class="num">× ${PARRY.riposte}</td><td>on a broken posture or a parry</td></tr>
      </tbody></table>
      <h6 class="sec">Parry — Vol 3 §3.5</h6>
      <div class="note">${PARRY.startup}f startup · ${PARRY.active}f active (frames ${PARRY.window[0]}–${PARRY.window[1]}) · ${PARRY.total}f total · ${PARRY.sta} stamina.
        A successful parry deals no damage, sets the target ripostable for 1.4 s, and refunds nothing. It is purely a timing bet.</div>
    </div>
    <div>
      <h6 class="sec">Boss grammar — Vol 6 §6.0</h6>
      <ol style="font:11px/1.85 var(--mono);color:#a89c85;padding-left:18px">
      ${BOSS_RULES.map(r=>`<li>${r}</li>`).join('')}</ol>
      <h6 class="sec">The three bosses</h6>
      ${Object.entries(BOSSES).map(([k,b])=>`<div class="pick" style="margin-bottom:8px">
        <h4>${b.n}</h4>
        <p>${b.region} · SL ${b.sl} · HP ${fmt(b.hp)} · poise ${b.poise} (Grade ${b.grade}) · posture ${b.posture} · ${fmt(b.souls)} souls</p>
        <p>${b.part?`Severance: <i>${b.part.n}</i> — ${b.part.dmgType} type, rewards ${b.part.reward}.`:'No severable part (the tutorial boss teaches, it does not pay).'}</p>
        <p style="color:#6b6154">${b.music}</p>
        <p style="color:var(--gold-l)">${b.phases.map(p=>p.n).join(' → ')}</p></div>`).join('')}
      <h6 class="sec">Healing contract — Vol 7 §7.1/§7.2</h6>
      <table class="dt"><tbody>
        <tr><td>Estus</td><td class="num">${ESTUS_HEAL(0)} → ${ESTUS_HEAL(10)}</td><td>+0 → +10, instant, immobile, ${ESTUS_MAX} max</td></tr>
        <tr><td>Estus drink</td><td class="num">${ESTUS_FRAMES(10)}f @ ADP 10</td><td>ADP shortens it: ${ESTUS_FRAMES(20)}f @ ADP 20</td></tr>
        <tr><td>Life Gem</td><td class="num">${GEM_HEAL} / ${GEM_TIME}s</td><td>${GEM_HEAL/GEM_TIME} HP per second, mobile</td></tr>
        <tr><td>Gem penalty</td><td class="num">−${GEM_PENALTY*100}%/use</td><td>floor ${GEM_FLOOR*100}% move speed, carry ${GEM_CARRY}</td></tr>
      </tbody></table>
      <div class="note">The contract: Estus is a combat action, Life Gems are a movement action.
        A boss that reads healing (Vol 6 §6.0 rule 3) punishes the first and not the second — which is why every
        boss in this prototype delays its punish by 0.62 s rather than firing on the input.</div>
      <h6 class="sec">Bonfire Ascetics — Vol 7 §7.3</h6>
      <table class="dt"><thead><tr><th></th><th>HP</th><th>Damage</th><th>Souls</th><th>Aggression</th></tr></thead><tbody>
      ${ASCETIC.map((a,i)=>`<tr><td><b>${a.n}</b></td><td class="num">×${a.hp.toFixed(2)}</td><td class="num">×${a.dmg.toFixed(2)}</td>
        <td class="num">×${a.souls.toFixed(2)}</td><td class="num">${i===0?'—':'+'+(i*12)+'% cd speed'}</td></tr>`).join('')}
      </tbody></table>
      <div class="note">Burning an Ascetic raises <b>one region only</b> to the next local NG+. At A4 that region spawns one of the
        fourteen Kindled Echoes (${ECHOES.slice(0,5).join(', ')}… Vol 7 §7.3.4). Rank 3 of any covenant requires an Ascetic burned
        in that covenant's home region — the difficulty system is a progression requirement.</div>
      <h6 class="sec">WANT &amp; Resonance — Vol 4 §4.5</h6>
      <table class="dt"><tbody>
        <tr><td>WANT max</td><td class="num">${WANT_MAX}</td><td>never decreases, regen 1/${WANT_REGEN_OUT}s out · 1/${WANT_REGEN_IN}s in</td></tr>
        ${RES_LADDER.map(r=>`<tr><td><b>Resonance ${r.r}</b></td><td class="num">+${Math.round(r.bonus*100)}%</td>
          <td>${r.r===3?'dark damage · poise Grade ≤2 cannot stagger thee · FP refund on kill':r.r===0?'baseline':'dark damage'}</td></tr>`).join('')}
        <tr><td>Overdraft</td><td class="num">HP = FP × 1.8</td><td>casting with a full WANT meter</td></tr>
      </tbody></table>
      <h6 class="sec">Severance — Vol 3 §3.9</h6>
      <div class="note">${SEVERANCE.parts} parts across ${SEVERANCE.bosses} bosses, each with a required damage type
        (SLASH / STRIKE / PIERCE / FIRE / ANY). Wrong type deals 45% and prints WRONG TYPE over the part.
        Vhenn of the Transposition in the Undercroft turns parts into weapons.</div>
      <h6 class="sec">Endings — Vol 1 §1.7</h6>
      ${ENDINGS.map(e=>`<div class="pick" style="margin-bottom:6px"><h4 style="color:${e.col}">${e.n}</h4>
        <p>${e.kick} — <i>${e.req}</i></p></div>`).join('')}
      <div class="note">Six endings are specified in Vol 1 §1.7; three are reachable here. The hidden ending
        (Usurper of the Abyss) needs five Dark Sigils, rank 2+ in two covenants, and all fourteen Kindled Echoes alive —
        this prototype tracks the sigils and covenant ranks and tells thee what is missing.</div>
    </div></div>`;
    $('#codexBody').innerHTML=CODEX_HTML;
  },
  codexSection(id){ const e=document.getElementById(id); if(e) e.scrollIntoView({behavior:'smooth',block:'start'}) },

  /* ---------------- pick handlers ---------------- */
  pick(kind,val){
    const p=Game.player; if(!p && kind!=='warpZone') return;
    switch(kind){
      case 'level': Game.levelUp(val); break;
      case 'cycle': Game.cycleGear(val); break;
      case 'ring': Game.cycleRing(+val); break;
      case 'qs': Game.bindQuick(val); break;
      case 'use': Game.useItem(val); break;
      case 'consumeSoul': Game.consumeSoul(val); break;
      case 'attune': Game.attune(val); break;
      case 'unattune': Game.player.attuned[+val]=null; Game.save(); break;
      case 'upgrade': Game.upgradeWeapon(val); break;
      case 'infuse': { const [w,i]=val.split('|'); Game.infuse(w,i); break }
      case 'covenant': Game.swear(val); break;
      case 'abjure': Game.swear('None'); break;
      case 'warp': Game.warp(val); break;
      case 'warpZone': break;
      case 'asceticHere': Game.burnAscetic(val); break;
      case 'transpose': Game.transpose(val); break;
      case 'takeGift': Game.takeGift(val); break;
      case 'kindleDo': Game.kindle(); break;
      case 'allocate': Game.allocate(val); break;
      case 'talkNpc': Game.talkNpc(val); break;
      case 'closeTalk': Game.closeTalk(); break;
      case 'ending': Game.chooseEnding(val); break;
      case 'rest': Game.rest(); break;
      case 'leaveBoss': Game.leaveBoss(); break;
    }
    if(this.menuOpen) this.renderTab();
  },

  /* ---------------- modal pieces ---------------- */
  bonfireMenu(bf){
    const p=Game.player;
    const ov=$('#ovMenu'); this.menuOpen=true;
    $('#menuTabs').innerHTML=`<button data-tab="rest" class="on">Rest</button><button data-tab="level">Level</button>
      <button data-tab="allocate">Estus</button><button data-tab="ascetic">Ascetic</button><button data-tab="warp2">Warp</button>
      <button data-tab="kindle">Kindle</button>`;
    this.bfTab='rest'; this.bf=bf;
    $('#menuTabs').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{
      this.bfTab=b.dataset.tab; $('#menuTabs').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b)); this.renderBonfire() }));
    this.show('#ovMenu'); this.renderBonfire();
  },
  renderBonfire(){
    const p=Game.player, bf=this.bf, B=$('#menuBody');
    const asc=Game.ascetic[World.zoneId]||0;
    $('#menuSoul').innerHTML=`Souls <b>${fmt(p.souls)}</b> · ${bf.n}`;
    if(this.bfTab==='rest') B.innerHTML=`<h6 class="sec">Rest at ${bf.n}</h6>
      <div class="note" style="font-size:12px">Resting refills thy Estus and Life Gems, and respawns every enemy in this region
        — except bosses. Vol 7 §7.1.1: the bonfire is a decision, not a checkpoint.</div>
      <table class="dt"><tbody>
        <tr><td>Estus charges</td><td class="num">${p.estus} / ${p.estusMax}</td><td>heals ${ESTUS_HEAL(Game.estusUpg)} each</td></tr>
        <tr><td>Life Gems</td><td class="num">${p.gems} / ${GEM_CARRY}</td><td>${GEM_HEAL} over ${GEM_TIME}s</td></tr>
        <tr><td>Region ascetic</td><td class="num">A${asc}</td><td>HP ×${ASCETIC[asc].hp.toFixed(2)} · damage ×${ASCETIC[asc].dmg.toFixed(2)} · souls ×${ASCETIC[asc].souls.toFixed(2)}</td></tr>
        <tr><td>HP / FP / Stamina</td><td class="num">${Math.round(p.hp)}/${Math.round(p.fp)}/${Math.round(p.sta)}</td><td>all restored on rest</td></tr>
      </tbody></table>
      <p style="margin-top:16px"><button data-pick="rest">Rest</button></p>`;
    else if(this.bfTab==='level'){ $('#menuTabs').innerHTML=$$('#menuTabs').length?$('#menuTabs').innerHTML:'';
      this.tab='stats'; UI.menuOpen=true; UI.show('#ovMenu');
      $('#menuTabs').innerHTML=`<button data-tab="stats" class="on">Attributes</button><button data-tab="equip">Equipment</button>
        <button data-tab="bag">Inventory</button><button data-tab="magic">Attunement</button><button data-tab="smith">Blacksmith</button>
        <button data-tab="cov">Covenants</button><button data-tab="map">World</button><button data-tab="codex">Codex</button><button data-tab="set">Settings</button>`;
      $$('#menuTabs button').forEach(b=>b.onclick=()=>UI.openTab(b.dataset.tab));
      UI.renderTab(); return; }
    else if(this.bfTab==='allocate') B.innerHTML=`<h6 class="sec">Estus allocation — Vol 7 §7.1.3</h6>
      <div class="note">The pool is ${p.allocation.estus+p.allocation.ash} points: 1 point = 1 Estus charge, 2 points = 1 Ashen Estus charge.
        Shards add to the pool (${p.shards} Estus Shards, ${p.ashShards} Ashen).</div>
      <div class="setRow"><span class="nm">Estus Flask charges</span><b style="font:16px var(--mono);color:var(--gold-l);width:40px;text-align:center">${p.allocation.estus}</b>
        <button data-pick="allocate" data-v="estus+">+1</button><button data-pick="allocate" data-v="estus-">−1</button></div>
      <div class="setRow"><span class="nm">Ashen Estus charges (FP)</span><b style="font:16px var(--mono);color:var(--gold-l);width:40px;text-align:center">${p.allocation.ash}</b>
        <button data-pick="allocate" data-v="ash+">+1</button><button data-pick="allocate" data-v="ash-">−1</button></div>
      <div class="note">Pool = 5 + ${p.shards} shards = <b>${5+p.shards}</b>. Ashen Estus costs 2 points per charge.</div>`;
    else if(this.bfTab==='ascetic') B.innerHTML=`<h6 class="sec">Burn a Bonfire Ascetic — Vol 7 §7.3</h6>
      <div class="note">This raises <b>${World.zone.n}</b> and only ${World.zone.n} to the next local NG+.
        Enemies respawn stronger, loot tables improve, aggression rises. At A4 the region's Kindled Echo appears.
        Thou hast <b>${p.inv.items['Bonfire Ascetic']||0}</b> Ascetics.</div>
      <table class="dt"><thead><tr><th></th><th>HP</th><th>Damage</th><th>Souls</th></tr></thead><tbody>
      ${ASCETIC.map((a,i)=>`<tr${i===asc?' style="background:rgba(200,163,90,.10)"':''}><td><b>${a.n}</b></td>
        <td class="num">×${a.hp.toFixed(2)}</td><td class="num">×${a.dmg.toFixed(2)}</td><td class="num">×${a.souls.toFixed(2)}</td></tr>`).join('')}
      </tbody></table>
      <p style="margin-top:14px"><button data-pick="asceticHere" data-v="${bf.id}" ${(p.inv.items['Bonfire Ascetic']||0)>0&&asc<4?'':'disabled'}>Burn an Ascetic here</button></p>
      ${asc>=4?`<div class="note" style="color:#e2a34a">A4 reached. ${ECHOES[(Game.asceticEcho[World.zoneId]||0)%ECHOES.length]} now walks this region.</div>`:''}`;
    else if(this.bfTab==='warp2') B.innerHTML=`<h6 class="sec">Warp — Vol 5 §5.7</h6>
      <div class="grid3">${Object.values(ZONES).flatMap(z=>(z.bonfires||[]).map(b=>({b,z}))).filter(o=>o.b.warp&&(Game.litBonfires[o.b.id]||o.b.first))
        .map(({b,z})=>`<div class="pick ${b.id===Game.lastBonfire?'on':''}" data-pick="warp" data-v="${b.id}" style="cursor:pointer">
          <h4>${b.n}</h4><p>${z.n} · SL ${z.sl} · A${Game.ascetic[z.id]||0}</p></div>`).join('')}</div>`;
    else if(this.bfTab==='kindle') B.innerHTML=`<h6 class="sec">Kindle</h6>
      <div class="note">Kindling costs ${fmt(1000+ (bf.kindled||0)*1500)} souls and adds +5 Estus charges at this fire permanently.
        Kindled: <b>${bf.kindled||0}</b> times.</div>
      <p><button data-pick="kindleDo" ${p.souls>=1000+(bf.kindled||0)*1500?'':'disabled'}>Kindle (${fmt(1000+(bf.kindled||0)*1500)} souls)</button></p>`;
    B.querySelectorAll('[data-pick]').forEach(b=>{});
  },
  npcMenu(npc){
    this.menuOpen=true;
    $('#menuTabs').innerHTML = `<button data-tab="talk" class="on">Speak</button>`+
      (npc.acts.includes('level')?'<button data-tab="level">Level</button>':'')+
      (npc.acts.includes('smith')?'<button data-tab="smith">Reinforce &amp; Infuse</button>':'')+
      (npc.acts.includes('transpose')?'<button data-tab="transpose">Transposition</button>':'')+
      (npc.acts.includes('covenant')?'<button data-tab="cov">Oaths</button>':'')+
      (npc.acts.includes('gift')?'<button data-tab="gift">Gift</button>':'');
    $$('#menuTabs button').forEach(b=>b.onclick=()=>{
      $$('#menuTabs button').forEach(x=>x.classList.toggle('on',x===b));
      if(b.dataset.tab==='talk') this.renderTalk(npc);
      else if(b.dataset.tab==='level'){ this.tab='stats'; this.restoreTabs(); this.renderTab() }
      else if(b.dataset.tab==='smith'){ this.tab='smith'; this.restoreTabs(); this.renderTab() }
      else if(b.dataset.tab==='cov'){ this.tab='cov'; this.restoreTabs(); this.renderTab() }
      else if(b.dataset.tab==='transpose') this.renderTranspose(npc);
      else if(b.dataset.tab==='gift') this.renderGift(npc);
    });
    this.show('#ovMenu'); this.renderTalk(npc);
  },
  restoreTabs(){
    $('#menuTabs').innerHTML=`<button data-tab="stats">Attributes</button><button data-tab="equip">Equipment</button>
      <button data-tab="bag">Inventory</button><button data-tab="magic">Attunement</button><button data-tab="smith">Blacksmith</button>
      <button data-tab="cov">Covenants</button><button data-tab="map">World</button><button data-tab="codex">Codex</button><button data-tab="set">Settings</button>`;
    $$('#menuTabs button').forEach(b=>{ b.classList.toggle('on',b.dataset.tab===this.tab); b.onclick=()=>UI.openTab(b.dataset.tab) });
  },
  renderTalk(npc){
    const B=$('#menuBody');
    B.innerHTML=`<h6 class="sec">${npc.n}</h6>
      <div style="border-left:2px solid ${npc.col};padding-left:16px;margin-bottom:18px">
      <p style="font-size:14px;line-height:1.9;color:#cfc4ae;font-style:italic">${npc.talk[npc.talkIdx||0]}</p></div>
      <p><button data-pick="talkNpc" data-v="${npc.id}">Continue</button>
         <button data-pick="closeTalk" class="ghost" style="margin-left:8px">Leave</button></p>
      <div class="note">Dialogue index ${(npc.talkIdx||0)+1} of ${npc.talk.length}.</div>`;
  },
  renderTranspose(npc){
    const p=Game.player, B=$('#menuBody');
    const parts=p.severed;
    B.innerHTML=`<h6 class="sec">Vhenn of the Transposition — Vol 7 §7.5</h6>
      <div class="note">"Bring me a soul that is still shaped like its owner." Vhenn turns severed parts and boss souls
        into weapons nobody else can make. ${SEVERANCE.parts} parts exist across ${SEVERANCE.bosses} bosses.</div>
      <table class="dt"><thead><tr><th>Offering</th><th>Held</th><th>Becomes</th><th></th></tr></thead><tbody>
      ${[["Herald's Tail","Herald's Ash Pike +1 (PIERCE, 26 poise damage, Art: Pierce the Ash)"],
         ["Ember-Forged Crown","Karrag's Hammer (STRIKE, 34 poise damage, Art: Forge Strike)"],
         ["Lurker's Barb","Lurker's Barb (dagger, bleed 34)"],
         ["Soul of Vharos","24,000 souls, or the Herald's Sash (armour, poise 12)"],
         ["Soul of Karrag","19,000 souls, or the Ember-Forged Crown (head, poise 9, fire res 34)"],
         ["Soul of the Hollow Sovereign","6,000 souls, or the Empty Crown (ring: +1 spell slot)"]]
        .map(([k,out])=>{
          const have = parts.includes(k) || (p.inv.items[k]||0)>0;
          return `<tr><td><b>${k}</b></td><td class="num">${have?'<i>held</i>':'—'}</td><td>${out}</td>
            <td>${have?`<button data-pick="transpose" data-v="${k}">Transpose</button>`:''}</td></tr>`}).join('')}
      </tbody></table>`;
  },
  renderGift(npc){
    const B=$('#menuBody');
    B.innerHTML=`<h6 class="sec">${npc.n}</h6><div class="note">The child will give thee a small sun. It does nothing.
      Vol 7 §7.7 tracks it because Vol 5 §5.5.5 lights a bonfire on the fourth meeting.</div>
      <p><button data-pick="takeGift" data-v="${npc.id}">Accept</button></p>`;
  },
  endingScreen(id){
    const e=ENDINGS.find(x=>x.id===id), p=Game.player;
    $('#endTitle').textContent=e.n; $('#endTitle').style.color=e.col;
    $('#endKicker').textContent=e.kick+' · requirement: '+e.req;
    $('#endBody').innerHTML=e.body.map(t=>`<p>${t}</p>`).join('');
    $('#endStats').innerHTML=`
      <div><b>${p.level_}</b><span>final level</span></div>
      <div><b>${p.deaths}</b><span>deaths</span></div>
      <div><b>${p.kills}</b><span>kills</span></div>
      <div><b>${Game.playTimeStr()}</b><span>time</span></div>
      <div><b>${p.bossesKilled.length}/3</b><span>bosses</span></div>
      <div><b>${p.severed.length}/31</b><span>parts severed</span></div>
      <div><b>${p.sigils}/8</b><span>dark sigils</span></div>
      <div><b>${fmt(p.bank)}</b><span>souls earned</span></div>`;
    this.show('#ovEnding');
  },
  /* ---------------- HUD ---------------- */
  hud(){
    const p=Game.player; if(!p) return;
    const d=p.d;
    const hpPct=clamp(p.hp/p.maxHp*100,0,100);
    $('#hpFill').style.width=hpPct+'%';
    const gh=$('#hpGhost'); gh.style.width=(p.hpGhost!==undefined?clamp(p.hpGhost/p.maxHp*100,0,100):hpPct)+'%';
    $('#fpFill').style.width=clamp(p.fp/p.maxFp*100,0,100)+'%';
    $('#staFill').style.width=clamp(p.sta/p.maxSta*100,0,100)+'%';
    $('#hpTxt').textContent=Math.ceil(p.hp)+' / '+d.hp;
    $('#fpTxt').textContent=Math.ceil(p.fp)+' / '+d.fp;
    $('#staTxt').textContent=Math.ceil(p.sta)+' / '+d.sta;
    const pd=$('#poiseDiamond'); pd.className='g'+d.grade; pd.id='poiseDiamond';
    $('#poiseGrade').textContent=d.grade;
    $('#poiseVal').textContent='POISE '+d.poise+(p.tempPoise? ' (+'+p.tempPoise+')':'');
    $('#poiseThr').textContent='THRESHOLD '+d.threshold+' · MIT '+(d.mitigation*100).toFixed(0)+'% · '+d.tier.n+' '+d.iframe+'f';
    const ei=$('#estusIcon'); ei.classList.toggle('empty',p.estus<=0); $('#estusN').textContent=p.estus;
    $('#gemIcon').classList.toggle('empty',p.gems<=0);
    $('#gemIcon').title=`Life Gem ×${p.gems} — ${GEM_HEAL} HP over ${GEM_TIME}s (G)`;
    const st=$('#stanceTag'); const ps=p.powerStance;
    if(ps){ st.classList.remove('hidden'); st.textContent = ps.ok?'✦ POWER STANCE':'✦ STANCE NEEDS '+ps.need+' '+ps.stat;
      st.style.opacity=ps.ok?1:.5 } else st.classList.add('hidden');
    const rt=$('#resTag');
    if(p.want>0){ rt.classList.remove('hidden'); rt.textContent='WANT '+p.want+' · RES '+p.resonance } else rt.classList.add('hidden');
    $('#soulsTag').innerHTML=`SOULS<b>${fmt(p.souls)}</b>SL ${p.level_} · ${World.zone?World.zone.n:''}`;
    const wm=$('#wantMeter');
    if(p.want>0||p.resonance>0){ wm.classList.remove('hidden'); $('#wantFill').style.width=(p.want/WANT_MAX*100)+'%' } else wm.classList.add('hidden');
    // quickslots
    const qs=$('#quickslots');
    if(qs.children.length!==4){ qs.innerHTML=''; for(let i=0;i<4;i++){ const e2=el('div','qs'); e2.innerHTML=`<b>${i+1}</b><span></span><em></em>`; qs.appendChild(e2) } }
    for(let i=0;i<4;i++){
      const e2=qs.children[i], k=p.quickslot[i];
      e2.classList.toggle('sel',i===p.qs); e2.classList.toggle('off',!k||(p.inv.items[k]||0)<=0);
      e2.querySelector('span').textContent = k? ITEM_ICON[k]||'◆' : '';
      e2.querySelector('em').textContent = k? (p.inv.items[k]||0) : '';
      e2.title = k? (CONSUMABLES[k]?.note||k) : 'empty';
    }
    // boss bar
    const b=Game.bossFight;
    if(b&&!b.dead){
      $('#bossBar').classList.remove('hidden');
      $('#bossName').textContent=b.name;
      $('#bossPhase').textContent=b.def_.phases[b.phase].n;
      $('#bossFill').style.width=clamp(b.hp/b.maxHp*100,0,100)+'%';
      const pp=$('#bossParts');
      pp.innerHTML=(b.part?`<span class="${b.part.sev?'sev':''}">${b.part.n} · ${b.part.type}</span>`:'')+
        (b.posture>0?`<span>POSTURE ${Math.round(b.posture/b.maxPosture*100)}%</span>`:'')+
        (b.poiseDmg>0?`<span>POISE ${Math.round(b.poiseDmg/b.threshold*100)}%</span>`:'');
    } else $('#bossBar').classList.add('hidden');
  },
  prompt(show,key,txt){
    const p=$('#prompt');
    if(!show){ p.classList.add('hidden'); return }
    p.classList.remove('hidden'); $('#promptKey').textContent=key; $('#promptTxt').textContent=txt;
  },
  toast(msg,dur=2.2){
    const t=$('#toast'); t.textContent=msg; t.classList.add('on');
    clearTimeout(this._tt); this._tt=setTimeout(()=>t.classList.remove('on'),dur*1000);
  },
  hurtFlash(a){ if(!SETTINGS.flash) return; const f=$('#flash'); f.style.opacity=Math.min(0.9,a*1.6);
    clearTimeout(this._ft); this._ft=setTimeout(()=>f.style.opacity=0,120) },
  deathFade(on){ $('#deathFade').style.opacity=on?1:0 },
};
const ITEM_ICON={'Ember':'🜂','Human Effigy':'🜂','Life Gem':'✚','Charcoal Pine Resin':'🔥','Gold Pine Resin':'⚡',
  'Dark Pine Resin':'🌑','Alluring Skull':'☠','Firebomb':'✸','Titanite Shard':'▲','Titanite Chunk':'◆','Titanite Slab':'■',
  'Estus Shard':'⬥','Ashen Estus Shard':'⬦','Bonfire Ascetic':'✹','Cracked Red Eye Orb':'◉','White Sign Soapstone':'▭',
  'The Small Sun':'☀','Herald\u2019s Tail':'〜','Ember-Forged Crown':'♛','Vharos Soul':'✦','Karrag Soul':'✦','Sovereign Soul':'✦'};
let CODEX_HTML='', SETTINGS_HTML='';

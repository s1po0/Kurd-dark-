/* =====================================================================
   input.js — keyboard + mouse + gamepad, mapped to design-language actions
   Vol 3 §3.11 (controls), Vol 9 §9.6 (remapping-free accessibility)
   ===================================================================== */
'use strict';
const Input = {
  down:{}, pressed:{}, released:{},
  mx:0, my:0, mdown:{}, mpressed:{},
  pad:{connected:false, axes:[0,0,0,0], buttons:{}},
  map:{
    moveUp:['KeyW','ArrowUp'], moveDown:['KeyS','ArrowDown'], moveLeft:['KeyA','ArrowLeft'], moveRight:['KeyD','ArrowRight'],
    light:['KeyJ'], heavy:['KeyK'], guard:['KeyL'], roll:['Space'], sprint:['ShiftLeft','ShiftRight'],
    parry:['KeyU'], walk:['KeyC'], art:['KeyI'],
    estus:['KeyE'], gem:['KeyG'], item1:['Digit1'], item2:['Digit2'], item3:['Digit3'], item4:['Digit4'],
    interact:['KeyF'], menu:['Escape','Tab'], stats:['KeyZ'], map:['KeyM'], gesture:['KeyB'],
    lockon:['KeyQ'], swapHands:['KeyX'], twoHand:['KeyT'],
    confirm:['Enter','KeyJ'], back:['Escape','KeyL'],
  },
  actionMap:{}, // code -> [actions]
  init(canvas){
    for(const [a,codes] of Object.entries(this.map))
      for(const c of codes) (this.actionMap[c]=this.actionMap[c]||[]).push(a);
    addEventListener('keydown',e=>{
      if(['Space','Tab','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
      if(!e.repeat){ const as=this.actionMap[e.code]||[]; for(const a of as) this.pressed[a]=true; }
      this.down[e.code]=true;
      if(e.code==='F11'){e.preventDefault()}
    });
    addEventListener('keyup',e=>{
      this.down[e.code]=false;
      const as=this.actionMap[e.code]||[]; for(const a of as) this.released[a]=true;
    });
    addEventListener('blur',()=>{ this.down={}; this.mdown={}; });
    canvas.addEventListener('mousemove',e=>{ const r=canvas.getBoundingClientRect();
      this.mx=(e.clientX-r.left)*(canvas.width/r.width); this.my=(e.clientY-r.top)*(canvas.height/r.height); });
    canvas.addEventListener('mousedown',e=>{ canvas.focus();
      if(!this.mdown[e.button]) this.mpressed[e.button]=true; this.mdown[e.button]=true; });
    addEventListener('mouseup',e=>{ this.mdown[e.button]=false; });
    canvas.addEventListener('contextmenu',e=>e.preventDefault());
    addEventListener('gamepadconnected',e=>{ this.pad.connected=true; });
    addEventListener('gamepaddisconnected',()=>{ this.pad.connected=false; });
  },
  /* is an action currently held */
  held(a){
    if((this.map[a]||[]).some(c=>this.down[c])) return true;
    // mouse bindings: LMB light, RMB guard, MMB roll
    if(a==='light' && this.mdown[0]) return true;
    if(a==='guard' && this.mdown[2]) return true;
    if(a==='roll'  && this.mdown[1]) return true;
    if(a==='interact' && this.mdown[0] && this._interactHold) return true;
    return this.gpHeld(a);
  },
  /* was an action pressed this frame */
  hit(a){
    if(this.pressed[a]) return true;
    if(a==='light' && this.mpressed[0]) return true;
    if(a==='guard' && this.mpressed[2]) return true;
    if(a==='roll'  && this.mpressed[1]) return true;
    return this.gpHit(a);
  },
  /* analogue movement vector, magnitude 0..1 */
  move(){
    let x=0,y=0;
    if(this.held('moveLeft'))x-=1; if(this.held('moveRight'))x+=1;
    if(this.held('moveUp'))y-=1;   if(this.held('moveDown'))y+=1;
    if(this.pad.connected){
      const [ax,ay]=this.pad.axes;
      if(Math.hypot(ax,ay)>0.22){ x=ax; y=ay; }
    }
    const l=Math.hypot(x,y);
    if(l>1){x/=l;y/=l;}
    return {x,y,mag:Math.min(1,l)};
  },
  /* camera aim from the mouse, in world space (set by main each frame) */
  aimWorld:null,
  gpHeld(a){
    if(!this.pad.connected) return false;
    const b=this.pad.buttons, G=GP_BIND[a];
    return G!==undefined && !!b[G];
  },
  gpHit(a){
    if(!this.pad.connected) return false;
    const b=this.pad.prev||{}, G=GP_BIND[a];
    return G!==undefined && !!this.pad.buttons[G] && !b[G];
  },
  pollPad(){
    if(!this.pad.connected){ const g=navigator.getGamepads?.()[0]; if(g){this.pad.connected=true;} }
    const g=navigator.getGamepads?.()[0];
    if(!g) { this.pad.connected=false; return; }
    this.pad.axes=[Math.abs(g.axes[0])<0.18?0:g.axes[0], Math.abs(g.axes[1])<0.18?0:g.axes[1]];
    this.pad.buttons={}; for(let i=0;i<g.buttons.length;i++) this.pad.buttons[i]=g.buttons[i].pressed || g.buttons[i].value>0.4;
    this.pad.connected=true;
  },
  endFrame(){ this.pressed={}; this.released={}; this.mpressed={}; this.pad.prev=Object.assign({},this.pad.buttons); },
  anyKey(){ return Object.keys(this.pressed).length>0 || Object.values(this.mpressed).some(Boolean); },
  keyLabel(a){
    const c=(this.map[a]||[])[0]||'';
    return c.replace('Key','').replace('Digit','').replace('Arrow','')
            .replace('Space','SPACE').replace('ShiftLeft','SHIFT').replace('Escape','ESC').replace('Tab','TAB');
  },
};
/* Standard gamepad layout (Vol 3 §3.11.4) */
const GP_BIND = {
  light:2, heavy:3, roll:1, guard:5, sprint:7, parry:4, art:0,
  estus:6, gem:10, interact:2, menu:9, stats:8, map:11,
  item1:12, item2:13, item3:14, item4:15, lockon:10, twoHand:1, swapHands:4, gesture:3,
};

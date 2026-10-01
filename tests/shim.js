/* minimal DOM/canvas shim so the game can be smoke-tested headlessly */
const store=new Map();
function mkEl(id){
  const e={ id, tagName:'DIV', _cls:new Set(), style:{}, dataset:{}, children:[], innerHTML:'', textContent:'',
    disabled:false, value:'', checked:false, title:'', scrollTop:0,
    classList:{ add:c=>e._cls.add(c), remove:c=>e._cls.delete(c), toggle:(c,v)=>{v===undefined?(e._cls.has(c)?e._cls.delete(c):e._cls.add(c)):(v?e._cls.add(c):e._cls.delete(c))}, contains:c=>e._cls.has(c) },
    get className(){ return [...e._cls].join(' ') }, set className(v){ e._cls=new Set(String(v).split(/\s+/).filter(Boolean)) },
    appendChild(c){ e.children.push(c); return c }, removeChild(c){ e.children=e.children.filter(x=>x!==c) },
    addEventListener(){}, removeEventListener(){}, focus(){},
    querySelector(){ return mkEl('q') }, querySelectorAll(){ return [] },
    closest(){ return null }, getBoundingClientRect(){ return {left:0,top:0,width:960,height:540} },
    getContext(){ return ctx }, scrollIntoView(){},
  };
  return e;
}
const noop=()=>{};
const ctx=new Proxy({},{get:(t,k)=>{
  if(k==='canvas') return {width:960,height:540};
  if(k==='createRadialGradient'||k==='createLinearGradient') return ()=>({addColorStop:noop});
  if(k==='measureText') return ()=>({width:10});
  if(k==='getImageData') return ()=>({data:new Uint8ClampedArray(4)});
  return typeof t[k]==='undefined'? noop : t[k];
},set:(t,k,v)=>{t[k]=v;return true}});
const els=new Map();
function q(sel){ const k=String(sel); if(!els.has(k)) els.set(k,mkEl(k)); return els.get(k) }
global.document={ readyState:'loading',
  querySelector:q, querySelectorAll:s=>[], createElement:t=>mkEl(t),
  addEventListener:noop, body:mkEl('body'),
  getElementById:id=>q('#'+id) };
global.localStorage={ getItem:k=>store.has(k)?store.get(k):null, setItem:(k,v)=>store.set(k,String(v)), removeItem:k=>store.delete(k) };
global.addEventListener=noop; global.removeEventListener=noop;
global.innerWidth=1280; global.innerHeight=720; global.devicePixelRatio=1;
global.performance={now:()=>Date.now()};
let rafQ=[]; global.requestAnimationFrame=f=>{rafQ.push(f);return rafQ.length};
global.stepRAF=(t)=>{const q2=rafQ;rafQ=[];q2.forEach(f=>f(t))};
global.navigator={getGamepads:()=>[]};
global.AudioContext=undefined; global.webkitAudioContext=undefined;
global.__els=els;
global.window={addEventListener:()=>{},AudioContext:undefined};

import './booster-pack.js';
import './booster-sound.js';
import {makePackEffects} from './booster-effects.js';
import {cardTypes,packBatches,packRates,makePackInventory} from './pack-odds.js';

export function setupPackTrial(dialog,mountViewer){
 const el=id=>dialog.querySelector('#'+id);
 const wrap=el('pack-wrapper'),mesh=el('pack-mesh'),fallback=el('pack-fallback');
 const tear=el('pack-tear'),action=el('pack-action'),hint=el('pack-hint'),slot=el('pack-card');
 const inventory=el('pack-slots'),count=el('pack-count'),coverInput=el('pack-cover'),clearCover=el('pack-cover-reset');
 const batch=el('pack-batch'),limitField=el('pack-limit'),stockCount=el('pack-stock'),resetStock=el('pack-stock-reset');
 const shakeButtons=[el('pack-shake-horizontal'),el('pack-shake-vertical')];
 const revealAll=el('pack-reveal-all'),returnCards=el('pack-back-to-cards');
 const nextCard=el('pack-next-card');
 let detailIndex=-1;
 const detail=document.createElement('div');
 const stock=makePackInventory();
 const soundButton=el('pack-sound'),sound=window.PackSound;
 const {makeModel,software,sealPoint,lipPoint,pickFront}=window.PackModel;
 const fx=makePackEffects(el('pack-burst'),el('pack-tear-trace'),el('pack-light'));
 let model;
 try{model=makeModel(mesh);}catch{model=null;}
 const renderer=model||software(fallback);
 mesh.hidden=!model;fallback.hidden=!!model;
 const surface=model?mesh:fallback;
 const reduced=matchMedia('(prefers-reduced-motion:reduce)');
 const pose={w:1,h:1,unit:1,dpr:1,tx:0,ty:0,rx:-.10,ry:-.20,rz:.07,flex:0,tug:0,
  tear:0,opening:0,air:1,sway:0,flutter:0,press:0,pressX:0,pressY:0};
 let makeDeck,deck,reservation,revealed=0,generation=0,viewRevision=0,coverRevision=0,coverArt=null,coverURL='';
 let removeViewer=()=>{},phase='sealed',drag,animation=0,rail,stack,openingAt=0,packTier,variant;
 let grip,gripAnimation=0,pressVelocity=0,lastGripFrame=0,shake;
 const rest={tx:0,ty:0,rx:-.10,ry:-.20,rz:.07};
 let slotButtons=[];
 const colors={C:'#a8b6ce',R:'#b4e0ff',SR:'#ffc86b',SSR:'#cb9fff',UR:'#ffb544',
  AUTO:'#fbdee9',SEC:'#9f87ff',RLC:'#f2a46f',ONE:'#b1fff4'};
 const tiers=Object.keys(cardTypes);
 const batchSize=Object.fromEntries(Object.keys(packBatches).map(mode=>[mode,stock.packs(mode)]));
 const simulationLimit={...batchSize};
 function updateStock(){
  const mode=batch.value,opened=batchSize[mode]-stock.packs(mode);
  const remaining=Math.max(0,simulationLimit[mode]-opened);
  stockCount.value='剩余 '+remaining+' / '+simulationLimit[mode]+' 包';
  return remaining;
 }
 function paintOdds(){
  const mode=batch.value;
  limitField.max=batchSize[mode];limitField.value=simulationLimit[mode];
  el('pack-structure').textContent=mode==='formal'?'前 4 张为 C/R，第 5 张必出 SR+ · 概率按槽位':'5 张全随机 · 概率按单张';
  const list=el('pack-tier-list');list.replaceChildren();
  for(const tier of tiers){
   const item=document.createElement('span'),rate=document.createElement('small');
   const {slot,card,group}=packRates(mode,tier);
   rate.textContent=(slot===null?'':group+' ')+(100*(slot??card)).toFixed(2)+'%';
   if(slot!==null)item.title='全批单张占比 '+(100*card).toFixed(2)+'%';
   item.append(tier+' '+cardTypes[tier],rate);item.style.setProperty('--tier-color',colors[tier]);
   list.append(item);
  }
 }
 const clamp=(x,low=0,high=1)=>Math.max(low,Math.min(high,x));
 function draw(now=performance.now()){
  renderer?.render(pose);
  const left=sealPoint(pose,.045),right=sealPoint(pose,.95);
  const dx=right.x-left.x,dy=right.y-left.y,length=Math.hypot(dx,dy);
  rail={length,ux:dx/length,uy:dy/length};
  tear.style.left=left.x+'px';tear.style.top=left.y-19+'px';tear.style.width=length+'px';
  tear.style.transform='rotate('+Math.atan2(dy,dx)+'rad)';
  tear.style.setProperty('--tear',pose.tear*100+'%');
  fx.trace(pose,lipPoint,now,phase==='sealed'&&!!drag,phase==='sealed');
  fx.spill(pose,lipPoint,pose.tear>0?packTier:null,openingAt?now-openingAt:0,0,variant,now);
 }
 function resize(){
  if(!dialog.open||wrap.hidden)return;
  pose.w=wrap.clientWidth;pose.h=wrap.clientHeight;pose.dpr=Math.min(devicePixelRatio||1,1.65);
  pose.unit=Math.min(pose.w*.47,pose.h*.38);
  draw();
 }
 new ResizeObserver(resize).observe(wrap);
 function reset(){
  generation++;viewRevision++;revealed=0;detailIndex=-1;
  const left=updateStock();
  reservation=left?stock.reserve(batch.value):null;
  deck=reservation?makeDeck(reservation,batch.value):[];
  renderer?.setCover(coverArt);
  packTier=deck.reduce((highest,entry)=>tiers.indexOf(entry.tier)>tiers.indexOf(highest)?entry.tier:highest,'C');
  variant=deck.reduce((seed,entry)=>seed*tiers.length+tiers.indexOf(entry.tier),0);
  openingAt=0;
  cancelAnimationFrame(animation);stopGrip();fx.clear();stack?.remove();removeViewer();removeViewer=()=>{};
  slot.replaceChildren();slot.hidden=true;wrap.hidden=false;tear.hidden=false;
  action.hidden=false;
  inventory.replaceChildren();count.value='0 / 5';
  slotButtons=Array.from({length:5},(_,index)=>{
   const button=document.createElement('button');
   button.type='button';button.disabled=true;button.className='pack-slot';
   button.setAttribute('aria-label','第 '+(index+1)+' 张，待揭晓');
   button.addEventListener('dblclick',()=>showDetail(index));
   button.addEventListener('click',event=>{if(event.detail<2){closeDetail();stack.children[index].focus();}});
   button.addEventListener('keydown',event=>{if(event.key==='Enter')showDetail(index);});
   inventory.append(button);return button;
  });
  pose.tear=pose.opening=pose.tug=0;pose.air=1;pose.rx=-.10;pose.ry=-.20;
  phase='sealed';drag=null;sound.resetZip();
  batch.disabled=resetStock.disabled=false;
  shakeButtons.forEach(button=>{button.hidden=false;});
  revealAll.hidden=returnCards.hidden=nextCard.hidden=true;
  hint.textContent=left?'捏住袋身拖动查看，沿封口向右撕开':'本轮模拟已结束';
  action.textContent=left?'撕开卡包':'模拟结束';action.disabled=!left;tear.hidden=!left;
  resize();
 }
 async function prepareStack(){
  stack=document.createElement('div');stack.className='pack-stack pack-in-flight';
  const pending=[];
  for(const [index,entry] of deck.entries()){
   const card=document.createElement('button'),back=new Image(),front=new Image();
   card.type='button';card.className='pack-flight-card';card.disabled=true;
   card.setAttribute('aria-label','翻开第 '+(index+1)+' 张');
   back.alt=front.alt='';back.className='pack-mini-back';front.className='pack-mini-front';
   const flip=document.createElement('span');
   flip.className='pack-mini-turn';flip.append(back,front);card.append(flip);
   pending.push(entry.back().then(src=>{back.src=src;return back.decode();}));
   card.addEventListener('click',event=>{if(event.detail<2)flipCard(index);});
   card.addEventListener('dblclick',()=>showDetail(index));
   let lastTap=0;
   card.addEventListener('pointerup',event=>{
    if(event.pointerType!=='touch')return;
    const now=performance.now();
    if(lastTap&&now-lastTap<360){lastTap=0;showDetail(index);}
    else lastTap=now;
   });
   card.addEventListener('keydown',event=>{if(event.key==='Enter'&&event.shiftKey){event.preventDefault();showDetail(index);}});
   stack.append(card);
  }
  wrap.after(stack);
  await Promise.all(pending);
 }
 function flyCards(elapsed){
  for(const [index,card] of Array.from(stack.children).entries()){
   const t=clamp((elapsed-130-index*105)/480),rest=1-(1-t)**3;
   const source=lipPoint(pose,.42+index*.04);
   const x=(source.x-card.offsetLeft-card.offsetWidth/2)*(1-rest);
   const y=(source.y-card.offsetTop-card.offsetHeight/2)*(1-rest)-Math.sin(t*Math.PI)*pose.h*.24;
   card.style.opacity=clamp(t*7);
   card.style.transform='translate('+x+'px,'+y+'px) rotate('+((index-2)*12*(1-rest))+'deg) scale('+(.17+rest*.83)+')';
  }
 }
 function arrive(){
  phase='cards';wrap.hidden=true;slot.hidden=false;
  batch.disabled=resetStock.disabled=false;
  stack.classList.remove('pack-in-flight');
  for(const card of stack.children){card.style.removeProperty('opacity');card.style.removeProperty('transform');card.disabled=false;}
  slot.replaceChildren(stack);
  hint.textContent='单击翻开，双击查看大图';
  revealAll.hidden=false;revealAll.disabled=false;
  action.textContent='翻开第一张';action.disabled=false;action.focus({preventScroll:true});
  const first=deck[0];
  first.viewer=first.load();
  first.viewer.catch(()=>{delete first.viewer;});
 }
 function updateActions(){
  count.value=revealed+' / '+deck.length;
  action.textContent=revealed===deck.length?'再拆一包':revealed?'翻开下一张':'翻开第一张';
  action.disabled=false;revealAll.hidden=revealed===deck.length||!detail.hidden&&detail.isConnected;
 }
 function aura(target,tier){
  const ember=document.createElement('i');ember.className='pack-edge-fire';ember.setAttribute('aria-hidden','true');
  target.style.setProperty('--pack-tint',colors[tier]);target.prepend(ember);
 }
 function paintThumb(index,src){
  const card=stack.children[index],button=slotButtons[index],entry=deck[index],thumb=new Image();
  card.querySelector('.pack-mini-front').src=src;
  thumb.src=src;thumb.alt='';
  button.replaceChildren(thumb,document.createTextNode(entry.tier));button.disabled=false;
  button.setAttribute('aria-label','第 '+(index+1)+' 张 '+entry.tier);
 }
 async function flipCard(index){
  const page=generation,entry=deck[index];
  if(phase!=='cards'||!entry)return false;
  if(entry.flipped)return true;
  entry.flipping??=(async()=>{
   try{
    const src=await entry.portrait(entry.secretState);
    if(page!==generation)return false;
    const face=new Image();face.src=src;await face.decode();
    if(page!==generation)return false;
    const card=stack.children[index];
    paintThumb(index,src);aura(card,entry.tier);
    card.classList.add('pack-turned');
    card.setAttribute('aria-label','第 '+(index+1)+' 张 '+entry.tier+'，双击查看大图');
    entry.flipped=true;revealed++;
    sound.flip();if(!['C','R'].includes(entry.tier))sound.foil();
    hint.textContent='第 '+(index+1)+' 张 · '+entry.tier;
    updateActions();return true;
   }catch{
    entry.flipping=null;
    if(page===generation){hint.textContent='卡面载入失败，可以重试';updateActions();}
    return false;
   }
  })();
  return entry.flipping;
 }
 function closeDetail(){
  if(!detail.isConnected)return;
  viewRevision++;removeViewer();removeViewer=()=>{};detail.replaceChildren();detail.remove();
  detailIndex=-1;stack.hidden=false;returnCards.hidden=nextCard.hidden=true;action.hidden=false;
  hint.textContent='单击翻开，双击查看大图';updateActions();
 }
 async function showDetail(index){
  const page=generation,request=++viewRevision,entry=deck[index];
  if(!await flipCard(index)||page!==generation||request!==viewRevision)return;
  try{
   entry.viewer??=entry.load();
   const viewer=(await entry.viewer).cloneNode(true);
   if(page!==generation||request!==viewRevision)return;
   removeViewer();stack.hidden=true;
   viewer.dataset.packTilt='true';viewer.classList.add('pack-arrival');
   aura(viewer.querySelector('.tilt'),entry.tier);
   detail.hidden=false;detail.replaceChildren(viewer);slot.append(detail);
   detailIndex=index;
   removeViewer=mountViewer(viewer);
   if(entry.secretState?.claimed)viewer.querySelector('.claim').click();
   if(entry.secretState?.revealed)viewer.querySelector('.reveal').click();
   for(const selector of ['.claim','.reveal'])viewer.querySelector(selector).addEventListener('click',async()=>{
    const state={claimed:viewer.classList.contains('claimed-edition'),revealed:viewer.classList.contains('revealed')};
    entry.secretState=state;
    try{
     const src=await entry.portrait(state);
     if(page===generation&&entry.secretState===state)paintThumb(index,src);
    }catch{}
   });
   slotButtons.forEach((button,i)=>button.setAttribute('aria-pressed',String(i===index)));
   hint.textContent='第 '+(index+1)+' 张 · '+entry.tier;
   returnCards.hidden=false;action.hidden=true;revealAll.hidden=true;
   nextCard.hidden=false;nextCard.disabled=index===deck.length-1;
  }catch{
   delete entry.viewer;
   if(page===generation)hint.textContent='大图载入失败，可以重试';
  }
 }
 async function open(){
  if(phase!=='sealed'||!reservation)return;
  const drawPack=reservation;
  batch.disabled=resetStock.disabled=true;
  const air=pose.air;
  stopGrip();
  phase='opening';drag=null;pose.tear=1;pose.tug=0;tear.hidden=true;action.disabled=true;
  shakeButtons.forEach(button=>{button.hidden=true;});
  hint.textContent='正在抽出卡牌';
  const page=generation;
  try{await prepareStack();}
  catch{
   if(page===generation){reset();hint.textContent='卡背读取失败，请再试一次';}
   return;
  }
  if(page!==generation||!dialog.open)return;
  if(!drawPack.consume()){reset();return;}
  updateStock();
  sound.snap();
  openingAt=performance.now();
  fx.start(lipPoint(pose,.5),packTier,'open');
  function frame(now){
   const elapsed=now-openingAt,progress=clamp(elapsed/(reduced.matches?1:1070));
   pose.opening=progress*progress*(3-2*progress);pose.air=air+(.07-air)*pose.opening;
   draw(now);
   if(!reduced.matches)flyCards(elapsed);
   if(progress<1)animation=requestAnimationFrame(frame);
   else arrive();
  }
  animation=requestAnimationFrame(frame);
 }
 function pull(progress){
  pose.tear=clamp(progress);
  const airLoss=clamp(pose.tear/.46);
  pose.air=1-.84*airLoss*airLoss*(3-2*airLoss);
  sound.zip(pose.tear,.45);draw();
  if(pose.tear>=1)open();
 }
 tear.addEventListener('pointerdown',event=>{
  if(phase!=='sealed'||grip||event.button!==0||!rail?.length)return;
  const {pointerId,clientX,clientY}=event;
  drag={pointerId,clientX,clientY,initial:pose.tear,...rail};
  tear.setPointerCapture(pointerId);
 });
 tear.addEventListener('pointermove',event=>{
  if(drag?.pointerId!==event.pointerId)return;
  const distance=(event.clientX-drag.clientX)*drag.ux+(event.clientY-drag.clientY)*drag.uy;
  pose.tug=clamp(distance/drag.length,-.35,.55);
  pull(drag.initial+distance/Math.max(1,drag.length-7));
 });
 for(const type of ['pointerup','pointercancel','lostpointercapture'])tear.addEventListener(type,()=>{
  if(!drag)return;
  drag=null;pose.tug=0;draw();
 });
 tear.addEventListener('keydown',event=>{
  if(!['ArrowRight','ArrowLeft','End','Home'].includes(event.key)||phase!=='sealed')return;
  event.preventDefault();
  pull(event.key==='End'?1:event.key==='Home'?0:pose.tear+(event.key==='ArrowRight'?.12:-.12));
 });
 tear.addEventListener('click',event=>{if(event.detail===0)open();});
 function stopGrip(){
  cancelAnimationFrame(gripAnimation);gripAnimation=0;
  grip=shake=null;pressVelocity=pose.press=pose.flex=pose.sway=pose.flutter=0;
  Object.assign(pose,rest);
  surface.classList.remove('gripping');
 }
 function animateGrip(now){
  gripAnimation=0;
  if(phase!=='sealed'||!dialog.open)return;
  const elapsed=clamp(now-lastGripFrame,4,32);
  lastGripFrame=now;
  const level=grip?.force||0,flex=grip?.flex||0;
  const wave=shake&&!reduced.matches?Math.sin((now-shake.start)*.037)*Math.max(0,1-(now-shake.start)/730):0;
  if(shake&&now-shake.start>=730)shake=null;
  const target=grip?.target??{
   ...rest,tx:shake&&!shake.vertical?wave*.34:0,ty:shake?.vertical?wave*.32:0,
   rz:rest.rz+(shake?.vertical?-.15:.33)*wave};
  const response=1-Math.exp(-elapsed/78);
  for(const key of Object.keys(rest))pose[key]+=(target[key]-pose[key])*(reduced.matches?1:response);
  if(reduced.matches){
   pose.press=level;pose.flex=pose.sway=pose.flutter=0;
  }else{
   for(let t=elapsed;t>0;t-=8){
    const dt=Math.min(8,t)/1000;
    pressVelocity+=((level-pose.press)*27**2-pressVelocity*(grip?34:24))*dt;
    pose.press=clamp(pose.press+pressVelocity*dt,-.11,1);
   }
   pose.flex+=(flex+wave*.31-pose.flex)*response;
   pose.sway+=(flex*.40+wave*.18-pose.sway)*response;
   pose.flutter=clamp((flex-pose.flex)*.62,-.35,.35);
  }
  const offset=Object.keys(rest).reduce((sum,key)=>sum+Math.abs(pose[key]-rest[key]),0);
  if(grip||shake||Math.abs(pose.press)+Math.abs(pose.flex)+Math.abs(pressVelocity)+offset>.014)
   gripAnimation=requestAnimationFrame(animateGrip);
  else stopGrip();
  draw(now);
 }
 function updateGrip(){
  if(gripAnimation)return;
  lastGripFrame=performance.now();
  gripAnimation=requestAnimationFrame(animateGrip);
 }
 const pressure=event=>event.pointerType==='mouse'?.76:clamp(.42+event.pressure*.62,.42,.92);
 surface.addEventListener('pointerdown',event=>{
  if(phase!=='sealed'||drag||grip||event.button!==0)return;
  const b=surface.getBoundingClientRect();
  const point=pickFront(pose,event.clientX-b.left,event.clientY-b.top);
  if(!point)return;
  shake=null;
  grip={pointerId:event.pointerId,x:event.clientX,y:event.clientY,force:pressure(event),flex:0,
   target:Object.fromEntries(Object.keys(rest).map(key=>[key,pose[key]]))};
  pose.pressX=point.x;pose.pressY=point.y;
  pose.press=Math.max(pose.press,grip.force*.80);
  surface.setPointerCapture(event.pointerId);surface.classList.add('gripping');
  sound.rustle(.39);draw();updateGrip();
 });
 surface.addEventListener('pointermove',event=>{
  if(phase!=='sealed')return;
  const b=surface.getBoundingClientRect();
  if(grip?.pointerId===event.pointerId){
   const point=pickFront(pose,event.clientX-b.left,event.clientY-b.top);
   if(point){pose.pressX=point.x;pose.pressY=point.y;}
   const dx=(event.clientX-grip.x)/b.width,dy=(event.clientY-grip.y)/b.height;
   grip.force=pressure(event);grip.flex=clamp(dx*3-dy*2,-.67,.67);
   const x=dx*b.width/pose.unit,y=dy*b.height/pose.unit;
   grip.target={tx:clamp(x*.55,-.39,.39),ty:clamp(-y*.56,-.34,.34),
    ry:clamp(rest.ry+x*.92,-1.23,1.21),rx:clamp(rest.rx+y*.59,-.69,.54),rz:clamp(rest.rz-x*.40,-.62,.72)};
   for(const key of Object.keys(rest))pose[key]+=(grip.target[key]-pose[key])*.55;
   if(!reduced.matches)pose.flex+=(grip.flex-pose.flex)*.55;
   sound.rustle(Math.min(.8,Math.hypot(dx,dy)*2));draw();updateGrip();
  }else if(!grip&&!drag&&!shake&&!gripAnimation&&!reduced.matches){
   pose.rx=(event.clientY-b.top-b.height/2)/b.height*.44;
   pose.ry=(event.clientX-b.left-b.width/2)/b.width*.52;draw();
  }
 });
 for(const type of ['pointerup','pointercancel','lostpointercapture'])surface.addEventListener(type,event=>{
  if(grip?.pointerId!==event.pointerId)return;
  grip=null;surface.classList.remove('gripping');updateGrip();
 });
 shakeButtons.forEach((button,index)=>button.addEventListener('click',()=>{
  if(phase!=='sealed'||drag||grip)return;
  shake={vertical:index===1,start:performance.now()};
  sound.rustle(.72);updateGrip();
 }));
 action.addEventListener('click',()=>{
  if(phase==='sealed')open();
  else if(phase==='cards'){
   if(revealed===deck.length)reset();
   else flipCard(deck.findIndex(entry=>!entry.flipped));
  }
 });
 revealAll.addEventListener('click',()=>{
  if(phase!=='cards')return;
  revealAll.disabled=true;
  const page=generation;
  Promise.all(deck.map((_,index)=>flipCard(index))).finally(()=>{
   if(page===generation){revealAll.disabled=false;updateActions();}
  });
 });
 returnCards.addEventListener('click',closeDetail);
 nextCard.addEventListener('click',async()=>{
  if(detailIndex<0||detailIndex>=deck.length-1||nextCard.disabled)return;
  const page=generation;
  nextCard.disabled=true;
  await showDetail(detailIndex+1);
  if(page===generation&&detailIndex>=0)nextCard.disabled=detailIndex===deck.length-1;
 });
 el('pack-reset').addEventListener('click',reset);
 batch.addEventListener('change',()=>{paintOdds();reset();});
 resetStock.addEventListener('click',()=>{
  if(!limitField.reportValidity())return;
  simulationLimit[batch.value]=limitField.valueAsNumber;
  stock.reset(batch.value);reset();
 });
 coverInput.addEventListener('change',async()=>{
  const file=coverInput.files[0];
  if(!file)return;
  const change=++coverRevision,cover=new Image(),url=URL.createObjectURL(file);
  cover.src=url;
  try{
   await cover.decode();
   if(change!==coverRevision)return;
   if(coverURL)URL.revokeObjectURL(coverURL);
   coverArt=cover;coverURL=url;
   renderer?.setCover(cover);
   clearCover.hidden=false;
   if(phase==='sealed')resize();
  }catch{
   if(change===coverRevision)hint.textContent='封面读取失败，请使用 PNG、JPG 或 WebP';
  }finally{if(url!==coverURL)URL.revokeObjectURL(url);}
 });
 clearCover.addEventListener('click',()=>{
  ++coverRevision;coverInput.value='';clearCover.hidden=true;
  if(coverURL)URL.revokeObjectURL(coverURL);
  coverArt=null;coverURL='';
  renderer?.setCover(null);
  if(phase==='sealed')resize();
 });
 soundButton.addEventListener('click',()=>{
  const on=soundButton.getAttribute('aria-pressed')==='true';
  if(on)sound.mute();
  const active=!on&&sound.enable();
  soundButton.setAttribute('aria-pressed',String(active));
  soundButton.textContent=active?'关闭声音':'开启声音';
 });
 dialog.addEventListener('close',()=>{
  generation++;viewRevision++;
  cancelAnimationFrame(animation);stopGrip();fx.clear();stack?.remove();removeViewer();removeViewer=()=>{};
  slot.replaceChildren();sound.mute();
  soundButton.setAttribute('aria-pressed','false');soundButton.textContent='开启声音';
 });
 return drawDeck=>{
  makeDeck=drawDeck;dialog.showModal();paintOdds();reset();
 };
}

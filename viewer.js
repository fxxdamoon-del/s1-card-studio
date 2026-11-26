function mountScratch(box,back){
 if(!box)return ()=>{};
 const cover=box.querySelector('canvas'),[x,y,w,h]=box.dataset.area.split(',').map(Number);
 const context=cover.getContext('2d',{willReadFrequently:true});
 const image=back.querySelector('.back-art');
 let active,previous,ready=false;
 cover.width=w;cover.height=h;
 image.decode().then(()=>{
  context.drawImage(image,x,y,w,h,0,0,w,h);
  box.classList.add('scratch-ready');ready=true;
 }).catch(()=>{});
 const reveal=()=>{
  cover.hidden=true;box.classList.add('scratched');
  box.setAttribute('aria-label',box.textContent.trim());
 };
 function rub(event){
  const bounds=cover.getBoundingClientRect();
  const point=[(event.clientX-bounds.left)/bounds.width*w,(event.clientY-bounds.top)/bounds.height*h];
  context.globalCompositeOperation='destination-out';
  context.lineCap='round';context.lineWidth=h*.64;
  context.beginPath();context.moveTo(...(previous||point));context.lineTo(point[0]+.01,point[1]);context.stroke();
  previous=point;
 }
 box.onpointerdown=event=>{
  event.stopPropagation();
  if(!ready||active!==undefined||cover.hidden||event.button!==0)return;
  active=event.pointerId;previous=null;box.setPointerCapture(active);
  rub(event);
 };
 box.onpointermove=event=>{
  event.stopPropagation();
  if(event.pointerId===active)rub(event);
 };
 box.onpointerup=box.onpointercancel=box.onlostpointercapture=event=>{
  event.stopPropagation();
  if(event.pointerId!==active)return;
  active=undefined;previous=null;
  const data=context.getImageData(0,0,w,h).data;
  let clear=0;
  for(let i=3;i<data.length;i+=4)if(data[i]<25)clear++;
  if(clear>w*h*.43)reveal();
 };
 box.ondblclick=event=>event.stopPropagation();
 box.onkeydown=event=>{
  if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();reveal();}
 };
 box.onclick=event=>{if(event.detail===0)reveal();};
 return flipped=>{box.tabIndex=flipped?0:-1;};
}

function mountViewer(view,initiallyFlipped=false){
 const stage=view.querySelector('.stage'),tilt=view.querySelector('.tilt'),turn=view.querySelector('.turn');
 const front=view.querySelector('.front'),back=view.querySelector('.back'),flipBtn=view.querySelector('.flip');
 const gyroBtn=view.querySelector('.gyro'),hint=view.querySelector('.hint');
 const revealBtn=view.querySelector('.reveal'),lightBtn=view.querySelector('.light');
 const claimBtn=view.querySelector('.claim');
 const reduced=matchMedia('(prefers-reduced-motion:reduce)');
 let flipped=initiallyFlipped,drag=null,flipTimer,sensor=false,home,sensorTimer;
 const scratchFocus=mountScratch(back.querySelector('.scratch-box'),back);
 scratchFocus(flipped);
 if(initiallyFlipped){
  turn.classList.add('reversed');
  front.style.visibility='hidden';back.style.visibility='visible';
  front.setAttribute('aria-hidden','true');back.setAttribute('aria-hidden','false');
  flipBtn.textContent='翻回正面';flipBtn.setAttribute('aria-pressed','true');
 }
 const packTilt=view.dataset.packTilt==='true';
 const message=packTilt?'按住卡片向任意方向拖动 · 双击翻面':'移动鼠标或拖动卡片查看视差 · 双击翻面';
 let lastX=0,lastY=0;
 hint.textContent=message;
 const clamp=v=>Math.max(-1,Math.min(1,v));
 function pose(rawX,rawY,immediate=false){
  const x=reduced.matches?0:clamp(rawX),y=reduced.matches?0:clamp(rawY);
  lastX=x;lastY=y;
  if(immediate)tilt.style.transition='none';
  for(const [key,value] of Object.entries({rx:-y*(packTilt?36:12)+'deg',ry:x*(packTilt?44:15)+'deg',px:x*10+'px',py:y*9+'px',bx:-x*4+'px',by:-y*3+'px',fx:50+x*42+'%',fy:50+y*42+'%'}))tilt.style.setProperty('--'+key,value);
  if(view.dataset.lens==='true'){
   const amount=reduced.matches?0:Math.max(0,Math.min(1,(Math.abs(x)-.11)*4.5));
   tilt.style.setProperty('--alternate',amount);
  }
  if(immediate){tilt.getBoundingClientRect();tilt.style.removeProperty('transition');}
 }
 function flip(){
  flipped=!flipped;pose(0,0);
  turn.classList.toggle('reversed',flipped);
  flipBtn.textContent=flipped?'翻回正面':'翻面看卡背';
  flipBtn.setAttribute('aria-pressed',String(flipped));clearTimeout(flipTimer);
  if(!flipped)scratchFocus(false);
  flipTimer=setTimeout(()=>{
   front.style.visibility=flipped?'hidden':'visible';
   back.style.visibility=flipped?'visible':'hidden';
   front.setAttribute('aria-hidden',String(flipped));
   back.setAttribute('aria-hidden',String(!flipped));
   scratchFocus(flipped);
  },reduced.matches?0:275);
 }
 function track(e){
  if(sensor)return;
  const rect=stage.getBoundingClientRect();
  if(packTilt&&drag){
   pose(drag.x+(e.clientX-drag.atX)/(rect.width*.52),drag.y+(e.clientY-drag.atY)/(rect.height*.52));
   return;
  }
  pose((e.clientX-rect.left)/rect.width*2-1,(e.clientY-rect.top)/rect.height*2-1);
 }
 function orient(e){
  if(!Number.isFinite(e.beta)||!Number.isFinite(e.gamma))return;
  clearTimeout(sensorTimer);
  home??={x:e.gamma,y:e.beta};
  pose((e.gamma-home.x)/24,(e.beta-home.y)/24);
 }
 function stopSensor(note=message){
  sensor=false;home=null;clearTimeout(sensorTimer);
  removeEventListener('deviceorientation',orient);
  gyroBtn.textContent='开启陀螺仪';gyroBtn.setAttribute('aria-pressed','false');
  hint.textContent=note;pose(0,0,true);
 }
 const onGyro=async()=>{
  if(sensor){stopSensor();return;}
  const api=window.DeviceOrientationEvent;
  if(!api){stopSensor('当前设备没有可用的陀螺仪');return;}
  gyroBtn.disabled=true;
  try{
   if(api.requestPermission&&await api.requestPermission()!=='granted'){stopSensor('陀螺仪未授权');return;}
   sensor=true;addEventListener('deviceorientation',orient);gyroBtn.textContent='关闭陀螺仪';
   gyroBtn.setAttribute('aria-pressed','true');hint.textContent='倾斜设备查看视差';
   sensorTimer=setTimeout(()=>stopSensor('未收到陀螺仪数据，可用拖动查看视差'),2400);
  }catch{stopSensor('陀螺仪暂不可用');}
  finally{gyroBtn.disabled=false;}
 };
 stage.onpointerdown=e=>{if(e.button===0){drag={id:e.pointerId,atX:e.clientX,atY:e.clientY,x:lastX,y:lastY};stage.setPointerCapture(drag.id);track(e);}};
 stage.onpointermove=e=>{if(e.pointerType==='mouse'||e.pointerId===drag?.id)track(e);};
 const release=()=>{drag=null;if(!sensor)pose(0,0);};
 stage.onpointerup=stage.onpointercancel=stage.onlostpointercapture=release;
 stage.onpointerleave=()=>{if(drag===null&&!sensor)pose(0,0);};
 stage.ondblclick=flip;stage.onkeydown=e=>{if(e.key.toLowerCase()==='f'){e.preventDefault();flip();}if(e.key.toLowerCase()==='r')pose(0,0,true);};
 flipBtn.onclick=flip;gyroBtn.onclick=onGyro;
 if(revealBtn)revealBtn.onclick=()=>{
  const revealed=view.classList.toggle('revealed');
  revealBtn.textContent=revealed?'盖回问号':'揭开隐藏卡';
  revealBtn.setAttribute('aria-pressed',String(revealed));
  view.querySelector('.secret-image')?.setAttribute('aria-hidden',String(revealed));
 };
 if(claimBtn)claimBtn.onclick=()=>{
  view.classList.add('claimed-edition');
  view.querySelector('.decorations').hidden=true;
  view.querySelector('.claimed-decorations').hidden=false;
  view.querySelector('.back-art').hidden=true;
  view.querySelector('.claimed-back').hidden=false;
  const vocal=view.querySelector('.vocal-playback');
  if(vocal)vocal.hidden=false;
  claimBtn.textContent='已认领';
  claimBtn.disabled=true;
 };
 if(lightBtn)lightBtn.onclick=()=>{
  const dark=view.classList.toggle('dark-view');
  lightBtn.textContent=dark?'开灯':'关灯看夜光';
  lightBtn.setAttribute('aria-pressed',String(dark));
 };
 return ()=>{clearTimeout(flipTimer);stopSensor();view.querySelector('audio')?.pause();};
}


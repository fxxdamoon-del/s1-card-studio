import {FilesetResolver,ImageSegmenter} from './node_modules/@mediapipe/tasks-vision/vision_bundle.mjs';

import {FOILS,SURFACES,SPECIAL,WINDOW,RELIC_WINDOW,PIN_AREA,canvas,fit,refineMask,decorate,backArt,makeBackQR,glitter,applyFlatEffects,edition} from './card-editing.js';
import {prepareScene,fitScene} from './scene-layer.js';

const $=id=>document.getElementById(id);
const response=await fetch('./assets/templates.json');
if(!response.ok)throw new Error('母版载入失败');
const templates=await response.json();
const names={'01-C':'C','02-R':'R','03-SR':'SR','04-SSR':'SSR','05-UR':'UR','06-AUTO':'AUTO','07-SEC':'SEC','08-RLC':'RLC','09-ONE':'ONE'};
const templateStars={'01-C':2,'02-R':3,'03-SR':5,'04-SSR':7,'05-UR':8,'06-AUTO':8,'07-SEC':0,'08-RLC':9,'09-ONE':10};
const finishes={'01-C':[0,.12],'02-R':[.05,.27],'03-SR':[0,.12],'04-SSR':[.34,.68],'05-UR':[.035,.45],'06-AUTO':[.08,.38],'07-SEC':[0,0],'08-RLC':[.13,.45],'09-ONE':[.29,.69]};
const panelFor=key=>key==='06-AUTO'?'./assets/info-panel-auto.webp':key==='07-SEC'?'./assets/info-panel-sec.webp':'./assets/info-panel.webp';
const imgCache=new Map();
const [viewerStyle,viewerCode]=await Promise.all(['viewer.css','viewer.js'].map(async path=>(await fetch(path)).text()));
const script=document.createElement('script');script.textContent=viewerCode;document.head.append(script);
let id=Object.keys(names)[0], patchImage, patch2Image, alternate, segmenterTask, revision=0, rendered, teardown=()=>{};
const artwork={};
const vocalPools=new Map(),vocalRevisions=new Map();
const vocalTypes={
 '01-C':['WH 问候声','WH','C/R 共 16 段 · 每段最多 500 张'],
 '02-R':['WH 问候声','WH','C/R 共 16 段 · 每段最多 500 张'],
 '03-SR':['GQ 歌曲干声','GQ','13 段 · 每段最多 100 张'],
 '04-SSR':['QC 一句清唱','QC','10 个 Take · 每个约 40 张'],
 '05-UR':['FT 废 Take','FT','UR/SEC 共 8 段 · 每段最多 30 张'],
 '06-AUTO':['认领后专录','AUTO','认领后带姓名补录 · 逐卡唯一'],
 '07-SEC':['FT 私密片段','FT','与 UR 共池 · 认领后解锁'],
 '08-RLC':['信物故事声','RLC','一件信物一段 · 随物料绑定'],
 '09-ONE':['唯一专录','ONE','仅此一份 · 1/1']
};
const vocalRules={WH:{files:16,cap:500,tiers:['C','R']},GQ:{files:13,cap:100,tiers:['SR']},
 QC:{files:10,cap:40,tiers:['SSR']},FT:{files:8,cap:30,tiers:['UR','SEC']}};
const vocalKey=key=>vocalTypes[key][1];
const vocalSelection=key=>vocalPools.get(vocalKey(key))?.selected;
function drawVocal(pool){
 if(!pool?.length)return '';
 return pool.splice(Math.floor(Math.random()*pool.length),1)[0];
}
function syncVocal(){
 const [type,group]=vocalTypes[id],size=vocalPools.get(group)?.files.length??0;
 $('vocal-label').textContent=names[id]+' · '+type+(vocalRules[group]?'试听池':'单卡试听');
 $('vocal-count').value=size+' 条';
 $('vocal-clear').hidden=!size;
 $('vocal-reroll').hidden=size<2;
 for(const row of $('vocal-table').children){
  row.querySelector('output').value=(vocalPools.get(vocalKey(row.dataset.tier))?.files.length??0)+' 条';
 }
}
const editionEntries=new Map();
const starEntries=new Map();
function adjustStars(){
 const field=$('stars');
 field.value=starEntries.get(id)??templateStars[id];
 field.disabled=id==='07-SEC';
}
const editionKey=()=>id==='08-RLC'?id+'/'+$('relic-tier').value:id;
const adjustEditionField=()=>{$('serial').value=editionEntries.get(editionKey())||'';};

function getImage(url){
 if(!imgCache.has(url)){
  const img=new Image();img.src=url;
  imgCache.set(url,img.decode().then(()=>img));
 }
 return imgCache.get(url);
}
function urlFor(template,suffix){return './assets/'+template+'-'+suffix+'.webp';}
async function maskOf(image){
 const scale=Math.min(1,850/Math.max(image.naturalWidth,image.naturalHeight));
 const input=canvas(Math.max(1,Math.round(image.naturalWidth*scale)),Math.max(1,Math.round(image.naturalHeight*scale)));
 const context=input.getContext('2d',{willReadFrequently:true});
 context.drawImage(image,0,0,input.width,input.height);
 const channels=context.getImageData(0,0,input.width,input.height).data;
 let clear=0;
 for(let i=3;i<channels.length;i+=4)if(channels[i]<12)clear++;
 if(clear>input.width*input.height*.04)return {nativeAlpha:true};
 segmenterTask??=(async()=>{
  const tasks=await FilesetResolver.forVisionTasks('./node_modules/@mediapipe/tasks-vision/wasm');
  return ImageSegmenter.createFromOptions(tasks,{baseOptions:{modelAssetPath:'./vendor/selfie_segmenter.tflite'},runningMode:'IMAGE',outputConfidenceMasks:true,outputCategoryMask:false});
 })();
 const model=await segmenterTask;
 const result=model.segment(input);
 try{
  const masks=result.confidenceMasks;
  if(!masks?.length)return null;
  const idx=model.getLabels().findIndex(label=>/person|selfie|foreground/i.test(label));
  const part=masks[idx>=0?idx:Math.min(1,masks.length-1)];
  const scores=part.getAsFloat32Array();
  const output=canvas(part.width,part.height),ctx=output.getContext('2d');
  const data=ctx.createImageData(part.width,part.height);
  let solid=0;
  for(let i=0;i<scores.length;i++){
   const v=scores[i];
   if(v>.72)solid++;
   data.data[i*4+3]=Math.round(Math.max(0,Math.min(1,(v-.38)/.4))*255);
  }
  const coverage=solid/scores.length;
  if(coverage<.04||coverage>.96)return null;
  ctx.putImageData(data,0,0);return refineMask(output,input,input.width,input.height);
 }finally{result.close();}
}
function fitted(image,mask,w,h,{position,zoom,offsetX,offsetY}){
 const layer=canvas(w,h),ctx=layer.getContext('2d');
 const [x,y,dw,dh]=fit(ctx,image,w,h,position,zoom,offsetX,offsetY);
 if(mask&&!mask.nativeAlpha){
  ctx.globalCompositeOperation='destination-in';
  ctx.drawImage(mask,x,y,dw,dh);
 }
 return layer;
}
function makeViewer(data){
 const node=document.createElement('div');node.className='viewer';
 node.dataset.template=data.id;
 const {style}=data;
 node.classList.add('finish-'+style.foil,'surface-'+style.surface);
 for(const effect of style.options)node.classList.add('option-'+effect);
 if(style.options.includes('diecut'))node.classList.add('shape-'+style.shape);
 if(style.scope==='rim'&&['gold','silver'].includes(style.foil))node.classList.add('foil-rim');
 if(style.foil==='glitter')node.style.setProperty('--sparkles','url('+glitter()+')');
 if(data.altURL)node.dataset.lens='true';
 if(style.surface==='uv'&&data.person&&data.layerURL){
  node.classList.add('uv-portrait');
  node.style.setProperty('--uv-mask','url('+data.layerURL+')');
 }
 node.innerHTML='<div class="stage" tabindex="0" aria-label="卡牌，拖动查看视差，双击或按 F 翻面"><div class="tilt"><div class="turn"><div class="face front" aria-hidden="false"><img class="plate" alt=""><div class="photo scene" hidden><img alt=""></div><div class="foil photo-film"></div><div class="photo portrait" hidden><img alt=""></div><div class="photo lens" hidden><img alt=""></div><img class="frame" alt="" hidden><img class="info-panel" alt=""><i class="rim"></i><i class="material"></i><i class="glaze"></i><i class="resin"></i><img class="decorations" alt=""><img class="claimed-decorations" alt="" hidden><i class="luminous"></i><div class="photo secret-image" hidden><img alt="问号封面"></div></div><div class="face back" aria-hidden="true"><img class="back-art" alt="卡背"><img class="claimed-back" alt="已认领卡背" hidden><i class="shine"></i></div></div></div></div><div class="controls"><button type="button" class="gyro" aria-pressed="false">开启陀螺仪</button><button type="button" class="flip" aria-pressed="false">翻面看卡背</button><button type="button" class="reveal" aria-pressed="false" hidden>揭开隐藏卡</button><button type="button" class="claim" hidden>认领显号</button><button type="button" class="light" aria-pressed="false" hidden>关灯看夜光</button></div><p class="hint" role="status">移动鼠标或拖动卡片查看视差 · 双击翻面</p>';
 const [w,h]=data.size,[x,y,r,b]=data.window;
 for(const [prop,v] of Object.entries({left:x/w,top:y/h,width:(r-x)/w,height:(b-y)/h}))node.style.setProperty('--'+prop,v*100+'%');
 node.style.setProperty('--foil',data.finish[0]);node.style.setProperty('--rim',data.finish[1]);
 paintStrengths(node,style);
 node.querySelector('.plate').src=data.plate;
 node.querySelector('.info-panel').src=data.panel;
 node.querySelector('.back img').src=data.back;
 if(data.source.auth.pin){
  const box=document.createElement('div'),[x,y,w,h]=PIN_AREA;
  box.className='scratch-box';box.dataset.area=PIN_AREA.join(',');
  box.setAttribute('role','button');box.setAttribute('aria-label','试刮 PIN 涂层');box.tabIndex=-1;
  Object.assign(box.style,{left:x/10+'%',top:y/14+'%',width:w/10+'%',height:h/14+'%'});
  box.innerHTML='<span aria-hidden="true">测试 PIN · DEMO00001234</span><canvas aria-hidden="true"></canvas>';
  node.querySelector('.back').append(box);
 }
 node.querySelector('.decorations').src=data.decoration;
 if(data.claimedDecoration){
  node.querySelector('.claimed-decorations').src=data.claimedDecoration;
  node.querySelector('.claimed-back').src=data.claimedBack;
  node.querySelector('.claim').hidden=false;
 }
 const attach=(selector,url)=>{
  const box=node.querySelector(selector);box.hidden=false;box.firstElementChild.src=url;
 };
 if(data.sceneURL)attach('.scene',data.sceneURL);
 if(data.layer)attach(data.person?'.portrait':'.scene',data.layerURL);
 if(data.altURL)attach('.lens',data.altURL);
 if(data.layer||data.altURL){
  const frame=node.querySelector('.frame');frame.hidden=false;frame.src=data.frame;
 }
 if(data.secret){attach('.secret-image',data.secretURL);node.querySelector('.reveal').hidden=false;}
 if(style.options.includes('glow'))node.querySelector('.light').hidden=false;
 if(data.source.vocalAudio){
  const controls=document.createElement('div'),audio=document.createElement('audio');
  controls.className='vocal-playback';audio.controls=true;audio.preload='metadata';
  controls.hidden=data.secret;
  audio.setAttribute('aria-label','播放干声试听');audio.src=data.source.vocalAudio;
  controls.append('干声试听',audio);node.append(controls);
 }
 return node;
}

function noteFor(style,base){
 return style.options.includes('lenticular')&&!alternate?base+' 光栅换图需上传第二张图。':base;
}
function settings(){
 return {foil:$('foil-type').value,surface:$('surface-type').value,scope:$('foil-area').value,
  ...effectStrengths(),
  options:[...document.querySelectorAll('#special-effects input:checked')].map(e=>e.value),shape:$('shape').value};
}
function effectStrengths(){
 return {foilStrength:Number($('foil-strength').value)/100,surfaceStrength:Number($('surface-strength').value)/100,
  specialStrength:Number($('special-strength').value)/100};
}
function paintStrengths(view,style){
 view.style.setProperty('--foil-gain',style.foilStrength);
 view.style.setProperty('--surface-gain',style.surfaceStrength);
 view.style.setProperty('--special-gain',style.specialStrength);
}
async function getSpecialLayers(original,panelURL){
 const [x,y,r,b]=WINDOW,w=r-x,h=b-y;
 const plate=canvas(2000,2800),pg=plate.getContext('2d');
 pg.filter='grayscale(1) brightness(1.8)';
 pg.drawImage(original,0,0);
 pg.filter='none';
 pg.globalCompositeOperation='screen';
 pg.fillStyle='#151515';pg.fillRect(0,0,plate.width,plate.height);
 pg.globalCompositeOperation='source-over';
 pg.fillStyle='#121212';pg.fillRect(x,y,w,h);
 const frame=canvas(2000,2800),fg=frame.getContext('2d');fg.drawImage(plate,0,0);fg.clearRect(x,y,w,h);
 const secret=canvas(w,h),sg=secret.getContext('2d');
 sg.filter='grayscale(1) brightness(1.45)';sg.drawImage(original,x,y,w,h,0,0,w,h);
 const panel=canvas(2000,2800),panelContext=panel.getContext('2d');
 panelContext.filter='grayscale(1) brightness(2.1)';
 panelContext.drawImage(await getImage(panelURL),0,0);
 return {plate:plate.toDataURL('image/webp',.95),frame:frame.toDataURL('image/webp',.95),
  secret:secret.toDataURL('image/webp',.95),panel:panel.toDataURL('image/webp',.95)};
}
let secretLayers;
function backAuth(){
 const enabled=$('back-qr').checked,input=$('back-qr-url');
 $('back-qr-field').hidden=!enabled;
 const link=input.value.trim();
 let qr=enabled?{}:null,error='';
 if(enabled&&link){
  try{
   const url=new URL(link);
   if(!['https:','http:'].includes(url.protocol)||url.username||url.password||url.href.length>240)throw new Error();
   qr=makeBackQR(url.href);
  }catch{error='请输入有效的 HTTPS 或 HTTP 验真链接，最多 240 个字符。';}
 }
 input.setAttribute('aria-invalid',String(!!error));
 return {qr,pin:$('back-pin').checked,error};
}
function cardGeometry(key){
 const meta=templates[key];
 return {id:key,meta,size:meta.size,window:key==='08-RLC'?RELIC_WINDOW:meta.imageWindowXYXY||WINDOW};
}
async function prepareArtwork(source,key){
 const art=source.artwork[key==='03-SR'?'sr-upload':'upload'];
 const framing={...source.framing};
 if(key==='08-RLC'){
  framing.offsetX+=source.relicOffset[0];framing.offsetY+=source.relicOffset[1];
 }
 let note=key==='03-SR'?'上传 SR 侧记图即可出卡。':'上传主图即可出卡。';
 let mask,background;
 const uploaded=art?.image;
 if(uploaded){
  note='已保留上传原图。';
  if(source.cutout){
   try{
    art.maskTask??=maskOf(uploaded);
    mask=await art.maskTask;
    note=mask?.nativeAlpha?'已保留原图透明边缘，使用母版底纹。':mask?
     '已分离并细化人像边缘。':'未检测到清晰人像，已保留上传原图。';
   }catch{note='人像分离不可用，已用上传原图出卡。';}
   if(mask&&!mask.nativeAlpha&&source.originalScene){
    if(art.scene===undefined)art.scene=prepareScene(uploaded,mask);
    background=art.scene;
    note=background?'已分离并细化人像边缘，保留原图场景。':'可分离的背景太少，已使用母版底纹。';
   }
  }
 }
 return {...source,uploaded,mask,background,framing,note};
}
async function buildBacks(config,auth){
 const [backImage,emblem]=await Promise.all([getImage('./assets/back-blank.webp'),
  config.backEmblem?getImage('./assets/commune-emblem.png'):null]);
 const secret=config.id==='07-SEC';
 const paint=serial=>backArt(backImage,config.backText,serial,config.serialSize,emblem,config.id==='09-ONE',auth).toDataURL('image/png');
 return {back:paint(secret?'':config.serial),claimedBack:secret?paint(config.serial):null};
}
async function buildCard(config,source,backs){
 const {id:key,style,window}=config,{uploaded,mask,framing,background}=source;
 const [l,t,r,b]=window,w=r-l,h=b-t;
 const layer=uploaded?fitted(uploaded,mask,w,h,framing):null;
 const scene=background?fitScene(uploaded,background,w,h,framing):null;
 const secret=key==='07-SEC',relic=key==='08-RLC';
 let plate=urlFor(key,'preview'),frame=urlFor(key,'frame'),panel=panelFor(key),secretURL;
 if(secret){
  secretLayers??=getImage(plate).then(original=>getSpecialLayers(original,panel));
  const layers=await secretLayers;
  ({plate,frame,panel,secret:secretURL}=layers);
 }
 await Promise.all([getImage(plate),getImage(panel),uploaded?getImage(frame):null]);
 const relicAssets=relic?{patch:source.patch,patch2:source.patch2,
  cloth:await getImage('./assets/relic-default.webp'),
  signatureStrip:await getImage('./assets/relic-signature.webp')}:{};
 const baseConfig=secret?{...config,serial:''}:config;
 const decoration=decorate(baseConfig,relicAssets).toDataURL('image/png');
 const claimedDecoration=secret?decorate(config,relicAssets).toDataURL('image/png'):null;
 const alt=source.alternate&&style.options.includes('lenticular')?fitted(source.alternate,null,w,h,framing):null;
 return {...config,secret,secretURL,plate,frame,panel,...await (backs??buildBacks(config,source.auth)),
  claimedDecoration,decoration,source,
  layer,person:!!mask,uploaded,framing,sceneURL:scene?.toDataURL('image/webp',.93),
  layerURL:layer?.toDataURL('image/webp',.96),altURL:alt?.toDataURL('image/webp',.95),
  finish:style.foil==='default'?finishes[key]:[style.foil==='holo'?.13:0,style.foil==='none'?0:.22]};
}
async function refresh(){
 const sequence=++revision,key=id,style=settings();
 const label=$('name').value.trim(),secret=key==='07-SEC';
 const relic=key==='08-RLC',relicTier=$('relic-tier').value,relicSign=$('relic-sign').checked;
 const limited=edition(key,relicTier,$('serial').value.trim());
 const writing=part=>{
  const size=$('one-'+part+'-size');
  return {size:Math.max(Number(size.min),Math.min(Number(size.max),Number(size.value)||Number(size.defaultValue))),
   x:Number($('one-'+part+'-x').value),y:Number($('one-'+part+'-y').value)};
 };
 const config={...cardGeometry(key),label,style,
  stars:secret?0:Math.max(0,Math.min(10,Math.trunc(Number($('stars').value))||0)),
  attribute:$('attribute').value.trim(),body:$('body-text').value.trim(),
  bodyFont:$('body-font').value,bodySize:Number($('body-size').value),
  signature:$('signature').value.trim(),relicTier,relicSign,
  vocalTake:key==='04-SSR'?vocalSelection(key)?.take:null,
  patchOffset:['patch-x','patch-y'].map(id=>Number($(id).value)/400),
  patch2Offset:['patch2-x','patch2-y'].map(id=>Number($(id).value)/400),
  oneWriting:{sign:writing('sign'),number:writing('number')},
  serial:limited.serial, serialSize:Number($('serial-size').value),
  footer:$('footer').value.trim(), attack:$('attack').value.trim(), defense:$('defense').value.trim(),
  byline:{align:$('byline-align').value,size:Math.min(68,Math.max(24,Number($('byline-size').value)||42)),
   dx:Number($('byline-x').value),dy:Number($('byline-y').value)},
  nameAlign:$('name-align').value,nameOffset:Number($('name-offset').value),
  starSize:Number($('star-size').value),attributeSize:Number($('attribute-size').value),
  backText:$('back-text').value.trim(),backEmblem:$('back-emblem').checked};
 $('relic-fields').hidden=!relic;
 $('patch2-field').hidden=!relic||relicTier!=='5';
 $('signature-field').hidden=!['06-AUTO','09-ONE'].includes(key)&&!(relic&&relicSign);
 $('one-writing').hidden=key!=='09-ONE';
 $('serial-field').hidden=!limited.limit||key==='09-ONE';
 $('serial-size-field').hidden=!limited.limit;
 $('edition-limit').value=limited.limit?'/'+limited.limit:'';
 $('serial').setAttribute('aria-invalid',String(!limited.valid));
 $('foil-area-field').hidden=!['gold','silver'].includes(style.foil);
 $('alt-field').hidden=!style.options.includes('lenticular');
 $('shape-field').hidden=!style.options.includes('diecut');
 $('special-strength-field').hidden=!style.options.some(effect=>['glow','lenticular','translucent','resin'].includes(effect));
 $('zoom-value').value=$('zoom').value+'%';
 $('serial-size-value').value=config.serialSize+'%';
 const framing={position:Number($('crop').value)/100,zoom:Number($('zoom').value)/100,
  offsetX:Number($('crop-x').value)/400,offsetY:Number($('crop-y').value)/400};
 const auth=backAuth();
 const inputs={framing,auth,patch:patchImage,patch2:patch2Image,alternate,vocalAudio:vocalSelection(key)?.audio,
  vocalPools:new Map([...vocalPools].map(([tier,pool])=>[tier,pool.files])),artwork:{...artwork},
  relicOffset:['relic-x','relic-y'].map(id=>Number($(id).value)/400),
  cutout:$('cutout').checked,originalScene:$('scene-mode').value==='original'};
 $('download').disabled=$('png').disabled=$('back-png').disabled=$('try-pack').disabled=true;
 try{
  if(inputs.artwork[key==='03-SR'?'sr-upload':'upload'])$('status').textContent='正在套用母版…';
  const source=await prepareArtwork(inputs,key);
  if(sequence!==revision)return;
  let note=source.note;
  if(secret)note+=' 点击「揭开隐藏卡」可查看画窗。';
  const card=await buildCard(config,source);
  if(sequence!==revision)return;
  Object.assign(style,effectStrengths());
  rendered=card;
  rendered.inputs=inputs;
  const reveal=secret&&document.querySelector('#preview .viewer')?.classList.contains('revealed');
  const wasClaimed=secret&&document.querySelector('#preview .viewer')?.classList.contains('claimed-edition');
  const dark=style.options.includes('glow')&&document.querySelector('#preview .viewer')?.classList.contains('dark-view');
  const backShown=document.querySelector('#preview .turn')?.classList.contains('reversed');
  const viewer=makeViewer(rendered);
  teardown();$('preview').replaceChildren(viewer);teardown=mountViewer(viewer);
  if(reveal)viewer.querySelector('.reveal').click();
  if(wasClaimed)viewer.querySelector('.claim').click();
  if(dark)viewer.querySelector('.light').click();
  if(backShown)viewer.querySelector('.flip').click();
  const issue=limited.valid?'':' 序号须为 1 到 '+limited.limit+'，并使用本版分母 /'+limited.limit+'。';
  $('status').textContent=noteFor(style,note)+issue+(auth.error?' '+auth.error:'');
  $('png').disabled=!limited.valid;
  $('download').disabled=$('back-png').disabled=!limited.valid||!!auth.error;
  $('try-pack').disabled=!limited.valid||!!auth.error;
 }catch(error){
  if(sequence===revision)$('status').textContent='出卡失败：'+error.message;
 }
}

for(const [key,label] of Object.entries(names)){
 const b=document.createElement('button');b.type='button';b.dataset.id=key;
 b.setAttribute('aria-pressed',String(key===id));
 const cover=new Image();cover.src=urlFor(key,'thumb');cover.alt='';
 b.append(cover,document.createTextNode(label));
 b.onclick=()=>{
  id=key;adjustEditionField();adjustStars();$('vocal-audio').value='';syncVocal();
  document.querySelectorAll('#templates button').forEach(node=>node.setAttribute('aria-pressed',String(node.dataset.id===key)));
  refresh();
 };
 $('templates').append(b);
}
for(const [id,choices] of [['foil-type',FOILS],['surface-type',SURFACES]]){
 for(const [key,name] of Object.entries(choices))$(id).add(new Option(name,key));
}
for(const [value,text] of Object.entries(SPECIAL)){
 const label=document.createElement('label'),box=document.createElement('input');
 box.type='checkbox';box.value=value;box.onchange=refresh;
 label.append(box,' '+text);$('special-effects').append(label);
}
for(const role of ['upload','sr-upload','patch','patch2','alt']){
 let version=0;
 $(role).onchange=async()=>{
  const active=++version,file=$(role).files[0];
  if(!file)return;
  const url=URL.createObjectURL(file),image=new Image();image.src=url;
  try{await image.decode();}
  catch{if(active===version)$('status').textContent='无法读取图片，请试试 PNG、JPG 或 WebP。';return;}
  finally{URL.revokeObjectURL(url);}
  if(active!==version)return;
  if(role==='upload'||role==='sr-upload')artwork[role]={image};
  else if(role==='patch')patchImage=image;
  else if(role==='patch2')patch2Image=image;
  else alternate=image;
  refresh();
 };
}
$('serial').addEventListener('input',()=>editionEntries.set(editionKey(),$('serial').value));
let vocalUploadKey;
for(const [key,tier] of Object.entries(names)){
 const row=document.createElement('div'),code=document.createElement('strong'),type=document.createElement('span');
 const detail=document.createElement('small'),total=document.createElement('output'),upload=document.createElement('button');
 row.className='vocal-row';row.dataset.tier=key;
 code.textContent=tier;type.textContent=vocalTypes[key][0];detail.textContent=vocalTypes[key][2];type.append(detail);
 upload.type='button';upload.textContent='上传';upload.setAttribute('aria-label','上传 '+tier+' 干声');
 upload.onclick=()=>{
  const picker=$('vocal-audio');
  vocalUploadKey=key;picker.multiple=Boolean(vocalRules[vocalKey(key)]);picker.value='';picker.click();
 };
 row.append(code,type,total,upload);$('vocal-table').append(row);
}
$('vocal-audio').addEventListener('change',async event=>{
 const key=vocalUploadKey??id,files=[...event.target.files];
 vocalUploadKey=undefined;
 if(!files.length)return;
 const group=vocalKey(key),max=vocalRules[group]?.files??1;
 const active=(vocalRevisions.get(group)??0)+1;
 vocalRevisions.set(group,active);
 if(files.length>max){$('status').textContent=group+' 最多上传 '+max+' 条干声。';return;}
 try{
  const data=await Promise.all(files.map(async (file,index)=>({audio:await blobAsData(file),take:group==='QC'?index+1:null})));
  if(active!==vocalRevisions.get(group))return;
  const shuffled=[];
  while(data.length)shuffled.push(drawVocal(data));
  vocalPools.set(group,{files:shuffled,selected:shuffled[0]});
  syncVocal();refresh();
 }catch{
  if(active===vocalRevisions.get(group))$('status').textContent=names[key]+' 干声读取失败，请尝试 MP3、WAV 或 M4A。';
 }
});
$('vocal-clear').addEventListener('click',()=>{
 const group=vocalKey(id);
 vocalRevisions.set(group,(vocalRevisions.get(group)??0)+1);
 vocalPools.delete(group);$('vocal-audio').value='';syncVocal();refresh();
});
$('vocal-reroll').addEventListener('click',()=>{
 const pool=vocalPools.get(vocalKey(id));
 const next=drawVocal(pool?.files.filter(file=>file!==pool.selected));
 if(next){pool.selected=next;refresh();}
});
$('stars').addEventListener('input',()=>{
 if(id!=='07-SEC')starEntries.set(id,$('stars').value);
});
$('relic-tier').addEventListener('input',()=>{adjustEditionField();refresh();});
const previewStage=$('preview-stage'),previewLamp=$('preview-lamp');
$('mobile-preview-toggle').addEventListener('click',event=>{
 const hidden=previewStage.classList.toggle('preview-collapsed');
 event.currentTarget.setAttribute('aria-expanded',String(!hidden));
 event.currentTarget.textContent=hidden?'展开预览':'收起预览';
});
function setPreviewLamp(on){
 previewStage.classList.toggle('lamp-on',on);
 previewLamp.setAttribute('aria-pressed',String(on));
 previewLamp.textContent=on?'关灯':'开灯';
}
previewLamp.addEventListener('click',()=>{
 const on=!previewStage.classList.contains('lamp-on');
 if(on)previewStage.querySelector('.dark-view .light')?.click();
 setPreviewLamp(on);
});
$('preview').addEventListener('click',event=>{
 if(event.target.matches('.light[aria-pressed="true"]'))setPreviewLamp(false);
});
$('preview-background').addEventListener('input',event=>{
 previewStage.dataset.background=event.target.value;
});
let packTrial;
const trialVocalPools=new Map();
function trialDeck(card,{cards,drawn},mode){
 const style={...card.style};
 const source={...card.inputs,auth:{qr:card.inputs.auth.qr?{}:null,pin:card.inputs.auth.pin}};
 if(!Object.values(drawn).some(Boolean))trialVocalPools.set(mode,source.vocalPools);
 const pools=trialVocalPools.get(mode);
 const cache=new Map();
 const numbers=new Map();
 const counts={...drawn};
 return cards.map(tier=>{
  const key=Object.keys(names).find(id=>names[id]===tier);
  const {limit}=edition(key,card.relicTier,'');
  let serial='';
  if(limit){
   if(!numbers.has(key))numbers.set(key,Array.from({length:limit},(_,i)=>i+1));
   const pool=numbers.get(key),[number]=pool.splice(Math.floor(Math.random()*pool.length),1);
   serial=edition(key,card.relicTier,String(number??1)).serial;
  }
  const group=vocalKey(key),rule=vocalRules[group],pool=pools?.get(group);
  let vocal;
  if(rule&&pool?.length){
   const ordinal=rule.tiers.reduce((sum,type)=>sum+counts[type],0);
   if(ordinal<rule.cap*pool.length)vocal=pool[ordinal%pool.length];
  }else if(group==='ONE')vocal=pool?.[0];
  counts[tier]++;
  const config={...card,...cardGeometry(key),style,stars:templateStars[key],serial,vocalTake:vocal?.take};
  const cardSource={...source,vocalAudio:vocal?.audio};
  const backs=()=>{
   if(!cache.has(serial))cache.set(serial,buildBacks(config,source.auth).catch(error=>{cache.delete(serial);throw error;}));
   return cache.get(serial);
  };
  let data;
  const load=()=>{
   data??=prepareArtwork(cardSource,key).then(prepared=>buildCard(config,prepared,backs())).catch(error=>{data=null;throw error;});
   return data;
  };
  return {key,tier,back:async()=>(await backs()).back,
   portrait:async state=>(await compositeFront(await load(),state,.24)).toDataURL('image/webp',.93),
   load:async()=>makeViewer(await load())};
 });
}
$('try-pack').addEventListener('click',async()=>{
 const button=$('try-pack');
 button.disabled=true;
 try{
  if(!packTrial){
   const {setupPackTrial}=await import('./assets/pack-trial.js');
   packTrial=setupPackTrial($('pack-trial'),mountViewer);
  }
  if(rendered){
   const snapshot=rendered;
   packTrial((reservation,mode)=>trialDeck(snapshot,reservation,mode));
  }
 }catch(error){$('status').textContent='卡包载入失败：'+error.message;}
 finally{button.disabled=$('download').disabled;}
});
for(const id of ['foil-strength','surface-strength','special-strength']){
 const control=$(id);
 control.addEventListener('input',()=>{
  $(id+'-value').value=control.value+'%';
  const viewer=$('preview').querySelector('.viewer');
  if(!rendered||!viewer)return;
  Object.assign(rendered.style,effectStrengths());
  paintStrengths(viewer,rendered.style);
 });
}
let delay;
for(const selector of ['name','name-align','name-offset','crop','crop-x','crop-y','zoom','cutout','scene-mode','stars','star-size','attribute','attribute-size','body-text','body-font','body-size','signature','one-sign-size','one-number-size','one-sign-x','one-number-x','one-sign-y','one-number-y','attack','defense','footer','byline-size','byline-align','byline-x','byline-y','serial','serial-size','relic-sign','back-text','back-emblem','back-qr','back-qr-url','back-pin','foil-type','surface-type','foil-area','shape'])
 $(selector).addEventListener('input',()=>{clearTimeout(delay);delay=setTimeout(refresh,110);});
for(const selector of ['relic-x','relic-y','patch-x','patch-y','patch2-x','patch2-y'])
 $(selector).addEventListener('input',()=>{clearTimeout(delay);delay=setTimeout(refresh,110);});
const bodySize=$('body-size'),bodySizeNumber=$('body-size-number');
bodySize.addEventListener('input',()=>{bodySizeNumber.value=bodySize.value;});
function setBodySize(value){
 bodySize.value=value;
 bodySize.dispatchEvent(new Event('input'));
}
bodySizeNumber.addEventListener('input',()=>{
 if(bodySizeNumber.value&&bodySizeNumber.validity.valid)setBodySize(bodySizeNumber.value);
});
bodySizeNumber.addEventListener('change',()=>{
 setBodySize(bodySizeNumber.value?Math.round(bodySizeNumber.valueAsNumber):bodySize.value);
});
async function save(blob,ext,data,suffix=''){
 const filename=(data.label||'S1').replace(/[<>:"/\\|?*]/g,'-')+'-'+names[data.id]+suffix+'.'+ext;
 if(window.chrome?.webview){
  const content=await blobAsData(blob);
  window.chrome.webview.postMessage({action:'save-card',filename,content});
  return;
 }
 const a=document.createElement('a'),url=URL.createObjectURL(blob);
 a.download=filename;
 a.href=url;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
}
window.chrome?.webview?.addEventListener('message',event=>{
 if(typeof event.data==='string')$('status').textContent=event.data;
});
function blobAsData(blob){
 return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);});
}
$('download').onclick=async()=>{
 const data=rendered;
 try{
  const viewer=makeViewer(data);
  await Promise.all([...viewer.querySelectorAll('img[src]')].map(async img=>{
   if(img.getAttribute('src').startsWith('data:'))return;
   const file=await fetch(img.getAttribute('src'));
   if(!file.ok)throw new Error('载入卡面失败');
   img.setAttribute('src',await blobAsData(await file.blob()));
  }));
  const html='<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>S1 交互闪卡</title><style>'+viewerStyle+'body{margin:0;min-height:100dvh;display:grid;place-items:center;background:radial-gradient(ellipse at 50% 20%,#162236,#080c15 72%);padding:18px}.viewer{width:min(86vw,420px,calc((100dvh - 116px)*5/7))}</style><body>'+viewer.outerHTML+'<script>'+viewerCode+';mountViewer(document.querySelector(".viewer"));<'+ '/script></body></html>';
  await save(new Blob([html],{type:'text/html;charset=utf-8'}),'html',data);
 }catch(error){$('status').textContent='导出失败：'+error.message;}
};
$('png').onclick=async()=>{
 const data=rendered;
 try{
  const viewer=document.querySelector('#preview .viewer');
  const output=await compositeFront(data,{revealed:viewer?.classList.contains('revealed'),
   claimed:viewer?.classList.contains('claimed-edition')});
  applyFlatEffects(output,{...data.style,template:data.id,templateFoil:data.finish[0],window:data.window,uvMask:data.person?data.layer:null,
   dark:document.querySelector('#preview .viewer')?.classList.contains('dark-view')});
  const blob=await new Promise(resolve=>output.toBlob(resolve,'image/png'));
  if(!blob)throw new Error('PNG 编码失败');
  await save(blob,'png',data);
 }catch(error){$('status').textContent='导出失败：'+error.message;}
};
async function compositeFront(data,{revealed=false,claimed=false}={},scale=1){
 const [width,height]=data.size;
 const out=canvas(Math.round(width*scale),Math.round(height*scale)),ctx=out.getContext('2d');
 ctx.scale(scale,scale);
 ctx.drawImage(await getImage(data.plate),0,0,width,height);
 if(data.layer){
  const [x,y,r,b]=data.window;
  const artwork=data.sceneURL?fitted(data.uploaded,null,r-x,b-y,data.framing):data.layer;
  ctx.drawImage(artwork,x,y);
  ctx.drawImage(await getImage(data.frame),0,0,width,height);
 }
 if(data.secret&&!revealed)ctx.drawImage(await getImage(data.secretURL),...data.window.slice(0,2));
 ctx.drawImage(await getImage(data.panel),0,0,width,height);
 ctx.drawImage(await getImage(data.secret&&claimed?data.claimedDecoration:data.decoration),0,0);
 return out;
}
$('back-png').onclick=async()=>{
 const data=rendered,claimed=data.secret&&document.querySelector('#preview .viewer')?.classList.contains('claimed-edition');
 try{
  const response=await fetch(claimed?data.claimedBack:data.back);
  await save(await response.blob(),'png',data,'-卡背');
 }catch(error){$('status').textContent='导出失败：'+error.message;}
};
adjustStars();
syncVocal();
refresh();
if(window.isSecureContext&&'serviceWorker' in navigator&&location.hostname!=='s1-card-studio.example'){
 navigator.serviceWorker.register('./sw.js').catch(()=>{});
}



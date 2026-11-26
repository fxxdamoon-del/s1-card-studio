import qrcode from './assets/qrcode.mjs';

export const FOILS={default:'按母版',none:'无箔面',laser:'镭射',holo:'全息',gold:'烫金',silver:'烫银',rainbow:'彩虹箔',iridescent:'幻彩箔',glitter:'闪粉',pearl:'珠光'};
export const SURFACES={default:'按母版',matte:'磨砂',gloss:'亮面',emboss:'浮雕 / 压纹',uv:'局部 UV',laminate:'覆膜'};
export const SPECIAL={glow:'夜光',lenticular:'3D 光栅',diecut:'异形模切',translucent:'透明卡',holes:'镂空',resin:'滴胶'};
export const WINDOW=[146,476,1840,2194];
export const SHAPES={
 octagon:[[.08,0],[.92,0],[1,.06],[1,.94],[.92,1],[.08,1],[0,.94],[0,.06]],
 shield:[[0,0],[1,0],[1,.82],[.5,1],[0,.82]],
 arch:[[.24,0],[.76,0],[.94,.11],[1,.23],[1,1],[0,1],[0,.23],[.06,.11]]
};
export function canvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
export function fit(ctx,image,w,h,position=.35,zoom=1,offsetX=0,offsetY=0){
 const iw=image.naturalWidth||image.width,ih=image.naturalHeight||image.height;
 const scale=Math.max(w/iw,h/ih)*zoom;
 const dw=iw*scale,dh=ih*scale,x=(w-dw)/2+w*offsetX,y=(h-dh)*position+h*offsetY;
 ctx.drawImage(image,x,y,dw,dh);
 return [x,y,dw,dh];
}
export function refineMask(coarse,input,w,h){
 const resized=canvas(w,h),ctx=resized.getContext('2d',{willReadFrequently:true});
 ctx.drawImage(coarse,0,0,w,h);
 const pixels=ctx.getImageData(0,0,w,h),temp=pixels.data.slice();
 const color=input.getContext('2d',{willReadFrequently:true}).getImageData(0,0,w,h).data;
 const sample=[[-3,0],[-2,-2],[-2,2],[0,-3],[0,3],[2,-2],[2,2],[3,0]];
 for(let y=3;y<h-3;y++)for(let x=3;x<w-3;x++){
  const p=(y*w+x)*4,a=temp[p+3];
  if(a===0||a===255)continue;
  let sum=a*2,weight=2;
  for(const [dx,dy] of sample){
   const q=((y+dy)*w+x+dx)*4;
   const distance=(Math.abs(color[p]-color[q])+Math.abs(color[p+1]-color[q+1])+Math.abs(color[p+2]-color[q+2]))/3;
   const strength=Math.exp(-distance/24);
   sum+=temp[q+3]*strength;weight+=strength;
  }
  pixels.data[p+3]=Math.round(sum/weight);
 }
 ctx.putImageData(pixels,0,0);return resized;
}
function badge(ctx,x,y,r,glyph,orange,black=false){
 ctx.save();ctx.shadowColor='#000c';ctx.shadowBlur=r*.24;ctx.shadowOffsetY=r*.13;
 const g=ctx.createRadialGradient(x-r*.28,y-r*.33,r*.03,x,y,r);
 if(black){g.addColorStop(0,'#414145');g.addColorStop(.66,'#222225');g.addColorStop(1,'#101012');}
 else if(orange){g.addColorStop(0,'#ffdc90');g.addColorStop(.53,'#e28b2b');g.addColorStop(.83,'#bc5d19');g.addColorStop(1,'#71310f');}
 else{g.addColorStop(0,'#fff2ad');g.addColorStop(.66,'#e4b95b');g.addColorStop(.89,'#b47c2b');g.addColorStop(1,'#734815');}
 ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=g;ctx.fill();ctx.shadowBlur=0;
 ctx.strokeStyle=black?'#3d3d41':orange?'#ffe0a0':'#f4cb77';ctx.lineWidth=1.4;ctx.stroke();
 ctx.fillStyle=black?'#b0b0b6':orange?'#fff1bb':'#503008';ctx.textAlign='center';ctx.textBaseline='middle';
 ctx.font='bold '+Math.round(r*(orange?1.58:1.1))+'px "Microsoft YaHei",Arial';ctx.fillText(glyph,x,y+1);
 ctx.restore();
}
const bodyFonts={
 sans:'"Microsoft YaHei","Segoe UI",sans-serif',
 serif:'Georgia,SimSun,serif',
 hand:'"Segoe Print",KaiTi,cursive'
};
function bodyLines(ctx,copy,width,limit){
 const result=[];
 for(const paragraph of copy.split(/\r?\n/)){
  let line='';
  for(const word of paragraph.match(/[\x21-\x7e]+\s*|[^\x21-\x7e]/gu)||[]){
   const parts=ctx.measureText(word).width>width?[...word]:[word];
   for(const part of parts){
    if(line&&ctx.measureText(line+part).width>width){result.push(line.trimEnd());line='';}
    line+=part;
   }
  }
  result.push(line.trimEnd());
 }
 if(result.length>limit){const last=result[limit-1];result[limit-1]=last.slice(0,Math.max(1,last.length-2))+'…';}
 return result.slice(0,limit);
}
const titles={
 '01-C':'C — COLLECTIBLE • COMMON','02-R':'R — RARE','03-SR':'SR — SUPER RARE',
 '04-SSR':'SSR — SUPER SUPER RARE','05-UR':'UR — ULTRA RARE',
 '06-AUTO':'AUTO — AUTOGRAPH','07-SEC':'SEC — SECRET','08-RLC':'RLC — RELIC','09-ONE':'ONE — ONE-OF-ONE'
};
export const RELIC_WINDOW=[224,530,1776,1740];
export const PIN_AREA=[270,1253,452,48];
const ONE_INK_AREA=[91,2382,1800,277];
const numbered={'04-SSR':199,'05-UR':99,'06-AUTO':50,'07-SEC':33,'09-ONE':1};
export function edition(id,tier,entry){
 const limit=id==='08-RLC'?Number(tier):numbered[id];
 if(!limit)return {limit:null,serial:'',valid:true};
 if(id==='09-ONE')return {limit,serial:'1/1',valid:true};
 if(!entry)return {limit,serial:'/'+limit,valid:true};
 const match=entry.match(/^(\d+)(?:\s*\/\s*(\d+))?$/);
 if(!match||Number(match[1])<1||Number(match[1])>limit||(match[2]&&Number(match[2])!==limit))
  return {limit,serial:'/'+limit,valid:false};
 const digits=id==='04-SSR'||id==='05-UR'?3:2;
 return {limit,serial:String(Number(match[1])).padStart(digits,'0')+'/'+limit,valid:true};
}
function handwritten(ctx,copy,x,y,width,size,color='#392b27'){
 ctx.save();ctx.translate(x,y);ctx.rotate(-.07);
 ctx.font='italic '+size+'px "Segoe Script","Segoe Print","KaiTi","楷体","STKaiti",cursive';
 ctx.textBaseline='middle';ctx.textAlign='center';ctx.fillStyle=color;ctx.fillText(copy,0,0,width);ctx.restore();
}
function clothBox(ctx,box,image,[offsetX,offsetY]=[0,0]){
 const [l,t,r,b]=box,w=r-l,h=b-t;
 ctx.save();
 ctx.beginPath();ctx.roundRect(l,t,w,h,39);
 ctx.fillStyle='#1b1718';ctx.fill();
 ctx.lineWidth=12;ctx.strokeStyle='#2b1d19';ctx.stroke();
 ctx.clip();ctx.translate(l+13,t+13);fit(ctx,image,w-26,h-26,.5,1,offsetX,offsetY);
 ctx.restore();
 ctx.save();ctx.beginPath();ctx.roundRect(l+4,t+4,w-8,h-8,34);
 ctx.lineWidth=5;ctx.strokeStyle='#ceaa6c';ctx.setLineDash([15,12]);ctx.stroke();ctx.restore();
}
function relicDetails(ctx,config,assets){
 const {patch,patch2,cloth,signatureStrip}=assets;
 const bottom=config.relicSign?2128:2217;
 if(config.relicTier==='5'){
  clothBox(ctx,[238,1810,986,bottom],patch||cloth,config.patchOffset);
  clothBox(ctx,[1014,1810,1762,bottom],patch2||cloth,config.patch2Offset);
 }else{
  clothBox(ctx,[238,1810,1762,bottom],patch||cloth,config.patchOffset);
 }
 if(config.relicSign){
  ctx.drawImage(signatureStrip,684,2157,632,72);
  ctx.save();ctx.setLineDash([11,7]);ctx.strokeStyle='#9b774e';ctx.lineWidth=3;ctx.strokeRect(689,2162,622,62);ctx.restore();
  if(config.signature)handwritten(ctx,config.signature,1000,2194,570,56);
 }
}

function cardFooter(ctx,config){
 const light=['02-R','04-SSR','06-AUTO','09-ONE'].includes(config.id);
 const color=light?'#191519':'#f1e2c7';
 const title='THE REPUBLIC OF THOUGHT  •  '+config.id.slice(3)+(config.serial?'  •  ':'');
 const titleFont='bold 43px "Segoe UI","Microsoft YaHei",sans-serif';
 const serialSize=Math.round(52*config.serialSize/100);
 const manual=config.id==='09-ONE';
 const serialFont=(manual?'italic ':'bold ')+serialSize+'px '+(manual?'"Segoe Script","Segoe Print",cursive':'Consolas,"Courier New",monospace');
 ctx.save();
 ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillStyle=color;
 ctx.font=titleFont;const titleWidth=ctx.measureText(title).width;
 ctx.font=serialFont;const serialWidth=ctx.measureText(config.serial).width;
 const width=titleWidth+serialWidth;
 const scale=Math.min(1,1740/width),x=1000-width*scale/2,y=0;
 ctx.translate(0,2704);
 ctx.scale(1,Math.min(1,60/Math.max(43,config.serial?serialSize:0)));
 ctx.lineWidth=5;ctx.lineJoin='round';ctx.strokeStyle=light?'#fff8e5aa':'#0a0c14bb';
 ctx.font=titleFont;ctx.strokeText(title,x,y,titleWidth*scale);ctx.fillText(title,x,y,titleWidth*scale);
 if(manual&&config.serial)handwritten(ctx,config.serial,x+(titleWidth+serialWidth/2)*scale,y,serialWidth*scale,serialSize,color);
 else if(config.serial){
  ctx.font=serialFont;ctx.strokeText(config.serial,x+titleWidth*scale,y,serialWidth*scale);
  ctx.fillText(config.serial,x+titleWidth*scale,y,serialWidth*scale);
 }
 ctx.restore();
}

function byline(ctx,config,left,right,y){
 const {align,size,dx,dy}=config.byline;
 const anchor=align==='left'?left+(config.id==='09-ONE'?8:38):align==='right'?right-20:(left+right)/2;
 const x=Math.max(left,Math.min(right,anchor+dx));
 const width=align==='center'?2*Math.min(x-left,right-x):align==='left'?right-x:x-left;
 if(width<1)return;
 const light=['02-R','06-AUTO','09-ONE'].includes(config.id);
 ctx.save();
 ctx.font='bold '+size+'px Georgia,"Microsoft YaHei",serif';
 ctx.textBaseline='middle';ctx.textAlign=align;ctx.fillStyle=light?'#251e1b':'#f1e2c7';
 ctx.lineWidth=4;ctx.lineJoin='round';ctx.strokeStyle=light?'#fff8e5aa':'#0a0c14bb';
 ctx.strokeText(config.footer,x,y+dy,width);ctx.fillText(config.footer,x,y+dy,width);
 ctx.restore();
}

function panelEdition(ctx,config,ink){
 ctx.save();
 ctx.fillStyle=ink;ctx.textBaseline='middle';
 ctx.font='bold 50px "Segoe UI","Microsoft YaHei",sans-serif';
 ctx.textAlign='left';ctx.fillText(titles[config.id].replace(' — ',' • '),174,2334,1130);
 ctx.fillStyle=config.id==='07-SEC'?'#6d6668':'#8a4638';ctx.fillRect(138,2310,12,65);
 if(config.id==='06-AUTO'&&config.serial){
  const size=Math.min(76,Math.round(54*config.serialSize/100));
  ctx.fillStyle=ink;ctx.font='bold '+size+'px Consolas,"Courier New",monospace';
  ctx.textAlign='right';ctx.fillText(config.serial,1846,2574,440);
 }
 ctx.restore();
}

function writingSlot(ctx,{x,y,width,height},copy,size,border){
 ctx.save();
 ctx.beginPath();ctx.roundRect(x,y,width,height,12);
 ctx.fillStyle='#fcfbf8';ctx.fill();ctx.lineWidth=2;ctx.strokeStyle=border;ctx.stroke();
 if(copy){
  ctx.clip();
  handwritten(ctx,copy,x+width/2,y+height/2,width-32,size);
 }
 ctx.restore();
}

function oneInk(ctx,config){
 const [x,y,w,h]=ONE_INK_AREA,half=h/2;
 ctx.fillStyle='#101113';ctx.fillRect(x,y,w,h);
 const entries=[[config.signature,config.oneWriting.sign],[config.serial,config.oneWriting.number]];
 for(const [index,[copy,style]] of entries.entries()){
  if(!copy)continue;
  const row=y+half*index,center=x+w/2+style.x;
  const width=2*Math.min(center-x,x+w-center)-40;
  const travel=Math.max(8,(half-style.size*.88)/2-7);
  const baseline=row+half/2+Math.max(-travel,Math.min(travel,style.y));
  ctx.save();
  ctx.beginPath();ctx.rect(x+12,row,w-24,half);ctx.clip();
  handwritten(ctx,copy,center,baseline,width,style.size,'#e7c36d');
  ctx.restore();
 }
}

export function decorate(config,assets={}){
 const layer=canvas(...config.size),ctx=layer.getContext('2d');
 const autograph=config.id==='06-AUTO';
 const one=config.id==='09-ONE';
 const secret=config.id==='07-SEC';
 const ink=secret?'#b8b8bc':'#302219';
 if(config.label){
  ctx.font='bold 100px Georgia,"Microsoft YaHei",serif';ctx.fillStyle=secret?ink:autograph?'#262728':'#f4dfaa';
  ctx.textBaseline='middle';ctx.textAlign=config.nameAlign;
  const left=149,right=config.attribute?1748-config.attributeSize-40:1848;
  const span=right-left,offset=config.nameOffset;
  const anchor=config.nameAlign==='left'?left+120:config.nameAlign==='right'?right-120:(left+right)/2;
  const x=anchor+offset;
  ctx.save();
  ctx.beginPath();ctx.rect(left,116,span,222);ctx.clip();
  const usable=config.nameAlign==='center'?Math.min(x-left,right-x)*2:config.nameAlign==='right'?x-left:right-x;
  ctx.fillText(config.label,x,231,Math.max(160,Math.min(span,usable)));
  ctx.restore();ctx.textAlign='left';
 }
 const [,ty,rx,by]=config.meta.customStarsAreaXYXY;
 const radius=Math.min(config.starSize,(rx-354)/(2.32*Math.max(1,config.stars)));
 if(config.footer){
  const left=config.id==='09-ONE'?239:110;
  const starsLeft=config.stars?rx-config.stars*radius*2-(config.stars-1)*5:rx;
  byline(ctx,config,left,starsLeft-24,(ty+by)/2);
 }
 for(let i=0;i<config.stars;i++)badge(ctx,rx-radius-i*(2*radius+5),(ty+by)/2,radius,'★',true,secret);
 if(config.attribute){
  const [l,t,r,b]=config.meta.customAttributeAreaXYXY;
  badge(ctx,(l+r)/2,(t+b)/2,config.attributeSize,config.attribute,false,secret);
 }
 ctx.textBaseline='middle';ctx.fillStyle=ink;ctx.textAlign='left';
 const statText=[config.attack&&'ATK '+config.attack,config.defense&&'DEF '+config.defense].filter(Boolean).join('   ');
 if(statText){
  ctx.textAlign='right';ctx.font='bold 44px "Segoe UI",sans-serif';ctx.fillText(statText,1836,2334,500);ctx.textAlign='left';
 }
 if(config.id==='04-SSR'&&config.vocalTake){
  ctx.textAlign='right';ctx.font='bold 40px "Segoe UI",sans-serif';
  ctx.fillText('QC · TAKE '+String(config.vocalTake).padStart(2,'0'),1836,2574,320);
  ctx.textAlign='left';
 }
 if(autograph){
  writingSlot(ctx,{x:678,y:2523,width:644,height:132},config.signature,82,'#b4afa5');
 }
 if(one)oneInk(ctx,config);
 if(config.body){
  const size=config.bodySize||58,lineHeight=Math.ceil(size*1.18),available=one?53:118;
  ctx.save();
  ctx.translate(one?735:174,one?2306:2378);ctx.scale(1,Math.min(1,available/size));
  ctx.fillStyle=ink;ctx.textBaseline='top';ctx.textAlign='left';
  ctx.font=size+'px '+(bodyFonts[config.bodyFont]||bodyFonts.sans);
  const columns=one?575:1662,lines=Math.max(1,1+Math.floor((available-size)/lineHeight));
  for(const [i,line] of bodyLines(ctx,config.body,columns,lines).entries())ctx.fillText(line,0,i*lineHeight,columns);
  ctx.restore();
 }
 panelEdition(ctx,config,ink);
 cardFooter(ctx,config);
 if(config.id==='08-RLC')relicDetails(ctx,config,assets);
 return layer;
}


function drawAuth(ctx,{qr,pin}){
 ctx.save();
 ctx.textAlign='center';ctx.textBaseline='middle';
 if(qr){
  const count=qr.getModuleCount?.();
  const size=150;
  const unit=count?Math.floor(size/(count+8)):0;
  const quiet=count?Math.floor((size-count*unit)/2):0;
  const x=914-size,y=94,center=x+size/2;
  ctx.font='bold 17px "Microsoft YaHei",sans-serif';
  ctx.fillStyle='#fff';ctx.fillRect(x,y,size,size);
  ctx.fillStyle='#16191f';
  if(count){
   const startX=x+quiet,startY=y+quiet;
   for(let row=0;row<count;row++){
    for(let col=0;col<count;col++){
     if(qr.isDark(row,col))ctx.fillRect(startX+col*unit,startY+row*unit,unit,unit);
    }
   }
  }else ctx.fillText('验真二维码占位',center,y+size/2,size-8);
  ctx.fillStyle='#e6d8b9';ctx.fillText('扫码验真 · 认领电子卡',center,y+size+19,size);
  ctx.font='17px "Microsoft YaHei",sans-serif';ctx.fillText('听独家干声',center,y+size+39,size);
 }
 if(pin){
  const [x,y,width,height]=PIN_AREA;
  const foil=ctx.createLinearGradient(x,y,x+width,y+height);
  foil.addColorStop(0,'#a8aab1');foil.addColorStop(.46,'#eeeeef');foil.addColorStop(1,'#a4a7ae');
  ctx.fillStyle=foil;ctx.strokeStyle='#d4d5d7';ctx.lineWidth=3;
  ctx.beginPath();ctx.roundRect(x,y,width,height,8);ctx.fill();ctx.stroke();
  ctx.font='bold 23px "Microsoft YaHei",sans-serif';
  ctx.fillStyle='#20252d';ctx.fillText('刮开涂层，输入 PIN 认领',500,y+height/2,width-40);
 }
 ctx.restore();
}

export function makeBackQR(url){
 const code=qrcode(0,'M');
 code.addData(url);code.make();
 return code;
}

export function backArt(image,text,serial,serialSize,emblem,manual=false,auth={}){
 const result=canvas(1000,1400),ctx=result.getContext('2d');
 ctx.drawImage(image,0,0,1000,1400);
 const detailed=auth.qr||auth.pin;
 if(emblem){
  if(auth.qr)ctx.drawImage(emblem,124,128,148,148);
  else ctx.drawImage(emblem,389,153,222,222);
 }
 ctx.drawImage(image,360,1238,254,82,64,1238,254,82);
 if(serial){
  const size=Math.round(30*serialSize/100);
  if(manual)handwritten(ctx,serial,122,1289,120,size,'#9fb0bc');
  else{
   ctx.fillStyle='#9fb0bc';ctx.font='bold '+size+'px "Courier New",monospace';ctx.textBaseline='alphabetic';
   ctx.fillText(serial,75,1299,250);
  }
 }
 if(text){
  ctx.save();
  ctx.translate(500,700);ctx.rotate(-Math.PI/24);
  ctx.font='bold 165px "Segoe Print","Comic Sans MS",cursive';
  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillStyle='#56212a';ctx.fillText(text,7,10,810);
  ctx.fillStyle='#e54443';ctx.strokeStyle='#e54443';ctx.lineWidth=3;
  ctx.strokeText(text,0,0,810);ctx.fillText(text,0,0,810);
  ctx.beginPath();ctx.moveTo(-319,116);ctx.quadraticCurveTo(-74,127,304,96);ctx.lineWidth=12;ctx.strokeStyle='#c33435';ctx.stroke();
  ctx.restore();
 }
 if(detailed)drawAuth(ctx,auth);
 return result;
}
let pattern;
export function glitter(){
 if(pattern)return pattern;
 const layer=canvas(530,730),ctx=layer.getContext('2d');
 let state=937;const random=()=>{state=(state*16807)%2147483647;return state/2147483647;};
 for(let i=0;i<600;i++){
  ctx.fillStyle=['#dbc8ffa9','#f9e3b4b2','#ffffffb4','#a7ebf785'][i%4];
  const x=random()*530,y=random()*730,r=random()**3*3.6+.48;
  ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
 }
 pattern=layer.toDataURL('image/png');return pattern;
}
export function applyFlatEffects(output,style){
 const painted=canvas(output.width,output.height),ctx=painted.getContext('2d');
 const w=output.width,h=output.height;
 ctx.drawImage(output,0,0);
 const {foil,surface,options,scope,foilStrength=1,surfaceStrength=1,specialStrength=1}=style;
 const matte=surface==='matte'?Math.max(0,1-.64*surfaceStrength):1;
 if(surface==='matte'&&surfaceStrength){
  ctx.save();ctx.filter='contrast('+Math.max(.7,1-.10*surfaceStrength)+') saturate('+Math.max(.54,1-.18*surfaceStrength)+')';
  ctx.clearRect(0,0,w,h);ctx.drawImage(output,0,0);ctx.restore();
 }
 const codes={laser:['#8056ed','#e56bab','#f9cd79','#5eddc2'],holo:['#91dcff','#bc79e0','#f9db9e','#99f0e4'],rainbow:['#985df0','#e08abd','#ffd47b','#5fd2bb'],iridescent:['#32787f','#9cb767','#bf7dde','#e09564'],gold:['#8a4e25','#f9e6a4','#a3682f','#fcdf85'],silver:['#687484','#f2f5ff','#8995ae','#e1edf9'],pearl:['#ffffff','#d8d8fa','#f1dce9','#e7edfb']};
 const baseFoil=foil==='default'&&style.template==='02-R'?'pearl':foil;
 const templateFilm=foil==='default'&&style.templateFoil>0;
 if(foilStrength&&(codes[baseFoil]||templateFilm)){
  ctx.save();
  if(templateFilm){
   const [x,y,r,b]=style.window??WINDOW;ctx.beginPath();ctx.rect(x,y,r-x,b-y);ctx.clip();
  }else if(foil==='default'||scope==='rim'&&(foil==='gold'||foil==='silver')){
   ctx.beginPath();ctx.rect(0,0,w,h);ctx.rect(w*.059,h*.059,w*.882,h*.882);ctx.clip('evenodd');
  }
  const gradient=ctx.createLinearGradient(0,h,w,0);
  (codes[baseFoil]||codes.rainbow).forEach((c,i)=>gradient.addColorStop(i/3,c));
  ctx.globalCompositeOperation='screen';ctx.globalAlpha=Math.min(.85,(templateFilm?style.templateFoil:.31)*foilStrength*matte);
  ctx.fillStyle=gradient;ctx.fillRect(0,0,w,h);ctx.restore();
 }else if(foil==='glitter'&&foilStrength){
  ctx.save();let state=937;
  const random=()=>{state=(state*16807)%2147483647;return state/2147483647;};
  ctx.globalCompositeOperation='screen';ctx.globalAlpha=Math.min(.96,.74*foilStrength*matte);
  for(let i=0;i<600;i++){ctx.fillStyle=['#dbc8ff','#f9e3b4','#ffffff','#a7ebf7'][i%4];ctx.beginPath();ctx.arc(random()*w,random()*h,random()**3*12+1.7,0,Math.PI*2);ctx.fill();}
  ctx.restore();
 }
 const shine=Math.max(surface==='gloss'?.68*surfaceStrength:surface==='laminate'?.49*surfaceStrength:0,
  options.includes('resin')?.66*specialStrength:0);
 if(shine){
  ctx.save();
  const light=ctx.createLinearGradient(0,0,w,h);
  light.addColorStop(.37,'#ffffff00');light.addColorStop(.49,'#ffffff91');light.addColorStop(.58,'#ffffff00');
  ctx.globalCompositeOperation='screen';ctx.globalAlpha=Math.min(1,shine);
  ctx.fillStyle=light;ctx.fillRect(0,0,w,h);ctx.restore();
 }
 if(surface==='uv'&&surfaceStrength){
  const [x,y,r,b]=style.window??WINDOW,area=canvas(r-x,b-y),paint=area.getContext('2d');
  const spot=paint.createRadialGradient(area.width*.5,area.height*.42,0,area.width*.5,area.height*.42,area.width*.42);
  spot.addColorStop(0,'#ffffffad');spot.addColorStop(1,'#ffffff00');paint.fillStyle=spot;
  paint.fillRect(0,0,area.width,area.height);
  if(style.uvMask){paint.globalCompositeOperation='destination-in';paint.drawImage(style.uvMask,0,0);}
  ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=Math.min(1,.71*surfaceStrength);ctx.drawImage(area,x,y);ctx.restore();
 }
 if(surface==='emboss'&&surfaceStrength){
  ctx.save();ctx.beginPath();ctx.rect(0,0,w,h);ctx.rect(w*.09,h*.09,w*.82,h*.82);ctx.clip('evenodd');
  ctx.globalAlpha=Math.min(1,.68*surfaceStrength);
  for(let x=-h;x<w;x+=34){ctx.strokeStyle='#ffffff69';ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+h,h);ctx.lineWidth=4;ctx.stroke();}
  ctx.restore();
 }
 if(style.dark&&options.includes('glow')&&specialStrength){
  ctx.save();
  ctx.globalAlpha=Math.min(1,specialStrength);
  ctx.globalCompositeOperation='source-over';
  ctx.fillStyle='#03070bba';ctx.fillRect(0,0,w,h);
  ctx.shadowColor='#62ffb3';ctx.shadowBlur=18;
  ctx.strokeStyle='#a5ffd3';ctx.lineWidth=4;ctx.strokeRect(w*.03,h*.03,w*.94,h*.94);
  ctx.restore();
 }
 if(style.template==='09-ONE'){
  const [x,y,w,h]=ONE_INK_AREA;
  ctx.drawImage(output,x,y,w,h,x,y,w,h);
 }
 ctx.globalCompositeOperation='destination-in';ctx.drawImage(output,0,0);
 if(options.includes('holes')){
  ctx.globalCompositeOperation='destination-out';
  for(const x of [.04,.96])for(const y of [.48,.54]){ctx.beginPath();ctx.arc(w*x,h*y,w*.016,0,Math.PI*2);ctx.fill();}
 }
 const next=output.getContext('2d');next.clearRect(0,0,w,h);next.save();
 if(options.includes('diecut')){
  SHAPES[style.shape].forEach(([x,y],i)=>{if(i===0)next.beginPath();if(i===0)next.moveTo(x*w,y*h);else next.lineTo(x*w,y*h);});next.closePath();next.clip();
 }
 next.globalAlpha=options.includes('translucent')?Math.max(.25,1-.40*specialStrength):1;
 next.drawImage(painted,0,0);
 next.globalAlpha=1;next.globalCompositeOperation='source-atop';
 if(!options.includes('diecut')){
  next.beginPath();next.roundRect(8,8,w-16,h-16,56);
 }
 const warm=['04-SSR','05-UR','08-RLC','09-ONE'].includes(style.template);
 next.strokeStyle='#14151ee0';next.lineWidth=21;next.stroke();
 next.strokeStyle=warm?'#e8d1a4e0':'#adb9c8d9';next.lineWidth=7;next.stroke();
 next.restore();
}


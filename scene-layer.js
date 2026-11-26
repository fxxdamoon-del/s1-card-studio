import {canvas,fit} from './card-editing.js';

function spread(values,w,h,reach){
 const xpass=new Float32Array(values.length),result=new Float32Array(values.length);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  let high=0;
  for(let i=Math.max(0,x-reach);i<=Math.min(w-1,x+reach);i++)high=Math.max(high,values[y*w+i]);
  xpass[y*w+x]=high;
 }
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  let high=0;
  for(let i=Math.max(0,y-reach);i<=Math.min(h-1,y+reach);i++)high=Math.max(high,xpass[i*w+x]);
  result[y*w+x]=high;
 }
 return result;
}
function reduce(level){
 const w=Math.ceil(level.w/2),h=Math.ceil(level.h/2),values=new Float32Array(w*h*4);
 for(let y=0;y<level.h;y++)for(let x=0;x<level.w;x++){
  const src=(y*level.w+x)*4,dst=(Math.floor(y/2)*w+Math.floor(x/2))*4;
  for(let i=0;i<4;i++)values[dst+i]+=level.values[src+i];
 }
 return {w,h,values};
}
function expand(level,parent){
 const {w,h,values}=level,result=new Float32Array(w*h*3);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=(y*w+x)*4,d=(y*w+x)*3,weight=values[i+3];
  if(weight>.001){
   for(let k=0;k<3;k++)result[d+k]=values[i+k]/weight;
  }else if(parent){
   const sx=Math.max(0,(x-.5)/2),sy=Math.max(0,(y-.5)/2);
   const x0=Math.min(parent.w-1,Math.floor(sx)),y0=Math.min(parent.h-1,Math.floor(sy));
   const x1=Math.min(parent.w-1,x0+1),y1=Math.min(parent.h-1,y0+1);
   const tx=sx-x0,ty=sy-y0;
   for(let k=0;k<3;k++){
    const a=parent.colors[(y0*parent.w+x0)*3+k],b=parent.colors[(y0*parent.w+x1)*3+k];
    const c=parent.colors[(y1*parent.w+x0)*3+k],d2=parent.colors[(y1*parent.w+x1)*3+k];
    result[d+k]=(a+(b-a)*tx)*(1-ty)+(c+(d2-c)*tx)*ty;
   }
  }
 }
 return {w,h,colors:result};
}
export function prepareScene(image,mask){
 const scale=Math.min(1,420/Math.max(image.naturalWidth,image.naturalHeight));
 const w=Math.max(1,Math.round(image.naturalWidth*scale)),h=Math.max(1,Math.round(image.naturalHeight*scale));
 const plate=canvas(w,h),hole=canvas(w,h);
 const pc=plate.getContext('2d',{willReadFrequently:true}),hc=hole.getContext('2d',{willReadFrequently:true});
 pc.drawImage(image,0,0,w,h);hc.drawImage(mask,0,0,w,h);
 const pixels=pc.getImageData(0,0,w,h),erased=hc.getImageData(0,0,w,h);
 const seeds=new Float32Array(w*h);
 for(let j=0;j<seeds.length;j++)seeds[j]=erased.data[j*4+3]/255;
 const coverage=spread(seeds,w,h,Math.max(2,Math.round(Math.max(w,h)*.008)));
 const values=new Float32Array(w*h*4);
 let known=0;
 for(let j=0;j<coverage.length;j++){
  const i=j*4,weight=coverage[j]<.09?1:0;
  for(let k=0;k<3;k++)values[i+k]=pixels.data[i+k]*weight;
  values[i+3]=weight;known+=weight;
  erased.data[i]=erased.data[i+1]=erased.data[i+2]=0;
  erased.data[i+3]=Math.round(255*Math.min(1,Math.max(0,(coverage[j]-.04)/.14)));
 }
 if(known<coverage.length*.025)return null;
 const levels=[{w,h,values}];
 while(levels.at(-1).w>1||levels.at(-1).h>1)levels.push(reduce(levels.at(-1)));
 let recovered;
 for(let i=levels.length-1;i>=0;i--)recovered=expand(levels[i],recovered);
 for(let j=0;j<coverage.length;j++){
  for(let k=0;k<3;k++)pixels.data[j*4+k]=Math.round(recovered.colors[j*3+k]);
  pixels.data[j*4+3]=255;
 }
 pc.putImageData(pixels,0,0);hc.putImageData(erased,0,0);
 return {plate,hole};
}
export function fitScene(image,source,w,h,{position,zoom,offsetX,offsetY}){
 const result=canvas(w,h),ctx=result.getContext('2d');
 const [x,y,dw,dh]=fit(ctx,image,w,h,position,zoom,offsetX,offsetY);
 ctx.globalCompositeOperation='destination-out';ctx.drawImage(source.hole,x,y,dw,dh);
 ctx.globalCompositeOperation='destination-over';ctx.drawImage(source.plate,x,y,dw,dh);
 ctx.globalCompositeOperation='source-over';return result;
}


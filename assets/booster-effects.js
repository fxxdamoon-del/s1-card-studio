export function makePackEffects(canvas,traceCanvas,spillCanvas){
  const ctx=canvas.getContext('2d');
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  const colors={C:[153,179,221],R:[150,213,255],SR:[255,192,86],SSR:[181,107,255],
    UR:[255,179,60],AUTO:[255,175,211],SEC:[143,108,255],RLC:[245,150,95],ONE:[146,255,232]};
  const strengths={C:.57,R:.65,SR:.76,SSR:.9,UR:1.02,AUTO:1.04,SEC:1.08,RLC:1.14,ONE:1.3};
  let current=null, frame=0;
  const rgba=(rgb,alpha)=>'rgba('+rgb.join(',')+','+Math.max(0,Math.min(1,alpha))+')';
  function spark(x,y,shape,direction){
    const angle=direction??Math.random()*Math.PI*2;
    const speed=.26+Math.random()*1.12;
    return {x,y,shape,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,spin:Math.random()*.035,
      angle,life:460+Math.random()*680,size:.8+Math.random()*4,offset:Math.random()*175};
  }
  function bolt(x,y,height,lean){
    const points=[[x,y]];
    for(let i=1;i<=9;i++)points.push([x+lean*i/9+(Math.random()-.5)*height*.22,y-height*i/9]);
    return points;
  }
  function line(points){
    ctx.beginPath();
    points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));
    ctx.stroke();
  }
  function clear(){
    if(frame)cancelAnimationFrame(frame);
    frame=0;current=null;
    ctx?.clearRect(0,0,canvas.width,canvas.height);
  }
  function start(point,tier,mode){
    if(!ctx||motion.matches)return;
    clear();
    const {width,height}=canvas.getBoundingClientRect();
    if(width===0||height===0)return;
    const ratio=Math.min(devicePixelRatio||1,2);
    canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);
    ctx.setTransform(ratio,0,0,ratio,0,0);
    const rgb=colors[tier], size=Math.min(width,height)/520;
    const hero=strengths[tier]>=.9;
    const particles=Array.from({length:hero?(mode==='open'?70:115):23},(_,i)=>{
      const shape=['SSR','SEC'].includes(tier)&&i%5===0?'glass':['UR','ONE'].includes(tier)&&i%4===0?'star':'dust';
      const vector=mode==='open'?-Math.PI*.5+(Math.random()-.5)*1.44:undefined;
      const source=mode==='open'?(Math.random()-.5)*96*size:0;
      return spark(point.x+source,point.y,shape,vector);
    });
    const bolts=tier==='ONE'&&mode==='reveal'?[-.34,-.17,.07,.27].map((lean,i)=>bolt(point.x,point.y,130*size+i*35*size,lean*420*size)):[];
    current={point,rgb,particles,bolts,size,width,height,tier,mode,began:performance.now()};
    frame=requestAnimationFrame(draw);
  }
  function draw(now){
    const state=current;
    if(!state)return;
    const time=now-state.began;
    const {point:{x,y},rgb,particles,bolts,size,width,height,tier,mode}=state;
    ctx.clearRect(0,0,width,height);
    if(time>1500){clear();return;}
    ctx.globalCompositeOperation='lighter';
    const bloom=Math.max(0,1-time/890);
    if(bloom>0){
      const r=(mode==='open'?68:163)*size;
      const glow=ctx.createRadialGradient(x,y,1,x,y,r);
      glow.addColorStop(0,rgba([255,250,241],bloom*(mode==='open'?.18:.65)));
      glow.addColorStop(.15,rgba(rgb,bloom*.52));glow.addColorStop(1,rgba(rgb,0));
      ctx.fillStyle=glow;ctx.fillRect(x-r,y-r,r*2,r*2);
    }
    if(mode==='reveal'){
      const life=Math.max(0,1-time/760);
      for(let i=0;i<(strengths[tier]<.9?1:3);i++){
        const radius=(25+time*.36+i*15)*size;
        ctx.strokeStyle=rgba(rgb,life*(.48-i*.10));
        ctx.lineWidth=(2.1-i*.45)*size;
        ctx.beginPath();ctx.ellipse(x,y,radius,radius*(tier==='SSR'?.48:.68),i*.56-.4,0,Math.PI*2);ctx.stroke();
      }
      if(bolts.length&&time<555){
        ctx.lineWidth=5*size;ctx.strokeStyle=rgba(rgb,(1-time/555)*.29);bolts.forEach(line);
        ctx.lineWidth=1.4*size;ctx.strokeStyle=rgba([255,220,223],(1-time/555)*.83);bolts.forEach(line);
      }
    }
    for(const p of particles){
      const t=time-p.offset;if(t<0||t>p.life)continue;
      const life=(1-t/p.life)**2;
      const move=200*(1-Math.exp(-t/310))*size;
      const px=p.x+p.vx*move, py=p.y+p.vy*move+t*t*.000028*size;
      const r=(p.size*.61+.55)*size, angle=p.angle+t*p.spin;
      ctx.fillStyle=rgba(rgb,.69*life);ctx.beginPath();ctx.arc(px,py,r*2,0,Math.PI*2);ctx.fill();
      ctx.fillStyle=rgba([255,245,230],life*.86);
      if(p.shape==='dust'){ctx.fillRect(px-r*.44,py-r*.44,r*.88,r*.88);continue;}
      ctx.save();ctx.translate(px,py);ctx.rotate(angle);ctx.beginPath();
      if(p.shape==='glass'){ctx.moveTo(0,-r*3);ctx.lineTo(r*1.7,r*.66);ctx.lineTo(-r,r*1.34);}
      else for(let i=0;i<8;i++){
        const a=i*Math.PI/4,extent=i%2?r*.38:r*2.9;
        ctx.lineTo(Math.cos(a)*extent,Math.sin(a)*extent);
      }
      ctx.closePath();ctx.fill();ctx.restore();
    }
    ctx.globalCompositeOperation='source-over';
    frame=requestAnimationFrame(draw);
  }
  const traceCtx=traceCanvas.getContext('2d');
  let traceKey='',lastProgress=0,traceParticles=[];
  function trace(pose,at,now,pulling,visible){
    if(!traceCtx)return;
    const {w,h,dpr,tear}=pose;
    const key=[visible?1:0,pulling?1:0,w,h,dpr,tear,pose.rx,pose.ry,pose.rz,pose.tx,pose.ty,pose.flex,pose.tug,pose.air,pose.sway,pose.flutter].map(n=>n.toFixed(3)).join(',');
    if(key===traceKey&&!traceParticles.length)return;
    traceKey=key;
    const nextWidth=Math.round(w*dpr),nextHeight=Math.round(h*dpr);
    if(traceCanvas.width!==nextWidth||traceCanvas.height!==nextHeight){
      traceCanvas.width=nextWidth;traceCanvas.height=nextHeight;
      traceCtx.setTransform(dpr,0,0,dpr,0,0);
    }
    traceCtx.clearRect(0,0,w,h);
    if(!visible){traceParticles=[];lastProgress=0;return;}
    const start=lastProgress;
    lastProgress=tear;
    if(tear<.003&&!traceParticles.length)return;
    const end=at(pose,tear);
    const gain=Math.min(1,tear/.032);
    traceCtx.lineJoin='round';
    if(gain>0){
      const origin=at(pose,0);
      const light=traceCtx.createLinearGradient(origin.x,origin.y,end.x+.1,end.y);
      light.addColorStop(0,'#a5b5d72e');
      light.addColorStop(.36,'#aecced70');
      light.addColorStop(.68,'#a1bded50');
      light.addColorStop(.89,'#c8d6ee99');
      light.addColorStop(1,pulling?'#fff4d7df':'#c4d1e186');
      traceCtx.beginPath();
      const steps=Math.max(2,Math.ceil(tear*96));
      for(let i=0;i<=steps;i++){
        const point=at(pose,tear*i/steps);
        if(i)traceCtx.lineTo(point.x,point.y);
        else traceCtx.moveTo(point.x,point.y);
      }
      traceCtx.strokeStyle='#8eaff140';traceCtx.lineWidth=pulling?2.35:1.75;traceCtx.globalAlpha=gain;
      traceCtx.stroke();
      traceCtx.strokeStyle=light;traceCtx.lineWidth=.76;
      traceCtx.stroke();traceCtx.globalAlpha=1;
    }
    if(pulling&&tear>0&&!motion.matches){
      const radius=12+Math.max(0,pose.tug)*9;
      const glow=traceCtx.createRadialGradient(end.x,end.y,0,end.x,end.y,radius);
      glow.addColorStop(0,'#fffffcd9');glow.addColorStop(.15,'#eee0bd8e');
      glow.addColorStop(.34,'#a4cbff49');glow.addColorStop(1,'#65a5ff00');
      traceCtx.fillStyle=glow;traceCtx.fillRect(end.x-radius,end.y-radius,radius*2,radius*2);
      const delta=tear-start;
      if(delta>.002){
        const count=Math.min(9,Math.ceil(delta*69));
        for(let i=0;i<count;i++){
          const origin=at(pose,start+delta*(i+.5)/count);
          const angle=-Math.PI*(.16+Math.random()*.72);
          const speed=24+Math.random()*100;
          traceParticles.push({...origin,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,
            born:now,life:135+Math.random()*270,size:.36+Math.random()*.98});
        }
      }
    }
    traceParticles=traceParticles.filter(p=>now-p.born<p.life);
    for(const p of traceParticles){
      const t=(now-p.born)/1000,alpha=(1-(now-p.born)/p.life)**1.65;
      const x=p.x+p.vx*t,y=p.y+p.vy*t+118*t*t;
      traceCtx.strokeStyle=rgba([255,230,171],alpha*.72);
      traceCtx.lineWidth=p.size;
      traceCtx.beginPath();traceCtx.moveTo(x,y);traceCtx.lineTo(x-p.vx*.026,y-p.vy*.026);traceCtx.stroke();
      traceCtx.fillStyle=rgba([241,250,255],alpha);
      traceCtx.fillRect(x-p.size*.5,y-p.size*.5,p.size,p.size);
    }
  }
  const spillCtx=spillCanvas.getContext('2d');
  const lightFalloff=[
    [1.46,.035],[1.35,.052],[1.24,.075],[1.13,.092],[1.02,.123],[.91,.150],
    [.80,.169],[.69,.176],[.58,.176],[.47,.151],[.36,.120],[.25,.076],
  ];
  const lightCrests=[
    [-.96,.47],[-.81,.72],[-.66,.56],[-.43,.92],[-.27,.71],
    [-.07,1.04],[.09,.85],[.26,.93],[.40,.64],[.66,.78],[.91,.49],
  ];
  function crestVariation(seed,index){
    const value=Math.sin((seed+7)*129.13+index*81.71)*43758.5453;
    return value-Math.floor(value);
  }
  let spillKey='';
  const ramp=(a,b,value)=>{
    const t=Math.max(0,Math.min(1,(value-a)/(b-a)));
    return t*t*(3-2*t);
  };
  function spill(pose,lip,tier,age,flipAge,variant,now){
    if(!spillCtx)return;
    const {w,h,dpr}=pose;
    const fraction=pose.tear;
    const partial=fraction<1;
    const fading=flipAge>0?Math.max(0,1-flipAge/520)**2:1;
    const time=partial?fraction*480:motion.matches?2500:Math.min(age,2500);
    const intensity=(!tier?0:partial
      ?ramp(.004,.061,fraction)*(.82+.23*fraction)
      :fading*(.79+.41*Math.exp(-((time-140)**2)/490000))*(.86+.14*ramp(0,150,time)))*(strengths[tier]||0);
    const clock=motion.matches?0:Math.floor(now/32)*.032;
    const key=intensity<.003?'clear':[w,h,dpr,tier,variant,clock,time,fraction,pose.opening,pose.rx,pose.ry,pose.rz,pose.tx,pose.ty,pose.flex,pose.air,pose.sway,pose.flutter,pose.tug,intensity].join(',');
    if(key===spillKey)return;
    spillKey=key;
    const width=Math.round(w*dpr),height=Math.round(h*dpr);
    if(spillCanvas.width!==width||spillCanvas.height!==height){
      spillCanvas.width=width;spillCanvas.height=height;
      spillCtx.setTransform(dpr,0,0,dpr,0,0);
    }
    spillCtx.clearRect(0,0,w,h);
    if(intensity<.003)return;
    const rgb=colors[tier];
    const size=Math.min(1.42,Math.min(w,h)/505);
    const wet=partial?.49+.55*ramp(.015,1,fraction):1.04+.16*ramp(0,420,time);
    const origin=fraction*(.62-.12*ramp(.12,1,fraction));
    const source=lip(pose,origin);
    const phase=clock*2.15+variant*.41;
    const settling=motion.matches?0:Math.sin(phase)*.024+Math.sin(phase*.53+1.1)*.013;
    const turn=(pose.ry+.27)*.28+(pose.rx+.11)*.092-pose.rz*.68;
    const refraction=turn+pose.sway*.20+pose.flutter*.09;
    const angle=-.10-.26*ramp(.42,1,fraction)+refraction+settling;
    const stretch=1+Math.sin(angle+pose.rx+.11)*.073+
      (motion.matches?0:Math.sin(phase*.74)*.043+pose.flutter*.055);
    const reach=Math.min(376*size*wet*stretch,Math.max(20,(source.y-16)/(Math.cos(angle)+.09)));
    const side=Math.sin(angle),up=Math.cos(angle);
    const steps=Math.max(2,Math.ceil(fraction*64));
    const seam=Array.from({length:steps+1},(_,i)=>lip(pose,fraction*i/steps));
    const edgeA=seam[0],edgeB=seam[steps];
    const lipWidth=Math.hypot(edgeB.x-edgeA.x,edgeB.y-edgeA.y);
    const reachWidth=Math.max(14*size,lipWidth*.47+8*size);

    spillCtx.globalCompositeOperation='lighter';
    const radius=(35+32*fraction)*size;
    const halo=spillCtx.createRadialGradient(source.x,source.y,0,source.x,source.y,radius);
    halo.addColorStop(0,rgba(rgb,intensity*.43));
    halo.addColorStop(.28,rgba(rgb,intensity*.27));
    halo.addColorStop(.68,rgba(rgb,intensity*.08));
    halo.addColorStop(1,rgba(rgb,0));
    spillCtx.fillStyle=halo;
    spillCtx.fillRect(source.x-radius,source.y-radius,radius*2,radius*2);

    const colour=spillCtx.createLinearGradient(source.x,source.y,source.x+side*reach,source.y-up*reach);
    colour.addColorStop(0,rgba([255,247,228],intensity*.84));
    colour.addColorStop(.12,rgba(rgb,intensity*.82));
    colour.addColorStop(.39,rgba(rgb,intensity*.51));
    colour.addColorStop(.64,rgba(rgb,intensity*.30));
    colour.addColorStop(.86,rgba(rgb,intensity*.10));
    colour.addColorStop(1,rgba(rgb,0));
    spillCtx.fillStyle=colour;

    const crests=lightCrests.map(([offset,height],i)=>{
      const variation=crestVariation(variant,i);
      const drift=motion.matches?0:Math.sin(phase+i*.91)*.034+pose.flutter*.077*Math.sin(i*1.9);
      return [offset*.94+(variation-.5)*.066,height+(variation-.5)*.17+drift];
    });
    // All contours retain a continuous base along the torn edge.
    for(const [scale,opacity] of lightFalloff){
      const width=reachWidth*(.69+scale*.36);
      const heightScale=.66+scale*.32;
      const point=(height,offset)=>[
        source.x+side*reach*height*heightScale+up*width*offset,
        source.y-up*reach*height*heightScale+side*width*offset,
      ];
      spillCtx.globalAlpha=opacity;
      spillCtx.beginPath();
      spillCtx.moveTo(edgeA.x,edgeA.y);
      const skyline=crests.map(([offset,height])=>point(height,offset));
      spillCtx.quadraticCurveTo(...point(.25,-.98),...skyline[0]);
      for(let i=0;i<skyline.length-1;i++){
        const [x,y]=skyline[i], [nx,ny]=skyline[i+1];
        spillCtx.quadraticCurveTo(x,y,(x+nx)*.5,(y+ny)*.5);
      }
      spillCtx.quadraticCurveTo(...skyline[skyline.length-1],edgeB.x,edgeB.y);
      for(let i=steps-1;i>0;i--)spillCtx.lineTo(seam[i].x,seam[i].y);
      spillCtx.closePath();
      spillCtx.fill();
    }
    spillCtx.globalAlpha=1;

    const rimLight=spillCtx.createLinearGradient(edgeA.x,edgeA.y,edgeB.x,edgeB.y);
    const peak=Math.max(.13,Math.min(.88,origin/fraction+refraction*.57+Math.sin(phase*.61)*.081));
    rimLight.addColorStop(0,rgba(rgb,intensity*.68));
    rimLight.addColorStop(Math.max(0,peak-.24),rgba(rgb,intensity*.73));
    rimLight.addColorStop(peak,rgba([255,249,235],intensity*.91));
    rimLight.addColorStop(Math.min(1,peak+.18),rgba(rgb,intensity*.77));
    rimLight.addColorStop(1,rgba(rgb,intensity*.68));
    spillCtx.lineJoin='round';
    spillCtx.beginPath();
    spillCtx.moveTo(edgeA.x,edgeA.y);
    for(let i=1;i<seam.length;i++)spillCtx.lineTo(seam[i].x,seam[i].y);
    spillCtx.strokeStyle=rimLight;
    spillCtx.lineWidth=Math.max(1.1,1.75*size);
    spillCtx.shadowColor=rgba(rgb,intensity*.90);
    spillCtx.shadowBlur=13*size*dpr;
    spillCtx.stroke();
    spillCtx.shadowBlur=0;
    if(fraction>.025){
      const glossWidth=Math.min(18*size,lipWidth*.14);
      for(let i=0;i<3;i++){
        const location=Math.max(.05,Math.min(.95,peak+(i-1)*.245+Math.sin(phase*.72+i*2.7)*.075));
        const glint=lip(pose,fraction*location);
        const slant=side*(25+i*6)*size;
        const length=(.49+.14*i)*reach;
        const tint=i===1?[255,248,226]:i===0?rgb.map((color,j)=>Math.round(color*.70+[132,191,255][j]*.30))
          :rgb.map((color,j)=>Math.round(color*.78+[255,182,147][j]*.22));
        const edgeStrength=(.67+.33*Math.sin(phase*.81+i*2.1)**2)*intensity;
        const shine=spillCtx.createLinearGradient(glint.x,glint.y,glint.x+side*length,glint.y-up*length);
        shine.addColorStop(0,rgba(tint,edgeStrength*.36));
        shine.addColorStop(.19,rgba(tint,edgeStrength*.23));
        shine.addColorStop(.64,rgba(tint,edgeStrength*.035));
        shine.addColorStop(1,rgba(tint,0));
        spillCtx.fillStyle=shine;
        spillCtx.beginPath();
        spillCtx.moveTo(glint.x-glossWidth*.50,glint.y);
        spillCtx.quadraticCurveTo(glint.x+slant-glossWidth*.82,glint.y-length*.40,
          glint.x+side*length,glint.y-up*length);
        spillCtx.quadraticCurveTo(glint.x+slant+glossWidth*.88,glint.y-length*.40,
          glint.x+glossWidth*.50,glint.y);
        spillCtx.fill();

        const bounce=spillCtx.createRadialGradient(glint.x,glint.y+2*size,0,
          glint.x,glint.y+2*size,glossWidth*1.36);
        bounce.addColorStop(0,rgba(tint,edgeStrength*.41));
        bounce.addColorStop(.30,rgba(rgb,edgeStrength*.21));
        bounce.addColorStop(1,rgba(rgb,0));
        spillCtx.fillStyle=bounce;
        spillCtx.beginPath();
        spillCtx.ellipse(glint.x,glint.y+2*size,glossWidth*1.36,glossWidth*.63,-pose.rz,0,Math.PI*2);
        spillCtx.fill();
      }
    }
    spillCtx.globalCompositeOperation='source-over';
  }
  return {start,clear,trace,spill};
}

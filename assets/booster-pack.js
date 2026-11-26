(() => {
  const width = .72;
  const seam = .80;
  const vertex = `
attribute vec2 uv;
uniform vec2 scale, shift;
uniform vec3 angles, membrane, contact;
uniform float tear, side, part, flex, tug, opening;
varying vec2 tex;
varying vec3 normal, position;
varying float exposed, lining;
mat3 rotX(float r){float c=cos(r),s=sin(r);return mat3(1,0,0,0,c,s,0,-s,c);}
mat3 rotY(float r){float c=cos(r),s=sin(r);return mat3(c,0,-s,0,1,0,s,0,c);}
mat3 rotZ(float r){float c=cos(r),s=sin(r);return mat3(c,s,0,-s,c,0,0,0,1);}
float grit(float q){
  return (1.-abs(fract(q*18.5+.21)*2.-1.))*.036
     +(1.-abs(fract(q*33.+.12)*2.-1.))*.010+sin(q*35.)*.011;
}
vec3 airShape(float q,float y,float side){
  float centre=max(0.,sin(q*3.141593));
  float panel=smoothstep(-.97,-.60,y)*(1.-smoothstep(.59,.96,y));
  float chamber=pow(centre,.74)*panel;
  float edge=pow(min(1.,abs(y)),3.)*(.33+.67*pow(abs(2.*q-1.),1.6));
  float wave=sin(q*7.4+y*4.1);
  float fullness=membrane.x*(.066+.021*membrane.y*(q*2.-1.));
  return vec3(
    membrane.y*.041*edge*y+membrane.z*.010*edge*wave,
    membrane.y*.044*edge*(q*2.-1.)+membrane.z*.032*edge*wave,
    side*chamber*fullness+edge*(membrane.y*.076*y+membrane.z*.064*wave));
}
float fingerDepth(float x,float y){
  vec2 offset=(vec2(x,y)-contact.xy)/vec2(.194,.222);
  float radius=dot(offset,offset);
  if(radius>4.5||abs(contact.z)<.001)return 0.;
  float edge=(1.-smoothstep(.61,.73,abs(x)))*smoothstep(-1.,-.86,y)*(1.-smoothstep(.74,.88,y));
  float bowl=exp(-radius*1.54);
  float ridge=(radius-1.1)*1.85, wrinkle=(radius-1.62)*1.85;
  float lip=exp(-ridge*ridge);
  float folds=sin(offset.x*8.5+offset.y*5.4)*exp(-wrinkle*wrinkle);
  float stiffness=.55+membrane.x*.45;
  return contact.z*edge*stiffness*(-.168*bowl+.030*lip+.009*folds);
}
float topX(float u){return mix(tear,1.,u);}
vec3 sculpt(vec2 p){
  float u=part<.5?p.x:topX(p.x);
  float x=(u*2.-1.)*.72;
  float q=clamp(u,0.,1.);
  float v=clamp(p.y,0.,1.);
  float y=part<.5?mix(-1.,.80,p.y):mix(.80,1.,p.y);
  float y0=y;
  float cut=(1.-smoothstep(tear-.029,tear+.006,q))*smoothstep(0.,.020,tear);
  float lip=part<.5?pow(v,8.):pow(1.-v,5.);
  if(part<.5)y-=(.010+grit(q))*cut*lip;
  float sides=sin(q*3.141593);
  float ends=smoothstep(-1.,-.80,y0)*(1.-smoothstep(.76,1.,y0));
  float bulge=.145*pow(max(sides,0.),.48)*ends;
  float crease=(sin(q*30.+y0*6.)*.014+sin(q*58.-y0*4.4)*.008)*sides*ends;
  float wrinkles=sin(y0*30.+q*14.)*exp(-min(abs(x-.64),abs(x+.64))*22.)*.019;
  float z=side*(bulge+crease+wrinkles)+flex*sin(x*2.2+y0*2.8)*.14;
  float pinch=exp(-abs(q-tear)*19.)*smoothstep(0.,.024,tear)*tug;
  z+=pinch*(.062+side*.025)*lip;
  y+=pinch*.031*lip;
  if(part<.5){
    z+=side*cut*lip*sides*(.029+opening*.082);
  }else{
    float tension=exp(-max(0.,q-tear)*23.)*smoothstep(0.,.045,tear);
    z+=tension*(.028+.070*(1.-v));
    y+=tension*(.012+.034*(1.-v));
  }
  vec3 outPos=vec3(x,y,z)+airShape(q,y0,side);
  if(part<.5){
    if(side>0.)outPos.z+=fingerDepth(x,y0);
    outPos+=vec3(-opening*.13,-opening*1.42,-opening*.25);
  }
  return outPos;
}
void main(){
  vec2 sampleUV=vec2(uv.x,part<.5?1.-pow(1.-uv.y,1.7):uv.y);
  float q=part<.5?sampleUV.x:topX(sampleUV.x);
  float y=part<.5?mix(-1.,.80,sampleUV.y):mix(.80,1.,sampleUV.y);
  tex=vec2(side>0.?q:1.-q,(1.-y)*.5);
  float openEdge=(1.-smoothstep(tear-.029,tear+.006,q))*smoothstep(0.,.020,tear);
  exposed=part<.5?openEdge*pow(sampleUV.y,79.):exp(-abs(q-tear)*65.)*smoothstep(0.,.025,tear)*(1.-sampleUV.y);
  lining=part<.5?exposed*(side>0.?0.94:0.82):exposed*.66;
  vec3 p=sculpt(sampleUV);
  mat3 r=rotZ(angles.z)*rotY(angles.y)*rotX(angles.x);
  normal=normalize(r*(cross(sculpt(sampleUV+vec2(.002,0))-p,sculpt(sampleUV+vec2(0,.002))-p)*side));
  position=r*p+vec3(shift,0.);
  gl_Position=vec4(position.xy*scale,-position.z*.4,1.-position.z*.23);
}`;
  const fragment = `
precision mediump float;
uniform sampler2D print;
uniform float side;
varying vec2 tex;
varying vec3 normal,position;
varying float exposed, lining;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){
  vec3 n=normalize(normal);
  vec3 v=normalize(vec3(-position.x*.23,-position.y*.23,1.));
  vec3 l=normalize(vec3(-.56,.74,.79));
  vec3 h=normalize(v+l);
  vec3 rim=normalize(vec3(.82,-.14,.48));
  float seam=step(tex.y,.071)+step(.938,tex.y);
  float ribs=sin(tex.x*340.)*.5+.5;
  float edges=clamp(max(seam,1.-smoothstep(.002,.038,min(tex.x,1.-tex.x))),0.,1.);
  float speckle=hash(floor(tex*vec2(640.,970.)));
  float ndl=max(dot(n,l),0.);
  float fresnel=pow(1.-max(dot(n,v),0.),3.);
  float gloss=pow(max(dot(n,h),0.),mix(46.,24.,edges));
  float kick=pow(max(dot(n,normalize(v+rim)),0.),70.);
  float strip=pow(max(dot(n,normalize(v+vec3(-.20,-.65,.7))),0.),27.)*.31;
  vec3 ink=texture2D(print,tex).rgb;
  float inner=clamp(lining,0.,1.);
  float foilWave=.5+.5*sin(tex.x*131.+tex.y*52.+n.x*9.);
  float foilGlint=pow(max(dot(n,normalize(v+vec3(-.45,.91,.48))),0.),32.);
  float thinFilm=pow(max(dot(n,normalize(v+vec3(.72,.31,.78))),0.),40.);

  vec3 silver=vec3(.47,.51,.56)+vec3(.11)*foilWave+vec3(.11)*(speckle-.5);
  ink=mix(ink,silver,inner);
  gloss=mix(gloss,foilGlint*1.08,inner);
  vec3 c=ink*(.50+ndl*.67+speckle*.09)*mix(1.,.79+ribs*.23,edges);
  c+=vec3(.95,.98,.89)*(gloss*.71+strip+fresnel*.25);
  c+=vec3(.70,.89,.77)*kick*.53;
  c+=inner*(vec3(.10,.14,.21)+thinFilm*vec3(.33,.42,.56));
  gl_FragColor=vec4(c,1.);
}`;

  function drawTexture(reverse,cover) {
    const canvas = document.createElement('canvas');
    canvas.width = 768;
    canvas.height = 1068;
    const ctx = canvas.getContext('2d');
    if(!reverse&&cover){
      const scale=Math.max(768/cover.naturalWidth,1068/cover.naturalHeight);
      const w=cover.naturalWidth*scale,h=cover.naturalHeight*scale;
      ctx.fillStyle='#202b35';ctx.fillRect(0,0,768,1068);
      ctx.drawImage(cover,(768-w)/2,(1068-h)/2,w,h);
      return canvas;
    }
    const gradient = ctx.createLinearGradient(0, 0, 768, 1068);
    gradient.addColorStop(0, '#29332d');
    gradient.addColorStop(.60, '#384236');
    gradient.addColorStop(1, '#121b17');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 768, 1068);
    for (let i = 0; i < 4800; i++) {
      const x = (i * 2791 % 766), y = (i * 4357 % 1067);
      ctx.fillStyle = i % 2 ? '#ffffff1b' : '#00000018';
      ctx.fillRect(x, y, 2 + i % 3, 1);
    }
    ctx.fillStyle = '#455346';
    ctx.fillRect(9, 8, 750, 68);
    ctx.fillRect(9, 1000, 750, 60);
    ctx.fillStyle = '#b9cc9d';
    ctx.fillRect(14, 105, 740, 2);
    ctx.fillStyle = '#1e251f';
    ctx.fillRect(14, 109, 740, 5);
    for (let i = 24; i < 752; i += 16) {
      ctx.fillStyle = i % 3 ? '#81956c' : '#a4b78c';
      ctx.fillRect(i, 111, 10, 2);
    }
    ctx.strokeStyle = '#a3b394';
    ctx.lineWidth = 3;
    ctx.strokeRect(44, 190, 680, 749);
    ctx.save();
    ctx.beginPath();ctx.rect(47, 192, 674, 744);ctx.clip();
    ctx.lineWidth = 1.25;
    ctx.strokeStyle = '#c5e5b440';
    for (let i = 0; i < 16; i++) {
      ctx.beginPath();
      ctx.ellipse(508, 652, 145+i*14, 104+i*12, -.43, 0, Math.PI*2);
      ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = '#d5ef94';
    ctx.font = 'bold 37px monospace';
    ctx.fillText('ODDLING FIELD CLUB', 67, 248);
    ctx.font = 'bold 103px Arial';
    ctx.fillText(reverse ? 'FIELD' : 'SPRING', 64, 397);
    ctx.fillText(reverse ? 'NOTES' : 'STATIC', 64, 493);
    ctx.fillStyle = '#b6db71';
    ctx.fillRect(66, 528, 637, 3);
    if (!reverse) {
      ctx.save();
      ctx.translate(420, 706);
      ctx.rotate(-.19);
      ctx.strokeStyle = '#c8f17a';
      ctx.lineWidth = 17;
      ctx.lineCap = 'square';
      ctx.beginPath();
      ctx.moveTo(34,-133);ctx.lineTo(-102,20);ctx.lineTo(-4,20);ctx.lineTo(-49,139);
      ctx.lineTo(96,-29);ctx.lineTo(6,-29);ctx.closePath();ctx.stroke();
      ctx.restore();
    } else {
      ctx.fillStyle = '#d5ef94';ctx.font = 'bold 24px monospace';
      ['FIELD MATERIAL','PET / ALU / PE','SPRING STATIC   VOL. 01'].forEach((line,i)=>ctx.fillText(line,70,614+i*42));
    }
    ctx.fillStyle = '#b8e267';
    ctx.fillRect(46, 840, 677, 97);
    ctx.fillStyle = '#1e2b20';
    ctx.font = 'bold 28px monospace';
    ctx.fillText('COLLECTIBLE FIELD CARDS', 68, 894);
    ctx.font = 'bold 52px Arial';
    ctx.fillText('05', 626, 909);
    ctx.fillStyle = '#9ead90';
    ctx.font = 'bold 21px monospace';
    ctx.fillText('SERIES 01   /   SPRING COLLECTION', 48, 976);
    return canvas;
  }

  function compile(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(shader));
    return shader;
  }

  function makeModel(canvas) {
    const gl = canvas.getContext('webgl', { alpha:true, antialias:true });
    if (!gl) return null;
    const program = gl.createProgram();
    gl.attachShader(program, compile(gl,gl.VERTEX_SHADER,vertex));
    gl.attachShader(program, compile(gl,gl.FRAGMENT_SHADER,fragment));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    const subdivision = 64;
    const vertices = [], indices = [];
    for(let y=0;y<=subdivision;y++) for(let x=0;x<=subdivision;x++) vertices.push(x/subdivision,y/subdivision);
    for(let y=0;y<subdivision;y++) for(let x=0;x<subdivision;x++){
      const i = y*(subdivision+1)+x;
      indices.push(i,i+1,i+subdivision+1,i+1,i+subdivision+2,i+subdivision+1);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);
    const uv = gl.getAttribLocation(program,'uv');
    gl.enableVertexAttribArray(uv);
    gl.vertexAttribPointer(uv,2,gl.FLOAT,false,0,0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,gl.createBuffer());
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(indices),gl.STATIC_DRAW);
    const textures = [false,true].map(reverse=>{
      const tex=gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D,tex);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,drawTexture(reverse));
      return tex;
    });
    const u = Object.fromEntries(['scale','shift','angles','membrane','contact','tear','side','part','flex','tug','opening'].map(name=>[name,gl.getUniformLocation(program,name)]));
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0,0,0,0);
    return {
      setCover(cover){
        gl.bindTexture(gl.TEXTURE_2D,textures[0]);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,drawTexture(false,cover));
      },
      render(s){
        if(canvas.width!==Math.round(s.w*s.dpr)||canvas.height!==Math.round(s.h*s.dpr)){
          canvas.width=Math.round(s.w*s.dpr);canvas.height=Math.round(s.h*s.dpr);
          gl.viewport(0,0,canvas.width,canvas.height);
        }
        gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
        gl.uniform2f(u.scale,2*s.unit/s.w,2*s.unit/s.h);
        gl.uniform2f(u.shift,s.tx,s.ty);
        gl.uniform3f(u.angles,s.rx,s.ry,s.rz);
        gl.uniform3f(u.membrane,s.air,s.sway,s.flutter);
        gl.uniform3f(u.contact,s.pressX,s.pressY,s.press);
        gl.uniform1f(u.tear,s.tear);
        gl.uniform1f(u.flex,s.flex);
        gl.uniform1f(u.tug,s.tug);
        gl.uniform1f(u.opening,s.opening);
        for (const side of [-1,1]){
          gl.bindTexture(gl.TEXTURE_2D,textures[side===1?0:1]);
          gl.uniform1f(u.side,side);
          for (const part of s.tear>=.997?[0]:[0,1]){
            gl.uniform1f(u.part,part);
            gl.drawElements(gl.TRIANGLES,indices.length,gl.UNSIGNED_SHORT,0);
          }
        }
      }
    };
  }

  function project(s,x,y,z=0) {
    const ax=Math.cos(s.rx),bx=Math.sin(s.rx),ay=Math.cos(s.ry),by=Math.sin(s.ry),az=Math.cos(s.rz),bz=Math.sin(s.rz);
    const y1=y*ax-z*bx,z1=y*bx+z*ax;
    const x2=x*ay+z1*by,z2=-x*by+z1*ay;
    const distance=1-z2*.23;
    return { x:s.w/2+(x2*az-y1*bz+s.tx)*s.unit/distance, y:s.h/2-(x2*bz+y1*az+s.ty)*s.unit/distance };
  }
  const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
  const smooth=(a,b,t)=>{const u=clamp((t-a)/(b-a));return u*u*(3-2*u);};
  function airShape(s,q,y,side){
    q=clamp(q);
    const centre=Math.max(0,Math.sin(q*Math.PI));
    const chamber=centre**.74*smooth(-.97,-.60,y)*(1-smooth(.59,.96,y));
    const edge=Math.min(1,Math.abs(y))**3*(.33+.67*Math.abs(2*q-1)**1.6);
    const wave=Math.sin(q*7.4+y*4.1);
    const fullness=s.air*(.066+.021*s.sway*(q*2-1));
    return [
      s.sway*.041*edge*y+s.flutter*.010*edge*wave,
      s.sway*.044*edge*(q*2-1)+s.flutter*.032*edge*wave,
      side*chamber*fullness+edge*(s.sway*.076*y+s.flutter*.064*wave),
    ];
  }

  function fingerDepth(s,x,y){
    if(Math.abs(s.press)<.001)return 0;
    const dx=(x-s.pressX)/.194,dy=(y-s.pressY)/.222;
    const radius=dx*dx+dy*dy;
    if(radius>4.5)return 0;
    const edge=(1-smooth(.61,.73,Math.abs(x)))*smooth(-1,-.86,y)*(1-smooth(.74,.88,y));
    const bowl=Math.exp(-radius*1.54);
    const ridge=(radius-1.1)*1.85,wrinkle=(radius-1.62)*1.85;
    const lip=Math.exp(-ridge*ridge);
    const folds=Math.sin(dx*8.5+dy*5.4)*Math.exp(-wrinkle*wrinkle);
    return s.press*edge*(.55+s.air*.45)*(-.168*bowl+.030*lip+.009*folds);
  }

  function software(canvas){
    const context=canvas.getContext('2d',{alpha:true});
    if(!context)return null;
    const textures=[false,true].map(reverse=>{
      const source=drawTexture(reverse);
      return source.getContext('2d').getImageData(0,0,source.width,source.height).data;
    });
    const normalize=(x,y,z)=>{const n=Math.hypot(x,y,z)||1;return [x/n,y/n,z/n];};
    const half=normalize(-.56,.74,1.79), kicker=normalize(.82,-.14,1.48), strip=normalize(-.2,-.65,1.7);
    const light=normalize(-.56,.74,.79);
    const nx=52,ny=18,stride=nx+1;
    let output,depth,previous='',lastDraw=0;
    function sculpt(u,v,part,side,s){
      u=part?s.tear+(1-s.tear)*u:u;
      const x=(u*2-1)*width;
      const y0=part?seam+v*(1-seam):-1+v*(seam+1);
      const cut=(1-smooth(s.tear-.029,s.tear+.006,u))*smooth(0,.020,s.tear);
      const lip=part?(1-clamp(v))**5:clamp(v)**8;
      const jag=part?0:(.010+grit(u))*cut*lip;
      const band=Math.sin(clamp(u)*Math.PI),ends=smooth(-1,-.8,y0)*(1-smooth(.76,1,y0));
      const body=.145*band**.48*ends;
      const crease=(Math.sin(u*30+y0*6)*.014+Math.sin(u*58-y0*4.4)*.008)*band*ends;
      const wrinkles=Math.sin(y0*30+u*14)*Math.exp(-Math.min(Math.abs(x-.64),Math.abs(x+.64))*22)*.019;
      let z=side*(body+crease+wrinkles)+s.flex*Math.sin(x*2.2+y0*2.8)*.14;
      const pinch=Math.exp(-Math.abs(u-s.tear)*19)*smooth(0,.024,s.tear)*s.tug;
      z+=pinch*(.062+side*.025)*lip;
      const y=y0-jag+pinch*.031*lip;
      const [ax,ay,az]=airShape(s,u,y0,side);
      if(!part){
        z+=side*cut*lip*band*(.029+s.opening*.082);
        return [x+ax-s.opening*.13,y+ay-s.opening*1.42,z+az+(side>0?fingerDepth(s,x,y0):0)-s.opening*.25];
      }
      const tension=Math.exp(-Math.max(0,u-s.tear)*23)*smooth(0,.045,s.tear);
      return [x+ax,y+ay+tension*(.012+.034*(1-v)),z+az+tension*(.028+.070*(1-v))];
    }
    function triangle(a,b,c,texture,w,h){
      const den=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);
      if(Math.abs(den)<.01)return;
      const minX=Math.max(0,Math.floor(Math.min(a.x,b.x,c.x))),maxX=Math.min(w-1,Math.ceil(Math.max(a.x,b.x,c.x)));
      const minY=Math.max(0,Math.floor(Math.min(a.y,b.y,c.y))),maxY=Math.min(h-1,Math.ceil(Math.max(a.y,b.y,c.y)));
      const stepA=(b.y-c.y)/den,stepB=(c.y-a.y)/den;
      for(let y=minY;y<=maxY;y++){
        let wa=((b.y-c.y)*(minX+.5-c.x)+(c.x-b.x)*(y+.5-c.y))/den;
        let wb=((c.y-a.y)*(minX+.5-c.x)+(a.x-c.x)*(y+.5-c.y))/den;
        for(let x=minX;x<=maxX;x++,wa+=stepA,wb+=stepB){
          const wc=1-wa-wb;
          if(wa<-.001||wb<-.001||wc<-.001)continue;
          const z=wa*a.z+wb*b.z+wc*c.z;
          const index=y*w+x;
          if(z<=depth[index])continue;
          depth[index]=z;
          const u=wa*a.u+wb*b.u+wc*c.u,v=wa*a.v+wb*b.v+wc*c.v;
          const px=Math.max(0,Math.min(767,(u*767)|0)),py=Math.max(0,Math.min(1067,(v*1067)|0));
          const src=(py*768+px)*4,dst=index*4;
          const edge=v<.068||v>.938||u<.032||u>.968;
          const grain=((px*37+py*23)%17-8)*.28;
          const shade=(wa*a.shade+wb*b.shade+wc*c.shade)*(edge?.80+(px%9)*.026:1);
          const shine=wa*a.shine+wb*b.shine+wc*c.shine+grain;
          const cut=wa*a.cut+wb*b.cut+wc*c.cut;
          const lining=wa*a.lining+wb*b.lining+wc*c.lining;
          const silver=129+Math.sin(u*131+v*52)*12+grain*1.9;
          output.data[dst]=(texture[src]*(1-lining)+silver*lining)*shade+shine*.96+cut*130;
          output.data[dst+1]=(texture[src+1]*(1-lining)+(silver+7)*lining)*shade+shine+cut*136;
          output.data[dst+2]=(texture[src+2]*(1-lining)+(silver+12)*lining)*shade+shine*.88+cut*127;
          output.data[dst+3]=255;
        }
      }
    }
    return {setCover(cover){
      const source=drawTexture(false,cover);
      textures[0]=source.getContext('2d').getImageData(0,0,source.width,source.height).data;
      previous='';lastDraw=-Infinity;
    },render(s){
      const signature=[s.w,s.h,s.rx,s.ry,s.rz,s.tx,s.ty,s.flex,s.tug,s.tear,s.opening,s.air,s.sway,s.flutter,s.pressX,s.pressY,s.press].map(value=>value.toFixed(3)).join(',');
      const now=performance.now();
      if(signature===previous || now-lastDraw<28 && s.tear===0)return;
      previous=signature;lastDraw=now;
      const density=Math.min(1,665/s.h,760/s.w),w=Math.max(2,Math.round(s.w*density)),h=Math.max(2,Math.round(s.h*density));
      if(!output||canvas.width!==w||canvas.height!==h){
        canvas.width=w;canvas.height=h;output=context.createImageData(w,h);depth=new Float32Array(w*h);
      }
      output.data.fill(0);depth.fill(-Infinity);
      const ax=Math.cos(s.rx),bx=Math.sin(s.rx),ay=Math.cos(s.ry),by=Math.sin(s.ry),az=Math.cos(s.rz),bz=Math.sin(s.rz);
      const rotate=(x,y,z)=>{
        const y1=y*ax-z*bx,z1=y*bx+z*ax;
        const x2=x*ay+z1*by;
        return [x2*az-y1*bz,x2*bz+y1*az,-x*by+z1*ay];
      };
      for(const side of [-1,1])for(const part of s.tear>=.997?[0]:[0,1]){
        const mesh=[];
        for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){
          const u=i/nx,v=part?j/ny:1-(1-j/ny)**1.7;
          const p=sculpt(u,v,part,side,s);
          const xStep=sculpt(u+.003,v,part,side,s).map((p2,k)=>p2-p[k]);
          const yStep=sculpt(u,v+.003,part,side,s).map((p2,k)=>p2-p[k]);
          const normal=normalize(...rotate(
            side*(xStep[1]*yStep[2]-xStep[2]*yStep[1]),
            side*(xStep[2]*yStep[0]-xStep[0]*yStep[2]),
            side*(xStep[0]*yStep[1]-xStep[1]*yStep[0])));
          const dot=vector=>Math.max(0,normal[0]*vector[0]+normal[1]*vector[1]+normal[2]*vector[2]);
          const [x,y,z]=rotate(...p),persp=1-z*.23, y0=part?seam+v*(1-seam):-1+v*(seam+1);
          const shine=(dot(half)**39*.72+dot(kicker)**50*.50+dot(strip)**24*.28+(1-Math.max(0,normal[2]))**3*.20)*255;
          const q=part?s.tear+(1-s.tear)*u:u;
          const exposed=part?Math.exp(-Math.abs(q-s.tear)*65)*smooth(0,.025,s.tear)*(1-v)
            :(1-smooth(s.tear-.029,s.tear+.006,q))*smooth(0,.020,s.tear)*v**61;
          const lining=exposed*(part?.66:side>0?.94:.82);
          mesh.push({
            x:(s.w/2+(x+s.tx)*s.unit/persp)*density,y:(s.h/2-(y+s.ty)*s.unit/persp)*density,z,
            u:side>0?q:1-q,v:(1-y0)*.5,shade:.53+dot(light)*.67,
            shine:shine+lining*(19+dot(half)**29*131),lining,cut:exposed*.24
          });
        }
        const texture=textures[side===1?0:1];
        for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
          const index=j*stride+i;
          triangle(mesh[index],mesh[index+1],mesh[index+stride],texture,w,h);
          triangle(mesh[index+1],mesh[index+stride+1],mesh[index+stride],texture,w,h);
        }
      }
      context.putImageData(output,0,0);
    }};
  }
  function grit(u){
    const triangle=x=>1-Math.abs((x-Math.floor(x))*2-1);
    return triangle(u*18.5+.21)*.036+triangle(u*33+.12)*.010+Math.sin(u*35)*.011;
  }
  function lipPoint(s,u){
    const band=Math.sin(u*Math.PI);
    const pinch=Math.exp(-Math.abs(u-s.tear)*19)*Math.min(1,s.tear/.024)*s.tug;
    const z=.145*band**.48*.926+(Math.sin(u*30+seam*6)*.014+Math.sin(u*58-seam*4.4)*.008)*band*.926
      +s.flex*Math.sin((u*2-1)*width*2.2+seam*2.8)*.14+(.029+s.opening*.082)*band+pinch*.087;
    const [x,y,depth]=airShape(s,u,seam,1);
    return project(s,(u*2-1)*width+x-s.opening*.13,seam-.010-grit(u)+pinch*.031+y-s.opening*1.42,z+depth-s.opening*.25);
  }
  function sealPoint(s,u){
    const [x,y,z]=airShape(s,u,seam,1);
    return project(s,(u*2-1)*width+x,seam+y,.075+z);
  }
  function frontPoint(s,x,y){
    const q=clamp((x/width+1)*.5);
    const band=Math.sin(q*Math.PI);
    const ends=smooth(-1,-.80,y)*(1-smooth(.76,1,y));
    const crease=(Math.sin(q*30+y*6)*.014+Math.sin(q*58-y*4.4)*.008)*band*ends;
    const [ax,ay,az]=airShape(s,q,y,1);
    const z=.145*band**.48*ends+crease+s.flex*Math.sin(x*2.2+y*2.8)*.14;
    return project(s,x+ax,y+ay,z+az);
  }
  function pickFront(s,px,py){
    let x=(px-s.w/2)/s.unit-s.tx,y=(s.h/2-py)/s.unit-s.ty;
    for(let i=0;i<6;i++){
      const p=frontPoint(s,x,y),r=frontPoint(s,x+.005,y),up=frontPoint(s,x,y+.005);
      const xx=(r.x-p.x)/.005,xy=(r.y-p.y)/.005;
      const yx=(up.x-p.x)/.005,yy=(up.y-p.y)/.005;
      const det=xx*yy-xy*yx;
      if(Math.abs(det)<1)return null;
      const dx=px-p.x,dy=py-p.y;
      x+=clamp((dx*yy-dy*yx)/det,-.28,.28);
      y+=clamp((dy*xx-dx*xy)/det,-.28,.28);
    }
    const p=frontPoint(s,x,y);
    if(Math.abs(x)>width+.016||y>seam+.015||y<-1.016||Math.hypot(p.x-px,p.y-py)>6)return null;
    return {x:clamp(x,-width+.015,width-.015),y:clamp(y,-.985,seam-.01)};
  }
  window.PackModel={makeModel,software,project,lipPoint,sealPoint,pickFront,width,seam};
})();

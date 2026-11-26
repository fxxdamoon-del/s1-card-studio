(() => {
  const Audio = window.AudioContext || window.webkitAudioContext;
  let context, noise, master, enabled = false, nextRustle = 0, nextFlap = 0, lastTooth = -1;
  function enable() {
    if (!Audio) return false;
    if (!context) {
      context = new Audio();
      master = context.createGain();
      master.gain.value = 0;
      const warmth = context.createBiquadFilter();
      warmth.type = 'lowpass';
      warmth.frequency.value = 3900;
      warmth.Q.value = .55;
      master.connect(warmth).connect(context.destination);
      noise = context.createBuffer(1, context.sampleRate, context.sampleRate);
      const data = noise.getChannelData(0);
      let soft = 0;
      for (let i = 0; i < data.length; i++) {
        const white = Math.random() * 2 - 1;
        soft = soft * .69 + white * .31;
        data[i] = white * .30 + soft * .70;
      }
    }
    enabled = true;
    context.resume().catch(()=>{});
    master.gain.setTargetAtTime(.68,context.currentTime,.012);
    return true;
  }
  function mute() {
    enabled = false;
    if (master) master.gain.setTargetAtTime(0,context.currentTime,.018);
  }
  function crack(volume, duration, frequency, drop, offset=0) {
    if (!enabled) return;
    const t=context.currentTime+offset, source=context.createBufferSource();
    const filter=context.createBiquadFilter(), gain=context.createGain();
    source.buffer=noise;
    filter.type='bandpass';
    filter.Q.value=.70;
    filter.frequency.setValueAtTime(frequency,t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(90,frequency*drop),t+duration);
    gain.gain.setValueAtTime(.001,t);
    gain.gain.linearRampToValueAtTime(volume,t+Math.min(.008,duration*.14));
    gain.gain.exponentialRampToValueAtTime(.001,t+duration);
    source.connect(filter).connect(gain).connect(master);
    source.start(t,Math.random()*.65,duration);
    source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};
  }
  function rustle(strength) {
    if(!enabled || strength<.105 || context.currentTime<nextRustle) return;
    nextRustle=context.currentTime+(.13-Math.min(1,strength)*.035+Math.random()*.024);
    const spread=Math.random();
    crack(.12+strength*.24,.072+spread*.060,1300+spread*850,.60);
    if(strength>.22) crack(.17+strength*.20,.064,590+spread*230,.55,.007);
    if(strength>.54) crack(.21*strength,.048,510+spread*240,.54,.031);
  }
  function flap(strength,air) {
    if(!enabled||strength<.18||context.currentTime<nextFlap)return;
    nextFlap=context.currentTime+.083;
    const pitch=1320+air*850+Math.random()*670;
    crack(strength*.082,.043+air*.045,pitch,.66);
    if(strength>.55)crack(strength*.06,.062,410+air*150,.67,.014);
  }
  let lastSlide = 0, nextBrush = 0;
  function zip(progress, pace) {
    const travel = progress - lastSlide;
    lastSlide = progress;
    if (!enabled || !travel) return;
    const opening = travel > 0;
    const now = context.currentTime;
    if (now >= nextBrush) {
      nextBrush = now + .030;
      const friction = (opening ? 1180 : 820) + pace * 470;
      crack(.15 + pace * .12, .059, friction, .68);
    }
    const tooth = Math.floor(progress * 57);
    const count = Math.min(4, Math.abs(tooth - lastTooth));
    for (let i = 0; i < count; i++) {
      const offset = i * (.010 - pace * .005);
      const pitch = (opening ? 1790 : 1240) + Math.random() * 360;
      crack(.22 + pace * .10, .022, pitch, .48, offset);
    }
    lastTooth = tooth;
  }
  function snap() {
    crack(.30,.091,1980,.34);
    crack(.35,.12,590,.27,.005);
    crack(.10,.088,1570,.62,.084);
  }
  function foil() {
    if(!enabled)return;
    [392,588].forEach((freq,i)=>{
      const o=context.createOscillator(),g=context.createGain();
      const t=context.currentTime+i*.035;
      o.type='sine';o.frequency.value=freq;
      g.gain.setValueAtTime(.001,t);
      g.gain.exponentialRampToValueAtTime(.026/(1+i),t+.032);
      g.gain.exponentialRampToValueAtTime(.001,t+.48);
      o.connect(g).connect(master);o.start(t);o.stop(t+.50);
      o.onended=()=>{o.disconnect();g.disconnect();};
    });
  }
  window.PackSound={enable,mute,rustle,flap,zip,snap,foil,flip:()=>crack(.29,.12,1200,.4),resetZip:(progress=0)=>{lastSlide=progress;nextBrush=0;lastTooth=Math.floor(progress*57);}};
})();

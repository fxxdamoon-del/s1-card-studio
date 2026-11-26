const scope=self.registration.scope;
const cacheKey='card-studio-v4:'+scope;
const tiers=['01-C','02-R','03-SR','04-SSR','05-UR','06-AUTO','07-SEC','08-RLC','09-ONE'];
const vision='node_modules/@mediapipe/tasks-vision/';
const files=['./','index.html','studio.webmanifest','studio.js','studio.css','viewer.js','viewer.css',
 'card-editing.js','scene-layer.js','vendor/selfie_segmenter.tflite',vision+'vision_bundle.mjs',
 ...['vision_wasm_internal','vision_wasm_nosimd_internal'].flatMap(name=>['js','wasm'].map(ext=>vision+'wasm/'+name+'.'+ext)),
 ...['templates.json','back-blank.webp','commune-emblem.png','info-panel.webp','info-panel-auto.webp',
  'info-panel-sec.webp','relic-default.webp','relic-signature.webp','booster-pack.js','booster-effects.js',
  'booster-sound.js','pack-trial.js','pack-odds.js','qrcode.mjs',
  ...tiers.flatMap(tier=>['frame','preview','thumb'].map(role=>tier+'-'+role+'.webp'))].map(name=>'assets/'+name)];
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(cacheKey).then(cache=>cache.addAll(files)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
  for(const key of await caches.keys())if(key.startsWith('card-studio-')&&key.endsWith(':'+scope)&&key!==cacheKey)await caches.delete(key);
  await self.clients.claim();
 })());
});
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET'||!request.url.startsWith(scope))return;
 event.respondWith((async()=>{
  const cache=await caches.open(cacheKey);
  try{
   const response=await fetch(request);
   if(response.ok)await cache.put(request,response.clone());
   return response;
  }catch{
   return await cache.match(request)??(request.mode==='navigate'?await cache.match('index.html'):null)??Response.error();
  }
 })());
});

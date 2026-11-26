export const cardTypes={C:'正编',R:'正编',SR:'侧记',SSR:'异版',UR:'异版',AUTO:'手迹',SEC:'隐藏',RLC:'信物',ONE:'孤本'};

export const packBatches={
 test:{C:310,R:100,SR:45,SSR:20,UR:10,AUTO:6,SEC:5,RLC:3,ONE:1},
 formal:{C:6354,R:1646,SR:1300,SSR:398,UR:198,AUTO:50,SEC:33,RLC:20,ONE:1}
};

const packSize=5;
const total=counts=>Object.values(counts).reduce((sum,count)=>sum+count,0);
const baseTiers=['C','R'];
const highlightTiers=Object.keys(cardTypes).slice(baseTiers.length);
const formalSlots=[baseTiers,baseTiers,baseTiers,baseTiers,highlightTiers];
const testSlots=Array.from({length:packSize},()=>Object.keys(cardTypes));

export function packRates(mode,tier){
 const counts=packBatches[mode],count=counts[tier];
 const group=baseTiers.includes(tier)?baseTiers:highlightTiers;
 return {
  card:count/total(counts),
  slot:mode==='formal'?count/group.reduce((sum,key)=>sum+counts[key],0):null,
  group:group===baseTiers?'基础位':'高光位'
 };
}

export function makePackInventory(random=Math.random){
 const remaining={};
 for(const [name,counts] of Object.entries(packBatches))remaining[name]={...counts};
 return {
  packs(mode){return total(remaining[mode])/packSize;},
  reset(mode){remaining[mode]={...packBatches[mode]};},
  reserve(mode){
   const current=remaining[mode],next={...current},cards=[];
   const drawn=Object.fromEntries(Object.keys(cardTypes).map(tier=>[tier,packBatches[mode][tier]-current[tier]]));
   for(const slot of mode==='formal'?formalSlots:testSlots){
    const size=slot.reduce((sum,tier)=>sum+next[tier],0);
    if(!size)break;
    let rank=Math.floor(random()*size);
    for(const tier of slot){
     rank-=next[tier];
     if(rank>=0)continue;
     cards.push(tier);next[tier]--;break;
    }
   }
   return {cards,drawn,consume(){
    if(remaining[mode]!==current||cards.length!==packSize)return false;
    remaining[mode]=next;return true;
   }};
  }
 };
}

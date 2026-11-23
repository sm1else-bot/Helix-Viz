import {GATES,conditional,type Result,type Business} from './adapter';
export const INTERVAL=4, FINISH=40;
export const gateTimes=[7,14,21];
export const ease=(x:number)=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)};
export interface Pose {x:number;z:number;progress:number;entered:boolean;complete:boolean;rejected:boolean;unresolved:boolean;conditional:boolean;gate:number;ranked:boolean}
export function pose(b:Business,i:number,time:number,order:Business[],registry:Business[]=[]):Pose {
 const age=time-i*INTERVAL;
 const stop=b.stopped_at?GATES.indexOf(b.stopped_at):-1;
 let x=-15,z=0,gate=-1,flag=false;
 const xs=[-8,0,8];
 const legs=[{start:0,end:5,from:-15,to:-8},{start:8,end:12,from:-8,to:0},{start:15,end:19,from:0,to:8},{start:22,end:26,from:8,to:14}];
 for(let n=0;n<3;n++)if(age>=gateTimes[n]){if(conditional(b[GATES[n]].status))flag=true;gate=n;if(stop===n)break;}
 for(let n=0;n<legs.length;n++){
  if(stop>=0&&n>stop)break;
  const l=legs[n];if(age>=l.start)x=l.from+(l.to-l.from)*ease((age-l.start)/(l.end-l.start));
 }
 const rejected=stop>=0&&age>=gateTimes[stop];
 const unresolved=rejected&&b[GATES[stop]].status==='unknown';
 if(rejected){const slot=registry.length?registry.slice(0,i).filter(v=>v.stopped_at===b.stopped_at).length:i;x=xs[stop];z=5.2*ease((age-gateTimes[stop])/2.6);if(age>gateTimes[stop]+2.6){const settle=ease((age-gateTimes[stop]-2.6)/2);x=xs[stop]+(slot%4-1.5)*1.2*settle;z=5.2+Math.floor(slot/4)*1.8*settle;}}
 const rank=order.findIndex(v=>v.business===b.business);
 const sortStart=25*INTERVAL+27+rank*.65;
 const ranked=b.hard_pass&&time>=sortStart;
 if(b.hard_pass&&age>=26){const t=ease((age-26)/3);x=14+(rank%2)*1.9*t;z=(-2.2-Math.floor(rank/2)*1.25)*t;}
 if(ranked){const t=ease((time-sortStart)/3);x=(14+(rank%2)*1.9)*(1-t)+17*t;z=(-2.2-Math.floor(rank/2)*1.25)*(1-t)+(rank-1)*1.32*t;}
 return {x,z,progress:age,entered:age>=0,complete:stop>=0?age>=gateTimes[stop]+5:ranked&&time>=sortStart+3,rejected,unresolved,conditional:flag,gate,ranked};
}
export class Simulation {
 tick=0;playing=false;speed=1;accumulator=0;readonly dt=1/60;
 constructor(public result:Result){}
 get time(){return this.tick*this.dt}
 get duration(){return Math.max((this.result.gates.length-1)*INTERVAL+FINISH,25*INTERVAL+31+Math.max(0,this.result.gates.filter(b=>b.hard_pass).length-1)*.65)}
 reset(){this.tick=0;this.accumulator=0;this.playing=false}
 seek(time:number){this.tick=Math.round(Math.max(0,Math.min(this.duration,time))/this.dt);this.accumulator=0}
 advance(realSeconds:number){if(!this.playing)return;this.accumulator+=Math.min(realSeconds,.25)*this.speed;while(this.accumulator>=this.dt){this.tick++;this.accumulator-=this.dt;if(this.time>=this.duration){this.seek(this.duration);this.playing=false;break;}}}
 step(){this.playing=false;const screening=this.result.gates.flatMap((_,i)=>[0,...gateTimes].map(t=>i*INTERVAL+t));const sorting=this.result.gates.filter(b=>b.hard_pass).flatMap((_,i)=>[127+i*.65,130+i*.65]);const events=[...screening,...sorting].sort((a,b)=>a-b);this.seek(events.find(t=>t>this.time+.02)??this.duration)}
 counts(order:Business[]){let entered=0,rejected=0,unresolved=0,checks=0,passed=0,shortlisted=0;
  this.result.gates.forEach((b,i)=>{const p=pose(b,i,this.time,order);if(p.entered)entered++;if(p.rejected){if(p.unresolved)unresolved++;else rejected++;}if(p.conditional&&!p.rejected)checks++;if(b.hard_pass&&p.gate===2)passed++;if(p.ranked&&p.complete&&order.findIndex(v=>v.business===b.business)<3)shortlisted++;});return {entered,rejected,unresolved,checks,passed,shortlisted};}
}

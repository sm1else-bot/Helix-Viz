import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {adapt,ranking} from './adapter.ts';
import {Simulation,pose} from './simulation.ts';
const raw=JSON.parse(readFileSync(new URL('../public/fixture.json',import.meta.url),'utf8'));
test('fixture replay matches engine summary and exact shortlist',()=>{
 const data=adapt(raw),order=ranking(data),s=new Simulation(data);s.seek(s.duration);
 const c=s.counts(order);assert.equal(c.entered,26);assert.equal(c.passed,data.summary.pass_all_hard_gates);assert.equal(c.shortlisted,data.shortlist.length);assert.equal(c.rejected,Object.values(data.summary.stopped_at).reduce((a:number,b:any)=>a+b,0));assert.deepEqual(order.slice(0,3).map(b=>b.business),data.shortlist.map((b:any)=>b.business));
});
test('pause and elapsed-frame partition do not change outcomes or simulation ticks',()=>{
 const a=new Simulation(adapt(raw)),b=new Simulation(adapt(raw));a.playing=b.playing=true;
 for(let i=0;i<120;i++)a.advance(1/60);for(let i=0;i<60;i++)b.advance(1/30);assert.equal(a.tick,b.tick);
 a.playing=false;const tick=a.tick;a.advance(.2);assert.equal(a.tick,tick);a.reset();assert.equal(a.tick,0);assert.equal(a.playing,false);
});
test('unknown stops remain unresolved rather than rejected or shortlisted',()=>{
 const data=adapt(raw),row=data.gates[0];row.building.status='unknown';const s=new Simulation(data);s.seek(s.duration);const order=ranking(data);const p=pose(row,0,s.time,order);assert.equal(p.unresolved,true);assert.equal(s.counts(order).unresolved,1);
});
test('inconsistent hard-gates and incomplete rankings are refused',()=>{
 const bad=structuredClone(raw);bad.gates[0].hard_pass=true;assert.throws(()=>adapt(bad),/Inconsistent/);
 const incomplete=adapt(raw);incomplete.also_passed=[];assert.throws(()=>ranking(incomplete),/Complete engine ranking/);
});
test('shortlist is only dispatched after every candidate has screened',()=>{
 const data=adapt(raw),order=ranking(data),s=new Simulation(data);s.seek(100);assert.equal(s.counts(order).shortlisted,0);s.seek(s.duration);assert.equal(s.counts(order).shortlisted,3);
});
test('a real result with all 26 survivors has time to settle the entire ranking',()=>{
 const data=adapt(raw);data.gates.forEach(b=>{b.hard_pass=true;b.stopped_at=null;b.building.status='pass';b.affordability.status='pass';b.compliance.status='pass_needs_verification'});
 const order=data.gates,s=new Simulation(data);s.seek(s.duration);assert.ok(order.every((b,i)=>pose(b,i,s.time,order).complete));
});

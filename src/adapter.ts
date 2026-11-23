export const GATES = ['building', 'affordability', 'compliance'] as const;
export type GateName = typeof GATES[number];
export type Status = 'pass'|'pass_with_checks'|'fail'|'unknown'|'pass_low_case_only'|'pass_if_reserve_at_most'|'pass_low_case_only_if_reserve_at_most'|'pass_needs_verification';
export interface Gate {status:Status; rule?:string; reasons?:string[]; unknowns?:string[]; [key:string]:any}
export interface Business {business:string;label:string;group:string;building:Gate;affordability:Gate;compliance:Gate;neighborhood:any;hard_pass:boolean;stopped_at:GateName|null}
export interface Result {schema_version:string;inputs:any;property:any;method:any;summary:any;gates:Business[];shortlist:any[];tie_breaks:string[];also_passed:string[];warnings:string[];missing_evidence:any[];demo?:any;reproduce?:any}
const statuses = new Set(['pass','pass_with_checks','fail','unknown','pass_low_case_only','pass_if_reserve_at_most','pass_low_case_only_if_reserve_at_most','pass_needs_verification']);
export function adapt(raw:any):Result {
 if(raw?.schema_version!=='stage3.v1'||!Array.isArray(raw.gates)||!raw.inputs||!Array.isArray(raw.shortlist)) throw Error('Expected a complete stage3.v1 result, including inputs, gates and shortlist.');
 if(raw.gates.length!==26) throw Error('This installation expects the complete 26-category registry.');
 const ids=new Set<string>();
 for(const b of raw.gates){
  if(!b.business||!b.label||ids.has(b.business))throw Error('Missing or duplicate business identifier.'); ids.add(b.business);
  for(const g of GATES) if(!statuses.has(b[g]?.status))throw Error(`Unsupported ${g} status for ${b.business}.`);
  const stopped=GATES.find(g=>['fail','unknown'].includes(b[g].status))??null;
  if(b.stopped_at!==stopped||b.hard_pass!==(stopped===null))throw Error(`Inconsistent hard-gate result: ${b.business}.`);
 }
 if(raw.shortlist.length>3||new Set(raw.shortlist.map((b:any)=>b.business)).size!==raw.shortlist.length)throw Error('Invalid shortlist.');
 for(const b of raw.shortlist)if(!raw.gates.some((g:Business)=>g.business===b.business&&g.hard_pass))throw Error('Shortlist contains a stopped candidate.');
 return structuredClone(raw);
}
// No outcomes are computed in the renderer. Ranking order comes from the saved engine output.
export function ranking(result:Result):Business[]{
 const names=[...result.shortlist.map(b=>b.label),...(result.also_passed??[])];
 const passing=result.gates.filter(b=>b.hard_pass);
 if(names.length!==passing.length||new Set(names).size!==names.length)throw Error('Complete engine ranking (shortlist + also_passed) is required.');
 return names.map(name=>{const b=passing.find(b=>b.label===name);if(!b)throw Error('Ranked business is missing.');return b;});
}
export const conditional=(s:Status)=>s.startsWith('pass_');

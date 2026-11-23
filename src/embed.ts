import {adapt,ranking} from './adapter';
import {Simulation} from './simulation';
import {Plant} from './scene';

// Presentation-only entry: exactly the default fixture and the shared fixed clock.
// No inspection desk, picking, follow mode, transport controls, or random outcomes.
const host=document.getElementById('player')!;
async function boot(){
 const response=await fetch(`${import.meta.env.BASE_URL}fixture.json`);
 if(!response.ok)throw new Error('Unable to load the screening fixture.');
 const result=adapt(await response.json());
 const simulation=new Simulation(result);
 const plant=new Plant(host,result,ranking(result),{inspect:false});
 plant.renderer.domElement.tabIndex=0;
 plant.renderer.domElement.setAttribute('aria-label','3D screening machine. Drag to orbit; scroll to zoom.');
 simulation.speed=8;
 simulation.playing=true;
 let previous=performance.now(),visible=true,frame=0,disposed=false;
 const observer=new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting??false;previous=performance.now()});
 observer.observe(host);
 function render(now:number){
  if(disposed)return;
  if(visible&&!document.hidden){
   simulation.advance((now-previous)/1000);
   plant.update(simulation.time);
   if(simulation.time>=simulation.duration){simulation.reset();simulation.playing=true;}
  }
  previous=now;
  frame=requestAnimationFrame(render);
 }
 frame=requestAnimationFrame(render);
 window.addEventListener('pagehide',()=>{disposed=true;cancelAnimationFrame(frame);observer.disconnect();plant.dispose()},{once:true});
}
boot().catch(()=>{host.className='error';host.textContent='The 3D player could not start. Open the full visualization to try again.'});

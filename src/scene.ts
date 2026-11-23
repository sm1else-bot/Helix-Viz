import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GATES,type Result,type Business} from './adapter';
import {pose,ease,INTERVAL,gateTimes} from './simulation';
const C={dark:0x272c2b,belt:0x363b37,steel:0x94998e,light:0xd1d1bd,yellow:0xd8ed38,red:0xc66c52,green:0x5e896f};
export class Plant {
 renderer:T.WebGLRenderer;scene=new T.Scene();camera:T.PerspectiveCamera;controls:OrbitControls;
 root=new T.Group();cards:T.Group[]=[];targets:T.Object3D[]=[];scanners:T.Group[]=[];diverters:T.Group[]=[];needle!:T.Mesh;
 ray=new T.Raycaster();pointer=new T.Vector2();materials:T.Material[]=[];geometries:T.BufferGeometry[]=[];textures:T.Texture[]=[];
 resizeObserver:ResizeObserver;selected=-1;follow=false;initialTarget=new T.Vector3(1,0,1);onSelect:(id:number|string)=>void=()=>{};geometryCache=new Map<string,T.BufferGeometry>();materialCache=new Map<number,T.Material>();
 constructor(public host:HTMLElement,public result:Result,public order:Business[],options:{inspect?:boolean}={}){
  this.renderer=new T.WebGLRenderer({antialias:true,alpha:false});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.8));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;this.renderer.setClearColor(0xe9e7df);this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.25;host.append(this.renderer.domElement);
  this.camera=new T.PerspectiveCamera(30,1,.1,180);this.camera.position.set(24,27,36);this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.target.copy(this.initialTarget);this.controls.enableDamping=true;this.controls.minDistance=16;this.controls.maxDistance=85;this.controls.minPolarAngle=.25;this.controls.maxPolarAngle=Math.PI*.45;this.controls.maxTargetRadius=24;
  this.scene.add(new T.HemisphereLight(0xfff9e8,0x7a827b,2.5));const sun=new T.DirectionalLight(0xfff5dd,4.5);sun.position.set(-12,28,12);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-35,right:35,top:25,bottom:-25,near:1,far:90});sun.shadow.normalBias=.035;sun.shadow.bias=-.0002;sun.shadow.radius=3;this.scene.add(sun);const fill=new T.DirectionalLight(0xc3d9e5,1.4);fill.position.set(15,12,-20);this.scene.add(fill);
  const floor=new T.Mesh(new T.PlaneGeometry(300,300),new T.MeshStandardMaterial({color:0xe9e7df,roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.12;floor.receiveShadow=true;this.scene.add(floor,this.root);
  this.build();
  this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(host);this.resize();
  if(options.inspect!==false){let down={x:0,y:0};this.renderer.domElement.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY}});
  this.renderer.domElement.addEventListener('pointerup',e=>{if(Math.hypot(e.clientX-down.x,e.clientY-down.y)>5)return;const r=this.renderer.domElement.getBoundingClientRect();this.pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);this.ray.setFromCamera(this.pointer,this.camera);const hits=this.ray.intersectObjects(this.targets,true);if(hits[0]){let o:T.Object3D|null=hits[0].object;while(o&&o.userData.pick===undefined)o=o.parent;if(o)this.onSelect(o.userData.pick)}});}
 }
 mat(color:number,metalness=.2){const m=new T.MeshStandardMaterial({color,metalness,roughness:.48});this.materials.push(m);return m}
 box(parent:T.Object3D,w:number,h:number,d:number,x:number,y:number,z:number,color:number|T.Material=C.dark){const key=`box:${w}:${h}:${d}`;let geo=this.geometryCache.get(key);if(!geo){geo=new T.BoxGeometry(w,h,d);this.geometryCache.set(key,geo);this.geometries.push(geo)}let material:T.Material;if(typeof color==='number'){material=this.materialCache.get(color)??this.mat(color);this.materialCache.set(color,material)}else material=color;const m=new T.Mesh(geo,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}
 cyl(parent:T.Object3D,r:number,length:number,x:number,y:number,z:number,color=C.steel,axis='y'){const geo=new T.CylinderGeometry(r,r,length,12);this.geometries.push(geo);const m=new T.Mesh(geo,this.mat(color,.65));m.position.set(x,y,z);if(axis==='z')m.rotation.x=Math.PI/2;if(axis==='x')m.rotation.z=Math.PI/2;m.castShadow=true;parent.add(m);return m}
 label(parent:T.Object3D,text:string,w:number,x:number,y:number,z:number,color='#dce0c8',bg='#272c2b',flat=false){const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=128;const ctx=canvas.getContext('2d')!;ctx.fillStyle=bg;ctx.fillRect(0,0,1024,128);ctx.fillStyle=color;ctx.font='500 52px monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,512,68,980);const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;this.textures.push(tex);const geo=new T.PlaneGeometry(w,w/8);this.geometries.push(geo);const mat=new T.MeshBasicMaterial({map:tex,side:T.DoubleSide});this.materials.push(mat);const mesh=new T.Mesh(geo,mat);mesh.position.set(x,y,z);if(flat)mesh.rotation.x=-Math.PI/2;parent.add(mesh);return mesh}
 belt(x:number,z:number,length:number,width=2.8,axis='x'){
  const g=new T.Group();g.position.set(x,0,z);if(axis==='z')g.rotation.y=Math.PI/2;this.root.add(g);
  const belt=this.mat(C.belt),rail=this.mat(C.steel,.75);this.box(g,length, .4,width,0,1.5,0,C.dark);this.box(g,length-.15,.1,width-.3,0,1.76,0,belt);
  for(let p=-length/2+.25;p<length/2;p+=.42){this.box(g,.045,.025,width-.35,p,1.83,0,0x50564c)}
  for(const s of [-1,1]){this.box(g,length,.13,.12,0,1.99,s*width/2,rail);this.box(g,length,.16,.08,0,1.3,s*width/2,C.yellow);for(let p=-length/2+.5;p<length/2;p+=2.7){this.box(g,.14,1.5,.14,p,.7,s*(width/2-.2),C.dark);this.box(g,.45,.1,.4,p,.03,s*(width/2-.2),C.dark);this.cyl(g,.06,.06,p,1.99,s*(width/2+.07),C.dark,'z')}}
  for(const p of [-length/2,length/2])this.cyl(g,.25,width-.2,p,1.53,0,C.steel,'z');
  this.box(g,.8,.65,.6,length/2-.4,1.1,-width/2-.3,C.dark);this.cyl(g,.22,.7,length/2-.4,1.1,-width/2-.5,C.steel,'z');return g;
 }
 build(){
  this.belt(0,0,33);this.belt(-18,-2,7,3,'z');this.label(this.root,'26 / REGISTRY IN',4,-18,.02,-6,'#60675a','#e9e7df',true);
  // Floor markings are guides, not decorative data.
  for(const z of [-2.2,2.2])this.box(this.root,34,.015,.045,0,0,z,0xb4b7a5);
  for(let x=-15;x<18;x+=1.4){this.box(this.root,.035,.02,.4,x,0,2.5,0xaeb29f)}
  const names=['PHYSICAL FIT','AFFORDABILITY','COMPLIANCE'];
  [-8,0,8].forEach((x,n)=>{
   this.belt(x,4.4,5.8,2.1,'z');this.box(this.root,5.8,.2,8,x,1.6,9,0x858c7e);this.label(this.root,n===2?'HOLD / REJECT':'REJECT / HOLD',3.6,x,.03,13.8,'#696c60','#e9e7df',true);
   const station=new T.Group();station.position.x=x;station.userData.pick=GATES[n];this.root.add(station);this.targets.push(station);
   this.box(station,4,.3,4.4,0,.2,0,C.dark);
   for(const z of [-1.85,1.85]){this.box(station,.34,3.7,.34,-1.25,2,z,C.dark);this.box(station,.34,3.7,.34,1.25,2,z,C.dark);this.cyl(station,.06,2.6,-1.25,2.2,z-.22,C.steel);}
   for(const z of [-1.9,1.9]){this.box(station,3.2,.45,.45,0,4.05,z,C.dark);this.box(station,3.5,.07,.5,0,4.32,z,C.yellow)}for(const s of [-1,1])this.box(station,.2,.22,4.2,s*1.3,4.1,0,C.steel);this.label(station,`0${n+1} / ${names[n]}`,3.1,0,3.98,2.17);
   this.box(station,1.1,1.5,.7,1.9,2.2,-1.5,C.dark);this.label(station,'INTERLOCK',.95,1.9,2.5,-1.13);this.box(station,.7,.25,.04,1.9,2.1,-1.13,C.yellow);
   const scan=new T.Group();station.add(scan);this.scanners.push(scan);
   if(n===0){this.box(scan,.2,.25,3,0,3.35,0,C.steel);for(const z of [-1.3,1.3])this.box(scan,.35,1.3,.18,0,2.7,z,C.yellow);this.box(scan,.045,.025,2.4,0,2.18,0,C.yellow);for(let k=0;k<9;k++)this.box(station,.07,.08,.1,-1+k*.25,3.75,1.95,C.steel)}
   if(n===1){this.box(scan,2,.13,2.4,0,1.9,0,C.steel);this.cyl(station,.69,.15,0,3.2,2.25,C.light,'z');for(let k=0;k<13;k++){let a=-2.4+k*.4;const tick=this.box(station,.045,.13,.03,Math.sin(a)*.53,3.2+Math.cos(a)*.53,2.35,C.dark);tick.rotation.z=-a;}this.needle=this.box(station,.05,.55,.04,0,3.35,2.38,C.red);this.label(station,'CASH + RESERVE / BUDGET',2.8,0,4.58,1.5,'#555b4d','#e9e7df');}
   if(n===2){this.box(scan,1.8,.25,2.7,0,3.3,0,C.steel);for(let k=-1;k<=1;k++)this.box(scan,.3,.22,1.5,k*.55,3.05,0,C.yellow);this.label(station,'VERIFY ≠ APPROVE',2.8,0,4.58,1.5,'#555b4d','#e9e7df');}
   const div=new T.Group();div.position.set(x+1.6,2,1.2);this.root.add(div);this.box(div,1.7,.2,.14,-.7,0,0,C.yellow);this.diverters.push(div);
   this.label(this.root,`0${n+1}  ${names[n]}`,5.8,x,.03,-4.3,'#616655','#e9e7df',true);
  });
  // Ranking distributor and three acid-yellow shortlist receivers.
  this.box(this.root,3.8,.5,5.1,15.3,1.2,0,C.dark);this.box(this.root,4.2,.3,6.5,15,1.6,-4.6,C.steel);this.label(this.root,'RANKING BUFFER',3.8,15,1.78,-7.2,'#dce0c8','#272c2b',true);this.cyl(this.root,1.7,.25,15.2,1.61,0,C.steel);for(let k=0;k<12;k++){const a=k/12*Math.PI*2;this.cyl(this.root,.08,.12,15.2+Math.cos(a)*1.4,1.8,Math.sin(a)*1.4,C.dark)}
  for(let n=0;n<3;n++){this.box(this.root,3,.4,1.2,18,1.5,(n-1)*1.32,C.yellow);this.label(this.root,`0${n+1} / CONDITIONAL`,2.7,18,1.72,(n-1)*1.32,'#272c2b','#d8ed38',true)}
  const rankPick=this.box(this.root,2,.15,.7,15.3,1.8,2,C.dark);rankPick.userData.pick='ranking';this.targets.push(rankPick);this.label(this.root,'04 / ORDERED SORT',5,16.7,.03,-9,'#616655','#e9e7df',true);
  for(let n=3;n<this.order.length;n++)this.box(this.root,2.5,.25,1.15,17,1.4,(n-1)*1.32,C.steel);
  const cardMat=this.mat(0xd2d3bd,.5);
  this.result.gates.forEach((b,i)=>{
   const g=new T.Group();g.userData.pick=i;this.root.add(g);this.targets.push(g);
   this.box(g,1.65,.42,1.05,0,.23,0,cardMat);this.box(g,1.49,.04,.89,0,.46,0,0xa7ad98);this.label(g,`${String(i+1).padStart(2,'0')} / ${b.business.replaceAll('_',' ').toUpperCase()}`,1.4,0,.49,-.08,'#252c27','#a7ad98',true);this.label(g,b.label.toUpperCase(),1.4,0,.49,.22,'#414a3c','#a7ad98',true);
   for(const x of [-.7,.7])for(const z of [-.38,.38])this.cyl(g,.035,.02,x,.49,z,C.dark);
   const led=this.box(g,.13,.04,.13,.56,.5,-.31,this.mat(C.steel));led.name='led';const flag=this.box(g,.12,.7,.12,-.62,.7,-.33,C.yellow);flag.name='flag';flag.visible=false;
   const halo=this.box(g,1.84,.04,1.24,0,-.02,0,C.yellow);halo.name='selection';halo.visible=false;this.cards.push(g);
  });
 }
 resize(){const {width,height}=this.host.getBoundingClientRect();this.camera.aspect=width/height;this.camera.fov=T.MathUtils.radToDeg(2*Math.atan(Math.tan(T.MathUtils.degToRad(15))*Math.max(1,1.6/this.camera.aspect)));this.camera.updateProjectionMatrix();this.renderer.setSize(width,height)}
 home(){this.follow=false;this.camera.position.set(24,27,36);this.controls.target.copy(this.initialTarget);this.controls.update()}
 update(time:number){
  this.result.gates.forEach((b,i)=>{const p=pose(b,i,time,this.order,this.result.gates),g=this.cards[i];
   if(!p.entered)g.position.set(-18+(i%2)*1.9,1.9+Math.floor(i/10)*.53,-5+Math.floor(i%10/2)*1.2);
   else g.position.set(p.x,1.9,p.z);
   g.rotation.y=p.rejected?Math.PI/2*ease((p.progress-gateTimes[GATES.indexOf(b.stopped_at!)])/2):0;
   g.getObjectByName('flag')!.visible=p.conditional;g.getObjectByName('selection')!.visible=i===this.selected;
   const led=g.getObjectByName('led') as T.Mesh;(led.material as T.MeshStandardMaterial).color.setHex(p.rejected?(p.unresolved?0x8b889b:C.red):p.conditional?C.yellow:p.gate>=0?C.green:C.steel);
  });
  this.scanners.forEach((g,n)=>{const active=this.result.gates.findIndex((b,i)=>{const a=time-i*INTERVAL;return a>gateTimes[n]-2&&a<gateTimes[n]+1&&(b.stopped_at===null||GATES.indexOf(b.stopped_at)>=n)});const age=active<0?0:time-active*INTERVAL-(gateTimes[n]-2);g.position.y=n===0?0:-.75*Math.sin(Math.PI*Math.min(1,age/3));g.position.x=n===0?-1+2*ease(age/3):0;
   this.diverters[n].rotation.y=active>=0&&this.result.gates[active].stopped_at===GATES[n]?-.8*Math.sin(Math.PI*Math.min(1,age/3)):0;
   if(n===1){const cost=active>=0?this.result.gates[active].affordability.cash_to_open?.base:null;const ratio=cost==null?0:Math.min(1.6,cost/this.result.inputs.budget);this.needle.rotation.z=1.5-ratio*2;}
  });
  if(this.follow&&this.selected>=0){const p=this.cards[this.selected].position;const offset=this.camera.position.clone().sub(this.controls.target);this.controls.target.copy(p);this.camera.position.copy(p).add(offset)}
  this.controls.update();this.renderer.render(this.scene,this.camera);
 }
 dispose(){this.resizeObserver.disconnect();this.controls.dispose();this.root.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose()});this.materials.forEach(m=>m.dispose());this.textures.forEach(t=>t.dispose());this.renderer.dispose();this.renderer.domElement.remove()}
}

import * as THREE from 'three';
import {RoomEnvironment} from './vendor/RoomEnvironment.js';
import {kit} from './kit.js';
import {architectureConcepts} from './concepts-architecture.js';
import {intelligenceConcepts} from './concepts-intelligence.js';
import {signatureConcepts} from './concepts-signature.js';
import {EffectComposer} from './vendor/postprocessing/EffectComposer.js';
import {RenderPass} from './vendor/postprocessing/RenderPass.js';
import {SSAOPass} from './vendor/postprocessing/SSAOPass.js';
import {OutputPass} from './vendor/postprocessing/OutputPass.js';

const concepts=[...architectureConcepts,...intelligenceConcepts,...signatureConcepts];
const host=document.querySelector('#scene'), shell=document.querySelector('#atelier');
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.5));
renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=.85;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
host.append(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color('#f0efe9');
scene.fog=new THREE.Fog('#f0efe9',29,65);
const pmrem=new THREE.PMREMGenerator(renderer);
const environment=new RoomEnvironment();
scene.environment=pmrem.fromScene(environment,.045).texture;
scene.environmentIntensity=.42;
environment.dispose();pmrem.dispose();
scene.add(new THREE.HemisphereLight('#f9fcff','#9b957e',.65));
const key=new THREE.DirectionalLight('#fff0d5',3.5);key.position.set(-4,7,5);key.castShadow=true;
key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-9,right:9,top:9,bottom:-9,near:.1,far:38});
key.shadow.bias=-.00018;key.shadow.normalBias=.025;key.shadow.radius=3;scene.add(key);
const fill=new THREE.DirectionalLight('#d9e9ed',.7);fill.position.set(6,5,-7);scene.add(fill);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(200,200),kit.mat('#e6e4da',{roughness:.85,metalness:0}));
ground.rotation.x=-Math.PI/2;ground.position.y=-.13;ground.receiveShadow=true;scene.add(ground);
const camera=new THREE.PerspectiveCamera(38,innerWidth/innerHeight,.08,120);
// Fixed sampling makes the occlusion texture repeatable across independent captures.
class StableSSAO extends SSAOPass {
  _generateSampleKernel(n){for(let i=0;i<n;i++){const a=i*2.399963, z=(i+.5)/n, r=Math.sqrt(1-z*z);this.kernel.push(new THREE.Vector3(Math.cos(a)*r,Math.sin(a)*r,z).multiplyScalar(.1+.9*(i/n)**2));}}
  _generateRandomKernelRotations(){const d=Float32Array.from({length:16},(_,i)=>Math.sin(i*2.399963));this.noiseTexture=new THREE.DataTexture(d,4,4,THREE.RedFormat,THREE.FloatType);this.noiseTexture.wrapS=this.noiseTexture.wrapT=THREE.RepeatWrapping;this.noiseTexture.needsUpdate=true;}
}
const composer=new EffectComposer(renderer);composer.renderTarget1.samples=4;composer.renderTarget2.samples=4;composer.addPass(new RenderPass(scene,camera));
const occlusion=new StableSSAO(scene,camera,innerWidth,innerHeight,16);
occlusion.kernelRadius=.65;occlusion.minDistance=.001;occlusion.maxDistance=.06;
composer.addPass(occlusion);composer.addPass(new OutputPass());
renderer.info.autoReset=false;
let current=null,currentConcept=null,time=0,lastStamp=0;
let playing=!matchMedia('(prefers-reduced-motion: reduce)').matches;
let controlled=false;
const loaded=new Map();
const artDirection={
 '01':{title:'Atlas',layout:'editorial',summary:'A living architectural section. Open the property, reveal its rooms, follow the work.',checks:['Open the property','Reveal room readiness','Trace the service route','Focus the next action']},
 '02':{title:'Sanctuary',layout:'gallery',summary:'',checks:['Explore the suite','Reveal the guest zones','Shape the room setup','Review the arrangement']},
 '03':{title:'Cascade',layout:'vertical',summary:'The building opens floor by floor. Context stays connected as one level comes into focus.',checks:['Open the building','Separate the floors','Bring one level forward','Choose a focused view']},
 '04':{title:'Courtyard',layout:'panorama',summary:'',checks:['Discover the property','Reveal the private stays','Connect shared spaces','Follow the arrival path']},
 '05':{title:'Lens',layout:'optical',summary:'An optical draft, brought into focus. Extracted details stay subject to staff review.',checks:['Frame the sample document','Bring the details into focus','Present the extracted draft','Review before confirmation']},
 '06':{title:'Converge',layout:'editorial',summary:'Three possibilities. One considered match. Alternatives remain visible, and staff retain the choice.',checks:['Explore three room options','Keep alternatives in view','Bring the match forward','Leave the choice with staff']},
 '07':{title:'Contours',layout:'terrain',summary:'',checks:['Reveal the sample demand','Read the peaks and valleys','Explore a cross-section','Review the wider picture']},
 '08':{title:'Continuity',layout:'ribbon',checks:['Open the arrival brief','Carry the context forward','Review the next action','Hand off without losing detail']},
};
const $=s=>document.querySelector(s);
await document.fonts.ready;
await document.fonts.load('500 24px Urbanist');

function select(id){
  const original=concepts.find(c=>c.id===id);if(!original)throw Error(`Unknown concept ${id}`);
  const concept={...original,...artDirection[id]};
  if(current)scene.remove(current.root);
  if(!loaded.has(id))loaded.set(id,concept.create(THREE,kit));
  current=loaded.get(id);currentConcept=concept;scene.add(current.root);
  $('#title').textContent=concept.title;$('#subtitle').textContent=concept.subtitle;
  $('#summary').textContent=concept.summary;$('#category').textContent=concept.category;
  $('#number').textContent=`${id} / 10`;
  $('#sceneLabel').textContent=concept.checks[0];
  // Ten intentional scene layouts share only the quiet framing and control vocabulary.
  const layoutMap={atlas:'editorial',suite:'gallery',cascade:'vertical',courtyard:'panorama',lens:'optical',orbit:'editorial',topography:'terrain',journey:'ribbon'};
  shell.dataset.layout=layoutMap[concept.layout]??concept.layout??'editorial';
  $('#checks').replaceChildren(...concept.checks.map((text,i)=>{const li=document.createElement('li');const d=document.createElement('span');d.className='step-dot';d.textContent=String(i+1);li.append(d,document.createTextNode(text));return li;}));
  document.querySelectorAll('#concepts button').forEach(b=>b.setAttribute('aria-current',String(b.dataset.id===id)));
  time=0;renderAt(0);
}
function renderAt(seconds){
  if(!current)return;
  time=THREE.MathUtils.clamp(seconds,0,7);current.update(time);
  const view=current.camera(time);
  camera.position.set(...view.position);camera.fov=view.fov??38;
  const framing={'01':1.32,'02':1.34,'03':1.20,'04':1.14,'05':1.05,'06':1.0,'07':1.16,'08':1.03,'09':1.02,'10':1.06}[currentConcept.id]??1;
  camera.position.sub(new THREE.Vector3(...view.target)).multiplyScalar(framing).add(new THREE.Vector3(...view.target));
  camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
  if(['editorial','vertical','optical'].includes(shell.dataset.layout))camera.setViewOffset(innerWidth,innerHeight,-innerWidth*.12,0,innerWidth,innerHeight);
  else if(currentConcept.id==='02')camera.setViewOffset(innerWidth,innerHeight,-innerWidth*.075,-innerHeight*.065,innerWidth,innerHeight);
  else camera.clearViewOffset();
  camera.lookAt(new THREE.Vector3(...view.target));
  renderer.info.reset();composer.render();
  const phase=Math.min(3,Math.floor(time/1.75));
  document.querySelectorAll('#checks li').forEach((li,i)=>{li.classList.toggle('complete',i<phase);li.classList.toggle('active',i===phase);li.querySelector('.step-dot').textContent=i<phase?'✓':String(i+1);});
  $('#progressLabel').textContent=`0${phase+1} / 04`;
  $('#sceneLabel').textContent=currentConcept.checks[phase];
  $('#scrub').style.width=`${time/7*100}%`;$('#time').textContent=`00:0${Math.floor(time)}`;
  return true;
}
function inspect(){
  const gl=renderer.getContext(), ext=gl.getExtension('WEBGL_debug_renderer_info');let count=0;current.root.traverse(()=>count++);
  return{id:currentConcept.id,title:currentConcept.title,slug:currentConcept.title.toLowerCase().replace(/[^a-z0-9]+/g,'-'),webgl:renderer.capabilities.isWebGL2!==false,renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),sceneObjects:count,triangles:renderer.info.render.triangles,calls:renderer.info.render.calls,width:innerWidth,height:innerHeight,time,sampleDataOnly:true};
}
for(const c of concepts){const b=document.createElement('button');b.type='button';b.dataset.id=c.id;b.textContent=c.id;b.title=`${c.title} — ${c.subtitle}`;b.setAttribute('aria-label',`${c.id} ${c.title}`);b.onclick=()=>{controlled=false;select(c.id);};$('#concepts').append(b);}
$('#play').onclick=()=>{controlled=false;playing=!playing;$('#play').textContent=playing?'Ⅱ':'▶';$('#play').setAttribute('aria-label',playing?'Pause animation':'Play animation');};
$('#replay').onclick=()=>{controlled=false;playing=true;time=0;};
window.addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);composer.setSize(innerWidth,innerHeight);renderAt(time);});
select(location.hash.slice(1)||'01');
window.motionAtelier={ready:true,ids:concepts.map(c=>c.id),select:id=>{controlled=true;select(id);},renderAt:s=>{controlled=true;return renderAt(s);},inspect};
function animate(stamp){requestAnimationFrame(animate);const dt=Math.min(.05,(stamp-lastStamp)/1000);lastStamp=stamp;if(playing&&!controlled)renderAt((time+dt)%7);}
requestAnimationFrame(animate);

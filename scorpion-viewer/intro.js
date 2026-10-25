import {sampleIntro,shouldAutoStart} from './intro-choreography.js';

const dialog=document.getElementById('sting-intro');
const replay=document.getElementById('intro-replay');
const skip=document.getElementById('intro-skip');
const pause=document.getElementById('intro-pause');
const caption=document.getElementById('intro-caption');
const progress=document.getElementById('intro-progress-fill');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const SESSION_KEY='scorpion-atlas-intro-v1';
let run=null,sequence=0;
const phaseText={orbit:'كل اقتراب… يكشف عالمًا جديدًا.',face:'لقد شعر بوجودك.',warning:'المحاولة الأولى… ابتعد قليلًا.',prepare:'لحظة سكون قبل اللدغة.',strike:'الآن.',contact:'مرحبًا بك في الأطلس.'};
function seen(){try{return sessionStorage.getItem(SESSION_KEY)==='seen';}catch{return false;}}
function markSeen(){try{sessionStorage.setItem(SESSION_KEY,'seen');}catch{}}
function cleanup(current){
  if(!current)return;cancelAnimationFrame(current.raf);clearTimeout(current.exitTimer);current.abort.abort();
  const geometries=new Set(),materials=new Set();
  current.scene?.traverse(object=>{if(object.geometry)geometries.add(object.geometry);for(const material of Array.isArray(object.material)?object.material:object.material?[object.material]:[])materials.add(material);if(object.isSkinnedMesh)object.skeleton?.dispose();});
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());current.renderer?.dispose();current.observer?.disconnect();
}
function finish(immediate=false){
  const current=run;if(!current||current.ending)return;current.ending=true;markSeen();
  const close=()=>{if(run!==current)return;cleanup(current);run=null;dialog.close();document.body.style.overflow=current.previousOverflow;document.documentElement.style.overflow=current.previousRootOverflow;dialog.dataset.state='closed';if(current.returnFocus?.isConnected)current.returnFocus.focus({preventScroll:true});};
  if(immediate||reduced.matches)close();else{dialog.classList.add('is-leaving');current.exitTimer=setTimeout(close,650);}
}
function updatePause(){if(!run)return;pause.textContent=run.paused?'▶ متابعة':'Ⅱ إيقاف';pause.setAttribute('aria-pressed',String(run.paused));}
async function start(){
  if(!dialog||run)return;
  const current={id:++sequence,abort:new AbortController(),paused:false,ending:false,time:0,previous:0,previousOverflow:document.body.style.overflow,previousRootOverflow:document.documentElement.style.overflow,returnFocus:document.activeElement};run=current;
  dialog.classList.remove('is-leaving','is-contact');dialog.classList.toggle('is-reduced',reduced.matches);dialog.dataset.state='loading';progress.style.width='0%';caption.textContent='جارٍ إعداد المشهد…';skip.textContent='تخطي المقدمة ↖';pause.disabled=true;updatePause();
  try{dialog.showModal();document.body.style.overflow='hidden';document.documentElement.style.overflow='hidden';skip.focus({preventScroll:true});}catch{cleanup(current);run=null;return;}
  if(reduced.matches){caption.textContent='أهلًا بك في أطلس العقرب · تقليل الحركة مفعّل';skip.textContent='فتح الأطلس ↖';dialog.dataset.state='reduced';return;}
  let loadTimer=setTimeout(()=>{if(run===current&&dialog.dataset.state==='loading')finish(true);},5000);
  try{
    const [THREE,{GLTFLoader},response]=await Promise.all([import('../assets/vendor/three.module.js'),import('../assets/vendor/GLTFLoader.js'),fetch(new URL('./assets/scorpion.glb',import.meta.url),{signal:current.abort.signal})]);
    if(!response.ok)throw new Error('Intro model unavailable');
    const buffer=await response.arrayBuffer();if(run!==current||current.ending)return;
    const gltf=await new GLTFLoader().parseAsync(buffer,new URL('./assets/',import.meta.url).href);if(run!==current||current.ending){gltf.scene.traverse(o=>{o.geometry?.dispose();});return;}
    const canvas=document.getElementById('intro-canvas');
    const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'default'});current.renderer=renderer;
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.25));renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    const scene=new THREE.Scene();current.scene=scene;scene.background=new THREE.Color(0x080c0b);scene.fog=new THREE.FogExp2(0x080c0b,.09);
    const camera=new THREE.PerspectiveCamera(38,1,.012,40),actor=new THREE.Group();scene.add(actor);
    const model=gltf.scene;model.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(model),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());const scale=2.1/Math.max(size.x,size.y,size.z);model.scale.setScalar(scale);model.position.copy(center).multiplyScalar(-scale);actor.add(model);
    const rig=[];model.traverse(object=>{if(object.isBone&&/Sting_01_0[2-6]|Claw_0[12]_01|Pedipalp_01_03/.test(object.name))rig.push({bone:object,base:object.quaternion.clone()});if(object.isMesh){object.castShadow=true;object.frustumCulled=false;for(const material of Array.isArray(object.material)?object.material:[object.material]){material.color.set(0x51402a);material.roughness=.47;material.metalness=.28;}}});
    const tip=model.getObjectByName('Scorpion_Sting_01_07SHJnt');if(!tip||rig.length<8)throw new Error('Intro requires the original articulated scorpion');
    scene.add(new THREE.HemisphereLight(0xcad7ca,0x322819,1.7));
    const key=new THREE.DirectionalLight(0xffd7a0,4);key.position.set(-2,4,3);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=key.shadow.camera.bottom=-2;key.shadow.camera.right=key.shadow.camera.top=2;key.shadow.bias=-.001;scene.add(key);
    for(const [color,intensity,x,y,z] of [[0xa6c3d4,25,2,1,-2],[0xd69b53,14,-2,.5,-1]]){const light=new THREE.PointLight(color,intensity);light.position.set(x,y,z);scene.add(light);}
    const floorY=(box.min.y-center.y)*scale-.025;
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(80,80),new THREE.MeshStandardMaterial({color:0x10150f,roughness:.94,metalness:.05}));floor.rotation.x=-Math.PI/2;floor.position.y=floorY;floor.receiveShadow=true;scene.add(floor);
    const dustPositions=new Float32Array(90*3);for(let i=0;i<90;i++){dustPositions[i*3]=Math.sin(i*127.1)*3;dustPositions[i*3+1]=floorY+.05+(i%13)/13*2;dustPositions[i*3+2]=Math.cos(i*311.7)*3;}
    const dustGeometry=new THREE.BufferGeometry();dustGeometry.setAttribute('position',new THREE.BufferAttribute(dustPositions,3));const dust=new THREE.Points(dustGeometry,new THREE.PointsMaterial({color:0xd4bd8c,size:.007,transparent:true,opacity:.3,depthWrite:false}));scene.add(dust);
    const focus=new THREE.Vector3(0,-.18,0),tipPosition=new THREE.Vector3(),cameraPosition=new THREE.Vector3(),lookTarget=new THREE.Vector3(),axisX=new THREE.Vector3(1,0,0),axisZ=new THREE.Vector3(0,0,1),offset=new THREE.Quaternion();
    const resize=()=>{const width=dialog.clientWidth,height=dialog.clientHeight;if(width&&height){renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();current.needsRender=true;}};current.observer=new ResizeObserver(resize);current.observer.observe(dialog);resize();
    clearTimeout(loadTimer);pause.disabled=false;dialog.dataset.state='playing';let lastPhase='';
    function frame(now){
      if(run!==current||current.ending)return;current.raf=requestAnimationFrame(frame);
      const dt=current.previous?Math.max(0,(now-current.previous)/1000):0;current.previous=now;
      if(document.hidden||(current.paused&&current.rendered&&!current.needsRender))return;
      if(!current.paused)current.time+=dt;const shot=sampleIntro(current.time);dialog.dataset.phase=shot.phase;dialog.dataset.elapsed=current.time.toFixed(2);
      if(lastPhase!==shot.phase){caption.textContent=phaseText[shot.phase];lastPhase=shot.phase;}
      progress.style.width=(shot.progress*100)+'%';
      for(const {bone,base} of rig){bone.quaternion.copy(base);let angle=0,axis=axisZ;const name=bone.name,side=name.includes('_l_')?1:-1;
        if(name.includes('Sting')){axis=axisX;angle=-shot.anticipation*.035-shot.attempt*.23-shot.strike*.47;}
        else if(name.includes('Claw'))angle=side*(name.includes('Claw_01')?1:-1)*(.04+shot.anticipation*.12+shot.attempt*.17+shot.strike*.30);
        else angle=side*(shot.anticipation*.04+shot.strike*.16);
        bone.quaternion.multiply(offset.setFromAxisAngle(axis,angle));
      }
      actor.position.set(0,shot.strike*.035,shot.attempt*.12+shot.strike*.42);actor.rotation.y=0;actor.updateMatrixWorld(true);tip.getWorldPosition(tipPosition);
      const fit=Math.max(1,1.05/camera.aspect);
      cameraPosition.set(Math.sin(shot.angle)*shot.radius*fit,shot.height,Math.cos(shot.angle)*shot.radius*fit);
      lookTarget.copy(focus);
      if(shot.strike>0){const impactCamera=tipPosition.clone().add(new THREE.Vector3(0,.016,.048));cameraPosition.lerp(impactCamera,shot.strike);lookTarget.lerp(tipPosition,shot.strike);}
      camera.position.copy(cameraPosition);camera.lookAt(lookTarget);renderer.render(scene,camera);current.rendered=true;current.needsRender=false;
      if(shot.contact&&!current.contact){current.contact=true;dialog.classList.add('is-contact');}
      if(shot.finished)finish();
    }
    current.raf=requestAnimationFrame(frame);
  }catch(error){if(!current.abort.signal.aborted)console.warn('Cinematic intro skipped:',error.message);if(run===current)finish(true);}finally{clearTimeout(loadTimer);}
}
if(dialog){
  skip.addEventListener('click',()=>finish(true));pause.addEventListener('click',()=>{if(!run)return;run.paused=!run.paused;updatePause();});
  dialog.addEventListener('cancel',event=>{event.preventDefault();finish(true);});
  document.addEventListener('visibilitychange',()=>{if(run)run.previous=performance.now();});
  replay?.addEventListener('click',start);
  reduced.addEventListener('change',()=>{if(run)finish(true);});
  if(shouldAutoStart({reduced:reduced.matches,seen:seen(),hash:location.hash}))start();
}

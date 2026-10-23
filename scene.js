import * as THREE from './assets/vendor/three.module.js';
import { GLTFLoader } from './assets/vendor/GLTFLoader.js';
const $=id=>document.getElementById(id), canvas=$('scorpion'),art=$('render-art'),loading=$('scene-loading'),motion=$('motion-toggle');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let auto=!reduced.matches,mode='render',renderer,scene,camera,model,mixer,visible=true,rotation=.35,drag=false,lastX=0;
let follow=true,pointerInside=false,targetX=0,targetY=0,downX=0,downY=0,stingTime=0,clawTime=0;
const rig=[],axisX=new THREE.Vector3(1,0,0),axisZ=new THREE.Vector3(0,0,1),offset=new THREE.Quaternion();
const root=new THREE.Group(),peptide=new THREE.Group();
function motionState(){motion.textContent=auto?'Ⅱ':'▶';motion.setAttribute('aria-pressed',String(!auto));motion.setAttribute('aria-label',auto?'إيقاف الحركة':'تشغيل الحركة');art.classList.toggle('paused',!auto);}
motion.onclick=()=>{auto=!auto;motionState();};motionState();reduced.addEventListener('change',e=>{if(e.matches){auto=false;motionState();}});
art.onpointermove=e=>{if(!auto||reduced.matches)return;const r=art.getBoundingClientRect();art.style.setProperty('--tilt-y',((e.clientX-r.left)/r.width-.5)*12+'deg');art.style.setProperty('--tilt-x',-((e.clientY-r.top)/r.height-.5)*9+'deg');};art.onpointerleave=()=>{art.style.setProperty('--tilt-x','0deg');art.style.setProperty('--tilt-y','0deg');};
art.classList.add('ready');loading.hidden=true;
async function init(){
 if(renderer)return;
 renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor(0,0);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.4;
 scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(34,1,.01,100);camera.position.set(0,1.65,3.25);camera.lookAt(0,.2,0);
 scene.add(new THREE.HemisphereLight(0xe4ebef,0x7d6642,3));
 for(const [color,power,x,y,z] of [[0xffd9a0,85,-3,4,3],[0xa6c9df,65,3,2,-2],[0xffffff,25,0,4,-1]]){const l=new THREE.PointLight(color,power);l.position.set(x,y,z);scene.add(l);}
 scene.add(root,peptide);peptide.visible=false;
 const gold=new THREE.MeshStandardMaterial({color:0xc9aa72,metalness:.5,roughness:.36});
 for(let i=0;i<28;i++){const a=i*.55,y=(i-13.5)*.065;const sphere=new THREE.Mesh(new THREE.SphereGeometry(.065,12,8),gold);sphere.position.set(Math.cos(a)*.38,y,Math.sin(a)*.38);peptide.add(sphere);if(i){const prev=new THREE.Vector3(Math.cos((i-1)*.55)*.38,(i-1-13.5)*.065,Math.sin((i-1)*.55)*.38);const direction=sphere.position.clone().sub(prev);const link=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,direction.length(),8),gold);link.position.copy(prev).add(sphere.position).multiplyScalar(.5);link.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());peptide.add(link);}}
 const gltf=await new GLTFLoader().loadAsync('assets/scorpion.glb');model=gltf.scene;model.updateMatrixWorld(true);
 const box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
 const scale=1.5/Math.max(size.x,size.y,size.z);model.scale.multiplyScalar(scale);model.position.sub(center.multiplyScalar(scale));model.position.y+=.15;
 model.traverse(o=>{if(o.isMesh){o.frustumCulled=false;const mats=Array.isArray(o.material)?o.material:[o.material];for(const m of mats){if(m.color&&m.color.getHex()===0)m.color.set(0x302c26);}}});
 model.traverse(b=>{if(b.isBone&&(/Sting_01_0[2-6]|Claw_0[12]_01|Pedipalp_01_03/.test(b.name)))rig.push({bone:b,base:b.quaternion.clone()});});
 root.add(model);if(gltf.animations.length){mixer=new THREE.AnimationMixer(model);mixer.clipAction(gltf.animations[0]).play();}
 canvas.dataset.modelLoaded='true';canvas.dataset.animations=String(gltf.animations.length);resize();
}
function resize(){if(!renderer)return;const r=canvas.getBoundingClientRect();if(!r.width||!r.height)return;renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();}
new ResizeObserver(resize).observe($('specimen'));
new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;}).observe($('specimen'));
async function choose(next){mode=next;$('creature-actions').hidden=next!=='scorpion';$('pointer-aura').classList.remove('active');for(const name of ['render','scorpion','peptide'])$('show-'+name).setAttribute('aria-pressed',String(name===next));art.hidden=next!=='render';canvas.hidden=next==='render';$('rotate-left').disabled=$('rotate-right').disabled=next==='render';$('scene-title').textContent=next==='render'?'رندر فني مستوحى من العقرب':next==='scorpion'?'العقرب · المجسّم ثلاثي الأبعاد':'سلسلة ببتيدية توضيحية';$('scene-disclaimer').textContent=next==='render'?'صورة فنية مولّدة · حركة عمق توضيحية':next==='scorpion'?'مجسّم مرفق من صاحب المشروع · حركة مدمجة':'تمثيل فني، وليس بنية جزيئية محسوبة';$('scene-hint').textContent=next==='render'?'حرّك المؤشر لاستكشاف العمق ↔':'حرّك المؤشر · انقر للدغ · اسحب للتدوير';
 if(next==='render'){loading.hidden=true;return;}loading.hidden=true;
 try{if(!model){loading.hidden=false;loading.textContent='جارٍ تحميل المجسّم…';await init();}root.visible=mode==='scorpion';peptide.visible=mode==='peptide';loading.hidden=true;resize();}catch(e){console.error('3D model loading failed',e);await choose('render');$('scene-hint').textContent='تعذّر عرض المجسّم على هذا الجهاز؛ الرندر متاح';}
}
for(const name of ['render','scorpion','peptide'])$('show-'+name).onclick=()=>choose(name);
$('rotate-left').onclick=()=>rotation-=.3;$('rotate-right').onclick=()=>rotation+=.3;
function trigger(kind){if(mode!=='scorpion'||!model)return;const now=performance.now();if(kind==='sting'){if(stingTime&&now-stingTime<1000)return;stingTime=now;canvas.dataset.lastAction='sting';}else{clawTime=now;canvas.dataset.lastAction='claws';}if(!auto){auto=true;motionState();}$('action-status').textContent=kind==='sting'?'حركة لدغ':'حركة الكلّابات';const aura=$('pointer-aura');aura.classList.remove('strike');void aura.offsetWidth;aura.classList.add('strike');}
$('sting-action').onclick=()=>trigger('sting');$('claw-action').onclick=()=>trigger('claws');
$('follow-action').onclick=()=>{follow=!follow;$('follow-action').setAttribute('aria-pressed',String(follow));$('follow-action').textContent=follow?'يتبع المؤشر ◎':'تتبّع متوقف ◎';};
canvas.onpointerdown=e=>{drag=true;lastX=downX=e.clientX;downY=e.clientY;canvas.setPointerCapture(e.pointerId);};
canvas.onpointermove=e=>{const r=canvas.getBoundingClientRect();targetX=Math.max(-1,Math.min(1,(e.clientX-r.left)/r.width*2-1));targetY=Math.max(-1,Math.min(1,(e.clientY-r.top)/r.height*2-1));pointerInside=true;const stage=$('specimen').getBoundingClientRect();$('pointer-aura').style.left=(e.clientX-stage.left)+'px';$('pointer-aura').style.top=(e.clientY-stage.top)+'px';$('pointer-aura').classList.toggle('active',mode==='scorpion'&&follow);if(drag){rotation+=(e.clientX-lastX)*.012;lastX=e.clientX;}};
canvas.onpointerleave=()=>{pointerInside=false;$('pointer-aura').classList.remove('active');};
canvas.onpointerup=e=>{if(drag&&Math.hypot(e.clientX-downX,e.clientY-downY)<7)trigger('sting');drag=false;};canvas.onpointercancel=()=>drag=false;
canvas.onkeydown=e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();rotation+=e.key==='ArrowLeft'?-.2:.2;}if(e.key===' '||e.key==='Enter'){e.preventDefault();trigger('sting');}if(e.key.toLowerCase()==='c')trigger('claws');};
let last=performance.now();function frame(now){requestAnimationFrame(frame);const dt=Math.min((now-last)/1000,.05);last=now;if(!renderer||!model||mode==='render'||!visible||document.hidden)return;
 for(const r of rig)r.bone.quaternion.copy(r.base);
 if(auto&&!drag)mixer?.update(dt);
 for(const r of rig)r.base.copy(r.bone.quaternion);
 const sting=stingTime?Math.max(0,(now-stingTime)/1100):2,claw=clawTime?Math.max(0,(now-clawTime)/1000):2;
 const pulse=t=>t<1?Math.sin(Math.PI*t)**2:0;
 if(auto&&!reduced.matches){for(const r of rig){let angle=0,axis=axisX;const name=r.bone.name;if(name.includes('Sting'))angle=-pulse(sting)*.28;else if(name.includes('Claw')){axis=axisZ;const side=name.includes('_l_')?1:-1,branch=name.includes('Claw_01')?1:-1;angle=side*branch*(pulse(claw)*.42+pulse(sting)*.16+(pointerInside&&follow?.04*Math.sin(now*.004):0));}else{axis=axisZ;angle=(name.includes('_l_')?1:-1)*pulse(claw)*.12;}r.bone.quaternion.multiply(offset.setFromAxisAngle(axis,angle));}}
 const tracking=auto&&follow&&pointerInside&&!drag&&mode==='scorpion'&&!reduced.matches;
 root.rotation.y=THREE.MathUtils.damp(root.rotation.y,rotation+(tracking?targetX*.55:0),7,dt);
 root.position.x=THREE.MathUtils.damp(root.position.x,tracking?targetX*.13:0,6,dt);root.position.z=THREE.MathUtils.damp(root.position.z,tracking?targetY*.08:0,6,dt);root.rotation.x=auto&&!reduced.matches?-pulse(sting)*.09:0;
 peptide.rotation.y=rotation+(auto&&!reduced.matches?now*.00008:0);renderer.render(scene,camera);}requestAnimationFrame(frame);choose('scorpion');

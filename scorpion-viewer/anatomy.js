import * as THREE from './assets/vendor/three.module.js';
import { GLTFLoader } from './assets/vendor/GLTFLoader.js';
import { exportAnatomyGLB } from './anatomy-export.js';
import { Physiology, processInfo } from './anatomy-physiology.js';
import { ScorpionCombat } from './anatomy-combat.js';

const $ = id => document.getElementById(id);
const embeddedMode = new URLSearchParams(location.search).get('embedded') === '1';
let embeddedVisible = true;
if (embeddedMode && window.parent !== window) {
  const reportSize = () => window.parent.postMessage({type:'atlas-anatomy-size',height:Math.ceil(document.querySelector('.workspace').getBoundingClientRect().height)},location.origin);
  new ResizeObserver(reportSize).observe(document.querySelector('.workspace'));
  window.addEventListener('message',event=>{
    if(event.origin!==location.origin||event.source!==window.parent)return;
    if(event.data?.type==='atlas-anatomy-measure')reportSize();
    if(event.data?.type==='atlas-anatomy-visibility')embeddedVisible=event.data.visible===true;
  });
}
const systems = {
  shell: { name:'الهيكل الخارجي', latin:'EXOSKELETON', color:'#c5aa75', copy:'درع خارجي مفصلي يدعم الجسم ويحمي الأنسجة. يعرض هذا السطح هندسة النموذج الأصلي المرفق، بما فيها الكلّابات والأرجل وحلقات الذيل والإبرة.', location:'الجسم الأمامي يحمل أربعة أزواج من الأرجل وزوجًا من اللوامس القدمية التي تنتهي بالكلّابات. يليه البطن العريض ثم خمس حلقات ضيقة تنتهي بالتلسون.', point:[0,.07,-.03] },
  heart: { name:'القلب والأوعية', latin:'CIRCULATORY SYSTEM', color:'#d66c68', copy:'قلب أنبوبي ظهري يضخ الهيمولِمف ضمن جهاز دوران مفتوح. الفروع الحمراء توضح مسارات وعائية رئيسية بشكل مبسط.', location:'يمتد القلب فوق القناة الهضمية في القسم العريض من البطن. الأوعية في هذا العرض مختصرة وليست شبكة وعائية كاملة.', point:[0,.069,-.082] },
  digestive: { name:'الجهاز الهضمي', latin:'DIGESTIVE SYSTEM', color:'#d4a556', copy:'قناة هضمية مركزية تحيط بها فصوص الغدة الهضمية. العقرب يتناول غذاءً مسالًا؛ وتمثل الفصوص الذهبية الغدة الهضمية بصورة مبسطة.', location:'القناة تمتد من الجسم الأمامي عبر البطن وحلقات الذيل. تنتهي قرب نهاية الحلقة الخامسة، قبل التلسون وغدد السم.', point:[0,.047,-.075] },
  nerves: { name:'الجهاز العصبي', latin:'NERVOUS SYSTEM', color:'#88b6d6', copy:'مراكز عصبية أمامية وحبل عصبي بطني مع عقد متتابعة وفروع نحو الزوائد. اللون الأزرق مخصص للتمييز التعليمي.', location:'يقع أسفل القناة الهضمية. عدد العقد وتفرعاتها هنا مختصر لإظهار التنظيم العام، دون ادعاء رسم جميع الأعصاب.', point:[0,.030,-.04] },
  lungs: { name:'الرئات الكتبية', latin:'BOOK LUNGS · FOUR PAIRS', color:'#9eb98d', copy:'أربعة أزواج من أعضاء التنفس تحتوي صفائح متجاورة تشبه صفحات كتاب. تزيد الصفائح مساحة تبادل الغازات مع الهيمولِمف.', location:'على الناحية البطنية من البطن العريض. الصفائح القليلة المعروضة مكبرة تعليميًا؛ الرئة الحقيقية تحتوي عددًا أكبر بكثير.', point:[.021,.035,-.09] },
  venom: { name:'غدد السم', latin:'PAIRED VENOM GLANDS', color:'#b295d6', copy:'غدتان داخل التلسون تتصلان بقناتين تتجهان إلى الإبرة. يوضح اللون البنفسجي موقع الغدد والمسار التقريبي لقنوات السم.', location:'داخل الانتفاخ النهائي بعد حلقات الذيل الخمس. مواضع الغدد والقنوات تقريبية ومتكيفة مع وضعية هذا النموذج.', point:[0,.245,-.200] }
};
let renderer, scene, camera, specimen, shell, organs, actor, physiology, combat, combatSnapshot, mode='surface', selected='shell', auto=false;
let azimuth=.65, polar=1.06, distance=3.85, ready=false;
const target=new THREE.Vector3(0,0,0), focusTarget=new THREE.Vector3(), groups={}, labels={}, shellMaterials=[];
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const cutPlane=new THREE.Plane(new THREE.Vector3(-1,0,0),0);
const raycaster=new THREE.Raycaster(), pointer=new THREE.Vector2();
const stage=document.querySelector('.stage'), canvas=$('anatomy-canvas');
const displayTitles={surface:'القشرة وحدها',inner:'باطن القشرة · دون الأعضاء',transparent:'القشرة والأعضاء معًا',section:'مقطع طولي · نافذة إلى الداخل',internal:'الأجهزة الداخلية وحدها'};
const layerNotes={surface:'القشرة الخارجية وحدها دون الأعضاء.',inner:'نافذة مقطوعة تُظهر باطن سطح القشرة فقط. النموذج لا يحتوي سماكة نسيجية مقاسة.',transparent:'قشرة شفافة مع جميع الأعضاء. يمكنك تعديل وضوح القشرة.',section:'قطع القشرة مع إبقاء الأعضاء ظاهرة. حرّك مستوى القطع.',internal:'الأعضاء وحدها، مع إخفاء القشرة بالكامل.'};
let normalization=1, center=new THREE.Vector3(), lastTime=0, fitDistance=3.85;

for(const [key,data] of Object.entries(systems)){
  const button=document.createElement('button');button.className='system-row';button.dataset.system=key;button.style.setProperty('--swatch',data.color);button.setAttribute('aria-pressed',String(key===selected));
  button.innerHTML=`<i></i><span>${data.name}</span><small>${String(Object.keys(systems).indexOf(key)+1).padStart(2,'0')}</small>`;
  button.onclick=()=>select(key,true);$('systems').append(button);
}
function select(key,reveal=false){
  selected=key;const d=systems[key];$('detail-title').textContent=d.name;$('detail-latin').textContent=d.latin;$('detail-copy').textContent=d.copy;$('detail-location').textContent=d.location;$('detail-color').style.background=d.color;
  document.querySelectorAll('[data-system]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.system===key)));
  if(reveal&&ready){if(key==='shell')setMode('surface');else if(['surface','inner'].includes(mode))setMode('transparent');}
  updateVisibility();
}
function setMode(next){
  if(combat?.enabled)setCombat(false);
  mode=next;$('view-title').textContent=displayTitles[mode];$('layer-note').textContent=layerNotes[mode];$('cut-field').hidden=!['section','inner'].includes(mode);
  const opacity=['surface','section','inner'].includes(mode)?100:mode==='transparent'?15:0;
  $('opacity').value=opacity;$('opacity-value').textContent=opacity+'%';
  $('opacity').disabled=mode==='internal';
  document.querySelectorAll('button[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));updateVisibility();
}
function updateVisibility(){
  if(!ready)return;
  const alpha=Number($('opacity').value)/100;
  shell.visible=alpha>0;
  for(const material of shellMaterials){material.transparent=alpha<1;material.opacity=alpha;material.depthWrite=alpha>=.95;material.side=mode==='inner'?THREE.BackSide:THREE.DoubleSide;material.clippingPlanes=['section','inner'].includes(mode)?[cutPlane]:[];material.needsUpdate=true;}
  organs.visible=!combat?.enabled&&!['surface','inner'].includes(mode);
  for(const [key,g] of Object.entries(groups)){
    g.visible=!$('isolate').checked||selected==='shell'||selected===key;
    g.traverse(o=>{if(o.isMesh&&!o.userData.transient){o.userData.selected=selected===key;o.material.emissive.set(systems[key].color);o.material.emissiveIntensity=selected===key?.16:.025;}});
  }
  canvas.dataset.mode=mode;canvas.dataset.selected=selected;
  updateActivity();
}
function material(color){return new THREE.MeshStandardMaterial({color,roughness:.43,metalness:.08});}
const unitSphere=new THREE.SphereGeometry(1,24,16);
function ellipsoid(group,position,scale,color){const m=new THREE.Mesh(unitSphere,material(color));m.position.set(...position);m.scale.set(...scale);group.add(m);return m;}
function tube(group,points,radius,color){const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,Math.max(18,points.length*7),radius,8,false),material(color));mesh.userData.flowTube=true;group.add(mesh);return mesh;}
function anatomy(){
  for(const [key,data] of Object.entries(systems)){
    if(key==='shell')continue;const g=new THREE.Group();g.name=key;groups[key]=g;organs.add(g);
    const label=document.createElement('span');label.className='organ-label';label.textContent=data.name;label.style.setProperty('--swatch',data.color);$('labels').append(label);labels[key]=label;
  }
  const heart=groups.heart, red=systems.heart.color;
  const heartTube=tube(heart,[[0,.064,-.025],[0,.068,-.06],[0,.074,-.10],[0,.076,-.145]],.0038,red);heartTube.userData.pulse=true;
  tube(heart,[[0,.064,-.025],[0,.060,.005],[0,.047,.035]],.0016,red);
  for(let i=0;i<7;i++){const z=-.035-i*.015,y=.065+i*.0016;for(const s of [-1,1])tube(heart,[[0,y,z],[s*.012,y-.005,z-.004],[s*.026,y-.018,z-.01]],.00085,red);}
  const digestive=groups.digestive,gold=systems.digestive.color;
  const gut=[[0,.043,.048],[0,.044,.018],[0,.046,-.015],[0,.049,-.055],[0,.055,-.10],[0,.063,-.15],[0,.078,-.18],[0,.102,-.214],[0,.14,-.238],[0,.181,-.24],[0,.216,-.227]];
  tube(digestive,gut,.0028,gold);ellipsoid(digestive,[0,.046,.008],[.012,.009,.018],gold);
  for(let i=0;i<7;i++)for(const s of [-1,1]){const z=-.023-i*.017;const width=.017*(1-.05*i);ellipsoid(digestive,[s*.013,.048+i*.002,z],[width,.010,.010],gold);}
  const nerves=groups.nerves,blue=systems.nerves.color;
  ellipsoid(nerves,[0,.035,.030],[.009,.005,.007],blue);
  tube(nerves,[[0,.031,.028],[0,.029,-.02],[0,.033,-.065],[0,.040,-.11],[0,.050,-.15]],.0011,blue);
  for(let i=0;i<8;i++){const z=.02-i*.022,y=.030+Math.max(0,i-2)*.0033;ellipsoid(nerves,[0,y,z],[.003,.002,.003],blue);for(const s of [-1,1])tube(nerves,[[0,y,z],[s*.014,y-.001,z+.003],[s*(i<3?.040:.025),y-.003,z+.008]],.0006,blue);}
  const lungs=groups.lungs,green=systems.lungs.color;
  for(let i=0;i<4;i++)for(const s of [-1,1]){
    const z=-.045-i*.025,x=s*(.025-i*.002),y=.027+i*.004;
    ellipsoid(lungs,[x,y,z],[.009,.004,.009],green);
    for(let j=0;j<9;j++){const plate=new THREE.Mesh(new THREE.BoxGeometry(.012,.0005,.010),material(green));plate.position.set(x,y+.0008+j*.0007,z);plate.rotation.z=s*.15;lungs.add(plate);}
  }
  const venom=groups.venom,purple=systems.venom.color;
  for(const s of [-1,1]){
    const sac=ellipsoid(venom,[s*.005,.247,-.198],[.0045,.007,.013],purple);sac.rotation.x=-.6;sac.userData.pulse=true;
    tube(venom,[[s*.005,.247,-.198],[s*.003,.244,-.177],[s*.0015,.224,-.145],[s*.001,.202,-.123]],.00065,purple);
  }
}
function cameraUpdate(){
  target.lerp(focusTarget,reduced.matches?1:.12);
  camera.position.set(target.x+distance*Math.sin(polar)*Math.sin(azimuth),target.y+distance*Math.cos(polar),target.z+distance*Math.sin(polar)*Math.cos(azimuth));camera.lookAt(target);
}
function resize(){if(!renderer)return;const r=stage.getBoundingClientRect();if(!r.width||!r.height)return;renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;const nextFit=Math.max(3.85,3.6/camera.aspect);distance=THREE.MathUtils.clamp(distance*nextFit/fitDistance,.35,8);fitDistance=nextFit;camera.updateProjectionMatrix();}
function preset(view){
  const views={perspective:[.65,1.06],top:[0,.055],side:[Math.PI/2,Math.PI/2-.05],bottom:[0,Math.PI-.055]};[azimuth,polar]=views[view];
  focusTarget.set(0,0,0);distance=fitDistance;
  document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));
}
function worldPoint(p){specimen.updateWorldMatrix(true,false);return specimen.localToWorld(new THREE.Vector3(...p));}
async function init(){
  try{
    renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.localClippingEnabled=true;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
    scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(36,1,.01,50);
    scene.add(new THREE.HemisphereLight(0xe8f1dc,0x454335,2.4));
    for(const [color,intensity,position] of [[0xffdfac,38,[-2,3,3]],[0xc4dce7,30,[2,2,-2]],[0xfff5dc,18,[0,4,-1]]]){const l=new THREE.PointLight(color,intensity);l.position.set(...position);scene.add(l);}
    actor=new THREE.Group();scene.add(actor);specimen=new THREE.Group();actor.add(specimen);
    const gltf=await new GLTFLoader().loadAsync('assets/scorpion.glb');shell=gltf.scene;shell.updateMatrixWorld(true);
    let hasArticulatedModel=false;shell.traverse(object=>{if(object.isSkinnedMesh&&object.skeleton?.bones.length)hasArticulatedModel=true;});
    if(!hasArticulatedModel){const error=new Error('ملف assets/scorpion.glb نسخة ثابتة بلا مفاصل. أعد النموذج الأصلي من الحزمة الكاملة، ولا تستخدم ملف scorpion-anatomy-educational.glb مكانه.');error.code='SCORPION_RIG_MISSING';throw error;}
    const bounds=new THREE.Box3().setFromObject(shell);center=bounds.getCenter(new THREE.Vector3());const size=bounds.getSize(new THREE.Vector3());normalization=2/Math.max(size.x,size.y,size.z);
    specimen.scale.setScalar(normalization);specimen.position.copy(center).multiplyScalar(-normalization);specimen.add(shell);
    const pivot=new THREE.Vector3(0,.04,-.05).sub(center).multiplyScalar(normalization);actor.position.copy(pivot);specimen.position.sub(pivot);
    // Anatomy uses the original bind pose; articulated combat temporarily hides it.
    shell.traverse(o=>{if(o.isMesh){o.frustumCulled=false;for(const m of Array.isArray(o.material)?o.material:[o.material]){
      m.color.set(0x51452f);m.roughness=.53;m.metalness=.22;m.side=THREE.DoubleSide;
      // Object-space grain adds a fine cuticle texture without requiring missing UVs.
      m.onBeforeCompile=shader=>{
        shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 cuticlePosition;').replace('#include <begin_vertex>','#include <begin_vertex>\ncuticlePosition = position;');
        shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
          varying vec3 cuticlePosition;
          float cuticleNoise(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
          float cuticleGrain(vec3 p){vec3 i=floor(p);vec3 f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(mix(cuticleNoise(i),cuticleNoise(i+vec3(1,0,0)),f.x),mix(cuticleNoise(i+vec3(0,1,0)),cuticleNoise(i+vec3(1,1,0)),f.x),f.y),mix(mix(cuticleNoise(i+vec3(0,0,1)),cuticleNoise(i+vec3(1,0,1)),f.x),mix(cuticleNoise(i+vec3(0,1,1)),cuticleNoise(i+vec3(1,1,1)),f.x),f.y),f.z);}
        `).replace('#include <color_fragment>','#include <color_fragment>\nfloat grain=cuticleGrain(cuticlePosition*2400.0);diffuseColor.rgb*=0.82+grain*0.3;').replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\nvec3 q0=dFdx(vViewPosition),q1=dFdy(vViewPosition);float h0=dFdx(grain),h1=dFdy(grain);vec3 r0=cross(q1,normal),r1=cross(normal,q0);float det=dot(q0,r0);normal=normalize(normal-0.00012*sign(det)*(h0*r0+h1*r1)/max(abs(det),0.000001));');
      };
      shellMaterials.push(m);
    }}});
    organs=new THREE.Group();specimen.add(organs);anatomy();
    physiology=new Physiology(groups);combat=new ScorpionCombat(shell,actor);
    const ring=new THREE.Mesh(new THREE.RingGeometry(.94,.945,100),new THREE.MeshBasicMaterial({color:0x7e8764,transparent:true,opacity:.2,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=-.59;scene.add(ring);
    ready=true;canvas.dataset.loaded='true';$('download-model').disabled=false;$('load-status').hidden=true;resize();select('shell');requestAnimationFrame(frame);
  }catch(error){console.error(error);$('load-status').textContent=error.code==='SCORPION_RIG_MISSING'?error.message:'تعذّر تشغيل العرض ثلاثي الأبعاد. يمكنك قراءة دليل الأجزاء أو إعادة تحميل الصفحة.';$('fallback').hidden=false;canvas.hidden=true;document.querySelectorAll('.modes button,.stage-tools button,.view-presets button,.physiology input,.simulation-controls button,#phys-speed,#combat-toggle,#combat-quick,#combat-strike,#focus,#opacity,#cut,#isolate,#show-labels').forEach(b=>b.disabled=true);canvas.dataset.loaded='error';}
}
function frame(time){
  requestAnimationFrame(frame);if(document.hidden||!embeddedVisible)return;
  const dt=Math.min((time-lastTime)/1000,.05);lastTime=time;
  if(auto&&!reduced.matches&&pointers.size===0)azimuth+=dt*.14;
  combat.update(dt,reduced.matches);physiology.update(reduced.matches?0:dt,combat.enabled);
  canvas.dataset.physiologyTime=physiology.time.toFixed(2);canvas.dataset.attackActive=String(combat.enabled&&combat.attackAge<1);
  canvas.dataset.facing=combat.actor.rotation.y.toFixed(3);
  cameraUpdate();renderer.render(scene,camera);
  $('combat-target').classList.toggle('strike',combat.enabled&&combat.attackAge<.7);
  const visibleLabels=[];
  for(const [key,label] of Object.entries(labels)){
    const show=organs.visible&&groups[key].visible&&$('show-labels').checked;
    label.hidden=!show;if(!show)continue;
    const p=worldPoint(systems[key].point).project(camera);label.hidden=p.z>1||p.z< -1||Math.abs(p.x)>.9||Math.abs(p.y)>.8;
    visibleLabels.push({label,x:(p.x+1)/2*stage.clientWidth,y:(-p.y+1)/2*stage.clientHeight});
  }
  visibleLabels.sort((a,b)=>a.y-b.y);
  for(let i=1;i<visibleLabels.length;i++)visibleLabels[i].y=Math.max(visibleLabels[i].y,visibleLabels[i-1].y+29);
  for(let i=visibleLabels.length-1;i>=0;i--){const item=visibleLabels[i];item.y=Math.min(item.y,stage.clientHeight-135-(visibleLabels.length-1-i)*29);item.label.style.left=Math.max(60,Math.min(stage.clientWidth-140,item.x+24))+'px';item.label.style.top=item.y+'px';}
}
function updateActivity(){
  if(!ready)return;
  const active=[...physiology.enabled];
  const visible=active.filter(key=>organs.visible&&groups[key].visible);
  const legend=$('process-legend');legend.replaceChildren();legend.hidden=visible.length===0||combat.enabled;
  for(const key of visible){const entry=document.createElement('span'),dot=document.createElement('i');dot.style.setProperty('--swatch',processInfo[key].color);entry.append(dot,processInfo[key].label);legend.append(entry);}
  let status='استكشف طبقات الجسم';
  if(combat.enabled)status='مواجهة المؤشر · انقر للهجوم · Esc للعودة للتشريح';
  else if(active.length){status=reduced.matches?'تقليل الحركة مفعّل · مسارات ثابتة':physiology.running?'محاكاة تعليمية · سرعة '+physiology.speed+'×':'المحاكاة متوقفة مؤقتًا';if(!visible.length)status+=' · العمليات مخفية في العرض الحالي';}
  $('activity-status').textContent=status;
  $('phys-play').textContent=physiology.running?'Ⅱ إيقاف المحاكاة':'▶ متابعة المحاكاة';$('phys-play').setAttribute('aria-pressed',String(physiology.running));
  canvas.dataset.processes=active.join(',');canvas.dataset.physiologyRunning=String(physiology.running&&!reduced.matches&&!combat.enabled);
}
function setCombat(value){
  if(!ready||value===combat.enabled)return;
  if(value){
    combatSnapshot={mode,opacity:$('opacity').value};setAuto(false);setMode('surface');combat.setEnabled(true);
    combat.targetYaw=azimuth;focusTarget.set(0,0,0);distance=fitDistance;
  }else{
    combat.setEnabled(false);
    if(combatSnapshot){const snapshot=combatSnapshot;combatSnapshot=null;setMode(snapshot.mode);$('opacity').value=snapshot.opacity;$('opacity-value').textContent=snapshot.opacity+'%';}
  }
  stage.classList.toggle('combat-active',value);$('combat-toggle').setAttribute('aria-pressed',String(value));$('combat-quick').setAttribute('aria-pressed',String(value));
  $('combat-toggle').textContent=value?'إيقاف القتال والعودة للتشريح':'تفعيل وضع القتال';$('combat-quick').textContent=value?'↩ العودة للتشريح':'⚡ وضع القتال';
  $('combat-strike').disabled=!value;$('focus').disabled=value;$('isolate').disabled=value;$('opacity').disabled=value||mode==='internal';
  $('combat-target').classList.remove('visible');
  $('interaction-hint').textContent=value?'حرّك المؤشر للمواجهة · انقر للهجوم · Enter للهجوم · Esc للعودة':'اسحب للتدوير · مرّر للتقريب · انقر على عضو لاستكشافه';
  canvas.setAttribute('aria-label',value?'وضع القتال. حرّك المؤشر للمواجهة وانقر للهجوم. Enter للهجوم وEscape للعودة إلى التشريح.':'مجسم عقرب ثلاثي الأبعاد. اسحب للتدوير، عجلة الفأرة للتقريب، مفاتيح الأسهم للتدوير، وزائد وناقص للتقريب.');
  canvas.dataset.combat=String(value);$('view-title').textContent=value?'وضع المواجهة':displayTitles[mode];updateVisibility();
}
function strike(){if(combat?.strike())canvas.dataset.attacks=String(Number(canvas.dataset.attacks||0)+1);}
function combatPointer(event){
  if(!combat?.enabled)return;
  const r=canvas.getBoundingClientRect();pointer.set((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);
  const point=new THREE.Vector3(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),-combat.origin.y);
  if(raycaster.ray.intersectPlane(plane,point))combat.face(point);
  const reticle=$('combat-target');reticle.style.left=(event.clientX-r.left)+'px';reticle.style.top=(event.clientY-r.top)+'px';reticle.classList.add('visible');
}
for(const input of document.querySelectorAll('[data-process]'))input.onchange=()=>{
  if(!ready)return;if(combat.enabled)setCombat(false);
  physiology.setEnabled(input.dataset.process,input.checked);
  if(input.checked){$('isolate').checked=false;select(input.dataset.process);if(['surface','inner'].includes(mode))setMode('transparent');}
  updateVisibility();
};
$('phys-play').onclick=()=>{if(!ready)return;physiology.running=!physiology.running;updateActivity();};
$('phys-all').onclick=()=>{if(!ready)return;if(combat.enabled)setCombat(false);$('isolate').checked=false;for(const input of document.querySelectorAll('[data-process]')){input.checked=true;physiology.setEnabled(input.dataset.process,true);}setMode('transparent');physiology.running=true;updateVisibility();};
$('phys-speed').oninput=()=>{if(!ready)return;physiology.speed=Number($('phys-speed').value)/100;$('speed-value').textContent=physiology.speed+'×';updateActivity();};
$('combat-toggle').onclick=$('combat-quick').onclick=()=>setCombat(!combat?.enabled);$('combat-strike').onclick=strike;
document.querySelectorAll('button[data-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>preset(b.dataset.view));
$('opacity').oninput=()=>{const value=Number($('opacity').value);$('opacity-value').textContent=value+'%';updateVisibility();};
$('cut').oninput=()=>{const v=Number($('cut').value);$('cut-value').textContent=v+'%';cutPlane.constant=(v/100-.5)*1.3;};
$('isolate').onchange=updateVisibility;
$('zoom-in').onclick=()=>distance=Math.max(.35,distance*.82);$('zoom-out').onclick=()=>distance=Math.min(8,distance/ .82);
function setAuto(value){auto=value;$('spin').setAttribute('aria-pressed',String(auto));}
$('spin').onclick=()=>{if(combat?.enabled)setCombat(false);setAuto(!auto);};reduced.addEventListener('change',e=>{if(e.matches)setAuto(false);updateActivity();});
$('reset').onclick=()=>{if(!ready)return;if(combat.enabled)setCombat(false);physiology.reset();document.querySelectorAll('[data-process]').forEach(input=>input.checked=false);$('phys-speed').value=100;$('speed-value').textContent='1×';setAuto(false);preset('perspective');$('isolate').checked=false;$('show-labels').checked=true;$('cut').value=50;$('cut-value').textContent='50%';cutPlane.constant=0;select('shell');setMode('surface');};
$('focus').onclick=()=>{if(!ready)return;focusTarget.copy(worldPoint(systems[selected].point));distance=selected==='shell'?2.8:selected==='venom'?.55:1.15;if(selected!=='shell'&&mode==='surface')setMode('transparent');};
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await stage.requestFullscreen();}catch{$('load-status').hidden=false;$('load-status').textContent='ملء الشاشة غير متاح في هذا المتصفح؛ يمكنك تكبير نافذة العارض.';}};
$('download-model').onclick=()=>{
  if(!ready)return;
  // Download the aligned anatomy in its bind pose, without the temporary particles.
  combat.restore();physiology.update(0,true);
  const bytes=exportAnatomyGLB(specimen),url=URL.createObjectURL(new Blob([bytes],{type:'model/gltf-binary'}));
  const link=document.createElement('a');link.href=url;link.download='scorpion-anatomy-educational.glb';link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
};
const pointers=new Map();let down=null,dragDistance=0,pinch=0;
canvas.addEventListener('pointerdown',e=>{pointers.set(e.pointerId,[e.clientX,e.clientY]);canvas.setPointerCapture(e.pointerId);down=[e.clientX,e.clientY];dragDistance=0;if(pointers.size===2){const p=[...pointers.values()];pinch=Math.hypot(p[0][0]-p[1][0],p[0][1]-p[1][1]);}});
canvas.addEventListener('pointermove',e=>{
  combatPointer(e);if(!pointers.has(e.pointerId))return;const previous=pointers.get(e.pointerId);pointers.set(e.pointerId,[e.clientX,e.clientY]);
  if(pointers.size===2){const p=[...pointers.values()],next=Math.hypot(p[0][0]-p[1][0],p[0][1]-p[1][1]);if(next>0&&pinch>0)distance=THREE.MathUtils.clamp(distance*pinch/next,.35,8);pinch=next;dragDistance=100;return;}
  const dx=e.clientX-previous[0],dy=e.clientY-previous[1];if(!combat?.enabled){azimuth-=dx*.008;polar=THREE.MathUtils.clamp(polar-dy*.008,.03,Math.PI-.03);}dragDistance+=Math.abs(dx)+Math.abs(dy);
});
canvas.addEventListener('pointerup',e=>{
  if(ready&&down&&dragDistance<7&&combat.enabled){combatPointer(e);strike();}
  else if(ready&&down&&dragDistance<7&&organs.visible){const r=canvas.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);const hits=raycaster.intersectObjects(Object.values(groups).filter(g=>g.visible),true).filter(hit=>!hit.object.userData.transient);if(hits[0]){let o=hits[0].object;while(o.parent!==organs)o=o.parent;select(o.name);}}
  pointers.delete(e.pointerId);down=null;
});
canvas.addEventListener('pointercancel',e=>pointers.delete(e.pointerId));canvas.addEventListener('lostpointercapture',e=>pointers.delete(e.pointerId));
canvas.addEventListener('pointerleave',()=>$('combat-target').classList.remove('visible'));
canvas.addEventListener('wheel',e=>{e.preventDefault();distance=THREE.MathUtils.clamp(distance*Math.exp(e.deltaY*.001),.35,8);},{passive:false});
canvas.addEventListener('keydown',e=>{if(combat?.enabled&&['Enter',' ','Escape'].includes(e.key)){e.preventDefault();if(e.key==='Escape')setCombat(false);else strike();return;}if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','Home'].includes(e.key))e.preventDefault();if(e.key==='ArrowLeft')azimuth-=.12;if(e.key==='ArrowRight')azimuth+=.12;if(e.key==='ArrowUp')polar=Math.max(.03,polar-.12);if(e.key==='ArrowDown')polar=Math.min(Math.PI-.03,polar+.12);if(e.key==='+'||e.key==='=')distance=Math.max(.35,distance*.85);if(e.key==='-')distance=Math.min(8,distance/ .85);if(e.key==='Home')preset('perspective');});
new ResizeObserver(resize).observe(stage);select('shell');init();

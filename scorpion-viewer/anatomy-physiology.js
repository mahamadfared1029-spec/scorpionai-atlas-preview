import * as THREE from './assets/vendor/three.module.js';

export const processInfo={
  heart:{label:'دوران مفتوح · هيمولِمف',color:'#f78d87'},
  venom:{label:'دفعات سم توضيحية',color:'#d8a9ff'},
  lungs:{label:'تبادل غازات',color:'#a9e7b1'},
  nerves:{label:'إشارات عصبية',color:'#8ed8ff'},
  digestive:{label:'انتقال غذاء',color:'#ffe09c'}
};

export class Physiology {
  constructor(groups){
    this.enabled=new Set();this.running=true;this.time=0;this.speed=1;this.tracks=[];this.groups=groups;this.starts={};
    const sphere=new THREE.SphereGeometry(1,8,6),dummy=new THREE.Object3D();this.dummy=dummy;
    const add=(key,points,count,radius,duration)=>{
      const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
      const material=new THREE.MeshStandardMaterial({color:processInfo[key].color,emissive:processInfo[key].color,emissiveIntensity:1.4,roughness:.25});
      const mesh=new THREE.InstancedMesh(sphere,material,count);mesh.userData.transient=true;mesh.name='illustrative-flow-'+key;mesh.frustumCulled=false;mesh.visible=false;
      groups[key].add(mesh);this.tracks.push({key,curve,mesh,count,radius,duration});
    };
    // A schematic anterior stream and lateral delivery branches, not a closed vessel loop.
    add('heart',[[0,.076,-.145],[0,.074,-.10],[0,.068,-.06],[0,.064,-.025],[0,.060,.005],[0,.047,.035]],12,.0017,3.4);
    for(let i=0;i<7;i++)for(const s of [-1,1]){const z=-.035-i*.015,y=.065+i*.0016;add('heart',[[0,y,z],[s*.012,y-.005,z-.004],[s*.026,y-.018,z-.01]],2,.0011,1.9);}
    for(const s of [-1,1]){
      add('heart',[[s*.027,.031,-.09],[s*.031,.047,-.09],[s*.015,.071,-.09],[0,.074,-.09]],3,.0012,2.6);
      add('venom',[[s*.005,.247,-.198],[s*.003,.244,-.177],[s*.0015,.224,-.145],[s*.001,.202,-.123]],8,.0015,1.15);
    }
    add('digestive',[[0,.043,.048],[0,.044,.018],[0,.046,-.015],[0,.049,-.055],[0,.055,-.10],[0,.063,-.15],[0,.078,-.18],[0,.102,-.214],[0,.14,-.238],[0,.181,-.24],[0,.216,-.227]],9,.0016,8);
    add('nerves',[[0,.035,.03],[0,.029,-.02],[0,.033,-.065],[0,.040,-.11],[0,.050,-.15]],7,.0014,1.7);
    for(let i=0;i<4;i++)for(const s of [-1,1]){
      const z=-.045-i*.025,x=s*(.025-i*.002),y=.027+i*.004;
      add('lungs',[[x,y-.006,z+.006],[x,y,z],[x,y+.007,z-.004]],3,.0011,2.8);
    }
    this.pulses=[];this.tissues=[];
    for(const [key,group] of Object.entries(groups))group.traverse(mesh=>{if(mesh.userData.pulse)this.pulses.push({mesh,key,scale:mesh.scale.clone()});if(mesh.isMesh&&!mesh.userData.transient)this.tissues.push({mesh,key});});
  }
  setEnabled(key,value){if(value){if(!this.enabled.has(key))this.starts[key]=this.time;this.enabled.add(key);}else this.enabled.delete(key);}
  reset(){this.enabled.clear();this.time=0;this.running=true;this.speed=1;this.update(0);}
  update(dt,suspended=false){
    if(this.running&&!suspended)this.time+=dt*this.speed;
    for(const {mesh,key} of this.tissues){
      const translucent=!suspended&&this.enabled.has(key),m=mesh.material;
      if(m.transparent!==translucent)m.needsUpdate=true;
      m.transparent=translucent;m.opacity=translucent?(mesh.userData.flowTube?.28:.65):1;m.depthWrite=!translucent;
    }
    for(const track of this.tracks){
      const {mesh,key,count,curve,radius,duration}=track;
      const elapsed=this.time-(this.starts[key]||0),venomWindow=elapsed%5;
      mesh.visible=!suspended&&this.enabled.has(key)&&(key!=='venom'||venomWindow<1.5);
      if(!mesh.visible)continue;
      for(let i=0;i<count;i++){
        const phase=key==='venom'?(venomWindow/duration-i*.075):(elapsed/duration+i/count)%1;
        this.dummy.position.copy(curve.getPointAt(Math.max(0,Math.min(1,phase))));
        this.dummy.scale.setScalar(key==='venom'&&(phase<0||phase>1)?0:radius);this.dummy.updateMatrix();mesh.setMatrixAt(i,this.dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate=true;
    }
    for(const {mesh,key,scale} of this.pulses){
      const enabled=!suspended&&this.enabled.has(key);
      const elapsed=this.time-(this.starts[key]||0);
      const pulse=enabled?(key==='venom'?(elapsed%5<1.5?Math.sin(Math.PI*Math.min(1,elapsed%5/1.5)):0):.5+.5*Math.sin(elapsed*Math.PI*2*1.1)):0;
      mesh.scale.copy(scale);if(key==='heart')mesh.scale.x*=1+pulse*.12;if(key==='venom')mesh.scale.multiplyScalar(1-pulse*.07);
      mesh.material.emissiveIntensity=enabled?.1+pulse*.6:(mesh.userData.selected?.16:.025);
    }
  }
}

import * as THREE from './assets/vendor/three.module.js';

export class ScorpionCombat {
  constructor(shell,actor){
    this.actor=actor;this.enabled=false;this.attackAge=2;this.targetYaw=0;this.time=0;this.rig=[];
    this.origin=actor.position.clone();this.direction=new THREE.Vector3(0,0,1);this.quaternion=new THREE.Quaternion();
    this.x=new THREE.Vector3(1,0,0);this.z=new THREE.Vector3(0,0,1);
    shell.traverse(bone=>{if(bone.isBone&&/Sting_01_0[2-6]|Claw_0[12]_01|Pedipalp_01_0[23]|Leg_Hip/.test(bone.name))this.rig.push({bone,base:bone.quaternion.clone()});});
  }
  setEnabled(value){this.enabled=value;this.attackAge=2;if(!value)this.restore();}
  face(point){const dx=point.x-this.origin.x,dz=point.z-this.origin.z;if(Math.hypot(dx,dz)>.05)this.targetYaw=Math.atan2(dx,dz);}
  strike(){if(this.enabled&&this.attackAge>.95){this.attackAge=0;return true;}return false;}
  restore(){for(const {bone,base} of this.rig)bone.quaternion.copy(base);this.actor.rotation.set(0,0,0);this.actor.position.copy(this.origin);}
  update(dt,reduced=false){
    if(!this.enabled)return;
    this.time+=dt;this.attackAge+=dt;
    const turn=Math.atan2(Math.sin(this.targetYaw-this.actor.rotation.y),Math.cos(this.targetYaw-this.actor.rotation.y));
    this.actor.rotation.y+=turn*(reduced?1:1-Math.exp(-dt*8));
    const strike=!reduced&&this.attackAge<1?Math.sin(Math.PI*this.attackAge)**2:0;
    const breathe=reduced?0:Math.sin(this.time*5)*.018;
    for(const {bone,base} of this.rig){
      bone.quaternion.copy(base);const name=bone.name;let angle=0,axis=this.z;
      const side=name.includes('_l_')?1:-1;
      if(name.includes('Sting')){axis=this.x;angle=-.055-strike*.33+breathe*.25;}
      else if(name.includes('Claw'))angle=side*(name.includes('Claw_01')?1:-1)*(.16+breathe+strike*.48);
      else if(name.includes('Pedipalp'))angle=side*(.08+strike*.22);
      else if(name.includes('Leg_Hip'))angle=side*(.018+(reduced?0:Math.sin(this.time*7+bone.id)*.025)*strike);
      bone.quaternion.multiply(this.quaternion.setFromAxisAngle(axis,angle));
    }
    this.direction.set(Math.sin(this.actor.rotation.y),0,Math.cos(this.actor.rotation.y));
    this.actor.position.copy(this.origin).addScaledVector(this.direction,strike*.12);this.actor.position.y+=strike*.035;
  }
}

import * as THREE from './assets/vendor/three.module.js';

// Export all anatomy, including hidden systems, as named static GLB meshes.
export function exportAnatomyGLB(root) {
  root.updateMatrixWorld(true);
  const doc={asset:{version:'2.0',generator:'Scorpion X Anatomy Atlas'},scene:0,scenes:[{nodes:[]}],nodes:[],meshes:[],materials:[],accessors:[],bufferViews:[],buffers:[]};
  const chunks=[];let length=0;
  function accessor(array,componentType,type,count,target,min,max){
    const padding=(4-length%4)%4;if(padding){chunks.push(new Uint8Array(padding));length+=padding;}
    const bytes=new Uint8Array(array.buffer,array.byteOffset,array.byteLength);
    const view=doc.bufferViews.push({buffer:0,byteOffset:length,byteLength:bytes.length,target})-1;chunks.push(bytes);length+=bytes.length;
    const data={bufferView:view,componentType,type,count};if(min)data.min=min;if(max)data.max=max;
    return doc.accessors.push(data)-1;
  }
  root.traverse(object=>{
    if(!object.isMesh||object.userData.transient)return;
    const geometry=object.geometry.clone();const pos=geometry.getAttribute('position');
    if(object.isSkinnedMesh){const vertex=new THREE.Vector3();for(let i=0;i<pos.count;i++){object.getVertexPosition(i,vertex);pos.setXYZ(i,vertex.x,vertex.y,vertex.z);}}
    geometry.applyMatrix4(object.matrixWorld);geometry.computeVertexNormals();geometry.computeBoundingBox();
    const positions=new Float32Array(geometry.getAttribute('position').array),normals=new Float32Array(geometry.getAttribute('normal').array),box=geometry.boundingBox;
    const attributes={POSITION:accessor(positions,5126,'VEC3',pos.count,34962,box.min.toArray(),box.max.toArray()),NORMAL:accessor(normals,5126,'VEC3',pos.count,34962)};
    const source=Array.isArray(object.material)?object.material[0]:object.material;
    const c=source.color||new THREE.Color(0xffffff);
    const materialIndex=doc.materials.push({name:object.parent?.name||'Exoskeleton',doubleSided:true,pbrMetallicRoughness:{baseColorFactor:[c.r,c.g,c.b,1],metallicFactor:source.metalness??0,roughnessFactor:source.roughness??.5}})-1;
    const primitive={attributes,material:materialIndex};
    if(geometry.index){const index=new Uint32Array(geometry.index.array);primitive.indices=accessor(index,5125,'SCALAR',index.length,34963);}
    const meshIndex=doc.meshes.push({name:object.name||object.parent?.name||'Anatomy',primitives:[primitive]})-1;
    const nodeIndex=doc.nodes.push({name:object.name||object.parent?.name||'Anatomy',mesh:meshIndex})-1;doc.scenes[0].nodes.push(nodeIndex);geometry.dispose();
  });
  doc.buffers.push({byteLength:length});
  const json=new TextEncoder().encode(JSON.stringify(doc));const jsonLength=Math.ceil(json.length/4)*4,binLength=Math.ceil(length/4)*4;
  const bytes=new Uint8Array(12+8+jsonLength+8+binLength);const header=new DataView(bytes.buffer);
  header.setUint32(0,0x46546c67,true);header.setUint32(4,2,true);header.setUint32(8,bytes.length,true);
  header.setUint32(12,jsonLength,true);header.setUint32(16,0x4e4f534a,true);bytes.fill(32,20,20+jsonLength);bytes.set(json,20);
  const binStart=20+jsonLength;header.setUint32(binStart,binLength,true);header.setUint32(binStart+4,0x004e4942,true);
  let offset=binStart+8;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  return bytes;
}

import { useGSAP } from '@gsap/react';
import { useGLTF, OrbitControls, Environment } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import React, { PropsWithChildren, Suspense, useEffect, useMemo, useRef } from 'react';
import * as THREE from "three"
import { mergeBufferGeometries } from 'three-stdlib';
import gsap from "gsap"

const Scene = () => {
   const { scene } = useGLTF("/plus.glb")
   const tl = useRef<gsap.core.Timeline | null>(null)
   const meshRef = useRef<THREE.Mesh>(null);
   const quaternion = new THREE.Quaternion();
   const crossBasePosition = useRef<Float32Array | null>(null);
   const prevRotation = useRef<THREE.Euler | null>(null);
   const mergedGeometry = useMemo(() => {
      const geometries: THREE.BufferGeometry[] = []

      scene.traverse((child: any) => {
         if (child.isMesh) {
            child.updateMatrixWorld(true)
            const cloned = child.geometry.clone()
            cloned.applyMatrix4(child.matrixWorld)
            geometries.push(cloned)
         }
      })

      let merged = mergeBufferGeometries(geometries, true)
      if (!merged) return null
      merged = merged.toNonIndexed()

      // const pos = merged.attributes.position.array
      // const centers = []

      // for (let i = 0; i < pos.length; i += 9) {
      //    const cx = (pos[i] + pos[i + 3] + pos[i + 6]) / 3
      //    const cy = (pos[i + 1] + pos[i + 4] + pos[i + 7]) / 3
      //    const cz = (pos[i + 2] + pos[i + 5] + pos[i + 8]) / 3
      //    centers.push(cx, cy, cz, cx, cy, cz, cx, cy, cz)
      // }      // merged.setAttribute('center', new THREE.BufferAttribute(new Float32Array(centers), 3))
      merged.scale(100, 100, 100);

      // Calculate bounding box to get height
      merged.computeBoundingBox();
      const boundingBox = merged.boundingBox!;
      const height = boundingBox.max.y - boundingBox.min.y;

      // Lower the model by half its height
      merged.translate(0, -height / 2, 0);

      return merged
   }, [scene])

   useEffect(() => {
      if (meshRef.current) {
         // Store a copy of the original position data, not a reference
         const positionArray = meshRef.current.geometry.attributes.position.array;
         crossBasePosition.current = new Float32Array(positionArray);
      }
   }, [])

   function twistCross(angle: number) {
      if (meshRef.current && crossBasePosition.current) {
         const currentPositions = meshRef.current.geometry.attributes.position;
         const originalPositionsArray = crossBasePosition.current; // Use the stored base positions

         // Calculate the height range for proper twist calculation
         const geometry = meshRef.current.geometry;
         geometry.computeBoundingBox();
         const boundingBox = geometry.boundingBox!;
         const minY = boundingBox.min.y;
         const maxY = boundingBox.max.y;
         const totalHeight = maxY - minY;

         // Go through each vector (series of 3 values) and modify the values
         for (let i = 0; i < originalPositionsArray.length; i = i + 3) {
            const modifiedPositionVector = new THREE.Vector3(
               originalPositionsArray[i],
               originalPositionsArray[i + 1],
               originalPositionsArray[i + 2]
            );

            const preRotation = new THREE.Quaternion();
            preRotation.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 4); // 45 degrees around X-axis
            modifiedPositionVector.applyQuaternion(preRotation);

            const upVector = new THREE.Vector3(0, 1, 0); // Y-axis (vertical)

            // Calculate normalized height (0 to 1) from bottom to top
            const normalizedHeight = (modifiedPositionVector.y - minY) / totalHeight;

            // For exactly one full rotation (360°), use:
            const rotationAngle = normalizedHeight * Math.PI * angle;

            // Rotate along the y axis (0, 1, 0)
            quaternion.setFromAxisAngle(upVector, rotationAngle);
            modifiedPositionVector.applyQuaternion(quaternion);

            const postRotation = new THREE.Quaternion();
            postRotation.setFromAxisAngle(new THREE.Vector3(0, 0, 1), - Math.PI / 4); // 45 degrees around X-axis
            modifiedPositionVector.applyQuaternion(postRotation);

            // Apply the modified position vector coordinates to the current position attributes array
            currentPositions.array[i] = modifiedPositionVector.x;
            currentPositions.array[i + 1] = modifiedPositionVector.y;
            currentPositions.array[i + 2] = modifiedPositionVector.z;
         }
         // Set the needsUpdate flag to "true"
         currentPositions.needsUpdate = true;
      }
   }
   //  const preRotation = new THREE.Quaternion();
   //       preRotation.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 4); // 45 degrees around X-axis
   //       modifiedPositionVector.applyQuaternion(preRotation);
   function rotateModel(angleX: number = 0, angleY: number = 0, angleZ: number = 0) {
      if (meshRef.current) {
         // Reset rotation first
         meshRef.current.rotation.set(0, 0, 0);


         // Apply rotations
         meshRef.current.rotation.x = angleX;
         meshRef.current.rotation.y = angleY;
         meshRef.current.rotation.z = angleZ;

      }
   }

   function rotateModelOnAxis(axis: THREE.Vector3, angle: number) {
      if (meshRef.current) {
         // meshRef.current.rotation.set(0, 0, 0);
         meshRef.current.rotation.set(prevRotation.current?.x || 0, prevRotation.current?.y || 0, prevRotation.current?.z || 0)

         meshRef.current.rotateOnAxis(axis, angle);
      }
   }

   useGSAP(() => {
      tl.current = gsap.timeline({ paused: true, repeat: -1 })
      tl.current
         // * One rotation
         .add("first")
         .to({ value: 0 }, {
            value: 0.5,
            duration: 0.5,
            ease: "power2.inOut",
            onUpdate: function () {
               twistCross(this.targets()[0].value);
            }
         }, "first")
         .to({ value: 0 }, {
            value: Math.PI, // Math.PI
            duration: 1,
            ease: "power2.inOut",
            onUpdate: function () {
               rotateModelOnAxis(new THREE.Vector3(1, 1, 0).normalize(), this.targets()[0].value);
            },
            onComplete: function () {
               if (meshRef.current) {
                  // Store a copy of the current position
                  prevRotation.current = meshRef.current.rotation.clone();
               }
            }
         }, "first")
         .to({ value: 0.5 }, {
            value: 0,
            delay: 0.5,
            duration: 0.5,
            ease: "power2.inOut",
            onUpdate: function () {
               twistCross(this.targets()[0].value);
            }
         }, "first")
      //  * Two rotations
      // .add("first")
      // .to({ value: 0 }, {
      //    value: 1,
      //    duration: 0.5,
      //    ease: "power2.inOut",
      //    onUpdate: function () {
      //       twistCross(this.targets()[0].value);
      //    }
      // }, "first")
      // .to({ value: 0 }, {
      //    value: Math.PI * 2, // Math.PI
      //    duration: 1,
      //    ease: "power2.inOut",
      //    onUpdate: function () {
      //       rotateModelOnAxis(new THREE.Vector3(1, 1, 0).normalize(), this.targets()[0].value);
      //    },
      //    onComplete: function () {
      //       if (meshRef.current) {
      //          // Store a copy of the current position
      //          prevRotation.current = meshRef.current.rotation.clone();
      //       }
      //    }
      // }, "first")
      // .to({ value: 1 }, {
      //    value: 0,
      //    delay: 0.5,
      //    duration: 0.5,
      //    ease: "power2.inOut",
      //    onUpdate: function () {
      //       twistCross(this.targets()[0].value);
      //    }
      // }, "first")
      tl.current.play()
   })

   return (
      <>
         <OrbitControls />
         {/* <directionalLight intensity={3} position={[2, 3, 2]} /> */}
         <directionalLight intensity={10} position={[5, -7, 2]} />
         {/* @ts-ignore */}
         {/* <directionalLight intensity={0.7} decay={2} rotation={[-0.506, 0.629, 0.756]} /> */}
         <mesh ref={meshRef} geometry={mergedGeometry!} castShadow receiveShadow>
            {/* <boxGeometry /> */}
            <meshStandardMaterial roughness={0.05} color={"#000000"} />
         </mesh>
         {/* <ambientLight intensity={100} /> */}
         <Environment preset='warehouse' />
      </>
   );
};

const Wrapper = (props: PropsWithChildren) => {
   return (
      <Suspense fallback={null}>
         <Canvas>
            <Scene />
         </Canvas>
      </Suspense >
   );
}

export default Wrapper;

useGLTF.preload("/plus.glb")
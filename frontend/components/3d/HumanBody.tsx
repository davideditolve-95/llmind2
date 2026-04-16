'use client';

import React, { useRef, useState, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Float, ContactShadows, Text, MeshDistortMaterial, PresentationControls } from '@react-three/drei';
import * as THREE from 'three';

interface BodyPartProps {
  position: [number, number, number];
  args: any;
  color: string;
  hoverColor: string;
  label: string;
  chapterCode: string;
  onClick: (code: string, label: string) => void;
  type: 'sphere' | 'capsule';
  rotation?: [number, number, number];
}

function BodyPart({ position, args, color, hoverColor, label, chapterCode, onClick, type, rotation = [0, 0, 0] }: BodyPartProps) {
  const [hovered, setHovered] = useState(false);
  const meshRef = useRef<THREE.Mesh>(null!);
  const materialRef = useRef<any>(null!);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (hovered) {
      meshRef.current.scale.lerp(new THREE.Vector3(1.05, 1.05, 1.05), 0.15);
      if (materialRef.current) {
        materialRef.current.emissiveIntensity = 0.6 + Math.sin(t * 10) * 0.4;
      }
    } else {
      meshRef.current.scale.lerp(new THREE.Vector3(1, 1, 1), 0.1);
      if (materialRef.current) {
        materialRef.current.emissiveIntensity = 0.2;
      }
    }
  });

  return (
    <group position={position} rotation={rotation}>
      <mesh
        ref={meshRef}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = 'default'; }}
        onClick={(e) => { e.stopPropagation(); onClick(chapterCode, label); }}
        castShadow
      >
        {type === 'sphere' && <sphereGeometry args={args} />}
        {type === 'capsule' && <capsuleGeometry args={args} />}
        
        <meshPhysicalMaterial
          ref={materialRef}
          color={hovered ? hoverColor : color}
          emissive={hovered ? hoverColor : color}
          emissiveIntensity={0.2}
          transparent
          opacity={hovered ? 0.98 : 0.6}
          transmission={0.4}
          thickness={0.5}
          roughness={0.1}
          metalness={0.15}
          clearcoat={1}
        />
      </mesh>
      
      {hovered && (
        <Text
          position={[0, type === 'capsule' ? args[1] / 2 + 0.6 : args[0] + 0.6, 0.5]}
          fontSize={0.24}
          color="#1e293b"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="#ffffff"
        >
          {label}
        </Text>
      )}
    </group>
  );
}

interface HumanBodyProps {
  onSelectChapter: (code: string, label: string) => void;
}

export default function HumanBody({ onSelectChapter }: HumanBodyProps) {
  return (
    <div className="anatomical-canvas-container group w-full h-full min-h-[500px] relative">
      <Canvas shadows gl={{ antialias: true, alpha: true }}>
        <PerspectiveCamera makeDefault position={[0, 1, 8.5]} fov={33} />
        
        <ambientLight intensity={0.5} />
        <spotLight position={[10, 20, 10]} angle={0.15} penumbra={1} intensity={3} castShadow />
        <pointLight position={[-10, 5, -5]} intensity={1.5} color="#61a0ff" />
        <pointLight position={[10, -5, 5]} intensity={1.2} color="#4ade80" />
        <directionalLight position={[0, 5, 5]} intensity={0.7} color="#ffffff" />

        <PresentationControls
          global
          snap
          rotation={[0, 0, 0]}
          polar={[-Math.PI / 3, Math.PI / 3]}
          azimuth={[-Math.PI / 1.4, Math.PI / 1.4]}
        >
          <Float speed={2} rotationIntensity={0.2} floatIntensity={0.5}>
            <group position={[0, -2.1, 0]}>
              
              {/* Testa e Collo */}
              <BodyPart
                type="sphere"
                position={[0, 4.6, 0]}
                args={[0.38, 32, 32]}
                color="#e2e8f0"
                hoverColor="#60a5fa" 
                label="Neurological & Mental (06, 08)"
                chapterCode="06"
                onClick={onSelectChapter}
              />
              <BodyPart
                type="capsule"
                position={[0, 4.15, 0]}
                args={[0.12, 0.4]}
                color="#f8fafc"
                hoverColor="#94a3b8" 
                label="Neck / Thyroid"
                chapterCode="05"
                onClick={onSelectChapter}
              />

              {/* Torace e Addome */}
              <BodyPart
                type="capsule"
                position={[0, 3.2, 0]}
                args={[0.55, 1.2]}
                rotation={[0, 0, Math.PI / 2]}
                color="#f1f5f9"
                hoverColor="#f43f5e"
                label="Circulatory & Respiratory (11, 12)"
                chapterCode="11"
                onClick={onSelectChapter}
              />

              <BodyPart
                type="capsule"
                position={[0, 2.1, 0]}
                args={[0.48, 0.8]}
                color="#ffffff"
                hoverColor="#10b981"
                label="Digestive System (13)"
                chapterCode="13"
                onClick={onSelectChapter}
              />

              <BodyPart
                type="capsule"
                position={[0, 1.3, 0]}
                args={[0.42, 0.45]}
                rotation={[0, 0, Math.PI / 2]}
                color="#f1f5f9"
                hoverColor="#8b5cf6"
                label="Genitourinary (16)"
                chapterCode="16"
                onClick={onSelectChapter}
              />

              {/* Braccia e Mani */}
              <group>
                {/* Braccio Sinistro */}
                <BodyPart
                  type="capsule"
                  position={[-0.9, 3.0, 0]}
                  args={[0.12, 1.8]}
                  rotation={[0, 0, 0.2]}
                  color="#f8fafc"
                  hoverColor="#64748b"
                  label="Musculoskeletal: Upper (15)"
                  chapterCode="15"
                  onClick={onSelectChapter}
                />
                <BodyPart
                  type="sphere"
                  position={[-1.1, 2.0, 0]}
                  args={[0.14, 16, 16]}
                  color="#f1f5f9"
                  hoverColor="#3b82f6"
                  label="Hands & Joints"
                  chapterCode="15"
                  onClick={onSelectChapter}
                />
                
                {/* Braccio Destro */}
                <BodyPart
                  type="capsule"
                  position={[0.9, 3.0, 0]}
                  args={[0.12, 1.8]}
                  rotation={[0, 0, -0.2]}
                  color="#f8fafc"
                  hoverColor="#64748b"
                  label="Musculoskeletal: Upper (15)"
                  chapterCode="15"
                  onClick={onSelectChapter}
                />
                <BodyPart
                  type="sphere"
                  position={[1.1, 2.0, 0]}
                  args={[0.14, 16, 16]}
                  color="#f1f5f9"
                  hoverColor="#3b82f6"
                  label="Hands & Joints"
                  chapterCode="15"
                  onClick={onSelectChapter}
                />
              </group>

              {/* Gambe e Piedi */}
              <group>
                {/* Gamba Sinistra */}
                <BodyPart
                  type="capsule"
                  position={[-0.4, 0.2, 0]}
                  args={[0.18, 2.0]}
                  color="#f8fafc"
                  hoverColor="#64748b"
                  label="Musculoskeletal: Lower (15)"
                  chapterCode="15"
                  onClick={onSelectChapter}
                />
                <BodyPart
                  type="capsule"
                  position={[-0.4, -0.9, 0]}
                  args={[0.14, 0.4]}
                  rotation={[Math.PI / 2, 0, 0]}
                  color="#f1f5f9"
                  hoverColor="#3b82f6"
                  label="Feet & Ankles"
                  chapterCode="15"
                  onClick={onSelectChapter}
                />

                {/* Gamba Destra */}
                <BodyPart
                  type="capsule"
                  position={[0.4, 0.2, 0]}
                  args={[0.18, 2.0]}
                  color="#f8fafc"
                  hoverColor="#64748b"
                  label="Musculoskeletal: Lower (15)"
                  chapterCode="15"
                  onClick={onSelectChapter}
                />
                <BodyPart
                  type="capsule"
                  position={[0.4, -0.9, 0]}
                  args={[0.14, 0.4]}
                  rotation={[Math.PI / 2, 0, 0]}
                  color="#f1f5f9"
                  hoverColor="#3b82f6"
                  label="Feet & Ankles"
                  chapterCode="15"
                  onClick={onSelectChapter}
                />
              </group>
            </group>
          </Float>
        </PresentationControls>

        <ContactShadows position={[0, -3.2, 0]} opacity={0.4} scale={12} blur={2} far={4} color="#000000" />
      </Canvas>

      <div className="absolute top-6 right-6 p-5 bg-white/40 backdrop-blur-xl rounded-[2rem] pointer-events-none opacity-0 group-hover:opacity-100 transition-all duration-700 max-w-[200px] border border-white/60 shadow-2xl">
        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-800 mb-2">Clinical Bio-Link</h4>
        <p className="text-[11px] font-medium text-slate-600 leading-relaxed">
          Select an anatomical region to synchronize diagnostic identifiers.
        </p>
      </div>

      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 px-6 py-3 bg-slate-900/10 backdrop-blur-md rounded-full flex gap-6 items-center border border-white/20 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-sage-500 animate-pulse-glow" />
          <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Digital Twin Active</span>
        </div>
        <div className="h-4 w-px bg-slate-300/40" />
        <span className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">360° Inspection Ready</span>
      </div>
    </div>
  );
}

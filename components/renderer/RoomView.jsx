'use client'

import { useRef, Suspense, useCallback, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Grid, Html } from '@react-three/drei'
import * as THREE from 'three'
import { useAudio } from '@/context/AudioContext'
import RoomMinimap from './RoomMinimap'

function RoomWireframe() {
  return (
    <lineSegments>
      <edgesGeometry args={[new THREE.BoxGeometry(10, 6, 10)]} />
      <lineBasicMaterial color="#2a2a2a" />
    </lineSegments>
  )
}

function SpeakerMesh({ speaker }) {
  const isOverhead = speaker.y > 0
  return (
    <group position={[speaker.x, speaker.y, speaker.z]}>
      <mesh rotation={[Math.PI / 2, 0, (speaker.angle * Math.PI) / 180]}>
        <coneGeometry args={[0.14, 0.32, 8]} />
        <meshStandardMaterial
          color={isOverhead ? '#3a3a3a' : '#555555'}
          emissive={isOverhead ? '#1a1a1a' : '#222222'}
        />
      </mesh>
      <Html center distanceFactor={10} style={{ pointerEvents: 'none' }}>
        <div style={{
          color: isOverhead ? '#4a4a4a' : '#737373',
          fontSize: '9px',
          whiteSpace: 'nowrap',
          fontFamily: 'monospace',
          textShadow: '0 0 4px #000',
        }}>
          {speaker.label}
        </div>
      </Html>
    </group>
  )
}

const DRAG_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
const _intersection = new THREE.Vector3()

function AudioObjectSphere({ obj, isSelected, onSelect, onDrag }) {
  const meshRef = useRef()
  const dragging = useRef(false)
  const { gl, raycaster } = useThree()

  const handlePointerDown = useCallback((e) => {
    e.stopPropagation()
    dragging.current = true
    gl.domElement.style.cursor = 'grabbing'
    onSelect(obj.id)
  }, [gl, obj.id, onSelect])

  const handlePointerUp = useCallback((e) => {
    e.stopPropagation()
    dragging.current = false
    gl.domElement.style.cursor = 'grab'
  }, [gl])

  const handlePointerMove = useCallback((e) => {
    if (!dragging.current) return
    e.stopPropagation()
    if (raycaster.ray.intersectPlane(DRAG_PLANE, _intersection)) {
      onDrag(
        obj.id,
        Math.max(-4.5, Math.min(4.5, _intersection.x)),
        obj.y,
        Math.max(-4.5, Math.min(4.5, _intersection.z)),
      )
    }
  }, [obj.id, obj.y, raycaster, onDrag])

  useFrame(({ clock }) => {
    if (!meshRef.current) return
    if (isSelected) {
      meshRef.current.material.emissiveIntensity = 0.45 + Math.sin(clock.elapsedTime * 3) * 0.25
    } else {
      meshRef.current.material.emissiveIntensity = 0.15
    }
  })

  return (
    <group position={[obj.x, obj.y, obj.z]}>
      <mesh
        ref={meshRef}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerMove={handlePointerMove}
        onPointerOver={() => { gl.domElement.style.cursor = 'grab' }}
        onPointerOut={() => { if (!dragging.current) gl.domElement.style.cursor = 'auto' }}
      >
        <sphereGeometry args={[0.18, 20, 20]} />
        <meshStandardMaterial
          color="#FF6B00"
          emissive="#FF6B00"
          emissiveIntensity={0.15}
          transparent
          opacity={isSelected ? 1.0 : 0.8}
        />
      </mesh>

      {/* Glow ring when selected */}
      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.22, 0.28, 32]} />
          <meshBasicMaterial color="#FF6B00" transparent opacity={0.4} />
        </mesh>
      )}

      <Html center distanceFactor={7} style={{ pointerEvents: 'none' }}>
        <div style={{
          color: isSelected ? '#FF6B00' : 'rgba(255,107,0,0.6)',
          fontSize: '9px',
          whiteSpace: 'nowrap',
          fontFamily: 'monospace',
          background: isSelected ? 'rgba(0,0,0,0.7)' : 'none',
          padding: isSelected ? '1px 3px' : '0',
          borderRadius: '2px',
          marginTop: '16px',
          textShadow: '0 0 6px #000',
        }}>
          {obj.name}
        </div>
      </Html>
    </group>
  )
}

function ListenerMarker() {
  return (
    <group position={[0, -2.95, 0]}>
      <mesh>
        <cylinderGeometry args={[0.08, 0.08, 0.02, 16]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.6} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.12, 0.16, 32]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.2} />
      </mesh>
    </group>
  )
}

function Scene() {
  const { objects, updateObject, selectedObjectId, setSelectedObjectId, speakerPreset, SPEAKER_POSITIONS } = useAudio()
  const speakers = SPEAKER_POSITIONS[speakerPreset] ?? []

  const handleDrag = useCallback((id, x, y, z) => {
    updateObject(id, { x, y, z })
  }, [updateObject])

  const handleMissedClick = useCallback(() => {
    setSelectedObjectId(null)
  }, [setSelectedObjectId])

  return (
    <>
      <ambientLight intensity={0.25} />
      <pointLight position={[0, 4, 0]} intensity={0.6} color="#ffffff" />
      <pointLight position={[0, 0, 0]} intensity={0.15} color="#FF6B00" distance={6} />

      <RoomWireframe />
      <ListenerMarker />

      <Grid
        args={[10, 10]}
        position={[0, -3, 0]}
        cellSize={1}
        cellThickness={0.4}
        cellColor="#222222"
        sectionSize={5}
        sectionThickness={0.6}
        sectionColor="#2e2e2e"
        fadeDistance={22}
        infiniteGrid={false}
      />

      {speakers.map(sp => <SpeakerMesh key={sp.id} speaker={sp} />)}

      {objects.map(obj => (
        <AudioObjectSphere
          key={obj.id}
          obj={obj}
          isSelected={obj.id === selectedObjectId}
          onSelect={setSelectedObjectId}
          onDrag={handleDrag}
        />
      ))}

      <mesh position={[0, 0, 0]} onClick={handleMissedClick} visible={false}>
        <boxGeometry args={[100, 100, 100]} />
        <meshBasicMaterial />
      </mesh>

      <OrbitControls
        makeDefault
        enablePan
        minDistance={3}
        maxDistance={28}
        target={[0, 0, 0]}
      />
    </>
  )
}

export default function RoomView() {
  const { objects } = useAudio()

  return (
    <div className="relative w-full h-full" style={{ background: '#080808' }}>
      <Canvas
        camera={{ position: [0, 8, 11], fov: 48 }}
        gl={{ antialias: true, alpha: false, preserveDrawingBuffer: false }}
        style={{ background: '#080808' }}
      >
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>

      {/* Minimap */}
      <div className="absolute bottom-4 right-4 z-10">
        <RoomMinimap />
      </div>

      {/* Legend */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5">
        {[
          { color: '#FF6B00', label: 'Audio Objects' },
          { color: '#555555', label: 'Speakers'       },
          { color: '#ffffff', label: 'Listener'       },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-2 text-xs text-[#737373]">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
            {label}
          </div>
        ))}
      </div>

      {/* Empty state hint */}
      {objects.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="text-[#2a2a2a] text-4xl mb-2">⬡</div>
            <div className="text-xs text-[#333333]">Import audio files to add objects to the scene</div>
          </div>
        </div>
      )}

      {/* Controls hint */}
      <div className="absolute top-3 right-3 z-10 text-right text-[10px] text-[#333333] leading-relaxed">
        <div>Drag sphere to move</div>
        <div>Scroll to zoom</div>
        <div>Right-drag to orbit</div>
      </div>
    </div>
  )
}

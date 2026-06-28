'use client'

import { useRef, Suspense, useCallback, useState, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Grid, Html } from '@react-three/drei'
import * as THREE from 'three'
import { Lock, LockOpen, ZoomIn, ZoomOut, Magnet } from 'lucide-react'
import { useAudio } from '@/context/AudioContext'
import RoomMinimap from './RoomMinimap'
import OrthoView from './OrthoView'

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

const DRAG_PLANE   = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
const _intersection = new THREE.Vector3()

function AudioObjectSphere({ obj, isSelected, onSelect, onDrag, orbitRef, lockedRef }) {
  const meshRef  = useRef()
  const dragging = useRef(false)
  const { gl, raycaster } = useThree()

  // Re-enable orbit on pointer up anywhere (handles releasing outside mesh)
  useEffect(() => {
    const onUp = () => {
      if (!dragging.current) return
      dragging.current = false
      if (orbitRef?.current && !lockedRef?.current) orbitRef.current.enabled = true
      gl.domElement.style.cursor = 'auto'
    }
    window.addEventListener('pointerup', onUp)
    return () => window.removeEventListener('pointerup', onUp)
  }, [gl, orbitRef, lockedRef])

  const handlePointerDown = useCallback((e) => {
    e.stopPropagation()
    dragging.current = true
    // Disable orbit so it doesn't fight the drag
    if (orbitRef?.current) orbitRef.current.enabled = false
    gl.domElement.style.cursor = 'grabbing'
    onSelect(obj.id)
  }, [gl, obj.id, onSelect, orbitRef])

  const handlePointerUp = useCallback((e) => {
    e.stopPropagation()
    dragging.current = false
    if (orbitRef?.current && !lockedRef?.current) orbitRef.current.enabled = true
    gl.domElement.style.cursor = 'grab'
  }, [gl, orbitRef, lockedRef])

  const handlePointerMove = useCallback((e) => {
    if (!dragging.current) return
    e.stopPropagation()
    if (raycaster.ray.intersectPlane(DRAG_PLANE, _intersection)) {
      const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
      onDrag(obj.id, clamp(_intersection.x, -4.5, 4.5), obj.y, clamp(_intersection.z, -4.5, 4.5))
    }
  }, [obj.id, obj.y, raycaster, onDrag])

  useFrame(({ clock }) => {
    if (!meshRef.current) return
    meshRef.current.material.emissiveIntensity = isSelected
      ? 0.45 + Math.sin(clock.elapsedTime * 3) * 0.25
      : 0.15
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
        <sphereGeometry args={[0.22, 20, 20]} />
        <meshStandardMaterial
          color="#FF6B00"
          emissive="#FF6B00"
          emissiveIntensity={0.15}
          transparent
          opacity={isSelected ? 1.0 : 0.82}
        />
      </mesh>

      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.28, 0.36, 32]} />
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
          marginTop: '18px',
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

const SNAP_AZ  = Math.PI / 4
const SNAP_POL = Math.PI / 6
const _sph     = new THREE.Spherical()

function CameraController({ actionsRef, orbitRef, snapping }) {
  const { camera } = useThree()
  const targetDistRef = useRef(null)
  const snapTargetRef = useRef(null)
  const snappingRef   = useRef(snapping)
  useEffect(() => { snappingRef.current = snapping }, [snapping])

  useEffect(() => {
    const ctrl = orbitRef.current
    if (!ctrl) return
    const onEnd = () => {
      if (!snappingRef.current) return
      _sph.setFromVector3(camera.position.clone().sub(ctrl.target))
      snapTargetRef.current = {
        theta:  Math.round(_sph.theta / SNAP_AZ) * SNAP_AZ,
        phi:    Math.max(0.08, Math.min(Math.PI - 0.08, Math.round(_sph.phi / SNAP_POL) * SNAP_POL)),
        radius: _sph.radius,
      }
    }
    ctrl.addEventListener('end', onEnd)
    return () => ctrl.removeEventListener('end', onEnd)
  }, [camera, orbitRef])

  useFrame(() => {
    const ctrl = orbitRef.current
    if (!ctrl) return

    // Smooth zoom
    if (targetDistRef.current !== null) {
      const dir  = camera.position.clone().sub(ctrl.target).normalize()
      const cur  = camera.position.distanceTo(ctrl.target)
      const next = THREE.MathUtils.lerp(cur, targetDistRef.current, 0.1)
      camera.position.copy(ctrl.target).addScaledVector(dir, next)
      ctrl.update()
      if (Math.abs(next - targetDistRef.current) < 0.005) {
        camera.position.copy(ctrl.target).addScaledVector(dir, targetDistRef.current)
        ctrl.update()
        targetDistRef.current = null
      }
    }

    // Smooth snap rotation
    if (snapTargetRef.current) {
      _sph.setFromVector3(camera.position.clone().sub(ctrl.target))
      _sph.theta  = THREE.MathUtils.lerp(_sph.theta, snapTargetRef.current.theta,  0.12)
      _sph.phi    = THREE.MathUtils.lerp(_sph.phi,   snapTargetRef.current.phi,    0.12)
      _sph.radius = snapTargetRef.current.radius
      camera.position.setFromSpherical(_sph).add(ctrl.target)
      ctrl.update()
      if (
        Math.abs(_sph.theta - snapTargetRef.current.theta) < 0.002 &&
        Math.abs(_sph.phi   - snapTargetRef.current.phi)   < 0.002
      ) {
        _sph.theta = snapTargetRef.current.theta
        _sph.phi   = snapTargetRef.current.phi
        camera.position.setFromSpherical(_sph).add(ctrl.target)
        ctrl.update()
        snapTargetRef.current = null
      }
    }
  })

  useEffect(() => {
    actionsRef.current = {
      zoomIn: () => {
        const ctrl = orbitRef.current
        if (!ctrl) return
        const cur = targetDistRef.current ?? camera.position.distanceTo(ctrl.target)
        targetDistRef.current = Math.max(ctrl.minDistance ?? 3, cur * 0.6)
      },
      zoomOut: () => {
        const ctrl = orbitRef.current
        if (!ctrl) return
        const cur = targetDistRef.current ?? camera.position.distanceTo(ctrl.target)
        targetDistRef.current = Math.min(ctrl.maxDistance ?? 28, cur * 1.65)
      },
    }
  })
  return null
}

function Scene({ locked, lockedRef, snapping, orbitRef, cameraActionsRef }) {
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
          orbitRef={orbitRef}
          lockedRef={lockedRef}
        />
      ))}

      <mesh position={[0, 0, 0]} onClick={handleMissedClick} visible={false}>
        <boxGeometry args={[100, 100, 100]} />
        <meshBasicMaterial />
      </mesh>

      <CameraController actionsRef={cameraActionsRef} orbitRef={orbitRef} snapping={snapping} />

      <OrbitControls
        ref={orbitRef}
        makeDefault
        enabled={!locked}
        enablePan={!locked}
        minDistance={3}
        maxDistance={28}
        target={[0, 0, 0]}
      />
    </>
  )
}

export default function RoomView() {
  const { objects } = useAudio()
  const [locked,       setLocked]       = useState(false)
  const [snapping,     setSnapping]     = useState(false)
  const [sideExpanded, setSideExpanded] = useState(false)
  const orbitRef       = useRef(null)
  const lockedRef      = useRef(false)
  const cameraActionsRef = useRef({ zoomIn: () => {}, zoomOut: () => {} })

  // Keep lockedRef in sync so sphere callbacks can read it without stale closure
  useEffect(() => { lockedRef.current = locked }, [locked])

  // L key toggles lock
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (e.key === 'l' || e.key === 'L') setLocked(p => !p)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const iconBtn = 'w-7 h-7 flex items-center justify-center rounded border transition-all cursor-pointer'

  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background: '#080808' }}>

      {/* OrthoView — collapsed: bottom-left widget matching minimap; expanded: left overlay panel */}
      <div
        className="absolute z-20"
        style={sideExpanded
          ? { top: 0, left: 0, bottom: 0, width: 'clamp(280px, 48%, 580px)', transition: 'width 0.22s ease' }
          : { bottom: 16, left: 16 }
        }
      >
        <OrthoView expanded={sideExpanded} onExpandToggle={() => setSideExpanded(p => !p)} />
      </div>

      {/* 3D view (always fills full area, OrthoView overlays it) */}
      <div className="absolute inset-0" style={{ background: '#080808' }}>
        <Canvas
          camera={{ position: [0, 8, 11], fov: 48 }}
          gl={{ antialias: true, alpha: false, preserveDrawingBuffer: false }}
          style={{ background: '#080808', width: '100%', height: '100%' }}
        >
          <Suspense fallback={null}>
            <Scene
              locked={locked}
              lockedRef={lockedRef}
              snapping={snapping}
              orbitRef={orbitRef}
              cameraActionsRef={cameraActionsRef}
            />
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
            { color: '#555555', label: 'Speakers'      },
            { color: '#ffffff', label: 'Listener'      },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-2 text-xs text-[#737373]">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
              {label}
            </div>
          ))}
        </div>

        {/* Top-right: lock + snap + zoom */}
        <div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-2">
          <button
            onClick={() => setLocked(p => !p)}
            className={`${iconBtn} ${locked
              ? 'border-[#FF6B00] bg-[#FF6B00]/10 text-[#FF6B00]'
              : 'border-[#333333] bg-[#1a1a1a]/80 text-[#737373] hover:text-white hover:border-[#474747]'
            }`}
            title={locked ? 'Unlock viewport (L)' : 'Lock viewport (L)'}
          >
            {locked ? <Lock size={12} /> : <LockOpen size={12} />}
          </button>

          <button
            onClick={() => setSnapping(p => !p)}
            className={`${iconBtn} ${snapping
              ? 'border-[#FF6B00] bg-[#FF6B00]/10 text-[#FF6B00]'
              : 'border-[#333333] bg-[#1a1a1a]/80 text-[#737373] hover:text-white hover:border-[#474747]'
            }`}
            title={snapping ? 'Snap rotation ON' : 'Enable rotation snapping'}
          >
            <Magnet size={12} />
          </button>

          <div className="flex flex-col gap-1">
            <button
              onClick={() => cameraActionsRef.current.zoomIn()}
              className={`${iconBtn} border-[#333333] bg-[#1a1a1a]/80 text-[#737373] hover:text-white hover:border-[#474747]`}
              title="Zoom In"
            >
              <ZoomIn size={12} />
            </button>
            <button
              onClick={() => cameraActionsRef.current.zoomOut()}
              className={`${iconBtn} border-[#333333] bg-[#1a1a1a]/80 text-[#737373] hover:text-white hover:border-[#474747]`}
              title="Zoom Out"
            >
              <ZoomOut size={12} />
            </button>
          </div>

          {!locked && !snapping && (
            <div className="text-right text-[10px] text-[#333333] leading-relaxed mt-1">
              <div>Drag sphere to move</div>
              <div>Scroll to zoom</div>
              <div>Right-drag to orbit</div>
            </div>
          )}
          {locked && (
            <div className="text-right text-[10px] mt-1" style={{ color: '#FF6B00', opacity: 0.55 }}>
              View locked
            </div>
          )}
        </div>

        {/* Empty state */}
        {objects.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <div className="text-[#2a2a2a] text-4xl mb-2">⬡</div>
              <div className="text-xs text-[#333333]">Import audio files to add objects to the scene</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

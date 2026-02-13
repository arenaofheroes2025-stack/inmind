/**
 * BattleArena3D — Three.js 3D arena with 2D character sprites on square tiles.
 *
 * Uses @react-three/fiber + drei for:
 *  - 3D extruded square tiles (Box geometry)
 *  - 2D billboard sprites standing upright on tiles (with smooth movement)
 *  - Isometric-style camera with orbit controls
 *  - Click-to-select tiles
 *  - Location image as full background
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Billboard, Html, OrbitControls, Text } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import * as THREE from 'three'
import type {
  BattleCombatant,
  BattleState,
  GridPosition,
  TileType,
} from '../data/types'

/* ══════════════════════════════════════════════
   Props
   ══════════════════════════════════════════════ */

/** Event emitted when an attack/skill lands — triggers cinematic zoom */
export interface AttackEvent {
  attackerId: string
  targetId: string
  /** Timestamp so React detects new events even if same attacker/target */
  ts: number
}

export interface BattleArena3DProps {
  battle: BattleState
  highlightedTiles: GridPosition[]
  actionMode: 'idle' | 'move' | 'attack' | 'skill'
  currentCombatantId: string | null
  onTileClick: (pos: GridPosition) => void
  floatingNumbers: { id: string; pos: GridPosition; value: number; type: 'damage' | 'heal' }[]
  locationImageUrl?: string
  /** When set, triggers cinematic attack zoom + blur */
  attackEvent?: AttackEvent | null
}

/* ══════════════════════════════════════════════
   Constants
   ══════════════════════════════════════════════ */
const TILE_SPACING = 1.15 // distance between tile centers
const TILE_HEIGHT = 0.18  // tile extrusion height (thinner to show bg)
const TILE_GAP = 0.08     // gap between tiles

// Tile colors — lighter palette for better visibility
const TILE_COLOR: Record<TileType, string> = {
  normal: '#4a4a5e',
  blocked: '#3a3a4a',
  cover: '#505068',
  hazard: '#5a3030',
}

const TILE_HIGHLIGHT_MOVE = '#2a6a3a'
const TILE_HIGHLIGHT_ATTACK = '#6a2a2a'
const TILE_CURRENT = '#6a5a20'

// Subtle occupied-tile accent colors
const TILE_OCCUPIED_PLAYER = '#3a5a44'
const TILE_OCCUPIED_ENEMY = '#5a3a3a'

/** Convert grid coords to world coords */
function gridToWorld(col: number, row: number, offsetX: number, offsetZ: number) {
  return {
    x: col * TILE_SPACING - offsetX,
    z: row * TILE_SPACING - offsetZ,
  }
}

/* ══════════════════════════════════════════════
   Animated Combatant Sprite
   ══════════════════════════════════════════════ */

function AnimatedCombatantSprite({
  combatant,
  offsetX,
  offsetZ,
  attackAnim,
  hitAnim,
}: {
  combatant: BattleCombatant
  offsetX: number
  offsetZ: number
  /** 'lunge' = this combatant is attacking (lunge forward then back) */
  attackAnim?: 'lunge' | null
  /** 'hit' = this combatant is being hit (shake) */
  hitAnim?: 'hit' | null
}) {
  const groupRef = useRef<THREE.Group>(null!)

  // Store target in a ref so useFrame always reads latest without re-render issues
  const targetRef = useRef({ x: 0, z: 0 })
  const world = gridToWorld(combatant.position.col, combatant.position.row, offsetX, offsetZ)
  targetRef.current.x = world.x
  targetRef.current.z = world.z

  // On first mount, snap to position
  const initialized = useRef(false)
  useEffect(() => {
    if (groupRef.current && !initialized.current) {
      groupRef.current.position.x = targetRef.current.x
      groupRef.current.position.z = targetRef.current.z
      initialized.current = true
    }
  }, [])

  // Animation refs
  const animClock = useRef(0)
  const animType = useRef<'lunge' | 'hit' | null>(null)
  const animDuration = useRef(0)
  const animBaseX = useRef(0)
  const animBaseZ = useRef(0)

  // Trigger animations when props change
  useEffect(() => {
    if (attackAnim === 'lunge') {
      animType.current = 'lunge'
      animClock.current = 0
      animDuration.current = 0.4 // 400ms lunge
    }
  }, [attackAnim])

  useEffect(() => {
    if (hitAnim === 'hit') {
      animType.current = 'hit'
      animClock.current = 0
      animDuration.current = 0.45 // 450ms shake
    }
  }, [hitAnim])

  useFrame((_, delta) => {
    if (!groupRef.current) return

    const tx = targetRef.current.x
    const tz = targetRef.current.z
    const cx = groupRef.current.position.x
    const cz = groupRef.current.position.z

    // If already at target (within tiny threshold), skip normal movement
    const dx = tx - cx
    const dz = tz - cz
    if (Math.abs(dx) < 0.005 && Math.abs(dz) < 0.005) {
      groupRef.current.position.x = tx
      groupRef.current.position.z = tz
    } else {
      // Smooth ease toward target — slower for visible sliding animation
      const speed = 2.2
      const lerpFactor = 1 - Math.pow(0.05, delta * speed)
      groupRef.current.position.x = THREE.MathUtils.lerp(cx, tx, lerpFactor)
      groupRef.current.position.z = THREE.MathUtils.lerp(cz, tz, lerpFactor)
    }

    // Store base position for animations
    animBaseX.current = groupRef.current.position.x
    animBaseZ.current = groupRef.current.position.z

    // Attack/hit animations (additive offset)
    if (animType.current && animClock.current < animDuration.current) {
      animClock.current += delta
      const t = Math.min(animClock.current / animDuration.current, 1)

      if (animType.current === 'lunge') {
        // Lunge forward (toward center) then snap back — sine curve
        const lungeAmount = Math.sin(t * Math.PI) * 0.35
        // Lunge toward grid center (0,0)
        const dirX = -Math.sign(animBaseX.current || 0.01)
        const dirZ = -Math.sign(animBaseZ.current || 0.01)
        const mag = Math.sqrt(dirX * dirX + dirZ * dirZ) || 1
        groupRef.current.position.x += (dirX / mag) * lungeAmount
        groupRef.current.position.z += (dirZ / mag) * lungeAmount
      } else if (animType.current === 'hit') {
        // Shake horizontally
        const shakeIntensity = (1 - t) * 0.2 // fade out
        const shakeX = Math.sin(t * Math.PI * 8) * shakeIntensity
        groupRef.current.position.x += shakeX
        // Red flash — scale Y briefly
        const flashScale = 1 + Math.sin(t * Math.PI) * 0.08
        groupRef.current.scale.setScalar(flashScale)
      }

      // Reset scale after hit anim ends
      if (t >= 1) {
        animType.current = null
        groupRef.current.scale.setScalar(1)
      }
    }
  })

  const isPlayer = combatant.team === 'player'
  const hpPct = Math.max(0, combatant.hp / combatant.maxHp)
  const ringColor = isPlayer ? '#44ff88' : '#ff4444'
  const bgColor = isPlayer ? 'rgba(0,180,80,0.25)' : 'rgba(220,40,40,0.25)'

  // Do NOT pass position prop — it would override the animated ref position each render
  return (
    <group ref={groupRef}>
      <Billboard
        position={[0, TILE_HEIGHT + 1.0, 0]}
        follow
        lockX={false}
        lockY={false}
        lockZ={false}
      >
        <Html
          center
          distanceFactor={5.5}
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          <div className="flex flex-col items-center" style={{ width: 72 }}>
            {/* Name */}
            <span
              className="mb-0.5 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-bold"
              style={{
                color: isPlayer ? '#44ff88' : '#ff4444',
                backgroundColor: 'rgba(0,0,0,0.7)',
                textShadow: `0 0 6px ${ringColor}60`,
              }}
            >
              {combatant.name.split(' ')[0]}
            </span>

            {/* Full character portrait (9:16 ratio) */}
            <div
              style={{
                width: 56,
                height: 100,
                borderRadius: 6,
                border: `1.5px solid ${ringColor}80`,
                backgroundColor: bgColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                boxShadow: `0 0 10px ${ringColor}40, 0 2px 6px rgba(0,0,0,0.4)`,
                position: 'relative',
              }}
            >
              {combatant.portraitUrl ? (
                <img
                  src={combatant.portraitUrl}
                  alt={combatant.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <span style={{ color: ringColor, fontWeight: 'bold', fontSize: 18 }}>
                  {combatant.name.substring(0, 2)}
                </span>
              )}

              {/* Defending shield badge */}
              {combatant.isDefending && (
                <div
                  style={{
                    position: 'absolute',
                    top: 2,
                    right: 2,
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    backgroundColor: 'rgba(96,165,250,0.4)',
                    border: '1.5px solid rgba(96,165,250,0.8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                  }}
                >
                  🛡
                </div>
              )}
            </div>

            {/* HP bar */}
            <div
              style={{
                width: 54,
                height: 5,
                borderRadius: 3,
                backgroundColor: 'rgba(0,0,0,0.7)',
                marginTop: 3,
                overflow: 'hidden',
                border: `1px solid ${ringColor}20`,
              }}
            >
              <div
                style={{
                  width: `${hpPct * 100}%`,
                  height: '100%',
                  borderRadius: 3,
                  backgroundColor: isPlayer ? '#44ff88' : '#ff4444',
                  transition: 'width 0.4s ease',
                }}
              />
            </div>

            {/* Status dots */}
            {combatant.statusEffects.length > 0 && (
              <div style={{ display: 'flex', gap: 2, marginTop: 2 }}>
                {combatant.statusEffects.slice(0, 3).map((eff) => (
                  <span
                    key={eff.id}
                    style={{ color: eff.color, fontSize: 8, textShadow: '0 0 4px rgba(0,0,0,0.8)' }}
                    title={`${eff.name} (${eff.duration})`}
                  >
                    ●
                  </span>
                ))}
              </div>
            )}
          </div>
        </Html>
      </Billboard>
    </group>
  )
}

/* ══════════════════════════════════════════════
   Animated Floating Number — rises up with fade/scale
   ══════════════════════════════════════════════ */

function AnimatedFloatingNumber({
  pos,
  value,
  type,
  offsetX,
  offsetZ,
}: {
  pos: GridPosition
  value: number
  type: 'damage' | 'heal'
  offsetX: number
  offsetZ: number
}) {
  const groupRef = useRef<THREE.Group>(null!)
  const textRef = useRef<THREE.Mesh>(null!)
  const clock = useRef(0)
  const DURATION = 1.4
  const baseX = pos.col * TILE_SPACING - offsetX
  const baseZ = pos.row * TILE_SPACING - offsetZ
  const isDamage = type === 'damage'

  useFrame((_, delta) => {
    if (!groupRef.current) return
    clock.current += delta
    const t = Math.min(clock.current / DURATION, 1)

    // Rise: fast at start, slow at end (ease-out)
    const easeOut = 1 - Math.pow(1 - t, 3)
    groupRef.current.position.y = 1.5 + easeOut * 1.2

    // Fade out in the last 40%
    const fadeStart = 0.6
    const opacity = t > fadeStart ? 1 - (t - fadeStart) / (1 - fadeStart) : 1
    if (textRef.current) {
      const mat = textRef.current.material as THREE.MeshBasicMaterial
      if (mat) mat.opacity = opacity
    }

    // Scale: pop-in at start then shrink at end
    const scalePop = t < 0.15 ? 1 + Math.sin((t / 0.15) * Math.PI) * 0.4 : 1
    const scaleFade = t > 0.7 ? 1 - (t - 0.7) * 1.5 : 1
    groupRef.current.scale.setScalar(Math.max(0.1, scalePop * scaleFade))

    // Slight horizontal drift
    groupRef.current.position.x = baseX + Math.sin(t * Math.PI * 2) * 0.08
  })

  return (
    <group ref={groupRef} position={[baseX, 1.5, baseZ]}>
      <Billboard follow lockX={false} lockY={false} lockZ={false}>
        <Text
          ref={textRef}
          fontSize={isDamage ? 0.55 : 0.45}
          color={isDamage ? '#ff2222' : '#22ff66'}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.06}
          outlineColor="#000000"
          font={undefined}
          material-transparent={true}
          material-depthTest={false}
        >
          {isDamage ? `-${value}` : `+${value}`}
        </Text>
      </Billboard>
    </group>
  )
}

/* ══════════════════════════════════════════════
   Impact Flash — burst of light at hit position
   ══════════════════════════════════════════════ */

function ImpactFlash({
  pos,
  type,
  offsetX,
  offsetZ,
}: {
  pos: GridPosition
  type: 'damage' | 'heal'
  offsetX: number
  offsetZ: number
}) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const lightRef = useRef<THREE.PointLight>(null!)
  const clock = useRef(0)
  const DURATION = 0.5

  const x = pos.col * TILE_SPACING - offsetX
  const z = pos.row * TILE_SPACING - offsetZ
  const color = type === 'damage' ? '#ff4400' : '#44ff88'

  useFrame((_, delta) => {
    clock.current += delta
    const t = Math.min(clock.current / DURATION, 1)

    // Flash: quick expand then fade
    const scale = t < 0.2 ? (t / 0.2) * 1.5 : 1.5 * (1 - (t - 0.2) / 0.8)
    const opacity = t < 0.15 ? 1 : 1 - (t - 0.15) / 0.85

    if (meshRef.current) {
      meshRef.current.scale.setScalar(Math.max(0.01, scale))
      const mat = meshRef.current.material as THREE.MeshBasicMaterial
      if (mat) mat.opacity = Math.max(0, opacity * 0.7)
    }

    if (lightRef.current) {
      lightRef.current.intensity = Math.max(0, opacity * 3)
    }
  })

  return (
    <group position={[x, TILE_HEIGHT + 1.2, z]}>
      {/* Flash sphere */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.4, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.7} depthTest={false} />
      </mesh>
      {/* Dynamic light */}
      <pointLight ref={lightRef} color={color} intensity={3} distance={4} />
    </group>
  )
}

/* ══════════════════════════════════════════════
   Scene Content
   ══════════════════════════════════════════════ */

function ArenaScene({
  battle,
  highlightedTiles,
  actionMode,
  currentCombatantId,
  onTileClick,
  floatingNumbers,
  attackEvent,
}: BattleArena3DProps) {
  const gridRows = battle.terrain.length
  const gridCols = battle.terrain[0]?.length ?? gridRows

  // Center offset so grid is centered at origin
  const offsetX = ((gridCols - 1) * TILE_SPACING) / 2
  const offsetZ = ((gridRows - 1) * TILE_SPACING) / 2

  // Track active attack animation per combatant
  const [attackingId, setAttackingId] = useState<string | null>(null)
  const [hitId, setHitId] = useState<string | null>(null)

  // When attackEvent fires, trigger lunge + hit anims
  const lastAttackTs = useRef(0)
  useEffect(() => {
    if (!attackEvent || attackEvent.ts === lastAttackTs.current) return
    lastAttackTs.current = attackEvent.ts
    setAttackingId(attackEvent.attackerId)
    setHitId(attackEvent.targetId)
    // Clear after animation duration
    const timer = setTimeout(() => {
      setAttackingId(null)
      setHitId(null)
    }, 600)
    return () => clearTimeout(timer)
  }, [attackEvent])

  const isHighlighted = useCallback(
    (col: number, row: number) =>
      highlightedTiles.some((h) => h.col === col && h.row === row),
    [highlightedTiles],
  )

  // Get alive combatants for rendering
  const aliveCombatants = useMemo(
    () => battle.combatants.filter((c) => c.hp > 0),
    [battle.combatants],
  )

  return (
    <>
      {/* ─── Lighting ─── */}
      <ambientLight intensity={0.55} color="#bbbbdd" />
      <directionalLight position={[6, 12, 6]} intensity={0.7} castShadow color="#fff0dd" />
      <directionalLight position={[-4, 8, -4]} intensity={0.3} color="#bbccff" />
      <spotLight
        position={[0, 14, 6]}
        angle={0.5}
        penumbra={0.6}
        intensity={1.0}
        color="#ffd699"
        castShadow
      />
      <pointLight position={[-offsetX - 2, 3, -offsetZ - 2]} intensity={0.4} color="#4466ff" distance={20} />
      <pointLight position={[offsetX + 2, 3, offsetZ + 2]} intensity={0.3} color="#ff6644" distance={20} />
      <hemisphereLight args={['#8899bb', '#443322', 0.35]} />

      {/* ─── Semi-transparent ground beneath tiles ─── */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <planeGeometry args={[gridCols * TILE_SPACING + 3, gridRows * TILE_SPACING + 3]} />
        <meshStandardMaterial color="#1a1a2a" transparent opacity={0.55} roughness={0.9} metalness={0} />
      </mesh>

      {/* Tiles */}
      {battle.terrain.map((row, r) =>
        row.map((tileType, c) => {
          const highlighted = isHighlighted(c, r)
          const occupant = aliveCombatants.find(
            (cb) => cb.position.col === c && cb.position.row === r,
          )
          const isCurrent = occupant?.id === currentCombatantId

          let color = TILE_COLOR[tileType]
          if (isCurrent) color = TILE_CURRENT
          else if (highlighted) color = actionMode === 'move' ? TILE_HIGHLIGHT_MOVE : TILE_HIGHLIGHT_ATTACK
          else if (occupant) color = occupant.team === 'player' ? TILE_OCCUPIED_PLAYER : TILE_OCCUPIED_ENEMY

          const posX = c * TILE_SPACING - offsetX
          const posZ = r * TILE_SPACING - offsetZ

          return (
            <group key={`tile-${r}-${c}`}>
              {/* 3D tile box */}
              <mesh
                position={[posX, TILE_HEIGHT / 2, posZ]}
                onClick={(e: ThreeEvent<MouseEvent>) => {
                  e.stopPropagation()
                  onTileClick({ col: c, row: r })
                }}
                castShadow
                receiveShadow
              >
                <boxGeometry args={[TILE_SPACING - TILE_GAP, TILE_HEIGHT, TILE_SPACING - TILE_GAP]} />
                <meshStandardMaterial
                  color={color}
                  transparent
                  opacity={tileType === 'blocked' ? 0.55 : 0.65}
                  roughness={0.8}
                  metalness={0.05}
                />
              </mesh>

              {/* Highlight glow (top edge) */}
              {highlighted && (
                <mesh position={[posX, TILE_HEIGHT + 0.01, posZ]} rotation={[-Math.PI / 2, 0, 0]}>
                  <planeGeometry args={[TILE_SPACING - TILE_GAP, TILE_SPACING - TILE_GAP]} />
                  <meshBasicMaterial
                    color={actionMode === 'move' ? '#00ff66' : '#ff4444'}
                    transparent
                    opacity={0.2}
                  />
                </mesh>
              )}

              {/* Tile border lines */}
              <lineSegments position={[posX, TILE_HEIGHT + 0.01, posZ]}>
                <edgesGeometry args={[new THREE.BoxGeometry(TILE_SPACING - TILE_GAP, 0.01, TILE_SPACING - TILE_GAP)]} />
                <lineBasicMaterial
                  color={
                    isCurrent ? '#c9a84c'
                    : highlighted
                    ? actionMode === 'move' ? '#00ff66' : '#ff4444'
                    : tileType === 'hazard' ? '#ff4444'
                    : '#c9a84c'
                  }
                  transparent
                  opacity={isCurrent ? 0.8 : highlighted ? 0.6 : 0.2}
                />
              </lineSegments>

              {/* Occupied glow (subtle) */}
              {occupant && !isCurrent && !highlighted && (
                <mesh position={[posX, TILE_HEIGHT + 0.02, posZ]} rotation={[-Math.PI / 2, 0, 0]}>
                  <planeGeometry args={[TILE_SPACING - TILE_GAP, TILE_SPACING - TILE_GAP]} />
                  <meshBasicMaterial
                    color={occupant.team === 'player' ? '#44ff88' : '#ff4444'}
                    transparent
                    opacity={0.1}
                  />
                </mesh>
              )}

              {/* Hazard particles */}
              {tileType === 'hazard' && (
                <pointLight position={[posX, TILE_HEIGHT + 0.3, posZ]} color="#ff3300" intensity={0.3} distance={1.5} />
              )}
            </group>
          )
        }),
      )}

      {/* ─── Animated Combatant Sprites (separate from tiles) ─── */}
      {aliveCombatants.map((combatant) => (
        <AnimatedCombatantSprite
          key={combatant.id}
          combatant={combatant}
          offsetX={offsetX}
          offsetZ={offsetZ}
          attackAnim={combatant.id === attackingId ? 'lunge' : null}
          hitAnim={combatant.id === hitId ? 'hit' : null}
        />
      ))}

      {/* Floating damage/heal numbers — animated rising */}
      {floatingNumbers.map((fn) => (
        <AnimatedFloatingNumber
          key={fn.id}
          pos={fn.pos}
          value={fn.value}
          type={fn.type}
          offsetX={offsetX}
          offsetZ={offsetZ}
        />
      ))}

      {/* Impact flash at hit position */}
      {floatingNumbers.map((fn) => (
        <ImpactFlash
          key={`flash-${fn.id}`}
          pos={fn.pos}
          type={fn.type}
          offsetX={offsetX}
          offsetZ={offsetZ}
        />
      ))}

      {/* Camera controls with auto-focus on current combatant */}
      <CameraFocus
        currentCombatantId={currentCombatantId}
        combatants={battle.combatants}
        offsetX={offsetX}
        offsetZ={offsetZ}
        attackEvent={attackEvent}
      />
    </>
  )
}

/* ══════════════════════════════════════════════
   Camera Focus — smoothly tracks current combatant
   ══════════════════════════════════════════════ */

function CameraFocus({
  currentCombatantId,
  combatants,
  offsetX,
  offsetZ,
  attackEvent,
}: {
  currentCombatantId: string | null
  combatants: BattleCombatant[]
  offsetX: number
  offsetZ: number
  attackEvent?: AttackEvent | null
}) {
  const controlsRef = useRef<OrbitControlsImpl>(null!)
  const { camera } = useThree()

  // Track target position with a ref for smooth interpolation
  const focusTarget = useRef(new THREE.Vector3(0, 0, 0))
  // Desired camera distance for zoom effect
  const desiredDistance = useRef(13)
  const ZOOM_HERO_CLOSE = 6    // close-up for hero turns
  const ZOOM_ENEMY_CLOSE = 8   // close-up for enemy turns
  const ZOOM_ATTACK = 7        // dramatic zoom for attacks
  const ZOOM_DEFAULT = 13      // normal distance

  // Attack zoom state
  const isAttackZoom = useRef(false)
  const lastAttackTs = useRef(0)

  // When the current combatant changes, update the focus target and zoom in
  const prevCombatantId = useRef<string | null>(null)

  useEffect(() => {
    if (!currentCombatantId) return
    const combatant = combatants.find((c) => c.id === currentCombatantId && c.hp > 0)
    if (!combatant) return

    const world = gridToWorld(combatant.position.col, combatant.position.row, offsetX, offsetZ)
    focusTarget.current.set(world.x, 0, world.z)

    // Zoom in when turn changes to a different combatant
    if (prevCombatantId.current !== currentCombatantId && !isAttackZoom.current) {
      const isHero = combatant.team === 'player'
      desiredDistance.current = isHero ? ZOOM_HERO_CLOSE : ZOOM_ENEMY_CLOSE
      // Stay zoomed in, then ease back to default
      setTimeout(() => {
        if (!isAttackZoom.current) {
          desiredDistance.current = ZOOM_DEFAULT
        }
      }, 2500)
    }
    prevCombatantId.current = currentCombatantId
  }, [currentCombatantId, combatants, offsetX, offsetZ])

  // Attack zoom — focus midpoint between attacker and target, zoom in dramatically
  useEffect(() => {
    if (!attackEvent || attackEvent.ts === lastAttackTs.current) return
    lastAttackTs.current = attackEvent.ts

    const attacker = combatants.find((c) => c.id === attackEvent.attackerId)
    const target = combatants.find((c) => c.id === attackEvent.targetId)
    if (!attacker || !target) return

    const aw = gridToWorld(attacker.position.col, attacker.position.row, offsetX, offsetZ)
    const tw = gridToWorld(target.position.col, target.position.row, offsetX, offsetZ)

    // Focus midpoint between attacker and target
    focusTarget.current.set((aw.x + tw.x) / 2, 0, (aw.z + tw.z) / 2)
    desiredDistance.current = ZOOM_ATTACK
    isAttackZoom.current = true

    // After attack completes, ease back
    setTimeout(() => {
      isAttackZoom.current = false
      // Snap back to current combatant
      const cur = combatants.find((c) => c.id === currentCombatantId && c.hp > 0)
      if (cur) {
        const w = gridToWorld(cur.position.col, cur.position.row, offsetX, offsetZ)
        focusTarget.current.set(w.x, 0, w.z)
      }
      desiredDistance.current = ZOOM_DEFAULT
    }, 1200)
  }, [attackEvent, combatants, offsetX, offsetZ, currentCombatantId])

  // Also update focus when the combatant moves (position changes)
  useEffect(() => {
    if (!currentCombatantId || isAttackZoom.current) return
    const combatant = combatants.find((c) => c.id === currentCombatantId && c.hp > 0)
    if (!combatant) return
    const world = gridToWorld(combatant.position.col, combatant.position.row, offsetX, offsetZ)
    focusTarget.current.set(world.x, 0, world.z)
  }, [combatants, currentCombatantId, offsetX, offsetZ])

  useFrame((_, delta) => {
    if (!controlsRef.current) return

    const target = controlsRef.current.target
    const ft = focusTarget.current

    // Smooth lerp the orbit target toward the focus point
    const speed = 2.0
    const lerpFactor = 1 - Math.pow(0.02, delta * speed)

    target.x = THREE.MathUtils.lerp(target.x, ft.x, lerpFactor)
    target.z = THREE.MathUtils.lerp(target.z, ft.z, lerpFactor)
    target.y = THREE.MathUtils.lerp(target.y, 0, lerpFactor)

    // Smooth zoom — lerp camera distance toward desired
    const currentDist = camera.position.distanceTo(target)
    if (Math.abs(currentDist - desiredDistance.current) > 0.1) {
      const dir = camera.position.clone().sub(target).normalize()
      const newDist = THREE.MathUtils.lerp(currentDist, desiredDistance.current, lerpFactor * 0.6)
      camera.position.copy(target).add(dir.multiplyScalar(newDist))
    }

    controlsRef.current.update()
  })

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={false}
      enableZoom={true}
      minDistance={6}
      maxDistance={20}
      minPolarAngle={Math.PI / 6}
      maxPolarAngle={Math.PI / 3}
    />
  )
}

/* ══════════════════════════════════════════════
   Main Export — Canvas Wrapper
   ══════════════════════════════════════════════ */

export function BattleArena3D(props: BattleArena3DProps) {
  const gridRows = props.battle.terrain.length
  const gridCols = props.battle.terrain[0]?.length ?? gridRows
  const camDist = Math.max(gridRows, gridCols) * 1.1

  // Track if we're in attack cinematic mode (for blur overlay)
  const [isAttackCinematic, setIsAttackCinematic] = useState(false)
  const lastCinematicTs = useRef(0)

  useEffect(() => {
    if (!props.attackEvent || props.attackEvent.ts === lastCinematicTs.current) return
    lastCinematicTs.current = props.attackEvent.ts
    setIsAttackCinematic(true)
    const timer = setTimeout(() => setIsAttackCinematic(false), 1100)
    return () => clearTimeout(timer)
  }, [props.attackEvent])

  // Build background style from location image
  const bgStyle: React.CSSProperties = props.locationImageUrl
    ? {
        backgroundImage: `url(${props.locationImageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : {}

  return (
    <div
      className="relative h-[520px] w-full overflow-hidden rounded-xl border border-gold/15"
      style={bgStyle}
    >
      {/* Blur + dark overlay for readability */}
      <div
        className={`absolute inset-0 ${
          props.locationImageUrl
            ? 'bg-obsidian/40 backdrop-blur-sm'
            : 'bg-obsidian/90'
        }`}
      />

      {/* Attack cinematic vignette/blur overlay */}
      <div
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          opacity: isAttackCinematic ? 1 : 0,
          transition: 'opacity 0.25s ease-in-out',
          background: 'radial-gradient(ellipse 50% 50% at 50% 50%, transparent 0%, rgba(0,0,0,0.65) 100%)',
          boxShadow: isAttackCinematic ? 'inset 0 0 80px 20px rgba(0,0,0,0.5)' : 'none',
        }}
      />

      {/* Side cinematic bars (letterbox effect during attack) */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-10"
        style={{
          height: isAttackCinematic ? 40 : 0,
          backgroundColor: 'rgba(0,0,0,0.85)',
          transition: 'height 0.3s ease-in-out',
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10"
        style={{
          height: isAttackCinematic ? 40 : 0,
          backgroundColor: 'rgba(0,0,0,0.85)',
          transition: 'height 0.3s ease-in-out',
        }}
      />

      <Canvas
        shadows
        camera={{
          position: [camDist * 0.7, camDist * 0.85, camDist * 0.7],
          fov: 40,
          near: 0.1,
          far: 100,
        }}
        style={{ background: 'transparent' }}
        gl={{ alpha: true }}
      >
        <ArenaScene {...props} />
      </Canvas>
    </div>
  )
}

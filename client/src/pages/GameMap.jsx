import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { gamemapService } from '../services'
import LoadingSpinner from '../components/LoadingSpinner'

const WORKOUT_ICONS = {
  'Chest + Triceps': '💪',
  'Back + Biceps': '🔵',
  'Legs + Shoulders': '🦵',
  'Arms + Abs': '🔴'
}

const WORKOUT_COLORS = {
  'Chest + Triceps': '#16a34a',
  'Back + Biceps': '#0077b6',
  'Legs + Shoulders': '#2d6a4f',
  'Arms + Abs': '#9d4edd'
}

const LEVEL_STATE_CONFIG = {
  completed:   { bg: '#16a34a', border: '#15803d', text: '#fff', shadow: '0 4px 15px rgba(22,163,74,0.5)', icon: '✓' },
  in_progress: { bg: '#f59e0b', border: '#d97706', text: '#fff', shadow: '0 4px 20px rgba(245,158,11,0.6)', icon: '▶' },
  available:   { bg: '#fff',    border: '#16a34a', text: '#16a34a', shadow: '0 4px 20px rgba(22,163,74,0.3)', icon: null },
  locked:      { bg: '#e5e7eb', border: '#d1d5db', text: '#9ca3af', shadow: 'none', icon: '🔒' }
}

const LEVEL_SPACING  = 95
const TOP_PADDING    = 70
const BOTTOM_PADDING = 110
const NODE_R         = 30
const TOTAL_LVL      = 48

const X_FRACS = [0.13, 0.37, 0.63, 0.87]

function getLevelPos(n, cw) {
  const idx   = n - 1
  const group = Math.floor(idx / 4)
  const pos   = idx % 4
  const col   = group % 2 === 0 ? pos : (3 - pos)
  return {
    x: X_FRACS[col] * cw,
    y: TOP_PADDING + (TOTAL_LVL - n) * LEVEL_SPACING
  }
}

function buildPath(pts) {
  if (pts.length < 2) return ''
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]
    const b = pts[i]
    const t = (a.y - b.y) * 0.45
    d += ` C ${a.x.toFixed(1)} ${(a.y - t).toFixed(1)},` +
         ` ${b.x.toFixed(1)} ${(b.y + t).toFixed(1)},` +
         ` ${b.x.toFixed(1)} ${b.y.toFixed(1)}`
  }
  return d
}

const XPBar = ({ xpInfo }) => {
  if (!xpInfo) return null
  return (
    <div className="xp-bar-container">
      <div className="xp-bar-header">
        <span className="xp-level-badge">LVL {xpInfo.level}</span>
        <span className="xp-numbers">{xpInfo.xpIntoLevel} / {xpInfo.xpForLevel} XP</span>
        <span className="xp-to-next">{xpInfo.xpToNext} to next level</span>
      </div>
      <div className="xp-track">
        <div className="xp-fill" style={{ width: `${xpInfo.percent}%` }} />
      </div>
    </div>
  )
}

const LevelNode = ({ level, isActive, onClick }) => {
  const config = LEVEL_STATE_CONFIG[level.state] || LEVEL_STATE_CONFIG.locked
  const color  = WORKOUT_COLORS[level.workoutType] || '#16a34a'
  const icon   = WORKOUT_ICONS[level.workoutType]  || '💪'

  return (
    <div
      className={`level-node level-node-${level.state}${isActive ? ' level-node-active' : ''}`}
      onClick={() => onClick(level)}
      style={{ '--node-color': color, '--node-border': config.border }}
      title={`Level ${level.levelNumber}: ${level.workoutType} (Week ${level.weekNumber})`}
    >
      {level.state === 'locked'        ? <span className="node-lock">🔒</span>
       : level.state === 'completed'   ? <span className="node-check">✓</span>
       : level.state === 'in_progress' ? <span className="node-play">▶</span>
       : <span className="node-icon">{icon}</span>}
      <span className="node-number">{level.levelNumber}</span>
      {level.state === 'available' && <div className="node-pulse-ring" />}
    </div>
  )
}

const MapWorld = ({ levels, completedLevels, activeLevelNumber, onLevelClick, activeLevelRef, weekProgress }) => {
  const wrapRef = useRef(null)
  const [cw, setCw] = useState(340)

  useEffect(() => {
    const update = () => {
      if (wrapRef.current) setCw(wrapRef.current.offsetWidth)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const pos = useMemo(() => {
    const m = {}
    for (let n = 1; n <= TOTAL_LVL; n++) m[n] = getLevelPos(n, cw)
    return m
  }, [cw])

  const totalHeight = TOTAL_LVL * LEVEL_SPACING + TOP_PADDING + BOTTOM_PADDING

  const allPts = useMemo(
    () => Array.from({ length: TOTAL_LVL }, (_, i) => pos[i + 1]),
    [pos]
  )

  const doneCount = Math.min(completedLevels + 1, TOTAL_LVL)
  const donePts   = allPts.slice(0, doneCount)
  const pendPts   = allPts.slice(Math.max(doneCount - 1, 0))

  const doneD = buildPath(donePts)
  const pendD = buildPath(pendPts)

  const milestones = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const week     = i + 1
      const firstLvl = (week - 1) * 4 + 1
      const prevLvl  = (week - 1) * 4

      let my
      if (week === 1) {
        my = (pos[1]?.y ?? 0) + NODE_R + 28
      } else {
        const yPrev  = pos[prevLvl]?.y ?? 0
        const yFirst = pos[firstLvl]?.y ?? 0
        my = (yPrev + yFirst) / 2
      }

      const wkData = weekProgress?.find(w => w.week === week)
      return { week, y: my, wkData }
    })
  }, [pos, weekProgress])

  return (
    <div ref={wrapRef} className="map-world" style={{ height: totalHeight }}>

      <svg
        className="map-path-svg"
        width={cw}
        height={totalHeight}
        aria-hidden="true"
      >
        {pendD && (
          <path d={pendD} fill="none" stroke="#d1d5db" strokeWidth={9}
            strokeLinecap="round" strokeLinejoin="round" />
        )}
        {pendD && (
          <path d={pendD} fill="none" stroke="#e9ecef" strokeWidth={5}
            strokeLinecap="round" strokeLinejoin="round" />
        )}
        {doneD && (
          <path d={doneD} fill="none" stroke="#15803d" strokeWidth={9}
            strokeLinecap="round" strokeLinejoin="round" />
        )}
        {doneD && (
          <path d={doneD} fill="none" stroke="#22c55e" strokeWidth={5}
            strokeLinecap="round" strokeLinejoin="round" />
        )}
      </svg>

      {pos[1] && (
        <div
          className="map-journey-cap map-journey-start"
          style={{ left: pos[1].x, top: pos[1].y + NODE_R + 6 }}
        >
          🏁 START
        </div>
      )}

      {pos[48] && (
        <div
          className="map-journey-cap map-journey-finish"
          style={{ left: pos[48].x, top: pos[48].y - NODE_R - 38 }}
        >
          🏆 PEAK
        </div>
      )}

      {milestones.map(({ week, y, wkData }) => {
        const state    = wkData?.state ?? 'locked'
        const emoji    = state === 'completed' ? '✅' : state === 'locked' ? '🔒' : '🔥'
        const progress = wkData ? `${wkData.completed}/${wkData.total}` : ''
        return (
          <div
            key={week}
            className={`week-milestone week-milestone-${state}`}
            style={{ left: cw / 2, top: y }}
          >
            {emoji} Week {week}
            {progress && <span className="milestone-progress"> · {progress}</span>}
          </div>
        )
      })}

      {levels.map(level => {
        const p = pos[level.levelNumber]
        if (!p) return null
        const isActive = level.levelNumber === activeLevelNumber
        return (
          <div
            key={level.levelNumber}
            ref={isActive ? activeLevelRef : null}
            className="map-node-wrap"
            style={{ left: p.x - NODE_R, top: p.y - NODE_R }}
          >
            <LevelNode level={level} isActive={isActive} onClick={onLevelClick} />
            {isActive && (
              <div className="active-indicator">
                <span>▼</span>
                <span className="active-label">Current</span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

const GameMap = () => {
  const navigate = useNavigate()
  const [mapData, setMapData]               = useState(null)
  const [loading, setLoading]               = useState(true)
  const [error, setError]                   = useState('')
  const [selectedLevel, setSelectedLevel]   = useState(null)
  const activeLevelRef = useRef(null)

  useEffect(() => { loadMap() }, [])

  useEffect(() => {
    if (activeLevelRef.current) {
      setTimeout(() => {
        activeLevelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 400)
    }
  }, [mapData])

  const loadMap = async () => {
    setLoading(true)
    try {
      const res = await gamemapService.getMap()
      setMapData(res.data)
    } catch {
      setError('Unable to load game map.')
    } finally {
      setLoading(false)
    }
  }

  const handleLevelClick = (level) => {
    if (level.state === 'locked') return
    if (level.state === 'completed' && level.session?.id) {
      setSelectedLevel(level)
      return
    }
    if (level.state === 'in_progress' && level.session?.id) {
      navigate(`/gym-session/${level.session.id}`)
      return
    }
    if (level.state === 'available') {
      navigate('/gym-session', {
        state: {
          workoutType: level.workoutType,
          dayNumber:   level.dayNumber,
          weekNumber:  level.weekNumber,
          levelNumber: level.levelNumber
        }
      })
    }
  }

  if (loading) return (
    <div className="page-loader">
      <LoadingSpinner size="large" text="Loading your fitness journey..." />
    </div>
  )

  if (error) return (
    <div className="error-state">
      <p>{error}</p>
      <button className="btn btn-primary" onClick={loadMap}>Retry</button>
    </div>
  )

  const { gameMap, player, weekProgress } = mapData
  const { levels, completedLevels, totalLevels, currentLevelIndex } = gameMap
  const journeyPct = Math.round((completedLevels / totalLevels) * 100)

  return (
    <div className="gamemap-page">

      <div className="player-hud">
        <div className="hud-left">
          <div className="hud-avatar">{player.name.charAt(0).toUpperCase()}</div>
          <div className="hud-info">
            <div className="hud-name">{player.name}</div>
            <div className="hud-stats">
              <span className="hud-streak">🔥 {player.currentStreak} day streak</span>
              <span className="hud-workouts">🏋️ {player.totalWorkouts} workouts</span>
            </div>
          </div>
        </div>
        <div className="hud-right">
          <div className="hud-xp">
            <XPBar xpInfo={player.xpInfo} />
          </div>
        </div>
      </div>

      <div className="journey-progress-bar">
        <div className="journey-bar-fill" style={{ width: `${journeyPct}%` }} />
      </div>
      <span className="journey-label">{completedLevels} / {totalLevels} levels complete ({journeyPct}%)</span>

      <div className="map-title">
        <h1>Your Fitness Journey</h1>
        <p className="map-subtitle">12 Weeks · 48 Levels · Keep Pushing</p>
      </div>

      <MapWorld
        levels={levels}
        completedLevels={completedLevels}
        activeLevelNumber={gameMap.activeLevelNumber}
        onLevelClick={handleLevelClick}
        activeLevelRef={activeLevelRef}
        weekProgress={weekProgress}
      />

      {gameMap.activeLevelNumber && (
        <div className="map-cta-bar">
          <div className="cta-level-info">
            <span className="cta-level">Level {gameMap.activeLevelNumber}</span>
            <span className="cta-type">{levels[currentLevelIndex]?.workoutType}</span>
          </div>
          <button
            className="btn-start-level"
            onClick={() => {
              const activeLevel = levels[currentLevelIndex]
              if (activeLevel?.state === 'in_progress' && activeLevel?.session?.id) {
                navigate(`/gym-session/${activeLevel.session.id}`)
              } else {
                navigate('/gym-session', {
                  state: {
                    workoutType: activeLevel?.workoutType,
                    dayNumber:   activeLevel?.dayNumber,
                    weekNumber:  activeLevel?.weekNumber,
                    levelNumber: activeLevel?.levelNumber
                  }
                })
              }
            }}
          >
            {levels[currentLevelIndex]?.state === 'in_progress' ? 'Continue Level' : 'Start Level'}
          </button>
        </div>
      )}

      {selectedLevel && (
        <div className="modal-overlay" onClick={() => setSelectedLevel(null)}>
          <div className="modal level-detail-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Level {selectedLevel.levelNumber} — {selectedLevel.workoutType}</h3>
              <button className="modal-close" onClick={() => setSelectedLevel(null)}>✕</button>
            </div>
            <div className="level-detail-body">
              <div className="level-detail-badge level-detail-completed">✓ Completed</div>
              <div className="level-detail-stats">
                {selectedLevel.session?.date && (
                  <div className="detail-stat">
                    <span className="detail-stat-label">Date</span>
                    <span className="detail-stat-value">
                      {new Date(selectedLevel.session.date).toLocaleDateString('en-GB', {
                        day: 'numeric', month: 'short', year: 'numeric'
                      })}
                    </span>
                  </div>
                )}
                {selectedLevel.session?.duration > 0 && (
                  <div className="detail-stat">
                    <span className="detail-stat-label">Duration</span>
                    <span className="detail-stat-value">{selectedLevel.session.duration} min</span>
                  </div>
                )}
                {selectedLevel.session?.exerciseCount > 0 && (
                  <div className="detail-stat">
                    <span className="detail-stat-label">Exercises</span>
                    <span className="detail-stat-value">{selectedLevel.session.exerciseCount}</span>
                  </div>
                )}
                {selectedLevel.session?.setsCompleted > 0 && (
                  <div className="detail-stat">
                    <span className="detail-stat-label">Sets Done</span>
                    <span className="detail-stat-value">{selectedLevel.session.setsCompleted}</span>
                  </div>
                )}
              </div>
              <div className="level-detail-muscles">
                {selectedLevel.muscleGroups?.map(mg => (
                  <span key={mg} className="muscle-tag">{mg}</span>
                ))}
              </div>
              <div className="modal-actions">
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setSelectedLevel(null)
                    navigate(`/gym-session/${selectedLevel.session.id}`)
                  }}
                >
                  View Workout
                </button>
                <button className="btn btn-primary" onClick={() => setSelectedLevel(null)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default GameMap

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { workoutService, exerciseService } from '../services'
import LoadingSpinner from '../components/LoadingSpinner'
import { useToast } from '../context/ToastContext'

const WORKOUT_TYPES = [
  { type: 'Chest + Triceps', dayNumber: 1, muscles: ['Chest', 'Triceps'] },
  { type: 'Back + Biceps', dayNumber: 2, muscles: ['Back', 'Biceps'] },
  { type: 'Legs + Shoulders', dayNumber: 3, muscles: ['Legs', 'Shoulders'] },
  { type: 'Arms + Abs', dayNumber: 4, muscles: ['Biceps', 'Triceps', 'Abs'] }
]

const WORKOUT_COLORS = {
  'Chest + Triceps': '#16a34a',
  'Chest + Triceps + Lower Back': '#16a34a', // legacy compat
  'Back + Biceps': '#0077b6',
  'Legs + Shoulders': '#2d6a4f',
  'Arms + Abs': '#9d4edd'
}

const MUSCLE_COLORS = {
  Chest: '#16a34a',
  Triceps: '#f59e0b',
  'Lower Back': '#ef4444',
  Back: '#0077b6',
  Biceps: '#8b5cf6',
  Forearms: '#14b8a6',
  Legs: '#2d6a4f',
  Shoulders: '#f97316',
  Abs: '#ec4899'
}

const SERVER_BASE = import.meta.env.VITE_API_URL || ''
const SETS_PER_EXERCISE = 3

const defaultSet = (n) => ({ setNumber: n, weight: 0, reps: 0, completed: false, notes: '' })

// Enrich exercises from session with videoUrl from the allExercises lookup map
const enrichWithVideo = (sessionExercises, exerciseMap) => {
  return sessionExercises.map(ex => {
    // If already has videoUrl skip
    if (ex.videoUrl) return ex
    // Look up by exercise ObjectId or by name
    const exId = ex.exercise?._id || ex.exercise
    const found = exerciseMap[exId?.toString()] ||
      Object.values(exerciseMap).find(e => e.name === ex.exerciseName)
    return {
      ...ex,
      videoUrl: found?.videoUrl || null
    }
  })
}

const GymSession = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()

  const [phase, setPhase] = useState('loading')
  const [session, setSession] = useState(null)
  const [recommendation, setRecommendation] = useState(null)
  const [exercises, setExercises] = useState([])
  const [allExercises, setAllExercises] = useState([])
  const [exerciseMap, setExerciseMap] = useState({}) // id → exercise
  const [suggestions, setSuggestions] = useState([]) // from variation API
  const [previousSession, setPreviousSession] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [showExercisePicker, setShowExercisePicker] = useState(false)
  const [exerciseFilter, setExerciseFilter] = useState('')
  const [selectedType, setSelectedType] = useState(WORKOUT_TYPES[0])
  const [timer, setTimer] = useState(0)
  const [prData, setPrData] = useState({})
  const [videoModal, setVideoModal] = useState(null)
  const [completionData, setCompletionData] = useState(null)
  const videoRef = useRef(null)

  // Timer (minutes)
  useEffect(() => {
    const interval = setInterval(() => setTimer(prev => prev + 1), 60000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (id) {
      loadExistingSession(id)
    } else if (location.state?.workoutType) {
      // Came from a specific game map level click — skip the "today" check
      // and go straight to the select screen with the correct workout type
      const wt = location.state.workoutType
      const matched = WORKOUT_TYPES.find(w => w.type === wt)
      if (matched) {
        setSelectedType(matched)
        loadSuggestions(matched.type)
      }
      setPhase('select')
    } else {
      loadTodayRecommendation()
    }
    loadAllExercises()
  }, [id])

  const loadAllExercises = async () => {
    try {
      const res = await exerciseService.getAll()
      const list = res.data.exercises
      setAllExercises(list)
      const map = {}
      list.forEach(e => { map[e._id] = e })
      setExerciseMap(map)
    } catch (err) { }
  }

  const loadExistingSession = async (sessionId) => {
    try {
      const res = await workoutService.getById(sessionId)
      const s = res.data.session
      setSession(s)
      const exs = s.exercises.map(ex => ({
        ...ex,
        exercise: ex.exercise?._id || ex.exercise,
        sets: ex.sets.length > 0 ? ex.sets : Array.from({ length: SETS_PER_EXERCISE }, (_, i) => defaultSet(i + 1))
      }))
      setExercises(exs)
      // If already completed, go straight to the completed view (read-only)
      setPhase(s.status === 'completed' ? 'complete' : 'session')
    } catch (err) {
      setError('Unable to load workout session.')
      setPhase('select')
    }
  }

  const loadTodayRecommendation = async () => {
    try {
      const res = await workoutService.getToday()
      if (res.data.session) {
        const s = res.data.session
        setSession(s)
        setExercises(s.exercises.map(ex => ({
          ...ex,
          sets: ex.sets.length > 0 ? ex.sets : Array.from({ length: SETS_PER_EXERCISE }, (_, i) => defaultSet(i + 1))
        })))
        setPhase('session')
      } else {
        setRecommendation(res.data.recommendation)
        // Prefer workoutType passed from the game map (level click) over the API recommendation
        const mapState = location.state
        let recType = mapState?.workoutType || res.data.recommendation?.workoutType
        if (recType === 'Chest + Triceps + Lower Back') recType = 'Chest + Triceps'
        const recommended = WORKOUT_TYPES.find(w => w.type === recType)
        if (recommended) {
          setSelectedType(recommended)
          loadSuggestions(recommended.type)
        }
        setPhase('select')
      }
    } catch (err) {
      // Even if the API fails, apply any level state passed from the game map
      const mapState = location.state
      if (mapState?.workoutType) {
        let recType = mapState.workoutType
        if (recType === 'Chest + Triceps + Lower Back') recType = 'Chest + Triceps'
        const recommended = WORKOUT_TYPES.find(w => w.type === recType)
        if (recommended) {
          setSelectedType(recommended)
          loadSuggestions(recommended.type)
        }
      }
      setPhase('select')
    }
  }

  const loadSuggestions = async (workoutType) => {
    try {
      const res = await workoutService.getSuggestions(workoutType)
      setSuggestions(res.data.suggested || [])
      setPreviousSession(res.data.previousSession || null)
    } catch (err) { }
  }

  const loadPRs = useCallback(async () => {
    try {
      const res = await workoutService.getPRs()
      setPrData(res.data.prs || {})
    } catch (err) { }
  }, [])

  useEffect(() => {
    if (phase === 'session') loadPRs()
  }, [phase, loadPRs])

  // After exerciseMap loads, enrich existing session exercises with video URLs
  useEffect(() => {
    if (Object.keys(exerciseMap).length > 0 && exercises.length > 0 && phase === 'session') {
      setExercises(prev => enrichWithVideo(prev, exerciseMap))
    }
  }, [exerciseMap])

  const startSession = async () => {
    setSaving(true)
    try {
      // Use variation suggestions if available, else fallback to allExercises
      let exercisesToUse = []

      if (suggestions.length > 0) {
        exercisesToUse = suggestions.map(ex => ({
          exercise: ex._id,
          exerciseName: ex.name,
          muscleGroup: ex.muscleGroup,
          targetArea: ex.targetArea,
          videoUrl: ex.videoUrl || null,
          sets: Array.from({ length: SETS_PER_EXERCISE }, (_, i) => defaultSet(i + 1)),
          notes: '',
          completed: false
        }))
      } else {
        // Fallback: 4 per primary muscle
        for (const muscle of selectedType.muscles) {
          const picked = allExercises
            .filter(ex => ex.muscleGroup === muscle)
            .slice(0, 4)
            .map(ex => ({
              exercise: ex._id,
              exerciseName: ex.name,
              muscleGroup: ex.muscleGroup,
              targetArea: ex.targetArea,
              videoUrl: ex.videoUrl || null,
              sets: Array.from({ length: SETS_PER_EXERCISE }, (_, i) => defaultSet(i + 1)),
              notes: '',
              completed: false
            }))
          exercisesToUse.push(...picked)
        }
      }

      const res = await workoutService.create({
        workoutType: selectedType.type,
        dayNumber: selectedType.dayNumber,
        exercises: exercisesToUse
      })

      setSession(res.data.session)
      setExercises(exercisesToUse)
      setPhase('session')
    } catch (err) {
      toast.error('Failed to start workout session.')
    } finally {
      setSaving(false)
    }
  }

  const addExercise = (exercise) => {
    const newEx = {
      exercise: exercise._id,
      exerciseName: exercise.name,
      muscleGroup: exercise.muscleGroup,
      targetArea: exercise.targetArea,
      videoUrl: exercise.videoUrl || null,
      sets: Array.from({ length: SETS_PER_EXERCISE }, (_, i) => defaultSet(i + 1)),
      notes: '',
      completed: false
    }
    const updated = [...exercises, newEx]
    setExercises(updated)
    setShowExercisePicker(false)
    autoSave(updated)
  }

  const removeExercise = (index) => {
    const updated = exercises.filter((_, i) => i !== index)
    setExercises(updated)
    autoSave(updated)
  }

  const updateSet = (exIdx, setIdx, field, value) => {
    setExercises(prev => prev.map((ex, i) => {
      if (i !== exIdx) return ex
      return {
        ...ex,
        sets: ex.sets.map((set, j) => {
          if (j !== setIdx) return set
          return {
            ...set,
            [field]: field === 'completed' ? value : field === 'notes' ? value : (Number(value) || 0)
          }
        })
      }
    }))
  }

  const addSet = (exIdx) => {
    setExercises(prev => prev.map((ex, i) => {
      if (i !== exIdx) return ex
      const last = ex.sets[ex.sets.length - 1]
      return {
        ...ex,
        sets: [...ex.sets, { ...defaultSet(ex.sets.length + 1), weight: last?.weight || 0, reps: last?.reps || 0 }]
      }
    }))
  }

  const removeSet = (exIdx, setIdx) => {
    setExercises(prev => prev.map((ex, i) => {
      if (i !== exIdx) return ex
      if (ex.sets.length <= 1) return ex
      return {
        ...ex,
        sets: ex.sets.filter((_, j) => j !== setIdx).map((s, j) => ({ ...s, setNumber: j + 1 }))
      }
    }))
  }

  const markExerciseComplete = (exIdx) => {
    const updated = exercises.map((ex, i) => {
      if (i !== exIdx) return ex
      const allComplete = !ex.completed
      return {
        ...ex,
        completed: allComplete,
        sets: ex.sets.map(s => ({ ...s, completed: allComplete }))
      }
    })
    setExercises(updated)
    autoSave(updated)
  }

  const autoSave = async (currentExercises) => {
    if (!session) return
    try {
      await workoutService.update(session._id, { exercises: currentExercises })
    } catch (err) { }
  }

  const saveWorkout = async () => {
    if (!session) return
    setSaving(true)
    try {
      await workoutService.update(session._id, { exercises })
      toast.success('Workout saved!')
    } catch (err) {
      toast.error('Failed to save workout.')
    } finally {
      setSaving(false)
    }
  }

  const completeWorkout = async () => {
    if (!session) return
    setCompleting(true)
    try {
      // Check for any new PRs
      const hasPR = exercises.some(ex => {
        const pr = getExercisePR(ex.exerciseName)
        const completedSets = ex.sets.filter(s => s.completed)
        if (!completedSets.length) return false
        const maxWeight = Math.max(...completedSets.map(s => s.weight || 0))
        return maxWeight > 0 && (!pr || maxWeight > pr.maxWeight)
      })

      await workoutService.update(session._id, { exercises })
      const res = await workoutService.complete(session._id, { hasPR })
      setCompletionData(res.data.gamification || null)
      setPhase('complete')
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to complete workout.'
      toast.error(msg)
    } finally {
      setCompleting(false)
    }
  }

  const getExercisePR = (exerciseName) =>
    Object.values(prData).find(pr => pr.exerciseName === exerciseName)

  const getLastPerformance = (exerciseName) => {
    const pr = getExercisePR(exerciseName)
    if (!pr?.history?.length) return null
    return pr.history[pr.history.length - 1]
  }

  const getSuggestedWeight = (exerciseName) => {
    const last = getLastPerformance(exerciseName)
    if (!last?.maxWeight) return null
    return (last.maxWeight + 2.5).toFixed(1)
  }

  // Previous sets for an exercise (from previousSession data)
  const getPrevSets = (exerciseName) => {
    if (!previousSession) return null
    const found = previousSession.exercises.find(e => e.name === exerciseName)
    return found?.sets?.length ? found.sets : null
  }

  const filteredExercises = allExercises.filter(ex =>
    !exerciseFilter ||
    ex.name.toLowerCase().includes(exerciseFilter.toLowerCase()) ||
    ex.muscleGroup.toLowerCase().includes(exerciseFilter.toLowerCase()) ||
    ex.targetArea?.toLowerCase().includes(exerciseFilter.toLowerCase())
  )

  // Group session exercises by muscle group preserving original indices
  const groupedExercises = exercises.reduce((groups, ex, idx) => {
    const mg = ex.muscleGroup || 'Other'
    if (!groups[mg]) groups[mg] = []
    groups[mg].push({ ...ex, _idx: idx })
    return groups
  }, {})

  const openVideo = (url, name) => setVideoModal({ url, name })
  const closeVideo = () => {
    if (videoRef.current) videoRef.current.pause()
    setVideoModal(null)
  }

  // ─── LOADING ────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div className="page-loader">
        <LoadingSpinner size="large" text="Loading workout..." />
      </div>
    )
  }

  // ─── COMPLETE ───────────────────────────────────────────────
  if (phase === 'complete') {
    const completed = exercises.filter(e => e.completed).length
    const totalSets = exercises.reduce((s, e) => s + e.sets.filter(st => st.completed).length, 0)
    const gam = completionData
    return (
      <div className="page-container">
        <div className="complete-screen">
          <div className="complete-confetti-bg" />
          <div className="complete-icon">🎉</div>
          <h1 className="complete-title">Workout Complete!</h1>
          <p className="complete-workout-type">{session?.workoutType}</p>

          {/* XP Awarded */}
          {gam && (
            <div className="xp-celebration">
              <div className="xp-awarded-badge">
                <span className="xp-awarded-amount">+{gam.xpAwarded}</span>
                <span className="xp-awarded-label">XP Earned</span>
              </div>
              {gam.xpBreakdown && gam.xpBreakdown.length > 0 && (
                <div className="xp-breakdown">
                  {gam.xpBreakdown.map((item, i) => (
                    <div key={i} className="xp-breakdown-item">
                      <span className="xp-breakdown-label">{item.label}</span>
                      <span className="xp-breakdown-xp">+{item.xp}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Missed XP nudge — shown when exercises or sets were skipped */}
              {gam.missedXP > 0 && (
                <div className="missed-xp-nudge">
                  <div className="missed-xp-header">
                    <span className="missed-xp-icon">⚠️</span>
                    <span className="missed-xp-title">You left <strong>{gam.missedXP} XP</strong> on the table</span>
                  </div>
                  <div className="missed-xp-reasons">
                    {gam.missedBreakdown.map((item, i) => (
                      <div key={i} className="missed-xp-item">
                        <span className="missed-xp-label">{item.label}</span>
                        <span className="missed-xp-amount">-{item.xp} XP</span>
                      </div>
                    ))}
                  </div>
                  <p className="missed-xp-tip">
                    Next time mark all sets done and complete every exercise to earn the full bonus — but it's always your call!
                  </p>
                </div>
              )}
              {gam.leveledUp && (
                <div className="level-up-banner">
                  <span className="level-up-icon">⭐</span>
                  <span className="level-up-text">LEVEL UP! You're now Level {gam.newLevel}!</span>
                  <span className="level-up-icon">⭐</span>
                </div>
              )}
              {gam.newAchievements && gam.newAchievements.length > 0 && (
                <div className="new-achievements">
                  <h4>Achievement Unlocked!</h4>
                  {gam.newAchievements.map((ach, i) => (
                    <div key={i} className="achievement-unlock-item">
                      <span className="achievement-icon-large">{ach.icon}</span>
                      <div>
                        <div className="achievement-name">{ach.name}</div>
                        <div className="achievement-desc">{ach.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {gam.xpInfo && (
                <div className="completion-xp-bar">
                  <div className="xp-bar-header">
                    <span className="xp-level-badge">LVL {gam.xpInfo.level}</span>
                    <span className="xp-numbers">{gam.xpInfo.xpIntoLevel} / {gam.xpInfo.xpForLevel} XP</span>
                  </div>
                  <div className="xp-track">
                    <div className="xp-fill" style={{ width: `${gam.xpInfo.percent}%` }} />
                  </div>
                </div>
              )}
              {gam.currentStreak > 1 && (
                <div className="streak-badge-complete">
                  🔥 {gam.currentStreak}-Day Streak!
                </div>
              )}
            </div>
          )}

          <div className="complete-stats">
            <div className="complete-stat">
              <span className="complete-stat-value">{completed}</span>
              <span className="complete-stat-label">Exercises</span>
            </div>
            <div className="complete-stat">
              <span className="complete-stat-value">{totalSets}</span>
              <span className="complete-stat-label">Sets</span>
            </div>
            <div className="complete-stat">
              <span className="complete-stat-value">{timer}</span>
              <span className="complete-stat-label">Minutes</span>
            </div>
          </div>
          <div className="complete-actions">
            <button className="btn btn-primary" onClick={() => navigate('/game-map')}>View Game Map</button>
            <button className="btn btn-secondary" onClick={() => navigate('/history')}>View History</button>
          </div>
        </div>
      </div>
    )
  }

  // ─── SELECT ─────────────────────────────────────────────────
  if (phase === 'select') {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1>Start Workout</h1>
          <p className="page-subtitle">Choose your workout for today</p>
        </div>

        {recommendation && (
          <div className="recommendation-banner">
            <span className="rec-icon">💡</span>
            <p>Recommended: <strong>{
              recommendation.workoutType === 'Chest + Triceps + Lower Back'
                ? 'Chest + Triceps'
                : recommendation.workoutType
            }</strong> · Week {recommendation.weekNumber}</p>
          </div>
        )}

        {/* Previous session info on select screen */}
        {previousSession && (
          <div className="prev-session-banner">
            <div className="prev-session-header">
              <span className="prev-icon">🔄</span>
              <span>
                <strong>Last {selectedType.type}</strong> —{' '}
                {new Date(previousSession.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </span>
            </div>
            <div className="prev-session-exercises">
              {previousSession.exercises.slice(0, 6).map((e, i) => (
                <span key={i} className="prev-ex-chip">
                  {e.name}
                  {e.targetArea ? <em> · {e.targetArea}</em> : null}
                </span>
              ))}
            </div>
            <p className="prev-session-note">Today's exercises are varied to target the same muscles differently.</p>
          </div>
        )}

        <div className="workout-type-grid">
          {WORKOUT_TYPES.map(wt => (
            <div
              key={wt.type}
              className={`workout-type-card ${selectedType.type === wt.type ? 'workout-type-selected' : ''}`}
              onClick={() => {
                setSelectedType(wt)
                loadSuggestions(wt.type)
              }}
              style={{ borderColor: selectedType.type === wt.type ? WORKOUT_COLORS[wt.type] : '' }}
            >
              <div className="workout-type-day" style={{ color: WORKOUT_COLORS[wt.type] }}>Day {wt.dayNumber}</div>
              <div className="workout-type-name">{wt.type}</div>
              <div className="workout-type-muscles">
                {wt.muscles.map(m => <span key={m} className="muscle-tag">{m}</span>)}
              </div>
              {(recommendation?.workoutType === wt.type ||
                (recommendation?.workoutType === 'Chest + Triceps + Lower Back' && wt.type === 'Chest + Triceps')) && (
                <span className="recommended-badge">Recommended</span>
              )}
            </div>
          ))}
        </div>

        {/* Variation preview */}
        {suggestions.length > 0 && (
          <div className="suggestions-preview">
            <h4>Today's Suggested Exercises <span className="variation-badge">Varied from last session</span></h4>
            <div className="suggestions-list">
              {suggestions.map((ex, i) => (
                <div key={i} className={`suggestion-chip ${ex.usedLastSession ? 'suggestion-repeat' : 'suggestion-new'}`}>
                  <span className="suggestion-name">{ex.name}</span>
                  <span className="suggestion-target">{ex.targetArea}</span>
                  {!ex.usedLastSession && <span className="new-badge">New</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        <button className="btn btn-primary btn-large btn-full" onClick={startSession} disabled={saving}>
          {saving ? 'Starting...' : `Start: ${selectedType.type}`}
        </button>
      </div>
    )
  }

  // ─── SESSION ─────────────────────────────────────────────────
  const workoutColor = WORKOUT_COLORS[session?.workoutType] || '#16a34a'
  const completedExercises = exercises.filter(e => e.completed).length
  const sessionProgress = exercises.length ? Math.round((completedExercises / exercises.length) * 100) : 0

  return (
    <div className="page-container">
      {/* Header */}
      <div className="session-header" style={{ borderBottomColor: workoutColor }}>
        <div>
          <h1 style={{ color: workoutColor }}>
            {session?.workoutType === 'Chest + Triceps + Lower Back' ? 'Chest + Triceps' : session?.workoutType}
          </h1>
          <p className="page-subtitle">Week {session?.weekNumber} · Day {session?.dayNumber} · {timer}m</p>
        </div>
        <div className="session-progress-badge">
          <span>{completedExercises}/{exercises.length}</span>
          <small>exercises</small>
        </div>
      </div>

      <div className="session-progress-bar">
        <div className="session-progress-fill" style={{ width: `${sessionProgress}%`, backgroundColor: workoutColor }} />
      </div>

      {/* Exercises grouped by muscle */}
      <div className="exercises-list">
        {Object.entries(groupedExercises).map(([muscleGroup, muscleExercises]) => {
          const muscleColor = MUSCLE_COLORS[muscleGroup] || workoutColor
          const completedInGroup = muscleExercises.filter(e => e.completed).length
          return (
            <div key={muscleGroup} className="muscle-group-section">
              <div className="muscle-group-header" style={{ borderLeftColor: muscleColor }}>
                <div className="muscle-group-title" style={{ color: muscleColor }}>{muscleGroup}</div>
                <div className="muscle-group-progress">
                  <span className="muscle-progress-text">{completedInGroup}/{muscleExercises.length} done</span>
                  <div className="muscle-progress-bar">
                    <div
                      className="muscle-progress-fill"
                      style={{
                        width: `${muscleExercises.length ? (completedInGroup / muscleExercises.length) * 100 : 0}%`,
                        backgroundColor: muscleColor
                      }}
                    />
                  </div>
                </div>
              </div>

              {muscleExercises.map((ex) => {
                const exIdx = ex._idx
                const pr = getExercisePR(ex.exerciseName)
                const lastPerf = getLastPerformance(ex.exerciseName)
                const suggestedWeight = getSuggestedWeight(ex.exerciseName)
                const prevSets = getPrevSets(ex.exerciseName)
                const completedSets = ex.sets.filter(s => s.completed).length

                return (
                  <div key={exIdx} className={`exercise-card ${ex.completed ? 'exercise-completed' : ''}`}>
                    <div className="exercise-header">
                      <div className="exercise-info">
                        <h3>{ex.exerciseName}</h3>
                        <div className="exercise-meta">
                          <span className="muscle-tag" style={{ backgroundColor: muscleColor + '22', color: muscleColor }}>
                            {ex.muscleGroup}
                          </span>
                          {ex.targetArea && <span className="target-tag">{ex.targetArea}</span>}
                          <span className="sets-progress-tag">{completedSets}/{ex.sets.length} sets</span>
                        </div>
                      </div>
                      <div className="exercise-actions">
                        {ex.videoUrl && (
                          <button
                            className="btn-video"
                            onClick={() => openVideo(SERVER_BASE + ex.videoUrl, ex.exerciseName)}
                            title="Watch exercise video"
                          >
                            ▶
                          </button>
                        )}
                        <button
                          className={`btn-mark-complete ${ex.completed ? 'btn-mark-done' : ''}`}
                          onClick={() => markExerciseComplete(exIdx)}
                          title={ex.completed ? 'Mark incomplete' : 'Mark all sets done'}
                        >
                          {ex.completed ? '✓' : '○'}
                        </button>
                        <button className="btn-remove" onClick={() => removeExercise(exIdx)} title="Remove exercise">✕</button>
                      </div>
                    </div>

                    {/* Previous performance comparison */}
                    {prevSets && prevSets.some(s => s.weight > 0 || s.reps > 0) && (
                      <div className="prev-performance">
                        <span className="prev-perf-label">Last session: </span>
                        {prevSets
                          .filter(s => s.weight > 0 || s.reps > 0)
                          .map((s, i, arr) => (
                            <span key={i} className="prev-perf-set">
                              {s.weight}kg × {s.reps}{i < arr.length - 1 ? ' · ' : ''}
                            </span>
                          ))}
                      </div>
                    )}

                    {/* PR row */}
                    {(pr || lastPerf) && !prevSets && (
                      <div className="exercise-pr-row">
                        {lastPerf && <span className="pr-prev">Last: {lastPerf.maxWeight}kg</span>}
                        {suggestedWeight && <span className="pr-suggested">Suggested: {suggestedWeight}kg</span>}
                        {pr?.maxWeight > 0 && <span className="pr-best">PR: {pr.maxWeight}kg</span>}
                      </div>
                    )}

                    {/* Sets Table */}
                    <div className="sets-table">
                      <div className="sets-header">
                        <span>Set</span>
                        <span>Weight (kg)</span>
                        <span>Reps</span>
                        <span>Done</span>
                        <span></span>
                      </div>
                      {ex.sets.map((set, setIdx) => (
                        <div key={setIdx} className={`set-row ${set.completed ? 'set-completed' : ''}`}>
                          <span className="set-number">{set.setNumber}</span>
                          <input
                            type="number"
                            className="set-input"
                            value={set.weight || ''}
                            onChange={e => updateSet(exIdx, setIdx, 'weight', e.target.value)}
                            placeholder={prevSets?.[setIdx]?.weight || '0'}
                            min="0"
                            step="0.5"
                          />
                          <input
                            type="number"
                            className="set-input"
                            value={set.reps || ''}
                            onChange={e => updateSet(exIdx, setIdx, 'reps', e.target.value)}
                            placeholder={prevSets?.[setIdx]?.reps || '0'}
                            min="0"
                          />
                          <input
                            type="checkbox"
                            className="set-checkbox"
                            checked={set.completed}
                            onChange={e => updateSet(exIdx, setIdx, 'completed', e.target.checked)}
                          />
                          <button
                            className="btn-remove-set"
                            onClick={() => removeSet(exIdx, setIdx)}
                            disabled={ex.sets.length <= 1}
                          >✕</button>
                        </div>
                      ))}
                    </div>

                    <div className="exercise-footer">
                      <button className="btn btn-secondary btn-sm" onClick={() => addSet(exIdx)}>+ Add Set</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}

        {exercises.length === 0 && (
          <div className="empty-state">
            <p>No exercises added yet.</p>
            <p>Click "+ Add Exercise" to start.</p>
          </div>
        )}
      </div>

      <button className="btn btn-secondary btn-add-exercise" onClick={() => setShowExercisePicker(true)}>
        + Add Exercise
      </button>

      {/* Exercise Picker Modal */}
      {showExercisePicker && (
        <div className="modal-overlay" onClick={() => setShowExercisePicker(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Exercise</h3>
              <button className="modal-close" onClick={() => setShowExercisePicker(false)}>✕</button>
            </div>
            <input
              type="text"
              className="modal-search"
              placeholder="Search exercises..."
              value={exerciseFilter}
              onChange={e => setExerciseFilter(e.target.value)}
              autoFocus
            />
            <div className="modal-list">
              {filteredExercises.map(ex => (
                <div key={ex._id} className="modal-exercise-item" onClick={() => addExercise(ex)}>
                  <div>
                    <strong>{ex.name}</strong>
                    <div className="exercise-meta">
                      <span className="muscle-tag">{ex.muscleGroup}</span>
                      <span className="target-tag">{ex.targetArea}</span>
                      {ex.videoUrl && <span className="video-available-tag">Video</span>}
                    </div>
                  </div>
                  <span className="modal-add-icon">+</span>
                </div>
              ))}
              {filteredExercises.length === 0 && <p className="modal-empty">No exercises found</p>}
            </div>
          </div>
        </div>
      )}

      {/* Video Player Modal */}
      {videoModal && (
        <div className="modal-overlay video-modal-overlay" onClick={closeVideo}>
          <div className="video-modal" onClick={e => e.stopPropagation()}>
            <div className="video-modal-header">
              <h3>{videoModal.name}</h3>
              <button className="modal-close" onClick={closeVideo}>✕</button>
            </div>
            <div className="video-container">
              <video
                ref={videoRef}
                className="exercise-video"
                src={videoModal.url}
                controls
                autoPlay
                playsInline
              >
                Your browser does not support video playback.
              </video>
            </div>
          </div>
        </div>
      )}

      {/* Session Actions */}
      <div className="session-actions">
        <button className="btn btn-secondary" onClick={saveWorkout} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </button>
        {session?.status !== 'completed' && (
          <button
            className="btn btn-success btn-large"
            onClick={completeWorkout}
            disabled={completing || exercises.length === 0}
          >
            {completing ? 'Completing...' : 'Complete Workout'}
          </button>
        )}
      </div>
    </div>
  )
}

export default GymSession

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { dashboardService } from '../services'
import LoadingSpinner from '../components/LoadingSpinner'
import ProgressBar from '../components/ProgressBar'
import { formatDate, daysAgo, formatWater, getGreeting } from '../utils/formatters'

const WORKOUT_COLORS = {
  'Chest + Triceps + Lower Back': '#16a34a',
  'Back + Biceps': '#0077b6',
  'Legs + Shoulders': '#2d6a4f',
  'Arms + Abs': '#9d4edd'
}

const Dashboard = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadDashboard()
  }, [])

  const loadDashboard = async () => {
    setLoading(true)
    try {
      const res = await dashboardService.get()
      setData(res.data.dashboard)
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load dashboard.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return (
    <div className="page-loader">
      <LoadingSpinner size="large" text="Loading dashboard..." />
    </div>
  )

  if (error) return (
    <div className="error-state">
      <p>{error}</p>
      <button className="btn btn-primary" onClick={loadDashboard}>Retry</button>
    </div>
  )

  const d = data
  const workoutColor = WORKOUT_COLORS[d.todaySession?.workoutType || d.nextWorkout?.workoutType] || '#16a34a'

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>{getGreeting()}, {user?.name?.split(' ')[0]}!</h1>
          <p className="page-subtitle">{formatDate(new Date())} · Week {d.currentWeek} of {d.totalWeeks}</p>
        </div>
        <div className="week-badge">
          <span>Week {d.currentWeek}/{d.totalWeeks}</span>
        </div>
      </div>

      {/* Reminders */}
      {d.reminders?.length > 0 && (
        <div className="reminders">
          {d.reminders.map((r, i) => (
            <div key={i} className={`reminder reminder-${r.type}`}>
              <span className="reminder-icon">
                {r.type === 'workout' ? '💪' : r.type === 'protein' ? '🍗' : '💧'}
              </span>
              <span>{r.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Stats Row */}
      <div className="stats-row">
        <div className="stat-card">
          <span className="stat-label">Streak</span>
          <span className="stat-value">{d.streak}</span>
          <span className="stat-unit">days</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Completed</span>
          <span className="stat-value">{d.completedWorkouts}</span>
          <span className="stat-unit">workouts</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">This week</span>
          <span className="stat-value">{d.currentWeek}</span>
          <span className="stat-unit">of 12</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Progress</span>
          <span className="stat-value">{d.completionPercent}%</span>
          <span className="stat-unit">complete</span>
        </div>
      </div>

      {/* Main Grid */}
      <div className="dashboard-grid">

        {/* Today's Workout Card */}
        <div className="card card-workout" style={{ borderLeftColor: workoutColor }}>
          <div className="card-header">
            <h3>Today's Workout</h3>
            <span className={`badge ${d.todaySession?.status === 'completed' ? 'badge-success' :
              d.todaySession?.status === 'in_progress' ? 'badge-warning' : 'badge-neutral'}`}>
              {d.todaySession ? d.todaySession.status.replace('_', ' ') : 'Not Started'}
            </span>
          </div>

          <div className="workout-type" style={{ color: workoutColor }}>
            {d.todaySession?.workoutType || d.nextWorkout?.workoutType || 'Rest Day'}
          </div>

          {d.lastWorkout && (
            <p className="workout-last">
              Last workout: <strong>{d.lastWorkout.workoutType}</strong> · {daysAgo(d.lastWorkout.date)}
            </p>
          )}

          <div className="card-actions">
            {d.todaySession?.status === 'completed' ? (
              <button
                className="btn btn-secondary"
                onClick={() => navigate(`/gym-session/${d.todaySession._id}`)}
              >
                View Workout
              </button>
            ) : d.todaySession?.status === 'in_progress' ? (
              <button
                className="btn btn-primary"
                onClick={() => navigate(`/gym-session/${d.todaySession._id}`)}
              >
                Continue Workout
              </button>
            ) : (
              <button
                className="btn btn-primary"
                onClick={() => navigate('/gym-session')}
              >
                Start Workout
              </button>
            )}
          </div>
        </div>

        {/* Protein Card */}
        <div className="card card-nutrition">
          <div className="card-header">
            <h3>Protein</h3>
            <span className="card-icon">🍗</span>
          </div>
          <div className="macro-display">
            <span className="macro-value">{Math.round(d.todayFood?.protein || 0)}g</span>
            <span className="macro-target">/ {d.goals?.protein}g</span>
          </div>
          <ProgressBar
            value={d.todayFood?.protein || 0}
            max={d.goals?.protein}
            color="protein"
          />
          <p className="macro-remaining">
            {Math.max(0, d.goals?.protein - (d.todayFood?.protein || 0)).toFixed(0)}g remaining
          </p>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/food')}>
            Add Food
          </button>
        </div>

        {/* Calories Card */}
        <div className="card card-nutrition">
          <div className="card-header">
            <h3>Calories</h3>
            <span className="card-icon">🔥</span>
          </div>
          <div className="macro-display">
            <span className="macro-value">{Math.round(d.todayFood?.calories || 0)}</span>
            <span className="macro-target">/ {d.goals?.calories} kcal</span>
          </div>
          <ProgressBar
            value={d.todayFood?.calories || 0}
            max={d.goals?.calories}
            color="calories"
          />
          <div className="macro-breakdown">
            <span>P: {Math.round(d.todayFood?.protein || 0)}g</span>
            <span>C: {Math.round(d.todayFood?.carbs || 0)}g</span>
            <span>F: {Math.round(d.todayFood?.fat || 0)}g</span>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/food')}>
            Log Meal
          </button>
        </div>

        {/* Water Card */}
        <div className="card card-water">
          <div className="card-header">
            <h3>Water</h3>
            <span className="card-icon">💧</span>
          </div>
          <div className="macro-display">
            <span className="macro-value">{formatWater(d.todayWaterMl || 0)}</span>
            <span className="macro-target">/ {formatWater(d.goals?.waterMl)}</span>
          </div>
          <ProgressBar
            value={d.todayWaterMl || 0}
            max={d.goals?.waterMl}
            color="water"
          />
          <p className="macro-remaining">
            {formatWater(Math.max(0, d.goals?.waterMl - (d.todayWaterMl || 0)))} remaining
          </p>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/water')}>
            Add Water
          </button>
        </div>

      </div>

      {/* 3-Month Progress Bar */}
      <div className="card plan-progress-card">
        <div className="card-header">
          <h3>3-Month Plan Progress</h3>
          <span className="badge badge-info">Week {d.currentWeek}/12</span>
        </div>
        <div className="plan-weeks">
          {Array.from({ length: 12 }, (_, i) => i + 1).map(w => (
            <div
              key={w}
              className={`week-dot ${w < d.currentWeek ? 'week-done' : w === d.currentWeek ? 'week-current' : 'week-future'}`}
              title={`Week ${w}`}
            >
              {w}
            </div>
          ))}
        </div>
        <ProgressBar value={d.completionPercent} max={100} color="primary" />
        <p className="plan-stats">
          {d.completedWorkouts} workouts completed · {d.missedWorkouts} missed · {d.streak} day streak
        </p>
      </div>

      {/* Recently Trained */}
      {Object.keys(d.recentMuscles || {}).length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3>Recently Trained</h3>
          </div>
          <div className="muscle-grid">
            {Object.entries(d.recentMuscles).map(([muscle, info]) => (
              <div key={muscle} className="muscle-chip">
                <span className="muscle-name">{muscle}</span>
                <span className={`muscle-days ${info.daysAgo <= 2 ? 'days-recent' : info.daysAgo <= 4 ? 'days-medium' : 'days-old'}`}>
                  {info.daysAgo === 0 ? 'Today' : `${info.daysAgo}d ago`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Next Workout */}
      {d.nextWorkout && (
        <div className="card card-next-workout">
          <div className="card-header">
            <h3>Next Workout</h3>
          </div>
          <div className="next-workout-type"
            style={{ color: WORKOUT_COLORS[d.nextWorkout.workoutType] }}>
            {d.nextWorkout.workoutType}
          </div>
          <div className="next-workout-muscles">
            {d.nextWorkout.muscleGroups?.map(mg => (
              <span key={mg} className="muscle-tag">{mg}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default Dashboard

import { useState, useEffect } from 'react'
import { workoutService, foodService } from '../services'
import LoadingSpinner from '../components/LoadingSpinner'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'

// Names must match exactly what is in the seed (server/utils/seed.js)
const TRACKED_EXERCISES = [
  'Barbell Bench Press', 'Incline Barbell Bench Press', 'Squat', 'Romanian Deadlift',
  'Overhead Press', 'Lat Pulldown', 'Barbell Row', 'Barbell Curl'
]

const Progress = () => {
  const [workoutStats, setWorkoutStats] = useState(null)
  const [strengthData, setStrengthData] = useState({})
  const [nutritionData, setNutritionData] = useState(null)
  const [selectedExercise, setSelectedExercise] = useState('Barbell Bench Press')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadProgress()
  }, [])

  const loadProgress = async () => {
    setLoading(true)
    setError('')
    try {
      const [workoutsRes, prsRes, nutritionRes] = await Promise.all([
        workoutService.getAll({ limit: 200 }),
        workoutService.getPRs(),
        foodService.getWeekly()
      ])

      const sessions = workoutsRes.data.sessions

      // Calculate stats per week
      const weekStats = {}
      sessions.forEach(s => {
        const w = s.weekNumber
        if (!weekStats[w]) weekStats[w] = { week: w, completed: 0, missed: 0, total: 0 }
        weekStats[w].total++
        if (s.status === 'completed') weekStats[w].completed++
        if (s.status === 'missed') weekStats[w].missed++
      })

      const completed = sessions.filter(s => s.status === 'completed')
      const missed = sessions.filter(s => s.status === 'missed')

      // Streak
      let streak = 0
      const sorted = [...completed].sort((a, b) => new Date(b.date) - new Date(a.date))
      if (sorted.length > 0) {
        streak = 1
        for (let i = 1; i < Math.min(sorted.length, 30); i++) {
          const diff = (new Date(sorted[i - 1].date) - new Date(sorted[i].date)) / (1000 * 60 * 60 * 24)
          if (diff <= 3) streak++
          else break
        }
      }

      setWorkoutStats({
        total: sessions.length,
        completed: completed.length,
        missed: missed.length,
        streak,
        weeklyCompletion: Object.values(weekStats).sort((a, b) => a.week - b.week)
      })

      // Strength progress by exercise
      const prs = prsRes.data.prs || {}
      const strengthByEx = {}
      Object.values(prs).forEach(pr => {
        if (pr.history?.length > 0) {
          strengthByEx[pr.exerciseName] = pr.history.map(h => ({
            week: `W${h.weekNumber}`,
            weight: h.maxWeight,
            volume: Math.round(h.volume)
          }))
        }
      })
      setStrengthData(strengthByEx)

      setNutritionData(nutritionRes.data)
    } catch (err) {
      setError('Unable to load progress data.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="page-loader"><LoadingSpinner size="large" text="Loading progress..." /></div>
  if (error) return <div className="error-state"><p>{error}</p><button className="btn btn-primary" onClick={loadProgress}>Retry</button></div>

  const currentStrengthData = strengthData[selectedExercise] || []
  const weeklyNutrition = nutritionData?.byDay
    ? Object.entries(nutritionData.byDay).map(([date, vals]) => ({
      date: date.slice(5),
      calories: Math.round(vals.calories),
      protein: Math.round(vals.protein)
    }))
    : []

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>3-Month Progress</h1>
        <p className="page-subtitle">Track your fitness journey</p>
      </div>

      {/* Workout Stats */}
      <div className="card">
        <h3>Workout Statistics</h3>
        <div className="stats-row">
          <div className="stat-card">
            <span className="stat-label">Total Sessions</span>
            <span className="stat-value">{workoutStats?.total || 0}</span>
          </div>
          <div className="stat-card stat-card-success">
            <span className="stat-label">Completed</span>
            <span className="stat-value">{workoutStats?.completed || 0}</span>
          </div>
          <div className="stat-card stat-card-danger">
            <span className="stat-label">Missed</span>
            <span className="stat-value">{workoutStats?.missed || 0}</span>
          </div>
          <div className="stat-card stat-card-primary">
            <span className="stat-label">Streak</span>
            <span className="stat-value">{workoutStats?.streak || 0}</span>
            <span className="stat-unit">days</span>
          </div>
        </div>
      </div>

      {/* Weekly Completion Chart */}
      {workoutStats?.weeklyCompletion?.length > 0 && (
        <div className="card">
          <h3>Weekly Workouts Completed</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={workoutStats.weeklyCompletion}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="week" tick={{ fill: '#6b7280', fontSize: 12 }} tickFormatter={v => `W${v}`} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', color: '#111827' }}
              />
              <Line type="monotone" dataKey="completed" stroke="#16a34a" strokeWidth={2} dot={{ fill: '#16a34a' }} name="Completed" />
              <Line type="monotone" dataKey="missed" stroke="#dc2626" strokeWidth={2} dot={{ fill: '#dc2626' }} name="Missed" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Strength Progress */}
      <div className="card">
        <div className="card-header">
          <h3>Strength Progress</h3>
          <select
            className="filter-select"
            value={selectedExercise}
            onChange={e => setSelectedExercise(e.target.value)}
          >
            {TRACKED_EXERCISES.map(ex => (
              <option key={ex} value={ex}>{ex}</option>
            ))}
          </select>
        </div>

        {currentStrengthData.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={currentStrengthData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="week" tick={{ fill: '#6b7280', fontSize: 12 }} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} unit="kg" />
              <Tooltip
                contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', color: '#111827' }}
                formatter={(v) => [`${v}kg`, 'Max Weight']}
              />
              <Line
                type="monotone"
                dataKey="weight"
                stroke="#16a34a"
                strokeWidth={2.5}
                dot={{ fill: '#16a34a', r: 4 }}
                name="Max Weight"
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="empty-state">
            <p>No data for {selectedExercise} yet.</p>
            <p className="empty-state-sub">Complete workouts to track progress.</p>
          </div>
        )}
      </div>

      {/* Nutrition Progress */}
      {weeklyNutrition.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3>Weekly Nutrition</h3>
            {nutritionData?.averages && (
              <div className="nutrition-avg-chips">
                <span className="avg-chip">Avg: {nutritionData.averages.calories} kcal</span>
                <span className="avg-chip avg-chip-protein">Protein: {nutritionData.averages.protein}g</span>
              </div>
            )}
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={weeklyNutrition}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} />
              <YAxis yAxisId="left" tick={{ fill: '#6b7280', fontSize: 12 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: '#6b7280', fontSize: 12 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', color: '#111827' }}
              />
              <Legend wrapperStyle={{ color: '#6b7280' }} />
              <Line yAxisId="left" type="monotone" dataKey="calories" stroke="#16a34a" strokeWidth={2} name="Calories" />
              <Line yAxisId="right" type="monotone" dataKey="protein" stroke="#f59e0b" strokeWidth={2} name="Protein (g)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

export default Progress

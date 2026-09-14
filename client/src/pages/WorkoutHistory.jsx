import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { workoutService } from '../services'
import LoadingSpinner from '../components/LoadingSpinner'
import { formatDate, formatDuration, daysAgo } from '../utils/formatters'

const STATUS_COLORS = {
  completed: '#2d6a4f',
  in_progress: '#16a34a',
  missed: '#d00000',
  skipped: '#6b7280',
  scheduled: '#0077b6'
}

const WORKOUT_COLORS = {
  'Chest + Triceps': '#16a34a',
  'Chest + Triceps + Lower Back': '#16a34a', // legacy key
  'Back + Biceps': '#0077b6',
  'Legs + Shoulders': '#2d6a4f',
  'Arms + Abs': '#9d4edd'
}

const WorkoutHistory = () => {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({ status: '', week: '' })
  const [expandedId, setExpandedId] = useState(null)

  useEffect(() => {
    loadHistory()
  }, [page, filters])

  const loadHistory = async () => {
    setLoading(true)
    setError('')
    try {
      const params = { page, limit: 10 }
      if (filters.status) params.status = filters.status
      if (filters.week) params.week = filters.week
      const res = await workoutService.getAll(params)
      setSessions(res.data.sessions)
      setTotal(res.data.total)
      setPages(res.data.pages)
    } catch (err) {
      setError('Unable to load workout history.')
    } finally {
      setLoading(false)
    }
  }

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id)
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Workout History</h1>
          <p className="page-subtitle">{total} total sessions</p>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-row">
        <select
          value={filters.status}
          onChange={e => { setFilters({ ...filters, status: e.target.value }); setPage(1) }}
          className="filter-select"
        >
          <option value="">All Status</option>
          <option value="completed">Completed</option>
          <option value="in_progress">In Progress</option>
          <option value="missed">Missed</option>
          <option value="scheduled">Scheduled</option>
        </select>

        <select
          value={filters.week}
          onChange={e => { setFilters({ ...filters, week: e.target.value }); setPage(1) }}
          className="filter-select"
        >
          <option value="">All Weeks</option>
          {Array.from({ length: 12 }, (_, i) => i + 1).map(w => (
            <option key={w} value={w}>Week {w}</option>
          ))}
        </select>

        <button
          className="btn btn-secondary btn-sm"
          onClick={() => { setFilters({ status: '', week: '' }); setPage(1) }}
        >
          Clear
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <LoadingSpinner text="Loading history..." />
      ) : sessions.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state-icon">📋</p>
          <p>No workouts completed yet.</p>
          <button className="btn btn-primary" onClick={() => navigate('/gym-session')}>
            Start Your First Workout
          </button>
        </div>
      ) : (
        <>
          <div className="history-list">
            {sessions.map(session => (
              <div key={session._id} className="history-card">
                <div
                  className="history-card-header"
                  onClick={() => toggleExpand(session._id)}
                  style={{ borderLeftColor: WORKOUT_COLORS[session.workoutType] || '#16a34a' }}
                >
                  <div className="history-main">
                    <div className="history-date">{formatDate(session.date)}</div>
                    <div className="history-type" style={{ color: WORKOUT_COLORS[session.workoutType] }}>
                      {session.workoutType}
                    </div>
                    <div className="history-meta">
                      <span>Week {session.weekNumber}</span>
                      <span>·</span>
                      <span>{session.exercises?.length || 0} exercises</span>
                      {session.duration > 0 && (
                        <>
                          <span>·</span>
                          <span>{formatDuration(session.duration)}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="history-right">
                    <span
                      className="badge"
                      style={{ backgroundColor: STATUS_COLORS[session.status] + '33', color: STATUS_COLORS[session.status] }}
                    >
                      {session.status.replace('_', ' ')}
                    </span>
                    <span className="expand-icon">{expandedId === session._id ? '▲' : '▼'}</span>
                  </div>
                </div>

                {/* Expanded Detail */}
                {expandedId === session._id && (
                  <div className="history-detail">
                    {session.exercises?.map((ex, i) => (
                      <div key={i} className="history-exercise">
                        <div className="history-ex-name">
                          <span className={`ex-dot ${ex.completed ? 'ex-dot-done' : ''}`} />
                          {ex.exerciseName}
                          <span className="muscle-tag-sm">{ex.muscleGroup}</span>
                        </div>
                        <div className="history-sets">
                          {ex.sets?.filter(s => s.completed).map((set, j) => (
                            <span key={j} className="set-chip">
                              {set.weight}kg × {set.reps}
                            </span>
                          ))}
                          {ex.sets?.filter(s => s.completed).length === 0 && (
                            <span className="set-chip-empty">No sets completed</span>
                          )}
                        </div>
                      </div>
                    ))}
                    {session.notes && (
                      <div className="history-notes">
                        <strong>Notes:</strong> {session.notes}
                      </div>
                    )}
                    {session.status === 'in_progress' && (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => navigate(`/gym-session/${session._id}`)}
                      >
                        Continue Workout
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Pagination */}
          {pages > 1 && (
            <div className="pagination">
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                ← Prev
              </button>
              <span className="pagination-info">Page {page} of {pages}</span>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setPage(p => Math.min(pages, p + 1))}
                disabled={page === pages}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default WorkoutHistory

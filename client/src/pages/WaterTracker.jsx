import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { waterService } from '../services'
import LoadingSpinner from '../components/LoadingSpinner'
import ProgressBar from '../components/ProgressBar'
import { toDateString, formatWater } from '../utils/formatters'
import { useToast } from '../context/ToastContext'

const QUICK_AMOUNTS = [250, 500, 750, 1000]

const WaterTracker = () => {
  const { user } = useAuth()
  const toast = useToast()
  const [date, setDate] = useState(toDateString())
  const [entries, setEntries] = useState([])
  const [totalMl, setTotalMl] = useState(0)
  const [loading, setLoading] = useState(true)
  const [customAmount, setCustomAmount] = useState('')
  const [adding, setAdding] = useState(false)

  // Reminder state
  const [reminderEnabled, setReminderEnabled] = useState(false)
  const [reminderHours, setReminderHours] = useState([8,10,12,14,16,18,20,22])
  const [reminderLoading, setReminderLoading] = useState(false)

  const goal = user?.waterGoal || 3000

  useEffect(() => {
    loadWater()
  }, [date])

  useEffect(() => {
    loadReminderSettings()
  }, [])

  const loadWater = async () => {
    setLoading(true)
    try {
      const res = await waterService.getByDate(date)
      setEntries(res.data.entries)
      setTotalMl(res.data.totalMl)
    } catch (err) {
      toast.error('Unable to load water entries.')
    } finally {
      setLoading(false)
    }
  }

  const loadReminderSettings = async () => {
    try {
      const res = await waterService.getReminderSettings()
      setReminderEnabled(res.data.waterReminderEnabled)
      setReminderHours(res.data.waterReminderHours)
    } catch (err) {
      // Non-critical — silently ignore
    }
  }

  const toggleReminder = async () => {
    setReminderLoading(true)
    try {
      const res = await waterService.updateReminderSettings({ enabled: !reminderEnabled })
      setReminderEnabled(res.data.waterReminderEnabled)
      toast.success(res.data.message)
    } catch (err) {
      toast.error('Failed to update reminder settings.')
    } finally {
      setReminderLoading(false)
    }
  }

  const addWater = async (amountMl) => {
    if (!amountMl || amountMl <= 0) return
    setAdding(true)
    try {
      await waterService.add({ amountMl: parseInt(amountMl), date })
      toast.success(`${formatWater(parseInt(amountMl))} logged!`)
      setCustomAmount('')
      loadWater()
    } catch (err) {
      toast.error('Failed to log water.')
    } finally {
      setAdding(false)
    }
  }

  const deleteEntry = async (id) => {
    try {
      await waterService.delete(id)
      toast.info('Water entry removed.')
      loadWater()
    } catch (err) {
      toast.error('Failed to delete entry.')
    }
  }

  const pct = Math.min(Math.round((totalMl / goal) * 100), 100)

  const getWaterStatus = () => {
    if (pct >= 100) return { msg: 'Goal reached! Great job!', color: '#2d6a4f' }
    if (pct >= 75) return { msg: 'Almost there, keep going!', color: '#0077b6' }
    if (pct >= 50) return { msg: 'Halfway there, stay hydrated!', color: '#16a34a' }
    return { msg: 'Start hydrating!', color: '#9d4edd' }
  }

  const status = getWaterStatus()

  // Format reminder hours as a readable string, e.g. "8am, 10am, 12pm ..."
  const formatHour = (h) => {
    if (h === 0) return '12am'
    if (h < 12) return `${h}am`
    if (h === 12) return '12pm'
    return `${h - 12}pm`
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Water Tracker</h1>
          <p className="page-subtitle">Stay hydrated throughout the day</p>
        </div>
      </div>

      {/* Date Selector */}
      <div className="date-selector">
        <button className="btn btn-icon" onClick={() => {
          const d = new Date(date); d.setDate(d.getDate() - 1); setDate(toDateString(d))
        }}>←</button>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="date-input" />
        <button className="btn btn-icon" onClick={() => {
          const d = new Date(date); d.setDate(d.getDate() + 1); setDate(toDateString(d))
        }}>→</button>
        <button className="btn btn-secondary btn-sm" onClick={() => setDate(toDateString())}>Today</button>
      </div>

      {loading ? (
        <LoadingSpinner text="Loading water data..." />
      ) : (
        <>
          {/* Water Gauge */}
          <div className="water-gauge-card card">
            <div className="water-gauge-display">
              <div className="water-bottle">
                <div
                  className="water-fill"
                  style={{ height: `${pct}%` }}
                />
                <div className="water-amount-label">
                  <span className="water-current">{formatWater(totalMl)}</span>
                  <span className="water-target">/ {formatWater(goal)}</span>
                </div>
              </div>
              <div className="water-info">
                <div className="water-percent">{pct}%</div>
                <div className="water-status" style={{ color: status.color }}>{status.msg}</div>
                <div className="water-remaining">
                  {totalMl < goal
                    ? `${formatWater(goal - totalMl)} to go`
                    : 'Daily goal achieved!'}
                </div>
              </div>
            </div>
            <ProgressBar value={totalMl} max={goal} color="water" />
          </div>

          {/* Quick Add Buttons */}
          <div className="card">
            <h3>Quick Add</h3>
            <div className="water-quick-buttons">
              {QUICK_AMOUNTS.map(amount => (
                <button
                  key={amount}
                  className="btn btn-water"
                  onClick={() => addWater(amount)}
                  disabled={adding}
                >
                  +{formatWater(amount)}
                </button>
              ))}
            </div>

            <div className="water-custom">
              <input
                type="number"
                value={customAmount}
                onChange={e => setCustomAmount(e.target.value)}
                placeholder="Custom ml..."
                min="1"
                className="water-custom-input"
                onKeyDown={e => e.key === 'Enter' && addWater(customAmount)}
              />
              <button
                className="btn btn-primary"
                onClick={() => addWater(customAmount)}
                disabled={adding || !customAmount}
              >
                {adding ? 'Adding...' : 'Add'}
              </button>
            </div>
          </div>

          {/* Water Log */}
          <div className="card">
            <h3>Today's Log</h3>
            {entries.length === 0 ? (
              <p className="empty-state-text">No water logged yet. Start hydrating!</p>
            ) : (
              <div className="water-entries">
                {entries.map((entry, i) => (
                  <div key={entry._id} className="water-entry">
                    <div className="water-entry-info">
                      <span className="water-entry-icon">💧</span>
                      <span className="water-entry-amount">{formatWater(entry.amountMl)}</span>
                      <span className="water-entry-time">
                        {new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <button className="btn-delete-sm" onClick={() => deleteEntry(entry._id)}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Email Reminder Toggle */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: reminderEnabled ? '12px' : '0' }}>
              <div>
                <h3 style={{ margin: '0 0 4px' }}>Email Reminders</h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>
                  Get a hydration reminder email every 2 hours during the day
                </p>
              </div>
              <button
                onClick={toggleReminder}
                disabled={reminderLoading}
                style={{
                  position: 'relative',
                  display: 'inline-flex',
                  alignItems: 'center',
                  width: '52px',
                  height: '28px',
                  borderRadius: '999px',
                  border: 'none',
                  cursor: reminderLoading ? 'not-allowed' : 'pointer',
                  background: reminderEnabled ? '#0ea5e9' : '#d1d5db',
                  transition: 'background 0.2s',
                  padding: '0',
                  flexShrink: 0
                }}
                aria-label="Toggle water reminders"
              >
                <span style={{
                  position: 'absolute',
                  left: reminderEnabled ? '26px' : '4px',
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  background: '#fff',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  transition: 'left 0.2s'
                }} />
              </button>
            </div>
            {reminderEnabled && (
              <p style={{ margin: 0, fontSize: '12px', color: '#0284c7', background: '#f0f9ff', borderRadius: '8px', padding: '8px 12px' }}>
                Reminders active at: {reminderHours.map(formatHour).join(', ')}
              </p>
            )}
          </div>

          {/* Goal Setting hint */}
          <div className="card hint-card">
            <p>💡 Default goal is 3L/day. Update in <strong>Profile</strong> settings.</p>
          </div>
        </>
      )}
    </div>
  )
}

export default WaterTracker

import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { authService, gamemapService } from '../services'
import { useToast } from '../context/ToastContext'

const Profile = () => {
  const { user, updateUser, logout } = useAuth()
  const toast = useToast()
  const [profile, setProfile] = useState(null)
  const [form, setForm] = useState({
    name: user?.name || '',
    calorieGoal: user?.calorieGoal || 2200,
    proteinGoal: user?.proteinGoal || 120,
    waterGoal: (user?.waterGoal || 3000) / 1000,
    planStartDate: user?.planStartDate
      ? new Date(user.planStartDate).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0]
  })
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      const res = await gamemapService.getProfile()
      setProfile(res.data.profile)
    } catch (err) {
      // Non-fatal: gamification data may not be available for older users
    }
  }

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await authService.updateMe({
        name: form.name,
        calorieGoal: parseInt(form.calorieGoal),
        proteinGoal: parseInt(form.proteinGoal),
        waterGoal: Math.round(parseFloat(form.waterGoal) * 1000),
        planStartDate: form.planStartDate
      })
      updateUser(res.data.user)
      toast.success('Profile updated successfully!')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile.')
    } finally {
      setSaving(false)
    }
  }

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    : 'Unknown'

  const xpInfo = profile?.xpInfo
  const unlockedAchievements = profile?.achievements?.filter(a => a.unlocked) || []
  const lockedAchievements = profile?.achievements?.filter(a => !a.unlocked) || []

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Profile</h1>
        <p className="page-subtitle">Your fitness identity</p>
      </div>

      {/* Profile Hero Card */}
      <div className="card profile-hero-card">
        <div className="profile-hero-left">
          <div className="profile-avatar-large profile-avatar-game">
            {user?.name?.charAt(0).toUpperCase()}
            {profile && (
              <div className="profile-level-badge-overlay">
                {profile.fitnessLevel || 1}
              </div>
            )}
          </div>
          <div className="profile-info">
            <h2>{user?.name}</h2>
            <p className="profile-email">{user?.email}</p>
            <span className="profile-since">Member since {memberSince}</span>
          </div>
        </div>

        {/* XP Bar */}
        {xpInfo && (
          <div className="profile-xp-section">
            <div className="profile-fitness-level">
              <span className="fitness-level-label">FITNESS LEVEL</span>
              <span className="fitness-level-number">{xpInfo.level}</span>
            </div>
            <div className="xp-bar-container">
              <div className="xp-bar-header">
                <span className="xp-numbers">{xpInfo.xpIntoLevel} / {xpInfo.xpForLevel} XP</span>
                <span className="xp-to-next">{xpInfo.xpToNext} XP to Level {xpInfo.level + 1}</span>
              </div>
              <div className="xp-track">
                <div className="xp-fill xp-fill-animated" style={{ width: `${xpInfo.percent}%` }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Stats Row */}
      {profile && (
        <div className="stats-row profile-stats-row">
          <div className="stat-card">
            <span className="stat-label">Workouts</span>
            <span className="stat-value">{profile.totalWorkouts || 0}</span>
          </div>
          <div className="stat-card stat-card-primary">
            <span className="stat-label">Streak</span>
            <span className="stat-value">🔥 {profile.currentStreak || 0}</span>
            <span className="stat-unit">days</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Best Streak</span>
            <span className="stat-value">{profile.longestStreak || 0}</span>
            <span className="stat-unit">days</span>
          </div>
          <div className="stat-card stat-card-success">
            <span className="stat-label">Total XP</span>
            <span className="stat-value">{(profile.xp || 0).toLocaleString()}</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="profile-tabs">
        <button
          className={`profile-tab ${activeTab === 'overview' ? 'profile-tab-active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`profile-tab ${activeTab === 'achievements' ? 'profile-tab-active' : ''}`}
          onClick={() => setActiveTab('achievements')}
        >
          Achievements {unlockedAchievements.length > 0 && <span className="tab-badge">{unlockedAchievements.length}</span>}
        </button>
        <button
          className={`profile-tab ${activeTab === 'settings' ? 'profile-tab-active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          Settings
        </button>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <>
          {/* Current Goals */}
          <div className="card goals-summary">
            <h3>Daily Goals</h3>
            <div className="goals-grid">
              <div className="goal-item">
                <span className="goal-icon">🔥</span>
                <span className="goal-value">{user?.calorieGoal?.toLocaleString()}</span>
                <span className="goal-label">kcal/day</span>
              </div>
              <div className="goal-item">
                <span className="goal-icon">🍗</span>
                <span className="goal-value">{user?.proteinGoal}g</span>
                <span className="goal-label">protein/day</span>
              </div>
              <div className="goal-item">
                <span className="goal-icon">💧</span>
                <span className="goal-value">{((user?.waterGoal || 3000) / 1000).toFixed(1)}L</span>
                <span className="goal-label">water/day</span>
              </div>
            </div>
          </div>

          {/* Exercise Stats */}
          {profile && (
            <div className="card">
              <h3>Activity Stats</h3>
              <div className="activity-stats-grid">
                <div className="activity-stat">
                  <span className="activity-stat-value">{profile.totalExercisesCompleted || 0}</span>
                  <span className="activity-stat-label">Exercises Completed</span>
                </div>
                <div className="activity-stat">
                  <span className="activity-stat-value">{profile.totalSetsCompleted || 0}</span>
                  <span className="activity-stat-label">Sets Completed</span>
                </div>
              </div>
            </div>
          )}

          {/* XP Breakdown by Category */}
          {profile && (
            <div className="card">
              <h3>XP Breakdown</h3>

              {/* Three stat boxes */}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                {[
                  { label: 'Workout XP', xp: profile.workoutXP || 0, color: '#16a34a', bg: '#f0fdf4', icon: '🏋️', desc: 'From completing workouts' },
                  { label: 'Nutrition XP', xp: profile.nutritionXP || 0, color: '#f59e0b', bg: '#fffbeb', icon: '🍎', desc: 'From logging meals' },
                  { label: 'Hydration XP', xp: profile.waterXP || 0, color: '#0ea5e9', bg: '#f0f9ff', icon: '💧', desc: 'From drinking water' }
                ].map(({ label, xp, color, bg, icon, desc }) => (
                  <div key={label} style={{
                    flex: 1, background: bg, border: `1px solid ${color}33`,
                    borderRadius: '12px', padding: '12px 10px', textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '22px', marginBottom: '4px' }}>{icon}</div>
                    <div style={{ fontSize: '18px', fontWeight: '800', color }}>{xp.toLocaleString()}</div>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#374151', marginTop: '2px' }}>{label}</div>
                    <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '2px' }}>{desc}</div>
                  </div>
                ))}
              </div>

              {/* Combined stacked progress bar */}
              {(() => {
                const total = (profile.workoutXP || 0) + (profile.nutritionXP || 0) + (profile.waterXP || 0);
                if (total === 0) return (
                  <p style={{ fontSize: '13px', color: '#9ca3af', textAlign: 'center', margin: 0 }}>
                    Complete workouts, log meals and drink water to earn XP!
                  </p>
                );
                const wPct  = Math.round(((profile.workoutXP   || 0) / total) * 100);
                const nPct  = Math.round(((profile.nutritionXP  || 0) / total) * 100);
                const hPct  = Math.max(0, 100 - wPct - nPct);
                return (
                  <>
                    <div style={{ marginBottom: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#6b7280', marginBottom: '6px' }}>
                        <span>Total XP earned</span>
                        <strong style={{ color: '#111827' }}>{total.toLocaleString()} XP</strong>
                      </div>
                      <div style={{ height: '14px', borderRadius: '999px', overflow: 'hidden', background: '#e5e7eb', display: 'flex' }}>
                        {wPct > 0 && <div style={{ width: `${wPct}%`, background: '#16a34a', transition: 'width 0.6s ease' }} />}
                        {nPct > 0 && <div style={{ width: `${nPct}%`, background: '#f59e0b', transition: 'width 0.6s ease' }} />}
                        {hPct > 0 && <div style={{ width: `${hPct}%`, background: '#0ea5e9', transition: 'width 0.6s ease' }} />}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                      {[
                        { color: '#16a34a', label: `Workout ${wPct}%` },
                        { color: '#f59e0b', label: `Nutrition ${nPct}%` },
                        { color: '#0ea5e9', label: `Hydration ${hPct}%` }
                      ].map(({ color, label }) => (
                        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#6b7280' }}>
                          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                          {label}
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {/* Account */}
          <div className="card danger-zone">
            <h3>Account</h3>
            <button
              className="btn btn-danger"
              onClick={() => {
                if (window.confirm('Are you sure you want to logout?')) logout()
              }}
            >
              Logout
            </button>
          </div>
        </>
      )}

      {/* Achievements Tab */}
      {activeTab === 'achievements' && (
        <div className="achievements-section">
          {unlockedAchievements.length > 0 && (
            <div className="card">
              <h3>Unlocked ({unlockedAchievements.length})</h3>
              <div className="achievements-grid">
                {unlockedAchievements.map((ach) => (
                  <div key={ach.key} className="achievement-card achievement-unlocked">
                    <div className="achievement-icon-large">{ach.icon}</div>
                    <div className="achievement-card-info">
                      <div className="achievement-name">{ach.name}</div>
                      <div className="achievement-desc">{ach.description}</div>
                      {ach.unlockedAt && (
                        <div className="achievement-date">
                          {new Date(ach.unlockedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {lockedAchievements.length > 0 && (
            <div className="card">
              <h3>Locked ({lockedAchievements.length})</h3>
              <div className="achievements-grid">
                {lockedAchievements.map((ach) => (
                  <div key={ach.key} className="achievement-card achievement-locked">
                    <div className="achievement-icon-large achievement-icon-locked">{ach.icon}</div>
                    <div className="achievement-card-info">
                      <div className="achievement-name">{ach.name}</div>
                      <div className="achievement-desc">{ach.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(!profile || (unlockedAchievements.length === 0 && lockedAchievements.length === 0)) && (
            <div className="empty-state">
              <p>Complete workouts to unlock achievements!</p>
            </div>
          )}
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="card">
          <h3>Settings</h3>

          <form onSubmit={handleSubmit} className="profile-form">
            <div className="form-group">
              <label>Full Name</label>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Your name"
                required
              />
            </div>

            <div className="form-section-title">Daily Goals</div>

            <div className="form-row form-3col">
              <div className="form-group">
                <label>Daily Calories (kcal)</label>
                <input
                  name="calorieGoal"
                  type="number"
                  value={form.calorieGoal}
                  onChange={handleChange}
                  min="1000"
                  max="10000"
                  required
                />
              </div>
              <div className="form-group">
                <label>Protein Goal (g/day)</label>
                <input
                  name="proteinGoal"
                  type="number"
                  value={form.proteinGoal}
                  onChange={handleChange}
                  min="20"
                  max="500"
                  required
                />
              </div>
              <div className="form-group">
                <label>Water Goal (L/day)</label>
                <input
                  name="waterGoal"
                  type="number"
                  value={form.waterGoal}
                  onChange={handleChange}
                  min="0.5"
                  max="10"
                  step="0.25"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>Plan Start Date</label>
              <input
                name="planStartDate"
                type="date"
                value={form.planStartDate}
                onChange={handleChange}
              />
              <small className="form-hint">This determines your current week in the 12-week plan.</small>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

export default Profile

import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const NAV_ITEMS = [
  { path: '/game-map', label: 'Game Map', icon: '🗺️' },
  { path: '/gym-session', label: 'Workout', icon: '🏋️' },
  { path: '/dashboard', label: 'Dashboard', icon: '⊞' },
  { path: '/food', label: 'Food', icon: '🍗' },
  { path: '/water', label: 'Water', icon: '💧' },
  { path: '/history', label: 'History', icon: '📋' },
  { path: '/progress', label: 'Progress', icon: '📈' },
  { path: '/profile', label: 'Profile', icon: '👤' }
]

const AppLayout = () => {
  const [menuOpen, setMenuOpen] = useState(false)
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="app-layout">
      {/* Sidebar Navigation (Desktop) */}
      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-header">
          <img src="/logo.png" alt="FitCycle" className="sidebar-logo-img" />
          <div className="sidebar-brand">
            <h2>FitCycle</h2>
            <span>Level Up Your Body</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `nav-item ${isActive ? 'nav-item-active' : ''}`}
              onClick={() => setMenuOpen(false)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">{user?.name}</span>
              <span className="sidebar-user-email">{user?.email}</span>
            </div>
          </div>
          <button className="btn-logout" onClick={handleLogout} title="Logout">
            <span>⏻</span>
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {menuOpen && (
        <div className="sidebar-overlay" onClick={() => setMenuOpen(false)} />
      )}

      {/* Main content */}
      <div className="main-content">
        {/* Mobile header */}
        <header className="mobile-header">
          <button
            className="mobile-menu-btn"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
          <div className="mobile-brand">
            <img src="/logo.png" alt="FitCycle" className="mobile-logo-img" />
            <h2>FitCycle</h2>
          </div>
          <div className="mobile-avatar">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
        </header>

        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default AppLayout

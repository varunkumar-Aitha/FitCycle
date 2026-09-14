import { lazy, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import ProtectedRoute from './components/ProtectedRoute'
import AppLayout from './layouts/AppLayout'
import LoadingSpinner from './components/LoadingSpinner'

// Auth pages — loaded eagerly (first pages any visitor sees)
import Login from './pages/Login'
import Register from './pages/Register'

// Protected pages — lazy loaded so the initial bundle stays small
const Dashboard      = lazy(() => import('./pages/Dashboard'))
const GameMap        = lazy(() => import('./pages/GameMap'))
const GymSession     = lazy(() => import('./pages/GymSession'))
const FoodTracker    = lazy(() => import('./pages/FoodTracker'))
const WaterTracker   = lazy(() => import('./pages/WaterTracker'))
const WorkoutHistory = lazy(() => import('./pages/WorkoutHistory'))
const Progress       = lazy(() => import('./pages/Progress'))
const Profile        = lazy(() => import('./pages/Profile'))

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/game-map" replace />} />
              <Route path="game-map"     element={<Suspense fallback={<LoadingSpinner />}><GameMap /></Suspense>} />
              <Route path="dashboard"    element={<Suspense fallback={<LoadingSpinner />}><Dashboard /></Suspense>} />
              <Route path="gym-session"  element={<Suspense fallback={<LoadingSpinner />}><GymSession /></Suspense>} />
              <Route path="gym-session/:id" element={<Suspense fallback={<LoadingSpinner />}><GymSession /></Suspense>} />
              <Route path="food"         element={<Suspense fallback={<LoadingSpinner />}><FoodTracker /></Suspense>} />
              <Route path="water"        element={<Suspense fallback={<LoadingSpinner />}><WaterTracker /></Suspense>} />
              <Route path="history"      element={<Suspense fallback={<LoadingSpinner />}><WorkoutHistory /></Suspense>} />
              <Route path="progress"     element={<Suspense fallback={<LoadingSpinner />}><Progress /></Suspense>} />
              <Route path="profile"      element={<Suspense fallback={<LoadingSpinner />}><Profile /></Suspense>} />
            </Route>
            <Route path="*" element={<Navigate to="/game-map" replace />} />
          </Routes>
        </Router>
      </ToastProvider>
    </AuthProvider>
  )
}

export default App

import api from './api'

export const authService = {
  register: (data) => api.post('/auth/register', data),
  verifyOtp: (data) => api.post('/auth/verify-otp', data),
  resendOtp: (data) => api.post('/auth/resend-otp', data),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
  updateMe: (data) => api.put('/auth/me', data)
}

export const workoutService = {
  getToday: () => api.get('/workouts/today'),
  getAll: (params) => api.get('/workouts', { params }),
  getById: (id) => api.get(`/workouts/${id}`),
  create: (data) => api.post('/workouts', data),
  update: (id, data) => api.put(`/workouts/${id}`, data),
  complete: (id, data) => api.post(`/workouts/${id}/complete`, data || {}),
  delete: (id) => api.delete(`/workouts/${id}`),
  getRecentMuscles: () => api.get('/workouts/recent-muscles'),
  getPRs: (params) => api.get('/workouts/prs', { params }),
  getSuggestions: (workoutType) => api.get('/workouts/suggestions', { params: { workoutType } })
}

export const exerciseService = {
  getAll: (params) => api.get('/exercises', { params }),
  getById: (id) => api.get(`/exercises/${id}`),
  create: (data) => api.post('/exercises', data),
  delete: (id) => api.delete(`/exercises/${id}`)
}

export const foodService = {
  getByDate: (date) => api.get('/food', { params: { date } }),
  getWeekly: () => api.get('/food/weekly'),
  create: (data) => api.post('/food', data),
  createBulk: (data) => api.post('/food/bulk', data),
  update: (id, data) => api.put(`/food/${id}`, data),
  delete: (id) => api.delete(`/food/${id}`)
}

export const foodCatalogService = {
  getAll: (params) => api.get('/food-catalog', { params })
}

export const waterService = {
  getByDate: (date) => api.get('/water', { params: { date } }),
  add: (data) => api.post('/water', data),
  delete: (id) => api.delete(`/water/${id}`),
  getReminderSettings: () => api.get('/water/reminder'),
  updateReminderSettings: (data) => api.put('/water/reminder', data)
}

export const dashboardService = {
  get: () => api.get('/dashboard')
}

export const gamemapService = {
  getMap: () => api.get('/gamemap'),
  getProfile: () => api.get('/gamemap/profile')
}

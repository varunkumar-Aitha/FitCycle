/**
 * Format date to readable string: "12 Sep 2026"
 */
export const formatDate = (date) => {
  return new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}

/**
 * Format date to ISO string date part: "2026-09-12"
 */
export const toDateString = (date = new Date()) => {
  return new Date(date).toISOString().split('T')[0]
}

/**
 * Days ago from today
 */
export const daysAgo = (date) => {
  const now = new Date()
  const d = new Date(date)
  const diff = Math.floor((now - d) / (1000 * 60 * 60 * 24))
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return `${diff} days ago`
}

/**
 * Format duration in minutes to "Xh Xm"
 */
export const formatDuration = (minutes) => {
  if (!minutes) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  return `${h}h ${m}m`
}

/**
 * Get greeting based on time of day
 */
export const getGreeting = () => {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

/**
 * Format ml to readable: 2500 → "2.5L"
 */
export const formatWater = (ml) => {
  if (ml >= 1000) return `${(ml / 1000).toFixed(2).replace(/\.?0+$/, '')}L`
  return `${ml}ml`
}

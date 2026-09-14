/**
 * waterReminderScheduler.js
 *
 * Runs every hour on the hour (cron: "0 * * * *").
 * For each user who has waterReminderEnabled=true, checks if the current
 * hour matches one of their reminder hours (default: 8,10,12,14,16,18,20,22).
 * Uses a single aggregation to fetch ALL users' water totals in one DB query
 * instead of one query per user (eliminates N+1 pattern).
 */

const cron        = require('node-cron')
const User        = require('../models/User')
const WaterEntry  = require('../models/WaterEntry')
const { sendWaterReminderEmail } = require('./emailService')

const todayRange = () => {
  const now   = new Date()
  const start = new Date(now); start.setHours(0, 0, 0, 0)
  const end   = new Date(now); end.setHours(23, 59, 59, 999)
  return { start, end }
}

const sendReminders = async () => {
  const currentHour = new Date().getHours()

  try {
    // Find all users whose reminder is on and schedule includes this hour
    const users = await User.find({
      waterReminderEnabled: true,
      waterReminderHours: currentHour
    }).select('name email waterGoal').lean()

    if (!users.length) return

    console.log(`[WaterReminder] ${new Date().toISOString()} — sending to ${users.length} user(s) at hour ${currentHour}`)

    const { start, end } = todayRange()
    const userIds = users.map(u => u._id)

    // Single aggregation to get today's water total per user — no N+1
    const waterTotals = await WaterEntry.aggregate([
      { $match: { userId: { $in: userIds }, date: { $gte: start, $lte: end } } },
      { $group: { _id: '$userId', totalMl: { $sum: '$amountMl' } } }
    ])

    // Build a lookup map: userId string → totalMl
    const totalByUser = {}
    waterTotals.forEach(row => { totalByUser[row._id.toString()] = row.totalMl })

    await Promise.allSettled(
      users.map(async (user) => {
        try {
          const totalMl = totalByUser[user._id.toString()] || 0

          await sendWaterReminderEmail({
            to:     user.email,
            name:   user.name.split(' ')[0],
            totalMl,
            goalMl: user.waterGoal || 3000
          })

          console.log(`[WaterReminder] ✓ Sent to ${user.email} (${totalMl}ml / ${user.waterGoal}ml)`)
        } catch (err) {
          console.error(`[WaterReminder] ✗ Failed for ${user.email}:`, err.message)
        }
      })
    )
  } catch (err) {
    console.error('[WaterReminder] Scheduler error:', err.message)
  }
}

const startWaterReminderScheduler = () => {
  cron.schedule('0 * * * *', sendReminders, {
    scheduled: true,
    timezone: 'Asia/Kolkata'
  })
  console.log('[WaterReminder] Scheduler started — runs every hour on the hour (IST)')
}

module.exports = { startWaterReminderScheduler }

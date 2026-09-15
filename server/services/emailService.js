const { BrevoClient } = require('@getbrevo/brevo');

/**
 * Email service — uses Brevo HTTP API in production.
 * Falls back to console.log in development when BREVO_API_KEY is not set.
 *
 * Required env vars (Render):
 *   BREVO_API_KEY      — from app.brevo.com → SMTP & API → API Keys
 *   BREVO_FROM_EMAIL   — the sender address you verified in Brevo
 *   BREVO_FROM_NAME    — display name, e.g. "FitCycle"
 */

const getBrevoClient = () => {
  if (!process.env.BREVO_API_KEY) return null;
  return new BrevoClient({ apiKey: process.env.BREVO_API_KEY });
};

const FROM_EMAIL = () => process.env.BREVO_FROM_EMAIL || '';
const FROM_NAME  = () => process.env.BREVO_FROM_NAME  || 'FitCycle';

// ─────────────────────────────────────────────────────────────────────────────
// sendOtpEmail
// ─────────────────────────────────────────────────────────────────────────────
const sendOtpEmail = async ({ to, name, otp }) => {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verify your FitCycle account</title>
  <style>
    body { margin: 0; padding: 0; background: #f0fdf4; font-family: 'Inter', Arial, sans-serif; }
    .wrapper { max-width: 480px; margin: 40px auto; background: #ffffff; border-radius: 16px; border: 1px solid #e5e7eb; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); padding: 32px 32px 24px; text-align: center; }
    .header-icon { font-size: 48px; margin-bottom: 8px; display: block; }
    .header h1 { color: #ffffff; font-size: 22px; font-weight: 800; margin: 0; letter-spacing: -0.3px; }
    .body { padding: 32px; }
    .greeting { font-size: 16px; color: #111827; margin-bottom: 12px; }
    .desc { font-size: 14px; color: #6b7280; margin-bottom: 28px; line-height: 1.6; }
    .otp-label { font-size: 12px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; }
    .otp-box { background: #f0fdf4; border: 2px solid #16a34a; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px; }
    .otp-code { font-size: 40px; font-weight: 900; color: #15803d; letter-spacing: 10px; font-family: 'Courier New', monospace; }
    .otp-timer { font-size: 13px; color: #9ca3af; margin-top: 8px; }
    .warning { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px 16px; font-size: 13px; color: #dc2626; margin-bottom: 24px; }
    .footer { border-top: 1px solid #e5e7eb; padding: 20px 32px; text-align: center; }
    .footer p { font-size: 12px; color: #9ca3af; margin: 0; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <span class="header-icon">🏋️</span>
      <h1>Verify Your Account</h1>
    </div>
    <div class="body">
      <p class="greeting">Hi ${name},</p>
      <p class="desc">Welcome to <strong style="color:#111827">FitCycle</strong>! Enter the OTP below to complete your registration and start your 3-month fitness journey.</p>
      <div class="otp-label">Your One-Time Password</div>
      <div class="otp-box">
        <div class="otp-code">${otp}</div>
        <div class="otp-timer">Valid for 15 minutes</div>
      </div>
      <div class="warning">
        Do not share this code with anyone. FitCycle will never ask for your OTP.
      </div>
    </div>
    <div class="footer">
      <p>If you did not request this, ignore this email.</p>
      <p style="margin-top:6px;">© ${new Date().getFullYear()} FitCycle</p>
    </div>
  </div>
</body>
</html>
  `;

  const api = getBrevoClient();

  // Dev fallback — no API key configured
  if (!api) {
    console.log('\n========================================');
    console.log('  OTP EMAIL (dev mode — no BREVO_API_KEY)');
    console.log('========================================');
    console.log(`  To   : ${to}`);
    console.log(`  Name : ${name}`);
    console.log(`  OTP  : ${otp}`);
    console.log('========================================\n');
    return { messageId: 'console-dev' };
  }

  try {
    const result = await api.transactionalEmails.sendTransacEmail({
      sender:      { name: FROM_NAME(), email: FROM_EMAIL() },
      to:          [{ email: to, name }],
      subject:     `${otp} is your FitCycle verification code`,
      htmlContent: html,
      textContent: `Hi ${name},\n\nYour OTP is: ${otp}\n\nValid for 15 minutes. Do not share this with anyone.`
    });
    return result;
  } catch (err) {
    console.error('[EMAIL] Brevo OTP send failed:', err.status, err.message);
    throw new Error('Failed to send OTP email');
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// sendWaterReminderEmail
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send a water reminder email.
 * @param {Object} opts
 * @param {string} opts.to         – recipient email
 * @param {string} opts.name       – user's first name
 * @param {number} opts.totalMl    – water logged today so far (ml)
 * @param {number} opts.goalMl     – daily water goal (ml)
 */
async function sendWaterReminderEmail({ to, name, totalMl, goalMl }) {
  const pct       = Math.min(Math.round((totalMl / goalMl) * 100), 100);
  const remaining = Math.max(goalMl - totalMl, 0);
  const remL      = (remaining / 1000).toFixed(1);
  const totalL    = (totalMl  / 1000).toFixed(1);
  const goalL     = (goalMl   / 1000).toFixed(1);

  let motivation, emoji;
  if (pct === 0) {
    motivation = "You haven't had any water today yet. Start now — even a small glass makes a big difference!";
    emoji = '🥤';
  } else if (pct < 25) {
    motivation = `You've had ${totalL}L so far. Keep going — you're just getting started. Your muscles need water to recover!`;
    emoji = '💧';
  } else if (pct < 50) {
    motivation = `You're at ${pct}% of your goal (${totalL}L). Drink ${remL}L more to hit your target. Halfway there!`;
    emoji = '💦';
  } else if (pct < 75) {
    motivation = `Great progress! You've had ${totalL}L — you're more than halfway. Just ${remL}L to go!`;
    emoji = '🌊';
  } else if (pct < 100) {
    motivation = `Almost there! Only ${remL}L left to reach your daily goal of ${goalL}L. Finish strong!`;
    emoji = '🏆';
  } else {
    motivation = `Amazing! You've already hit your daily water goal of ${goalL}L. Stay hydrated and keep crushing it!`;
    emoji = '🎉';
  }

  const progressWidth = `${pct}%`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Water Reminder — FitCycle</title>
  <style>
    body { margin:0; padding:0; background:#f0fdf4; font-family:'Inter',Arial,sans-serif; }
    .wrapper { max-width:480px; margin:40px auto; background:#fff; border-radius:16px; border:1px solid #e5e7eb; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.08); }
    .header { background:linear-gradient(135deg,#0ea5e9 0%,#0284c7 100%); padding:28px 32px 24px; text-align:center; }
    .header-icon { font-size:52px; display:block; margin-bottom:6px; }
    .header h1 { color:#fff; font-size:20px; font-weight:800; margin:0; }
    .header p  { color:rgba(255,255,255,0.85); font-size:13px; margin:6px 0 0; }
    .body { padding:28px 32px; }
    .greeting { font-size:15px; color:#111827; margin-bottom:10px; font-weight:600; }
    .motivation { font-size:14px; color:#374151; line-height:1.65; margin-bottom:24px; background:#f0f9ff; border-left:3px solid #0ea5e9; padding:12px 14px; border-radius:0 8px 8px 0; }
    .progress-section { margin-bottom:24px; }
    .progress-label { display:flex; justify-content:space-between; font-size:12px; color:#6b7280; margin-bottom:8px; }
    .progress-label strong { color:#111827; }
    .track { height:14px; background:#e5e7eb; border-radius:999px; overflow:hidden; }
    .fill  { height:100%; background:linear-gradient(90deg,#0ea5e9,#38bdf8); border-radius:999px; width:${progressWidth}; }
    .stats { display:flex; gap:12px; margin-bottom:24px; }
    .stat-box { flex:1; background:#f8fafc; border:1px solid #e5e7eb; border-radius:10px; padding:12px; text-align:center; }
    .stat-val  { font-size:20px; font-weight:800; color:#0284c7; }
    .stat-unit { font-size:10px; color:#9ca3af; font-weight:600; text-transform:uppercase; margin-top:2px; }
    .cta { text-align:center; margin-bottom:8px; }
    .cta a { display:inline-block; background:linear-gradient(135deg,#0ea5e9,#0284c7); color:#fff; text-decoration:none; padding:13px 32px; border-radius:10px; font-size:14px; font-weight:700; }
    .footer { border-top:1px solid #e5e7eb; padding:16px 32px; text-align:center; }
    .footer p { font-size:11px; color:#9ca3af; margin:3px 0; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <span class="header-icon">${emoji}</span>
      <h1>Time to Hydrate!</h1>
      <p>Your every-2-hour water reminder</p>
    </div>
    <div class="body">
      <p class="greeting">Hey ${name} 👋</p>
      <div class="motivation">${motivation}</div>

      <div class="progress-section">
        <div class="progress-label">
          <span>Today's progress</span>
          <strong>${pct}%</strong>
        </div>
        <div class="track"><div class="fill"></div></div>
      </div>

      <div class="stats">
        <div class="stat-box">
          <div class="stat-val">${totalL}L</div>
          <div class="stat-unit">Logged today</div>
        </div>
        <div class="stat-box">
          <div class="stat-val">${remL}L</div>
          <div class="stat-unit">Remaining</div>
        </div>
        <div class="stat-box">
          <div class="stat-val">${goalL}L</div>
          <div class="stat-unit">Daily goal</div>
        </div>
      </div>

      <div class="cta">
        <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/water">Log Water Now</a>
      </div>
    </div>
    <div class="footer">
      <p>You're receiving this because water reminders are enabled in your FitCycle profile.</p>
      <p>To turn off reminders, visit the Water Tracker page in the app.</p>
      <p style="margin-top:8px;">© ${new Date().getFullYear()} FitCycle</p>
    </div>
  </div>
</body>
</html>
  `;

  const api = getBrevoClient();

  // Dev fallback — no API key configured
  if (!api) {
    console.log('\n==============================');
    console.log('  WATER REMINDER (dev — no BREVO_API_KEY)');
    console.log(`  To: ${to} | Progress: ${pct}% (${totalL}L / ${goalL}L)`);
    console.log('==============================\n');
    return { messageId: 'console-dev' };
  }

  try {
    const result = await api.transactionalEmails.sendTransacEmail({
      sender:      { name: FROM_NAME(), email: FROM_EMAIL() },
      to:          [{ email: to, name }],
      subject:     `${emoji} Time to drink water! You're at ${pct}% of your daily goal`,
      htmlContent: html,
      textContent: `Hey ${name},\n\n${motivation}\n\nToday: ${totalL}L / ${goalL}L (${pct}%)\n\nLog water: ${process.env.CLIENT_URL || 'http://localhost:5173'}/water`
    });
    return result;
  } catch (err) {
    console.error('[EMAIL] Brevo water reminder send failed:', err.status, err.message);
    throw new Error('Failed to send water reminder email');
  }
}

module.exports = { sendOtpEmail, sendWaterReminderEmail };

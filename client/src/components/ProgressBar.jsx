const ProgressBar = ({ value, max, color = 'primary', showLabel = true, size = 'medium' }) => {
  const pct = Math.min(Math.round((value / max) * 100), 100)
  
  return (
    <div className={`progress-bar-wrapper progress-bar-${size}`}>
      <div className="progress-bar-track">
        <div
          className={`progress-bar-fill progress-bar-${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && <span className="progress-bar-label">{pct}%</span>}
    </div>
  )
}

export default ProgressBar

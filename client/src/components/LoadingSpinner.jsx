const LoadingSpinner = ({ size = 'medium', text = '' }) => {
  return (
    <div className={`spinner-wrapper spinner-${size}`}>
      <div className="spinner" />
      {text && <p className="spinner-text">{text}</p>}
    </div>
  )
}

export default LoadingSpinner

import { useState, useEffect, useRef, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useAuth } from '../context/AuthContext'
import { nutritionChatService } from '../services'
import LoadingSpinner from '../components/LoadingSpinner'

const SUGGESTIONS = [
  'Analyze my diet plan and suggest improvements.',
  'What foods help with muscle gain?',
  'Give me a high-protein Indian meal plan.',
  'Identify nutritional gaps in my diet.',
  'Suggest healthy snacks for my calorie goal.',
  'Best pre and post-workout meals?'
]

const MAX_FILE_MB = 5
const ACCEPTED_TYPES = '.pdf,.txt'

export default function NutritionChatWidget() {
  const { user } = useAuth()

  const [isOpen, setIsOpen]       = useState(false)
  const [dataLoaded, setDataLoaded] = useState(false)

  // Chat
  const [messages, setMessages]   = useState([])
  const [input, setInput]         = useState('')
  const [sending, setSending]     = useState(false)
  const [error, setError]         = useState('')
  const [elapsedSecs, setElapsedSecs] = useState(0)

  // Active document (previously uploaded, loaded from history)
  const [document, setDocument]   = useState(null)

  // Pending attachment — staged in input, uploaded on send (like ChatGPT)
  const [pendingFile, setPendingFile] = useState(null) // { file, name }
  const [fileError, setFileError]     = useState('')

  const bottomRef   = useRef(null)
  const fileInputRef = useRef(null)
  const textareaRef  = useRef(null)
  const timerRef     = useRef(null)

  // Load history on first open
  useEffect(() => {
    if (isOpen && !dataLoaded) loadHistory()
  }, [isOpen])

  // Elapsed timer
  useEffect(() => {
    if (sending) {
      setElapsedSecs(0)
      timerRef.current = setInterval(() => setElapsedSecs(s => s + 1), 1000)
    } else {
      clearInterval(timerRef.current)
      setElapsedSecs(0)
    }
    return () => clearInterval(timerRef.current)
  }, [sending])

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  // Close on Escape
  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') setIsOpen(false) }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [])

  const loadHistory = async () => {
    try {
      const res = await nutritionChatService.getHistory()
      setMessages(res.data.messages || [])
      setDocument(res.data.document || null)
    } catch { /* start fresh */ }
    finally { setDataLoaded(true) }
  }

  // ── File staging (no upload yet) ─────────────────────────────────────────
  const stageFile = useCallback((file) => {
    if (!file) return
    setFileError('')

    if (!['application/pdf', 'text/plain'].includes(file.type)) {
      setFileError('Only PDF and TXT files are supported.')
      return
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setFileError(`File must be ${MAX_FILE_MB} MB or smaller.`)
      return
    }

    setPendingFile({ file, name: file.name })
    if (fileInputRef.current) fileInputRef.current.value = ''
    // Focus input so user can type their prompt
    setTimeout(() => textareaRef.current?.focus(), 50)
  }, [])

  const handleFileChange = (e) => stageFile(e.target.files[0])
  const removePendingFile = () => { setPendingFile(null); setFileError('') }

  // ── Send: upload (if pending) then message ────────────────────────────────
  const handleSend = async (text) => {
    const msg = (text || input).trim()
    if (!msg && !pendingFile) return
    if (sending) return

    // The actual text sent to the LLM
    const actualMsg = msg || 'Please analyze my attached diet plan and give personalized recommendations based on my goals.'

    setInput('')
    setError('')

    const attachment = pendingFile
    setPendingFile(null) // clear chip immediately — feels instant like ChatGPT

    // Optimistic user message bubble
    const optimistic = {
      role: 'user',
      content: msg,
      attachmentName: attachment?.name || null,
      timestamp: new Date().toISOString()
    }
    setMessages(prev => [...prev, optimistic])
    setSending(true)

    try {
      // Step 1 — upload attachment first so the backend can index it
      if (attachment) {
        const up = await nutritionChatService.uploadDocument(attachment.file)
        setDocument({
          filename: up.data.filename,
          fileType: attachment.file.type === 'application/pdf' ? 'pdf' : 'txt',
          uploadedAt: new Date().toISOString(),
          chunkCount: up.data.chunkCount
        })
      }

      // Step 2 — send message (backend now has the fresh document context)
      const res = await nutritionChatService.sendMessage(actualMsg)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: res.data.response,
        timestamp: new Date().toISOString()
      }])
    } catch (err) {
      const msg = err.response?.data?.message || 'Something went wrong. Please try again.'
      setError(msg)
      setMessages(prev => prev.filter(m => m !== optimistic))
      // Restore attachment so user can retry
      if (attachment) setPendingFile(attachment)
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleDeleteDocument = async () => {
    try {
      await nutritionChatService.deleteDocument()
      setDocument(null)
    } catch { setError('Could not remove document.') }
  }

  const handleClearHistory = async () => {
    if (!window.confirm('Clear all chat messages?')) return
    try {
      await nutritionChatService.clearHistory()
      setMessages([])
      setError('')
    } catch { setError('Could not clear history.') }
  }

  const formatTime = (ts) =>
    ts ? new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''

  const canSend = (input.trim().length > 0 || !!pendingFile) && !sending

  return (
    <>
      {/* Floating action button */}
      <button
        className="nc-fab"
        onClick={() => setIsOpen(true)}
        aria-label="Open AI Nutrition Advisor"
        title="AI Nutrition Advisor"
        style={{ display: isOpen ? 'none' : undefined }}
      >
        🥗
      </button>

      {/* Mobile backdrop */}
      {isOpen && <div className="nc-widget-backdrop" onClick={() => setIsOpen(false)} />}

      {/* Sliding panel */}
      <div
        className={`nc-widget-panel${isOpen ? ' nc-widget-open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="AI Nutrition Advisor"
      >
        {/* Header */}
        <div className="nc-widget-header">
          <div className="nc-widget-title">
            <span>🥗</span>
            <div>
              <strong>AI Nutrition Advisor</strong>
              <span className="nc-widget-subtitle">Powered by Gemini</span>
            </div>
          </div>
          <div className="nc-widget-actions">
            {messages.length > 0 && (
              <button className="nc-widget-action-btn" onClick={handleClearHistory} title="Clear chat">
                🗑
              </button>
            )}
            <button className="nc-widget-action-btn" onClick={() => setIsOpen(false)} aria-label="Close">
              ✕
            </button>
          </div>
        </div>

        {/* Active document pill (previously uploaded / just sent) */}
        {document && (
          <div className="nc-widget-doc-bar">
            <span>{document.fileType === 'pdf' ? '📕' : '📝'}</span>
            <span className="nc-widget-doc-name">{document.filename}</span>
            <span className="nc-widget-doc-meta">{document.chunkCount} sections</span>
            <button className="nc-widget-doc-remove" onClick={handleDeleteDocument} title="Remove">✕</button>
          </div>
        )}

        {/* Messages */}
        <div className="nc-widget-messages">
          {!dataLoaded ? (
            <div className="nc-widget-loading">
              <LoadingSpinner size="small" text="Loading..." />
            </div>
          ) : messages.length === 0 ? (
            <div className="nc-widget-empty">
              <div className="nc-widget-empty-icon">🥦</div>
              <p>
                Ask me anything about nutrition, or attach your diet plan with <strong>📎</strong> then type your question.
              </p>
              <div className="nc-widget-suggestions">
                {SUGGESTIONS.slice(0, 4).map((s, i) => (
                  <button key={i} className="nc-suggestion-chip" onClick={() => handleSend(s)} disabled={sending}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg, i) => (
                <div key={i} className={`nc-message nc-message-${msg.role}`}>
                  <div className="nc-message-avatar">
                    {msg.role === 'assistant' ? '🥗' : (user?.name?.charAt(0).toUpperCase() || 'U')}
                  </div>
                  <div className="nc-message-body">
                    <div className="nc-message-bubble">
                      {/* File attachment badge inside the message bubble */}
                      {msg.attachmentName && (
                        <div className="nc-msg-file-badge">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                          <span>{msg.attachmentName}</span>
                        </div>
                      )}
                      {msg.role === 'assistant' ? (
                        <div className="nc-markdown">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        msg.content && <p>{msg.content}</p>
                      )}
                    </div>
                    <span className="nc-message-time">{formatTime(msg.timestamp)}</span>
                  </div>
                </div>
              ))}

              {sending && (
                <div className="nc-message nc-message-assistant">
                  <div className="nc-message-avatar">🥗</div>
                  <div className="nc-message-body">
                    <div className="nc-message-bubble nc-thinking">
                      <span className="nc-dot" />
                      <span className="nc-dot" />
                      <span className="nc-dot" />
                      {elapsedSecs >= 3 && (
                        <span className="nc-thinking-label">
                          {elapsedSecs >= 12 ? 'Almost there' : 'Thinking'}&nbsp;{elapsedSecs}s…
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </>
          )}

          {error && (
            <div className="alert alert-error" style={{ margin: '8px 12px' }}>{error}</div>
          )}
        </div>

        {/* Input area */}
        <div className="nc-widget-input-wrap">
          {/* Staged file chip — shows above input before sending */}
          {pendingFile && (
            <div className="nc-pending-file">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              <span className="nc-pending-file-name">{pendingFile.name}</span>
              <button className="nc-pending-file-remove" onClick={removePendingFile} aria-label="Remove attachment">✕</button>
            </div>
          )}

          {fileError && <div className="nc-upload-error">{fileError}</div>}

          <div className="nc-widget-input-bar">
            {/* Paperclip */}
            <button
              className="nc-attach-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={sending}
              title="Attach diet plan (PDF or TXT, max 5 MB)"
              aria-label="Attach file"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66L9.41 17.41a2 2 0 01-2.83-2.83l8.49-8.48"/>
              </svg>
            </button>

            <textarea
              ref={textareaRef}
              className="nc-input"
              placeholder={pendingFile ? 'Ask something about this file…' : 'Ask about your diet, meals, nutrition…'}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={sending}
              maxLength={2000}
              aria-label="Message"
            />

            <button
              className="btn btn-primary nc-send-btn"
              onClick={() => handleSend()}
              disabled={!canSend}
              aria-label="Send"
            >
              {sending ? (
                <span className="nc-attach-spinner" />
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="19" x2="12" y2="5"/>
                  <polyline points="5 12 12 5 19 12"/>
                </svg>
              )}
            </button>
          </div>

          <p className="nc-footer-note">General guidance only — not a substitute for medical advice.</p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          style={{ display: 'none' }}
          onChange={handleFileChange}
          aria-label="Diet plan file input"
        />
      </div>
    </>
  )
}

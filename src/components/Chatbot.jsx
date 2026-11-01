import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Bot, MessageCircle, RotateCcw, Send, X } from 'lucide-react'
import { api } from '../api'

const SUGGESTIONS = [
  'Where is most of my money going this cycle?',
  'Am I on track to stay within budget?',
  'Which habits cost me the most?',
  'How can I save ₹5,000 more this cycle?',
]

// Minimal markdown for replies: paragraphs, numbered and bulleted lists, **bold**
function Inline({ text }) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : <span key={i}>{part}</span>,
  )
}

function Markdown({ text }) {
  const lines = text.split('\n')
  const out = []
  for (let i = 0; i < lines.length; ) {
    const line = lines[i]
    if (!line.trim()) { i++; continue }
    const ordered = /^\s*\d+[.)]\s+/
    const bullet = /^\s*[-*•]\s+/
    if (ordered.test(line) || bullet.test(line)) {
      const re = ordered.test(line) ? ordered : bullet
      const items = []
      while (i < lines.length && re.test(lines[i])) items.push(lines[i++].replace(re, ''))
      const List = re === ordered ? 'ol' : 'ul'
      out.push(<List key={out.length}>{items.map((t, j) => <li key={j}><Inline text={t} /></li>)}</List>)
      continue
    }
    out.push(<p key={out.length}><Inline text={line.replace(/^#+\s*/, '')} /></p>)
    i++
  }
  return out
}

export default function Chatbot() {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState(null) // { configured, model } once loaded
  const [messages, setMessages] = useState([]) // { role: 'user' | 'assistant' | 'error', text }
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bodyRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!open || status) return
    api.chat.status().then(setStatus).catch(() => setStatus({ configured: false }))
  }, [open, status])

  useEffect(() => {
    if (open) inputRef.current?.focus()
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, sending])

  const send = async (text) => {
    const question = (text ?? input).trim()
    if (!question || sending) return
    setInput('')
    const history = [...messages.filter((m) => m.role !== 'error'), { role: 'user', text: question }]
    setMessages((m) => [...m, { role: 'user', text: question }])
    setSending(true)
    try {
      const res = await api.chat.send(history.map(({ role, text: t }) => ({ role, text: t })))
      setMessages((m) => [...m, { role: 'assistant', text: res.reply }])
    } catch (e) {
      setMessages((m) => [...m, { role: 'error', text: e.message }])
      // Only a missing key switches the chat off; other 503s are temporary Gemini problems
      if (e.status === 503 && /isn't set up/.test(e.message)) setStatus({ configured: false })
    } finally {
      setSending(false)
    }
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const notSetUp = status && !status.configured

  return (
    <>
      {!open && (
        <button className="chat-fab" onClick={() => setOpen(true)} aria-label="Ask the finance assistant">
          <MessageCircle size={22} />
        </button>
      )}

      {open && (
        <section className="chat-panel" role="dialog" aria-label="Finance assistant">
          <div className="chat-head">
            <Bot size={18} color="var(--accent)" />
            <strong>Finance assistant</strong>
            <span className="ai">AI</span>
            {messages.length > 0 && (
              <button className="icon-btn" onClick={() => setMessages([])} aria-label="Start a new conversation" title="New conversation">
                <RotateCcw size={15} />
              </button>
            )}
            <button className="icon-btn" onClick={() => setOpen(false)} aria-label="Close assistant">
              <X size={17} />
            </button>
          </div>

          <div className="chat-body" ref={bodyRef} aria-live="polite">
            {messages.length === 0 && (
              <div className="chat-empty">
                <Bot size={34} />
                <p><strong style={{ color: 'var(--text)' }}>Ask about your spending</strong></p>
                <p style={{ fontSize: 12 }}>Answers use this cycle's expenses, budgets, income and alerts.</p>
                {notSetUp && (
                  <div className="chat-setup">
                    The assistant isn't set up yet. Add <code>GEMINI_API_KEY=your-key</code> to the backend's <code>.env</code> file and restart the backend.
                    Get a key at aistudio.google.com.
                  </div>
                )}
                <div className="chat-suggest">
                  {SUGGESTIONS.map((q) => (
                    <button key={q} onClick={() => send(q)} disabled={sending || notSetUp}>{q}</button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`msg ${m.role}`}>
                {m.role !== 'user' && (
                  <span className="avatar">{m.role === 'error' ? <AlertCircle size={13} /> : <Bot size={13} />}</span>
                )}
                <div className="bubble">{m.role === 'assistant' ? <Markdown text={m.text} /> : m.text}</div>
              </div>
            ))}

            {sending && (
              <div className="msg assistant">
                <span className="avatar"><Bot size={13} /></span>
                <div className="bubble"><span className="typing" aria-label="Thinking"><span /><span /><span /></span></div>
              </div>
            )}
          </div>

          <form className="chat-input" onSubmit={(e) => { e.preventDefault(); send() }}>
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={notSetUp ? 'Add a Gemini key to start chatting' : 'Ask about your spending…'}
              aria-label="Your question"
              maxLength={2000}
              disabled={notSetUp}
            />
            <button type="submit" disabled={sending || !input.trim() || notSetUp} aria-label="Send">
              <Send size={16} />
            </button>
          </form>
        </section>
      )}
    </>
  )
}

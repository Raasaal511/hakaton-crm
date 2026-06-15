import { useState, useRef, useCallback, useEffect } from 'react'
import { Bot, Send, X } from 'lucide-react'
import { buildAiContext, matchIntent, TEMPLATES } from 'shared/lib/ai'
import { streamInto } from 'shared/lib/ai'
import { organizationModel } from 'entities/organization'
import styles from './AiCopilot.module.css'

type Message = { role: 'user' | 'ai'; text: string }

const QUICK_CHIPS = [
  { label: 'Оцени лиды', prompt: 'Какие лиды под угрозой срыва?' },
  { label: 'Напиши письмо', prompt: 'Написать письмо клиенту' },
  { label: 'Прогноз продаж', prompt: 'Прогноз продаж на квартал' },
  { label: 'Найди риски', prompt: 'Риски оттока клиентов' },
]

function TypingDots() {
  return (
    <div className={styles.msgRow}>
      <div className={`${styles.msgAvatar} ${styles.msgAvatarAi}`}>✦</div>
      <div className={styles.typingBubble}>
        <span className={styles.typingDot} />
        <span className={styles.typingDot} />
        <span className={styles.typingDot} />
      </div>
    </div>
  )
}

export function AiCopilot() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const cancelRef = useRef<(() => void) | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const org = organizationModel.selectors.useCurrentOrganization()
  const ctx = buildAiContext(org?.id)

  const scrollBottom = useCallback(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 40)
  }, [])

  const sendMessage = useCallback((text: string) => {
    if (!text.trim() || isTyping) return
    setMessages((prev) => [...prev, { role: 'user', text: text.trim() }])
    setInput('')
    setIsTyping(true)
    scrollBottom()

    const intent = matchIntent(text)
    const fullResponse = TEMPLATES[intent](ctx)
    // Use first 300 chars in compact copilot
    const response = fullResponse.slice(0, 320)

    setTimeout(() => {
      setIsTyping(false)
      setMessages((prev) => [...prev, { role: 'ai', text: '' }])
      scrollBottom()

      cancelRef.current = streamInto(
        response,
        (partial) => {
          setMessages((prev) => {
            const updated = [...prev]
            updated[updated.length - 1] = { role: 'ai', text: partial }
            return updated
          })
          scrollBottom()
        },
      )
    }, 700 + Math.random() * 400)
  }, [isTyping, ctx, scrollBottom])

  useEffect(() => () => { cancelRef.current?.() }, [])

  // Keyboard shortcut: Cmd+/ toggles copilot
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      {/* Panel */}
      {open && (
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <div className={styles.panelHeaderIcon}>✦</div>
            <div className={styles.panelHeaderMeta}>
              <div className={styles.panelHeaderTitle}>
                Meridian AI
                <span className={styles.panelOnline} />
              </div>
              <div className={styles.panelHeaderSub}>CRM-ассистент · всегда доступен</div>
            </div>
            <button
              type="button"
              className={styles.panelClose}
              onClick={() => setOpen(false)}
              aria-label="Закрыть"
            >
              <X size={14} />
            </button>
          </div>

          {/* Quick chips */}
          <div className={styles.chips}>
            {QUICK_CHIPS.map((chip) => (
              <button
                key={chip.label}
                type="button"
                className={styles.chip}
                onClick={() => sendMessage(chip.prompt)}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Chat area */}
          <div className={styles.chatArea}>
            {messages.length === 0 && (
              <div
                style={{
                  padding: '16px 8px',
                  textAlign: 'center',
                  color: 'var(--color-text-tertiary)',
                  fontSize: 13,
                }}
              >
                Задайте вопрос о ваших лидах, сделках и клиентах
              </div>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`${styles.msgRow} ${msg.role === 'user' ? styles.msgRowUser : ''}`}
              >
                <div
                  className={`${styles.msgAvatar} ${
                    msg.role === 'ai' ? styles.msgAvatarAi : styles.msgAvatarUser
                  }`}
                >
                  {msg.role === 'ai' ? '✦' : '?'}
                </div>
                <div
                  className={`${styles.msgBubble} ${
                    msg.role === 'ai' ? styles.msgBubbleAi : styles.msgBubbleUser
                  }`}
                >
                  {msg.text}
                  {msg.role === 'ai' && i === messages.length - 1 && !isTyping && (
                    <span className={styles.cursor} />
                  )}
                </div>
              </div>
            ))}
            {isTyping && <TypingDots />}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className={styles.inputRow}>
            <textarea
              className={styles.input}
              placeholder="Спросите Meridian AI..."
              value={input}
              rows={1}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage(input)
                }
              }}
            />
            <button
              type="button"
              className={styles.sendBtn}
              disabled={!input.trim() || isTyping}
              onClick={() => sendMessage(input)}
            >
              <Send size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Trigger button */}
      <button
        type="button"
        className={`${styles.trigger} ${open ? styles.open : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-label="Meridian AI"
      >
        <span className={styles.triggerRing} />
        {open ? <X size={20} /> : <Bot size={20} />}
        {!open && <span className={styles.triggerLabel}>AI</span>}
      </button>
    </>
  )
}

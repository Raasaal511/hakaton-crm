import { useState, useRef, useCallback, useEffect } from 'react'
import { Bot, Send, X, Sparkles, Loader2, Wifi, WifiOff } from 'lucide-react'
import { buildAiContext } from 'shared/lib/ai'
import { streamInto } from 'shared/lib/ai'
import { aiAPI } from 'shared/api/requests/ai'
import { organizationModel } from 'entities/organization'
import styles from './AiCopilot.module.css'

type Source = 'deepseek' | 'local'
type Message = { role: 'user' | 'ai'; text: string; source?: Source }

const QUICK_CHIPS = [
  { label: '🎯 Оцени лиды', prompt: 'Какие лиды под угрозой срыва?' },
  { label: '✉️ Напиши письмо', prompt: 'Написать письмо клиенту с предложением о встрече' },
  { label: '📈 Прогноз продаж', prompt: 'Прогноз продаж на следующий квартал' },
  { label: '⚠️ Найди риски', prompt: 'Риски оттока клиентов' },
]

function SourceTag({ source }: { source?: Source }) {
  if (!source) return null
  if (source === 'deepseek') {
    return (
      <span className={styles.sourceTag} style={{ color: '#10b981', background: 'color-mix(in srgb, #10b981 10%, var(--color-bg))' }}>
        <Sparkles size={9} /> DeepSeek
      </span>
    )
  }
  return (
    <span className={styles.sourceTag} style={{ color: '#6b7280', background: 'color-mix(in srgb, #6b7280 10%, var(--color-bg))' }}>
      <Wifi size={9} /> Локальный AI
    </span>
  )
}

function TypingIndicator({ model }: { model: string }) {
  return (
    <div className={styles.msgRow}>
      <div className={`${styles.msgAvatar} ${styles.msgAvatarAi}`}>✦</div>
      <div className={styles.typingBubble}>
        <div className={styles.typingLabel}>
          <Loader2 size={10} className={styles.spinner} />
          Запрос к {model}...
        </div>
        <div className={styles.typingDots}>
          <span className={styles.typingDot} />
          <span className={styles.typingDot} />
          <span className={styles.typingDot} />
        </div>
      </div>
    </div>
  )
}

export function AiCopilot() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [aiModel, setAiModel] = useState('DeepSeek')
  const [isOnline, setIsOnline] = useState<boolean | null>(null)
  const cancelRef = useRef<(() => void) | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const org = organizationModel.selectors.useCurrentOrganization()
  const ctx = buildAiContext(org?.id)

  // Check AI status on open
  useEffect(() => {
    if (!open || isOnline !== null) return
    aiAPI.getStatus().then((status) => {
      setIsOnline(status.available)
      setAiModel(status.available ? status.model : 'Локальный AI')
    }).catch(() => setIsOnline(false))
  }, [open, isOnline])

  const scrollBottom = useCallback(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 40)
  }, [])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isTyping) return
    const userText = text.trim()

    setMessages((prev) => [...prev, { role: 'user', text: userText }])
    setInput('')
    setIsTyping(true)
    scrollBottom()

    const history = messages.map((m) => ({
      role: m.role === 'ai' ? 'assistant' as const : 'user' as const,
      content: m.text,
    }))
    history.push({ role: 'user', content: userText })

    const systemPrompt = `Ты CRM-ассистент PulsarCRM. Контекст: ${JSON.stringify(ctx)}.
Отвечай кратко (3-5 предложений), на русском, по делу. Помогаешь менеджерам по продажам.`

    try {
      const { content, source } = await aiAPI.chat(history, systemPrompt)
      setIsTyping(false)

      if (source === 'deepseek') setIsOnline(true)

      setMessages((prev) => [...prev, { role: 'ai', text: '', source }])
      scrollBottom()

      cancelRef.current = streamInto(
        content,
        (partial) => {
          setMessages((prev) => {
            const updated = [...prev]
            updated[updated.length - 1] = { role: 'ai', text: partial, source }
            return updated
          })
          scrollBottom()
        },
      )
    } catch {
      setIsTyping(false)
      setIsOnline(false)
      setMessages((prev) => [
        ...prev,
        { role: 'ai', text: 'Сервис временно недоступен. Пополните баланс DeepSeek или проверьте подключение.', source: 'local' },
      ])
      scrollBottom()
    }
  }, [isTyping, messages, ctx, scrollBottom])

  useEffect(() => () => { cancelRef.current?.() }, [])

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
      {open && (
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <div className={styles.panelHeaderIcon}>✦</div>
            <div className={styles.panelHeaderMeta}>
              <div className={styles.panelHeaderTitle}>
                Meridian AI
                {isOnline === true && <span className={styles.panelOnline} title="DeepSeek подключён" />}
                {isOnline === false && <span className={styles.panelOffline} title="Локальный режим" />}
              </div>
              <div className={styles.panelHeaderSub}>
                {isOnline === null ? 'Проверка подключения...' : isOnline ? `${aiModel} · онлайн` : 'Локальный режим'}
              </div>
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

          {isOnline === false && (
            <div className={styles.offlineBanner}>
              <WifiOff size={11} />
              Пополните баланс DeepSeek — сейчас работает локальный AI
            </div>
          )}

          <div className={styles.chips}>
            {QUICK_CHIPS.map((chip) => (
              <button
                key={chip.label}
                type="button"
                className={styles.chip}
                onClick={() => { void sendMessage(chip.prompt) }}
              >
                {chip.label}
              </button>
            ))}
          </div>

          <div className={styles.chatArea}>
            {messages.length === 0 && (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>✦</div>
                <p>Задайте вопрос о ваших лидах, сделках и клиентах</p>
                <span className={styles.shortcut}>⌘ + / для открытия</span>
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
                <div className={styles.msgGroup}>
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
                  {msg.role === 'ai' && msg.text && (
                    <SourceTag source={msg.source} />
                  )}
                </div>
              </div>
            ))}
            {isTyping && <TypingIndicator model={aiModel} />}
            <div ref={bottomRef} />
          </div>

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
                  void sendMessage(input)
                }
              }}
            />
            <button
              type="button"
              className={styles.sendBtn}
              disabled={!input.trim() || isTyping}
              onClick={() => { void sendMessage(input) }}
            >
              {isTyping ? <Loader2 size={13} className={styles.spinner} /> : <Send size={13} />}
            </button>
          </div>
        </div>
      )}

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

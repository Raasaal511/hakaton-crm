import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Bot,
  Sparkles,
  BarChart3,
  FileText,
  Send,
  Copy,
  Check,
  Loader2,
  RefreshCw,
  TrendingUp,
  Users,
  AlertTriangle,
  Zap,
  Mail,
  MessageSquare,
  PieChart,
} from 'lucide-react'
import { AppLayout } from 'shared/ui'
import { PageHeader } from 'shared/ui/PageHeader/PageHeader'
import { buildAiContext, matchIntent, TEMPLATES, STARTER_PROMPTS } from 'shared/lib/ai'
import { streamInto } from 'shared/lib/ai'
import { organizationModel } from 'entities/organization'
import { userModel } from 'entities/user'
import styles from './AiPage.module.css'

type Tab = 'chat' | 'insights' | 'generate'

// ── Score card data ──────────────────────────────────────────────────────────
const SCORE_CARDS = [
  {
    label: 'Здоровье лидов',
    value: 72,
    displayValue: '72',
    unit: '/100',
    desc: '47 лидов · 3 требуют внимания',
    color: '#10b981',
    icon: <TrendingUp size={14} />,
    bg: 'color-mix(in srgb, #10b981 12%, transparent)',
  },
  {
    label: 'Прогноз воронки',
    value: 84,
    displayValue: '₽8.4M',
    unit: '',
    desc: 'Потенциал квартала',
    color: '#6366f1',
    icon: <BarChart3 size={14} />,
    bg: 'color-mix(in srgb, #6366f1 12%, transparent)',
  },
  {
    label: 'Риск оттока',
    value: 18,
    displayValue: '18%',
    unit: '',
    desc: '24 клиента под риском',
    color: '#f59e0b',
    icon: <AlertTriangle size={14} />,
    bg: 'color-mix(in srgb, #f59e0b 12%, transparent)',
  },
  {
    label: 'Эффект. команды',
    value: 68,
    displayValue: '68',
    unit: '/100',
    desc: 'Конверсия +8% vs план',
    color: '#06b6d4',
    icon: <Users size={14} />,
    bg: 'color-mix(in srgb, #06b6d4 12%, transparent)',
  },
]

const RECOMMEND_CARDS = [
  { title: 'Срочные лиды', icon: <AlertTriangle size={13} />, key: 'urgent_leads' as const },
  { title: 'Прогноз продаж', icon: <TrendingUp size={13} />, key: 'forecast' as const },
  { title: 'Рекомендации команде', icon: <Zap size={13} />, key: 'manager_tips' as const },
  { title: 'Риски оттока', icon: <Users size={13} />, key: 'churn_risk' as const },
]

const GENERATE_TEMPLATES = [
  { key: 'kp_generation' as const, label: 'Коммерческое предложение', desc: 'КП под клиента', icon: <FileText size={14} /> },
  { key: 'email_draft' as const, label: 'Email клиенту', desc: 'Персонализированное письмо', icon: <Mail size={14} /> },
  { key: 'sms_draft' as const, label: 'SMS / мессенджер', desc: 'Короткое сообщение', icon: <MessageSquare size={14} /> },
  { key: 'analytics_summary' as const, label: 'Аналитический отчёт', desc: 'Сводка за период', icon: <PieChart size={14} /> },
  { key: 'deal_analysis' as const, label: 'Анализ сделки', desc: 'Детальный разбор', icon: <BarChart3 size={14} /> },
  { key: 'forecast' as const, label: 'Прогноз продаж', desc: 'На следующий квартал', icon: <TrendingUp size={14} /> },
]

// ── Gauge SVG ────────────────────────────────────────────────────────────────
const CIRC = 2 * Math.PI * 22 // r=22

function ScoreGauge({ value, color }: { value: number; color: string }) {
  const [animated, setAnimated] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 300)
    return () => clearTimeout(t)
  }, [])
  const offset = animated ? CIRC * (1 - value / 100) : CIRC
  return (
    <div className={styles.scoreGauge}>
      <svg className={styles.scoreGaugeSvg} viewBox="0 0 56 56">
        <circle className={styles.scoreGaugeTrack} cx="28" cy="28" r="22" />
        <circle
          className={styles.scoreGaugeFill}
          cx="28" cy="28" r="22"
          stroke={color}
          strokeDasharray={CIRC}
          strokeDashoffset={offset}
        />
      </svg>
      <div className={styles.scoreGaugeLabel}>{value}</div>
    </div>
  )
}

// ── Typing dots ───────────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className={styles.typingRow}>
      <div className={`${styles.msgAvatar} ${styles.msgAvatarAi}`}>✦</div>
      <div className={styles.typingBubble}>
        <span className={styles.typingDot} />
        <span className={styles.typingDot} />
        <span className={styles.typingDot} />
      </div>
    </div>
  )
}

// ── Chat message type ─────────────────────────────────────────────────────────
type Message = { role: 'user' | 'ai'; text: string }

// ── Chat Tab ──────────────────────────────────────────────────────────────────
function ChatTab() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const cancelRef = useRef<(() => void) | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const org = organizationModel.selectors.useCurrentOrganization()
  const ctx = buildAiContext(org?.id)

  const scrollToBottom = useCallback(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }, [])

  const sendMessage = useCallback((text: string) => {
    if (!text.trim() || isTyping) return
    setMessages((prev) => [...prev, { role: 'user', text: text.trim() }])
    setInput('')
    setIsTyping(true)
    scrollToBottom()

    const intent = matchIntent(text)
    const response = TEMPLATES[intent](ctx)

    // Brief thinking delay before streaming starts
    setTimeout(() => {
      setIsTyping(false)
      setMessages((prev) => [...prev, { role: 'ai', text: '' }])
      scrollToBottom()

      cancelRef.current = streamInto(
        response,
        (partial) => {
          setMessages((prev) => {
            const updated = [...prev]
            updated[updated.length - 1] = { role: 'ai', text: partial }
            return updated
          })
          scrollToBottom()
        },
      )
    }, 900 + Math.random() * 500)
  }, [isTyping, ctx, scrollToBottom])

  useEffect(() => () => { cancelRef.current?.() }, [])

  const userInitial = '?'

  return (
    <div className={styles.chatWrap}>
      <div className={styles.chatHistory}>
        {messages.length === 0 ? (
          <div className={styles.chatEmpty}>
            <div className={styles.chatEmptyIcon}>✦</div>
            <h3 className={styles.chatEmptyTitle}>Meridian AI</h3>
            <p className={styles.chatEmptyDesc}>
              Задайте вопрос о ваших лидах, сделках и клиентах — или выберите быстрый запрос:
            </p>
            <div className={styles.starterGrid}>
              {STARTER_PROMPTS.slice(0, 4).map((p) => (
                <button
                  key={p.key}
                  className={styles.starterBtn}
                  onClick={() => sendMessage(p.label)}
                  type="button"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
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
                  {msg.role === 'ai' ? '✦' : userInitial}
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
            {isTyping && <TypingIndicator />}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      <div className={styles.chatInputRow}>
        <textarea
          className={styles.chatInput}
          placeholder="Спросите о лидах, сделках, клиентах..."
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
          <Send size={16} />
        </button>
      </div>
    </div>
  )
}

// ── Insights Tab ──────────────────────────────────────────────────────────────
function InsightsTab() {
  const org = organizationModel.selectors.useCurrentOrganization()
  const ctx = buildAiContext(org?.id)
  const [texts, setTexts] = useState<Record<string, string>>({})
  const [loaded, setLoaded] = useState<Record<string, boolean>>({})
  const cancelRefs = useRef<Record<string, () => void>>({})

  useEffect(() => {
    // Stream each recommendation card sequentially with delays
    let cancelled = false
    const cards = RECOMMEND_CARDS

    async function streamCards() {
      for (let i = 0; i < cards.length; i++) {
        if (cancelled) break
        await new Promise<void>((resolve) => setTimeout(resolve, i * 600))
        if (cancelled) break
        const { key } = cards[i]
        const text = TEMPLATES[key](ctx)
        // Use only first 120 chars for preview
        const preview = text.slice(0, 220)
        cancelRefs.current[key] = streamInto(
          preview,
          (partial) => setTexts((prev) => ({ ...prev, [key]: partial })),
          () => setLoaded((prev) => ({ ...prev, [key]: true })),
        )
      }
    }

    streamCards()

    return () => {
      cancelled = true
      Object.values(cancelRefs.current).forEach((c) => c())
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* Score cards */}
      <div className={styles.insightsGrid}>
        {SCORE_CARDS.map((card) => (
          <div key={card.label} className={styles.scoreCard}>
            <div className={styles.scoreCardHeader}>
              <span className={styles.scoreCardLabel}>{card.label}</span>
              <span
                className={styles.scoreCardIcon}
                style={{ background: card.bg, color: card.color }}
              >
                {card.icon}
              </span>
            </div>
            <div className={styles.scoreGaugeWrap}>
              <ScoreGauge value={card.value} color={card.color} />
              <div>
                <div className={styles.scoreCardValue}>
                  {card.displayValue}
                  <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--color-text-tertiary)' }}>
                    {card.unit}
                  </span>
                </div>
                <div className={styles.scoreCardDesc}>{card.desc}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recommendation feed */}
      <div className={styles.recommendSection}>
        {RECOMMEND_CARDS.map((card) => (
          <div key={card.key} className={styles.recommendCard}>
            <div className={styles.recommendTitle}>
              {card.icon}
              {card.title}
            </div>
            <div className={styles.recommendContent}>
              {texts[card.key] || ''}
              {!loaded[card.key] && texts[card.key] !== undefined && (
                <span className={styles.cursor} />
              )}
              {texts[card.key] === undefined && (
                <span style={{ color: 'var(--color-text-tertiary)' }}>Анализирую...</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Generate Tab ──────────────────────────────────────────────────────────────
function GenerateTab() {
  const [selected, setSelected] = useState<typeof GENERATE_TEMPLATES[0]>(GENERATE_TEMPLATES[0])
  const [output, setOutput] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const cancelRef = useRef<(() => void) | null>(null)
  const org = organizationModel.selectors.useCurrentOrganization()
  const ctx = buildAiContext(org?.id)

  const generate = useCallback(() => {
    if (isGenerating) return
    cancelRef.current?.()
    setOutput('')
    setIsGenerating(true)

    const text = TEMPLATES[selected.key](ctx)
    setTimeout(() => {
      cancelRef.current = streamInto(
        text,
        setOutput,
        () => setIsGenerating(false),
      )
    }, 600)
  }, [selected, isGenerating, ctx])

  useEffect(() => () => { cancelRef.current?.() }, [])

  const handleCopy = async () => {
    if (!output) return
    await navigator.clipboard.writeText(output)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={styles.generateWrap}>
      <div className={styles.templateList}>
        {GENERATE_TEMPLATES.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`${styles.templateBtn} ${selected.key === t.key ? styles.templateBtnActive : ''}`}
            onClick={() => {
              setSelected(t)
              setOutput('')
              cancelRef.current?.()
            }}
          >
            <span className={styles.templateBtnLabel}>
              {t.icon}
              {t.label}
            </span>
            <span className={styles.templateBtnDesc}>{t.desc}</span>
          </button>
        ))}
      </div>

      <div className={styles.generateOutput}>
        <div className={styles.outputBox}>
          {output ? (
            <>
              {output}
              {isGenerating && <span className={styles.cursor} />}
            </>
          ) : (
            <span className={styles.outputPlaceholder}>
              Выберите шаблон и нажмите «Сгенерировать» — AI создаст контент на основе ваших данных CRM...
            </span>
          )}
        </div>

        <div className={styles.outputActions}>
          <button
            type="button"
            className={styles.generateBtn}
            onClick={generate}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <>
                <Loader2 size={14} className={styles.spin} />
                Генерирую...
              </>
            ) : (
              <>
                <Sparkles size={14} />
                Сгенерировать
              </>
            )}
          </button>

          {output && !isGenerating && (
            <>
              <button type="button" className={styles.copyBtn} onClick={handleCopy}>
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? 'Скопировано!' : 'Копировать'}
              </button>
              <button
                type="button"
                className={styles.copyBtn}
                onClick={() => {
                  setOutput('')
                  cancelRef.current?.()
                }}
              >
                <RefreshCw size={13} />
                Сбросить
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function AiPage() {
  const [tab, setTab] = useState<Tab>('chat')
  const [hintVisible, setHintVisible] = useState(true)
  const organization = organizationModel.selectors.useCurrentOrganization()
  const currentUser = userModel.selectors.useUser()

  return (
    <AppLayout>
      <div className={styles.page}>
        <PageHeader
          title="Meridian AI"
          description="Интеллектуальный CRM-ассистент на основе ваших данных"
          breadcrumb={[{ label: 'AI' }]}
          actions={
            <span
              style={{
                padding: '3px 10px',
                background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)',
                color: 'var(--color-accent)',
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.03em',
              }}
            >
              Beta
            </span>
          }
        />

        {hintVisible && (
          <div className={styles.hintStrip}>
            <span className={styles.hintPulse} />
            <span>
              Meridian AI анализирует данные {organization?.name ?? 'вашей компании'}: 47 лидов, 12 сделок, 134 контакта — в реальном времени
            </span>
            <button
              type="button"
              className={styles.hintClose}
              onClick={() => setHintVisible(false)}
              aria-label="Закрыть"
            >
              ×
            </button>
          </div>
        )}

        <div className={styles.body}>
          <div className={styles.tabs}>
            {([
              { key: 'chat' as Tab, label: 'AI Chat', icon: <Bot size={14} /> },
              { key: 'insights' as Tab, label: 'Инсайты', icon: <Sparkles size={14} /> },
              { key: 'generate' as Tab, label: 'Генерация', icon: <FileText size={14} /> },
            ] as const).map(({ key, label, icon }) => (
              <button
                key={key}
                type="button"
                className={`${styles.tab} ${tab === key ? styles.tabActive : ''}`}
                onClick={() => setTab(key)}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>

          {tab === 'chat' && <ChatTab key={`chat-${currentUser?.id}`} />}
          {tab === 'insights' && <InsightsTab key="insights" />}
          {tab === 'generate' && <GenerateTab key="generate" />}
        </div>
      </div>
    </AppLayout>
  )
}

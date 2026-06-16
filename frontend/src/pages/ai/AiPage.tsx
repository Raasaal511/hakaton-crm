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
  Wifi,
  WifiOff,
} from 'lucide-react'
import { AppLayout } from 'shared/ui'
import { PageHeader } from 'shared/ui/PageHeader/PageHeader'
import { useAiContext, streamInto, STARTER_PROMPTS, type AiContext } from 'shared/lib/ai'
import { organizationModel } from 'entities/organization'
import { userModel } from 'entities/user'
import { aiAPI } from 'shared/api/requests/ai'
import styles from './AiPage.module.css'

type Tab = 'chat' | 'insights' | 'generate'
type Source = 'deepseek' | 'local'

// ── Score cards (static UI) ──────────────────────────────────────────────────
const SCORE_CARDS = [
  { label: 'Здоровье лидов',   value: 72, displayValue: '72',   unit: '/100', desc: '47 лидов · 3 требуют внимания', color: '#10b981', icon: <TrendingUp size={14} />, bg: 'color-mix(in srgb, #10b981 12%, transparent)' },
  { label: 'Прогноз воронки',  value: 84, displayValue: '₽8.4M',unit: '',     desc: 'Потенциал квартала',             color: '#6366f1', icon: <BarChart3 size={14} />,  bg: 'color-mix(in srgb, #6366f1 12%, transparent)' },
  { label: 'Риск оттока',      value: 18, displayValue: '18%',  unit: '',     desc: '24 клиента под риском',          color: '#f59e0b', icon: <AlertTriangle size={14} />, bg: 'color-mix(in srgb, #f59e0b 12%, transparent)' },
  { label: 'Эффект. команды',  value: 68, displayValue: '68',   unit: '/100', desc: 'Конверсия +8% vs план',          color: '#06b6d4', icon: <Users size={14} />,      bg: 'color-mix(in srgb, #06b6d4 12%, transparent)' },
]

const INSIGHTS_PROMPTS = [
  { key: 'urgent_leads',   title: 'Срочные лиды',            icon: <AlertTriangle size={13} />, prompt: 'Какие лиды под угрозой срыва? Перечисли конкретные действия.' },
  { key: 'forecast',       title: 'Прогноз продаж',          icon: <TrendingUp size={13} />,    prompt: 'Дай прогноз продаж на следующий квартал на основе текущей воронки.' },
  { key: 'manager_tips',   title: 'Рекомендации команде',    icon: <Zap size={13} />,           prompt: 'Какие рекомендации дашь менеджерам по продажам прямо сейчас?' },
  { key: 'churn_risk',     title: 'Риски оттока',            icon: <Users size={13} />,         prompt: 'Какие клиенты под риском оттока и что предпринять?' },
]

const GENERATE_TEMPLATES = [
  { key: 'kp',       label: 'Коммерческое предложение', desc: 'КП под клиента',              icon: <FileText size={14} />,     prompt: 'Напиши профессиональное коммерческое предложение для CRM-системы на русском языке. Включи: введение, выгоды, цены, призыв к действию.' },
  { key: 'email',    label: 'Email клиенту',            desc: 'Персонализированное письмо',   icon: <Mail size={14} />,         prompt: 'Напиши деловое email-письмо клиенту с предложением о встрече для обсуждения сотрудничества. Тон: профессиональный, но дружелюбный.' },
  { key: 'sms',      label: 'SMS / мессенджер',         desc: 'Короткое сообщение',          icon: <MessageSquare size={14} />, prompt: 'Напиши короткое сообщение (до 160 символов) клиенту с приглашением на демо продукта.' },
  { key: 'report',   label: 'Аналитический отчёт',      desc: 'Сводка за период',            icon: <PieChart size={14} />,     prompt: 'Напиши аналитический отчёт по работе отдела продаж за квартал. Включи: KPI, выводы, рекомендации.' },
  { key: 'deal',     label: 'Анализ сделки',            desc: 'Детальный разбор',            icon: <BarChart3 size={14} />,    prompt: 'Проведи детальный анализ сделки в CRM: риски, возможности, следующие шаги для закрытия.' },
  { key: 'forecast', label: 'Прогноз продаж',           desc: 'На следующий квартал',        icon: <TrendingUp size={14} />,   prompt: 'Составь прогноз продаж на следующий квартал: ожидаемая выручка, ключевые риски, рекомендации.' },
]

// ── Gauge SVG ─────────────────────────────────────────────────────────────────
const CIRC = 2 * Math.PI * 22

function ScoreGauge({ value, color }: { value: number; color: string }) {
  const [animated, setAnimated] = useState(false)
  useEffect(() => { const t = setTimeout(() => setAnimated(true), 300); return () => clearTimeout(t) }, [])
  const offset = animated ? CIRC * (1 - value / 100) : CIRC
  return (
    <div className={styles.scoreGauge}>
      <svg className={styles.scoreGaugeSvg} viewBox="0 0 56 56">
        <circle className={styles.scoreGaugeTrack} cx="28" cy="28" r="22" />
        <circle className={styles.scoreGaugeFill} cx="28" cy="28" r="22" stroke={color} strokeDasharray={CIRC} strokeDashoffset={offset} />
      </svg>
      <div className={styles.scoreGaugeLabel}>{value}</div>
    </div>
  )
}

function TypingIndicator({ model }: { model: string }) {
  return (
    <div className={styles.typingRow}>
      <div className={`${styles.msgAvatar} ${styles.msgAvatarAi}`}>✦</div>
      <div className={styles.typingBubble}>
        <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginRight: 6 }}>
          <Loader2 size={10} style={{ display: 'inline', animation: 'spin 1s linear infinite', verticalAlign: 'middle', marginRight: 4 }} />
          {model}...
        </span>
        <span className={styles.typingDot} />
        <span className={styles.typingDot} />
        <span className={styles.typingDot} />
      </div>
    </div>
  )
}

function SourceBadge({ source }: { source?: Source }) {
  if (!source) return null
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 10,
      color: source === 'deepseek' ? '#10b981' : '#6b7280',
      background: source === 'deepseek' ? 'color-mix(in srgb,#10b981 10%,transparent)' : 'color-mix(in srgb,#6b7280 10%,transparent)',
    }}>
      {source === 'deepseek' ? <Wifi size={9} /> : <WifiOff size={9} />}
      {source === 'deepseek' ? 'DeepSeek' : 'Локальный AI'}
    </span>
  )
}

function useAiPageContext() {
  const org = organizationModel.selectors.useCurrentOrganization()
  const user = userModel.selectors.useUser()
  const managerName = user ? `${user.firstname} ${user.lastname ?? ''}`.trim() : 'Менеджер'
  return useAiContext(org?.id, {
    orgName: org?.name ?? 'Meridian',
    managerName,
  })
}

function aiSystemPrompt(ctx: AiContext) {
  return `Ты CRM-ассистент Meridian. Контекст организации: ${JSON.stringify(ctx)}.
В массиве leads — актуальные лиды/сделки. Используй их названия, этапы и суммы в ответах.
Отвечай кратко (3-5 предложений), на русском языке, по делу. Помогаешь менеджерам по продажам принимать решения.`
}

// ── Chat Tab ──────────────────────────────────────────────────────────────────
type Message = { role: 'user' | 'ai'; text: string; source?: Source }

function ChatTab() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [aiModel, setAiModel] = useState('AI')
  const cancelRef = useRef<(() => void) | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const { ctx } = useAiPageContext()

  useEffect(() => {
    aiAPI.getStatus().then((s) => setAiModel(s.available ? s.model : 'Локальный AI'))
  }, [])

  const scrollToBottom = useCallback(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }, [])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isTyping) return
    const userText = text.trim()
    setMessages((prev) => [...prev, { role: 'user', text: userText }])
    setInput('')
    setIsTyping(true)
    scrollToBottom()

    const history = messages.map((m) => ({
      role: m.role === 'ai' ? 'assistant' as const : 'user' as const,
      content: m.text,
    }))
    history.push({ role: 'user', content: userText })

    const systemPrompt = aiSystemPrompt(ctx)

    try {
      const { content, source } = await aiAPI.chat(history, systemPrompt)
      setIsTyping(false)
      if (source === 'deepseek') {
        aiAPI.getStatus().then((s) => setAiModel(s.model))
      }
      setMessages((prev) => [...prev, { role: 'ai', text: '', source }])
      scrollToBottom()
      cancelRef.current = streamInto(content, (partial) => {
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: 'ai', text: partial, source }
          return updated
        })
        scrollToBottom()
      })
    } catch {
      setIsTyping(false)
      setMessages((prev) => [...prev, { role: 'ai', text: 'Произошла ошибка. Попробуйте ещё раз.', source: 'local' }])
    }
  }, [isTyping, messages, ctx, scrollToBottom])

  useEffect(() => () => { cancelRef.current?.() }, [])

  return (
    <div className={styles.chatWrap}>
      <div className={styles.chatHistory}>
        {messages.length === 0 ? (
          <div className={styles.chatEmpty}>
            <div className={styles.chatEmptyIcon}>✦</div>
            <h3 className={styles.chatEmptyTitle}>Meridian AI</h3>
            <p className={styles.chatEmptyDesc}>Задайте вопрос о ваших лидах, сделках и клиентах — или выберите быстрый запрос:</p>
            <div className={styles.starterGrid}>
              {STARTER_PROMPTS.slice(0, 4).map((p) => (
                <button key={p.key} className={styles.starterBtn} onClick={() => { void sendMessage(p.label) }} type="button">
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <div key={i} className={`${styles.msgRow} ${msg.role === 'user' ? styles.msgRowUser : ''}`}>
                <div className={`${styles.msgAvatar} ${msg.role === 'ai' ? styles.msgAvatarAi : styles.msgAvatarUser}`}>
                  {msg.role === 'ai' ? '✦' : '?'}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: '80%' }}>
                  <div className={`${styles.msgBubble} ${msg.role === 'ai' ? styles.msgBubbleAi : styles.msgBubbleUser}`}>
                    {msg.text}
                    {msg.role === 'ai' && i === messages.length - 1 && !isTyping && <span className={styles.cursor} />}
                  </div>
                  {msg.role === 'ai' && msg.text && <SourceBadge source={msg.source} />}
                </div>
              </div>
            ))}
            {isTyping && <TypingIndicator model={aiModel} />}
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
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendMessage(input) }
          }}
        />
        <button type="button" className={styles.sendBtn} disabled={!input.trim() || isTyping} onClick={() => { void sendMessage(input) }}>
          {isTyping ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={16} />}
        </button>
      </div>
    </div>
  )
}

// ── Insights Tab ──────────────────────────────────────────────────────────────
function InsightsTab() {
  const { ctx, isReady } = useAiPageContext()
  const [texts, setTexts] = useState<Record<string, string>>({})
  const [sources, setSources] = useState<Record<string, Source>>({})
  const [loaded, setLoaded] = useState<Record<string, boolean>>({})
  const cancelRefs = useRef<Record<string, () => void>>({})
  const startedRef = useRef(false)

  useEffect(() => {
    if (!isReady || startedRef.current) return

    startedRef.current = true
    const systemPrompt = aiSystemPrompt(ctx)
    let cancelled = false

    async function loadCards() {
      for (let i = 0; i < INSIGHTS_PROMPTS.length; i++) {
        if (cancelled) break
        await new Promise<void>((r) => setTimeout(r, i * 500))
        if (cancelled) break
        const { key, prompt } = INSIGHTS_PROMPTS[i]
        try {
          const { content, source } = await aiAPI.chat([{ role: 'user', content: prompt }], systemPrompt)
          if (cancelled) break
          setSources((prev) => ({ ...prev, [key]: source }))
          cancelRefs.current[key] = streamInto(
            content.slice(0, 300),
            (partial) => setTexts((prev) => ({ ...prev, [key]: partial })),
            () => setLoaded((prev) => ({ ...prev, [key]: true })),
          )
        } catch {
          if (!cancelled) setTexts((prev) => ({ ...prev, [key]: 'Не удалось загрузить.' }))
        }
      }
    }

    void loadCards()
    return () => {
      cancelled = true
      Object.values(cancelRefs.current).forEach((c) => c())
    }
  }, [isReady, ctx])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div className={styles.insightsGrid}>
        {SCORE_CARDS.map((card) => (
          <div key={card.label} className={styles.scoreCard}>
            <div className={styles.scoreCardHeader}>
              <span className={styles.scoreCardLabel}>{card.label}</span>
              <span className={styles.scoreCardIcon} style={{ background: card.bg, color: card.color }}>{card.icon}</span>
            </div>
            <div className={styles.scoreGaugeWrap}>
              <ScoreGauge value={card.value} color={card.color} />
              <div>
                <div className={styles.scoreCardValue}>
                  {card.displayValue}
                  <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--color-text-tertiary)' }}>{card.unit}</span>
                </div>
                <div className={styles.scoreCardDesc}>{card.desc}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.recommendSection}>
        {INSIGHTS_PROMPTS.map((card) => (
          <div key={card.key} className={styles.recommendCard}>
            <div className={styles.recommendTitle}>
              {card.icon}
              {card.title}
              {sources[card.key] && <SourceBadge source={sources[card.key]} />}
            </div>
            <div className={styles.recommendContent}>
              {texts[card.key] !== undefined ? (
                <>
                  {texts[card.key]}
                  {!loaded[card.key] && <span className={styles.cursor} />}
                </>
              ) : (
                <span style={{ color: 'var(--color-text-tertiary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                  Запрашиваю AI...
                </span>
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
  const [selected, setSelected] = useState(GENERATE_TEMPLATES[0])
  const [output, setOutput] = useState('')
  const [source, setSource] = useState<Source | undefined>()
  const [isGenerating, setIsGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const cancelRef = useRef<(() => void) | null>(null)
  const { ctx } = useAiPageContext()

  const generate = useCallback(async () => {
    if (isGenerating) return
    cancelRef.current?.()
    setOutput('')
    setSource(undefined)
    setIsGenerating(true)

    const systemPrompt = aiSystemPrompt(ctx)

    try {
      const { content, source: src } = await aiAPI.chat(
        [{ role: 'user', content: selected.prompt }],
        systemPrompt,
      )
      setSource(src)
      cancelRef.current = streamInto(content, setOutput, () => setIsGenerating(false))
    } catch {
      setOutput('Произошла ошибка при генерации. Попробуйте ещё раз.')
      setIsGenerating(false)
    }
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
            onClick={() => { setSelected(t); setOutput(''); setSource(undefined); cancelRef.current?.() }}
          >
            <span className={styles.templateBtnLabel}>{t.icon}{t.label}</span>
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
          <button type="button" className={styles.generateBtn} onClick={() => { void generate() }} disabled={isGenerating}>
            {isGenerating
              ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />Генерирую...</>
              : <><Sparkles size={14} />Сгенерировать</>}
          </button>

          {source && <SourceBadge source={source} />}

          {output && !isGenerating && (
            <>
              <button type="button" className={styles.copyBtn} onClick={() => { void handleCopy() }}>
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? 'Скопировано!' : 'Копировать'}
              </button>
              <button type="button" className={styles.copyBtn} onClick={() => { setOutput(''); setSource(undefined); cancelRef.current?.() }}>
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
  const [aiOnline, setAiOnline] = useState<boolean | null>(null)
  const organization = organizationModel.selectors.useCurrentOrganization()
  const currentUser = userModel.selectors.useUser()

  useEffect(() => {
    aiAPI.getStatus().then((s) => setAiOnline(s.available))
  }, [])

  return (
    <AppLayout>
      <div className={styles.page}>
        <PageHeader
          title="Meridian AI"
          description="Интеллектуальный CRM-ассистент на основе ваших данных"
          breadcrumb={[{ label: 'AI' }]}
          actions={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {aiOnline !== null && (
                <span style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                  color: aiOnline ? '#10b981' : '#f59e0b',
                  background: aiOnline ? 'color-mix(in srgb,#10b981 12%,transparent)' : 'color-mix(in srgb,#f59e0b 12%,transparent)',
                }}>
                  {aiOnline ? <Wifi size={10} /> : <WifiOff size={10} />}
                  {aiOnline ? 'AI онлайн' : 'Локальный режим'}
                </span>
              )}
              <span style={{ padding: '3px 10px', background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)', color: 'var(--color-accent)', borderRadius: 20, fontSize: 11, fontWeight: 600, letterSpacing: '0.03em' }}>
                Beta
              </span>
            </div>
          }
        />

        {hintVisible && (
          <div className={styles.hintStrip}>
            <span className={styles.hintPulse} />
            <span>
              Meridian AI анализирует данные {organization?.name ?? 'вашей компании'}: лиды, сделки, контакты — в реальном времени
            </span>
            <button type="button" className={styles.hintClose} onClick={() => setHintVisible(false)} aria-label="Закрыть">×</button>
          </div>
        )}

        <div className={styles.body}>
          <div className={styles.tabs}>
            {([
              { key: 'chat' as Tab,     label: 'AI Chat',   icon: <Bot size={14} /> },
              { key: 'insights' as Tab, label: 'Инсайты',   icon: <Sparkles size={14} /> },
              { key: 'generate' as Tab, label: 'Генерация', icon: <FileText size={14} /> },
            ] as const).map(({ key, label, icon }) => (
              <button key={key} type="button" className={`${styles.tab} ${tab === key ? styles.tabActive : ''}`} onClick={() => setTab(key)}>
                {icon}{label}
              </button>
            ))}
          </div>

          {tab === 'chat'     && <ChatTab    key={`chat-${currentUser?.id}`} />}
          {tab === 'insights' && <InsightsTab key="insights" />}
          {tab === 'generate' && <GenerateTab key="generate" />}
        </div>
      </div>
    </AppLayout>
  )
}

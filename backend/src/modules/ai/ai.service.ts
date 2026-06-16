import { injectable } from 'inversify'
import OpenAI from 'openai'
import config from 'config'

type ProviderConfig = { apiKey: string; baseURL: string; model: string }

type ProviderClient = {
  name: string
  client: OpenAI
  model: string
}

export type LeadScoreInput = {
  title: string
  amount: number
  stage: string
  priority: string
  probability: number
  source?: string | null
  description?: string | null
  daysSinceCreated?: number
}

export type LeadScoreResult = {
  score: number
  confidence: 'high' | 'medium' | 'low'
  summary: string
  recommendations: string[]
  source: 'deepseek' | 'local'
}

type InsightInput = {
  entityType: 'lead' | 'contact' | 'company'
  data: Record<string, unknown>
}

type InsightResult = {
  insights: string[]
  nextAction: string
  source: 'deepseek' | 'local'
}

// ---------------------------------------------------------------------------
// Fallback logic (no API key or insufficient balance)
// ---------------------------------------------------------------------------

function localLeadScore(input: LeadScoreInput): LeadScoreResult {
  const probPart = input.probability * 0.4
  const amtPart = Math.min((input.amount / 500_000) * 30, 30)
  const priorityPart: Record<string, number> = { high: 20, medium: 12, low: 5 }
  const sourcePart = input.source ? 10 : 0
  const score = Math.round(Math.min(probPart + amtPart + (priorityPart[input.priority] ?? 10) + sourcePart, 100))

  const recommendations: string[] = []
  if (input.probability < 30) recommendations.push('Уточните потребности клиента')
  if (input.amount === 0) recommendations.push('Установите бюджет сделки')
  if (!input.source) recommendations.push('Укажите источник лида')
  if (input.stage === 'new') recommendations.push('Переведите в стадию квалификации')
  if (recommendations.length < 2) recommendations.push('Назначьте следующий шаг и дату')

  return {
    score,
    confidence: score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low',
    summary: score >= 70
      ? 'Лид с высоким потенциалом закрытия.'
      : score >= 40
        ? 'Лид требует дополнительной проработки.'
        : 'Лид находится на ранней стадии, нужна квалификация.',
    recommendations: recommendations.slice(0, 3),
    source: 'local',
  }
}

function localInsights(input: InsightInput): InsightResult {
  const data = input.data
  const insights: string[] = []

  if (input.entityType === 'lead') {
    const amount = Number(data.amount ?? 0)
    if (amount > 100_000) insights.push(`Высокий потенциал сделки: ${amount.toLocaleString('ru')} ₽`)
    if (data.stage === 'new') insights.push('Лид не проквалифицирован — нужно уточнить потребности')
    insights.push('Свяжитесь с клиентом в течение 24 часов')
    return { insights, nextAction: 'Позвонить клиенту и уточнить бюджет', source: 'local' }
  }
  if (input.entityType === 'contact') {
    insights.push('Персонализируйте коммуникацию под должность контакта')
    insights.push('Предложите бесплатную консультацию')
    insights.push('Отправьте релевантный кейс компании')
    return { insights, nextAction: 'Отправить персонализированное письмо', source: 'local' }
  }
  insights.push('Изучите историю взаимодействий')
  insights.push('Определите ключевого ЛПР в компании')
  insights.push('Подготовьте коммерческое предложение')
  return { insights, nextAction: 'Назначить встречу с ЛПР', source: 'local' }
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@injectable()
export class AiService {
  private providers: ProviderClient[] = []
  private activeProviderName: string = 'local'
  private available: boolean | null = null

  private buildProviders(): ProviderClient[] {
    const result: ProviderClient[] = []

    // OpenRouter first — working provider
    try {
      const cfg = config.get<ProviderConfig>('openrouter')
      const apiKey = process.env.OPENROUTER_API_KEY ?? cfg.apiKey
      if (apiKey) {
        result.push({
          name: 'openrouter',
          client: new OpenAI({ apiKey, baseURL: cfg.baseURL }),
          model: process.env.OPENROUTER_MODEL ?? cfg.model ?? 'deepseek/deepseek-chat',
        })
      }
    } catch { /* config not found */ }

    // DeepSeek as fallback (if balance topped up)
    try {
      const cfg = config.get<ProviderConfig>('deepseek')
      const apiKey = process.env.DEEPSEEK_API_KEY ?? cfg.apiKey
      if (apiKey) {
        result.push({
          name: 'deepseek',
          client: new OpenAI({ apiKey, baseURL: cfg.baseURL }),
          model: process.env.DEEPSEEK_MODEL ?? cfg.model ?? 'deepseek-chat',
        })
      }
    } catch { /* config not found */ }

    return result
  }

  private getProviders(): ProviderClient[] {
    if (this.providers.length === 0) {
      this.providers = this.buildProviders()
    }
    return this.providers
  }

  private async callAi<T>(
    buildRequest: (client: OpenAI, model: string) => Promise<T>,
    fallback: T,
  ): Promise<T> {
    const providers = this.getProviders()
    if (providers.length === 0) return fallback

    for (const provider of providers) {
      try {
        const result = await buildRequest(provider.client, provider.model)
        this.available = true
        this.activeProviderName = provider.name
        return result
      } catch (err) {
        const status = (err as { status?: number }).status
        if (status === 402) console.warn(`[AI] ${provider.name}: Insufficient balance (402) — trying next`)
        else if (status === 401) console.warn(`[AI] ${provider.name}: Invalid API key (401) — trying next`)
        else console.warn(`[AI] ${provider.name} error:`, (err as Error).message, '— trying next')
      }
    }

    this.available = false
    return fallback
  }

  async getStatus(): Promise<{ available: boolean; model: string; hasKey: boolean }> {
    const providers = this.getProviders()
    const active = providers.find((p) => p.name === this.activeProviderName)
    return {
      available: this.available ?? false,
      model: active ? `${active.name} (${active.model})` : 'local',
      hasKey: providers.length > 0,
    }
  }

  async scoreLead(input: LeadScoreInput): Promise<LeadScoreResult> {
    const prompt = `You are a CRM sales analyst. Score this lead from 0 to 100.

Lead:
- Title: ${input.title}
- Amount: ${input.amount} RUB
- Stage: ${input.stage}
- Priority: ${input.priority}
- Probability set by manager: ${input.probability}%
- Source: ${input.source ?? 'unknown'}
- Description: ${input.description ?? 'none'}
- Days since created: ${input.daysSinceCreated ?? 0}

Respond ONLY with JSON:
{"score":<0-100>,"confidence":"high|medium|low","summary":"<1-2 sentences>","recommendations":["<tip1>","<tip2>","<tip3>"]}`

    return this.callAi<LeadScoreResult>(
      async (client, model) => {
        const res = await client.chat.completions.create({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 400,
          response_format: { type: 'json_object' },
        })
        const parsed = JSON.parse(res.choices[0]?.message?.content ?? '{}') as LeadScoreResult
        return {
          score: Math.max(0, Math.min(100, Number(parsed.score) || 0)),
          confidence: parsed.confidence ?? 'medium',
          summary: parsed.summary ?? '',
          recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations.slice(0, 3) : [],
          source: 'deepseek',
        }
      },
      localLeadScore(input),
    )
  }

  async getInsights(input: InsightInput): Promise<InsightResult> {
    const prompt = `You are a CRM analyst. Give 3 insights about this ${input.entityType} in Russian.
Data: ${JSON.stringify(input.data)}
Respond ONLY with JSON: {"insights":["...","...","..."],"nextAction":"..."}`

    return this.callAi<InsightResult>(
      async (client, model) => {
        const res = await client.chat.completions.create({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.4,
          max_tokens: 350,
          response_format: { type: 'json_object' },
        })
        const parsed = JSON.parse(res.choices[0]?.message?.content ?? '{}') as InsightResult
        return {
          insights: Array.isArray(parsed.insights) ? parsed.insights.slice(0, 3) : [],
          nextAction: parsed.nextAction ?? '',
          source: 'deepseek',
        }
      },
      localInsights(input),
    )
  }

  async enrichContact(data: { firstName: string; lastName?: string | null; email?: string | null; position?: string | null; company?: string }): Promise<{ suggestedSegment: string; potentialValue: string; engagementTip: string; source: string }> {
    const prompt = `CRM assistant. Analyze contact and return enrichment in Russian.
Contact: ${JSON.stringify(data)}
JSON only: {"suggestedSegment":"VIP|Холодный|Тёплый|Горячий|Партнёр","potentialValue":"High|Medium|Low","engagementTip":"<tip>"}`

    return this.callAi(
      async (client, model) => {
        const res = await client.chat.completions.create({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.4,
          max_tokens: 200,
          response_format: { type: 'json_object' },
        })
        const parsed = JSON.parse(res.choices[0]?.message?.content ?? '{}') as { suggestedSegment: string; potentialValue: string; engagementTip: string }
        return { ...parsed, source: 'deepseek' }
      },
      { suggestedSegment: 'Тёплый', potentialValue: 'Medium', engagementTip: 'Свяжитесь в течение 48 часов', source: 'local' },
    )
  }

  async generateEmailDraft(context: { recipientName: string; subject: string; purpose: string; senderName?: string }): Promise<{ subject: string; body: string; source: string }> {
    const prompt = `Write professional Russian business email.
To: ${context.recipientName}, Subject: ${context.subject}, Purpose: ${context.purpose}, From: ${context.senderName ?? 'менеджер'}
JSON only: {"subject":"...","body":"..."}`

    return this.callAi(
      async (client, model) => {
        const res = await client.chat.completions.create({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.6,
          max_tokens: 600,
          response_format: { type: 'json_object' },
        })
        const parsed = JSON.parse(res.choices[0]?.message?.content ?? '{}') as { subject: string; body: string }
        return { ...parsed, source: 'deepseek' }
      },
      {
        subject: context.subject,
        body: `Уважаемый(ая) ${context.recipientName},\n\nОбращаемся к Вам по вопросу: ${context.purpose}.\n\nБудем рады обсудить детали в удобное для Вас время.\n\nС уважением,\n${context.senderName ?? 'Команда PulsarCRM'}`,
        source: 'local',
      },
    )
  }

  async chat(messages: { role: 'user' | 'assistant'; content: string }[], systemPrompt?: string): Promise<{ content: string; source: 'deepseek' | 'local' }> {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')?.content ?? ''

    return this.callAi(
      async (client, model) => {
        const msgs: OpenAI.Chat.ChatCompletionMessageParam[] = []
        if (systemPrompt) msgs.push({ role: 'system', content: systemPrompt })
        msgs.push(...messages)
        const res = await client.chat.completions.create({
          model,
          messages: msgs,
          temperature: 0.7,
          max_tokens: 800,
        })
        return { content: res.choices[0]?.message?.content ?? '', source: 'deepseek' as const }
      },
      { content: this.localChatResponse(lastUserMsg), source: 'local' as 'deepseek' | 'local' },
    )
  }

  private localChatResponse(msg: string): string {
    const lower = msg.toLowerCase()
    if (lower.includes('лид') || lower.includes('сделк')) {
      return 'Проанализирую воронку продаж. Сосредоточьтесь на лидах с вероятностью >60% и суммой >100k ₽ — они дают 80% выручки. Рекомендую назначить follow-up звонки в течение 24 часов.'
    }
    if (lower.includes('клиент') || lower.includes('контакт')) {
      return 'Для работы с клиентами: сегментируйте базу по активности, приоритизируйте VIP-клиентов. Средний цикл сделки сократится на 30% при регулярных касаниях каждые 7 дней.'
    }
    if (lower.includes('риск') || lower.includes('угроз')) {
      return 'Основные риски: лиды без активности >14 дней, сделки без следующего шага, клиенты без касаний >30 дней. Рекомендую автоматизировать напоминания.'
    }
    if (lower.includes('прогноз') || lower.includes('план')) {
      return 'Прогноз строится на взвешенной воронке: сумма сделок × вероятность по этапам. Для точного прогноза обновите вероятность в каждом лиде и установите ожидаемые даты закрытия.'
    }
    return 'Я готов помочь с анализом лидов, сделок и клиентов. Уточните ваш вопрос — или выберите быстрый вариант из предложенных.'
  }
}

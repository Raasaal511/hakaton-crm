/**
 * Pre-written AI response templates keyed by intent.
 * Slots like {{leadCount}} are replaced at render time from aiContext.
 * All responses are crafted to sound intelligent and CRM-specific.
 */

export type AiLeadSummary = {
  title: string
  stage: string
  amount: number
  priority: string
  probability: number
}

export type AiContext = {
  leadCount: number
  dealCount: number
  contactCount: number
  topDealTitle: string
  topDealAmount: string
  pipelineValue: string
  wonAmount: string
  conversionRate: string
  orgName: string
  managerName: string
  /** Актуальный список лидов для ответов AI */
  leads: AiLeadSummary[]
}

export type TemplateKey =
  | 'lead_analysis'
  | 'churn_risk'
  | 'forecast'
  | 'kp_generation'
  | 'email_draft'
  | 'sms_draft'
  | 'deal_analysis'
  | 'manager_tips'
  | 'product_recommend'
  | 'urgent_leads'
  | 'pipeline_health'
  | 'greeting'
  | 'analytics_summary'

export const TEMPLATES: Record<TemplateKey, (ctx: AiContext) => string> = {
  lead_analysis: (ctx) =>
    `Анализ лидов ${ctx.orgName}:\n\n` +
    `• Всего лидов: ${ctx.leadCount}\n` +
    `• Объём воронки: ${ctx.pipelineValue}\n` +
    `• Конверсия: ${ctx.conversionRate}\n\n` +
    `Рекомендую сосредоточиться на сделках с высокой вероятностью закрытия.`,
  greeting: (ctx) =>
    `Привет! Я Meridian AI — ваш интеллектуальный CRM-ассистент.\n\n` +
    `Я проанализировал данные ${ctx.orgName}: ${ctx.leadCount} лидов, ${ctx.dealCount} сделок, ${ctx.contactCount} контактов.\n\n` +
    `Вот что я вижу прямо сейчас:\n\n` +
    `• Общий объём воронки: **${ctx.pipelineValue}**\n` +
    `• Сделка с наибольшим потенциалом: **${ctx.topDealTitle}** (${ctx.topDealAmount})\n` +
    `• Конверсия лидов: **${ctx.conversionRate}**\n\n` +
    `Что вас интересует?`,

  urgent_leads: (ctx) =>
    `Анализирую ${ctx.leadCount} лидов по приоритету, давности и сумме...\n\n` +
    `**Требуют немедленного внимания:**\n\n` +
    `🔴 **Высокий риск потери (3 лида)**\n` +
    `• Лиды без активности более 5 дней — вероятность конверсии снижается на 40% каждую неделю\n` +
    `• Рекомендую: позвонить сегодня до 17:00\n\n` +
    `🟡 **Средний приоритет (${Math.max(1, Math.round(ctx.leadCount * 0.3))} лидов)**\n` +
    `• Ожидают коммерческое предложение\n` +
    `• Среднее время ответа у конкурентов: 2 часа\n\n` +
    `🟢 **На этапе переговоров**\n` +
    `• Сделка **${ctx.topDealTitle}** — высокая вероятность закрытия\n` +
    `• Сумма: ${ctx.topDealAmount} · Рекомендую финальную встречу\n\n` +
    `Общий потенциал срочных лидов: **${ctx.pipelineValue}**`,

  churn_risk: (ctx) =>
    `Запускаю анализ рисков оттока по ${ctx.contactCount} клиентам...\n\n` +
    `**Сводка по рискам:**\n\n` +
    `**Высокий риск (12% базы):**\n` +
    `• Нет активностей за 30+ дней\n` +
    `• Снижение объёма сделок на 25% vs предыдущий период\n` +
    `• Рекомендация: персональный outreach от менеджера\n\n` +
    `**Средний риск (28% базы):**\n` +
    `• Снизилась частота коммуникаций\n` +
    `• Без апсейл-активности 60+ дней\n` +
    `• Рекомендация: отправить обновления продукта + специальное предложение\n\n` +
    `**Индикаторы восстановления:**\n` +
    `• Клиенты с рассылкой открывают письма на 3.2× чаще\n` +
    `• NPS выше у клиентов с 2+ касаниями в квартал\n\n` +
    `Потенциальная потеря выручки при бездействии: ~${ctx.pipelineValue}`,

  forecast: (ctx) =>
    `**Прогноз продаж — следующие 90 дней**\n\n` +
    `На основе исторических данных, текущей воронки и сезонности:\n\n` +
    `**Базовый сценарий (вероятность 65%):**\n` +
    `• Выручка: **${ctx.wonAmount}** (+8% к предыдущему кварталу)\n` +
    `• Закроется сделок: ~${Math.max(3, Math.round(ctx.dealCount * 0.4))}\n` +
    `• Средний чек: ${ctx.topDealAmount}\n\n` +
    `**Оптимистичный сценарий (25%):**\n` +
    `• Выручка: +22% если закрыть топ-3 сделки\n` +
    `• Ключевой драйвер: ${ctx.topDealTitle}\n\n` +
    `**Риск-сценарий (10%):**\n` +
    `• Задержка 2+ крупных сделок → -15% квартального плана\n\n` +
    `**Рекомендации:**\n` +
    `1. Сфокусировать 70% времени команды на сделках с вероятностью 60%+\n` +
    `2. Запустить реактивацию "тёплой" базы (${Math.round(ctx.contactCount * 0.15)} контактов)\n` +
    `3. Ускорить цикл сделок через шаблонные КП`,

  kp_generation: (ctx) =>
    `**КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ**\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `Уважаемый партнёр,\n\n` +
    `Компания **${ctx.orgName}** рада предложить вам комплексное решение, которое позволит оптимизировать бизнес-процессы и увеличить эффективность вашей команды.\n\n` +
    `**Предлагаем:**\n\n` +
    `1. **Внедрение CRM-платформы Meridian**\n` +
    `   • Управление контактами и сделками в единой системе\n` +
    `   • AI-аналитика и прогнозирование воронки продаж\n` +
    `   • Realtime-коллаборация команды\n\n` +
    `2. **Интеграция с вашими инструментами**\n` +
    `   • Почта, мессенджеры, телефония\n` +
    `   • Экспорт в Excel/PDF\n` +
    `   • API для кастомных интеграций\n\n` +
    `3. **Обучение и поддержка**\n` +
    `   • Онбординг команды (3 дня)\n` +
    `   • Выделенный менеджер аккаунта\n` +
    `   • SLA 99.9% uptime\n\n` +
    `**Стоимость:** по запросу, индивидуально под ваш масштаб.\n\n` +
    `Готовы провести демонстрацию в удобное для вас время.\n\n` +
    `С уважением,\n**${ctx.managerName}**\n${ctx.orgName}`,

  email_draft: (ctx) =>
    `**Тема:** Персональное предложение для вас\n\n` +
    `Добрый день!\n\n` +
    `Меня зовут ${ctx.managerName}, я менеджер по работе с клиентами компании ${ctx.orgName}.\n\n` +
    `Мы проанализировали потребности вашего бизнеса и подготовили специальное предложение, которое поможет:\n\n` +
    `• Сократить время на рутинные задачи на 40%\n` +
    `• Увеличить конверсию лидов через AI-скоринг\n` +
    `• Получать актуальную аналитику в реальном времени\n\n` +
    `Сделка **${ctx.topDealTitle}** уже показывает отличные результаты — объём ${ctx.topDealAmount} может стать отправной точкой для нашего сотрудничества.\n\n` +
    `Предлагаю созвониться на 20 минут в любой удобный для вас день.\n\n` +
    `Жду вашего ответа!\n\nС уважением,\n${ctx.managerName}`,

  sms_draft: (_ctx) =>
    `Добрый день! Это ${_ctx.managerName} из ${_ctx.orgName}. Хотел уточнить — вам удобно обсудить наше предложение сегодня после 15:00? Подготовил специальные условия. Ответьте «Да» и я перезвоню. Спасибо!`,

  deal_analysis: (ctx) =>
    `**Анализ сделки: ${ctx.topDealTitle}**\n\n` +
    `**Текущий статус:** на стадии переговоров\n` +
    `**Потенциал:** ${ctx.topDealAmount}\n\n` +
    `**Сильные стороны:**\n` +
    `• Клиент проявляет активный интерес — 3 встречи за месяц\n` +
    `• Бюджет подтверждён\n` +
    `• Конкурентов не упоминал\n\n` +
    `**Риски:**\n` +
    `• Долгий цикл согласования (среднее 21 день)\n` +
    `• Нет подписи ЛПР (лица принимающего решения)\n\n` +
    `**Рекомендуемые следующие шаги:**\n` +
    `1. Запросить встречу с ЛПР на этой неделе\n` +
    `2. Отправить обновлённое КП с ROI-расчётом\n` +
    `3. Предложить пилотный период 14 дней\n\n` +
    `**Прогноз закрытия:** 73% вероятность, ~14 дней`,

  manager_tips: (ctx) =>
    `**Рекомендации для команды**\n\n` +
    `На основе анализа ${ctx.leadCount} лидов и ${ctx.dealCount} сделок:\n\n` +
    `**Что работает хорошо:**\n` +
    `• Лиды с быстрым первым ответом (< 1ч) конвертируются в 3× чаще\n` +
    `• Персонализированные КП закрываются на 28% лучше шаблонных\n` +
    `• Follow-up через 3 дня после встречи увеличивает вероятность на 18%\n\n` +
    `**Зоны роста:**\n` +
    `• Среднее время ответа сейчас: 4.2 часа → цель: 30 минут\n` +
    `• 34% лидов без следующего шага → назначить задачи\n` +
    `• Использование шаблонов писем: 23% → рекомендую 80%+\n\n` +
    `**Топ-3 действия на сегодня:**\n` +
    `1. Позвонить 3 лидам на стадии "Переговоры"\n` +
    `2. Отправить КП по ${ctx.topDealTitle}\n` +
    `3. Обновить статусы у ${Math.round(ctx.leadCount * 0.2)} зависших лидов`,

  product_recommend: (ctx) =>
    `**Рекомендации по продуктам/услугам**\n\n` +
    `Анализирую историю сделок и паттерны покупок...\n\n` +
    `**Кросс-продажи (высокий потенциал):**\n` +
    `• Клиенты купившие продукт А → 67% берут продукт Б в течение 60 дней\n` +
    `• Средний чек апсейла: +${ctx.topDealAmount}\n\n` +
    `**Сезонный спрос:**\n` +
    `• Q3 исторически +22% к услугам автоматизации\n` +
    `• Готовьте специальные пакеты заранее\n\n` +
    `**Неиспользуемый потенциал:**\n` +
    `• ${Math.round(ctx.contactCount * 0.18)} клиентов подходят под premium-тариф, но ещё не предложено\n` +
    `• Потенциал: +${ctx.wonAmount} к годовой выручке\n\n` +
    `Запустить автоматическую кампанию апсейла?`,

  analytics_summary: (ctx) =>
    `**Сводный AI-отчёт по ${ctx.orgName}**\n\n` +
    `**Период:** последние 30 дней\n\n` +
    `📊 **Воронка продаж:**\n` +
    `• Лидов: ${ctx.leadCount} · Сделок: ${ctx.dealCount}\n` +
    `• Общий объём: ${ctx.pipelineValue}\n` +
    `• Закрыто: ${ctx.wonAmount}\n` +
    `• Конверсия: ${ctx.conversionRate}\n\n` +
    `📈 **Динамика:**\n` +
    `• Новых лидов за неделю: ${Math.round(ctx.leadCount * 0.15)}\n` +
    `• Средний цикл сделки: 18 дней\n` +
    `• Прогноз на квартал: ${ctx.pipelineValue} (+12%)\n\n` +
    `⚡ **Ключевые инсайты:**\n` +
    `• Лучшая конверсия: канал "Рекомендации" (34%)\n` +
    `• Самый долгий этап: Переговоры (avg 8 дней)\n` +
    `• Пик активности клиентов: вторник–четверг, 10:00–14:00\n\n` +
    `Экспортировать в PDF?`,

  pipeline_health: (ctx) =>
    `**Здоровье воронки продаж**\n\n` +
    `Общий объём: **${ctx.pipelineValue}**\n\n` +
    `**По этапам:**\n` +
    `• Новые: ${Math.round(ctx.leadCount * 0.3)} лидов\n` +
    `• Квалификация: ${Math.round(ctx.leadCount * 0.25)} лидов\n` +
    `• Предложение: ${Math.round(ctx.leadCount * 0.2)} лидов\n` +
    `• Переговоры: ${Math.round(ctx.leadCount * 0.15)} лидов → ключевой этап\n` +
    `• Закрыто выиграно: ${Math.round(ctx.leadCount * 0.1)} сделок\n\n` +
    `**Узкое место:**\n` +
    `Переход "Предложение → Переговоры" — конверсия 41% (ниже нормы 58%)\n\n` +
    `**Рекомендация:**\n` +
    `Улучшить качество КП + добавить ROI-калькулятор → прогноз роста конверсии на 12pp`,
}

/** Starter prompts shown in the chat interface */
export const STARTER_PROMPTS = [
  { label: 'Какие лиды под угрозой срыва?', key: 'urgent_leads' as TemplateKey },
  { label: 'Прогноз продаж на квартал', key: 'forecast' as TemplateKey },
  { label: 'Сгенерировать коммерческое предложение', key: 'kp_generation' as TemplateKey },
  { label: 'Написать письмо клиенту', key: 'email_draft' as TemplateKey },
  { label: 'Анализ здоровья воронки', key: 'pipeline_health' as TemplateKey },
  { label: 'Риски оттока клиентов', key: 'churn_risk' as TemplateKey },
  { label: 'Рекомендации менеджерам', key: 'manager_tips' as TemplateKey },
  { label: 'Аналитический отчёт', key: 'analytics_summary' as TemplateKey },
]

/** Match a user message to a template key */
export function matchIntent(message: string): TemplateKey {
  const m = message.toLowerCase()
  if (m.includes('сроч') || m.includes('угроз') || m.includes('риск') && m.includes('лид')) return 'urgent_leads'
  if (m.includes('отток') || m.includes('потер') || m.includes('churn')) return 'churn_risk'
  if (m.includes('прогноз') || m.includes('forecast') || m.includes('квартал')) return 'forecast'
  if (m.includes('кп') || m.includes('коммерч') || m.includes('предложен')) return 'kp_generation'
  if (m.includes('письм') || m.includes('email') || m.includes('написать')) return 'email_draft'
  if (m.includes('смс') || m.includes('sms') || m.includes('сообщен')) return 'sms_draft'
  if (m.includes('сделк') || m.includes('deal')) return 'deal_analysis'
  if (m.includes('менеджер') || m.includes('команд') || m.includes('совет')) return 'manager_tips'
  if (m.includes('товар') || m.includes('продукт') || m.includes('рекоменд')) return 'product_recommend'
  if (m.includes('аналитик') || m.includes('отчёт') || m.includes('отчет') || m.includes('summary')) return 'analytics_summary'
  if (m.includes('воронк') || m.includes('pipeline') || m.includes('здоров')) return 'pipeline_health'
  return 'analytics_summary'
}

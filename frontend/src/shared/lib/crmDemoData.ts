export type ContactStatus = 'active' | 'inactive' | 'prospect'
export type LeadStage = 'new' | 'qualification' | 'proposal' | 'negotiation' | 'won' | 'lost'
export type DealPriority = 'low' | 'medium' | 'high'
export type ProductCategory = 'software' | 'hardware' | 'service' | 'license'
export type ServiceCategory = 'consulting' | 'support' | 'development' | 'training'

export interface CrmContact {
  id: number
  name: string
  avatar: string
  company: string
  companyId: number
  position: string
  email: string
  phone: string
  tags: string[]
  status: ContactStatus
  lastActivity: string
  deals: number
  totalValue: number
  source: string
}

export interface CrmCompany {
  id: number
  name: string
  avatar: string
  industry: string
  employees: number
  website: string
  revenue: number
  dealsCount: number
  totalDeals: number
  manager: string
  status: 'active' | 'inactive' | 'prospect'
  city: string
  phone: string
}

export interface CrmLead {
  id: number
  title: string
  contactName: string
  contactAvatar: string
  company: string
  amount: number
  stage: LeadStage
  priority: DealPriority
  responsible: string
  responsibleAvatar: string
  source: string
  createdAt: string
  updatedAt: string
  tags: string[]
  probability: number
}

export interface CrmProduct {
  id: number
  name: string
  sku: string
  category: ProductCategory
  price: number
  stock: number
  unit: string
  description: string
  tags: string[]
  active: boolean
  imageColor: string
}

export interface CrmService {
  id: number
  name: string
  category: ServiceCategory
  price: number
  unit: string
  duration: string
  description: string
  executors: string[]
  active: boolean
  color: string
}

export const DEMO_CONTACTS: CrmContact[] = [
  { id: 1, name: 'Александр Петров', avatar: 'АП', company: 'ООО Альфа Технологии', companyId: 1, position: 'Генеральный директор', email: 'a.petrov@alpha-tech.ru', phone: '+7 (495) 123-45-67', tags: ['VIP', 'Клиент'], status: 'active', lastActivity: '2026-06-14', deals: 3, totalValue: 1250000, source: 'Рекомендация' },
  { id: 2, name: 'Мария Соколова', avatar: 'МС', company: 'ЗАО Прогресс Групп', companyId: 2, position: 'Директор по закупкам', email: 'm.sokolova@progress.ru', phone: '+7 (812) 234-56-78', tags: ['Партнёр'], status: 'active', lastActivity: '2026-06-13', deals: 2, totalValue: 780000, source: 'Выставка' },
  { id: 3, name: 'Дмитрий Козлов', avatar: 'ДК', company: 'ИП Козлов Д.С.', companyId: 3, position: 'Владелец', email: 'd.kozlov@mail.ru', phone: '+7 (903) 345-67-89', tags: ['Перспективный'], status: 'prospect', lastActivity: '2026-06-12', deals: 0, totalValue: 0, source: 'Сайт' },
  { id: 4, name: 'Елена Новикова', avatar: 'ЕН', company: 'ООО Ромашка Плюс', companyId: 4, position: 'Финансовый директор', email: 'e.novikova@romashka.ru', phone: '+7 (495) 456-78-90', tags: ['VIP', 'Повторный'], status: 'active', lastActivity: '2026-06-11', deals: 5, totalValue: 3400000, source: 'Партнёр' },
  { id: 5, name: 'Сергей Волков', avatar: 'СВ', company: 'АО МегаСтрой', companyId: 5, position: 'Технический директор', email: 's.volkov@megastroy.ru', phone: '+7 (921) 567-89-01', tags: ['Строительство'], status: 'active', lastActivity: '2026-06-10', deals: 1, totalValue: 560000, source: 'Холодный звонок' },
  { id: 6, name: 'Анна Морозова', avatar: 'АМ', company: 'ООО Инновации', companyId: 6, position: 'Руководитель IT', email: 'a.morozova@innov.ru', phone: '+7 (495) 678-90-12', tags: ['IT', 'Клиент'], status: 'active', lastActivity: '2026-06-09', deals: 4, totalValue: 2100000, source: 'LinkedIn' },
  { id: 7, name: 'Игорь Лебедев', avatar: 'ИЛ', company: 'ГК Лебедь', companyId: 7, position: 'Коммерческий директор', email: 'i.lebedev@lebed.ru', phone: '+7 (916) 789-01-23', tags: ['Крупный'], status: 'active', lastActivity: '2026-06-08', deals: 2, totalValue: 890000, source: 'Конференция' },
  { id: 8, name: 'Татьяна Кузнецова', avatar: 'ТК', company: 'ООО Свет', companyId: 8, position: 'Директор', email: 't.kuznetsova@svet.ru', phone: '+7 (812) 890-12-34', tags: ['Сервис'], status: 'inactive', lastActivity: '2026-05-20', deals: 1, totalValue: 150000, source: 'Email' },
  { id: 9, name: 'Павел Орлов', avatar: 'ПО', company: 'ООО Орион', companyId: 9, position: 'Менеджер по закупкам', email: 'p.orlov@orion.ru', phone: '+7 (903) 901-23-45', tags: ['Новый'], status: 'prospect', lastActivity: '2026-06-07', deals: 0, totalValue: 0, source: 'Рекомендация' },
  { id: 10, name: 'Светлана Попова', avatar: 'СП', company: 'ЗАО Техпром', companyId: 10, position: 'CEO', email: 's.popova@techprom.ru', phone: '+7 (495) 012-34-56', tags: ['VIP', 'Производство'], status: 'active', lastActivity: '2026-06-14', deals: 7, totalValue: 5600000, source: 'Партнёр' },
  { id: 11, name: 'Андрей Семёнов', avatar: 'АС', company: 'ООО Альфа Технологии', companyId: 1, position: 'CTO', email: 'a.semenov@alpha-tech.ru', phone: '+7 (916) 123-45-67', tags: ['IT'], status: 'active', lastActivity: '2026-06-12', deals: 1, totalValue: 320000, source: 'Рекомендация' },
  { id: 12, name: 'Ольга Захарова', avatar: 'ОЗ', company: 'ГК Лебедь', companyId: 7, position: 'Бухгалтер', email: 'o.zaharova@lebed.ru', phone: '+7 (812) 234-56-79', tags: ['Финансы'], status: 'active', lastActivity: '2026-06-06', deals: 0, totalValue: 0, source: 'Конференция' },
]

export const DEMO_COMPANIES: CrmCompany[] = [
  { id: 1, name: 'ООО Альфа Технологии', avatar: 'АТ', industry: 'Информационные технологии', employees: 150, website: 'alpha-tech.ru', revenue: 45000000, dealsCount: 4, totalDeals: 1570000, manager: 'Иван Смирнов', status: 'active', city: 'Москва', phone: '+7 (495) 100-20-30' },
  { id: 2, name: 'ЗАО Прогресс Групп', avatar: 'ПГ', industry: 'Логистика', employees: 320, website: 'progress-group.ru', revenue: 120000000, dealsCount: 2, totalDeals: 780000, manager: 'Анна Белова', status: 'active', city: 'Санкт-Петербург', phone: '+7 (812) 200-30-40' },
  { id: 3, name: 'ИП Козлов Д.С.', avatar: 'КД', industry: 'Розничная торговля', employees: 5, website: '', revenue: 3000000, dealsCount: 0, totalDeals: 0, manager: 'Иван Смирнов', status: 'prospect', city: 'Екатеринбург', phone: '+7 (343) 300-40-50' },
  { id: 4, name: 'ООО Ромашка Плюс', avatar: 'РП', industry: 'Производство', employees: 850, website: 'romashka.ru', revenue: 780000000, dealsCount: 5, totalDeals: 3400000, manager: 'Мария Чернова', status: 'active', city: 'Москва', phone: '+7 (495) 400-50-60' },
  { id: 5, name: 'АО МегаСтрой', avatar: 'МС', industry: 'Строительство', employees: 1200, website: 'megastroy.ru', revenue: 2100000000, dealsCount: 1, totalDeals: 560000, manager: 'Анна Белова', status: 'active', city: 'Краснодар', phone: '+7 (861) 500-60-70' },
  { id: 6, name: 'ООО Инновации', avatar: 'ИН', industry: 'Информационные технологии', employees: 45, website: 'innov.ru', revenue: 25000000, dealsCount: 4, totalDeals: 2100000, manager: 'Иван Смирнов', status: 'active', city: 'Москва', phone: '+7 (495) 600-70-80' },
  { id: 7, name: 'ГК Лебедь', avatar: 'ГЛ', industry: 'Торговля', employees: 250, website: 'lebed.ru', revenue: 95000000, dealsCount: 2, totalDeals: 890000, manager: 'Мария Чернова', status: 'active', city: 'Новосибирск', phone: '+7 (383) 700-80-90' },
  { id: 8, name: 'ООО Свет', avatar: 'СВ', industry: 'Энергетика', employees: 60, website: 'svet.ru', revenue: 18000000, dealsCount: 1, totalDeals: 150000, manager: 'Иван Смирнов', status: 'inactive', city: 'Казань', phone: '+7 (843) 800-90-01' },
  { id: 9, name: 'ООО Орион', avatar: 'ОР', industry: 'Производство', employees: 180, website: 'orion.ru', revenue: 67000000, dealsCount: 0, totalDeals: 0, manager: 'Анна Белова', status: 'prospect', city: 'Самара', phone: '+7 (846) 900-01-23' },
  { id: 10, name: 'ЗАО Техпром', avatar: 'ТП', industry: 'Машиностроение', employees: 2800, website: 'techprom.ru', revenue: 4500000000, dealsCount: 7, totalDeals: 5600000, manager: 'Мария Чернова', status: 'active', city: 'Челябинск', phone: '+7 (351) 000-12-34' },
]

export const DEMO_LEADS: CrmLead[] = [
  { id: 1, title: 'Внедрение CRM системы', contactName: 'Александр Петров', contactAvatar: 'АП', company: 'ООО Альфа Технологии', amount: 850000, stage: 'negotiation', priority: 'high', responsible: 'Иван Смирнов', responsibleAvatar: 'ИС', source: 'Рекомендация', createdAt: '2026-05-10', updatedAt: '2026-06-14', tags: ['IT', 'Крупный'], probability: 75 },
  { id: 2, title: 'Поставка серверного оборудования', contactName: 'Светлана Попова', contactAvatar: 'СП', company: 'ЗАО Техпром', amount: 2300000, stage: 'proposal', priority: 'high', responsible: 'Мария Чернова', responsibleAvatar: 'МЧ', source: 'Партнёр', createdAt: '2026-05-15', updatedAt: '2026-06-13', tags: ['Оборудование'], probability: 60 },
  { id: 3, title: 'Разработка корпоративного портала', contactName: 'Анна Морозова', contactAvatar: 'АМ', company: 'ООО Инновации', amount: 1200000, stage: 'qualification', priority: 'medium', responsible: 'Иван Смирнов', responsibleAvatar: 'ИС', source: 'LinkedIn', createdAt: '2026-05-20', updatedAt: '2026-06-12', tags: ['Разработка'], probability: 40 },
  { id: 4, title: 'Техническая поддержка 1 год', contactName: 'Елена Новикова', contactAvatar: 'ЕН', company: 'ООО Ромашка Плюс', amount: 480000, stage: 'won', priority: 'medium', responsible: 'Анна Белова', responsibleAvatar: 'АБ', source: 'Партнёр', createdAt: '2026-04-01', updatedAt: '2026-06-10', tags: ['Поддержка', 'Повторный'], probability: 100 },
  { id: 5, title: 'Лицензии Microsoft 365', contactName: 'Сергей Волков', contactAvatar: 'СВ', company: 'АО МегаСтрой', amount: 560000, stage: 'proposal', priority: 'medium', responsible: 'Иван Смирнов', responsibleAvatar: 'ИС', source: 'Холодный звонок', createdAt: '2026-05-25', updatedAt: '2026-06-11', tags: ['Лицензии'], probability: 55 },
  { id: 6, title: 'Аудит информационной безопасности', contactName: 'Игорь Лебедев', contactAvatar: 'ИЛ', company: 'ГК Лебедь', amount: 320000, stage: 'new', priority: 'low', responsible: 'Мария Чернова', responsibleAvatar: 'МЧ', source: 'Конференция', createdAt: '2026-06-05', updatedAt: '2026-06-13', tags: ['Безопасность'], probability: 20 },
  { id: 7, title: 'Облачная инфраструктура AWS', contactName: 'Мария Соколова', contactAvatar: 'МС', company: 'ЗАО Прогресс Групп', amount: 780000, stage: 'negotiation', priority: 'high', responsible: 'Анна Белова', responsibleAvatar: 'АБ', source: 'Выставка', createdAt: '2026-05-08', updatedAt: '2026-06-14', tags: ['Облако', 'Крупный'], probability: 80 },
  { id: 8, title: 'Обучение персонала', contactName: 'Татьяна Кузнецова', contactAvatar: 'ТК', company: 'ООО Свет', amount: 150000, stage: 'lost', priority: 'low', responsible: 'Иван Смирнов', responsibleAvatar: 'ИС', source: 'Email', createdAt: '2026-04-15', updatedAt: '2026-05-30', tags: ['Обучение'], probability: 0 },
  { id: 9, title: 'ERP система для производства', contactName: 'Светлана Попова', contactAvatar: 'СП', company: 'ЗАО Техпром', amount: 4500000, stage: 'qualification', priority: 'high', responsible: 'Мария Чернова', responsibleAvatar: 'МЧ', source: 'Партнёр', createdAt: '2026-06-01', updatedAt: '2026-06-14', tags: ['ERP', 'Производство'], probability: 35 },
  { id: 10, title: 'Видеонаблюдение офиса', contactName: 'Дмитрий Козлов', contactAvatar: 'ДК', company: 'ИП Козлов Д.С.', amount: 95000, stage: 'new', priority: 'low', responsible: 'Анна Белова', responsibleAvatar: 'АБ', source: 'Сайт', createdAt: '2026-06-10', updatedAt: '2026-06-12', tags: ['Безопасность'], probability: 15 },
  { id: 11, title: 'Модернизация сети', contactName: 'Андрей Семёнов', contactAvatar: 'АС', company: 'ООО Альфа Технологии', amount: 420000, stage: 'proposal', priority: 'medium', responsible: 'Иван Смирнов', responsibleAvatar: 'ИС', source: 'Рекомендация', createdAt: '2026-05-28', updatedAt: '2026-06-11', tags: ['Сети'], probability: 50 },
  { id: 12, title: 'Лицензирование ПО', contactName: 'Павел Орлов', contactAvatar: 'ПО', company: 'ООО Орион', amount: 210000, stage: 'new', priority: 'low', responsible: 'Мария Чернова', responsibleAvatar: 'МЧ', source: 'Рекомендация', createdAt: '2026-06-07', updatedAt: '2026-06-13', tags: ['Лицензии'], probability: 25 },
]

export const DEMO_PRODUCTS: CrmProduct[] = [
  { id: 1, name: 'CRM PulsarCRM Pro', sku: 'CRM-PRO-001', category: 'software', price: 45000, stock: 999, unit: 'лиц/год', description: 'Полная лицензия CRM системы для команды до 50 пользователей', tags: ['CRM', 'Популярный'], active: true, imageColor: '#4361ee' },
  { id: 2, name: 'CRM PulsarCRM Enterprise', sku: 'CRM-ENT-001', category: 'software', price: 120000, stock: 999, unit: 'лиц/год', description: 'Корпоративная лицензия без ограничений пользователей', tags: ['CRM', 'Enterprise'], active: true, imageColor: '#7c3aed' },
  { id: 3, name: 'Сервер Dell PowerEdge R750', sku: 'HW-SRV-001', category: 'hardware', price: 380000, stock: 12, unit: 'шт', description: '2x Intel Xeon, 128GB RAM, 4x2TB NVMe', tags: ['Сервер', 'Dell'], active: true, imageColor: '#0f766e' },
  { id: 4, name: 'Коммутатор Cisco Catalyst 9200', sku: 'HW-NET-001', category: 'hardware', price: 85000, stock: 25, unit: 'шт', description: '24 порта PoE+, управляемый, 1Gbps', tags: ['Сеть', 'Cisco'], active: true, imageColor: '#0369a1' },
  { id: 5, name: 'Антивирус Kaspersky Business', sku: 'LIC-AV-001', category: 'license', price: 3200, stock: 500, unit: 'лиц/год', description: 'Корпоративная защита рабочих станций', tags: ['Безопасность'], active: true, imageColor: '#dc2626' },
  { id: 6, name: 'Microsoft 365 Business', sku: 'LIC-MS-001', category: 'license', price: 7500, stock: 999, unit: 'лиц/год', description: 'Пакет Office + Teams + SharePoint + почта', tags: ['Microsoft', 'Популярный'], active: true, imageColor: '#d97706' },
  { id: 7, name: 'IP-камера Hikvision DS-2CD2', sku: 'HW-CAM-001', category: 'hardware', price: 12000, stock: 80, unit: 'шт', description: 'Разрешение 4MP, PoE, ночное видение', tags: ['Безопасность', 'Видеонаблюдение'], active: true, imageColor: '#374151' },
  { id: 8, name: '1С:Предприятие 8.3', sku: 'LIC-1C-001', category: 'license', price: 25000, stock: 999, unit: 'лиц', description: 'Базовая версия для ведения учёта', tags: ['1С', 'Бухгалтерия'], active: true, imageColor: '#ca8a04' },
  { id: 9, name: 'NAS Synology DS923+', sku: 'HW-NAS-001', category: 'hardware', price: 65000, stock: 8, unit: 'шт', description: 'Сетевое хранилище 4 отсека, 10GbE', tags: ['Хранилище', 'Synology'], active: true, imageColor: '#475569' },
  { id: 10, name: 'VPN сервис корпоративный', sku: 'SVC-VPN-001', category: 'service', price: 18000, stock: 999, unit: 'год', description: 'Защищённый VPN для удалённых сотрудников', tags: ['Безопасность', 'Облако'], active: true, imageColor: '#0891b2' },
  { id: 11, name: 'Firewall Fortinet FG-60F', sku: 'HW-FW-001', category: 'hardware', price: 95000, stock: 5, unit: 'шт', description: 'NGFW 10Gbps, SSL-VPN, IPS', tags: ['Безопасность', 'Fortinet'], active: false, imageColor: '#b91c1c' },
  { id: 12, name: 'Облачное хранилище S3', sku: 'SVC-S3-001', category: 'service', price: 500, stock: 999, unit: 'ТБ/мес', description: 'Объектное хранилище S3-совместимое', tags: ['Облако', 'Хранилище'], active: true, imageColor: '#7c3aed' },
]

export const DEMO_SERVICES: CrmService[] = [
  { id: 1, name: 'Внедрение CRM системы', category: 'consulting', price: 150000, unit: 'проект', duration: '2–4 недели', description: 'Полное развёртывание CRM: настройка, интеграции, обучение', executors: ['Иван Смирнов', 'Анна Белова'], active: true, color: '#4361ee' },
  { id: 2, name: 'Техническая поддержка 24/7', category: 'support', price: 35000, unit: 'мес', duration: 'Непрерывно', description: 'SLA 4 часа, выделенный инженер, мониторинг', executors: ['Дежурный инженер'], active: true, color: '#0f766e' },
  { id: 3, name: 'Разработка корпоративного ПО', category: 'development', price: 12000, unit: 'час', duration: 'По договору', description: 'Команда Full-Stack разработчиков для заказной разработки', executors: ['Команда разработки'], active: true, color: '#7c3aed' },
  { id: 4, name: 'Аудит информационной безопасности', category: 'consulting', price: 180000, unit: 'проект', duration: '3–5 дней', description: 'Пентест, анализ угроз, рекомендации по защите', executors: ['Мария Чернова'], active: true, color: '#dc2626' },
  { id: 5, name: 'Обучение сотрудников', category: 'training', price: 8000, unit: 'чел/день', duration: '1–5 дней', description: 'Обучение работе с корпоративными системами и ПО', executors: ['Иван Смирнов', 'Анна Белова'], active: true, color: '#d97706' },
  { id: 6, name: 'Миграция в облако', category: 'consulting', price: 220000, unit: 'проект', duration: '4–8 недель', description: 'Перенос инфраструктуры в AWS/Azure/Яндекс Облако', executors: ['Команда DevOps'], active: true, color: '#0369a1' },
  { id: 7, name: 'Мониторинг инфраструктуры', category: 'support', price: 25000, unit: 'мес', duration: 'Непрерывно', description: 'Zabbix/Grafana, оповещения, ежемесячные отчёты', executors: ['Дежурный инженер'], active: true, color: '#475569' },
  { id: 8, name: 'Разработка мобильного приложения', category: 'development', price: 850000, unit: 'проект', duration: '3–6 месяцев', description: 'iOS + Android, дизайн, разработка, публикация', executors: ['Команда мобильной разработки'], active: false, color: '#0891b2' },
]

export const DASHBOARD_KPI = {
  revenue: { value: 14720000, change: 18.4, period: 'месяц' },
  newLeads: { value: 38, change: 5, period: 'неделя' },
  conversion: { value: 24.3, change: 2.1, period: 'месяц' },
  activeDeals: { value: 87, urgent: 12 },
  avgDealValue: { value: 485000, change: -3.2 },
  wonDeals: { value: 23, change: 15.0 },
}

export const FUNNEL_DATA = [
  { stage: 'Новые лиды', count: 245, color: '#6b80f7', pct: 100 },
  { stage: 'Квалификация', count: 148, color: '#4361ee', pct: 60 },
  { stage: 'КП отправлено', count: 87, color: '#3651dd', pct: 35 },
  { stage: 'Переговоры', count: 41, color: '#2c40b3', pct: 17 },
  { stage: 'Закрыто', count: 23, color: '#1e2d85', pct: 9 },
]

export const RECENT_ACTIVITIES = [
  { id: 1, type: 'call', text: 'Звонок Александру Петрову — обсудили условия контракта', user: 'Иван Смирнов', userAvatar: 'ИС', time: '14:23', date: 'Сегодня', color: '#4361ee' },
  { id: 2, type: 'deal', text: 'Новая сделка «Облачная инфраструктура AWS» — 780 000 ₽', user: 'Анна Белова', userAvatar: 'АБ', time: '13:47', date: 'Сегодня', color: '#0f766e' },
  { id: 3, type: 'win', text: 'Сделка «Техническая поддержка» закрыта ✓ 480 000 ₽', user: 'Анна Белова', userAvatar: 'АБ', time: '11:02', date: 'Сегодня', color: '#1a7f37' },
  { id: 4, type: 'contact', text: 'Новый контакт: Павел Орлов, ООО Орион', user: 'Мария Чернова', userAvatar: 'МЧ', time: '10:15', date: 'Сегодня', color: '#9a6700' },
  { id: 5, type: 'email', text: 'Отправлено КП Светлане Поповой (ЗАО Техпром)', user: 'Мария Чернова', userAvatar: 'МЧ', time: '09:40', date: 'Сегодня', color: '#7c3aed' },
  { id: 6, type: 'meeting', text: 'Встреча с командой ЗАО Прогресс Групп в офисе', user: 'Иван Смирнов', userAvatar: 'ИС', time: '17:30', date: 'Вчера', color: '#dc2626' },
]

export const TOP_DEALS = [
  { id: 9, title: 'ERP система для производства', company: 'ЗАО Техпром', amount: 4500000, stage: 'qualification', probability: 35, responsible: 'Мария Чернова' },
  { id: 1, title: 'Внедрение CRM системы', company: 'ООО Альфа Технологии', amount: 850000, stage: 'negotiation', probability: 75, responsible: 'Иван Смирнов' },
  { id: 7, title: 'Облачная инфраструктура AWS', company: 'ЗАО Прогресс Групп', amount: 780000, stage: 'negotiation', probability: 80, responsible: 'Анна Белова' },
  { id: 2, title: 'Поставка серверного оборудования', company: 'ЗАО Техпром', amount: 2300000, stage: 'proposal', probability: 60, responsible: 'Мария Чернова' },
  { id: 3, title: 'Разработка корпоративного портала', company: 'ООО Инновации', amount: 1200000, stage: 'qualification', probability: 40, responsible: 'Иван Смирнов' },
]

export const REVENUE_TREND = [
  { month: 'Янв', revenue: 8200000, deals: 14 },
  { month: 'Фев', revenue: 9100000, deals: 17 },
  { month: 'Мар', revenue: 10400000, deals: 19 },
  { month: 'Апр', revenue: 11800000, deals: 22 },
  { month: 'Май', revenue: 13200000, deals: 26 },
  { month: 'Июн', revenue: 14720000, deals: 23 },
]

export const LEAD_STAGE_LABELS: Record<LeadStage, string> = {
  new: 'Новый',
  qualification: 'Квалификация',
  proposal: 'КП отправлено',
  negotiation: 'Переговоры',
  won: 'Выиграно',
  lost: 'Проиграно',
}

export const LEAD_STAGE_COLORS: Record<LeadStage, string> = {
  new: '#6b7280',
  qualification: '#4361ee',
  proposal: '#7c3aed',
  negotiation: '#d97706',
  won: '#1a7f37',
  lost: '#cf222e',
}

export const PRIORITY_LABELS: Record<DealPriority, string> = {
  low: 'Низкий',
  medium: 'Средний',
  high: 'Высокий',
}

export const PRIORITY_COLORS: Record<DealPriority, string> = {
  low: '#6b7280',
  medium: '#d97706',
  high: '#cf222e',
}

export const SOURCE_LABELS: Record<string, string> = {
  recommendation: 'Рекомендация',
  website: 'Сайт',
  exhibition: 'Выставка',
  partner: 'Партнёр',
  cold_call: 'Холодный звонок',
  linkedin: 'LinkedIn',
  email: 'Email',
  conference: 'Конференция',
}

export function formatRubles(value: number): string {
  if (value >= 1_000_000) {
    const m = value / 1_000_000
    return `${m % 1 === 0 ? m : m.toFixed(1)} млн ₽`
  }
  if (value >= 1000) {
    return `${Math.round(value / 1000)} тыс. ₽`
  }
  return `${value.toLocaleString('ru-RU')} ₽`
}

/**
 * Demo seed script — populates the DB with realistic CRM data for hackathon demo.
 * Run: npx tsx scripts/seed-demo.ts
 *
 * Creates:
 *   - 1 demo organization
 *   - 3 users (owner, manager, employee)
 *   - 4 segments
 *   - 8 companies
 *   - 15 contacts
 *   - 3 lead sources
 *   - 4 deal stages
 *   - 20 leads
 *   - 8 product categories + 12 products
 *   - 6 services
 */

import 'dotenv/config'
import 'reflect-metadata'
import bcrypt from 'bcrypt'
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { eq } from 'drizzle-orm'
import {
  usersSchema,
  organizationsSchema,
  usersToOrganizationsSchema,
  crmSegmentsSchema,
  crmCompaniesSchema,
  crmContactsSchema,
  crmLeadSourcesSchema,
  crmDealStagesSchema,
  crmLeadsSchema,
  productCategoriesSchema,
  productsSchema,
  servicesSchema,
} from '../src/infra/database/drizzle/schema.js'

// ── DB connection ─────────────────────────────────────────────────────────────
const pool = new Pool({
  host:     process.env.DB_HOST ?? 'localhost',
  port:     Number(process.env.DB_PORT ?? 5432),
  user:     process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? 'postgres',
})
const db = drizzle(pool)

// ── Helpers ───────────────────────────────────────────────────────────────────
async function hashPw(pw: string) {
  return bcrypt.hash(pw, 10)
}

async function findOrCreate<T extends { id: number }>(
  table: any,
  condition: any,
  values: any,
): Promise<T> {
  const existing = await db.select().from(table).where(condition).limit(1)
  if (existing[0]) return existing[0] as T
  const [row] = await db.insert(table).values(values).returning()
  return row as T
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🌱 Seeding demo data...')

  // ── 1. Users ────────────────────────────────────────────────────────────────
  const pw = await hashPw('demo1234')

  const owner = await findOrCreate<any>(
    usersSchema,
    eq(usersSchema.email, 'owner@meridian.demo'),
    { email: 'owner@meridian.demo', hashPassword: pw, firstname: 'Алексей', lastname: 'Петров', systemRole: 'root' },
  )
  const manager = await findOrCreate<any>(
    usersSchema,
    eq(usersSchema.email, 'manager@meridian.demo'),
    { email: 'manager@meridian.demo', hashPassword: pw, firstname: 'Мария', lastname: 'Соколова', systemRole: 'user' },
  )
  const employee = await findOrCreate<any>(
    usersSchema,
    eq(usersSchema.email, 'employee@meridian.demo'),
    { email: 'employee@meridian.demo', hashPassword: pw, firstname: 'Денис', lastname: 'Козлов', systemRole: 'user' },
  )

  console.log('  ✓ Users created (email: owner@meridian.demo / manager@meridian.demo, pw: demo1234)')

  // ── 2. Organization ──────────────────────────────────────────────────────────
  const org = await findOrCreate<any>(
    organizationsSchema,
    eq(organizationsSchema.name, 'Meridian Demo'),
    { name: 'Meridian Demo', ownerUserId: owner.id },
  )

  await findOrCreate<any>(
    usersToOrganizationsSchema,
    eq(usersToOrganizationsSchema.userId, owner.id),
    { organizationId: org.id, userId: owner.id, role: 'owner' },
  )
  await findOrCreate<any>(
    usersToOrganizationsSchema,
    eq(usersToOrganizationsSchema.userId, manager.id),
    { organizationId: org.id, userId: manager.id, role: 'admin' },
  )
  await findOrCreate<any>(
    usersToOrganizationsSchema,
    eq(usersToOrganizationsSchema.userId, employee.id),
    { organizationId: org.id, userId: employee.id, role: 'member' },
  )

  console.log(`  ✓ Organization: "${org.name}" (id: ${org.id})`)

  // ── 3. Segments ──────────────────────────────────────────────────────────────
  const segmentsData = [
    { name: 'VIP клиенты', color: '#6366f1', description: 'Крупные клиенты с высоким LTV' },
    { name: 'Холодная база', color: '#94a3b8', description: 'Первичный контакт' },
    { name: 'Горячие лиды', color: '#ef4444', description: 'Готовы к покупке' },
    { name: 'Постоянные клиенты', color: '#10b981', description: 'Повторные покупки' },
  ]
  const segments: any[] = []
  for (const s of segmentsData) {
    const seg = await findOrCreate<any>(
      crmSegmentsSchema,
      eq(crmSegmentsSchema.name, s.name),
      { organizationId: org.id, ...s },
    )
    segments.push(seg)
  }
  console.log(`  ✓ ${segments.length} segments`)

  // ── 4. Companies ─────────────────────────────────────────────────────────────
  const companiesData = [
    { name: 'ООО "ТехноПром"', industry: 'Промышленность', city: 'Москва', employeesCount: 450, annualRevenue: 85000000, status: 'active', website: 'https://technoprom.ru', email: 'info@technoprom.ru', phone: '+7 495 123-45-67' },
    { name: 'Сбер Решения', industry: 'Финансы', city: 'Москва', employeesCount: 12000, annualRevenue: 500000000, status: 'active', website: 'https://sber.ru', email: 'b2b@sber.ru', phone: '+7 800 555-55-55' },
    { name: 'АО "АгроМаш"', industry: 'Сельское хозяйство', city: 'Краснодар', employeesCount: 280, annualRevenue: 42000000, status: 'active', email: 'sales@agromash.ru', phone: '+7 861 234-56-78' },
    { name: 'Ритейл Групп', industry: 'Розничная торговля', city: 'Санкт-Петербург', employeesCount: 1200, annualRevenue: 320000000, status: 'active', email: 'crm@retailgroup.ru', phone: '+7 812 765-43-21' },
    { name: 'МедТех Инновации', industry: 'Здравоохранение', city: 'Новосибирск', employeesCount: 95, annualRevenue: 18000000, status: 'prospect', email: 'contact@medtech.ru', phone: '+7 383 111-22-33' },
    { name: 'СтройКомплекс', industry: 'Строительство', city: 'Екатеринбург', employeesCount: 650, annualRevenue: 120000000, status: 'active', email: 'zakaz@stroykomplex.ru', phone: '+7 343 444-55-66' },
    { name: 'ЛогистикПро', industry: 'Логистика', city: 'Казань', employeesCount: 380, annualRevenue: 67000000, status: 'inactive', email: 'info@logistikpro.ru', phone: '+7 843 777-88-99' },
    { name: 'DataFlow Analytics', industry: 'IT и технологии', city: 'Москва', employeesCount: 72, annualRevenue: 25000000, status: 'active', website: 'https://dataflow.io', email: 'hello@dataflow.io', phone: '+7 495 000-11-22' },
  ]
  const companies: any[] = []
  for (const c of companiesData) {
    const co = await findOrCreate<any>(
      crmCompaniesSchema,
      eq(crmCompaniesSchema.name, c.name),
      { organizationId: org.id, ownerUserId: manager.id, segmentId: segments[0].id, ...c },
    )
    companies.push(co)
  }
  console.log(`  ✓ ${companies.length} companies`)

  // ── 5. Contacts ───────────────────────────────────────────────────────────────
  const contactsData = [
    { firstName: 'Иван', lastName: 'Морозов', email: 'i.morozov@technoprom.ru', phone: '+7 916 100-00-01', position: 'Генеральный директор', status: 'active', source: 'Рекомендации', companyIdx: 0 },
    { firstName: 'Светлана', lastName: 'Новикова', email: 's.novikova@sber.ru', phone: '+7 926 200-00-02', position: 'Директор по закупкам', status: 'active', source: 'Холодный звонок', companyIdx: 1 },
    { firstName: 'Андрей', lastName: 'Волков', email: 'a.volkov@agromash.ru', phone: '+7 936 300-00-03', position: 'Коммерческий директор', status: 'active', source: 'Выставка', companyIdx: 2 },
    { firstName: 'Елена', lastName: 'Смирнова', email: 'e.smirnova@retailgroup.ru', phone: '+7 906 400-00-04', position: 'Руководитель IT', status: 'active', source: 'Рекомендации', companyIdx: 3 },
    { firstName: 'Дмитрий', lastName: 'Козлов', email: 'd.kozlov@medtech.ru', phone: '+7 967 500-00-05', position: 'CTO', status: 'prospect', source: 'Сайт', companyIdx: 4 },
    { firstName: 'Ольга', lastName: 'Лебедева', email: 'o.lebedeva@stroykomplex.ru', phone: '+7 977 600-00-06', position: 'Финансовый директор', status: 'active', source: 'Реклама', companyIdx: 5 },
    { firstName: 'Сергей', lastName: 'Попов', email: 's.popov@logistikpro.ru', phone: '+7 987 700-00-07', position: 'Операционный директор', status: 'inactive', source: 'Холодный звонок', companyIdx: 6 },
    { firstName: 'Наталья', lastName: 'Соколова', email: 'n.sokolova@dataflow.io', phone: '+7 997 800-00-08', position: 'CEO', status: 'active', source: 'Рекомендации', companyIdx: 7 },
    { firstName: 'Михаил', lastName: 'Захаров', email: 'm.zakharov@technoprom.ru', phone: '+7 915 900-00-09', position: 'Менеджер по закупкам', status: 'active', source: 'Рекомендации', companyIdx: 0 },
    { firstName: 'Татьяна', lastName: 'Орлова', email: 't.orlova@sber.ru', phone: '+7 925 111-00-10', position: 'Директор по развитию', status: 'active', source: 'Партнёры', companyIdx: 1 },
    { firstName: 'Павел', lastName: 'Зайцев', email: 'p.zaitsev@retailgroup.ru', phone: '+7 935 222-00-11', position: 'Технический директор', status: 'prospect', source: 'Сайт', companyIdx: 3 },
    { firstName: 'Алина', lastName: 'Кузнецова', email: 'a.kuznetsova@medtech.ru', phone: '+7 905 333-00-12', position: 'Директор по продажам', status: 'prospect', source: 'Конференция', companyIdx: 4 },
    { firstName: 'Роман', lastName: 'Белов', email: 'r.belov@dataflow.io', phone: '+7 966 444-00-13', position: 'Product Manager', status: 'active', source: 'Рекомендации', companyIdx: 7 },
    { firstName: 'Юлия', lastName: 'Васильева', email: 'yu.vasilyeva@agromash.ru', phone: '+7 976 555-00-14', position: 'Начальник отдела ИТ', status: 'active', source: 'Выставка', companyIdx: 2 },
    { firstName: 'Николай', lastName: 'Степанов', email: 'n.stepanov@stroykomplex.ru', phone: '+7 986 666-00-15', position: 'Руководитель проектов', status: 'active', source: 'Реклама', companyIdx: 5 },
  ]
  const contacts: any[] = []
  for (const c of contactsData) {
    const { companyIdx, ...rest } = c
    const contact = await findOrCreate<any>(
      crmContactsSchema,
      eq(crmContactsSchema.email, c.email!),
      {
        organizationId: org.id,
        companyId: companies[companyIdx].id,
        ownerUserId: owner.id,
        segmentId: segments[Math.floor(Math.random() * segments.length)].id,
        ...rest,
      },
    )
    contacts.push(contact)
  }
  console.log(`  ✓ ${contacts.length} contacts`)

  // ── 6. Lead sources ───────────────────────────────────────────────────────────
  const sourceNames = ['Рекомендации', 'Холодный звонок', 'Сайт / входящий', 'Выставка', 'Реклама', 'Партнёры']
  const leadSources: any[] = []
  for (const name of sourceNames) {
    const src = await findOrCreate<any>(
      crmLeadSourcesSchema,
      eq(crmLeadSourcesSchema.name, name),
      { organizationId: org.id, name },
    )
    leadSources.push(src)
  }
  console.log(`  ✓ ${leadSources.length} lead sources`)

  // ── 7. Deal stages ────────────────────────────────────────────────────────────
  const stagesData = [
    { name: 'Новый', color: '#94a3b8', probability: 10, order: 1 },
    { name: 'Квалификация', color: '#6366f1', probability: 30, order: 2 },
    { name: 'Предложение', color: '#f59e0b', probability: 55, order: 3 },
    { name: 'Переговоры', color: '#0ea5e9', probability: 75, order: 4 },
    { name: 'Выиграно', color: '#10b981', probability: 100, order: 5 },
    { name: 'Проиграно', color: '#ef4444', probability: 0, order: 6 },
  ]
  const dealStages: any[] = []
  for (const s of stagesData) {
    const stage = await findOrCreate<any>(
      crmDealStagesSchema,
      eq(crmDealStagesSchema.name, s.name),
      { organizationId: org.id, ...s },
    )
    dealStages.push(stage)
  }
  console.log(`  ✓ ${dealStages.length} deal stages`)

  // ── 8. Leads ──────────────────────────────────────────────────────────────────
  const leadsData = [
    { title: 'Автоматизация склада', amount: 1850000, stage: 'negotiation', priority: 'high', probability: 75, contactIdx: 0, companyIdx: 0 },
    { title: 'CRM внедрение Сбер', amount: 3200000, stage: 'proposal', priority: 'high', probability: 55, contactIdx: 1, companyIdx: 1 },
    { title: 'ERP интеграция АгроМаш', amount: 980000, stage: 'qualification', priority: 'medium', probability: 30, contactIdx: 2, companyIdx: 2 },
    { title: 'Цифровизация ритейла', amount: 2400000, stage: 'proposal', priority: 'high', probability: 60, contactIdx: 3, companyIdx: 3 },
    { title: 'МИС для клиники', amount: 650000, stage: 'new', priority: 'medium', probability: 15, contactIdx: 4, companyIdx: 4 },
    { title: 'BIM система строительство', amount: 1200000, stage: 'negotiation', priority: 'high', probability: 70, contactIdx: 5, companyIdx: 5 },
    { title: 'WMS для склада', amount: 870000, stage: 'qualification', priority: 'medium', probability: 35, contactIdx: 6, companyIdx: 6 },
    { title: 'BI аналитика DataFlow', amount: 450000, stage: 'proposal', priority: 'low', probability: 50, contactIdx: 7, companyIdx: 7 },
    { title: 'Модернизация ТехноПром', amount: 2100000, stage: 'won', priority: 'high', probability: 100, contactIdx: 8, companyIdx: 0 },
    { title: 'Расширение Ритейл Групп', amount: 1560000, stage: 'negotiation', priority: 'high', probability: 65, contactIdx: 9, companyIdx: 3 },
    { title: 'ИТ консалтинг МедТех', amount: 320000, stage: 'new', priority: 'low', probability: 20, contactIdx: 11, companyIdx: 4 },
    { title: 'Аналитика данных Ритейл', amount: 780000, stage: 'qualification', priority: 'medium', probability: 40, contactIdx: 10, companyIdx: 3 },
    { title: 'Облачная миграция DataFlow', amount: 1100000, stage: 'proposal', priority: 'high', probability: 55, contactIdx: 12, companyIdx: 7 },
    { title: 'Автоматизация АгроМаш 2.0', amount: 560000, stage: 'negotiation', priority: 'medium', probability: 70, contactIdx: 13, companyIdx: 2 },
    { title: 'Система контроля СтройКомплекс', amount: 2300000, stage: 'won', priority: 'high', probability: 100, contactIdx: 14, companyIdx: 5 },
    { title: 'Логистика ТОП', amount: 430000, stage: 'lost', priority: 'low', probability: 0, contactIdx: 6, companyIdx: 6 },
    { title: 'Платформа CRM', amount: 890000, stage: 'qualification', priority: 'medium', probability: 25, contactIdx: 2, companyIdx: 2 },
    { title: 'BI дашборд Сбер', amount: 1700000, stage: 'proposal', priority: 'high', probability: 45, contactIdx: 1, companyIdx: 1 },
    { title: 'Интеграция API DataFlow', amount: 270000, stage: 'new', priority: 'low', probability: 10, contactIdx: 7, companyIdx: 7 },
    { title: 'Управление проектами', amount: 640000, stage: 'qualification', priority: 'medium', probability: 30, contactIdx: 9, companyIdx: 3 },
  ]
  let leadsCreated = 0
  for (const l of leadsData) {
    const { contactIdx, companyIdx, ...rest } = l
    const existing = await db.select().from(crmLeadsSchema)
      .where(eq(crmLeadsSchema.title, l.title))
      .limit(1)
    if (!existing[0]) {
      await db.insert(crmLeadsSchema).values({
        organizationId: org.id,
        contactId: contacts[contactIdx]?.id ?? null,
        companyId: companies[companyIdx].id,
        responsibleUserId: owner.id,
        currency: 'RUB',
        source: leadSources[leadsCreated % leadSources.length].name,
        ...rest,
      })
      leadsCreated++
    }
  }
  console.log(`  ✓ ${leadsCreated} leads inserted (${leadsData.length - leadsCreated} already existed)`)

  // ── 9. Product categories ─────────────────────────────────────────────────────
  const catData = [
    { name: 'Программное обеспечение', description: 'Лицензии и SaaS-решения' },
    { name: 'Оборудование', description: 'Серверы, сети, периферия' },
    { name: 'Консалтинг', description: 'Услуги по внедрению' },
    { name: 'Обучение', description: 'Тренинги и сертификация' },
  ]
  const categories: any[] = []
  for (const c of catData) {
    const cat = await findOrCreate<any>(
      productCategoriesSchema,
      eq(productCategoriesSchema.name, c.name),
      { organizationId: org.id, ...c },
    )
    categories.push(cat)
  }
  console.log(`  ✓ ${categories.length} product categories`)

  // ── 10. Products ──────────────────────────────────────────────────────────────
  const productsData = [
    { name: 'Meridian CRM Pro', sku: 'MCP-001', price: 45000, costPrice: 12000, stockQuantity: 999, unit: 'лицензия/мес', catIdx: 0, description: 'CRM-платформа для команд продаж' },
    { name: 'Meridian CRM Enterprise', sku: 'MCE-001', price: 120000, costPrice: 30000, stockQuantity: 999, unit: 'лицензия/мес', catIdx: 0, description: 'Корпоративная версия с расширенной аналитикой' },
    { name: 'Meridian BI Dashboard', sku: 'MBI-001', price: 35000, costPrice: 8000, stockQuantity: 999, unit: 'лицензия/мес', catIdx: 0, description: 'Аналитические дашборды и отчёты' },
    { name: 'Сервер Dell PowerEdge R750', sku: 'SRV-750', price: 320000, costPrice: 250000, stockQuantity: 12, unit: 'шт', catIdx: 1, description: 'Rack-сервер 2U, 2×Xeon, 256Gb RAM' },
    { name: 'Коммутатор Cisco Catalyst 9200', sku: 'SW-9200', price: 85000, costPrice: 62000, stockQuantity: 8, unit: 'шт', catIdx: 1, description: '48 портов PoE+, 4 SFP+' },
    { name: 'NAS Synology DS923+', sku: 'NAS-923', price: 55000, costPrice: 40000, stockQuantity: 5, unit: 'шт', catIdx: 1, description: 'Сетевое хранилище 4-bay' },
    { name: 'Внедрение CRM (базовый)', sku: 'IMPL-BASE', price: 150000, costPrice: 60000, stockQuantity: 999, unit: 'проект', catIdx: 2, description: 'Установка, настройка, миграция данных' },
    { name: 'Внедрение CRM (расширенный)', sku: 'IMPL-ADV', price: 380000, costPrice: 140000, stockQuantity: 999, unit: 'проект', catIdx: 2, description: 'Полное внедрение с интеграциями' },
    { name: 'Технический аудит ИТ', sku: 'AUDIT-IT', price: 95000, costPrice: 35000, stockQuantity: 999, unit: 'проект', catIdx: 2, description: 'Анализ инфраструктуры и рекомендации' },
    { name: 'Курс "CRM для менеджеров"', sku: 'TRAIN-CRM', price: 12000, costPrice: 3000, stockQuantity: 999, unit: 'чел', catIdx: 3, description: 'Онлайн-курс, 8 часов, сертификат' },
    { name: 'Тренинг "Управление продажами"', sku: 'TRAIN-SALES', price: 28000, costPrice: 8000, stockQuantity: 999, unit: 'чел', catIdx: 3, description: 'Корпоративный тренинг, 2 дня' },
    { name: 'Сертификация Meridian Partner', sku: 'CERT-PART', price: 45000, costPrice: 10000, stockQuantity: 999, unit: 'чел', catIdx: 3, description: 'Партнёрская сертификация' },
  ]
  let prodsCreated = 0
  for (const p of productsData) {
    const { catIdx, ...rest } = p
    const existing = await db.select().from(productsSchema).where(eq(productsSchema.sku, p.sku)).limit(1)
    if (!existing[0]) {
      await db.insert(productsSchema).values({
        organizationId: org.id,
        categoryId: categories[catIdx].id,
        active: true,
        ...rest,
      })
      prodsCreated++
    }
  }
  console.log(`  ✓ ${prodsCreated} products inserted`)

  // ── 11. Services ──────────────────────────────────────────────────────────────
  const servicesData = [
    { name: 'Техническая поддержка L1', description: 'Help-desk, первая линия', price: 8000, unit: 'час', isActive: true },
    { name: 'Техническая поддержка L2', description: 'Разработка и интеграции', price: 15000, unit: 'час', isActive: true },
    { name: 'Проектное управление', description: 'PM-сопровождение проекта', price: 12000, unit: 'час', isActive: true },
    { name: 'DevOps / инфраструктура', description: 'CI/CD, облако, мониторинг', price: 18000, unit: 'час', isActive: true },
    { name: 'Дизайн UX/UI', description: 'Прототипы и дизайн-система', price: 10000, unit: 'час', isActive: true },
    { name: 'Аналитика данных', description: 'BI, дашборды, SQL-отчёты', price: 14000, unit: 'час', isActive: true },
  ]
  let srvsCreated = 0
  for (const s of servicesData) {
    const existing = await db.select().from(servicesSchema).where(eq(servicesSchema.name, s.name)).limit(1)
    if (!existing[0]) {
      await db.insert(servicesSchema).values({ organizationId: org.id, ...s })
      srvsCreated++
    }
  }
  console.log(`  ✓ ${srvsCreated} services inserted`)

  console.log('\n✅ Demo seed complete!')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('Credentials:')
  console.log('  owner@meridian.demo   / demo1234  (owner)')
  console.log('  manager@meridian.demo / demo1234  (admin)')
  console.log('  employee@meridian.demo / demo1234 (member)')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  await pool.end()
}

main().catch((e) => { console.error(e); process.exit(1) })

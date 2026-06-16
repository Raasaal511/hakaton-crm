/**
 * Comprehensive demo seed.
 * Run:              npx tsx scripts/seed-demo.ts
 * Force re-seed:    npx tsx scripts/seed-demo.ts --force
 *
 * --force deletes ALL data for the "Meridian Demo" org before re-inserting.
 */

import 'dotenv/config'
import 'reflect-metadata'
import bcrypt from 'bcrypt'
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { eq, and, inArray } from 'drizzle-orm'
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
  crmDealsSchema,
  crmDealLineItemsSchema,
  crmCommunicationsSchema,
  crmActivitySchema,
  salesQuotesSchema,
  salesInvoicesSchema,
  productCategoriesSchema,
  productsSchema,
  servicesSchema,
  warehousesSchema,
  stockMovementsSchema,
  purchasesSchema,
  projectsSchema,
  projectMembersSchema,
} from '../src/infra/database/drizzle/schema.js'

// ── DB connection ─────────────────────────────────────────────────────────────
function createPool() {
  const databaseUrl = process.env.DATABASE_URL?.trim()
  if (databaseUrl) {
    return new Pool({ connectionString: databaseUrl })
  }

  return new Pool({
    host:     process.env.DB_HOST     ?? 'localhost',
    port:     Number(process.env.DB_PORT ?? 5432),
    user:     process.env.DB_USER     ?? 'postgres',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME     ?? 'postgres',
    ssl: false,
  })
}

function dbTargetLabel() {
  const databaseUrl = process.env.DATABASE_URL?.trim()
  if (!databaseUrl) {
    return `${process.env.DB_HOST ?? 'localhost'}:${process.env.DB_PORT ?? 5432}/${process.env.DB_NAME ?? 'postgres'}`
  }

  try {
    const url = new URL(databaseUrl)
    return `${url.hostname}${url.port ? `:${url.port}` : ''}${url.pathname}`
  } catch {
    return 'DATABASE_URL'
  }
}

const pool = createPool()
const db = drizzle(pool)

// ── Flags ─────────────────────────────────────────────────────────────────────
const FORCE = process.argv.includes('--force')

// ── Helpers ───────────────────────────────────────────────────────────────────
function daysAgo(n: number)    { return new Date(Date.now() - n * 86_400_000) }
function daysFromNow(n: number){ return new Date(Date.now() + n * 86_400_000) }
function pick<T>(arr: T[]): T  { return arr[Math.floor(Math.random() * arr.length)] }

/** Inserts or fetches. Returns [row, wasInserted]. */
async function upsert<T extends { id: number }>(
  table: any, condition: any, values: any,
): Promise<[T, boolean]> {
  const existing = await db.select().from(table).where(condition).limit(1)
  if (existing[0]) return [existing[0] as T, false]
  const [row] = await db.insert(table).values(values).returning() as unknown as T[]
  return [row as T, true]
}

function log(label: string, created: number, total: number) {
  if (created === total) {
    console.log(`  ✓ ${total} ${label}`)
  } else {
    console.log(`  ✓ ${total} ${label} (${created} новых, ${total - created} уже было)`)
  }
}

// ── --force cleanup ───────────────────────────────────────────────────────────
async function cleanOrg(orgId: number) {
  console.log('  Удаляем данные организации...')
  // Delete in dependency order (children first)
  await db.delete(crmActivitySchema).where(eq(crmActivitySchema.organizationId, orgId))
  await db.delete(crmCommunicationsSchema).where(eq(crmCommunicationsSchema.organizationId, orgId))
  await db.delete(salesInvoicesSchema).where(eq(salesInvoicesSchema.organizationId, orgId))
  await db.delete(salesQuotesSchema).where(eq(salesQuotesSchema.organizationId, orgId))
  await db.delete(crmDealLineItemsSchema).where(eq(crmDealLineItemsSchema.organizationId, orgId))
  await db.delete(crmDealsSchema).where(eq(crmDealsSchema.organizationId, orgId))
  await db.delete(crmLeadsSchema).where(eq(crmLeadsSchema.organizationId, orgId))
  await db.delete(stockMovementsSchema).where(eq(stockMovementsSchema.organizationId, orgId))
  await db.delete(purchasesSchema).where(eq(purchasesSchema.organizationId, orgId))
  await db.delete(warehousesSchema).where(eq(warehousesSchema.organizationId, orgId))
  await db.delete(productsSchema).where(eq(productsSchema.organizationId, orgId))
  await db.delete(servicesSchema).where(eq(servicesSchema.organizationId, orgId))
  await db.delete(productCategoriesSchema).where(eq(productCategoriesSchema.organizationId, orgId))
  await db.delete(crmContactsSchema).where(eq(crmContactsSchema.organizationId, orgId))
  await db.delete(crmCompaniesSchema).where(eq(crmCompaniesSchema.organizationId, orgId))
  await db.delete(crmLeadSourcesSchema).where(eq(crmLeadSourcesSchema.organizationId, orgId))
  await db.delete(crmDealStagesSchema).where(eq(crmDealStagesSchema.organizationId, orgId))
  await db.delete(crmSegmentsSchema).where(eq(crmSegmentsSchema.organizationId, orgId))
  console.log('  ✓ Данные очищены\n')
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(FORCE
    ? '🔄 Seed с --force: перезапись всех данных...\n'
    : '🌱 Seeding demo data (идемпотентно)...\n'
  )
  console.log(`  → DB: ${dbTargetLabel()}`)

  // ══════════════════════════════════════════════════════════════════════════
  // 1. Users
  // ══════════════════════════════════════════════════════════════════════════
  const pw = await bcrypt.hash('demo1234', 10)

  const [owner]    = await upsert<any>(usersSchema, eq(usersSchema.email, 'owner@meridian.demo'),    { email: 'owner@meridian.demo',    hashPassword: pw, firstname: 'Алексей', lastname: 'Петров',  systemRole: 'root' })
  const [manager]  = await upsert<any>(usersSchema, eq(usersSchema.email, 'manager@meridian.demo'),  { email: 'manager@meridian.demo',  hashPassword: pw, firstname: 'Мария',   lastname: 'Соколова',systemRole: 'user' })
  const [employee] = await upsert<any>(usersSchema, eq(usersSchema.email, 'employee@meridian.demo'), { email: 'employee@meridian.demo', hashPassword: pw, firstname: 'Денис',   lastname: 'Козлов',  systemRole: 'user' })
  const users = [owner, manager, employee]
  console.log('  ✓ Users: owner / manager / employee  (пароль: demo1234)')

  // ══════════════════════════════════════════════════════════════════════════
  // 2. Organization
  // ══════════════════════════════════════════════════════════════════════════
  const [org] = await upsert<any>(organizationsSchema, eq(organizationsSchema.name, 'Meridian Demo'), {
    name: 'Meridian Demo', ownerUserId: owner.id,
  })
  for (const [u, role] of [[owner,'owner'],[manager,'admin'],[employee,'member']] as [any,string][]) {
    await upsert<any>(
      usersToOrganizationsSchema,
      and(eq(usersToOrganizationsSchema.organizationId, org.id), eq(usersToOrganizationsSchema.userId, u.id)),
      { organizationId: org.id, userId: u.id, role },
    )
  }
  console.log(`  ✓ Organization: "${org.name}" (id: ${org.id})`)

  // Clean if --force
  if (FORCE) await cleanOrg(org.id)

  // ══════════════════════════════════════════════════════════════════════════
  // 3. Segments
  // ══════════════════════════════════════════════════════════════════════════
  const segDefs = [
    { name: 'VIP клиенты',       color: '#6366f1', description: 'Крупные клиенты с высоким LTV' },
    { name: 'Холодная база',      color: '#94a3b8', description: 'Первичный контакт' },
    { name: 'Горячие лиды',       color: '#ef4444', description: 'Готовы к покупке' },
    { name: 'Постоянные клиенты', color: '#10b981', description: 'Повторные покупки' },
  ]
  const segments: any[] = []
  let segNew = 0
  for (const s of segDefs) {
    const [row, created] = await upsert<any>(crmSegmentsSchema, and(eq(crmSegmentsSchema.name, s.name), eq(crmSegmentsSchema.organizationId, org.id)), { organizationId: org.id, ...s })
    segments.push(row); if (created) segNew++
  }
  log('segments', segNew, segments.length)

  // ══════════════════════════════════════════════════════════════════════════
  // 4. Companies
  // ══════════════════════════════════════════════════════════════════════════
  const companyDefs = [
    { name: 'ООО "ТехноПром"',   industry: 'Промышленность',     city: 'Москва',          employeesCount: 450,   annualRevenue: 85_000_000,  status: 'active',   website: 'https://technoprom.ru', email: 'info@technoprom.ru',   phone: '+7 495 123-45-67' },
    { name: 'Сбер Решения',       industry: 'Финансы',            city: 'Москва',          employeesCount: 12000, annualRevenue: 500_000_000, status: 'active',   website: 'https://sber.ru',       email: 'b2b@sber.ru',          phone: '+7 800 555-55-55' },
    { name: 'АО "АгроМаш"',      industry: 'Сельское хозяйство', city: 'Краснодар',       employeesCount: 280,   annualRevenue: 42_000_000,  status: 'active',   email: 'sales@agromash.ru',       phone: '+7 861 234-56-78' },
    { name: 'Ритейл Групп',       industry: 'Розничная торговля', city: 'Санкт-Петербург', employeesCount: 1200,  annualRevenue: 320_000_000, status: 'active',   email: 'crm@retailgroup.ru',      phone: '+7 812 765-43-21' },
    { name: 'МедТех Инновации',   industry: 'Здравоохранение',    city: 'Новосибирск',     employeesCount: 95,    annualRevenue: 18_000_000,  status: 'prospect', email: 'contact@medtech.ru',      phone: '+7 383 111-22-33' },
    { name: 'СтройКомплекс',      industry: 'Строительство',      city: 'Екатеринбург',    employeesCount: 650,   annualRevenue: 120_000_000, status: 'active',   email: 'zakaz@stroykomplex.ru',   phone: '+7 343 444-55-66' },
    { name: 'ЛогистикПро',        industry: 'Логистика',          city: 'Казань',          employeesCount: 380,   annualRevenue: 67_000_000,  status: 'inactive', email: 'info@logistikpro.ru',     phone: '+7 843 777-88-99' },
    { name: 'DataFlow Analytics', industry: 'IT и технологии',    city: 'Москва',          employeesCount: 72,    annualRevenue: 25_000_000,  status: 'active',   website: 'https://dataflow.io',   email: 'hello@dataflow.io',    phone: '+7 495 000-11-22' },
  ]
  const companies: any[] = []
  let coNew = 0
  for (const c of companyDefs) {
    const [row, created] = await upsert<any>(crmCompaniesSchema, and(eq(crmCompaniesSchema.name, c.name), eq(crmCompaniesSchema.organizationId, org.id)), { organizationId: org.id, ownerUserId: manager.id, segmentId: segments[0].id, ...c })
    companies.push(row); if (created) coNew++
  }
  log('companies', coNew, companies.length)

  // ══════════════════════════════════════════════════════════════════════════
  // 5. Contacts
  // ══════════════════════════════════════════════════════════════════════════
  const contactDefs = [
    { firstName: 'Иван',    lastName: 'Морозов',   email: 'i.morozov@technoprom.ru',   phone: '+7 916 100-00-01', position: 'Генеральный директор',  status: 'active',   source: 'Рекомендации',   coIdx: 0 },
    { firstName: 'Светлана',lastName: 'Новикова',  email: 's.novikova@sber.ru',         phone: '+7 926 200-00-02', position: 'Директор по закупкам',   status: 'active',   source: 'Холодный звонок',coIdx: 1 },
    { firstName: 'Андрей',  lastName: 'Волков',    email: 'a.volkov@agromash.ru',       phone: '+7 936 300-00-03', position: 'Коммерческий директор',  status: 'active',   source: 'Выставка',       coIdx: 2 },
    { firstName: 'Елена',   lastName: 'Смирнова',  email: 'e.smirnova@retailgroup.ru',  phone: '+7 906 400-00-04', position: 'Руководитель IT',        status: 'active',   source: 'Рекомендации',   coIdx: 3 },
    { firstName: 'Дмитрий', lastName: 'Козлов',    email: 'd.kozlov@medtech.ru',        phone: '+7 967 500-00-05', position: 'CTO',                    status: 'prospect', source: 'Сайт',           coIdx: 4 },
    { firstName: 'Ольга',   lastName: 'Лебедева',  email: 'o.lebedeva@stroykomplex.ru', phone: '+7 977 600-00-06', position: 'Финансовый директор',    status: 'active',   source: 'Реклама',        coIdx: 5 },
    { firstName: 'Сергей',  lastName: 'Попов',     email: 's.popov@logistikpro.ru',     phone: '+7 987 700-00-07', position: 'Операционный директор',  status: 'inactive', source: 'Холодный звонок',coIdx: 6 },
    { firstName: 'Наталья', lastName: 'Соколова',  email: 'n.sokolova@dataflow.io',     phone: '+7 997 800-00-08', position: 'CEO',                    status: 'active',   source: 'Рекомендации',   coIdx: 7 },
    { firstName: 'Михаил',  lastName: 'Захаров',   email: 'm.zakharov@technoprom.ru',   phone: '+7 915 900-00-09', position: 'Менеджер по закупкам',   status: 'active',   source: 'Рекомендации',   coIdx: 0 },
    { firstName: 'Татьяна', lastName: 'Орлова',    email: 't.orlova@sber.ru',           phone: '+7 925 111-00-10', position: 'Директор по развитию',  status: 'active',   source: 'Партнёры',       coIdx: 1 },
    { firstName: 'Павел',   lastName: 'Зайцев',    email: 'p.zaitsev@retailgroup.ru',   phone: '+7 935 222-00-11', position: 'Технический директор',  status: 'prospect', source: 'Сайт',           coIdx: 3 },
    { firstName: 'Алина',   lastName: 'Кузнецова', email: 'a.kuznetsova@medtech.ru',    phone: '+7 905 333-00-12', position: 'Директор по продажам',  status: 'prospect', source: 'Конференция',    coIdx: 4 },
    { firstName: 'Роман',   lastName: 'Белов',     email: 'r.belov@dataflow.io',        phone: '+7 966 444-00-13', position: 'Product Manager',       status: 'active',   source: 'Рекомендации',   coIdx: 7 },
    { firstName: 'Юлия',    lastName: 'Васильева', email: 'yu.vasilyeva@agromash.ru',   phone: '+7 976 555-00-14', position: 'Начальник отдела ИТ',   status: 'active',   source: 'Выставка',       coIdx: 2 },
    { firstName: 'Николай', lastName: 'Степанов',  email: 'n.stepanov@stroykomplex.ru', phone: '+7 986 666-00-15', position: 'Руководитель проектов', status: 'active',   source: 'Реклама',        coIdx: 5 },
  ]
  const contacts: any[] = []
  let ctNew = 0
  for (const c of contactDefs) {
    const { coIdx, ...rest } = c
    const [row, created] = await upsert<any>(crmContactsSchema, and(eq(crmContactsSchema.email, c.email), eq(crmContactsSchema.organizationId, org.id)), {
      organizationId: org.id, companyId: companies[coIdx].id,
      ownerUserId: owner.id, segmentId: segments[coIdx % segments.length].id, ...rest,
    })
    contacts.push(row); if (created) ctNew++
  }
  log('contacts', ctNew, contacts.length)

  // ══════════════════════════════════════════════════════════════════════════
  // 6. Lead sources & deal stages
  // ══════════════════════════════════════════════════════════════════════════
  const leadSources: any[] = []
  let lsNew = 0
  for (const name of ['Рекомендации','Холодный звонок','Сайт / входящий','Выставка','Реклама','Партнёры']) {
    const [row, created] = await upsert<any>(crmLeadSourcesSchema, and(eq(crmLeadSourcesSchema.name, name), eq(crmLeadSourcesSchema.organizationId, org.id)), { organizationId: org.id, name })
    leadSources.push(row); if (created) lsNew++
  }

  const stageDefs = [
    { name: 'Новый',       code: 'new',          color: '#94a3b8', probability: 10,  position: 1, isWon: false, isLost: false },
    { name: 'Квалификация',code: 'qualification', color: '#6366f1', probability: 30,  position: 2, isWon: false, isLost: false },
    { name: 'Предложение', code: 'proposal',      color: '#f59e0b', probability: 55,  position: 3, isWon: false, isLost: false },
    { name: 'Переговоры',  code: 'negotiation',   color: '#0ea5e9', probability: 75,  position: 4, isWon: false, isLost: false },
    { name: 'Выиграно',    code: 'won',           color: '#10b981', probability: 100, position: 5, isWon: true,  isLost: false },
    { name: 'Проиграно',   code: 'lost',          color: '#ef4444', probability: 0,   position: 6, isWon: false, isLost: true  },
  ]
  const dealStages: any[] = []
  let dsNew = 0
  for (const s of stageDefs) {
    const [row, created] = await upsert<any>(crmDealStagesSchema, and(eq(crmDealStagesSchema.name, s.name), eq(crmDealStagesSchema.organizationId, org.id)), { organizationId: org.id, ...s })
    dealStages.push(row); if (created) dsNew++
  }
  log('lead sources', lsNew, leadSources.length)
  log('deal stages',  dsNew, dealStages.length)

  // ══════════════════════════════════════════════════════════════════════════
  // 7. Leads (20)
  // ══════════════════════════════════════════════════════════════════════════
  const leadDefs = [
    { title: 'Автоматизация склада',           amount: 1_850_000, stage: 'negotiation',  priority: 'high',   probability: 75,  cIdx: 0,  coIdx: 0 },
    { title: 'CRM внедрение Сбер',             amount: 3_200_000, stage: 'proposal',     priority: 'high',   probability: 55,  cIdx: 1,  coIdx: 1 },
    { title: 'ERP интеграция АгроМаш',         amount:   980_000, stage: 'qualification',priority: 'medium', probability: 30,  cIdx: 2,  coIdx: 2 },
    { title: 'Цифровизация ритейла',           amount: 2_400_000, stage: 'proposal',     priority: 'high',   probability: 60,  cIdx: 3,  coIdx: 3 },
    { title: 'МИС для клиники',                amount:   650_000, stage: 'new',          priority: 'medium', probability: 15,  cIdx: 4,  coIdx: 4 },
    { title: 'BIM система строительство',      amount: 1_200_000, stage: 'negotiation',  priority: 'high',   probability: 70,  cIdx: 5,  coIdx: 5 },
    { title: 'WMS для склада',                 amount:   870_000, stage: 'qualification',priority: 'medium', probability: 35,  cIdx: 6,  coIdx: 6 },
    { title: 'BI аналитика DataFlow',          amount:   450_000, stage: 'proposal',     priority: 'low',    probability: 50,  cIdx: 7,  coIdx: 7 },
    { title: 'Модернизация ТехноПром',         amount: 2_100_000, stage: 'won',          priority: 'high',   probability: 100, cIdx: 8,  coIdx: 0 },
    { title: 'Расширение Ритейл Групп',        amount: 1_560_000, stage: 'negotiation',  priority: 'high',   probability: 65,  cIdx: 9,  coIdx: 3 },
    { title: 'ИТ консалтинг МедТех',           amount:   320_000, stage: 'new',          priority: 'low',    probability: 20,  cIdx: 11, coIdx: 4 },
    { title: 'Аналитика данных Ритейл',        amount:   780_000, stage: 'qualification',priority: 'medium', probability: 40,  cIdx: 10, coIdx: 3 },
    { title: 'Облачная миграция DataFlow',     amount: 1_100_000, stage: 'proposal',     priority: 'high',   probability: 55,  cIdx: 12, coIdx: 7 },
    { title: 'Автоматизация АгроМаш 2.0',     amount:   560_000, stage: 'negotiation',  priority: 'medium', probability: 70,  cIdx: 13, coIdx: 2 },
    { title: 'Система контроля СтройКомплекс',amount: 2_300_000, stage: 'won',          priority: 'high',   probability: 100, cIdx: 14, coIdx: 5 },
    { title: 'Логистика ТОП',                  amount:   430_000, stage: 'lost',         priority: 'low',    probability: 0,   cIdx: 6,  coIdx: 6 },
    { title: 'Платформа CRM',                  amount:   890_000, stage: 'qualification',priority: 'medium', probability: 25,  cIdx: 2,  coIdx: 2 },
    { title: 'BI дашборд Сбер',                amount: 1_700_000, stage: 'proposal',     priority: 'high',   probability: 45,  cIdx: 1,  coIdx: 1 },
    { title: 'Интеграция API DataFlow',        amount:   270_000, stage: 'new',          priority: 'low',    probability: 10,  cIdx: 7,  coIdx: 7 },
    { title: 'Управление проектами',           amount:   640_000, stage: 'qualification',priority: 'medium', probability: 30,  cIdx: 9,  coIdx: 3 },
  ]
  const leads: any[] = []
  let ldNew = 0
  for (const l of leadDefs) {
    const { cIdx, coIdx, ...rest } = l
    const safeCI = cIdx < contacts.length ? cIdx : 0
    const [row, created] = await upsert<any>(
      crmLeadsSchema,
      and(eq(crmLeadsSchema.title, l.title), eq(crmLeadsSchema.organizationId, org.id)),
      { organizationId: org.id, contactId: contacts[safeCI]?.id ?? null, companyId: companies[coIdx].id, responsibleUserId: pick(users).id, currency: 'RUB', source: pick(leadSources).name, ...rest },
    )
    leads.push(row); if (created) ldNew++
  }
  log('leads', ldNew, leads.length)

  // ══════════════════════════════════════════════════════════════════════════
  // 8. Product categories + products + services
  // ══════════════════════════════════════════════════════════════════════════
  const categories: any[] = []
  let catNew = 0
  for (const c of [
    { name: 'Программное обеспечение', description: 'Лицензии и SaaS-решения' },
    { name: 'Оборудование',            description: 'Серверы, сети, периферия' },
    { name: 'Консалтинг',              description: 'Услуги по внедрению' },
    { name: 'Обучение',                description: 'Тренинги и сертификация' },
  ]) {
    const [row, created] = await upsert<any>(productCategoriesSchema, and(eq(productCategoriesSchema.name, c.name), eq(productCategoriesSchema.organizationId, org.id)), { organizationId: org.id, ...c })
    categories.push(row); if (created) catNew++
  }

  const productDefs = [
    { name: 'Meridian CRM Pro',              sku: 'MCP-001',    price: 45_000,  costPrice: 12_000, stockQuantity: 999, unit: 'лиц/мес', catIdx: 0 },
    { name: 'Meridian CRM Enterprise',       sku: 'MCE-001',    price: 120_000, costPrice: 30_000, stockQuantity: 999, unit: 'лиц/мес', catIdx: 0 },
    { name: 'Meridian BI Dashboard',         sku: 'MBI-001',    price: 35_000,  costPrice: 8_000,  stockQuantity: 999, unit: 'лиц/мес', catIdx: 0 },
    { name: 'Сервер Dell PowerEdge R750',    sku: 'SRV-750',    price: 320_000, costPrice: 250_000,stockQuantity: 12,  unit: 'шт',      catIdx: 1 },
    { name: 'Коммутатор Cisco Catalyst 9200',sku: 'SW-9200',    price: 85_000,  costPrice: 62_000, stockQuantity: 8,  unit: 'шт',      catIdx: 1 },
    { name: 'NAS Synology DS923+',           sku: 'NAS-923',    price: 55_000,  costPrice: 40_000, stockQuantity: 5,  unit: 'шт',      catIdx: 1 },
    { name: 'Внедрение CRM (базовый)',       sku: 'IMPL-BASE',  price: 150_000, costPrice: 60_000, stockQuantity: 999,unit: 'проект',  catIdx: 2 },
    { name: 'Внедрение CRM (расширенный)',   sku: 'IMPL-ADV',   price: 380_000, costPrice: 140_000,stockQuantity: 999,unit: 'проект',  catIdx: 2 },
    { name: 'Технический аудит ИТ',         sku: 'AUDIT-IT',   price: 95_000,  costPrice: 35_000, stockQuantity: 999,unit: 'проект',  catIdx: 2 },
    { name: 'Курс "CRM для менеджеров"',    sku: 'TRAIN-CRM',  price: 12_000,  costPrice: 3_000,  stockQuantity: 999,unit: 'чел',     catIdx: 3 },
    { name: 'Тренинг "Управление продажами"',sku: 'TRAIN-SALES',price: 28_000,  costPrice: 8_000,  stockQuantity: 999,unit: 'чел',     catIdx: 3 },
    { name: 'Сертификация Meridian Partner', sku: 'CERT-PART',  price: 45_000,  costPrice: 10_000, stockQuantity: 999,unit: 'чел',     catIdx: 3 },
  ]
  const products: any[] = []
  let pdNew = 0
  for (const p of productDefs) {
    const { catIdx, ...rest } = p
    const [row, created] = await upsert<any>(productsSchema, and(eq(productsSchema.sku, p.sku), eq(productsSchema.organizationId, org.id)), { organizationId: org.id, categoryId: categories[catIdx].id, active: true, ...rest })
    products.push(row); if (created) pdNew++
  }

  const services: any[] = []
  let svcNew = 0
  for (const s of [
    { name: 'Техническая поддержка L1', description: 'Help-desk, первая линия',    price: 8_000,  unit: 'час', isActive: true },
    { name: 'Техническая поддержка L2', description: 'Разработка и интеграции',    price: 15_000, unit: 'час', isActive: true },
    { name: 'Проектное управление',      description: 'PM-сопровождение проекта',  price: 12_000, unit: 'час', isActive: true },
    { name: 'DevOps / инфраструктура',  description: 'CI/CD, облако, мониторинг', price: 18_000, unit: 'час', isActive: true },
    { name: 'Дизайн UX/UI',             description: 'Прототипы и дизайн-система',price: 10_000, unit: 'час', isActive: true },
    { name: 'Аналитика данных',          description: 'BI, дашборды, SQL-отчёты', price: 14_000, unit: 'час', isActive: true },
  ]) {
    const [row, created] = await upsert<any>(servicesSchema, and(eq(servicesSchema.name, s.name), eq(servicesSchema.organizationId, org.id)), { organizationId: org.id, ...s })
    services.push(row); if (created) svcNew++
  }
  log('categories', catNew, categories.length)
  log('products',   pdNew, products.length)
  log('services',   svcNew, services.length)

  // ══════════════════════════════════════════════════════════════════════════
  // 9. Deals (12)
  // ══════════════════════════════════════════════════════════════════════════
  const dealDefs = [
    { ldIdx: 8,  title: 'Контракт ТехноПром — CRM Pro (12 мес)',   amount: 2_100_000, status: 'won',  probability: 100, stIdx: 4, notes: 'Подписан договор, предоплата получена' },
    { ldIdx: 14, title: 'Контракт СтройКомплекс — BIM + аудит',   amount: 2_300_000, status: 'won',  probability: 100, stIdx: 4, notes: 'Акт выполненных работ подписан' },
    { ldIdx: 0,  title: 'Сделка: Автоматизация склада ТехноПром', amount: 1_850_000, status: 'open', probability: 75,  stIdx: 3, notes: 'Финальные переговоры по условиям' },
    { ldIdx: 1,  title: 'Сделка: CRM Enterprise для Сбера',       amount: 3_200_000, status: 'open', probability: 55,  stIdx: 2, notes: 'Ожидаем решения тендерного комитета' },
    { ldIdx: 5,  title: 'Сделка: BIM СтройКомплекс 2.0',         amount: 1_200_000, status: 'open', probability: 70,  stIdx: 3, notes: 'Согласован объём работ' },
    { ldIdx: 9,  title: 'Расширение контракта Ритейл Групп',      amount: 1_560_000, status: 'open', probability: 65,  stIdx: 3, notes: 'Доп. модули к существующей системе' },
    { ldIdx: 3,  title: 'Цифровизация Ритейл — фаза 1',          amount:   800_000, status: 'open', probability: 60,  stIdx: 2, notes: 'MVP утверждён, старт в след. квартале' },
    { ldIdx: 12, title: 'Облачная миграция DataFlow',             amount: 1_100_000, status: 'open', probability: 55,  stIdx: 2, notes: 'Архитектура согласована' },
    { ldIdx: 17, title: 'BI Дашборд Сбер — пилот',               amount:   420_000, status: 'open', probability: 45,  stIdx: 2, notes: 'Пилот на 2 подразделения' },
    { ldIdx: 7,  title: 'BI аналитика DataFlow — лицензия',      amount:   450_000, status: 'open', probability: 50,  stIdx: 2, notes: 'Пробный период 30 дней' },
    { ldIdx: 2,  title: 'ERP интеграция АгроМаш',                amount:   980_000, status: 'open', probability: 30,  stIdx: 1, notes: 'RFP подготовлен, ждём ответа' },
    { ldIdx: 15, title: 'Логистика ТОП — закрыто',               amount:   430_000, status: 'lost', probability: 0,   stIdx: 5, notes: 'Клиент выбрал конкурента' },
  ]
  const deals: any[] = []
  let dlNew = 0
  for (const d of dealDefs) {
    const { ldIdx, stIdx, ...rest } = d
    const lead = leads[ldIdx]
    const [row, created] = await upsert<any>(
      crmDealsSchema,
      and(eq(crmDealsSchema.title, d.title), eq(crmDealsSchema.organizationId, org.id)),
      {
        organizationId: org.id, leadId: lead?.id ?? null,
        contactId: lead?.contactId ?? null, companyId: lead?.companyId ?? null,
        stageId: dealStages[stIdx]?.id ?? null,
        ownerUserId: pick(users).id, currency: 'RUB',
        expectedCloseDate: daysFromNow(Math.floor(Math.random() * 90) + 10),
        closedAt: (rest.status === 'won' || rest.status === 'lost') ? daysAgo(Math.floor(Math.random() * 30) + 1) : null,
        ...rest,
      },
    )
    deals.push(row); if (created) dlNew++
  }
  log('deals', dlNew, deals.length)

  // ══════════════════════════════════════════════════════════════════════════
  // 10. Deal line items
  // ══════════════════════════════════════════════════════════════════════════
  const lineItemDefs = [
    { dIdx: 0, pIdx: 0,  qty: 12, title: 'Meridian CRM Pro — 12 мес' },
    { dIdx: 0, pIdx: 6,  qty: 1,  title: 'Внедрение CRM (расширенный)' },
    { dIdx: 1, pIdx: 1,  qty: 36, title: 'Meridian CRM Enterprise — 3 года' },
    { dIdx: 1, pIdx: 7,  qty: 1,  title: 'Внедрение CRM (базовый)' },
    { dIdx: 2, pIdx: 2,  qty: 12, title: 'Meridian BI Dashboard — 12 мес' },
    { dIdx: 3, pIdx: 1,  qty: 24, title: 'Meridian CRM Enterprise — 2 года' },
    { dIdx: 4, pIdx: 7,  qty: 1,  title: 'Внедрение CRM (расширенный) — СтройКомплекс' },
    { dIdx: 4, pIdx: 8,  qty: 1,  title: 'Технический аудит ИТ' },
    { dIdx: 5, pIdx: 0,  qty: 12, title: 'Meridian CRM Pro — Ритейл' },
    { dIdx: 6, pIdx: 2,  qty: 6,  title: 'Meridian BI Dashboard — 6 мес' },
    { dIdx: 7, pIdx: 3,  qty: 2,  title: 'Сервер Dell PowerEdge R750 × 2' },
    { dIdx: 8, pIdx: 2,  qty: 12, title: 'Meridian BI Dashboard — Сбер' },
    { dIdx: 9, pIdx: 9,  qty: 20, title: 'Курс CRM для менеджеров × 20 чел' },
  ]
  let liCreated = 0, liTotal = 0
  for (const li of lineItemDefs) {
    if (!deals[li.dIdx] || !products[li.pIdx]) continue
    liTotal++
    const prod = products[li.pIdx]
    const [, created] = await upsert<any>(
      crmDealLineItemsSchema,
      and(eq(crmDealLineItemsSchema.dealId, deals[li.dIdx].id), eq(crmDealLineItemsSchema.title, li.title)),
      { organizationId: org.id, dealId: deals[li.dIdx].id, productId: prod.id, itemType: 'product', title: li.title, quantity: li.qty, unitPrice: prod.price, costPrice: prod.costPrice ?? 0, currency: 'RUB' },
    )
    if (created) liCreated++
  }
  log('deal line items', liCreated, liTotal)

  // ══════════════════════════════════════════════════════════════════════════
  // 11. Warehouses + Stock movements + Purchases
  // ══════════════════════════════════════════════════════════════════════════
  const [wh1, wh1Created] = await upsert<any>(warehousesSchema,
    and(eq(warehousesSchema.name, 'Главный склад'), eq(warehousesSchema.organizationId, org.id)),
    { organizationId: org.id, name: 'Главный склад', code: 'WH-MAIN', address: 'г. Москва, ул. Складская, 1', responsibleUserId: manager.id, active: true })
  const [wh2, wh2Created] = await upsert<any>(warehousesSchema,
    and(eq(warehousesSchema.name, 'Региональный склад СПб'), eq(warehousesSchema.organizationId, org.id)),
    { organizationId: org.id, name: 'Региональный склад СПб', code: 'WH-SPB', address: 'г. Санкт-Петербург, Промышленный пр., 15', responsibleUserId: employee.id, active: true })
  log('warehouses', (wh1Created ? 1 : 0) + (wh2Created ? 1 : 0), 2)

  const hwProducts = products.filter((_, i) => i >= 3 && i <= 5)
  let mvCreated = 0, mvTotal = 0
  for (const prod of hwProducts) {
    mvTotal += 2
    const [, c1] = await upsert<any>(stockMovementsSchema,
      and(eq(stockMovementsSchema.productId, prod.id), eq(stockMovementsSchema.type, 'in'), eq(stockMovementsSchema.organizationId, org.id)),
      { organizationId: org.id, productId: prod.id, warehouseId: wh1.id, type: 'in', quantity: prod.stockQuantity, unitCost: prod.costPrice ?? 0, reason: 'Начальный остаток на складе', actorUserId: manager.id })
    if (c1) mvCreated++
    const [, c2] = await upsert<any>(stockMovementsSchema,
      and(eq(stockMovementsSchema.productId, prod.id), eq(stockMovementsSchema.type, 'out'), eq(stockMovementsSchema.organizationId, org.id)),
      { organizationId: org.id, productId: prod.id, warehouseId: wh1.id, type: 'out', quantity: Math.floor(prod.stockQuantity * 0.3), unitCost: prod.costPrice ?? 0, reason: 'Отгрузка по договору', actorUserId: manager.id })
    if (c2) mvCreated++
  }
  log('stock movements', mvCreated, mvTotal)

  let pcCreated = 0
  for (const prod of hwProducts) {
    const [, created] = await upsert<any>(purchasesSchema,
      and(eq(purchasesSchema.productId, prod.id), eq(purchasesSchema.organizationId, org.id)),
      { organizationId: org.id, productId: prod.id, warehouseId: wh1.id, quantity: 10, unitCost: prod.costPrice ?? 0, status: 'received', receivedAt: daysAgo(20), expectedAt: daysAgo(25), createdByUserId: manager.id })
    if (created) pcCreated++
  }
  log('purchases', pcCreated, hwProducts.length)

  // ══════════════════════════════════════════════════════════════════════════
  // 12. Sales Quotes (6)
  // ══════════════════════════════════════════════════════════════════════════
  const quoteDefs = [
    { num: 'КП-2026-001', dIdx: 3, coIdx: 1, sub: 3_200_000, disc: 160_000, status: 'sent',     validDays: 30 },
    { num: 'КП-2026-002', dIdx: 2, coIdx: 0, sub: 1_850_000, disc: 0,       status: 'accepted', validDays: 45 },
    { num: 'КП-2026-003', dIdx: 4, coIdx: 5, sub: 1_200_000, disc: 60_000,  status: 'draft',    validDays: 14 },
    { num: 'КП-2026-004', dIdx: 5, coIdx: 3, sub: 1_560_000, disc: 78_000,  status: 'sent',     validDays: 21 },
    { num: 'КП-2026-005', dIdx: 7, coIdx: 7, sub: 1_100_000, disc: 55_000,  status: 'draft',    validDays: 7  },
    { num: 'КП-2026-006', dIdx: 11,coIdx: 6, sub:   430_000, disc: 0,       status: 'rejected', validDays: 30 },
  ]
  let qtCreated = 0
  for (const q of quoteDefs) {
    const [, created] = await upsert<any>(salesQuotesSchema,
      and(eq(salesQuotesSchema.number, q.num), eq(salesQuotesSchema.organizationId, org.id)),
      { organizationId: org.id, number: q.num, dealId: deals[q.dIdx]?.id ?? null, companyId: companies[q.coIdx]?.id ?? null, subtotal: q.sub, discount: q.disc, total: q.sub - q.disc, currency: 'RUB', status: q.status, validUntil: daysFromNow(q.validDays), createdByUserId: manager.id })
    if (created) qtCreated++
  }
  log('sales quotes', qtCreated, quoteDefs.length)

  // ══════════════════════════════════════════════════════════════════════════
  // 13. Sales Invoices (8)
  // ══════════════════════════════════════════════════════════════════════════
  const invoiceDefs = [
    { num: 'ИНВ-2026-001', dIdx: 0,  coIdx: 0, total: 2_100_000, paid: 2_100_000, status: 'paid',      issuedAgo: 45, dueAgo: 15 },
    { num: 'ИНВ-2026-002', dIdx: 1,  coIdx: 5, total: 2_300_000, paid: 2_300_000, status: 'paid',      issuedAgo: 30, dueAgo: 0  },
    { num: 'ИНВ-2026-003', dIdx: 2,  coIdx: 0, total: 1_850_000, paid: 925_000,   status: 'sent',      issuedAgo: 14, dueDays: 16 },
    { num: 'ИНВ-2026-004', dIdx: 3,  coIdx: 1, total: 3_040_000, paid: 0,         status: 'sent',      issuedAgo: 7,  dueDays: 23 },
    { num: 'ИНВ-2026-005', dIdx: 4,  coIdx: 5, total: 1_140_000, paid: 0,         status: 'overdue',   issuedAgo: 40, dueAgo: 10 },
    { num: 'ИНВ-2026-006', dIdx: 5,  coIdx: 3, total: 1_482_000, paid: 500_000,   status: 'sent',      issuedAgo: 5,  dueDays: 25 },
    { num: 'ИНВ-2026-007', dIdx: 7,  coIdx: 7, total: 1_045_000, paid: 0,         status: 'draft',     issuedAgo: 2,  dueDays: 28 },
    { num: 'ИНВ-2026-008', dIdx: 11, coIdx: 6, total:   430_000, paid: 0,         status: 'cancelled', issuedAgo: 60, dueAgo: 30 },
  ]
  let invCreated = 0
  for (const inv of invoiceDefs) {
    const dueDate = 'dueAgo' in inv ? daysAgo(inv.dueAgo as number) : daysFromNow((inv as any).dueDays as number)
    const [, created] = await upsert<any>(salesInvoicesSchema,
      and(eq(salesInvoicesSchema.number, inv.num), eq(salesInvoicesSchema.organizationId, org.id)),
      { organizationId: org.id, number: inv.num, dealId: deals[inv.dIdx]?.id ?? null, total: inv.total, paidAmount: inv.paid, currency: 'RUB', status: inv.status, issuedAt: daysAgo(inv.issuedAgo), dueAt: dueDate, paidAt: inv.status === 'paid' ? daysAgo(Math.max(0, inv.issuedAgo - 5)) : null, createdByUserId: manager.id })
    if (created) invCreated++
  }
  log('sales invoices', invCreated, invoiceDefs.length)

  // ══════════════════════════════════════════════════════════════════════════
  // 14. CRM Communications (25)
  // ══════════════════════════════════════════════════════════════════════════
  const commDefs = [
    { etype: 'contact', eIdx: 0,  channel: 'phone', dir: 'outbound', subj: 'Обсуждение коммерческого предложения', body: 'Договорились о встрече на следующей неделе', status: 'completed', ago: 2 },
    { etype: 'contact', eIdx: 1,  channel: 'email', dir: 'outbound', subj: 'КП на CRM Enterprise', body: 'Отправили детализированное КП с ценами', status: 'sent', ago: 3 },
    { etype: 'lead',    eIdx: 0,  channel: 'phone', dir: 'inbound',  subj: 'Входящий звонок по складу', body: 'Клиент уточнил сроки внедрения', status: 'completed', ago: 1 },
    { etype: 'contact', eIdx: 2,  channel: 'email', dir: 'outbound', subj: 'Материалы по ERP', body: 'Прислали презентацию и кейсы', status: 'sent', ago: 5 },
    { etype: 'lead',    eIdx: 5,  channel: 'phone', dir: 'outbound', subj: 'Согласование договора BIM', body: 'Юристы проверяют договор', status: 'completed', ago: 1 },
    { etype: 'contact', eIdx: 3,  channel: 'email', dir: 'outbound', subj: 'Демо-доступ к системе', body: 'Предоставлен тестовый стенд на 14 дней', status: 'sent', ago: 4 },
    { etype: 'contact', eIdx: 4,  channel: 'phone', dir: 'inbound',  subj: 'Вопрос по МИС', body: 'Клиент интересуется интеграцией с лабораторией', status: 'completed', ago: 7 },
    { etype: 'lead',    eIdx: 9,  channel: 'email', dir: 'outbound', subj: 'Презентация нового модуля', body: 'Предложили расширение функционала', status: 'sent', ago: 2 },
    { etype: 'contact', eIdx: 7,  channel: 'phone', dir: 'outbound', subj: 'Финальные условия DataFlow', body: 'Договорились о скидке 5%', status: 'completed', ago: 0 },
    { etype: 'lead',    eIdx: 1,  channel: 'phone', dir: 'outbound', subj: 'Статус тендера Сбер', body: 'Ожидаем решения в течение 2 недель', status: 'completed', ago: 3 },
    { etype: 'contact', eIdx: 5,  channel: 'email', dir: 'outbound', subj: 'Акт выполненных работ', body: 'Направлен акт на подпись', status: 'sent', ago: 6 },
    { etype: 'lead',    eIdx: 3,  channel: 'phone', dir: 'inbound',  subj: 'Уточнение по функционалу Ритейл', body: 'Ритейл запросил дополнительные модули', status: 'completed', ago: 1 },
    { etype: 'contact', eIdx: 8,  channel: 'email', dir: 'outbound', subj: 'Апселл — Enterprise', body: 'Предложили апгрейд лицензии', status: 'sent', ago: 8 },
    { etype: 'contact', eIdx: 9,  channel: 'phone', dir: 'outbound', subj: 'Кросс-продажа BI Сбер', body: 'Рассказали про дашборды', status: 'completed', ago: 5 },
    { etype: 'lead',    eIdx: 12, channel: 'email', dir: 'outbound', subj: 'Архитектура облачной миграции', body: 'Прислали техническое задание', status: 'sent', ago: 4 },
    { etype: 'contact', eIdx: 10, channel: 'phone', dir: 'inbound',  subj: 'Техническая консультация Ритейл', body: 'Разобрали вопросы по API', status: 'completed', ago: 2 },
    { etype: 'lead',    eIdx: 17, channel: 'email', dir: 'outbound', subj: 'Пилот BI Сбер — условия', body: 'Согласовали scope пилотного проекта', status: 'sent', ago: 9 },
    { etype: 'contact', eIdx: 12, channel: 'phone', dir: 'outbound', subj: 'Встреча DataFlow Product', body: 'Назначена демонстрация продукта', status: 'completed', ago: 1 },
    { etype: 'contact', eIdx: 13, channel: 'email', dir: 'outbound', subj: 'Коммерческое предложение АгроМаш', body: 'КП согласовано с руководством', status: 'sent', ago: 3 },
    { etype: 'lead',    eIdx: 7,  channel: 'phone', dir: 'outbound', subj: 'Переговоры DataFlow BI', body: 'Обсудили ROI и сроки окупаемости', status: 'completed', ago: 2 },
    { etype: 'contact', eIdx: 0,  channel: 'email', dir: 'outbound', subj: 'Счёт на оплату ИНВ-2026-003', body: 'Выставлен счёт на частичную оплату', status: 'sent', ago: 14 },
    { etype: 'contact', eIdx: 1,  channel: 'phone', dir: 'outbound', subj: 'Follow-up после КП Сбер', body: 'Клиент на рассмотрении, вернётся через неделю', status: 'completed', ago: 7 },
    { etype: 'contact', eIdx: 5,  channel: 'phone', dir: 'inbound',  subj: 'Вопрос по оплате счёта', body: 'Клиент уточнил реквизиты для платежа', status: 'completed', ago: 1 },
    { etype: 'lead',    eIdx: 4,  channel: 'email', dir: 'outbound', subj: 'Презентация МИС МедТех', body: 'Прислали видеозапись демонстрации', status: 'sent', ago: 6 },
    { etype: 'contact', eIdx: 14, channel: 'phone', dir: 'outbound', subj: 'Обсуждение этапов проекта СтройКомплекс', body: 'Расписали дорожную карту внедрения', status: 'completed', ago: 0 },
  ]
  let commCreated = 0
  for (const c of commDefs) {
    const entityId = c.etype === 'contact' ? contacts[c.eIdx]?.id : leads[c.eIdx]?.id
    if (!entityId) continue
    const [comm, created] = await upsert<any>(crmCommunicationsSchema,
      and(eq(crmCommunicationsSchema.subject, c.subj), eq(crmCommunicationsSchema.organizationId, org.id)),
      { organizationId: org.id, entityType: c.etype, entityId, channel: c.channel, direction: c.dir, subject: c.subj, body: c.body, status: c.status, actorUserId: pick(users).id, createdAt: daysAgo(c.ago) })
    if (created) {
      commCreated++
      await db.insert(crmActivitySchema).values({
        organizationId: org.id, entityType: c.etype, entityId,
        actorUserId: comm.actorUserId, kind: 'communication_created',
        payload: { communicationId: comm.id, channel: c.channel, subject: c.subj },
        createdAt: daysAgo(c.ago),
      }).catch(() => undefined)
    }
  }

  // Stage change activity entries
  const stageActs = [
    { ldIdx: 8,  kind: 'stage_changed', payload: { from: 'negotiation', to: 'won',  title: 'Модернизация ТехноПром' }, ago: 5 },
    { ldIdx: 14, kind: 'stage_changed', payload: { from: 'negotiation', to: 'won',  title: 'Система контроля СтройКомплекс' }, ago: 10 },
    { ldIdx: 15, kind: 'stage_changed', payload: { from: 'proposal',    to: 'lost', title: 'Логистика ТОП' }, ago: 15 },
    { ldIdx: 1,  kind: 'lead_created',  payload: { title: 'CRM внедрение Сбер', amount: 3_200_000 }, ago: 25 },
    { ldIdx: 3,  kind: 'lead_created',  payload: { title: 'Цифровизация ритейла', amount: 2_400_000 }, ago: 20 },
  ]
  let actCreated = 0
  for (const a of stageActs) {
    const lead = leads[a.ldIdx]
    if (!lead) continue
    // No dedup for activity — always insert if force, skip if not
    if (!FORCE) {
      // Check if this kind+entityId already exists
      const ex = await db.select().from(crmActivitySchema)
        .where(and(eq(crmActivitySchema.entityId, lead.id), eq(crmActivitySchema.kind, a.kind), eq(crmActivitySchema.organizationId, org.id))).limit(1)
      if (ex[0]) continue
    }
    await db.insert(crmActivitySchema).values({
      organizationId: org.id, entityType: 'lead', entityId: lead.id,
      actorUserId: owner.id, kind: a.kind, payload: a.payload,
      createdAt: daysAgo(a.ago),
    }).catch(() => undefined)
    actCreated++
  }
  log('communications', commCreated, commDefs.length)
  log('activity entries (stage changes)', actCreated, stageActs.length)

  // ══════════════════════════════════════════════════════════════════════════
  // Projects
  // ══════════════════════════════════════════════════════════════════════════
  const projectDefs = [
    {
      name: 'Внедрение CRM Meridian',
      description: 'Полное внедрение CRM-системы для отдела продаж: настройка, обучение персонала, интеграция с 1С.',
      status: 'active',
      priority: 'high',
      progress: 65,
      budget: 850_000,
      color: '#6366f1',
      startDaysAgo: 45,
      endDaysFromNow: 30,
    },
    {
      name: 'Редизайн корпоративного сайта',
      description: 'Полная переработка UI/UX сайта компании. Новый дизайн, адаптив, SEO-оптимизация.',
      status: 'active',
      priority: 'medium',
      progress: 40,
      budget: 320_000,
      color: '#10b981',
      startDaysAgo: 20,
      endDaysFromNow: 45,
    },
    {
      name: 'Мобильное приложение для клиентов',
      description: 'Разработка мобильного приложения iOS/Android для клиентского портала.',
      status: 'planning',
      priority: 'high',
      progress: 10,
      budget: 1_500_000,
      color: '#f59e0b',
      startDaysAgo: 5,
      endDaysFromNow: 120,
    },
    {
      name: 'Автоматизация складского учёта',
      description: 'Интеграция WMS-системы со складом. Штрихкоды, инвентаризация, отчётность.',
      status: 'completed',
      priority: 'medium',
      progress: 100,
      budget: 450_000,
      color: '#06b6d4',
      startDaysAgo: 90,
      endDaysFromNow: -10,
    },
    {
      name: 'Запуск нового продукта B2B',
      description: 'Вывод на рынок новой линейки B2B-решений: маркетинг, продажи, партнёрская сеть.',
      status: 'on_hold',
      priority: 'low',
      progress: 25,
      budget: 600_000,
      color: '#8b5cf6',
      startDaysAgo: 30,
      endDaysFromNow: 60,
    },
  ]

  let projCreated = 0
  const projects: Array<{ id: number }> = []
  for (const p of projectDefs) {
    const [existing] = await db.select({ id: projectsSchema.id })
      .from(projectsSchema)
      .where(and(eq(projectsSchema.name, p.name), eq(projectsSchema.organizationId, org.id)))
      .limit(1)
    if (existing) {
      projects.push(existing)
      continue
    }
    const startDate = new Date(); startDate.setDate(startDate.getDate() - p.startDaysAgo)
    const endDate = new Date(); endDate.setDate(endDate.getDate() + p.endDaysFromNow)
    const [proj] = await db.insert(projectsSchema).values({
      organizationId: org.id,
      ownerUserId: owner.id,
      name: p.name,
      description: p.description,
      status: p.status,
      priority: p.priority,
      progress: p.progress,
      budget: p.budget,
      currency: 'RUB',
      color: p.color,
      startDate,
      endDate,
    }).returning({ id: projectsSchema.id })
    if (proj) {
      projects.push(proj)
      projCreated++
      // add members
      await db.insert(projectMembersSchema).values({ projectId: proj.id, userId: owner.id, role: 'owner' }).onConflictDoNothing()
      const extraUser = users.find(u => u.id !== owner.id)
      if (extraUser) {
        await db.insert(projectMembersSchema).values({ projectId: proj.id, userId: extraUser.id, role: 'member' }).onConflictDoNothing()
      }
    }
  }
  log('projects', projCreated, projectDefs.length)

  // ══════════════════════════════════════════════════════════════════════════
  // Done
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n✅  Seed complete!')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('Credentials:')
  console.log('  owner@meridian.demo    / demo1234  (owner/root)')
  console.log('  manager@meridian.demo  / demo1234  (admin)')
  console.log('  employee@meridian.demo / demo1234  (member)')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  await pool.end()
}

main().catch((e) => { console.error(e); process.exit(1) })

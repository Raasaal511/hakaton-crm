import { useCallback, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragEndEvent,
  type DragStartEvent,
  closestCorners,
} from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  sortableKeyboardCoordinates,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Plus,
  GripVertical,
  MoreHorizontal,
  Trash2,
  Building2,
  User,
  Sparkles,
  Loader2,
} from 'lucide-react'
import { crmAPI, type CrmCompany, type CrmContact, type CrmDealStage, type CrmLead } from 'shared/api/requests/crm'
import { qk } from 'shared/api/queryKeys'
import { InlineEdit } from 'shared/ui'
import { formatRubles, PRIORITY_COLORS } from 'shared/lib/crmDemoData'
import { useLeadScore } from 'features/realtime/useLeadScore'
import styles from './LeadsKanbanBoard.module.css'

const STAGE_COLORS = ['#6366f1', '#0ea5e9', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#64748b'] as const

type Props = {
  orgId: number
  stages: CrmDealStage[]
  leads: CrmLead[]
  companies: CrmCompany[]
  contacts: CrmContact[]
  loading?: boolean
  onAddLead: (stageCode: string) => void
  onEditLead: (lead: CrmLead) => void
}

function scoreColor(score: number) {
  if (score >= 70) return '#10b981'
  if (score >= 45) return '#f59e0b'
  return '#ef4444'
}

function AiScoreBadge({ lead }: { lead: CrmLead }) {
  const { data, isLoading } = useLeadScore(lead)
  if (isLoading) {
    return (
      <span className={styles.aiScoreBadge}>
        <Loader2 size={9} className={styles.spin} />
      </span>
    )
  }
  const score = data?.score ?? 0
  const color = scoreColor(score)
  return (
    <span
      className={styles.aiScoreBadge}
      style={{ color, background: `color-mix(in srgb, ${color} 12%, var(--color-bg))`, borderColor: `color-mix(in srgb, ${color} 25%, transparent)` }}
      title={data?.summary ?? `AI Score: ${score}`}
    >
      <Sparkles size={9} />
      {score}
    </span>
  )
}

function LeadCardContent({
  lead,
  companyName,
  contactName,
  stageColor,
}: {
  lead: CrmLead
  companyName?: string
  contactName?: string
  stageColor: string
}) {
  const priorityColor = PRIORITY_COLORS[lead.priority as keyof typeof PRIORITY_COLORS] ?? '#6b7280'
  return (
    <>
      <div className={styles.cardTop}>
        <span className={styles.cardTitle}>{lead.title}</span>
        <div className={styles.cardTopRight}>
          <AiScoreBadge lead={lead} />
          <span className={styles.priorityDot} style={{ background: priorityColor }} title={lead.priority} />
        </div>
      </div>
      {(companyName || contactName) && (
        <div className={styles.cardMeta}>
          {companyName && <span><Building2 size={10} />{companyName}</span>}
          {contactName && <span><User size={10} />{contactName}</span>}
        </div>
      )}
      {lead.source && <div className={styles.cardSource}>{lead.source}</div>}
      <div className={styles.cardFooter}>
        <span className={styles.cardAmount}>{formatRubles(lead.amount)}</span>
        <span
          className={styles.probBadge}
          style={{ color: stageColor, background: `color-mix(in srgb, ${stageColor} 12%, var(--color-bg))` }}
        >
          {lead.probability}%
        </span>
      </div>
    </>
  )
}

function DraggableLeadCard({
  lead,
  companyName,
  contactName,
  stageColor,
  onEdit,
}: {
  lead: CrmLead
  companyName?: string
  contactName?: string
  stageColor: string
  onEdit: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `lead-${lead.id}`,
    data: { type: 'lead', leadId: lead.id, stage: lead.stage },
  })

  const style = transform
    ? { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1 }
    : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${styles.kanbanCard} ${isDragging ? styles.kanbanCardDragging : ''}`}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        if (isDragging) return
        e.stopPropagation()
        onEdit()
      }}
    >
      <LeadCardContent lead={lead} companyName={companyName} contactName={contactName} stageColor={stageColor} />
    </div>
  )
}

function StageColumn({
  stage,
  leads,
  companyMap,
  contactMap,
  onAddLead,
  onEditLead,
  onRename,
  onColorChange,
  onDelete,
}: {
  stage: CrmDealStage
  leads: CrmLead[]
  companyMap: Map<number, string>
  contactMap: Map<number, string>
  onAddLead: () => void
  onEditLead: (lead: CrmLead) => void
  onRename: (name: string) => Promise<void>
  onColorChange: (color: string) => void
  onDelete: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const stageColor = stage.color ?? '#6366f1'
  const stageSum = leads.reduce((s, l) => s + l.amount, 0)

  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `stage-${stage.id}`, data: { type: 'stage', stageId: stage.id } })

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `col-${stage.code}`,
    data: { type: 'column', stageCode: stage.code },
  })

  const columnStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
  }

  return (
    <div ref={setSortableRef} style={columnStyle} className={styles.kanbanColumn}>
      <div className={styles.columnHeader} style={{ '--col-color': stageColor } as React.CSSProperties}>
        <button type="button" className={styles.columnDragHandle} {...attributes} {...listeners} aria-label="Переместить колонку">
          <GripVertical size={14} />
        </button>
        <span className={styles.columnDot} style={{ background: stageColor }} />
        <InlineEdit value={stage.name} onSave={onRename} className={styles.columnTitleEdit} />
        <span className={styles.columnCount}>{leads.length}</span>
        <div className={styles.columnMenuWrap}>
          <button type="button" className={styles.columnMenuBtn} onClick={() => setMenuOpen((v) => !v)}>
            <MoreHorizontal size={14} />
          </button>
          {menuOpen && (
            <div className={styles.columnMenu}>
              <div className={styles.colorRow}>
                {STAGE_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`${styles.colorSwatch} ${stageColor === c ? styles.colorSwatchActive : ''}`}
                    style={{ background: c }}
                    onClick={() => { onColorChange(c); setMenuOpen(false) }}
                  />
                ))}
              </div>
              <button
                type="button"
                className={styles.columnMenuItemDanger}
                onClick={() => { setMenuOpen(false); onDelete() }}
              >
                <Trash2 size={13} />
                Удалить колонку
              </button>
            </div>
          )}
        </div>
        {stageSum > 0 && <span className={styles.columnSum}>{formatRubles(stageSum)}</span>}
      </div>

      <div
        ref={setDropRef}
        className={`${styles.columnCards} ${isOver ? styles.columnCardsOver : ''}`}
      >
        {leads.map((lead) => (
          <DraggableLeadCard
            key={lead.id}
            lead={lead}
            companyName={lead.companyId ? companyMap.get(lead.companyId) : undefined}
            contactName={lead.contactId ? contactMap.get(lead.contactId) : undefined}
            stageColor={stageColor}
            onEdit={() => onEditLead(lead)}
          />
        ))}
        {leads.length === 0 && (
          <div className={styles.columnEmpty}>Перетащите лид сюда</div>
        )}
      </div>

      <button type="button" className={styles.addCardBtn} onClick={onAddLead}>
        <Plus size={13} />
        Добавить
      </button>
    </div>
  )
}

export function LeadsKanbanBoard({
  orgId,
  stages,
  leads,
  companies,
  contacts,
  loading,
  onAddLead,
  onEditLead,
}: Props) {
  const queryClient = useQueryClient()
  const [activeDrag, setActiveDrag] = useState<{ type: 'lead' | 'stage'; id: number } | null>(null)
  const [localLeads, setLocalLeads] = useState<CrmLead[] | null>(null)
  const [localStages, setLocalStages] = useState<CrmDealStage[] | null>(null)

  const displayLeads = localLeads ?? leads
  const displayStages = localStages ?? stages

  const companyMap = useMemo(() => new Map(companies.map((c) => [c.id, c.name])), [companies])
  const contactMap = useMemo(() => {
    const map = new Map<number, string>()
    for (const c of contacts) {
      map.set(c.id, [c.firstName, c.lastName].filter(Boolean).join(' '))
    }
    return map
  }, [contacts])

  const leadsByStage = useMemo(() => {
    const map = new Map<string, CrmLead[]>()
    for (const stage of displayStages) map.set(stage.code, [])
    for (const lead of displayLeads) {
      const list = map.get(lead.stage) ?? []
      list.push(lead)
      map.set(lead.stage, list)
    }
    return map
  }, [displayLeads, displayStages])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['crm', orgId, 'leads'] })
    queryClient.invalidateQueries({ queryKey: qk.crmDealStages(orgId) })
    queryClient.invalidateQueries({ queryKey: qk.crmDealStats(orgId) })
    queryClient.invalidateQueries({ queryKey: qk.crmLeadStats(orgId) })
  }, [orgId, queryClient])

  const moveLeadMutation = useMutation({
    mutationFn: ({ leadId, stage, probability }: { leadId: number; stage: string; probability?: number }) =>
      crmAPI.moveLead(orgId, leadId, { stage, probability }),
    onSettled: () => {
      setLocalLeads(null)
      invalidate()
    },
  })

  const updateStageMutation = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Partial<CrmDealStage> }) =>
      crmAPI.updateDealStage(orgId, id, patch),
    onSettled: () => {
      setLocalStages(null)
      invalidate()
    },
  })

  const reorderStagesMutation = useMutation({
    mutationFn: (order: { id: number; position: number }[]) =>
      crmAPI.reorderDealStages(orgId, order),
    onSettled: () => {
      setLocalStages(null)
      invalidate()
    },
  })

  const createStageMutation = useMutation({
    mutationFn: (name: string) =>
      crmAPI.createDealStage(orgId, {
        name,
        position: displayStages.length + 1,
        probability: 20,
        color: STAGE_COLORS[displayStages.length % STAGE_COLORS.length],
      }),
    onSuccess: invalidate,
  })

  const deleteStageMutation = useMutation({
    mutationFn: (id: number) => crmAPI.deleteDealStage(orgId, id),
    onSuccess: invalidate,
  })

  function resolveTargetStage(overId: string): string | null {
    if (overId.startsWith('col-')) return overId.slice(4)
    if (overId.startsWith('lead-')) {
      const leadId = Number(overId.slice(5))
      const lead = displayLeads.find((l) => l.id === leadId)
      return lead?.stage ?? null
    }
    if (overId.startsWith('stage-')) {
      const stageId = Number(overId.slice(6))
      return displayStages.find((s) => s.id === stageId)?.code ?? null
    }
    return null
  }

  function handleDragStart(event: DragStartEvent) {
    const id = String(event.active.id)
    if (id.startsWith('lead-')) setActiveDrag({ type: 'lead', id: Number(id.slice(5)) })
    if (id.startsWith('stage-')) setActiveDrag({ type: 'stage', id: Number(id.slice(6)) })
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDrag(null)
    const { active, over } = event
    if (!over) return

    const activeId = String(active.id)
    const overId = String(over.id)

    if (activeId.startsWith('stage-') && overId.startsWith('stage-')) {
      const oldIndex = displayStages.findIndex((s) => `stage-${s.id}` === activeId)
      const newIndex = displayStages.findIndex((s) => `stage-${s.id}` === overId)
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return
      const reordered = arrayMove(displayStages, oldIndex, newIndex)
      setLocalStages(reordered)
      reorderStagesMutation.mutate(reordered.map((s, i) => ({ id: s.id, position: i + 1 })))
      return
    }

    if (activeId.startsWith('lead-')) {
      const leadId = Number(activeId.slice(5))
      const lead = displayLeads.find((l) => l.id === leadId)
      const targetStage = resolveTargetStage(overId)
      if (!lead || !targetStage || lead.stage === targetStage) return

      const stageMeta = displayStages.find((s) => s.code === targetStage)
      const nextLeads = displayLeads.map((l) =>
        l.id === leadId
          ? { ...l, stage: targetStage, probability: stageMeta?.probability ?? l.probability }
          : l,
      )
      setLocalLeads(nextLeads)
      moveLeadMutation.mutate({
        leadId,
        stage: targetStage,
        probability: stageMeta?.probability,
      })
    }
  }

  const activeLead = activeDrag?.type === 'lead'
    ? displayLeads.find((l) => l.id === activeDrag.id)
    : null

  const stageIds = displayStages.map((s) => `stage-${s.id}`)

  return (
    <div className={styles.boardWrap}>
      {loading && <div className={styles.loadingOverlay}><Loader2 size={20} className={styles.spin} /></div>}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={stageIds} strategy={horizontalListSortingStrategy}>
          <div className={styles.kanban}>
            {displayStages.map((stage) => (
              <StageColumn
                key={stage.id}
                stage={stage}
                leads={leadsByStage.get(stage.code) ?? []}
                companyMap={companyMap}
                contactMap={contactMap}
                onAddLead={() => onAddLead(stage.code)}
                onEditLead={onEditLead}
                onRename={async (name) => {
                  await updateStageMutation.mutateAsync({ id: stage.id, patch: { name } })
                }}
                onColorChange={(color) => updateStageMutation.mutate({ id: stage.id, patch: { color } })}
                onDelete={() => {
                  if (!window.confirm(`Удалить колонку «${stage.name}»? Лиды будут перенесены в другую колонку.`)) return
                  deleteStageMutation.mutate(stage.id)
                }}
              />
            ))}

            <button
              type="button"
              className={styles.addColumnBtn}
              disabled={createStageMutation.isPending}
              onClick={() => {
                const name = window.prompt('Название новой колонки')
                if (!name?.trim()) return
                createStageMutation.mutate(name.trim())
              }}
            >
              <Plus size={14} />
              Колонка
            </button>
          </div>
        </SortableContext>

        <DragOverlay>
          {activeLead && (
            <div className={`${styles.kanbanCard} ${styles.kanbanCardOverlay}`}>
              <LeadCardContent
                lead={activeLead}
                companyName={activeLead.companyId ? companyMap.get(activeLead.companyId) : undefined}
                contactName={activeLead.contactId ? contactMap.get(activeLead.contactId) : undefined}
                stageColor={displayStages.find((s) => s.code === activeLead.stage)?.color ?? '#6366f1'}
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  )
}

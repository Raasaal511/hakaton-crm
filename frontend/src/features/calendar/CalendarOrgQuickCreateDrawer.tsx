import { useEffect, useMemo, useState } from 'react'
import { CreateTaskDrawer } from 'entities/tasks'
import { columnsAPI } from 'shared/api/requests/columns'
import { departmentsAPI } from 'shared/api/requests/departments'
import { pipelinesAPI } from 'shared/api/requests/pipelines'
import { tasksAPI } from 'shared/api/requests/tasks'
import { Dropdown, FilterSelectTrigger, filterSelectDropdownClassName, type DropdownItem } from 'shared/ui'
import { isTaskInCompletedPipelineColumn } from 'shared/lib/isTaskInCompletedPipelineColumn'
import { FolderOpen, GitBranch, List } from 'lucide-react'
import type { Column } from 'shared/types/columns'
import type { Department, DepartmentMember } from 'shared/types/departments'
import type { Pipeline } from 'shared/types/pipelines'
import drawerChromeStyles from '../../entities/tasks/ui/ColumnTasks.module.css'

type Props = {
  open: boolean
  onClose: () => void
  organizationId: number
  ymd: string
  isPersonalOrganization?: boolean
  currentUserId?: number
  onCreated?: () => void
}

export function CalendarOrgQuickCreateDrawer({
  open,
  onClose,
  organizationId,
  ymd,
  isPersonalOrganization = false,
  currentUserId,
  onCreated,
}: Props) {
  const [departments, setDepartments] = useState<Department[]>([])
  const [departmentId, setDepartmentId] = useState<number | null>(null)
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [pipelineId, setPipelineId] = useState<number | null>(null)
  const [columns, setColumns] = useState<Column[]>([])
  const [columnId, setColumnId] = useState<number | null>(null)
  const [members, setMembers] = useState<DepartmentMember[]>([])
  const [nextPosition, setNextPosition] = useState(0)
  const [formMountKey, setFormMountKey] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || organizationId <= 0) return
    let cancelled = false
    departmentsAPI
      .getAll(organizationId)
      .then((list) => {
        if (cancelled) return
        setDepartments(list)
        const first = list[0]?.id ?? null
        setDepartmentId(first)
        setPipelineId(null)
        setColumnId(null)
        setFormMountKey((k) => k + 1)
      })
      .catch(() => {
        if (!cancelled) setDepartments([])
      })
    return () => {
      cancelled = true
    }
  }, [open, organizationId])

  useEffect(() => {
    if (!open || departmentId == null) return
    let cancelled = false
    setLoading(true)
    Promise.all([
      pipelinesAPI.getAll(departmentId),
      departmentsAPI.getMembers(departmentId),
    ])
      .then(([pList, mList]) => {
        if (cancelled) return
        setPipelines(pList)
        setMembers(mList)
        const firstPipeline = pList[0]?.id ?? null
        setPipelineId(firstPipeline)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, departmentId])

  useEffect(() => {
    if (!open || pipelineId == null) {
      setColumns([])
      setColumnId(null)
      return
    }
    let cancelled = false
    columnsAPI.getByPipeline(pipelineId).then((cols) => {
      if (cancelled) return
      setColumns(cols)
      const sorted = [...cols].sort((a, b) => a.position - b.position)
      const creatable = sorted.filter((c) => !isTaskInCompletedPipelineColumn(c.id, cols))
      setColumnId(creatable[0]?.id ?? null)
      setFormMountKey((k) => k + 1)
    })
    return () => {
      cancelled = true
    }
  }, [open, pipelineId])

  useEffect(() => {
    if (!open || columnId == null) {
      setNextPosition(0)
      return
    }
    let cancelled = false
    tasksAPI
      .getByColumnPaginated(columnId, { limit: 1, offset: 0 })
      .then(({ total }) => {
        if (cancelled) return
        setNextPosition(total)
      })
      .catch(() => {
        if (!cancelled) setNextPosition(0)
      })
    return () => {
      cancelled = true
    }
  }, [open, columnId, formMountKey])

  const creatableColumns = useMemo(() => {
    const sorted = [...columns].sort((a, b) => a.position - b.position)
    return sorted.filter((c) => !isTaskInCompletedPipelineColumn(c.id, columns))
  }, [columns])

  const departmentItems = useMemo<DropdownItem[]>(
    () => departments.map((d) => ({ id: d.id, label: d.name })),
    [departments],
  )
  const pipelineItems = useMemo<DropdownItem[]>(
    () => pipelines.map((p) => ({ id: p.id, label: p.name })),
    [pipelines],
  )
  const columnItems = useMemo<DropdownItem[]>(
    () => creatableColumns.map((c) => ({ id: c.id, label: c.name })),
    [creatableColumns],
  )

  const targetColumn = creatableColumns.find((c) => c.id === columnId) ?? null

  const headerBelowTitle =
    departments.length > 0 ? (
      <div className={drawerChromeStyles.createDrawerColumnFieldStack}>
        {departments.length > 1 ? (
          <div className={drawerChromeStyles.createDrawerColumnField}>
            <span className={drawerChromeStyles.createDrawerFieldLabel}>Раздел</span>
            <Dropdown
              items={departmentItems}
              value={departmentId ?? 0}
              placeholder="Раздел"
              className={filterSelectDropdownClassName}
              renderTrigger={({ open: ddOpen, selectedLabel, toggle }) => (
                <FilterSelectTrigger
                  compact
                  open={ddOpen}
                  selectedLabel={selectedLabel || 'Раздел'}
                  toggle={toggle}
                  icon={<FolderOpen size={14} strokeWidth={1.75} aria-hidden />}
                />
              )}
              onChange={(value) => {
                const raw = value == null ? NaN : Number(value)
                if (Number.isFinite(raw)) {
                  setDepartmentId(raw)
                  setFormMountKey((k) => k + 1)
                }
              }}
            />
          </div>
        ) : null}
        {pipelines.length > 1 ? (
          <div className={drawerChromeStyles.createDrawerColumnField}>
            <span className={drawerChromeStyles.createDrawerFieldLabel}>Воронка</span>
            <Dropdown
              items={pipelineItems}
              value={pipelineId ?? 0}
              placeholder="Воронка"
              className={filterSelectDropdownClassName}
              renderTrigger={({ open: ddOpen, selectedLabel, toggle }) => (
                <FilterSelectTrigger
                  compact
                  open={ddOpen}
                  selectedLabel={selectedLabel || 'Воронка'}
                  toggle={toggle}
                  icon={<GitBranch size={14} strokeWidth={1.75} aria-hidden />}
                />
              )}
              onChange={(value) => {
                const raw = value == null ? NaN : Number(value)
                if (Number.isFinite(raw)) {
                  setPipelineId(raw)
                  setFormMountKey((k) => k + 1)
                }
              }}
            />
          </div>
        ) : null}
        {creatableColumns.length > 1 ? (
          <div className={drawerChromeStyles.createDrawerColumnField}>
            <span className={drawerChromeStyles.createDrawerFieldLabel}>Колонка</span>
            <Dropdown
              items={columnItems}
              value={columnId ?? 0}
              placeholder="Колонка"
              className={filterSelectDropdownClassName}
              renderTrigger={({ open: ddOpen, selectedLabel, toggle }) => (
                <FilterSelectTrigger
                  compact
                  open={ddOpen}
                  selectedLabel={selectedLabel || targetColumn?.name || 'Колонка'}
                  toggle={toggle}
                  icon={<List size={14} strokeWidth={1.75} aria-hidden />}
                />
              )}
              onChange={(value) => {
                const raw = value == null ? NaN : Number(value)
                if (Number.isFinite(raw)) {
                  setColumnId(raw)
                  setFormMountKey((k) => k + 1)
                }
              }}
            />
          </div>
        ) : null}
      </div>
    ) : undefined

  const ready = columnId != null && departmentId != null && !loading

  return (
    <CreateTaskDrawer
      open={open && ready}
      onClose={onClose}
      onSuccess={() => {
        onCreated?.()
        onClose()
      }}
      columnId={columnId ?? 0}
      departmentId={departmentId ?? 0}
      nextPosition={nextPosition}
      titleId="calendar-org-create-title"
      columnTitle={creatableColumns.length <= 1 ? targetColumn?.name : undefined}
      headerBelowTitle={headerBelowTitle}
      members={members}
      isPersonalOrganization={isPersonalOrganization}
      currentUserId={currentUserId}
      formMountKey={formMountKey}
      initialStartYmd={ymd}
      initialDeadLineYmd={ymd}
    />
  )
}

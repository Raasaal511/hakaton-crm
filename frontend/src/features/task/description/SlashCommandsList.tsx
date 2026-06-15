import {
  useEffect,
  useImperativeHandle,
  forwardRef,
  useState,
  useRef,
} from 'react'
import type { SuggestionKeyDownProps, SuggestionProps } from '@tiptap/suggestion'
import type { SlashCommandDefinition } from './slashCommandItems'
import styles from './SlashCommandsList.module.css'

export type SlashCommandsListHandle = {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean
}

type SlashCommandsListProps = SuggestionProps<SlashCommandDefinition>

function listSignature(query: string, items: SlashCommandDefinition[]) {
  return `${query}|${items.map((i) => i.title).join('|')}`
}

export const SlashCommandsList = forwardRef<
  SlashCommandsListHandle,
  SlashCommandsListProps
>(function SlashCommandsList(props, ref) {
  const sig = listSignature(props.query, props.items)
  return <SlashCommandsListInner key={sig} ref={ref} {...props} />
})

const SlashCommandsListInner = forwardRef<
  SlashCommandsListHandle,
  SlashCommandsListProps
>(function SlashCommandsListInner(props, ref) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  const selectItem = (index: number) => {
    const item = props.items[index]
    if (item) props.command(item)
  }

  useEffect(() => {
    const el = itemRefs.current[selectedIndex]
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex, props.items])

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: SuggestionKeyDownProps) => {
      if (props.items.length === 0) return false

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setSelectedIndex((i) => (i + 1) % props.items.length)
        return true
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setSelectedIndex((i) => (i + props.items.length - 1) % props.items.length)
        return true
      }

      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault()
        selectItem(selectedIndex)
        return true
      }

      return false
    },
  }))

  if (props.items.length === 0) {
    return (
      <div className={styles.menu} role="listbox">
        <div className={styles.empty}>Ничего не найдено</div>
      </div>
    )
  }

  return (
    <div className={styles.menu} role="listbox" aria-label="Команды по слэшу">
      {props.items.map((item, index) => {
        const Icon = item.Icon
        const selected = index === selectedIndex
        return (
          <button
            key={`${item.title}-${item.subtitle}`}
            ref={(el) => {
              itemRefs.current[index] = el
            }}
            type="button"
            role="option"
            aria-selected={selected}
            className={`${styles.item} ${selected ? styles.itemSelected : ''}`}
            onClick={() => selectItem(index)}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <span className={styles.itemIcon} aria-hidden>
              <Icon size={18} strokeWidth={2} />
            </span>
            <span className={styles.itemText}>
              <span className={styles.itemTitle}>{item.title}</span>
              <span className={styles.itemSubtitle}>{item.subtitle}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
})

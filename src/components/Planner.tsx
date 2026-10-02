import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { CardDef, PlanItem } from '../types'
import { MAX_MINUTES, MIN_MINUTES } from '../cards'
import { addMinutes, formatClock, formatMinutes } from '../time'
import { StepButton } from './StepButton'

const PALETTE_ZONE = 'palette-zone'
const LIST_ZONE = 'list-zone'

const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args)
  return hits.length ? hits : rectIntersection(args)
}

export function newItem(card: Pick<CardDef, 'id' | 'name' | 'emoji' | 'color' | 'minutes'>): PlanItem {
  return {
    uid: crypto.randomUUID(),
    cardId: card.id,
    name: card.name,
    emoji: card.emoji,
    color: card.color,
    minutes: card.minutes,
  }
}

interface Props {
  now: Date
  cards: CardDef[]
  items: PlanItem[]
  onChange: (items: PlanItem[]) => void
  onCreateCard: () => void
}

export function Planner({ now, cards, items, onChange, onCreateCard }: Props) {
  const [dragging, setDragging] = useState<{ kind: 'card' | 'item'; card?: CardDef; item?: PlanItem } | null>(null)

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // さわってすぐ動かすとスクロール、ちょっと押さえると ドラッグ
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  )

  const onDragStart = (e: DragStartEvent) => {
    const id = String(e.active.id)
    if (id.startsWith('card:')) {
      setDragging({ kind: 'card', card: cards.find((c) => `card:${c.id}` === id) })
    } else {
      setDragging({ kind: 'item', item: items.find((i) => i.uid === id) })
    }
  }

  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null)
    const { active, over } = e
    const id = String(active.id)
    if (id.startsWith('card:')) {
      const card = cards.find((c) => `card:${c.id}` === id)
      if (!card || !over || over.id === PALETTE_ZONE) return
      const overIdx = items.findIndex((i) => i.uid === over.id)
      let at = items.length
      if (overIdx >= 0) {
        const activeRect = active.rect.current.translated
        const below = activeRect ? activeRect.top + activeRect.height / 2 > over.rect.top + over.rect.height / 2 : false
        at = overIdx + (below ? 1 : 0)
      }
      const next = [...items]
      next.splice(at, 0, newItem(card))
      onChange(next)
      return
    }
    // よていの列のカード
    if (!over) return
    if (over.id === PALETTE_ZONE) {
      onChange(items.filter((i) => i.uid !== id))
      return
    }
    const from = items.findIndex((i) => i.uid === id)
    const to = over.id === LIST_ZONE ? items.length - 1 : items.findIndex((i) => i.uid === over.id)
    if (from >= 0 && to >= 0 && from !== to) onChange(arrayMove(items, from, to))
  }

  const setMinutes = (uid: string, delta: number) =>
    onChange(
      items.map((i) =>
        i.uid === uid ? { ...i, minutes: Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, i.minutes + delta)) } : i,
      ),
    )

  // 各カードのはじまる時刻
  let cursor = now
  const starts = items.map((i) => {
    const s = cursor
    cursor = addMinutes(cursor, i.minutes)
    return s
  })

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDragging(null)}
    >
      <section className="plan-area" aria-label="きょうのよてい">
        <PlanList
          items={items}
          starts={starts}
          dragging={dragging}
          onMinutes={setMinutes}
          onRemove={(uid) => onChange(items.filter((i) => i.uid !== uid))}
        />
        {items.length > 0 && (
          <p className="end-time" aria-live="polite">
            <span className="end-time__icon">🏁</span>
            <b>{formatClock(cursor)}</b>に おわるよ
          </p>
        )}
      </section>

      <Palette cards={cards} dragging={dragging} onAdd={(c) => onChange([...items, newItem(c)])} onCreateCard={onCreateCard} />

      <DragOverlay dropAnimation={null}>
        {dragging?.card && <CardFace emoji={dragging.card.emoji} name={dragging.card.name} color={dragging.card.color} overlay />}
        {dragging?.item && (
          <div className="plan-row plan-row--overlay" style={{ background: dragging.item.color }}>
            <span className="plan-row__emoji">{dragging.item.emoji}</span>
            <span className="plan-row__name">{dragging.item.name}</span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

function PlanList(props: {
  items: PlanItem[]
  starts: Date[]
  dragging: { kind: 'card' | 'item' } | null
  onMinutes: (uid: string, delta: number) => void
  onRemove: (uid: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: LIST_ZONE })
  const { items, starts, dragging } = props
  return (
    <div ref={setNodeRef} className={`plan-list${isOver && dragging?.kind === 'card' ? ' plan-list--over' : ''}`}>
      <SortableContext items={items.map((i) => i.uid)} strategy={verticalListSortingStrategy}>
        {items.map((item, idx) => (
          <PlanRow key={item.uid} item={item} start={starts[idx]} onMinutes={props.onMinutes} onRemove={props.onRemove} />
        ))}
      </SortableContext>
      {items.length === 0 && (
        <div className="plan-empty">
          <span className="plan-empty__arrow">👇</span>
          したの カードを ここに ならべてね
        </div>
      )}
    </div>
  )
}

function PlanRow({
  item,
  start,
  onMinutes,
  onRemove,
}: {
  item: PlanItem
  start: Date
  onMinutes: (uid: string, delta: number) => void
  onRemove: (uid: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.uid })
  return (
    <div
      ref={setNodeRef}
      className={`plan-row${isDragging ? ' plan-row--ghost' : ''}`}
      style={{ background: item.color, transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
    >
      <span className="plan-row__handle" aria-hidden>
        ⠿
      </span>
      <span className="plan-row__emoji" aria-hidden>
        {item.emoji}
      </span>
      <span className="plan-row__text">
        <span className="plan-row__name">{item.name}</span>
        <span className="plan-row__start">{formatClock(start)}から</span>
      </span>
      <span className="stepper">
        <StepButton label="−" ariaLabel={`${item.name} 1ぷん へらす`} direction={-1} onStep={(d) => onMinutes(item.uid, d)} />
        <span className="stepper__value">{formatMinutes(item.minutes)}</span>
        <StepButton label="＋" ariaLabel={`${item.name} 1ぷん ふやす`} direction={1} onStep={(d) => onMinutes(item.uid, d)} />
      </span>
      <button
        type="button"
        className="remove-btn"
        aria-label={`${item.name} をけす`}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onClick={() => onRemove(item.uid)}
      >
        ✕
      </button>
    </div>
  )
}

function CardFace({ emoji, name, color, overlay }: { emoji: string; name: string; color: string; overlay?: boolean }) {
  return (
    <div className={`card${overlay ? ' card--overlay' : ''}`} style={{ background: color }}>
      <span className="card__emoji">{emoji}</span>
      <span className="card__name">{name}</span>
    </div>
  )
}

function PaletteCard({ card, onAdd }: { card: CardDef; onAdd: (c: CardDef) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `card:${card.id}` })
  return (
    <button
      ref={setNodeRef}
      type="button"
      className={`card-btn${isDragging ? ' card-btn--ghost' : ''}`}
      onClick={() => onAdd(card)}
      {...attributes}
      {...listeners}
    >
      <CardFace emoji={card.emoji} name={card.name} color={card.color} />
    </button>
  )
}

function Palette({
  cards,
  dragging,
  onAdd,
  onCreateCard,
}: {
  cards: CardDef[]
  dragging: { kind: 'card' | 'item' } | null
  onAdd: (c: CardDef) => void
  onCreateCard: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: PALETTE_ZONE })
  const deleting = dragging?.kind === 'item'
  return (
    <section ref={setNodeRef} className={`palette${deleting ? ' palette--delete' : ''}${deleting && isOver ? ' palette--over' : ''}`} aria-label="やることカード">
      {deleting ? (
        <div className="palette__trash">
          <span>🗑️</span>
          ここに おとすと けせるよ
        </div>
      ) : (
        <>
          <h2 className="palette__title">やること</h2>
          <div className="palette__grid">
            {cards.map((c) => (
              <PaletteCard key={c.id} card={c} onAdd={onAdd} />
            ))}
            <button type="button" className="card-btn" onClick={onCreateCard}>
              <div className="card card--new">
                <span className="card__emoji">＋</span>
                <span className="card__name">じぶんで<br />つくる</span>
              </div>
            </button>
          </div>
        </>
      )}
    </section>
  )
}

import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
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
import type { CardDef, FixedCard, PlanItem } from '../types'
import { MAX_MINUTES, MIN_MINUTES } from '../cards'
import { formatClock, formatClockAp, formatMinOfDay, formatMinOfDayAp, formatMinutes, formatSpan, minuteOfDay } from '../time'
import {
  insertAtBlockEnd,
  insertFixed,
  insertNormalSmart,
  isEndOfDay,
  isFixed,
  isMoment,
  type Block,
  type Timeline,
} from '../schedule'
import { StepButton } from './StepButton'
import { SafeMouseSensor, SafeTouchSensor } from '../dndSensors'

const PALETTE_ZONE = 'palette-zone'
const LIST_ZONE = 'list-zone'
const BLOCK_PREFIX = 'block:'

const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args)
  return hits.length ? hits : rectIntersection(args)
}

type CardLike = Pick<CardDef, 'id' | 'name' | 'emoji' | 'color' | 'minutes'>

export function newItem(card: CardLike): PlanItem {
  return {
    uid: crypto.randomUUID(),
    cardId: card.id,
    name: card.name,
    emoji: card.emoji,
    color: card.color,
    minutes: card.minutes,
  }
}

export function newFixedItem(card: FixedCard): PlanItem {
  return { ...newItem(card), kind: 'fixed', startMin: card.startMin }
}

type Dragging = { kind: 'card'; card: CardDef } | { kind: 'fixed'; card: FixedCard } | { kind: 'item'; item: PlanItem } | null

interface Props {
  now: Date
  cards: CardDef[]
  fixedCards: FixedCard[]
  items: PlanItem[]
  timeline: Timeline
  /** スタート時刻（0:00からの分）。null は「いま」 */
  startMin: number | null
  /** 計算につかっているスタート時刻（ms）と、その日の 0:00（ms） */
  startAt: number
  dayStartMs: number
  /** きょうのよてい？（あしたのよていは、過ぎた時刻のうすい表示などをしない） */
  isToday: boolean
  /** 「いま」(ms)。過ぎた時刻のじこくカードを うすくするのに使う */
  nowMs: number
  /** あしたのよていの、スタート時刻の初期値（0:00からの分） */
  defaultStartMin: number
  onStartMin: (m: number | null) => void
  onChange: (items: PlanItem[]) => void
  onCreateCard: () => void
}

export function Planner({
  now,
  cards,
  fixedCards,
  items,
  timeline,
  startMin,
  startAt,
  dayStartMs,
  isToday,
  nowMs,
  defaultStartMin,
  onStartMin,
  onChange,
  onCreateCard,
}: Props) {
  const [dragging, setDragging] = useState<Dragging>(null)

  const sensors = useSensors(
    useSensor(SafeMouseSensor, { activationConstraint: { distance: 6 } }),
    // さわってすぐ動かすとスクロール、ちょっと押さえると ドラッグ
    useSensor(SafeTouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  )

  const addNormal = (card: CardDef) => onChange(insertNormalSmart(items, newItem(card), startAt, dayStartMs))
  const addFixed = (card: FixedCard) => {
    if (items.some((i) => i.cardId === card.id && isFixed(i))) return
    onChange(insertFixed(items, newFixedItem(card)))
  }

  const onDragStart = (e: DragStartEvent) => {
    const id = String(e.active.id)
    if (id.startsWith('card:')) {
      const card = cards.find((c) => `card:${c.id}` === id)
      setDragging(card ? { kind: 'card', card } : null)
    } else if (id.startsWith('fixed:')) {
      const card = fixedCards.find((c) => `fixed:${c.id}` === id)
      setDragging(card ? { kind: 'fixed', card } : null)
    } else {
      const item = items.find((i) => i.uid === id)
      setDragging(item ? { kind: 'item', item } : null)
    }
  }

  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null)
    const { active, over } = e
    const id = String(active.id)

    if (id.startsWith('fixed:')) {
      // じこくカードは、どこに落としても「時刻順」のところに入る
      const card = fixedCards.find((c) => `fixed:${c.id}` === id)
      if (card && over && over.id !== PALETTE_ZONE) addFixed(card)
      return
    }

    if (id.startsWith('card:')) {
      const card = cards.find((c) => `card:${c.id}` === id)
      if (!card || !over || over.id === PALETTE_ZONE) return
      const overId = String(over.id)
      if (overId.startsWith(BLOCK_PREFIX)) {
        onChange(insertAtBlockEnd(items, newItem(card), overId.slice(BLOCK_PREFIX.length)))
        return
      }
      const overIdx = items.findIndex((i) => i.uid === over.id)
      if (overIdx < 0) return addNormal(card)
      const activeRect = active.rect.current.translated
      const below = activeRect ? activeRect.top + activeRect.height / 2 > over.rect.top + over.rect.height / 2 : false
      const next = [...items]
      next.splice(overIdx + (below ? 1 : 0), 0, newItem(card))
      onChange(next)
      return
    }

    // よていの列のカード（ふつうのカードだけ動かせる）
    if (!over) return
    if (over.id === PALETTE_ZONE) {
      onChange(items.filter((i) => i.uid !== id))
      return
    }
    const overId = String(over.id)
    if (overId.startsWith(BLOCK_PREFIX)) {
      const moving = items.find((i) => i.uid === id)
      if (moving) onChange(insertAtBlockEnd(items.filter((i) => i.uid !== id), moving, overId.slice(BLOCK_PREFIX.length)))
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

  const lastBlock = timeline.blocks[timeline.blocks.length - 1]

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDragging(null)}
    >
      <section className="plan-area" aria-label="きょうのよてい">
        <StartTime now={now} isToday={isToday} defaultMin={defaultStartMin} startMin={startMin} onChange={onStartMin} />
        <PlanList
          items={items}
          timeline={timeline}
          dragging={dragging}
          fadePast={isToday}
          nowMs={nowMs}
          onMinutes={setMinutes}
          onRemove={(uid) => onChange(items.filter((i) => i.uid !== uid))}
        />
        {lastBlock?.pastEnd && lastBlock.rows.length > 0 && (
          <p className="block-note block-note--over">⚠️ ねるの じかんを すぎちゃうよ</p>
        )}
        {items.length > 0 && (
          <p className="end-time" aria-live="polite">
            <span className="end-time__icon">🏁</span>
            <b>{formatClock(new Date(timeline.endMs))}</b>に おわるよ
          </p>
        )}
      </section>

      <Palette
        cards={cards}
        fixedCards={fixedCards}
        items={items}
        dragging={dragging}
        onAdd={addNormal}
        onAddFixed={addFixed}
        onCreateCard={onCreateCard}
      />

      <DragOverlay dropAnimation={null}>
        {dragging?.kind === 'card' && <CardFace emoji={dragging.card.emoji} name={dragging.card.name} color={dragging.card.color} overlay />}
        {dragging?.kind === 'fixed' && (
          <CardFace emoji={dragging.card.emoji} name={dragging.card.name} color={dragging.card.color} overlay fixed />
        )}
        {dragging?.kind === 'item' && (
          <div className="plan-row plan-row--overlay" style={{ background: dragging.item.color }}>
            <span className="plan-row__emoji">{dragging.item.emoji}</span>
            <span className="plan-row__name">{dragging.item.name}</span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

/** スタート時刻（きょうは はじめ「いま」。−／＋で変えられる。あしたは はじめ 最初のじこくカードの時刻） */
function StartTime({
  now,
  isToday,
  defaultMin,
  startMin,
  onChange,
}: {
  now: Date
  isToday: boolean
  defaultMin: number
  startMin: number | null
  onChange: (m: number | null) => void
}) {
  const baseMin = isToday ? Math.floor(minuteOfDay(now.getTime())) : defaultMin
  const shown = startMin ?? baseMin
  const step = (d: number) => onChange(Math.min(24 * 60 - 1, Math.max(0, shown + d)))
  return (
    <div className="start-time">
      <span className="start-time__label">🚩 スタート</span>
      <span className="stepper stepper--light">
        <StepButton label="−" ariaLabel="スタートを はやく" direction={-1} onStep={step} />
        <span className="stepper__value stepper__value--wide">
          {startMin === null && isToday && <small>いま </small>}
          {formatMinOfDay(shown)}
        </span>
        <StepButton label="＋" ariaLabel="スタートを おそく" direction={1} onStep={step} />
      </span>
      {startMin !== null && (
        <button type="button" className="link-btn" onClick={() => onChange(null)}>
          {isToday ? 'いまに もどす' : 'もとに もどす'}
        </button>
      )}
    </div>
  )
}

function PlanList(props: {
  items: PlanItem[]
  timeline: Timeline
  dragging: Dragging
  fadePast: boolean
  nowMs: number
  onMinutes: (uid: string, delta: number) => void
  onRemove: (uid: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: LIST_ZONE })
  const { items, timeline, dragging, fadePast, nowMs } = props
  const blockOf = new Map<string, Block>()
  for (const b of timeline.blocks) if (b.fixed) blockOf.set(b.fixed.uid, b)
  return (
    <div ref={setNodeRef} className={`plan-list${isOver && dragging?.kind === 'card' ? ' plan-list--over' : ''}`}>
      <SortableContext items={items.map((i) => i.uid)} strategy={verticalListSortingStrategy}>
        {items.map((item) => {
          const row = timeline.rows.get(item.uid)
          if (isFixed(item)) {
            const block = blockOf.get(item.uid)
            return (
              <div key={item.uid} className="plan-group">
                {block && <BlockFooter block={block} fixed={item} />}
                <FixedRow
                  item={item}
                  startMs={row?.startMs}
                  endMs={row?.endMs}
                  past={fadePast && row != null && (isMoment(item) ? row.startMs : row.endMs) <= nowMs}
                  onRemove={props.onRemove}
                />
              </div>
            )
          }
          const pastEnd = timeline.blocks.some((b) => b.pastEnd && b.rows.some((r) => r.item.uid === item.uid))
          return (
            <PlanRow
              key={item.uid}
              item={item}
              startMs={row?.past ? undefined : row?.startMs}
              faded={!!row?.past}
              late={pastEnd}
              onMinutes={props.onMinutes}
              onRemove={props.onRemove}
            />
          )
        })}
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

/** ブロックの おわりに出る「じゆうじかん」と、のこり時間 */
function BlockFooter({ block, fixed }: { block: Block; fixed: PlanItem }) {
  const { setNodeRef, isOver } = useDroppable({ id: BLOCK_PREFIX + fixed.uid })
  const free = block.freeMs ?? 0
  const freeMin = Math.floor(free / 60_000)
  // もう過ぎたブロックと、カードも あきじかんも ないブロック（いえをでる〜がっこう など）は、何も出さない
  if (block.past || (block.rows.length === 0 && freeMin < 1 && !block.passed)) return <div ref={setNodeRef} className="block-footer--none" />
  let cls = 'block-footer'
  let body
  if (block.passed) {
    cls += ' block-footer--over'
    body = (
      <>
        <span className="block-footer__icon">⚠️</span>
        <span className="block-footer__text">
          <b>{fixed.name}の じかんは もう すぎてるよ</b>
        </span>
      </>
    )
  } else if (block.over) {
    cls += ' block-footer--over'
    body = (
      <>
        <span className="block-footer__icon">⚠️</span>
        <span className="block-footer__text">
          <b>{fixed.name}に まにあわないよ</b>
          <small>あと{formatSpan(Math.ceil(-free / 60_000))} たりないよ</small>
        </span>
      </>
    )
  } else if (freeMin >= 1) {
    body = (
      <>
        <span className="block-footer__icon">🕊️</span>
        <span className="block-footer__text">
          <b>じゆうじかん {formatSpan(freeMin)}</b>
          <small>
            {fixed.name}まで あと{formatSpan(freeMin)} あいてるよ
          </small>
        </span>
      </>
    )
  } else {
    cls += ' block-footer--exact'
    body = (
      <>
        <span className="block-footer__icon">✨</span>
        <span className="block-footer__text">
          <b>{fixed.name}まで ぴったり！</b>
        </span>
      </>
    )
  }
  return (
    <div ref={setNodeRef} className={`${cls}${isOver ? ' block-footer--drop' : ''}`}>
      {body}
    </div>
  )
}

function FixedRow({
  item,
  startMs,
  endMs,
  past,
  onRemove,
}: {
  item: PlanItem
  startMs?: number
  endMs?: number
  /** もう過ぎた時刻（うすく表示する） */
  past?: boolean
  onRemove: (uid: string) => void
}) {
  // じこくカードは ドラッグでは動かせない（時刻順に自動で ならぶ）
  const { setNodeRef, transform, transition } = useSortable({ id: item.uid, disabled: { draggable: true } })
  const endOfDay = isEndOfDay(item)
  const moment = isMoment(item)
  return (
    <div
      ref={setNodeRef}
      className={`plan-row plan-row--fixed${past ? ' plan-row--past' : ''}`}
      style={{ background: item.color, transform: CSS.Transform.toString(transform), transition }}
    >
      <span className="plan-row__pin" aria-hidden>
        📌
      </span>
      <span className="plan-row__emoji" aria-hidden>
        {item.emoji}
      </span>
      <span className="plan-row__text">
        <span className="plan-row__name">
          {item.name}
          {item.quiet && (
            <span className="quiet-mark" title="しずか（おしらせを しないよ）" aria-label="しずか">
              🔕
            </span>
          )}
        </span>
        <span className="plan-row__start">
          {startMs != null && formatClockAp(new Date(startMs))}
          {endOfDay ? ' から（1日の おわり）' : moment ? '' : endMs != null ? `〜${formatClockAp(new Date(endMs))}` : ''}
          {past && ' （すぎたよ）'}
        </span>
      </span>
      {!endOfDay && !moment && <span className="fixed-len">{formatSpan(item.minutes)}</span>}
      <button
        type="button"
        className="remove-btn"
        aria-label={`${item.name} をけす`}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => onRemove(item.uid)}
      >
        ✕
      </button>
    </div>
  )
}

function PlanRow({
  item,
  startMs,
  faded,
  late,
  onMinutes,
  onRemove,
}: {
  item: PlanItem
  startMs?: number
  /** もう過ぎたブロックのカード（うすく表示） */
  faded?: boolean
  late?: boolean
  onMinutes: (uid: string, delta: number) => void
  onRemove: (uid: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.uid })
  return (
    <div
      ref={setNodeRef}
      className={`plan-row${isDragging ? ' plan-row--ghost' : ''}${late ? ' plan-row--late' : ''}${faded ? ' plan-row--past' : ''}`}
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
        {startMs != null && <span className="plan-row__start">{formatClock(new Date(startMs))}から</span>}
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

function CardFace({
  emoji,
  name,
  color,
  sub,
  overlay,
  fixed,
}: {
  emoji: string
  name: string
  color: string
  sub?: string
  overlay?: boolean
  fixed?: boolean
}) {
  return (
    <div className={`card${overlay ? ' card--overlay' : ''}${fixed ? ' card--fixed' : ''}`} style={{ background: color }}>
      {fixed && <span className="card__pin">📌</span>}
      <span className="card__emoji">{emoji}</span>
      <span className="card__name">{name}</span>
      {sub && <span className="card__sub">{sub}</span>}
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

function FixedPaletteCard({ card, used, onAdd }: { card: FixedCard; used: boolean; onAdd: (c: FixedCard) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `fixed:${card.id}`, disabled: used })
  const endOfDay = card.endOfDay ?? card.minutes === 0
  const t = formatMinOfDayAp(card.startMin)
  const sub = endOfDay ? `${t}から` : card.minutes === 0 ? t : `${t}〜`
  return (
    <button
      ref={setNodeRef}
      type="button"
      className={`card-btn${isDragging ? ' card-btn--ghost' : ''}${used ? ' card-btn--used' : ''}`}
      onClick={() => onAdd(card)}
      aria-label={`${card.name} ${sub}${used ? ' （もう ならべたよ）' : ''}`}
      {...attributes}
      {...listeners}
    >
      <CardFace emoji={card.emoji} name={card.name} color={card.color} sub={used ? '✓ ならんでるよ' : sub} fixed />
    </button>
  )
}

function Palette({
  cards,
  fixedCards,
  items,
  dragging,
  onAdd,
  onAddFixed,
  onCreateCard,
}: {
  cards: CardDef[]
  fixedCards: FixedCard[]
  items: PlanItem[]
  dragging: Dragging
  onAdd: (c: CardDef) => void
  onAddFixed: (c: FixedCard) => void
  onCreateCard: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: PALETTE_ZONE })
  const deleting = dragging?.kind === 'item'
  const sortedFixed = [...fixedCards].sort((a, b) => a.startMin - b.startMin)
  return (
    <section
      ref={setNodeRef}
      className={`palette${deleting ? ' palette--delete' : ''}${deleting && isOver ? ' palette--over' : ''}`}
      aria-label="やることカード"
    >
      {deleting ? (
        <div className="palette__trash">
          <span>🗑️</span>
          ここに おとすと けせるよ
        </div>
      ) : (
        <>
          <h2 className="palette__title">やること</h2>
          <div className="palette__grid">
            {cards.filter((c) => c.group !== 'morning').map((c) => (
              <PaletteCard key={c.id} card={c} onAdd={onAdd} />
            ))}
            <button type="button" className="card-btn" onClick={onCreateCard}>
              <div className="card card--new">
                <span className="card__emoji">＋</span>
                <span className="card__name">じぶんで<br />つくる</span>
              </div>
            </button>
          </div>
          {cards.some((c) => c.group === 'morning') && (
            <>
              <h2 className="palette__title palette__title--fixed">☀️ あさの カード</h2>
              <div className="palette__grid">
                {cards.filter((c) => c.group === 'morning').map((c) => (
                  <PaletteCard key={c.id} card={c} onAdd={onAdd} />
                ))}
              </div>
            </>
          )}
          {sortedFixed.length > 0 && (
            <>
              <h2 className="palette__title palette__title--fixed">📌 じこくカード</h2>
              <div className="palette__grid">
                {sortedFixed.map((c) => (
                  <FixedPaletteCard key={c.id} card={c} used={items.some((i) => isFixed(i) && i.cardId === c.id)} onAdd={onAddFixed} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </section>
  )
}

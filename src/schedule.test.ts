import { describe, expect, it } from 'vitest'
import { buildTimeline, insertAtBlockEnd, insertFixed, insertNormalSmart, runSectors, sortFixedSlots, syncFixed, timelineSectors } from './schedule'
import { startRun, rateCard, tick } from './runner'
import type { FixedCard, PlanItem } from './types'

const MIN = 60_000
const DAY = new Date(2026, 9, 2).getTime()
const at = (h: number, m = 0) => DAY + (h * 60 + m) * MIN

const normal = (name: string, minutes: number): PlanItem => ({ uid: name, cardId: name, name, emoji: '', color: '#ccc', minutes })
const fixed = (name: string, h: number, m: number, minutes: number): PlanItem => ({
  uid: name, cardId: name, name, emoji: '', color: '#999', minutes, kind: 'fixed', startMin: h * 60 + m,
})
const dinner = fixed('ゆうごはん', 18, 30, 30)
const bath = fixed('おふろ', 19, 30, 30)
const bed = fixed('ねる', 21, 0, 0)

describe('buildTimeline（あいだのブロック）', () => {
  it('じこくカードにはさまれたブロックに、カードを積む。あまりは じゆうじかん', () => {
    const tl = buildTimeline([normal('a', 15), normal('b', 10), dinner, normal('c', 20), bath, bed], at(18, 0), DAY)
    expect(tl.blocks).toHaveLength(4)
    const [b0, b1, b2, b3] = tl.blocks
    expect(b0.rows.map((r) => r.item.name)).toEqual(['a', 'b'])
    expect(tl.rows.get('a')).toMatchObject({ startMs: at(18, 0), endMs: at(18, 15) })
    expect(tl.rows.get('b')).toMatchObject({ startMs: at(18, 15), endMs: at(18, 25) })
    expect(b0.freeMs).toBe(5 * MIN)
    expect(b0.over).toBe(false)
    expect(b0.fixed?.name).toBe('ゆうごはん')
    // ゆうごはん 18:30-19:00 のあと 19:00 から c
    expect(tl.rows.get('c')).toMatchObject({ startMs: at(19, 0), endMs: at(19, 20) })
    expect(b1.freeMs).toBe(10 * MIN) // 19:20 → おふろ 19:30
    expect(b2.rows).toEqual([]) // おふろ(19:30-20:00) と ねる(21:00) のあいだは ぜんぶ じゆうじかん
    expect(b2.freeMs).toBe(60 * MIN)
    expect(b3.limitMs).toBeNull()
    expect(b3.pastEnd).toBe(true)
    expect(tl.endMs).toBe(at(21, 0))
  })

  it('入りきらないときは over（マイナスの のこり）', () => {
    const tl = buildTimeline([normal('a', 40), dinner], at(18, 0), DAY)
    expect(tl.blocks[0].over).toBe(true)
    expect(tl.blocks[0].freeMs).toBe(-10 * MIN)
  })

  it('じこくカードの時刻が スタートより前（もう過ぎたブロック）は past。警告は出さない', () => {
    const tl = buildTimeline([dinner], at(19, 0), DAY)
    expect(tl.blocks[0].past).toBe(true)
    expect(tl.blocks[0].passed).toBe(false)
    expect(tl.blocks[0].over).toBe(false)
    const tl3 = buildTimeline([normal('x', 60), dinner], at(19, 0), DAY)
    expect(tl3.blocks[0].past).toBe(true)
    expect(tl3.blocks[0].over).toBe(false)
    expect(tl3.rows.get('x')?.past).toBe(true)
    // ブロックのあとは、スタートより前にならない
    const tl2 = buildTimeline([dinner, normal('a', 10)], at(19, 30), DAY)
    expect(tl2.rows.get('a')?.startMs).toBe(at(19, 30))
  })

  it('じこくカードがなければ、ひとつのかぎりないブロック', () => {
    const tl = buildTimeline([normal('a', 10), normal('b', 5)], at(16, 0), DAY)
    expect(tl.blocks).toHaveLength(1)
    expect(tl.blocks[0].freeMs).toBeNull()
    expect(tl.blocks[0].limitMs).toBeNull()
    expect(tl.endMs).toBe(at(16, 15))
  })

  it('ぴったりは over ではない', () => {
    const tl = buildTimeline([normal('a', 30), dinner], at(18, 0), DAY)
    expect(tl.blocks[0].freeMs).toBe(0)
    expect(tl.blocks[0].over).toBe(false)
  })
})

describe('列の操作', () => {
  it('insertFixed: 時刻が つぎに遅いじこくカードの まえに入る（いままでのカードは、そのまえのブロックに残る）', () => {
    let items: PlanItem[] = [normal('a', 10), normal('b', 10), bath]
    items = insertFixed(items, dinner)
    expect(items.map((i) => i.name)).toEqual(['a', 'b', 'ゆうごはん', 'おふろ'])
    items = insertFixed(items, bed)
    expect(items.map((i) => i.name)).toEqual(['a', 'b', 'ゆうごはん', 'おふろ', 'ねる'])
    expect(insertFixed([normal('a', 5)], dinner).map((i) => i.name)).toEqual(['a', 'ゆうごはん'])
  })

  it('sortFixedSlots: じこくカードだけ時刻順に。ふつうのカードの場所は そのまま', () => {
    const items = [normal('a', 5), bath, normal('b', 5), dinner]
    expect(sortFixedSlots(items).map((i) => i.name)).toEqual(['a', 'ゆうごはん', 'b', 'おふろ'])
    const ok = [normal('a', 5), dinner, bath]
    expect(sortFixedSlots(ok)).toBe(ok)
  })

  it('syncFixed: 名前・絵・しずか などは設定にそろう。時刻・長さは、そのまま。けしたカードは外れる', () => {
    const cards: FixedCard[] = [
      { id: 'ゆうごはん', name: 'ばんごはん', emoji: '🍚', color: '#111', startMin: 20 * 60, minutes: 40, quiet: true },
      { id: 'おふろ', name: 'おふろ', emoji: '', color: '#999', startMin: 19 * 60 + 30, minutes: 30, leaving: true },
    ]
    const items = [normal('a', 5), dinner, bath, bed]
    const out = syncFixed(items, cards)
    expect(out.map((i) => i.name)).toEqual(['a', 'ばんごはん', 'おふろ']) // ねる は けされた
    expect(out[1]).toMatchObject({ emoji: '🍚', color: '#111', quiet: true, startMin: 18 * 60 + 30, minutes: 30 }) // 時刻は そのまま
    expect(out[2]).toMatchObject({ leaving: true, quiet: false })
    // 変化がなければ同じ配列を返す
    const same = syncFixed(out, cards)
    expect(syncFixed(same, cards)).toBe(same)
  })

  it('insertNormalSmart: 入りきる いちばん早いブロックに入る。どこも入らなければ いちばん早いブロック', () => {
    const items = [normal('a', 25), dinner, bath]
    // 18:00 から。ブロック0 は のこり5分、ブロック1(19:00-19:30)は30分あいている
    const withB = insertNormalSmart(items, normal('b', 20), at(18, 0), DAY)
    expect(withB.map((i) => i.name)).toEqual(['a', 'ゆうごはん', 'b', 'おふろ'])
    const small = insertNormalSmart(items, normal('c', 5), at(18, 0), DAY)
    expect(small.map((i) => i.name)).toEqual(['a', 'c', 'ゆうごはん', 'おふろ'])
    // じこくカードのあいだが ぜんぶ いっぱいなら、かぎりのない さいごのブロックへ（赤くならない）
    const none = insertNormalSmart([normal('a', 25), dinner], normal('z', 200), at(18, 0), DAY)
    expect(none.map((i) => i.name)).toEqual(['a', 'ゆうごはん', 'z'])
    // かぎりのあるブロックしかなく、どこにも入らない → いちばん早いブロック（赤くなる）
    const red = insertNormalSmart([normal('a', 25), dinner, bed], normal('z', 200), at(18, 0), DAY)
    expect(red.map((i) => i.name)).toEqual(['a', 'z', 'ゆうごはん', 'ねる'])
    // じこくカードなし → さいごに足す
    expect(insertNormalSmart([normal('a', 5)], normal('b', 5), at(16), DAY).map((i) => i.name)).toEqual(['a', 'b'])
  })

  it('insertNormalSmart: ねる のあとのブロックには入れない', () => {
    const out = insertNormalSmart([bed], normal('x', 10), at(20, 0), DAY)
    expect(out.map((i) => i.name)).toEqual(['x', 'ねる'])
  })

  it('insertAtBlockEnd', () => {
    const items = [normal('a', 5), dinner, normal('b', 5), bath]
    expect(insertAtBlockEnd(items, normal('n', 1), 'おふろ').map((i) => i.name)).toEqual(['a', 'ゆうごはん', 'b', 'n', 'おふろ'])
    expect(insertAtBlockEnd(items, normal('n', 1), null).map((i) => i.name)).toEqual(['a', 'ゆうごはん', 'b', 'おふろ', 'n'])
  })
})

describe('時計の扇形', () => {
  it('よてい: カード・じこくカード・あまりの じゆうじかん', () => {
    const tl = buildTimeline([normal('a', 15), dinner], at(18, 0), DAY)
    const s = timelineSectors(tl, at(18, 0))
    expect(s.map((x) => [x.kind, x.startMs, x.endMs])).toEqual([
      ['card', at(18, 0), at(18, 15)],
      ['free', at(18, 15), at(18, 30)],
      ['fixed', at(18, 30), at(19, 0)],
    ])
  })

  it('じっこう中: いまのカードを強調。のこりの予定がつづく', () => {
    const run = startRun([normal('a', 15), dinner], at(18, 0)).run
    const s = runSectors(run, at(18, 5))
    expect(s[0]).toMatchObject({ kind: 'card', active: true, startMs: at(18, 0), endMs: at(18, 15) })
    expect(s.map((x) => x.kind)).toEqual(['card', 'free', 'fixed'])
    expect(s.filter((x) => x.active)).toHaveLength(1)
  })

  it('じっこう中: じゆうじかん・じこくカードの最中も強調される', () => {
    const t = tick(startRun([normal('a', 5), dinner], at(18, 0)).run, at(18, 5))
    const free = rateCard(t.run, 'good', at(18, 6)).run
    expect(free.phase).toBe('free')
    const s = runSectors(free, at(18, 10))
    expect(s.find((x) => x.active)).toMatchObject({ kind: 'free', endMs: at(18, 30) })
    const fx = tick(free, at(18, 30)).run
    expect(runSectors(fx, at(18, 40)).find((x) => x.active)).toMatchObject({ kind: 'fixed', startMs: at(18, 30), endMs: at(19, 0) })
  })
})

// 「まいにち かわる（ランダム）」: 日づけから、その日のキャラを決める。
// 同じ日は ずっと同じキャラ。つぎの日は かならず ちがうキャラ。5日で5人ぜんいんが ひとまわり。
import { CHARACTER_IDS, type CharacterId } from './phrases'

const DAY_MS = 86_400_000

/** "YYYY-MM-DD" → 1970-01-01 からの日数 */
export function dayNumber(key: string): number {
  const [y, m, d] = key.split('-').map(Number)
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS)
}

/** 小さな乱数（同じ種なら、いつも同じ並び） */
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 5日ぶんの ならび（ブロックごとに、ぜんぶのキャラを一度ずつ） */
function rawBlock(block: number): CharacterId[] {
  const rand = mulberry32(Math.imul(block, 2654435761) + 12345)
  const ids = [...CHARACTER_IDS]
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
  }
  return ids
}

function blockOrder(block: number): CharacterId[] {
  const ids = rawBlock(block)
  // まえのブロックの さいごと、このブロックの はじめが同じキャラにならないよう、はじめの2つを入れかえる
  const prevLast = rawBlock(block - 1)[CHARACTER_IDS.length - 1]
  if (ids[0] === prevLast) [ids[0], ids[1]] = [ids[1], ids[0]]
  return ids
}

export function characterOfDay(key: string): CharacterId {
  const n = dayNumber(key)
  const n5 = CHARACTER_IDS.length
  const block = Math.floor(n / n5)
  return blockOrder(block)[((n % n5) + n5) % n5]
}

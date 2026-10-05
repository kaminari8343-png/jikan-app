// dnd-kit のセンサー（ドラッグの はじまりを見はる部品）
// 入力欄（input / textarea / select）や、それを かこむ label、data-no-drag をつけた場所では、
// ドラッグを はじめない。さわったときの イベントも 止めない（preventDefault しない）。
// → カードや列の中に、あとから入力欄を置いても、iOS でキーボードが出なくなったりしない。
import { MouseSensor, TouchSensor } from '@dnd-kit/core'

/** ドラッグを はじめては いけない場所 */
export const NO_DRAG_SELECTOR = 'input, textarea, select, option, label, [contenteditable]:not([contenteditable="false"]), [data-no-drag]'

export function isInteractiveTarget(target: EventTarget | null): boolean {
  return typeof Element !== 'undefined' && target instanceof Element && target.closest(NO_DRAG_SELECTOR) !== null
}

type Handler<E> = (event: { nativeEvent: E }, options: { onActivation?: (arg: { event: E }) => void }) => boolean

/** 「≡」のつまみ（ここからは、長押しなしで すぐドラッグできる） */
export const HANDLE_SELECTOR = '[data-drag-handle]'
const inHandle = (t: EventTarget | null) => t instanceof Element && t.closest(HANDLE_SELECTOR) !== null

const guard =
  <E extends Event>(handler: Handler<E>, only?: 'handle' | 'body'): Handler<E> =>
  (event, options) => {
    const t = event.nativeEvent.target
    if (isInteractiveTarget(t)) return false
    if (only === 'handle' && !inHandle(t)) return false
    if (only === 'body' && inHandle(t)) return false
    return handler(event, options)
  }

export class SafeMouseSensor extends MouseSensor {
  static activators = MouseSensor.activators.map((a) => ({
    ...a,
    handler: guard(a.handler as unknown as Handler<MouseEvent>),
  })) as typeof MouseSensor.activators
}

export class SafeTouchSensor extends TouchSensor {
  static activators = TouchSensor.activators.map((a) => ({
    ...a,
    handler: guard(a.handler as unknown as Handler<TouchEvent>, 'body'),
  })) as typeof TouchSensor.activators
}

/** つまみ専用: さわったら すぐ はじまる（ほんの少し動いたら） */
export class HandleTouchSensor extends TouchSensor {
  static activators = TouchSensor.activators.map((a) => ({
    ...a,
    handler: guard(a.handler as unknown as Handler<TouchEvent>, 'handle'),
  })) as typeof TouchSensor.activators
}

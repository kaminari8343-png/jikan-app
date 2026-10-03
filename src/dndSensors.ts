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

const guard =
  <E extends Event>(handler: Handler<E>): Handler<E> =>
  (event, options) =>
    isInteractiveTarget(event.nativeEvent.target) ? false : handler(event, options)

export class SafeMouseSensor extends MouseSensor {
  static activators = MouseSensor.activators.map((a) => ({
    ...a,
    handler: guard(a.handler as unknown as Handler<MouseEvent>),
  })) as typeof MouseSensor.activators
}

export class SafeTouchSensor extends TouchSensor {
  static activators = TouchSensor.activators.map((a) => ({
    ...a,
    handler: guard(a.handler as unknown as Handler<TouchEvent>),
  })) as typeof TouchSensor.activators
}

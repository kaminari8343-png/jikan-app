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
  <E extends Event>(handler: Handler<E>): Handler<E> =>
  (event, options) => {
    const t = event.nativeEvent.target
    if (isInteractiveTarget(t)) return false
    return handler(event, options)
  }

export class SafeMouseSensor extends MouseSensor {
  static activators = MouseSensor.activators.map((a) => ({
    ...a,
    handler: guard(a.handler as unknown as Handler<MouseEvent>),
  })) as typeof MouseSensor.activators
}

/** さわった場所で はじまりかたを かえる: つまみ(≡)は すこし動いたら すぐ、それ以外（やることカード）は 長押し */
export function touchConstraintFor(target: EventTarget | null, base: TouchConstraint): TouchConstraint {
  return inHandle(target) ? { distance: 3 } : base
}
type TouchConstraint = { delay: number; tolerance: number } | { distance: number }

// 注意: dnd-kit は、同じイベント(touchstart)を見る センサーが2つあると、あとの1つだけが 効く。
// なので タッチ用のセンサーは 1つだけにして、中で つまみ／本体を 見わける。
export class SafeTouchSensor extends TouchSensor {
  static activators = TouchSensor.activators.map((a) => ({
    ...a,
    handler: guard(a.handler as unknown as Handler<TouchEvent>),
  })) as typeof TouchSensor.activators

  constructor(props: ConstructorParameters<typeof TouchSensor>[0]) {
    const base = (props.options.activationConstraint as TouchConstraint | undefined) ?? { delay: 180, tolerance: 8 }
    super({
      ...props,
      options: { ...props.options, activationConstraint: touchConstraintFor(props.event.target, base) },
    })
  }
}

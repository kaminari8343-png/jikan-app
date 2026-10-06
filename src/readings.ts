/**
 * 読み変換: カードの名前 → 読みかた（ひらがな）。
 * 読み上げのとき、{name} {next} {fixed} は、ここに登録した読みかたに置きかえてから話します。
 * 画面の表示は そのまま（カタカナ）。読み間違いがあったら、ここに足すだけで直せます。
 * （英字の名前でも 読めるよう、別名も登録できます。大文字・小文字は くべつしません）
 */
export const READINGS: Record<string, string> = {
  ネットフリックス: 'ねっとふりっくす',
  ユーネクスト: 'ゆーねくすと',
  テレビ: 'てれび',
  ユーチューブ: 'ゆーちゅーぶ',
  けいさんカード: 'けいさんかーど',
  'ひらがな・カタカナ': 'ひらがなかたかな',
  // 英字で つくったカードの名前（別名）
  Netflix: 'ねっとふりっくす',
  'U-NEXT': 'ゆーねくすと',
  TV: 'てれび',
  YouTube: 'ゆーちゅーぶ',
}

const normalize = (s: string) => s.normalize('NFKC').trim().toLowerCase()

const TABLE = new Map(Object.entries(READINGS).map(([k, v]) => [normalize(k), v]))

/** 読み上げ用の名前。登録があれば その読みかた、なければ そのまま */
export function readingOf(name: string): string {
  return TABLE.get(normalize(name)) ?? name
}

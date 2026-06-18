// 伝票の時刻表示まわりのユーティリティ

/**
 * サーバから届く日時を Date に正規化する。
 * SQLite の CURRENT_TIMESTAMP は "YYYY-MM-DD HH:MM:SS"（UTC・タイムゾーン無し）で
 * 届くため、そのまま new Date() するとローカル時刻と解釈されて経過時間がズレる。
 * その形式のときは UTC として補正する。
 */
export function parseDate(value?: string | Date | null): Date | null {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  let s = String(value);
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) {
    s = s.replace(' ', 'T') + 'Z';
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/** 経過時間を「たった今 / 5分 / 1時間20分」のような短い表記にする。 */
export function formatElapsed(from: Date | null, now: number): string {
  if (!from) return '';
  const diff = now - from.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'たった今';
  if (min < 60) return `${min}分`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}時間` : `${h}時間${m}分`;
}

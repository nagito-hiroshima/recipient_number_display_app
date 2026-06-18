import crypto from 'crypto';

/**
 * Square 連携ユーティリティ
 *
 * 必要な環境変数:
 * - SQUARE_ACCESS_TOKEN          : Square API アクセストークン
 * - SQUARE_WEBHOOK_SIGNATURE_KEY : Webhook 署名キー（署名検証に使用）
 * - SQUARE_WEBHOOK_URL           : Square に登録した通知先URL（署名検証に使用、完全一致が必要）
 * - SQUARE_ENV                   : 'sandbox' | 'production'（既定: production）
 */

const SQUARE_ENV = (process.env.SQUARE_ENV || 'production').toLowerCase();
const SQUARE_API_BASE =
  SQUARE_ENV === 'sandbox'
    ? 'https://connect.squareupsandbox.com'
    : 'https://connect.squareup.com';

// Square API バージョン（Orders API 取得時に送信）
const SQUARE_API_VERSION = '2024-12-18';

/**
 * Square Webhook の署名を検証する。
 *
 * Square は `x-square-hmacsha256-signature` ヘッダーに
 * HMAC-SHA256( notificationUrl + rawBody ) を Base64 エンコードした値を送る。
 *
 * @param signature        リクエストヘッダーの署名
 * @param rawBody          リクエストボディの生バイト列（パース前）
 * @param notificationUrl  Square に登録した通知先URL
 * @param signatureKey     Webhook 署名キー
 */
export function verifySquareSignature(
  signature: string | undefined,
  rawBody: Buffer | string,
  notificationUrl: string,
  signatureKey: string
): boolean {
  if (!signature) return false;

  const body = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
  const hmac = crypto.createHmac('sha256', signatureKey);
  hmac.update(notificationUrl + body);
  const expected = hmac.digest('base64');

  // タイミング攻撃を避けるため timingSafeEqual で比較
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export interface SquareOrder {
  id: string;
  ticket_name?: string;
  [key: string]: any;
}

/**
 * Square Orders API から注文を取得する。
 */
export async function retrieveOrder(orderId: string): Promise<SquareOrder | null> {
  const accessToken = process.env.SQUARE_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error('SQUARE_ACCESS_TOKEN is not set');
  }

  const res = await fetch(`${SQUARE_API_BASE}/v2/orders/${orderId}`, {
    method: 'GET',
    headers: {
      'Square-Version': SQUARE_API_VERSION,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Square RetrieveOrder failed (${res.status}): ${text}`);
  }

  const json = (await res.json()) as { order?: SquareOrder };
  return json.order ?? null;
}

/**
 * 注文から伝票番号（表示用ID）を決定する。
 * - ticket_name があればそれを使う（＝オーダー番号）
 * - 無ければレシート番号を使う（＝注文番号 / Square上の「レシート番号」例: 5mnj）
 * - レシート番号も無ければ注文IDの末尾6文字をフォールバックに使う
 *
 * @param receiptNumber Square Payment の receipt_number（レシート番号）
 */
export function resolveTicketNumber(order: SquareOrder, receiptNumber?: string): string {
  if (order.ticket_name && order.ticket_name.trim()) {
    // オーダー番号
    return order.ticket_name.trim();
  }

  // 注文番号: Square のレシート番号
  if (receiptNumber && receiptNumber.trim()) {
    return receiptNumber.trim();
  }

  // フォールバック: 注文IDの末尾6文字
  return order.id.slice(-6);
}

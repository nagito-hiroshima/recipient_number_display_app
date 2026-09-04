// Server types shared with client
export interface Ticket {
  id: string;
  status: 'preparing' | 'calling' | 'completed';
  createdAt: Date;
  calledAt?: Date;
  completedAt?: Date;
  // スマホ（オンライン注文）から発行された伝票か（billing_address があるオーダー）
  fromMobile?: boolean;
  // 動作確認用のデモ伝票か
  demo?: boolean;
}

export interface WebSocketMessage {
  type:
    | 'ticket:created'
    | 'ticket:updated'
    | 'ticket:recalled'
    | 'ticket:deleted'
    | 'init';
  data: Ticket | Ticket[];
  // ticket:updated を通常呼び出しと再呼び出しで共通利用しつつ、
  // 表示側で読み上げ文言だけ判別するための一時フラグ。
  recall?: boolean;
}

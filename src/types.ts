// Server types shared with client
export interface Ticket {
  id: string;
  status: 'preparing' | 'calling' | 'completed';
  createdAt: Date;
  calledAt?: Date;
  completedAt?: Date;
  // スマホ（オンライン注文）から発行された伝票か（billing_address があるオーダー）
  fromMobile?: boolean;
}

export interface WebSocketMessage {
  type: 'ticket:created' | 'ticket:updated' | 'ticket:deleted' | 'init';
  data: Ticket | Ticket[];
}

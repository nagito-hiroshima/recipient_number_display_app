// Server types shared with client
export interface Ticket {
  id: string;
  status: 'preparing' | 'calling' | 'completed';
  createdAt: Date;
  calledAt?: Date;
  completedAt?: Date;
}

export interface WebSocketMessage {
  type: 'ticket:created' | 'ticket:updated' | 'ticket:deleted' | 'init';
  data: Ticket | Ticket[];
}

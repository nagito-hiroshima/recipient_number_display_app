import React from 'react';
import { Ticket } from './types';

interface TicketDisplayProps {
  tickets: Ticket[];
  status: 'preparing' | 'calling';
  onStatusChange: (ticketId: string, newStatus: 'preparing' | 'calling' | 'completed') => Promise<void>;
  isLoading: boolean;
}

export const TicketDisplay: React.FC<TicketDisplayProps> = ({
  tickets,
  status,
  onStatusChange,
  isLoading,
}) => {
  const filteredTickets = tickets.filter((t) => t.status === status);
  const title = status === 'preparing' ? '作成中' : 'お呼び出し中';

  const handleClick = async (ticketId: string) => {
    const nextStatus =
      status === 'preparing' ? ('calling' as const) : ('completed' as const);
    try {
      await onStatusChange(ticketId, nextStatus);
    } catch (err) {
      console.error('Error updating ticket status:', err);
    }
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>{title}</h2>
      <div style={styles.ticketGrid}>
        {filteredTickets.length === 0 ? (
          <div style={styles.emptyMessage}>
            {title}の伝票はありません
          </div>
        ) : (
          filteredTickets.map((ticket) => (
            <div
              key={ticket.id}
              style={{
                ...styles.ticketCard,
                backgroundColor: status === 'preparing' ? '#2196f3' : '#f50057',
                opacity: isLoading ? 0.6 : 1,
              }}
              onClick={() => !isLoading && handleClick(ticket.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && !isLoading) {
                  handleClick(ticket.id);
                }
              }}
            >
              <div style={styles.ticketNumber}>{ticket.id}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    flex: 1,
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
  },
  title: {
    margin: '0 0 20px 0',
    fontSize: '28px',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  ticketGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '15px',
    flex: 1,
    maxHeight: '100%',
  },
  ticketCard: {
    padding: '24px 32px',
    borderRadius: '12px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    border: '2px solid transparent',
    maxHeight: '120px',
    maxWidth: '300px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  ticketNumber: {
    fontSize: '60px',
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: '8px',
    letterSpacing: '4px',
  },
  emptyMessage: {
    textAlign: 'center',
    padding: '60px 20px',
    color: '#999',
    fontSize: '18px',
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
};

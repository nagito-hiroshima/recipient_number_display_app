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
  const isCalling = status === 'calling';
  const title = isCalling ? 'お呼び出し中' : '作成中';
  const hint = isCalling ? 'タップで「完了」' : 'タップで「お呼び出し」';

  const handleClick = async (ticketId: string) => {
    const nextStatus = isCalling ? ('completed' as const) : ('calling' as const);
    try {
      await onStatusChange(ticketId, nextStatus);
    } catch (err) {
      console.error('Error updating ticket status:', err);
    }
  };

  return (
    <section
      style={{
        ...styles.container,
        ...(isCalling ? styles.containerCalling : styles.containerPreparing),
      }}
    >
      <div style={styles.panelHeader}>
        <div style={styles.panelTitleWrap}>
          <span
            style={{
              ...styles.accentBar,
              background: isCalling ? 'var(--calling-to)' : 'var(--primary)',
            }}
          />
          <h2 style={styles.title}>{title}</h2>
        </div>
        <span
          style={{
            ...styles.countBadge,
            color: isCalling ? 'var(--calling-to)' : 'var(--primary)',
          }}
        >
          {filteredTickets.length}
        </span>
      </div>

      <p style={styles.hint}>{hint}</p>

      <div className="scroll-area" style={styles.ticketGrid}>
        {filteredTickets.length === 0 ? (
          <div style={styles.emptyMessage}>
            <span style={styles.emptyIcon}>{isCalling ? '🔔' : '🕒'}</span>
            <span>{title}の番号はありません</span>
          </div>
        ) : (
          filteredTickets.map((ticket) => {
            const gradient = isCalling
              ? ticket.fromMobile
                ? 'linear-gradient(135deg, var(--calling-mobile-from), var(--calling-mobile-to))'
                : 'linear-gradient(135deg, var(--calling-from), var(--calling-to))'
              : ticket.fromMobile
                ? 'linear-gradient(135deg, var(--preparing-mobile-from), var(--preparing-mobile-to))'
                : 'linear-gradient(135deg, var(--preparing-from), var(--preparing-to))';

            return (
              <div
                key={ticket.id}
                className={`ticket-card${isCalling ? ' ticket-card--calling' : ''}`}
                style={{
                  ...styles.ticketCard,
                  backgroundImage: gradient,
                  opacity: isLoading ? 0.6 : 1,
                  pointerEvents: isLoading ? 'none' : 'auto',
                }}
                onClick={() => !isLoading && handleClick(ticket.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ' ') && !isLoading) {
                    e.preventDefault();
                    handleClick(ticket.id);
                  }
                }}
              >
                {ticket.fromMobile && (
                  <div style={styles.mobileBadge}>📱 スマホ注文</div>
                )}
                <div style={styles.ticketNumber}>{ticket.id}</div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    flex: 1,
    minWidth: 0,
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'var(--surface)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-md)',
    border: '1px solid var(--border)',
  },
  containerPreparing: {
    borderTop: '5px solid var(--primary)',
  },
  containerCalling: {
    borderTop: '5px solid var(--calling-to)',
  },
  panelHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '4px',
  },
  panelTitleWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  accentBar: {
    width: '6px',
    height: '28px',
    borderRadius: '3px',
  },
  title: {
    margin: 0,
    fontSize: '26px',
    fontWeight: 800,
    letterSpacing: '0.02em',
    color: 'var(--text)',
  },
  countBadge: {
    fontSize: '28px',
    fontWeight: 800,
    backgroundColor: 'var(--surface-muted)',
    minWidth: '48px',
    textAlign: 'center',
    padding: '2px 14px',
    borderRadius: '999px',
    border: '1px solid var(--border)',
  },
  hint: {
    margin: '0 0 16px 18px',
    fontSize: '13px',
    color: 'var(--text-muted)',
  },
  ticketGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
    gridAutoRows: 'min-content',
    gap: '16px',
    flex: 1,
    overflowY: 'auto',
    paddingRight: '4px',
    alignContent: 'start',
  },
  ticketCard: {
    aspectRatio: '3 / 2',
    borderRadius: 'var(--radius-md)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    cursor: 'pointer',
    transition: 'transform 0.18s ease, filter 0.18s ease',
    boxShadow: 'var(--shadow-md)',
    userSelect: 'none',
  },
  ticketNumber: {
    fontSize: 'clamp(40px, 6vw, 72px)',
    fontWeight: 800,
    color: '#fff',
    letterSpacing: '2px',
    lineHeight: 1,
    fontVariantNumeric: 'tabular-nums',
    textShadow: '0 2px 6px rgba(0,0,0,0.18)',
  },
  mobileBadge: {
    fontSize: '12px',
    fontWeight: 700,
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.22)',
    padding: '3px 10px',
    borderRadius: '999px',
    marginBottom: '8px',
  },
  emptyMessage: {
    gridColumn: '1 / -1',
    textAlign: 'center',
    padding: '60px 20px',
    color: 'var(--text-muted)',
    fontSize: '18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIcon: {
    fontSize: '40px',
    opacity: 0.6,
  },
};

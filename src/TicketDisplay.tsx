import React, { useRef } from 'react';
import { Ticket } from './types';
import { parseDate, formatElapsed } from './time';

interface TicketDisplayProps {
  tickets: Ticket[];
  status: 'preparing' | 'calling';
  onStatusChange: (ticketId: string, newStatus: 'preparing' | 'calling' | 'completed') => Promise<void>;
  onLongPress: (ticket: Ticket) => void;
  isLoading: boolean;
  now: number;
}

const LONG_PRESS_MS = 500;
const MOVE_THRESHOLD_PX = 10;

export const TicketDisplay: React.FC<TicketDisplayProps> = ({
  tickets,
  status,
  onStatusChange,
  onLongPress,
  isLoading,
  now,
}) => {
  const filteredTickets = tickets.filter((t) => t.status === status);
  const isCalling = status === 'calling';
  const title = isCalling ? 'お呼び出し中' : '調理中';

  // 長押し判定用（同時に押されるのは1枚なのでコンポーネント単位で保持）
  const pressTimer = useRef<number | null>(null);
  const longPressFired = useRef(false);
  const startPos = useRef<{ x: number; y: number } | null>(null);

  const cancelPress = () => {
    if (pressTimer.current !== null) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  const handlePointerDown = (ticket: Ticket, e: React.PointerEvent) => {
    if (isLoading) return;
    longPressFired.current = false;
    startPos.current = { x: e.clientX, y: e.clientY };
    cancelPress();
    pressTimer.current = window.setTimeout(() => {
      longPressFired.current = true;
      onLongPress(ticket);
    }, LONG_PRESS_MS);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!startPos.current) return;
    const dx = Math.abs(e.clientX - startPos.current.x);
    const dy = Math.abs(e.clientY - startPos.current.y);
    if (dx > MOVE_THRESHOLD_PX || dy > MOVE_THRESHOLD_PX) cancelPress();
  };

  // タップ＝主操作。調理中→お呼び出し / お呼び出し→完了。
  // 長押しでメニューが開いた場合はタップ操作を抑制する。
  const handleClick = async (ticketId: string) => {
    if (longPressFired.current) {
      longPressFired.current = false;
      return;
    }
    if (isLoading) return;
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

      <div className="scroll-area" style={styles.ticketGrid}>
        {filteredTickets.length === 0 ? (
          <div style={styles.emptyMessage}>
            <span style={styles.emptyIcon}>{isCalling ? '🔔' : '🍳'}</span>
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

            const since = isCalling
              ? parseDate(ticket.calledAt) ?? parseDate(ticket.createdAt)
              : parseDate(ticket.createdAt);
            const elapsed = formatElapsed(since, now);

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
                onClick={() => handleClick(ticket.id)}
                onPointerDown={(e) => handlePointerDown(ticket, e)}
                onPointerMove={handlePointerMove}
                onPointerUp={cancelPress}
                onPointerLeave={cancelPress}
                onPointerCancel={cancelPress}
                onContextMenu={(e) => e.preventDefault()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ' ') && !isLoading) {
                    e.preventDefault();
                    handleClick(ticket.id);
                  }
                }}
              >
                {elapsed && (
                  <span style={styles.elapsedPill}>⏱ {elapsed}</span>
                )}
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
    marginBottom: '18px',
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
    position: 'relative',
    aspectRatio: '3 / 2',
    borderRadius: 'var(--radius-md)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '8px 12px',
    boxSizing: 'border-box',
    overflow: 'hidden',
    cursor: 'pointer',
    transition: 'transform 0.18s ease, filter 0.18s ease',
    boxShadow: 'var(--shadow-md)',
    userSelect: 'none',
    touchAction: 'manipulation',
  },
  ticketNumber: {
    fontSize: 'clamp(28px, 5vw, 64px)',
    fontWeight: 800,
    color: '#fff',
    letterSpacing: '1px',
    lineHeight: 1.05,
    maxWidth: '100%',
    textAlign: 'center',
    wordBreak: 'break-all',
    overflowWrap: 'anywhere',
    fontVariantNumeric: 'tabular-nums',
    textShadow: '0 2px 6px rgba(0,0,0,0.18)',
  },
  elapsedPill: {
    position: 'absolute',
    top: '8px',
    right: '10px',
    fontSize: '12px',
    fontWeight: 700,
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.28)',
    padding: '2px 8px',
    borderRadius: '999px',
    fontVariantNumeric: 'tabular-nums',
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

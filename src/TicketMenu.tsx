import React, { useEffect, useState } from 'react';
import { Ticket } from './types';

interface TicketMenuProps {
  ticket: Ticket;
  onMove: (ticketId: string, status: 'preparing' | 'calling') => void;
  onRecall: (ticketId: string, updateCalledAt: boolean) => void;
  onDelete: (ticketId: string) => void;
  onClose: () => void;
}

export const TicketMenu: React.FC<TicketMenuProps> = ({
  ticket,
  onMove,
  onRecall,
  onDelete,
  onClose,
}) => {
  const isCalling = ticket.status === 'calling';
  const statusLabel = isCalling ? 'お呼び出し中' : '調理中';
  const [updateCalledAt, setUpdateCalledAt] = useState(false);

  useEffect(() => {
    setUpdateCalledAt(false);
  }, [ticket.id]);

  // Esc で閉じる
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.menu} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <span style={styles.headerLabel}>{statusLabel}</span>
          <span style={styles.headerNumber}>{ticket.id}</span>
          {ticket.demo && <span style={styles.demoBadge}>DEMO</span>}
        </div>

        <div style={styles.actions}>
          {isCalling ? (
            <>
              <button
                className="kp-btn"
                style={{ ...styles.actionBtn, ...styles.recallBtn }}
                onClick={() => onRecall(ticket.id, updateCalledAt)}
              >
                🔊 再呼び出し
              </button>

              <label style={styles.checkRow}>
                <input
                  type="checkbox"
                  checked={updateCalledAt}
                  onChange={(e) => setUpdateCalledAt(e.target.checked)}
                  style={styles.checkbox}
                />
                <span>呼び出し時刻も更新する</span>
              </label>

              <button
                className="kp-btn"
                style={{ ...styles.actionBtn, ...styles.moveBtn }}
                onClick={() => onMove(ticket.id, 'preparing')}
              >
                ↩ 調理中に移動する
              </button>
            </>
          ) : (
            <button
              className="kp-btn"
              style={{ ...styles.actionBtn, ...styles.callBtn }}
              onClick={() => onMove(ticket.id, 'calling')}
            >
              🔔 呼び出し中に移動する
            </button>
          )}

          <button
            className="kp-btn"
            style={{ ...styles.actionBtn, ...styles.deleteBtn }}
            onClick={() => onDelete(ticket.id)}
          >
            🗑 削除する
          </button>
        </div>

        <button className="kp-btn" style={styles.cancelBtn} onClick={onClose}>
          キャンセル
        </button>
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    backdropFilter: 'blur(2px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    padding: '20px',
    animation: 'pop-in 0.16s ease',
  },
  menu: {
    width: '100%',
    maxWidth: '380px',
    backgroundColor: 'var(--surface)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-lg)',
    overflow: 'hidden',
    animation: 'pop-in 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    padding: '22px 20px 18px',
    background: 'var(--header-bg)',
    color: '#fff',
  },
  headerLabel: {
    fontSize: '13px',
    fontWeight: 600,
    opacity: 0.85,
    letterSpacing: '0.05em',
  },
  headerNumber: {
    fontSize: '44px',
    fontWeight: 800,
    lineHeight: 1,
    fontVariantNumeric: 'tabular-nums',
    letterSpacing: '2px',
  },
  demoBadge: {
    marginTop: '5px',
    padding: '3px 9px',
    borderRadius: '999px',
    backgroundColor: 'rgba(255,255,255,0.18)',
    border: '1px solid rgba(255,255,255,0.32)',
    fontSize: '11px',
    fontWeight: 900,
    letterSpacing: '0.12em',
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    padding: '20px',
  },
  actionBtn: {
    width: '100%',
    padding: '18px',
    fontSize: '17px',
    fontWeight: 700,
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    boxShadow: 'var(--shadow-sm)',
  },
  callBtn: {
    background: 'linear-gradient(135deg, var(--calling-from), var(--calling-to))',
  },
  recallBtn: {
    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
  },
  moveBtn: {
    background: 'linear-gradient(135deg, var(--preparing-from), var(--preparing-to))',
  },
  deleteBtn: {
    background: 'linear-gradient(135deg, #f87171, #dc2626)',
  },
  checkRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '2px 4px',
    color: 'var(--text-muted)',
    fontSize: '13px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  checkbox: {
    width: '18px',
    height: '18px',
    accentColor: 'var(--primary)',
  },
  cancelBtn: {
    width: '100%',
    padding: '16px',
    fontSize: '15px',
    fontWeight: 700,
    color: 'var(--text-muted)',
    backgroundColor: 'var(--surface-muted)',
    border: 'none',
    borderTop: '1px solid var(--border)',
    cursor: 'pointer',
  },
};

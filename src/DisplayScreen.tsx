import React, { useState } from 'react';
import { useWebSocket } from './useWebSocket';
import { TicketDisplay } from './TicketDisplay';

export const DisplayScreen: React.FC = () => {
  const { tickets, isConnected } = useWebSocket();
  const [isLoading, setIsLoading] = useState(false);

  const handleStatusChange = async (ticketId: string, newStatus: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error('Failed to update ticket');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <h1 style={styles.title}>伝票表示画面</h1>
        <div style={styles.connectionStatus}>
          <span className={`status-dot ${isConnected ? 'status-dot--on' : 'status-dot--off'}`} />
          {isConnected ? '接続中' : '再接続中...'}
        </div>
      </header>

      <div className="display-main" style={styles.mainContent}>
        <TicketDisplay
          tickets={tickets}
          status="preparing"
          onStatusChange={handleStatusChange}
          isLoading={isLoading}
        />
        <TicketDisplay
          tickets={tickets}
          status="calling"
          onStatusChange={handleStatusChange}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  app: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'var(--bg)',
  },
  header: {
    background: 'var(--header-bg)',
    color: 'white',
    padding: '16px 28px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: 'var(--shadow-md)',
    zIndex: 1,
  },
  title: {
    margin: 0,
    fontSize: '22px',
    fontWeight: 800,
    letterSpacing: '0.04em',
  },
  connectionStatus: {
    fontSize: '14px',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    color: 'rgba(255,255,255,0.9)',
  },
  mainContent: {
    flex: 1,
    display: 'flex',
    gap: '20px',
    padding: '20px',
    overflow: 'hidden',
  },
};

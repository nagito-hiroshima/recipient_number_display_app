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
          <span style={{ color: isConnected ? '#4caf50' : '#f44336' }}>
            {isConnected ? '●' : '●'} {isConnected ? '接続中' : '接続中...'}
          </span>
        </div>
      </header>

      <div style={styles.mainContent}>
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
    backgroundColor: '#fafafa',
  },
  header: {
    backgroundColor: '#2c3e50',
    color: 'white',
    padding: '15px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    margin: 0,
    fontSize: '24px',
    fontWeight: 'bold',
  },
  connectionStatus: {
    fontSize: '14px',
  },
  mainContent: {
    flex: 1,
    display: 'flex',
    gap: '20px',
    padding: '20px',
    overflow: 'hidden',
  },
};

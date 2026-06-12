import React, { useState } from 'react';
import { useWebSocket } from './useWebSocket';
import { TicketInput } from './TicketInput';

export const InputScreen: React.FC = () => {
  const { isConnected } = useWebSocket();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmitTicket = async (ticketId: string) => {
    setIsLoading(true);
    try {
      const token = import.meta.env.VITE_API_TOKEN;
      const response = await fetch('/api/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ id: ticketId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create ticket');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <h1 style={styles.title}>伝票入力画面</h1>
        <div style={styles.connectionStatus}>
          <span style={{ color: isConnected ? '#4caf50' : '#f44336' }}>
            {isConnected ? '●' : '●'} {isConnected ? '接続中' : '接続中...'}
          </span>
        </div>
      </header>

      <div style={styles.container}>
        <TicketInput onSubmit={handleSubmitTicket} isLoading={isLoading} />
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
  container: {
    flex: 1,
    padding: '40px 20px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
};
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWebSocket } from './useWebSocket';
import { TicketInput } from './TicketInput';

const API_KEY_STORAGE_KEY = 'apiToken';

export const InputScreen: React.FC = () => {
  const navigate = useNavigate();
  const { isConnected } = useWebSocket();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmitTicket = async (ticketId: string) => {
    const apiKey = localStorage.getItem(API_KEY_STORAGE_KEY)?.trim() || '';
    if (!apiKey) {
      throw new Error('APIキーが未登録です。伝票表示画面（/）からAPIキーを登録してください');
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
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
        <div style={styles.headerActions}>
          <button
            type="button"
            style={styles.navButton}
            onClick={() => navigate('/')}
          >
            伝票表示へ
          </button>
          <div style={styles.connectionStatus}>
            <span className={`status-dot ${isConnected ? 'status-dot--on' : 'status-dot--off'}`} />
            {isConnected ? '接続中' : '再接続中...'}
          </div>
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
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
  },
  navButton: {
    border: '1px solid rgba(255,255,255,0.35)',
    background: 'rgba(255,255,255,0.12)',
    color: '#fff',
    borderRadius: '10px',
    padding: '9px 14px',
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  connectionStatus: {
    fontSize: '14px',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    color: 'rgba(255,255,255,0.9)',
  },
  container: {
    flex: 1,
    padding: '32px 20px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '16px',
    overflowY: 'auto',
  },
};

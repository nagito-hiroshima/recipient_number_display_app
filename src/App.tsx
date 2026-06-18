import React, { useState } from 'react';
import { useWebSocket } from './useWebSocket';
import { TicketInput } from './TicketInput';

const API_KEY_STORAGE_KEY = 'apiToken';

export const InputScreen: React.FC = () => {
  const { isConnected } = useWebSocket();
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState<string>(
    () => localStorage.getItem(API_KEY_STORAGE_KEY) || ''
  );

  const handleApiKeyChange = (value: string) => {
    setApiKey(value);
    localStorage.setItem(API_KEY_STORAGE_KEY, value);
  };

  const handleSubmitTicket = async (ticketId: string) => {
    if (!apiKey.trim()) {
      throw new Error('APIキーを入力してください');
    }
    setIsLoading(true);
    try {
      const token = apiKey.trim();
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
          <span className={`status-dot ${isConnected ? 'status-dot--on' : 'status-dot--off'}`} />
          {isConnected ? '接続中' : '再接続中...'}
        </div>
      </header>

      <div style={styles.container}>
        <div style={styles.apiKeyBox}>
          <label style={styles.apiKeyLabel} htmlFor="api-key-input">
            APIキー
          </label>
          <input
            id="api-key-input"
            className="text-input"
            type="password"
            value={apiKey}
            onChange={(e) => handleApiKeyChange(e.target.value)}
            placeholder="APIキーを入力"
            autoComplete="off"
            style={styles.apiKeyInput}
          />
          <span
            style={{
              ...styles.apiKeyStatus,
              color: apiKey.trim() ? 'var(--success)' : 'var(--danger)',
              backgroundColor: apiKey.trim() ? 'rgba(22,163,74,0.1)' : 'rgba(239,68,68,0.1)',
            }}
          >
            {apiKey.trim() ? '設定済み' : '未設定'}
          </span>
        </div>
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
  apiKeyBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    maxWidth: '460px',
    width: '100%',
    padding: '14px 18px',
    backgroundColor: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    boxShadow: 'var(--shadow-sm)',
  },
  apiKeyLabel: {
    fontSize: '14px',
    fontWeight: 700,
    color: 'var(--text)',
    whiteSpace: 'nowrap',
  },
  apiKeyInput: {
    flex: 1,
    padding: '10px 12px',
    fontSize: '14px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    outline: 'none',
    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
  },
  apiKeyStatus: {
    fontSize: '12px',
    fontWeight: 700,
    padding: '4px 10px',
    borderRadius: '999px',
    whiteSpace: 'nowrap',
  },
};
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
          <span style={{ color: isConnected ? '#4caf50' : '#f44336' }}>
            {isConnected ? '●' : '●'} {isConnected ? '接続中' : '接続中...'}
          </span>
        </div>
      </header>

      <div style={styles.container}>
        <div style={styles.apiKeyBox}>
          <label style={styles.apiKeyLabel} htmlFor="api-key-input">
            APIキー
          </label>
          <input
            id="api-key-input"
            type="password"
            value={apiKey}
            onChange={(e) => handleApiKeyChange(e.target.value)}
            placeholder="APIキーを入力"
            autoComplete="off"
            style={styles.apiKeyInput}
          />
          <span style={{ color: apiKey.trim() ? '#4caf50' : '#f44336', fontSize: '12px' }}>
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
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '20px',
  },
  apiKeyBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    maxWidth: '500px',
    width: '100%',
    padding: '12px 16px',
    backgroundColor: '#fff',
    border: '1px solid #ddd',
    borderRadius: '8px',
  },
  apiKeyLabel: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#333',
    whiteSpace: 'nowrap',
  },
  apiKeyInput: {
    flex: 1,
    padding: '8px 12px',
    fontSize: '14px',
    border: '1px solid #ccc',
    borderRadius: '6px',
    outline: 'none',
  },
};
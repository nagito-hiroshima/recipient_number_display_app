import React from 'react';
import { Ticket } from './types';

interface TicketInputProps {
  onSubmit: (ticketId: string) => Promise<void>;
  isLoading: boolean;
}

export const TicketInput: React.FC<TicketInputProps> = ({ onSubmit, isLoading }) => {
  const [inputValue, setInputValue] = React.useState('');
  const [errorMessage, setErrorMessage] = React.useState('');

  const handleNumberClick = (num: string) => {
    setErrorMessage('');
    if (inputValue.length < 3) {
      setInputValue(inputValue + num);
    }
  };

  const handleClear = () => {
    setInputValue('');
    setErrorMessage('');
  };

  const handleBackspace = () => {
    setInputValue(inputValue.slice(0, -1));
    setErrorMessage('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    try {
      await onSubmit(inputValue.trim());
      setInputValue('');
      setErrorMessage('');
    } catch (err: any) {
      setErrorMessage(err.message || 'エラーが発生しました');
      console.error('Error submitting ticket:', err);
    }
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>伝票番号入力</h2>
      <p style={styles.subtitle}>（3桁まで）</p>
      
      {/* ディスプレイ */}
      <div style={styles.display}>
        <div style={styles.displayValue}>{inputValue || '000'}</div>
      </div>

      {/* エラーメッセージ */}
      {errorMessage && (
        <div style={styles.errorMessage}>{errorMessage}</div>
      )}

      {/* ボタングリッド */}
      <div style={styles.buttonGrid}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
          <button
            key={num}
            onClick={() => handleNumberClick(num.toString())}
            disabled={isLoading}
            style={styles.numberButton}
          >
            {num}
          </button>
        ))}
      </div>

      {/* 0とコントロール */}
      <div style={styles.controlRow}>
        <button
          onClick={() => handleNumberClick('0')}
          disabled={isLoading}
          style={{ ...styles.numberButton, flex: 2 }}
        >
          0
        </button>
        <button
          onClick={handleBackspace}
          disabled={isLoading || inputValue.length === 0}
          style={styles.backspaceButton}
        >
          ←削除
        </button>
      </div>

      {/* アクションボタン */}
      <div style={styles.actionRow}>
        <button
          onClick={handleClear}
          disabled={isLoading || inputValue.length === 0}
          style={styles.clearButton}
        >
          クリア
        </button>
        <button
          onClick={handleSubmit}
          disabled={isLoading || inputValue.length === 0}
          style={styles.submitButton}
        >
          {isLoading ? '送信中...' : '送信'}
        </button>
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '20px',
    padding: '40px',
    backgroundColor: '#f5f5f5',
    borderRadius: '12px',
    maxWidth: '500px',
    width: '100%',
  },
  title: {
    margin: 0,
    fontSize: '28px',
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    margin: 0,
    fontSize: '14px',
    color: '#666',
  },
  display: {
    width: '100%',
    padding: '20px',
    backgroundColor: '#222',
    borderRadius: '8px',
    textAlign: 'center',
  },
  displayValue: {
    fontSize: '48px',
    fontWeight: 'bold',
    color: '#00ff00',
    fontFamily: 'monospace',
    letterSpacing: '4px',
  },
  errorMessage: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#ffebee',
    border: '1px solid #ef5350',
    borderRadius: '6px',
    color: '#c62828',
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: '14px',
  },
  buttonGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '10px',
    width: '100%',
  },
  numberButton: {
    padding: '20px',
    fontSize: '24px',
    fontWeight: 'bold',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  controlRow: {
    display: 'flex',
    gap: '10px',
    width: '100%',
  },
  backspaceButton: {
    flex: 1,
    padding: '20px',
    fontSize: '16px',
    fontWeight: 'bold',
    backgroundColor: '#ff9800',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  actionRow: {
    display: 'flex',
    gap: '10px',
    width: '100%',
  },
  clearButton: {
    flex: 1,
    padding: '16px',
    fontSize: '16px',
    fontWeight: 'bold',
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  submitButton: {
    flex: 2,
    padding: '16px',
    fontSize: '16px',
    fontWeight: 'bold',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
};

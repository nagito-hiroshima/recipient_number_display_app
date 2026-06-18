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

  const hasValue = inputValue.length > 0;

  return (
    <div style={styles.container}>
      <div style={styles.titleWrap}>
        <h2 style={styles.title}>伝票番号入力</h2>
        <p style={styles.subtitle}>3桁まで入力できます</p>
      </div>

      {/* ディスプレイ */}
      <div style={styles.display}>
        <div style={{ ...styles.displayValue, color: hasValue ? '#34d399' : 'rgba(52,211,153,0.35)' }}>
          {inputValue || '000'}
        </div>
      </div>

      {/* エラーメッセージ */}
      {errorMessage && <div style={styles.errorMessage}>{errorMessage}</div>}

      {/* ボタングリッド */}
      <div style={styles.buttonGrid}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
          <button
            key={num}
            className="kp-btn"
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
          className="kp-btn"
          onClick={() => handleNumberClick('0')}
          disabled={isLoading}
          style={{ ...styles.numberButton, flex: 2 }}
        >
          0
        </button>
        <button
          className="kp-btn"
          onClick={handleBackspace}
          disabled={isLoading || inputValue.length === 0}
          style={styles.backspaceButton}
        >
          ← 削除
        </button>
      </div>

      {/* アクションボタン */}
      <div style={styles.actionRow}>
        <button
          className="kp-btn"
          onClick={handleClear}
          disabled={isLoading || inputValue.length === 0}
          style={styles.clearButton}
        >
          クリア
        </button>
        <button
          className="kp-btn"
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
    padding: '32px',
    backgroundColor: 'var(--surface)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-lg)',
    border: '1px solid var(--border)',
    maxWidth: '460px',
    width: '100%',
  },
  titleWrap: {
    textAlign: 'center',
  },
  title: {
    margin: 0,
    fontSize: '26px',
    fontWeight: 800,
    color: 'var(--text)',
    letterSpacing: '0.02em',
  },
  subtitle: {
    margin: '6px 0 0',
    fontSize: '13px',
    color: 'var(--text-muted)',
  },
  display: {
    width: '100%',
    padding: '22px',
    background: 'linear-gradient(160deg, #0f172a, #1e293b)',
    borderRadius: 'var(--radius-md)',
    textAlign: 'center',
    boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.45)',
  },
  displayValue: {
    fontSize: '52px',
    fontWeight: 700,
    fontFamily: "'SF Mono', 'Roboto Mono', Menlo, Consolas, monospace",
    letterSpacing: '10px',
    textShadow: '0 0 16px rgba(52,211,153,0.4)',
    transition: 'color 0.15s ease',
  },
  errorMessage: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#fef2f2',
    border: '1px solid #fca5a5',
    borderRadius: 'var(--radius-sm)',
    color: '#b91c1c',
    textAlign: 'center',
    fontWeight: 700,
    fontSize: '14px',
  },
  buttonGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '12px',
    width: '100%',
  },
  numberButton: {
    padding: '22px',
    fontSize: '26px',
    fontWeight: 700,
    background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
    color: 'white',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    boxShadow: 'var(--shadow-sm)',
    fontVariantNumeric: 'tabular-nums',
  },
  controlRow: {
    display: 'flex',
    gap: '12px',
    width: '100%',
  },
  backspaceButton: {
    flex: 1,
    padding: '22px',
    fontSize: '16px',
    fontWeight: 700,
    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
    color: 'white',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    boxShadow: 'var(--shadow-sm)',
  },
  actionRow: {
    display: 'flex',
    gap: '12px',
    width: '100%',
  },
  clearButton: {
    flex: 1,
    padding: '18px',
    fontSize: '16px',
    fontWeight: 700,
    background: 'linear-gradient(135deg, #94a3b8, #64748b)',
    color: 'white',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    boxShadow: 'var(--shadow-sm)',
  },
  submitButton: {
    flex: 2,
    padding: '18px',
    fontSize: '16px',
    fontWeight: 700,
    background: 'linear-gradient(135deg, #22c55e, #16a34a)',
    color: 'white',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    boxShadow: 'var(--shadow-sm)',
  },
};

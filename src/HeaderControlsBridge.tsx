import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { ApiKeyModal } from './ApiKeyModal';

const API_KEY_STORAGE_KEY = 'apiToken';

interface ProjectionState {
  active: boolean;
}

function getSocketUrl(): string {
  const isLocalVite =
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
    window.location.port === '5173';
  return isLocalVite ? 'http://localhost:3000' : window.location.origin;
}

/**
 * 既存の各操作をスタッフ画面のヘッダーへ集約するためのブリッジ。
 * ProjectionRuntime の投影モーダルはそのまま利用し、右下の起動ボタンだけを隠して
 * ヘッダーの「投影」ボタンから起動する。
 */
export const HeaderControlsBridge: React.FC = () => {
  const location = useLocation();
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [projectionActive, setProjectionActive] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(API_KEY_STORAGE_KEY)?.trim() || '');
  const [apiKeyOpen, setApiKeyOpen] = useState(false);

  useEffect(() => {
    if (location.pathname !== '/') {
      setTarget(null);
      return;
    }

    const findTarget = () => {
      const next = document.querySelector<HTMLElement>('.staff-media-actions');
      if (next) setTarget(next);
    };

    findTarget();
    const observer = new MutationObserver(findTarget);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [location.pathname]);

  useEffect(() => {
    if (location.pathname !== '/') return;

    let socket: Socket | null = null;
    let cancelled = false;

    fetch('/api/projection/status')
      .then((response) => response.json())
      .then((data: ProjectionState) => {
        if (!cancelled) setProjectionActive(data.active === true);
      })
      .catch((error) => console.warn('Projection status could not be loaded:', error));

    socket = io(getSocketUrl(), {
      reconnection: true,
      reconnectionAttempts: Infinity,
      transports: ['websocket', 'polling'],
    });
    socket.on('projection:status', (data: ProjectionState) => setProjectionActive(data.active === true));

    return () => {
      cancelled = true;
      socket?.close();
    };
  }, [location.pathname]);

  useEffect(() => {
    if (location.pathname !== '/') return;

    // ProjectionRuntime が持つ旧右下ボタンと、DEMO欄にある旧APIキーボタンを隠す。
    // 機能本体は残すため、投影モーダルはヘッダー側から旧ボタンを内部的に起動する。
    const normalizeControls = () => {
      const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('button'));
      for (const button of buttons) {
        if (button.dataset.headerUnifiedControl === 'true') continue;
        const text = button.textContent?.trim() || '';

        if (text.includes('ディスプレイ投影') || text === '📺 投影中') {
          button.dataset.legacyProjectionLauncher = 'true';
          button.style.display = 'none';
        }

        if ((text.includes('APIキー登録') || text.includes('APIキー変更')) && !button.closest('.staff-header-actions')) {
          button.style.display = 'none';
        }
      }
    };

    normalizeControls();
    const observer = new MutationObserver(normalizeControls);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [location.pathname]);

  const openProjection = () => {
    const legacyButton = document.querySelector<HTMLButtonElement>('button[data-legacy-projection-launcher="true"]');
    legacyButton?.click();
  };

  const saveApiKey = (value: string) => {
    const next = value.trim();
    if (!next) return;
    localStorage.setItem(API_KEY_STORAGE_KEY, next);
    setApiKey(next);
    setApiKeyOpen(false);
  };

  if (location.pathname !== '/' || !target) return null;

  return (
    <>
      {createPortal(
        <>
          <span style={styles.divider} aria-hidden="true" />
          <button
            type="button"
            className="kp-btn"
            data-header-unified-control="true"
            style={{ ...styles.headerButton, ...(projectionActive ? styles.projectionActive : {}) }}
            onClick={openProjection}
            title="準備中・タイムセール・本日終了・自由文字・画像を /display に投影"
          >
            📺 {projectionActive ? '投影中' : '投影'}
          </button>
          <button
            type="button"
            className="kp-btn"
            data-header-unified-control="true"
            style={{ ...styles.headerButton, ...(apiKey ? styles.apiRegistered : {}) }}
            onClick={() => setApiKeyOpen(true)}
            title={apiKey ? '登録済みAPIキーを確認・変更' : 'APIキーを登録'}
          >
            🔑 {apiKey ? 'API' : 'API登録'}
          </button>
        </>,
        target
      )}

      {apiKeyOpen && (
        <ApiKeyModal
          value={apiKey}
          onSave={saveApiKey}
          onClose={() => setApiKeyOpen(false)}
        />
      )}
    </>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  divider: {
    width: '1px',
    height: '26px',
    margin: '0 2px',
    backgroundColor: 'rgba(255,255,255,0.18)',
    flex: '0 0 auto',
  },
  headerButton: {
    minHeight: '42px',
    padding: '8px 10px',
    borderRadius: '10px',
    border: '1px solid #64748b',
    backgroundColor: '#334155',
    color: '#fff',
    fontSize: '11px',
    fontWeight: 900,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  projectionActive: {
    borderColor: '#fca5a5',
    backgroundColor: '#9f0b0d',
    boxShadow: '0 0 0 2px rgba(239,68,68,0.14)',
  },
  apiRegistered: {
    borderColor: '#86efac',
    backgroundColor: '#14532d',
    color: '#dcfce7',
  },
};

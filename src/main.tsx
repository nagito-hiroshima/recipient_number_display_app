import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppRouter } from './Router';
import './index.css';
import './public-display-overrides.css';

// Web Speech API の volume は 1.0 が上限で、それ以上にはできない。
// /display で「アナウンス音量=100%」のときだけ、読み上げ中のBGMを
// ほぼ無音まで下げ、読み上げ速度も少し落として実効的な聞き取りやすさを上げる。
function installPublicDisplayAnnouncementBoost() {
  if (window.location.pathname !== '/display' || !('speechSynthesis' in window)) return;

  try {
    const synth = window.speechSynthesis;
    const originalSpeak = synth.speak.bind(synth);

    synth.speak = ((utterance: SpeechSynthesisUtterance) => {
      if (utterance.volume >= 0.95) {
        utterance.volume = 1;
        utterance.rate = Math.min(utterance.rate, 0.9);

        const video = document.querySelector<HTMLVideoElement>('video[src="/mv.mp4"]');
        if (video) {
          // PublicDisplayScreen 側でもダッキングしているが、最大音量時はさらに
          // BGMを下げてアナウンスを前に出す。読み上げ後は既存処理が元音量へ戻す。
          video.volume = Math.min(video.volume, 0.025);
        }
      }

      return originalSpeak(utterance);
    }) as typeof synth.speak;
  } catch (error) {
    console.warn('Announcement boost could not be installed:', error);
  }
}

installPublicDisplayAnnouncementBoost();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppRouter />
  </React.StrictMode>
);

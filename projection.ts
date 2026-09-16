import express, { Request, Response, NextFunction } from 'express';
import { Server } from 'socket.io';

export type ProjectionTheme = 'prepare' | 'sale' | 'closed' | 'info';
export type ProjectionKind = 'none' | 'text' | 'image';

export interface ProjectionState {
  active: boolean;
  kind: ProjectionKind;
  title: string;
  subtitle: string;
  imageDataUrl: string | null;
  theme: ProjectionTheme;
  updatedAt: string | null;
}

const EMPTY_STATE: ProjectionState = {
  active: false,
  kind: 'none',
  title: '',
  subtitle: '',
  imageDataUrl: null,
  theme: 'info',
  updatedAt: null,
};

const VALID_THEMES = new Set<ProjectionTheme>(['prepare', 'sale', 'closed', 'info']);
const MAX_IMAGE_DATA_URL_LENGTH = 6_000_000;

export function createProjectionRouter(io: Server, apiToken: string) {
  const router = express.Router();
  let state: ProjectionState = { ...EMPTY_STATE };

  const authenticate = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token) return res.status(401).json({ error: 'Unauthorized - Missing token' });
    if (token !== apiToken) return res.status(403).json({ error: 'Forbidden - Invalid token' });
    next();
  };

  const broadcast = () => {
    io.emit('projection:status', state);
  };

  // 投影は「一時表示」なのでDBやファイルには保存しない。
  // サーバー再起動時には自動的に通常表示へ戻る。
  io.on('connection', (socket) => {
    socket.emit('projection:status', state);
  });

  router.get('/status', (_req, res) => {
    res.json(state);
  });

  router.post('/show', authenticate, (req, res) => {
    try {
      const kind = req.body?.kind;
      if (kind !== 'text' && kind !== 'image') {
        return res.status(400).json({ error: 'kind must be text or image' });
      }

      const theme = VALID_THEMES.has(req.body?.theme) ? req.body.theme as ProjectionTheme : 'info';
      const title = typeof req.body?.title === 'string' ? req.body.title.trim().slice(0, 120) : '';
      const subtitle = typeof req.body?.subtitle === 'string' ? req.body.subtitle.trim().slice(0, 240) : '';

      if (kind === 'text') {
        if (!title) return res.status(400).json({ error: '表示する文字を入力してください' });
        state = {
          active: true,
          kind: 'text',
          title,
          subtitle,
          imageDataUrl: null,
          theme,
          updatedAt: new Date().toISOString(),
        };
      } else {
        const imageDataUrl = typeof req.body?.imageDataUrl === 'string' ? req.body.imageDataUrl : '';
        if (!/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(imageDataUrl)) {
          return res.status(400).json({ error: '対応していない画像形式です' });
        }
        if (imageDataUrl.length > MAX_IMAGE_DATA_URL_LENGTH) {
          return res.status(413).json({ error: '画像データが大きすぎます。4MB以下の画像を使用してください。' });
        }
        state = {
          active: true,
          kind: 'image',
          title,
          subtitle: '',
          imageDataUrl,
          theme: 'info',
          updatedAt: new Date().toISOString(),
        };
      }

      broadcast();
      res.json(state);
    } catch (error) {
      console.error('Projection show failed:', error);
      res.status(500).json({ error: '投影の開始に失敗しました' });
    }
  });

  router.post('/clear', authenticate, (_req, res) => {
    state = { ...EMPTY_STATE };
    broadcast();
    res.json(state);
  });

  return router;
}

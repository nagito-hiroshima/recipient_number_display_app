# 🎫 伝票管理システム（Receipt Number Display App）

マクドナルドのような、リアルタイム伝票表示・管理システムです。複数の端末から同時にアクセスでき、WebSocket（Socket.IO）を使用したリアルタイム同期により、すべての端末で同じ伝票情報を表示します。

---

## ✨ 主な機能

### 🔢 入力画面 (`/number-input`)
- **数字キーパッド入力** - 0-9のボタンで伝票番号を入力
- **3桁まで対応** - 伝票番号は最大3桁に制限
- **入力操作**
  - 削除ボタン（←削除）：1文字削除
  - クリアボタン：全て削除
  - 送信ボタン：伝票を作成して表示画面に反映

### 📺 表示画面 (`/display`)
- **2段階表示**
  - 左側：「作成中」欄（新規作成された伝票）
  - 右側：「お呼び出し中」欄（処理中の伝票）
- **伝票タップで状態遷移**
  - 「作成中」の伝票をタップ → 「お呼び出し中」に移動
  - 「お呼び出し中」の伝票をタップ → 完了（削除）

### 🔄 リアルタイム同期
- **Socket.IO を使用した即座の同期**
  - 入力画面で伝票作成 → 全表示画面に即座に反映
  - 表示画面で状態変更 → 全端末で同時に更新
- **自動再接続** - 接続が途切れた場合、自動的に再接続

---

## 🏗️ システム構成

### バックエンド
- **Express.js** - RESTful API サーバー
- **Socket.IO** - リアルタイム双方向通信
- **sql.js** - SQLiteデータベース（ブラウザ互換）

### フロントエンド
- **React 18** - UI フレームワーク
- **React Router** - URL ベースのルーティング
- **Socket.IO Client** - リアルタイム通信クライアント
- **TypeScript** - 型安全性

### データ永続化
- **SQLite（sql.js）** - `tickets.db` ファイルに自動保存
- 再起動後もデータが保持される

---

## 📦 インストール

### 必要環境
- Node.js 16+ 
- pnpm（または npm）

### セットアップ手順

```bash
# 1. リポジトリをクローン
git clone <repository-url>
cd receipt_number_display_app

# 2. 依存関係をインストール
pnpm install

# 3. 開発サーバーを起動
pnpm run dev
```

### サーバーの起動確認
```
✓ バックエンド（localhost:3000）が起動
✓ フロントエンド（localhost:5173）が起動
```

---

## 🚀 使い方

### 入力画面（端末A, B用）
```
URL: http://localhost:5173/number-input
```
1. 数字キーパッドで伝票番号を入力（例：001, 042）
2. 「送信」ボタンをタップ
3. 表示画面に伝票が即座に表示される

**注意：**
- 既に存在する伝票番号は入力不可（エラーメッセージ表示）
- 最大3桁までの入力に制限

### 表示画面（大画面用）
```
URL: http://localhost:5173/display
```
- 左側「作成中」：新規作成された全伝票が表示
- 右側「お呼び出し中」：処理中の伝票が表示
- 伝票をタップすると、状態が遷移して移動

---

## 📋 API エンドポイント

| メソッド | エンドポイント | 説明 |
|---------|---------------|------|
| POST | `/api/tickets` | 新規伝票作成 |
| GET | `/api/tickets` | 全伝票取得 |
| PATCH | `/api/tickets/:id` | 伝票状態更新 |
| DELETE | `/api/tickets/:id` | 伝票削除 |
| POST | `/api/square/webhook` | Square Webhook 受信（決済完了で伝票自動発行） |

---

## 🟦 Square 連携（注文データから自動発行）

Square の決済が完了すると、Webhook 経由で伝票が自動発行されます。

### 仕組み
1. Square で決済が完了すると `payment.updated`（status=`COMPLETED`）の Webhook が `/api/square/webhook` に届く
2. サーバーが署名（`x-square-hmacsha256-signature`）を検証
3. 注文（Order）を取得し、**伝票番号 = 注文の `ticket_name`**（無ければ引き取り先名 → 注文ID末尾）として採番
4. 伝票を作成し、Socket.IO で全表示画面に即時反映
5. 同じ注文IDからの重複発行は防止（冪等性）

### セットアップ
1. `.env.example` を `.env` にコピーし、Square の値を設定

   | 変数 | 説明 |
   |------|------|
   | `SQUARE_ACCESS_TOKEN` | Square API アクセストークン |
   | `SQUARE_WEBHOOK_SIGNATURE_KEY` | Webhook 署名キー |
   | `SQUARE_WEBHOOK_URL` | Square に登録した通知先URL（完全一致が必要） |
   | `SQUARE_ENV` | `sandbox` または `production` |

2. Square Developer Dashboard の **Webhooks** で通知先URL（`https://<your-domain>/api/square/webhook`）と `payment.updated` イベントを登録
3. 公開URLが必要（ローカル検証時は ngrok 等でトンネリング）

> 注: 署名検証は `SQUARE_WEBHOOK_URL` と Square 登録URLが**完全一致**している必要があります。

### リクエスト/レスポンス例

**新規伝票作成**
```bash
curl -X POST http://localhost:3000/api/tickets \
  -H "Content-Type: application/json" \
  -d '{"id":"001"}'
```

**レスポンス**
```json
{
  "id": "001",
  "status": "preparing",
  "createdAt": "2026-04-27T03:21:44.000Z"
}
```

---

## 🔌 Socket.IO イベント

| イベント | 説明 |
|---------|------|
| `init` | 初期接続時：全伝票データを送信 |
| `ticket:update` | 伝票情報の変更を全クライアントにブロードキャスト |

**イベントペイロード（ticket:update）**
```json
{
  "type": "ticket:created|ticket:updated|ticket:deleted",
  "data": {
    "id": "001",
    "status": "preparing|calling|completed",
    "createdAt": "2026-04-27T03:21:44.000Z",
    "calledAt": "2026-04-27T03:22:00.000Z",
    "completedAt": "2026-04-27T03:23:00.000Z"
  }
}
```

---

## 🗂️ ディレクトリ構成

```
receipt_number_display_app/
├── src/
│   ├── App.tsx                 # 入力画面
│   ├── DisplayScreen.tsx       # 表示画面
│   ├── TicketInput.tsx         # 数字キーパッド
│   ├── TicketDisplay.tsx       # 伝票表示コンポーネント
│   ├── useWebSocket.ts         # Socket.IO フック
│   ├── Router.tsx              # ルーティング設定
│   ├── types.ts                # TypeScript 型定義
│   ├── main.tsx                # エントリーポイント
│   └── index.css               # グローバルスタイル
├── server.ts                   # Express + Socket.IO サーバー
├── database.ts                 # sql.js ラッパー
├── index.html                  # HTML テンプレート
├── vite.config.ts              # Vite 設定
├── tsconfig.json               # TypeScript 設定
├── tsconfig.server.json        # サーバー向けTS設定
├── package.json                # 依存関係
├── tickets.db                  # SQLiteデータベース（自動生成）
└── README.md                   # このファイル
```

---

## 🛠️ 開発コマンド

```bash
# 開発サーバー起動（サーバー + クライアント同時実行）
pnpm run dev

# ビルド（本番用）
pnpm run build

# バックエンドのみビルド
pnpm run build:server

# フロントエンドのみビルド
pnpm run build:client

# 本番サーバー起動
pnpm run server
```

---

## 🗄️ データベース

### 伝票テーブルスキーマ

```sql
CREATE TABLE tickets (
  id TEXT PRIMARY KEY,                    -- 伝票番号（001-999）
  status TEXT NOT NULL DEFAULT 'preparing', -- 状態（preparing|calling|completed）
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP, -- 作成日時
  called_at DATETIME,                     -- お呼び出し開始日時
  completed_at DATETIME                   -- 完了日時
)
```

### データベースファイル
- **ファイル**: `tickets.db`
- **形式**: SQLite
- **初期化**: 初回起動時に自動作成
- **永続化**: サーバー再起動後もデータが保持される

---

## 🔌 接続状態表示

各画面のヘッダーに接続状態が表示されます：
- 🟢 **●接続中** - Socket.IO サーバーに接続中
- 🔴 **●接続中...** - 接続中（自動再接続試行中）

接続に失敗した場合は、自動的に再接続を試みます。

---

## 📱 マルチデバイス対応

複数の端末から同時にアクセス可能：

```
端末 A: http://localhost:5173/number-input  （入力用）
端末 B: http://localhost:5173/number-input  （入力用）
大画面: http://localhost:5173/display        （表示用）
```

すべての端末で伝票情報がリアルタイムに同期されます。

---

## ⚙️ 設定のカスタマイズ

### ポート番号の変更

**バックエンド（server.ts）**
```typescript
const PORT = 3000; // → 希望のポート番号に変更
```

**フロントエンド（vite.config.ts）**
```typescript
server: {
  port: 5173, // → 希望のポート番号に変更
}
```

### 伝票番号の桁数変更

**src/TicketInput.tsx**
```typescript
if (inputValue.length < 3) { // → 4 や 5 に変更
  setInputValue(inputValue + num);
}
```

---

## 🐛 トラブルシューティング

### Socket.IO が接続できない
1. ファイアウォール設定を確認
2. バックエンドサーバーが正常に起動しているか確認
3. ブラウザコンソールでエラーログを確認

### データベースエラー
1. `tickets.db` ファイルの削除を試みる（初期化される）
2. ディスク容量を確認

### ポート競合エラー
```bash
# 別のプロセスがポートを使用していないか確認
netstat -ano | findstr :3000  # Windows
lsof -i :3000                 # Mac/Linux
```

---

## 📝 ライセンス

MIT License

---

## 👥 貢献

プルリクエスト、issue の報告は大歓迎です！

---

## 📞 サポート

問題が発生した場合は、GitHub Issues で報告してください。

---

**最終更新**: 2026-04-27

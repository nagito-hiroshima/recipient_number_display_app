# 🎫 伝票・受け取り番号表示システム

大学祭・模擬店などの飲食販売で使うことを想定した、**伝票管理・呼び出し・お客様向け受け取り番号表示システム**です。

React + Express + Socket.IO で構成されており、複数端末間で伝票状態をリアルタイム同期します。Square の決済完了から伝票を自動発行することもできます。

---

## ✨ 主な機能

- 伝票番号の手動追加
- `preparing → calling → completed` の状態管理
- スタッフ操作画面とお客様向け表示画面の分離
- Socket.IO によるリアルタイム同期
- Square Webhook による伝票自動発行
- 呼び出し時のチャイム
- ブラウザ音声合成による日本語読み上げ
- 呼び出し中番号の**再呼び出し**
- 再呼び出し時の画面強調・再読み上げ
- 提供待ち件数による混雑レベル表示
- デモモード / 動作確認モード
- Web 画面からデモモード ON / OFF
- デモデータだけの一括削除
- API キーのブラウザ保存

---

# 🖥️ 画面構成

## `/` — スタッフ用 伝票操作画面

スタッフが伝票状態を操作するメイン画面です。

### できること

- 「調理中」と「お呼び出し中」を一覧表示
- 調理中の伝票をタップ → `calling`
- 呼び出し中の伝票をタップ → `completed`
- 伝票を長押しして操作メニューを表示
- 調理中 / 呼び出し中への移動
- 伝票削除
- 呼び出し中番号の再呼び出し
- デモモード操作
- 混雑レベル確認
- `/number-input` へ移動

### 混雑レベル

「提供待ち」は `preparing + calling` の合計件数です。

| 提供待ち | 表示 | 背景 |
|---:|---|---|
| 0〜2件 | 余裕あり | 緑 |
| 3〜5件 | 少し混雑 | 黄 |
| 6〜9件 | 混雑中 | 赤 |
| 10件以上 | かなり混雑 | 赤点滅 |

---

## `/number-input` — 伝票番号入力画面

数字キーパッドから伝票番号を手動追加する画面です。

- 0〜9 の数字ボタン
- 最大3桁
- 1文字削除
- 全消去
- 送信
- `/` へ戻るボタン

### API キー

伝票追加に使用する API キーはブラウザの `localStorage` に保存します。

一度入力すれば、ページ移動や再読み込み後も同じブラウザでは保持されます。

---

## `/display` — お客様向け表示専用画面

お客様向けモニターに表示する**操作不可の画面**です。

- 「調理中」番号表示
- 「お呼び出し中」番号表示
- 待ち時間・経過時間は表示しない
- タップ・長押し等の操作なし
- 最終呼出番号を表示
- WebSocket によりリアルタイム反映
- 呼び出し時にチャイム
- 日本語音声読み上げ
- 再呼び出し時にもチャイム・読み上げを再実行
- 再呼び出し対象を約5秒間強調表示
- デモ伝票には `DEMO` バッジを表示

### 音声読み上げ

通常伝票では、概ね以下の内容を読み上げます。

```text
お待たせしました。番号 123 のお客様、受け取り口までお越しください。
```

デモ伝票では本番の案内と区別するため、デモ用の読み上げを行います。

> ブラウザの自動再生ポリシーによっては、端末起動後に最初の1回だけ画面操作が必要になる場合があります。

---

# 🔊 再呼び出し

`calling` 状態の伝票を長押しすると **「再呼び出し」** を実行できます。

再呼び出し時は `/display` に `ticket:recalled` が配信され、以下を再実行します。

1. 対象番号を強調表示
2. チャイム再生
3. 既存の音声キューを整理
4. 対象番号を日本語で再読み上げ

必要に応じて「呼び出し時刻も更新する」を選択できます。

---

# 🧪 デモモード

本番前のリハーサル、機材確認、説明用としてデモモードを搭載しています。

スタッフ画面 `/` の **DEMO ON / OFF** ボタンから切り替えできます。

### デモ操作

```text
[ DEMO ON / OFF ]
[ ランダム1件追加 ]
[ 10件追加 ]
[ 自動進行開始 / 停止 ]
[ デモデータ削除 ]
```

### デモ伝票

- `D123` のような番号で生成
- DB 上で `demo = true` として管理
- 通常伝票と区別して表示
- `/display` のチャイム・読み上げ確認にも利用可能

### 自動進行

デモ伝票を約4秒間隔で順番に進めます。

```text
preparing
   ↓
calling
   ↓
completed
```

### Web からの ON / OFF

デモモードそのものを `/` から ON / OFF できます。

- API キー必須
- OFF にすると自動進行も停止
- OFF にしても既存のデモ伝票は自動削除しない
- デモ伝票だけ削除する専用ボタンあり
- ON / OFF 状態は DB に保存され、サーバー再起動後も維持
- 複数のスタッフ画面で `demo:status` をリアルタイム同期

`DEMO_MODE_ENABLED` は初回起動時のデフォルト値として利用します。

---

# 🟦 Square 連携

Square の決済が完了すると、Webhook 経由で伝票を自動発行します。

## 処理の流れ

1. Square が `/api/square/webhook` へ Webhook を送信
2. `x-square-hmacsha256-signature` を検証
3. `payment.updated` / `payment.created` を確認
4. `COMPLETED` の支払いだけ処理
5. Square Orders API から注文情報を取得
6. 表示番号を決定
7. DB に伝票追加
8. Socket.IO で全画面へ即時配信

### 番号の決定順

1. Order の `ticket_name`
2. Payment の `receipt_number`
3. Order ID 末尾6文字

同じ Square Order ID からの重複発行は防止します。

---

# ⚙️ 環境変数

`.env.example` を参考に設定してください。

```env
API_TOKEN=your-api-token

DEMO_MODE_ENABLED=true

SQUARE_ACCESS_TOKEN=your-square-access-token
SQUARE_WEBHOOK_SIGNATURE_KEY=your-square-webhook-signature-key
SQUARE_WEBHOOK_URL=https://example.com/api/square/webhook
SQUARE_ENV=production
```

| 変数 | 説明 |
|---|---|
| `API_TOKEN` | 伝票追加・再呼び出し・デモ管理用 Bearer Token |
| `DEMO_MODE_ENABLED` | デモモード初期値。Web変更後はDB保存値を使用 |
| `SQUARE_ACCESS_TOKEN` | Square API アクセストークン |
| `SQUARE_WEBHOOK_SIGNATURE_KEY` | Square Webhook 署名キー |
| `SQUARE_WEBHOOK_URL` | Square に登録した通知URL。完全一致が必要 |
| `SQUARE_ENV` | `sandbox` または `production` |

> `SQUARE_WEBHOOK_URL` は Square Developer Dashboard に登録した URL と完全一致させてください。

---

# 📋 API

| Method | Endpoint | 説明 | APIキー |
|---|---|---|---|
| `POST` | `/api/tickets` | 手動伝票作成 | 必須 |
| `GET` | `/api/tickets` | 全伝票取得 | 必須 |
| `PATCH` | `/api/tickets/:id` | 状態更新 | 現行実装では不要 |
| `DELETE` | `/api/tickets/:id` | 伝票削除 | 現行実装では不要 |
| `POST` | `/api/tickets/:id/recall` | 再呼び出し | 必須 |
| `GET` | `/api/demo/status` | デモ状態取得 | 不要 |
| `POST` | `/api/demo/enabled` | デモモード ON / OFF | 必須 |
| `POST` | `/api/demo/tickets` | デモ伝票作成 | 必須 |
| `POST` | `/api/demo/auto/start` | 自動進行開始 | 必須 |
| `POST` | `/api/demo/auto/stop` | 自動進行停止 | 必須 |
| `DELETE` | `/api/demo/tickets` | デモ伝票だけ削除 | 必須 |
| `POST` | `/api/square/webhook` | Square Webhook | Square署名 |

---

# 🔌 Socket.IO

## `init`

接続時に全伝票を送信します。

## `ticket:update`

伝票変更を配信します。

```text
ticket:created
ticket:updated
ticket:recalled
ticket:deleted
```

## `demo:status`

デモモードの状態変更をスタッフ画面へ配信します。

```json
{
  "enabled": true,
  "autoRunning": false
}
```

---

# 🗄️ データベース

`sql.js` を利用し、`tickets.db` に保存します。

## tickets

主なカラム：

```text
id
status
created_at
called_at
completed_at
source_order_id
from_mobile
demo
```

既存DBに新しい列がない場合は起動時に自動マイグレーションします。

## app_settings

アプリ設定保存用テーブルです。

現在は Web から変更したデモモード ON / OFF を保存します。

---

# 🏗️ 技術構成

### Frontend

- React 18
- TypeScript
- React Router
- Vite
- Socket.IO Client
- Web Audio API
- Web Speech API

### Backend

- Node.js
- Express
- TypeScript
- Socket.IO
- sql.js

### 外部連携

- Square Payments / Orders API
- Square Webhooks

---

# 📦 セットアップ

```bash
git clone <repository-url>
cd recipient_number_display_app

pnpm install
cp .env.example .env

pnpm run dev
```

本番ビルド：

```bash
pnpm run build
pnpm run server
```

---

# 🗂️ 主なファイル

```text
src/
├── App.tsx                  # /number-input
├── DisplayScreen.tsx        # / スタッフ操作画面
├── PublicDisplayScreen.tsx  # /display お客様向け画面
├── TicketInput.tsx          # 数字キーパッド
├── TicketDisplay.tsx        # 伝票カード表示
├── TicketMenu.tsx           # 長押し操作・再呼び出し
├── Router.tsx               # ルーティング
├── useWebSocket.ts          # Socket.IO
├── types.ts                 # 共通型
└── index.css                # 共通スタイル

server.ts                    # Express / Socket.IO / API / Webhook
database.ts                  # DB管理・設定保存
square.ts                    # Square API / Webhook署名
render.yaml                  # Render設定
.env.example                 # 環境変数例
```

---

# 🚦 推奨運用

本番営業前：

1. `/display` をお客様向けモニターで開く
2. 音声出力を確認
3. DEMO を ON
4. 10件追加
5. 自動進行開始
6. 通常呼び出しと再呼び出しを確認
7. デモデータ削除
8. **DEMO を OFF**
9. Square Webhook テスト
10. 本番開始

---

## 📝 License

MIT License

---

**最終更新: 2026-09-05**

# 豚小屋探検隊 — managed renovation

[ゲームを開く](https://pig-house-exploration-1103.astralolm10.chatgpt.site) · [元のプロジェクト](https://github.com/pagigon/pig-man) · [フォーク](https://github.com/hizumi300/pig-man)

ChatGPTログインで参加する3〜10人の正体隠匿カードゲーム。利用者がサーバー用ターミナルを起動する必要はありません。Sites / Cloudflare Workersで配信し、D1で部屋と手札を保存します。

## 遊ぶ

1. 公開URLまたは `public/invite-qr.png` のQRを開き、ChatGPTでログイン。
2. 1〜8文字のゲーム専用表示名で部屋を作成。必要なら4〜64文字の合言葉を設定。
3. 招待リンクを共有し、3人以上でホストが開始。
4. 鍵を持つ人が他人のカードを1枚開く。鍵はそのカードの持ち主へ移る。
5. 人数分のカードを開くと未公開カードを回収・再配布。5→4→3→2枚。
6. 子豚を全救出すれば探検家、全罠発動または4ラウンド終了なら豚男の勝利。

役職カードは人数別の指定構成をシャッフルして配ります。3/4/7/8/10人では1枚余り、その正体は非公開。自分にも伏せた手札の位置はわからず、子豚・罠・空き部屋の枚数だけ確認できます。終局時は全員の役職を公開します。

切断時は席を削除しません。同じChatGPTアカウントで同じURLを開くと復帰します。観戦者には未公開の手札・役職を配信しません。部屋内の表示名とチャットは参加者に公開されるので、個人情報は入力しないでください。

画面上部のBGMボタンで、ダークなオリジナル曲「影の豚小屋」を再生できます。初期状態はOFF。音量と文字サイズ（小・標準・大・特大）は端末に保存されます。

## ソースと履歴

- 元リポジトリ `pagigon/pig-man`、基点 `750c7ac91bda0b66a22c0847d98a4d6bd6a54564` のGit履歴を保持。
- 開発ブランチ `codex/bgm-accessibility-v3`（v0.3.0）。元のmainおよびRender環境は変更しない。
- `legacy/` は元のコードの比較用保管。新サイトから実行・配信しない。
- 提供された `/Users/hasegawaryo/Downloads/webp/` の9画像を `public/images/` にコピー。
- Sites側にも同じコミットを保存してから公開。公開バージョンとGit SHAを対応づける。

## 構成

|場所|責務|
|---|---|
|`lib/game.ts`|純粋なゲーム状態遷移・本人向け情報の射影|
|`lib/role-rules.ts`|人数別の役職カード構成と表示|
|`lib/room-store.ts`|D1保存・バージョン比較更新・部屋作成の重複排除|
|`app/api/game/route.ts`|ChatGPT認証・同一オリジン検証・API|
|`app/game-client.tsx`|ロビー・盤面・観戦・チャット・復帰UI|
|`db/schema.ts`, `drizzle/`|D1スキーマと追加型マイグレーション|
|`tests/`|800ゲームの性質テスト、実D1シミュレータによる同時操作テスト|
|`public/invite-qr.png`, `public/invite-qr.svg`|ロビーへのQRコード|
|`docs/RENOVATION.md`|原因分析・設計判断・制約・次の検証|
|`docs/VALIDATION.md`, `docs/VALIDATION-V2.md`, `docs/V3.md`|検証結果と再実行手順|

Sites標準のVinextサーバー統合を利用し、ゲームルールはフレームワークに依存しないTypeScriptで分離。元のExpress/Socket.io常駐プロセスは不要。画面は対戦中約1秒、待機室2秒（ロビー5秒）間隔のHTTP同期、非表示時は停止します。

## 開発・検証

Node.js 22.13以上（検証環境24.18）。初回はSitesの `install-dependencies.mjs` を使用。

```sh
npm test
npm run typecheck
node --experimental-strip-types scripts/qa-rollback.mjs
node scripts/generate-qr.mjs
npm run build
```

ローカル開発だけは次を使用します（公開サイトの利用には不要）。

```sh
npm run dev -- --port 5173
```

D1初期化はビルド後、未適用のSQLを1回だけ適用します。公開用D1とは別領域です。

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_gorgeous_deadpool.sql
```

ローカルログインはSites starterの開発専用モック。本番はSites提供のChatGPT認証を利用し、独自のOAuth・秘密キーは実装しません。

## 運用とロールバック

- 公開ページはURLを知る人がアクセス可能。ゲームAPIは認証必須。
- 1アカウントにつき作成できる部屋は同時に1つ。閉じると新規作成可能。
- 状態は最終操作から6時間でアクセス期限切れ。閲覧・自動更新・再送では延長しない。期限切れ行は次の部屋作成時に清掃（無アクセス時の即時物理削除は行わない）。
- チャットは各ラウンド最新100件を保持し、終局・再戦・待機室への復帰で消去。探検ログは最新60件。
- ランキング、リプレイ、音声通話、自動代打は未実装。
- ロールバックはSitesで以前の検証済みバージョンを再デプロイ。DBマイグレーションは戻さず、互換性を確認する。
- V3の復旧先はSites Version 2。Gitタグ `release/v0.2.0` と `docs/RELEASE-V2.json` に記録。Version 1も保存済み。削除済みチャット・部屋の復元はできない。元のRenderへ自動切替しない。
- Gitで取り消す場合は対象の変更を `git revert` し、検証・ビルド・Sites公開をやり直す。共有履歴の強制pushはしない。

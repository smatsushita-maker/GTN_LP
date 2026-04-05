# Global Talent Navi - LP Project

外国人雇用支援サービス「Global Talent Navi」の統合LPプロジェクト。
GitHub push → Vercel接続 → ドメイン設定の3ステップで本番公開可能。

---

## URL構成

| パス | 内容 | 状態 |
|------|------|------|
| `/` | トップLP | 本番OK |
| `/diagnosis` | 外国人雇用 成功確率診断LP | 本番OK |
| `/diagnosis/check.html` | 診断質問ページ | 本番OK |
| `/diagnosis/result.html` | 診断結果ページ | 本番OK |
| `/contact` | お問い合わせ | 仮ページ |
| `/privacy` | プライバシーポリシー | 構成案のみ |
| `/report` | レポート | 仮ページ |

---

## フォルダ構成

```
GTN_LP/
├── public/                        ← Vercelが配信するディレクトリ
│   ├── index.html                 ← トップLP
│   ├── diagnosis/
│   │   ├── index.html             ← 診断LP入口
│   │   ├── check.html             ← 診断質問
│   │   ├── result.html            ← 診断結果
│   │   ├── terms.html             ← 利用規約
│   │   ├── css/style.css          ← 診断専用CSS
│   │   └── js/app.js              ← 診断ロジック
│   ├── contact/index.html         ← お問い合わせ（仮）
│   ├── privacy/index.html         ← プライバシーポリシー（構成案）
│   ├── report/index.html          ← レポート（仮）
│   ├── assets/images/             ← トップLP画像
│   ├── css/style.css              ← 未使用（削除候補）※1
│   ├── js/main.js                 ← トップLP JS
│   ├── 404.html
│   ├── robots.txt
│   └── sitemap.xml
├── vercel.json                    ← Vercel設定
├── .gitignore
└── README.md
```

> ※1 `public/css/style.css` はどのHTMLからも参照されていない未使用ファイル。
> トップLPはTailwind CDN + インラインスタイルで完結。削除しても動作に影響なし。

---

## 1. GitHub push 手順

### 前提
- Git がインストール済み
- GitHub アカウントあり

### 手順

```bash
# ① GTN_LP フォルダに移動
cd GTN_LP

# ② Git 初期化（初回のみ）
git init

# ③ メインブランチ名を設定
git branch -M main

# ④ 全ファイルをステージング
git add -A

# ⑤ 初回コミット
git commit -m "初回コミット：トップLP + 診断LP統合版"

# ⑥ GitHub でリポジトリ作成
#    → https://github.com/new
#    → リポジトリ名: GTN_LP（推奨）
#    → Private 推奨
#    → README は追加しない（すでにあるため）

# ⑦ リモート追加（GitHubで表示されるURLに置き換え）
git remote add origin https://github.com/YOUR_USERNAME/GTN_LP.git

# ⑧ push
git push -u origin main
```

### push後の確認
GitHub上で以下を確認：
- `public/index.html` が見えるか
- `public/diagnosis/` フォルダがあるか
- `vercel.json` がルートにあるか

---

## 2. Vercel デプロイ手順

### 手順（所要時間：約3分）

1. **https://vercel.com にログイン**
   - GitHubアカウントでログイン推奨

2. **「Add New Project」をクリック**

3. **GitHubリポジトリ「GTN_LP」を Import**

4. **Project Settings を以下のように設定：**

   | 設定項目 | 値 |
   |---------|-----|
   | **Framework Preset** | `Other` |
   | **Root Directory** | `.`（デフォルトのまま） |
   | **Build Command** | 空欄（何も入力しない） |
   | **Output Directory** | `public` ← **必ず入力** |

   > **最重要：Output Directory に `public` を入力すること。**
   > これを忘れるとサイトが表示されません。

5. **「Deploy」をクリック**

6. **デプロイ完了後、表示されるURLでサイト確認**
   - 例: `https://gtn-lp-xxxxx.vercel.app`

---

## 3. 独自ドメイン設定

### 3-1. Vercel側

1. Vercelダッシュボード → プロジェクト → **Settings** → **Domains**
2. `globaltalent-navi.com` を入力 → **Add**
3. Vercelが表示するDNS設定をメモ

### 3-2. DNS側（ドメイン管理画面）

| レコード種別 | ホスト名 | 値 |
|-------------|---------|-----|
| **A** | `@` | `76.76.21.21` |
| **CNAME** | `www` | `cname.vercel-dns.com` |

> Vercelダッシュボードに表示される値を優先してください。
> 上記は一般的な値です。

### 3-3. STUDIO からの切り替え

現在 `globaltalent-navi.com` がSTUDIOに向いている場合：

1. **STUDIOのカスタムドメイン設定を解除**（STUDIO管理画面 → ドメイン → 削除）
2. **DNS の A / CNAME レコードを Vercel の値に変更**
3. 反映待ち（通常5分〜最大48時間、多くの場合30分以内）
4. Vercelダッシュボードで「Valid Configuration」と表示されればOK

**ダウンタイムを最小化するには：**
- 先にVercelのデプロイを完了させる
- DNS変更 → STUDIO解除の順番で行う（逆だとダウンタイムが長くなる）
- 深夜帯に実施推奨

### 3-4. HTTPS

- Vercelが自動でLet's Encrypt SSL証明書を発行
- 設定不要。DNS反映後に自動適用される

---

## 4. 公開前の確認事項

### 公開ブロッカー判定

| 項目 | 影響 | 判定 | 理由 |
|------|------|------|------|
| OGP画像未配置 | SNSシェア時に画像なし | **後回しOK** | サイト自体の表示・機能に影響なし |
| GAS_URL未確認 | 診断レポートが届かない可能性 | **後回しOK** | 診断自体は動く。レポート送信だけの問題 |
| CONSULT_URL不一致 | 予約先が違う可能性 | **後回しOK** | リンク自体は有効。どちらもGoogle Calendar |
| プライバシー未完成 | 法務リスク | **後回しOK** | 構成案は入っている。正式文は後日差替可能 |
| お問い合わせ仮ページ | フォーム未配置 | **後回しOK** | ページ自体は表示される |

**結論：上記はいずれも公開を止めるほどの問題ではない。公開してから順次対応可能。**

### 外部URL一覧（確認推奨）

| URL変数 | 場所 | 用途 |
|---------|------|------|
| `GAS_URL` | `diagnosis/js/app.js` L15 | 完全版レポートをメール送信するGASエンドポイント |
| `CONSULT_URL` | `diagnosis/js/app.js` L18 | 診断結果内の「無料相談」予約リンク |
| 無料相談リンク | `public/index.html` 3箇所 | トップLPの「無料相談」予約リンク |

> トップLPとdiagnosisで異なるGoogle Calendar URLを使用中。
> 同じ予約枠か意図的な分離か確認推奨。

---

## 5. OGP画像の仕様

| 項目 | 値 |
|------|------|
| ファイル名 | `ogp.png` |
| 配置場所 | `public/assets/images/ogp.png` |
| 推奨サイズ | **1200 x 630px** |
| フォーマット | PNG推奨 |
| ファイルサイズ | 1MB以下 |
| 内容案 | ロゴ + キャッチコピー + ネイビー背景 |

**対応するmetaタグ：**
```html
<!-- public/index.html -->
<meta property="og:image" content="https://globaltalent-navi.com/assets/images/ogp.png">
<meta name="twitter:image" content="https://globaltalent-navi.com/assets/images/ogp.png">
```

配置後は [Facebook OGPデバッガー](https://developers.facebook.com/tools/debug/) で確認。

---

## 6. 公開後チェックリスト

```
【表示確認】
- [ ] /                     → トップLP表示・画像・レイアウト
- [ ] /diagnosis            → 診断LP表示・CSS適用
- [ ] /diagnosis/check.html → 質問ページ・プログレスバー
- [ ] /contact              → お問い合わせページ表示
- [ ] /privacy              → プライバシーポリシー表示
- [ ] /report               → レポートページ表示
- [ ] /404.html             → 404エラーページ
- [ ] /xxxxx（存在しないURL）→ 404にフォールバック

【機能確認】
- [ ] 診断フロー通し: /diagnosis → check → 全10問回答 → result
- [ ] 結果ページ: スコア・4軸分析・レポートフォーム表示
- [ ] トップLPの「60秒で診断」→ /diagnosis に遷移
- [ ] トップLPの「無料相談」→ Google Calendar が開く
- [ ] フッターの「プライバシーポリシー」→ /privacy
- [ ] フッターの「お問い合わせ」→ /contact

【モバイル】
- [ ] トップLP: スマホ表示崩れなし
- [ ] 診断LP: スマホで全問回答可能
- [ ] 結果ページ: スマホ表示崩れなし

【OGP】（ogp.png配置後）
- [ ] Facebook OGPデバッガーで画像表示
- [ ] Twitter Card Validatorで画像表示
```

---

## 7. 公開後にやること（優先順）

1. OGP画像を作成して `public/assets/images/ogp.png` に配置 → push
2. GAS_URL / CONSULT_URL の有効性を確認
3. プライバシーポリシーの正式文面を差し替え
4. お問い合わせフォーム埋め込み
5. GTMタグ設置（`index.html` 内のコメント箇所に貼り付け）
6. 旧URL（gtn-diagnosis.vercel.app）からのリダイレクト設定

---

## ローカル確認方法

```bash
cd public
python -m http.server 8080
# → http://localhost:8080 で確認
```

- ローカルでは `/diagnosis` 等のルート相対パスが動かない場合があります
- `public/diagnosis/index.html` を直接開いて個別確認可能

---

## 技術構成

- **トップLP**: Tailwind CSS (CDN) + インラインスタイル + vanilla JS
- **診断LP**: 独自CSS変数体系 + vanilla JS（完全独立構造）
- **フォーム連携**: Google Apps Script (GAS)
- **予約リンク**: Google Calendar Appointments

---

## 注意事項

- **診断LP（/diagnosis）は完全独立構造。CSS/JSをトップLPと統合しないこと**
- `public/css/style.css` は**未使用ファイル（削除候補）**
- `vercel.json` の `outputDirectory: "public"` は Vercel UI でも重複設定OK（害なし）

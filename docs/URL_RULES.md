# GTN URL / デプロイ構成ルール（重要）

## ■ 現在の構成

### ① トップLP
- リポジトリ: GTN_LP
- ドメイン: https://www.globaltalent-navi.com
- Vercelプロジェクト: globaltalent-navi

### ② 診断ページ
- 同一リポジトリ内: /public/diagnosis/index.html
- 本番URL: https://www.globaltalent-navi.com/diagnosis/

### ③ 別プロジェクト（旧 or テスト）
- URL: https://gtn-diagnosis.vercel.app
- 状態: ルート / に診断ページあり
- /diagnosis/ は存在しない
- 今後は基本使用しない

---

## ■ ルール（絶対）

### ① CTAリンク
必ずこれを使う：
https://www.globaltalent-navi.com/diagnosis/

使用禁止：
- gtn-diagnosis.vercel.app
- /diagnosis.html
- 相対パス（/diagnosis/ 以外）

---

### ② URL設計
- フォルダ型URLを使用（/diagnosis/）
- .html直リンクは禁止

---

### ③ デプロイの考え方

| 修正対象 | 触る場所 |
|----------|--------|
| トップLP | GTN_LP |
| 診断ページ | GTN_LP（/public/diagnosis） |
| gtn-diagnosis | 基本触らない |

---

### ④ トラブル時チェック

#### 404が出たら
1. URLが globaltalent-navi.com か確認
2. /diagnosis/ になっているか確認
3. Vercelデプロイが完了しているか確認

---

## ■ 今回の教訓

- ローカル構成と本番デプロイ先は必ず一致するとは限らない
- ドメイン単位でどのリポジトリが紐づいているかを確認する
- 別Vercelプロジェクトは混乱の原因になる

---

## ■ 今後の方針

- globaltalent-navi.com に統一
- 診断・LP・今後の機能も同一ドメインで管理
- 別プロジェクトは原則使わない

# 中小企業診断士 過去問トレーナー — TWA リリース手順

このフォルダは、Web アプリ（PWA）を **TWA（Trusted Web Activity）** として
Google Play にリリースするための一式です。

```
shindanshi-twa/
├─ index.html                ← アプリ本体（UI/UX改善・解説の記号除去 済み）
├─ manifest.webmanifest      ← PWA マニフェスト
├─ sw.js                     ← Service Worker（オフライン対応）
├─ icons/                    ← アプリアイコン（192/512 + maskable）
│   ├─ icon-192.png
│   ├─ icon-512.png
│   ├─ icon-192-maskable.png
│   └─ icon-512-maskable.png
└─ .well-known/
    └─ assetlinks.json       ← Digital Asset Links（要編集：後述）
```

---

## 0. 今回の修正内容

### 解説の不整合（最重要）
- 選択肢は出題ごとにシャッフルされるため、解説本文の「よってアが正しい」等の
  **選択記号への言及が表示順と食い違う**問題があった。
- 解説本文中の選択記号（ア・イ・ウ…）への言及を**内容ベースの表現へ自動変換**し、
  記号を一切含まない解説に修正（render時に動作。全452問で検証済み・残存0件）。
  - 例:「よってイが正しい」→「よってこれが正しい」
  - 例:「正解はウ」→「正解は上記のとおり」
  - 例:「ア・エは相続税を含む」→「これらの選択肢は相続税を含む」
  - カタカナ語（コア／ストア等）や「3カ月」等のカウンターは誤変換しません。
- 「選択肢別解説」のバッジ（ア/イ…）はシャッフル後の**表示順に追従**するため食い違いません。

### UI/UX・PWA まわり
- ビューポートを `viewport-fit=cover` 化、ヘッダーに safe-area インセット
  （ノッチ／Android 15 のエッジ・トゥ・エッジ既定に対応）。
- 起動時のローディング表示（スピナー）を追加し、初回コンパイル中の白画面を解消。
- 過剰スクロール（バウンス）・タップ時ハイライト抑制、`touch-action: manipulation` で
  ダブルタップズームによる遅延を排除。
- マニフェスト／SW／アイコンの参照を**相対パス**化（サブディレクトリ配信でも動作）。
- 「もう一度」等で選択肢が確実に再シャッフルされるよう、出題ごとに再マウント。
- 一覧画面の解説パースをメモ化（検索フィルタ時の再計算を軽減）。

> 元の `Downloads/index.html` も同じ内容に更新済みです。配信にはこのフォルダを使ってください。

---

## 1. PWA を HTTPS で公開する

TWA は「公開済みの PWA」をラップする方式なので、まず Web を HTTPS で配信します。
このフォルダの中身を**そのままサイトのルート**に置いてください。無料で使える例：

- **Vercel** … このフォルダをドラッグ＆ドロップ、または `vercel` CLI でデプロイ
- **Netlify** … フォルダをドラッグ＆ドロップでデプロイ
- **Cloudflare Pages / GitHub Pages / Firebase Hosting** など

公開後、以下が表示・取得できることを確認：

- `https://<あなたのドメイン>/` … アプリが起動する
- `https://<あなたのドメイン>/manifest.webmanifest`
- `https://<あなたのドメイン>/sw.js`
- `https://<あなたのドメイン>/.well-known/assetlinks.json`（中身は後で編集）

> GitHub Pages 等は `.well-known` フォルダもそのまま配信されます。配信されない場合は
> ホスティング側で `/.well-known/assetlinks.json` を `application/json` で返す設定を行ってください。

---

## 2. PWA として妥当か確認（任意だが推奨）

Chrome の DevTools → Lighthouse →「PWA」、または `https://www.pwabuilder.com/` に
URL を入れてスコアを確認。manifest とアイコン、Service Worker が認識されれば OK。

---

## 3. TWA（Androidアプリ）を生成する

### 方法A：PWABuilder（最も簡単・GUI）
1. https://www.pwabuilder.com/ を開き、公開した URL を入力。
2. 「Package For Stores」→「Android」→ **Generate Package**。
3. パッケージ名（例 `com.あなたの会社.shindanshi`）を設定してダウンロード。
4. 生成物に **署名鍵（signing key）** と、`assetlinks.json` に貼るべき
   **SHA-256 フィンガープリント**が含まれます（`signing-key-info` 等）。控えておく。

### 方法B：Bubblewrap（CLI・細かく制御したい場合）
事前に Node.js / JDK / Android SDK が必要です。
```bash
npm i -g @bubblewrap/cli
bubblewrap init --manifest https://<あなたのドメイン>/manifest.webmanifest
# パッケージ名・各種設定を対話で入力。署名鍵もここで作成される。
bubblewrap build
# → app-release-signed.aab（Playにアップロードする成果物）が生成される
```
署名鍵の SHA-256 は次で取得：
```bash
keytool -list -v -keystore android.keystore -alias <作成したエイリアス>
# 表示される SHA256: の値を控える
```

---

## 4. Digital Asset Links を設定する（URLバーを消す肝）

`(.well-known/)assetlinks.json` の 2 か所を、手順3で得た値に**置換**します。

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.あなたの会社.shindanshi",
      "sha256_cert_fingerprints": ["AB:CD:EF:...（手順3のSHA-256）"]
    }
  }
]
```

> Google Play の「**Play アプリ署名**」を使う場合は、Play Console →
> 「リリース > 設定 > アプリの署名」に表示される **アプリ署名鍵証明書の SHA-256** を
> 使ってください（アップロード鍵ではなく**アプリ署名鍵**の方）。これを間違えると、
> 配信版でアドレスバーが消えません。複数フィンガープリントを配列に併記しても可。

編集後、`https://<あなたのドメイン>/.well-known/assetlinks.json` を再公開し、
ブラウザで開いて中身が正しいか確認。検証ツール：
`https://developers.google.com/digital-asset-links/tools/generator`

---

## 5. Google Play にアップロード

1. Google Play Console で新規アプリを作成（言語：日本語、アプリ名：過去問トレーナー 等）。
2. 内部テスト等のトラックに、手順3の **`.aab`** をアップロード。
3. ストア掲載情報（説明・スクリーンショット・プライバシーポリシー URL 等）を入力。
   - 512×512 アイコンは `icons/icon-512.png` を利用可。
   - フィーチャーグラフィック（1024×500）は別途用意が必要。
4. 審査に提出 → 公開。

インストール後、アプリ起動時に**アドレスバーが表示されない**＝ assetlinks 検証成功です。
表示されてしまう場合は手順4のフィンガープリント／パッケージ名を見直してください。

---

## 6. 既知の制限・推奨改善

- **初回起動がやや重い**：本アプリは React/Babel を**ブラウザ内でコンパイル**しています
  （2.4MB）。Service Worker のキャッシュで2回目以降は速くなりますが、毎回コンパイルが走ります。
  本格運用では、ビルド時に JSX を事前トランスパイルして `babel-standalone` を外すと、
  起動が大幅に速くなります（今回はビルド環境非依存のため現状維持）。スピナー表示で
  体感を緩和済みです。
- **学習履歴**は端末の localStorage に保存されます（端末／ブラウザ単位）。TWA でも保持されます。
- 図表は学習用に公式図を再現したものです。

---

## 動作確認用：ローカル配信

ローカルで挙動を見たい場合は、このフォルダを任意の静的サーバで配信してください
（`file://` 直開きでは Service Worker と manifest が無効になります）。例：
- VS Code 拡張「Live Server」
- 任意の静的ホスティングへ仮アップロード

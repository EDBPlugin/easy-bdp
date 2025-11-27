# Easy Discord Bot Builder BETA 共有URL機能 設計書

## 1. 背景と目的
- 現行の BETA 版では、ブロックレイアウトの受け渡しに XML ファイルのインポート / エクスポートが必要だった。
- ユーザーから「共有ボタンを押すだけで現在のレイアウトを URL として渡したい」という要望が挙がった。
- 追加のバックエンドを用意せず、フロントエンドだけで完結させることが前提。

## 2. 要件
### 機能要件
- `beta/jsonbeta/index.html` のヘッダー右側に `id="shareBtn"` のボタンを配置する。
- ボタン押下時に現在の Blockly ワークスペースを URL クエリ `share=` に圧縮し、コピー＋共有できるようにする。
- クエリつき URL（例: `https://example.com/beta/jsonbeta/?share=<encoded>`）を開くと、即座にブロックレイアウトが反映される。
- エラーや異常データ検出時は、共有モーダルで状態を通知しつつローカル保存されたレイアウトへフォールバックする。

### 非機能要件
- URL クエリは 2〜3 KB を目安に抑える。標準的なブロック数なら DM 等に貼っても崩れないこと。
- 依存ライブラリは CDN 読み込みのみで完結し、ビルド手順を増やさない。
- 最新の Chromium / Firefox / Safari をサポート。`navigator.clipboard` が使えない場合は共有モーダルでリンク入力を表示する。

## 3. UX仕様
1. **共有ボタン**  
   - `shareBtn` は `showCodeBtn` と同じインジゴ系スタイル。Lucide `share-2` アイコン＋ラベル「共有」を表示する。
2. **共有モーダル**  
   - Code Generation Modal と同じクラス構成（`modal-backdrop` ＋ `modal-content`）で、モバイルでも崩れない。
   - `shareModalInput` にリンクを表示し、常に `https...` の冒頭が見えるよう `dir="ltr"` ＋ フォーカス時の全選択を実装。
   - `shareModalCopyBtn` を押すとクリップボードへ再コピーできる。モーダルはコピー後も閉じない。
3. **ステータスピル**  
   - `shareStatus` は `saveStatus` と同じ Tailwind の data 属性トランジション（`data-show` / `data-state`）を使い、成功/失敗を色で示す。

## 4. データエンコード方式
- ライブラリ: [lz-string](https://www.npmjs.com/package/lz-string) の `compressToEncodedURIComponent` / `decompressFromEncodedURIComponent` を利用。
- 共有 URL の生成手順:
  1. `Blockly.Xml.workspaceToDom(workspace)` → `Blockly.Xml.domToText(...)` で XML 文字列を取得。
  2. `compressToEncodedURIComponent(xmlText)` で URI セーフな文字列に圧縮。
  3. ベース URL（`origin + pathname`）に `?share=<encoded>` を付加する。
  4. エンコード結果が空 or 失敗した場合は例外を投げ、共有処理を中断する。

## 5. 読み込みフロー
1. `initializeApp` 内でローカルストレージ復元より先に `applySharedLayoutFromQuery()` を実行する。
2. `applySharedLayoutFromQuery()`:
   - `const params = new URLSearchParams(location.search);`
   - `const encoded = params.get('share');`
   - 値があれば `LZString.decompressFromEncodedURIComponent(encoded)` で XML を復元し `WorkspaceStorage.applyText()` で読み込む。
   - 成功時は `storage.save()`（内部でJSON化）→ `history.replaceState({}, '', location.pathname);`
   - 失敗時は `shareStatus` を `error` で表示し、クエリのみ削除して false を返す。
3. false が返った場合のみローカルストレージの XML を読み込む。

## 6. JavaScript 実装（`beta/jsonbeta/script.js`）
- 新規ロジックは `share.js` に分離し、`initShareFeature()` を呼び出して `applySharedLayoutFromQuery` を受け取る。
- `shareBtn` → `generateShareUrl()` → `toggleShareModal(true, url)` → `tryCopyToClipboard(url)` → `showShareStatus(...)` の順で動作。
- 共有モーダルでは `ensureUrlVisible()` を共通化し、フォーカス/クリック/コピー時に冒頭文字列が常に見えるようにする。

## 7. HTML / CSS 変更（`beta/jsonbeta/index.html`, `beta/jsonbeta/style.css`）
- `shareStatus` は純粋に Tailwind の data 属性トランジションを使用するため、CSS は不要。
- 共有モーダル (`shareModal`) は Code Modal と同じ `modal-backdrop` / `modal-content` を利用し、DOM だけで見た目を統一。
- 旧フォールバック用の `shareFallbackModal` / 専用 CSS は削除済み。

## 8. テスト観点
1. **共有→読み込み**
   - 大小さまざまなワークスペースで `share=` クエリを生成し、新規タブで開いて再現されるか。
   - 共有 URL を開いた後、クエリ文字列が履歴 API でクリアされるか。
2. **エラーハンドリング**
   - `share=` に無効文字列を与えてもクラッシュせず、既存レイアウトにフォールバックするか。
   - クリップボードアクセスが拒否された環境でモーダルが常に表示され、手動コピーできるか。
3. **UI / 互換性**
   - 共有モーダルの開閉アニメーション・閉じる手段（×, 背景クリック, Esc）が Code Modal と揃っているか。
   - ライト/ダーク両テーマで新しいコンポーネントの色味が破綻しないか。
4. **回帰**
   - 自動保存 (`STORAGE_KEY`) やレイアウト切り替え（Blocks/Split）に副作用がないか。
   - 既存のインポート/エクスポート、コード生成モーダルと干渉しないか。

## 9. 実装タスクまとめ（完了済み）
1. `beta/jsonbeta/index.html` に共有ボタン・ステータスピル・共有モーダル DOM・LZString CDN を追加。
2. `beta/jsonbeta/style.css` から共有専用 CSS を排除し、既存ユーティリティで見た目を統一。
3. `beta/jsonbeta/share.js` を新設し、クエリ生成 / 共有モーダル制御 / クリップボード処理 / クエリ読み込みを実装。
4. `beta/jsonbeta/script.js` で `initShareFeature()` を呼び出し、初期化シーケンスに共有処理を組み込んだ。

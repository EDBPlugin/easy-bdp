# Easy Discord Bot Builder 共有URL機能 設計書

## 1. 背景と目的
- XML のインポート/エクスポートから脱却し、フロントエンド単体で共有が完結することを目指す。
- URL を受け取って即座に閲覧できる「閲覧モード」を導入し、意図せぬ編集や保存を防ぐ。
- 共有リンクを起点にサムネイル画像コピーや短縮 URL, SNS 共有など、その他の共有フローも一箇所で扱う。

## 2. 要件
### 機能要件
- `editor/index.html` ヘッダーに `id="shareBtn"` を配置し、クリックで共有モーダル（`shareModal`）を開く。
- URL 生成時は `WorkspaceStorage.exportMinified()` で `share=` 用の圧縮文字列を得てベース URL（`origin + pathname`）に付加する。
- モーダル内では URL を `shareModalInput` に表示し、`shareModalCopyBtn` で再コピーでき、`shareModalXBtn` から X（旧Twitter）共有が行える。
- モーダルが開いたら `ShareThumbnailManager` が Blockly キャンバスを SVG→PNG 化し、`shareThumbnailImage` にプレビューを差し込み、`shareThumbnailCopyBtn` で画像コピーを行う。
- `shareBtn` 押下後にバックグラウンドで `https://share.himais0giiiin.com/share/create` へ POST し、短縮 URL が返ればモーダルに差し替える（失敗時は通常 URL を表示する）。
- `shareStatus` ピルを使って成功/失敗メッセージを 2.5 秒表示する。既存の `saveStatus` と共存する。
- URL `?share=<encoded>` 付きでアクセスした場合は `ShareImportModalController.applySharedLayoutFromQuery()` が発火し、`storage.importMinified(encoded)` によって共有レイアウトを読み込む。
- 読み込み後は `ShareViewStateController` が閲覧モードを有効化し、`shareViewOverlay` を表示して Blockly ツールボックスやブロック操作を不可にする。自動保存も抑止する。
- `shareViewStartEditingBtn` を押すと共有内容で編集を再開するための確認モーダル（`shareImportModal`）を開き、`shareImportConfirmBtn` で編集開始、`shareImportCancelBtn` や背景クリック/Esc でキャンセルする。
- 共有インポート確認モーダルには `shareImportDownloadBtn`（共有内容を JSON としてダウンロード）、`shareImportSkipCheckbox`（localStorage `share_import_dialog_skip` で常にスキップ）を備える。
- モーダルのどのキャンセル経路でも `shareStatus` に通知を出し、閲覧モードは維持。編集開始を確定した場合のみクエリを `history.replaceState` で削除し、自動保存を再開する。

### 非機能要件
- 共有クエリの目安サイズは 2〜3 KB。短縮 API が利用不可でもアプリ本体は機能する。
- クリップボード API や `ClipboardItem` が使えない環境では画像コピーをエラーメッセージで案内し、リンクコピーのみ提供する。
- 追加ライブラリは既存 CDN（Blockly, Tailwind, Lucide, Highlight.js, LZ-String）のみ。ビルド手順は不要。
- 最新 Chromium / Firefox / Safari で `navigator.clipboard`（write / writeText）が失敗した場合は UI 上で失敗を告知する。

## 3. UX仕様
1. **共有ボタン & ステータス**
   - `shareBtn` は `showCodeBtn` と揃えたインディゴ系／透過ボーダーのトグルボタン。Lucide `share-2` アイコン＋「共有」ラベルを持ち、`aria-busy` を付与して多重起動を防ぐ。
   - `shareStatus` は Tailwind data 属性でフェードするピル。`shareStatusText` を差し替えて状態を示し、`data-state` で色を切り替える（成功=エメラルド, 失敗=ローズ, 情報=インディゴ）。
2. **共有モーダル (`shareModal`)**
   - Code Modal と同じ `modal-backdrop` 構成。`shareModalInput` は `dir="ltr"` で常に冒頭が見えるよう `ensureUrlVisible()` で全選択＆スクロールリセット。
   - `shareModalCopyBtn` はリンク再コピーとトースト表示を行い、`shareModalXBtn` は `https://x.com/intent/tweet` に `Easy Discord Bot BuilderでDiscord BOTを作成しました！ #EDBB` テキスト＋URL を付加して別タブで開く。
3. **サムネイルプレビュー (`ShareThumbnailManager`)**
   - `shareThumbnailWrapper` 内で読み込みステータス→生成済み画像→エラー表示を切り替える。
   - ブロックが一つも無い / キャンバスが取得できない場合は `NO_BLOCKS_FOUND` などの例外を表示用メッセージへ変換する。
   - `shareThumbnailCopyBtn` で PNG のクリップボードコピーを試み、権限が無い場合は `shareStatus` にエラーを出す。
4. **閲覧モード (`shareViewOverlay`)**
   - 共有 URL を開くとヘッダー下部にガードカードを表示し、「閲覧モード」ラベルと説明文、「編集を開始」ボタンを提供。
   - モード中はツールボックスの表示切替ボタン（`toolboxPinBtn`）も非表示、すべてのブロックを `setMovable(false)` / `setEditable(false)` / `setDeletable(false)`、ツールボックスの `setVisible(false)` を行う。
5. **共有インポート確認 (`shareImportModal`)**
   - `shareImportConfirmBtn`（実行）、`shareImportCancelBtn`（キャンセル）、`shareImportDownloadBtn`（ダウンロード）、`shareImportModalClose`（右上×）を用意。
   - `shareImportSkipCheckbox` で「次回から表示しない」を制御し、`shareViewStartEditingBtn` から直接確認を飛ばせるようにする。
   - モーダルは背景クリック/Esc で閉じる。閉じる際は 300ms のフェードアニメーションを合わせる。

## 4. データエンコード方式
- `WorkspaceStorage.exportMinified()` / `importMinified()` は内部で Blockly XML を LZ-String の `compressToEncodedURIComponent` / `decompressFromEncodedURIComponent` して JSON 保存との整合をとる。
- 共有 URL の生成手順:
  1. `storage.exportMinified()` で共有用の圧縮済み文字列を得る（空文字なら `ENCODE_FAILED` で例外）。
  2. `buildShareUrl()` が `origin+pathname` を基準に `?share=<encoded>` を付加。`origin` が `null` の場合は `location.href` からクエリ/ハッシュを除いた値を使う。
  3. `createShortShareUrl(encoded)` が短縮 API へ JSON `{"share": "<encoded>"}` を POST。`response.ok` で無い／`url` プロパティが無い場合は例外を投げて通常 URL にフォールバックする。
- `storage.importMinified(encoded)` が false / 例外の場合は読込失敗とみなす。`cleanupShareQuery()` で `history.replaceState({}, '', location.pathname)` によりクエリを消す。

## 5. 読み込みフロー
1. `initializeApp` で Blockly と `WorkspaceStorage` を初期化後、`const shareFeature = initShareFeature({ workspace, storage })` を呼び出す。
2. `shareFeature.applySharedLayoutFromQuery()` をローカルストレージ復元前に実行し、true を返せば閲覧モードのまま待機。false の場合のみ `storage.load()` を行う。
3. 閲覧モード中は `shareFeature.isShareViewMode()` を通じて自動保存やツールボックスピンボタンなどの挙動を抑止する。`onShareViewModeChange()` で UI（`toolboxPinBtn` など）を同期。
4. `shareViewStartEditingBtn` →（必要なら）`shareImportModal` で確認 → `shareImportConfirmBtn` で `tryImportEncodedPayload` を再実行 → 閲覧モード解除→クエリ削除→自動保存/ツールボックス復帰。
5. 共有ボタン押下では `exportSharePayload()`→モーダル表示→短縮 URL 取得→結果をモーダルへ反映。成功/失敗はいずれも `shareStatus` でフィードバックする。

## 6. JavaScript 実装（`editor/share.js`）
- `SharePreferenceManager`: `share_import_dialog_skip` フラグを localStorage に読み書きする。
- `ShareStatusNotifier`: `shareStatus` / `shareStatusText` を制御し、タイマーで自動非表示にする。
- `ShareViewStateController`: Blockly ツールボックス・ブロック操作・`shareViewOverlay` の開閉を管理し、閲覧モード変化を購読できる。
- `ShareThumbnailManager`: モーダル開閉フック、SVG→PNG キャプチャ、プレビュー UI 切り替え、画像コピーを担う。
- `ShareModalController`: 共有ボタン、モーダル開閉、URLコピー、`x.com` 共有、短縮 URL 作成、`ensureUrlVisible()` をまとめる。
- `ShareImportModalController`: 共有 URL 経由で起動する閲覧モーダル・開始/キャンセル/ダウンロード/Skip 設定を実装し、`pendingShareEncoded` を管理する。
- `ShareFeature`: 上記コンポーネントを束ね、外部向け API（`applySharedLayoutFromQuery`, `isShareViewMode`, `onShareViewModeChange`）を公開する。

## 7. HTML / CSS 変更
- `editor/index.html` に以下の DOM を用意済み：`shareStatus`, `shareBtn`, `shareViewOverlay`, `shareImportModal`, `shareModal`, サムネイル領域（`shareThumbnailWrapper`, `shareThumbnailImage`, `shareThumbnailCopyBtn`）。
- モーダルは Code Modal と同じ `modal-backdrop` + Tailwind クラスを共有するため、追加 CSS は不要。閲覧モードのガードカードは `data-lucide` アイコンとグラデ背景で表現。
- `shareStatus` / `saveStatus` は Tailwind data 属性（`data-show` / `data-state`）のみでアニメーションする。

## 8. テスト観点
1. **共有→読み込み**
   - 標準/大規模ワークスペースで `share=` クエリを生成し、新規タブで開いた際に閲覧モードが立ち上がるか、`編集を開始`→`確認` で編集モードへ移行できるか。
   - 閲覧モード解除と同時に URL クエリが `history.replaceState` で除去されているか。
2. **クリップボード / サムネイル**
   - `navigator.clipboard.write` / `writeText` 不可な環境でボタンが graceful degradation するか、ステータストーストが適切に表示されるか。
   - ブロック無し / 背景のみの状態でキャプチャがエラーメッセージへ切り替わるか。
3. **短縮 URL**
   - 正常時に短縮 URL がセットされ、失敗時には通常 URL, エラートースト, console.error のみで処理が継続するか。
4. **共有インポート確認**
   - `shareImportModal` の各ボタン（確認/キャンセル/ダウンロード/×/背景/Esc）で状態が切り替わるか、Skip チェック時に localStorage が更新されるか。
   - モーダルが閉じても閲覧モードは維持され、自動保存が動作しないことを確認。
5. **回帰**
   - 自動保存・レイアウト切替・インポート/エクスポート・コード生成モーダルと干渉しないか。
   - `shareViewMode` が false の際のみ `storage.save()` が走ること。

## 9. 実装タスクまとめ（完了）
1. `editor/index.html` に共有ボタン / ステータスピル / 閲覧モードオーバーレイ / 共有モーダル / 共有インポートモーダル / サムネイルセクション / LZ-String CDN を組み込んだ。
2. `editor/style.css`（共通 Tailwind ユーティリティ）でモーダル/ステータスのアニメーションを統一し、個別 CSS を追加しなくても見た目が揃うよう調整した。
3. `editor/share.js` に共有ロジック（URL生成・短縮 API・クリップボード・サムネイル・閲覧モード制御・インポート確認）を実装し、`initShareFeature()` で公開した。
4. `editor/script.js` から `initShareFeature()` を呼び出し、初期化シーケンスで共有クエリ読込→閲覧モード制御→自動保存抑止を統合した。***

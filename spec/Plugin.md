# EDBP プラグイン開発完全ガイド (Complete Guide)

EDBP (Easy Discord Bot Builder) の機能を拡張するためのプラグインを作成するための公式ガイドです。

---

## 1. クイックスタート

プラグインは、以下の2つのファイルを同梱したフォルダ（または ZIP 形式）で構成されます。

1.  **`manifest.json`**: プラグインのメタデータ。
2.  **`plugin.js`**: プラグインのロジックを記述した JavaScript ファイル。

GitHub で公開する場合は、リポジトリのルートにこれらのファイルを配置し、トピックに `edbp-plugin` を追加してください。

---

## 2. manifest.json の仕様 (改造版)

プラグインの情報を定義します。以下のフィールドが推奨されます。

```json
{
  "id": "my-custom-plugin",
  "name": "サンプルプラグイン",
  "version": "1.0.0",
  "author": "あなたの名前",
  "description": "このプラグインは新しいコマンドブロックを追加します。",
  "icon": "https://example.com/icon.png",
  "tags": ["utility", "commands"],
  "affectsStyle": false,
  "affectsBlocks": true,
  "repo": "https://github.com/YourName/my-plugin",
  "license": "MIT",
  "minAppVersion": "1.0.0"
}
```

### フィールド詳細

| フィールド | 型 | 必須 | 説明 |
| :--- | :--- | :--- | :--- |
| `id` | string | 任意 | システム内部で使用されるID。未指定時は名前から自動生成されます。 |
| `name` | string | **必須** | プラグインの表示名。 |
| `version` | string | **必須** | プラグインのバージョン。 |
| `author` | string | **必須** | 開発者名。 |
| `description`| string | 任意 | 短い説明文。 |
| `icon` | string | 任意 | アイコンのURLまたは絵文字。 |
| `tags` | string[] | 任意 | 検索に使用されるタグ。 |
| `affectsStyle`| boolean| **必須** | CSS等でUIに干渉するかどうか。 |
| `affectsBlocks`| boolean| **必須** | Blocklyブロックの追加・変更を行うかどうか。 |
| `repo` | string | 任意 | ソースコードのリポジトリURL（GitHubなど）。 |
| `license` | string | 任意 | ライセンス（例: MIT, Apache-2.0）。 |

---

## 3. plugin.js の実装

プラグインは、`Plugin` クラスをエクスポートする形式で記述します。

```javascript
class Plugin {
    /**
     * @param {Blockly.Workspace} workspace 
     */
    constructor(workspace) {
        this.workspace = workspace;
        this.styleElement = null;
    }

    /**
     * プラグインが有効化された時に実行される
     */
    async onload() {
        console.log("Plugin Loaded!");
        
        // 1. スタイルの追加
        this.applyStyles();

        // 2. ブロックの登録
        this.registerBlocks();
    }

    /**
     * プラグインが無効化または削除された時に実行される
     * ※必ずクリーンアップを行ってください
     */
    async onunload() {
        console.log("Plugin Unloaded");
        
        // スタイルの削除
        if (this.styleElement) {
            this.styleElement.remove();
        }

        // ブロックの削除（必要に応じて）
        // ※通常、Blockly.Blocksからの削除のみでOK
    }

    applyStyles() {
        const css = `
            .my-custom-block-style {
                color: #555;
            }
        `;
        this.styleElement = document.createElement('style');
        this.styleElement.textContent = css;
        document.head.appendChild(this.styleElement);
    }

    registerBlocks() {
        // ブロックの定義
        Blockly.Blocks['my_plugin_hello'] = {
            init: function() {
                this.appendDummyInput()
                    .appendField("こんにちは！");
                this.setPreviousStatement(true, null);
                this.setNextStatement(true, null);
                this.setColour(160);
            }
        };

        // コード生成ロジック (Python)
        // Blockly.Python はグローバルにアクセス可能です
        Blockly.Python['my_plugin_hello'] = function(block) {
            return 'print("Hello from Plugin!")\n';
        };
    }
}
```

---

## 4. 高度なテクニック

### 独自のツールボックスカテゴリ
既存のカテゴリにブロックを追加するだけでなく、独自のカテゴリを作成することも可能です。

### 外部ライブラリの利用
`onload` 内で `script` タグを動的に生成することで、外部 JS ライブラリを読み込めます。ただし、セキュリティ上の理由から推奨されません。

---

## 5. 公開とセキュリティ

### トピックの追加
GitHub リポジトリのトピックに **`edbp-plugin`** を追加してください。
EDBP の「GitHub で探す」機能で自動的にクロールされるようになります。

### ホワイトリスト（公認）について
公式チームによる審査を通過すると「公認」バッジが付与されます。
公認を受けたプラグインは、共有URL機能において制限なく利用できるようになります。

### セキュリティ上の注意点
*   `isCustom: true` に設定されている場合、セキュリティ保護のためそのプラグインを含むプロジェクトの「共有」が制限されることがあります。
*   ユーザーのトークンを外部に送信するような悪意のあるコードは、発見次第ブラックリストに登録され、実行がブロックされます。

---

---

## 7. プラグイン検索エンジン

EDBP のプラグイン検索では、以下のコマンドを使用することで高度なフィルタリングが可能です。

| コマンド | 説明 | 例 |
| :--- | :--- | :--- |
| `tag:` | 指定したタグ（トピック）で検索します。 | `tag:utility` |
| `author:` | 特定の開発者のプラグインを検索します。 | `author:YourName` |
| `badge:` | バッジ（信頼レベル）でフィルタリングします。 | `badge:公式`, `badge:公認`, `badge:使用不可` |

※複数のコマンドを組み合わせて使用することも可能です（例: `tag:utility badge:公式`）。

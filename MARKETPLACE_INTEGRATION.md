# EDBP Plugin Marketplace Integration

## 概要

このドキュメントは、EDBPプラグインマーケットプレイスをeasy-bdpプロジェクトに統合するための仕様を説明します。

## マーケットプレイスの役割

EDBPプラグインマーケットプレイスは、以下の機能を提供します：

1. **プラグイン検索・発見**：GitHub APIを通じて利用可能なプラグインを検索
2. **プラグイン情報表示**：manifest.json、README、依存関係などを表示
3. **インストール管理**：プラグインのインストール/アンインストール
4. **フィルタリング**：提供機能（ブロック、カテゴリ、スタイル）によるフィルタ

## データソース

### GitHub API連携

プラグインはGitHubで配布され、以下の情報を取得します：

- **Repository**：プラグインのGitHubリポジトリ
- **Release**：最新のバージョン情報
- **manifest.json**：プラグインのメタデータ
- **README.md**：プラグインの詳細説明

### 自動表示ルール

以下の条件を満たすプラグインが自動的にマーケットプレイスに表示されます：

- 公開リポジトリであること
- `manifest.json`が存在すること
- タグがSemVer形式（v1.0.0など）であること

## UI構成

### レイアウト

```
┌─────────────────────────────────────────────────┐
│ ヘッダー（ロゴ、検索バー）                      │
├──────────────┬──────────────┬──────────────────┤
│ フィルタ     │ プラグイン一覧 │ プラグイン詳細   │
│ パネル       │              │                 │
│              │              │                 │
│              │              │                 │
└──────────────┴──────────────┴──────────────────┘
```

### フィルタパネル

- すべて
- インストール済み
- ブロック提供
- カテゴリ提供

### プラグイン一覧

- プラグイン名
- 開発者名
- 説明（短縮版）
- インストール状態バッジ

### プラグイン詳細

- プラグイン名とバージョン
- 開発者情報
- 説明（完全版）
- 提供機能（ブロック、カテゴリ、スタイル、音楽）
- 依存関係
- 最終更新日
- アクション（インストール/アンインストール、GitHubリンク）

## 実装計画

### Phase 1: GitHub API統合

GitHub APIからプラグイン情報を取得するロジックを実装します。

```typescript
interface PluginManifest {
  schema: string;
  id: string;
  name: string;
  version: string;
  author: string;
  description?: string;
  entry: string;
  provides?: {
    blocks?: boolean;
    categories?: boolean;
    styles?: boolean;
    music?: boolean;
  };
  dependencies?: Array<{ id: string; version: string }>;
}

async function fetchPluginFromGitHub(owner: string, repo: string): Promise<PluginManifest> {
  // GitHub APIを使用してmanifest.jsonを取得
}
```

### Phase 2: キャッシング機構

パフォーマンス向上のため、プラグイン情報をキャッシュします。

- ローカルストレージ：インストール状態
- メモリキャッシュ：GitHub API応答（TTL: 1時間）

### Phase 3: UI統合

プラグインマーケットプレイスUIをeasy-bdpエディタに統合します。

- モーダルまたはサイドパネルで表示
- 既存のプラグインシステムと連動

## セキュリティ考慮事項

1. **プラグイン検証**：manifest.jsonのスキーマ検証
2. **依存関係チェック**：循環依存の検出
3. **サンドボックス実行**：プラグインのコード実行制限

## 将来の拡張

1. **プラグイン評価**：ユーザーによる評価・レビュー
2. **プラグイン推奨**：人気度、ダウンロード数に基づく推奨
3. **プラグイン署名**：セキュリティ向上のための署名検証
4. **ローカルマーケットプレイス**：オフライン環境での利用

## 参考資料

- [EDBP Plugin Wiki](https://github.com/EDBPlugin/EDBP-Plugin-wiki-jp/wiki)
- [GitHub API Documentation](https://docs.github.com/en/rest)

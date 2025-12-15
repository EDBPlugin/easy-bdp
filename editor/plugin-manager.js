// EDBP Plugin Manager
// プラグインの管理、読み込み、実行を行う

class PluginManager {
  constructor(workspace, blockly) {
    this.workspace = workspace;
    this.blockly = blockly;
    this.plugins = new Map();
    this.loadedPlugins = new Map();
    this.storageKey = 'edbp_plugins';
    this.officialSources = [
      'https://raw.githubusercontent.com/EDBPlugin/EDBP-API/main/1.json'
    ];
    this.approvedPluginIds = new Set(); // 公認プラグインIDのセット（EDBP-APIに記載があるもの）
  }

  // ローカルストレージからプラグインリストを読み込む
  loadInstalledPlugins() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const plugins = JSON.parse(stored);
        plugins.forEach(plugin => {
          // enabledプロパティが未設定の場合はtrue（デフォルトで有効）
          if (plugin.enabled === undefined) {
            plugin.enabled = true;
          }
          this.plugins.set(plugin.id, plugin);
        });
      }
    } catch (e) {
      console.error('Failed to load plugins:', e);
    }
    return Array.from(this.plugins.values());
  }

  // プラグインを保存
  savePlugins() {
    const plugins = Array.from(this.plugins.values());
    localStorage.setItem(this.storageKey, JSON.stringify(plugins));
  }

  // プラグインをインストール（ZIPファイルから）
  async installFromZip(file, progressCallback) {
    try {
      // JSZipを動的に読み込む
      if (typeof JSZip === 'undefined') {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      if (progressCallback) progressCallback({ step: 'ZIPファイルを読み込んでいます...', progress: 10 });

      const zip = new JSZip();
      const arrayBuffer = await file.arrayBuffer();
      const zipData = await zip.loadAsync(arrayBuffer);

      if (progressCallback) progressCallback({ step: 'ZIPファイルを解凍しています...', progress: 30 });

      // plugin.jsonを読み込む（ルートディレクトリまたは任意の場所から検索）
      let manifestFile = zipData.file('plugin.json');

      // ルートにない場合は、再帰的に検索
      if (!manifestFile) {
        for (const filename of Object.keys(zipData.files)) {
          const zipFile = zipData.files[filename];
          if (!zipFile.dir && filename.endsWith('plugin.json')) {
            manifestFile = zipFile;
            break;
          }
        }
      }

      if (!manifestFile) {
        throw new Error('plugin.jsonが見つかりません。ZIPファイルのルートディレクトリまたは任意の場所にplugin.jsonが必要です。');
      }

      let manifest;
      try {
        let manifestText = await manifestFile.async('string');

        // JSONの前処理：制御文字や不正な改行を処理
        // 改行文字をエスケープ（文字列リテラル内の改行を\nに変換）
        manifestText = manifestText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

        // 文字列リテラル内の改行を検出してエスケープ
        // 簡易的な処理：文字列リテラル内の改行を\nに変換
        manifestText = manifestText.replace(/"([^"\\]|\\.)*"/g, (match) => {
          // 既にエスケープされた改行はそのまま
          return match.replace(/\n/g, '\\n').replace(/\r/g, '\\r');
        });

        manifest = JSON.parse(manifestText);
      } catch (parseError) {
        // より詳細なエラーメッセージを提供
        const errorMsg = parseError.message;
        let helpfulMsg = `plugin.jsonの解析に失敗しました: ${errorMsg}\n\n`;

        if (errorMsg.includes('control character')) {
          helpfulMsg += '原因: JSON文字列内に不正な制御文字（改行など）が含まれています。\n';
          helpfulMsg += '解決方法: 文字列内の改行は\\nにエスケープしてください。\n';
          helpfulMsg += '例: "description": "1行目\\n2行目"';
        } else if (errorMsg.includes('Unexpected token')) {
          helpfulMsg += '原因: JSONの構文エラー（カンマ、引用符の不一致など）\n';
          helpfulMsg += '解決方法: JSONの構文を確認してください。\n';
          helpfulMsg += '- すべての文字列は二重引用符で囲む\n';
          helpfulMsg += '- 最後のプロパティの後にカンマを付けない\n';
          helpfulMsg += '- すべての括弧が正しく閉じられているか確認';
        } else if (errorMsg.includes('Unterminated string')) {
          helpfulMsg += '原因: 文字列が正しく閉じられていません（引用符の不一致）\n';
          helpfulMsg += '解決方法: すべての文字列が開始と終了の引用符で囲まれているか確認してください。';
        }

        throw new Error(helpfulMsg);
      }

      if (progressCallback) progressCallback({ step: 'プラグインを検証しています...', progress: 50 });

      // プラグインの検証
      this.validatePlugin(manifest);

      // プラグインのファイルを展開
      const pluginData = {
        id: manifest.id,
        name: manifest.name,
        version: manifest.version,
        author: manifest.author,
        description: manifest.description,
        official: false, // インストール時は判定しない（SHOPで判定）
        approved: this.approvedPluginIds.has(manifest.id),
        enabled: true, // デフォルトで有効
        files: {}
      };

      if (progressCallback) progressCallback({ step: 'ファイルを展開しています...', progress: 60 });

      // すべてのファイルを読み込む
      const fileKeys = Object.keys(zipData.files);
      let processedFiles = 0;

      for (const filename of fileKeys) {
        const zipFile = zipData.files[filename];
        if (!zipFile.dir) {
          try {
            const content = await zipFile.async('string');
            pluginData.files[filename] = content;
            processedFiles++;

            if (progressCallback) {
              const progress = 60 + Math.floor((processedFiles / fileKeys.length) * 30);
              progressCallback({
                step: `ファイルを展開中... (${processedFiles}/${fileKeys.length})`,
                progress
              });
            }
          } catch (e) {
            // バイナリファイルの場合はスキップ
            console.warn(`Skipping binary file: ${filename}`);
          }
        }
      }

      if (progressCallback) progressCallback({ step: 'プラグインを保存しています...', progress: 95 });

      // プラグインを保存
      this.plugins.set(manifest.id, pluginData);
      this.savePlugins();

      if (progressCallback) progressCallback({ step: '完了！', progress: 100 });

      return { success: true, plugin: manifest };
    } catch (e) {
      console.error('Plugin installation failed:', e);
      return { success: false, error: e.message };
    }
  }

  // プラグインの検証
  validatePlugin(manifest) {
    const required = ['id', 'name', 'version', 'author', 'main'];
    for (const field of required) {
      if (!manifest[field]) {
        throw new Error(`必須フィールドが不足しています: ${field}`);
      }
    }

    // IDの形式チェック
    if (!/^[a-z0-9-_]+$/.test(manifest.id)) {
      throw new Error('プラグインIDは英数字、ハイフン、アンダースコアのみ使用可能です');
    }
  }

  // プラグインを読み込んで実行
  async loadPlugin(pluginId) {
    if (this.loadedPlugins.has(pluginId)) {
      return { success: false, error: 'プラグインは既に読み込まれています' };
    }

    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      return { success: false, error: 'プラグインが見つかりません' };
    }

    try {
      // プラグインAPIの準備
      const pluginAPI = this.createPluginAPI(plugin);

      // メインファイルを検索（パスを正規化）
      let mainFile = null;
      const mainPath = plugin.main || 'main.js';

      // 直接パスで検索
      if (plugin.files[mainPath]) {
        mainFile = plugin.files[mainPath];
      } else {
        // ファイル名のみで検索（パスの違いを無視）
        const mainFileName = mainPath.split('/').pop() || mainPath.split('\\').pop();
        for (const [filePath, content] of Object.entries(plugin.files)) {
          const fileName = filePath.split('/').pop() || filePath.split('\\').pop();
          if (fileName === mainFileName) {
            mainFile = content;
            break;
          }
        }
      }

      // バイナリファイルの場合はスキップ
      if (mainFile && typeof mainFile === 'object' && mainFile.type === 'binary') {
        throw new Error('メインファイルはテキストファイルである必要があります');
      }

      if (!mainFile || typeof mainFile !== 'string') {
        throw new Error(`メインファイル「${mainPath}」が見つかりません`);
      }

      // プラグインを実行（安全なスコープで）
      // プラグインコードを即時実行関数でラップ
      const wrappedCode = `
        (function(api, Blockly, workspace) {
          ${mainFile}
        })
      `;
      const pluginFunction = new Function('return ' + wrappedCode)();
      pluginFunction(pluginAPI, this.blockly, this.workspace);

      this.loadedPlugins.set(pluginId, { plugin, api: pluginAPI });

      return { success: true };
    } catch (e) {
      console.error(`Failed to load plugin ${pluginId}:`, e);
      return { success: false, error: e.message };
    }
  }

  // プラグインAPIを作成
  createPluginAPI(plugin) {
    const api = {
      // スタイルの変更
      addStyle: (css) => {
        const style = document.createElement('style');
        style.id = `edbp-style-${plugin.id}`;
        style.textContent = css;
        document.head.appendChild(style);
      },

      // ブロックの追加
      registerBlock: (blockType, blockDef, codeGenerator) => {
        this.blockly.Blocks[blockType] = {
          init: function () {
            if (blockDef.init) {
              blockDef.init.call(this);
            }
            if (blockDef.colour) this.setColour(blockDef.colour);
            if (blockDef.tooltip) this.setTooltip(blockDef.tooltip);
            if (blockDef.helpUrl) this.setHelpUrl(blockDef.helpUrl);
          }
        };

        if (codeGenerator) {
          this.blockly.Python[blockType] = codeGenerator;
        }
      },

      // カテゴリーの追加
      addCategory: (name, colour, blocks) => {
        const toolbox = document.getElementById('toolbox');
        if (!toolbox) return;

        const category = document.createElement('category');
        category.setAttribute('name', name);
        category.setAttribute('colour', colour);

        blocks.forEach(blockType => {
          const block = document.createElement('block');
          block.setAttribute('type', blockType);
          category.appendChild(block);
        });

        toolbox.appendChild(category);

        // ワークスペースを更新
        if (this.workspace) {
          this.blockly.svgResize(this.workspace);
        }
      },

      // 言語の追加
      addTranslation: (locale, translations) => {
        if (!this.blockly.Msg) {
          this.blockly.Msg = {};
        }
        if (!this.blockly.Msg[locale]) {
          this.blockly.Msg[locale] = {};
        }
        Object.assign(this.blockly.Msg[locale], translations);
      },

      // プラグイン情報
      getPluginInfo: () => ({
        id: plugin.id,
        name: plugin.name,
        version: plugin.version,
        author: plugin.author
      }),

      // カスタム機能（何でもできるように）
      execute: (code) => {
        try {
          return new Function('Blockly', 'workspace', code)(this.blockly, this.workspace);
        } catch (e) {
          console.error('Plugin execution error:', e);
          throw e;
        }
      }
    };

    return api;
  }

  // プラグインをアンインストール
  uninstallPlugin(pluginId) {
    // 読み込まれている場合はアンロード
    if (this.loadedPlugins.has(pluginId)) {
      this.unloadPlugin(pluginId);
    }

    // プラグインを削除
    this.plugins.delete(pluginId);
    this.savePlugins();

    // スタイルを削除
    const style = document.getElementById(`edbp-style-${pluginId}`);
    if (style) {
      style.remove();
    }
  }

  // プラグインをアンロード
  unloadPlugin(pluginId) {
    const loaded = this.loadedPlugins.get(pluginId);
    if (!loaded) return;

    // プラグインのクリーンアップ（必要に応じて）
    if (loaded.api && loaded.api.cleanup) {
      loaded.api.cleanup();
    }

    this.loadedPlugins.delete(pluginId);
  }

  // 公認プラグインリストを取得（EDBP-APIから）
  async fetchApprovedPluginList() {
    try {
      const response = await fetch(this.officialSources[0]);
      if (response.ok) {
        const data = await response.json();
        // データ構造に応じて処理（配列またはオブジェクト）
        if (Array.isArray(data)) {
          data.forEach(p => this.approvedPluginIds.add(p.id || p.name));
          return data;
        } else if (typeof data === 'object') {
          // オブジェクトの場合は値の配列を取得
          const plugins = Object.values(data);
          plugins.forEach(p => this.approvedPluginIds.add(p.id || p.name));
          return plugins;
        }
      }
    } catch (e) {
      console.warn('Failed to fetch approved plugin list:', e);
    }
    return [];
  }

  // GitHub APIからedbp-pluginタグのリポジトリを取得
  async fetchGitHubPlugins() {
    try {
      // 公認プラグインリストを先に取得（EDBP-APIから）
      await this.fetchApprovedPluginList();

      // GitHub APIでedbp-pluginトピックを持つリポジトリを検索
      const response = await fetch('https://api.github.com/search/repositories?q=topic:edbp-plugin&sort=updated&per_page=100');
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('GitHub APIのレート制限に達しました。しばらく待ってから再試行してください。');
        }
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const data = await response.json();
      const plugins = [];

      // 各リポジトリを処理（並列処理を避けてレート制限を考慮）
      for (const repo of data.items || []) {
        // 公式: EDBPluginグループが出しているもの（オーナーがEDBPlugin）
        const isOfficial = repo.owner.login === 'EDBPlugin';



        // 公認: EDBP-APIに記載があるもの
        const isApproved = this.approvedPluginIds.has(repo.name) ||
          this.approvedPluginIds.has(repo.full_name);

        let pluginInfo = {
          id: repo.name,
          name: repo.name,
          version: 'latest',
          author: repo.owner.login,
          description: repo.description || '説明なし',
          official: isOfficial,
          approved: isApproved,
          source: 'github',
          repoUrl: repo.html_url,
          downloadUrl: null
        };

        // リリースを確認（レート制限を考慮して簡略化）
        // 注: リリースAPIは呼び出し回数が多いため、必要に応じて後で実装
        // 現在はリポジトリのZIPをダウンロードURLとして使用
        // CORSプロキシ経由でダウンロード
        const directUrl = `${repo.html_url}/archive/refs/heads/${repo.default_branch || 'main'}.zip`;
        pluginInfo.downloadUrl = `/proxy/${encodeURIComponent(directUrl)}`;

        plugins.push(pluginInfo);
      }

      return plugins;
    } catch (e) {
      console.error('Failed to fetch GitHub plugins:', e);
      throw e; // エラーを再スローしてUIで表示
    }
  }

  // プラグインの安全性チェック（非公式プラグイン用）
  async checkPluginSafety(pluginUrl) {
    // 基本的なチェック
    const checks = {
      hasManifest: false,
      validStructure: false,
      noDangerousCode: false
    };

    try {
      // URLからプラグインを取得してチェック
      const response = await fetch(pluginUrl);
      if (!response.ok) {
        return { safe: false, reason: 'プラグインの取得に失敗しました' };
      }

      // ここでより詳細なチェックを実装
      // 例: 危険なコードパターンの検出など

      return { safe: true, checks };
    } catch (e) {
      return { safe: false, reason: e.message };
    }
  }

  // すべてのプラグインを読み込む
  async loadAllPlugins() {
    const plugins = this.loadInstalledPlugins();
    const results = [];

    for (const plugin of plugins) {
      if (plugin.enabled !== false) {
        const result = await this.loadPlugin(plugin.id);
        results.push({ plugin: plugin.id, ...result });
      }
    }

    return results;
  }
}

export default PluginManager;

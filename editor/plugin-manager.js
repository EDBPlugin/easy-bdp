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

  // EDBP-devプラグインの有効状態を確認して必要に応じて更新
  ensureDevPluginEnabled(pluginId) {
    if (pluginId === 'edbp-dev') {
      const plugin = this.plugins.get(pluginId);
      if (plugin && plugin.enabled === false) {
        plugin.enabled = true;
        this.plugins.set(pluginId, plugin);
        this.savePlugins();
      }
    }
  }

  // エラーメッセージを表示するヘルパー関数
  showErrorPopup(message, errorCode) {
    const errorMessages = {
      'E000': '不明なエラーが発生しました',
      'E001': 'main.js が ZIP に存在しません',
      'E002': 'plugin.json の読み込みに失敗しました（構文エラー）',
      'E003': 'plugin.json の必須フィールドが不足しています',
      'E004': 'ZIP ファイルの形式が不正です',
      'E005': 'main.js 実行中にエラーが発生しました',
      'E006': 'Shadow DOM の作成に失敗しました（重複しています）',
      'E007': 'ブラウザによりスクリプトがブロックされました',
      'E1000': 'ネットワーク接続に失敗しました',
      'E1403': 'アクセスが拒否されました',
      'E1404': 'リソースが見つかりません',
      'E1500': 'サーバーエラーが発生しました',
      'E009': 'プラグイン構造が不正です',
      'E010': 'API 実行中にエラーが発生しました'
    };
    
    const errorMessage = errorCode ? `[${errorCode}] ${errorMessages[errorCode] || errorMessages['E000']}` : message;
    
    // ポップアップを作成して表示
    const popup = document.createElement('div');
    popup.className = 'edbp-error-popup';
    popup.innerHTML = `
      <div class="edbp-error-content">
        <div class="edbp-error-header">
          <span class="edbp-error-code">${errorCode || 'E000'}</span>
          <button class="edbp-error-close">&times;</button>
        </div>
        <div class="edbp-error-body">${errorMessages[errorCode] || message || errorMessages['E000']}</div>
      </div>
    `;
    
    // スタイルを追加（まだ追加されていない場合）
    if (!document.getElementById('edbp-error-styles')) {
      const style = document.createElement('style');
      style.id = 'edbp-error-styles';
      style.textContent = `
        .edbp-error-popup {
          position: fixed;
          top: 20px;
          right: 20px;
          z-index: 9999;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
        }
        .edbp-error-content {
          background: #ffebee;
          border-left: 4px solid #f44336;
          padding: 12px 16px;
          border-radius: 4px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          max-width: 400px;
          animation: slideIn 0.3s ease-out;
        }
        .edbp-error-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }
        .edbp-error-code {
          font-weight: bold;
          color: #d32f2f;
          font-size: 14px;
        }
        .edbp-error-close {
          background: none;
          border: none;
          font-size: 20px;
          cursor: pointer;
          color: #666;
          line-height: 1;
          padding: 0 0 4px 8px;
        }
        .edbp-error-body {
          color: #333;
          font-size: 14px;
          line-height: 1.5;
        }
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `;
      document.head.appendChild(style);
    }
    
    // 閉じるボタンのイベント
    const closeBtn = popup.querySelector('.edbp-error-close');
    closeBtn.addEventListener('click', () => {
      popup.style.animation = 'fadeOut 0.3s ease-out';
      setTimeout(() => popup.remove(), 300);
    });
    
    // 5秒後に自動で閉じる
    setTimeout(() => {
      popup.style.animation = 'fadeOut 0.3s ease-out';
      setTimeout(() => popup.remove(), 300);
    }, 5000);
    
    document.body.appendChild(popup);
    return { success: false, error: errorMessage };
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
        return this.showErrorPopup(null, 'E009'); // プラグイン構造が不正です
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
        
        return this.showErrorPopup(helpfulMsg, 'E002'); // plugin.json の読み込みに失敗しました（構文エラー）
      }
      
      if (progressCallback) progressCallback({ step: 'プラグインを検証しています...', progress: 50 });
      
      // プラグインの検証
      const validationResult = this.validatePlugin(manifest);
      if (!validationResult.success) {
        return validationResult;
      }
      
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
      
      // EDBP-devプラグインの場合は有効状態を確認
      this.ensureDevPluginEnabled(manifest.id);
      
      if (progressCallback) progressCallback({ step: '完了！', progress: 100 });
      
      return { success: true, plugin: manifest };
    } catch (e) {
      console.error('Plugin installation failed:', e);
      return { success: false, error: e.message };
    }
  }

  // プラグインの検証
  validatePlugin(manifest) {
    try {
      // EDBP-devプラグインは特別扱い
      if (manifest.id === 'edbp-dev') {
        const required = ['id', 'name', 'version', 'author', 'description'];
        for (const field of required) {
          if (!manifest[field]) {
            return { success: false, error: `必須フィールドが不足しています: ${field}`, code: 'E003' };
          }
        }
      } else {
        // 通常のプラグイン
        const required = ['id', 'name', 'version', 'author', 'main'];
        for (const field of required) {
          if (!manifest[field]) {
            return { success: false, error: `必須フィールドが不足しています: ${field}`, code: 'E003' };
          }
        }
      }
      
      // IDの形式チェック
      if (!/^[a-z0-9-]+$/.test(manifest.id)) {
        return { success: false, error: 'プラグインIDは英小文字、数字、ハイフンのみ使用可能です', code: 'E003' };
      }
      
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message, code: 'E000' };
    }
  }

  // プラグインを読み込んで実行
  async loadPlugin(pluginId) {
    if (this.loadedPlugins.has(pluginId)) {
      return this.showErrorPopup('プラグインは既に読み込まれています', 'E000');
    }
    
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      return this.showErrorPopup('プラグインが見つかりません', 'E009');
    }
    
    // EDBP-devプラグインの場合は常に有効化
    if (pluginId === 'edbp-dev') {
      plugin.enabled = true; // 常に有効
      this.plugins.set(pluginId, plugin);
      this.savePlugins();
      // デベロッパーモードを有効化
      window.EDBP_DEVELOPER_MODE = true;
      console.log('EDBP Developer Mode: Enabled');
      // メインファイルがなくてもエラーにしない
      this.loadedPlugins.set(pluginId, { plugin, api: this.createPluginAPI(plugin) });
      return { success: true };
    }
    
    try {
      // プラグインAPIの準備
      const pluginAPI = this.createPluginAPI(plugin);
      
      // EDBP-devプラグインの場合はメインファイルチェックをスキップ
      if (pluginId === 'edbp-dev') {
        return { success: true };
      }
      
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
        return this.showErrorPopup('メインファイルはテキストファイルである必要があります', 'E001');
      }
      
      if (!mainFile || typeof mainFile !== 'string') {
        return this.showErrorPopup(`メインファイル「${mainPath}」が見つかりません`, 'E001');
      }
      
      try {
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
        console.error(`Failed to execute plugin ${pluginId}:`, e);
        return this.showErrorPopup(e.message, 'E005'); // main.js 実行中にエラーが発生しました
      }
    } catch (e) {
      console.error(`Failed to load plugin ${pluginId}:`, e);
      return this.showErrorPopup(e.message, 'E000'); // 不明なエラーが発生しました
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
          init: function() {
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
      const response = await fetch(this.officialSources[0]).catch(error => {
        if (error.name === 'TypeError') {
          this.showErrorPopup(null, 'E1000'); // ネットワークエラー
        }
        throw error;
      });
      
      if (response.status === 403) {
        this.showErrorPopup(null, 'E1403'); // Forbidden
        throw new Error('Forbidden');
      } else if (response.status === 404) {
        this.showErrorPopup(null, 'E1404'); // Not Found
        throw new Error('Not Found');
      } else if (response.status >= 500) {
        this.showErrorPopup(null, 'E1500'); // Server Error
        throw new Error('Server Error');
      }
      
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
      // エラーは既にshowErrorPopupで表示されているので、ここでは何もしない
    }
    return [];
  }

  // GitHub APIからedbp-pluginタグのリポジトリを取得
  async fetchGitHubPlugins() {
    try {
      // 公認プラグインリストを先に取得（EDBP-APIから）
      await this.fetchApprovedPluginList();
      
      // GitHub APIでedbp-pluginトピックを持つリポジトリを検索
      const response = await fetch('https://api.github.com/search/repositories?q=topic:edbp-plugin&sort=updated&per_page=100')
        .catch(error => {
          if (error.name === 'TypeError') {
            this.showErrorPopup(null, 'E1000'); // ネットワークエラー
          }
          throw error;
        });
      
      if (response.status === 403) {
        this.showErrorPopup('GitHub APIのレート制限に達しました。しばらく待ってから再試行してください。', 'E1403');
        throw new Error('Rate limit exceeded');
      } else if (response.status === 404) {
        this.showErrorPopup(null, 'E1404'); // Not Found
        throw new Error('Not Found');
      } else if (response.status >= 500) {
        this.showErrorPopup(null, 'E1500'); // Server Error
        throw new Error('Server Error');
      }
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
    
    // EDBP-devプラグインを最初に読み込む
    const devPlugin = plugins.find(p => p.id === 'EDBP-dev');
    if (devPlugin) {
      const result = await this.loadPlugin(devPlugin.id);
      results.push({ plugin: devPlugin.id, ...result });
    }
    
    // その他のプラグインを読み込む
    for (const plugin of plugins) {
      if (plugin.id !== 'EDBP-dev' && plugin.enabled !== false) {
        const result = await this.loadPlugin(plugin.id);
        results.push({ plugin: plugin.id, ...result });
      }
    }
    
    return results;
  }
}

export default PluginManager;

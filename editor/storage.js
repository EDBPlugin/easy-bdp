// 共有リンク用にワークスペースのJSONを極小化・圧縮するクラス
// IDデータを削除し、LZStringで圧縮してURLエンコード可能な形式に変換する
class WorkspaceShareCodec {
  static compress(workspace) {
    if (!workspace) return '';
    const lz = typeof window !== 'undefined' ? window.LZString : undefined;
    if (!lz?.compressToEncodedURIComponent) {
      console.error('LZStringが利用できないため圧縮できません。');
      return '';
    }
    try {
      // 生のBlocklyデータからIDを間引いたうえでJSON→LZ圧縮する
      const raw = Blockly.serialization.workspaces.save(workspace);
      const stripped = WorkspaceShareCodec.#stripIds(raw);

      // プラグイン情報の付与
      const payloadObj = {
        workspace: stripped,
        pluginUUIDs: workspace.pluginManager?.getPluginUUIDsForShare() || [],
        pluginInfo: workspace.pluginManager?.getSharablePluginsInfo() || []
      };

      const payload = JSON.stringify(payloadObj);
      const compressed = lz.compressToEncodedURIComponent(payload);
      if (!compressed) throw new Error('圧縮に失敗しました。');
      return compressed;
    } catch (error) {
      console.error('ワークスペースの圧縮に失敗しました。', error);
      return '';
    }
  }

  static async decompress(encoded, workspace) {
    if (!workspace || !encoded) return false;
    const lz = typeof window !== 'undefined' ? window.LZString : undefined;
    if (!lz?.decompressFromEncodedURIComponent) {
      console.error('LZStringが利用できないため復号できません。');
      return false;
    }
    try {
      const text = lz.decompressFromEncodedURIComponent(encoded);
      if (!text) throw new Error('データを展開できませんでした。');
      const payload = JSON.parse(text);

      const isExtendedPayload = !!(payload.workspace && (payload.pluginUUIDs || payload.plugins || payload.pluginInfo));
      const workspaceData = isExtendedPayload ? payload.workspace : payload;

      // プラグイン情報の処理を先に行う (Blockly読込前に定義を揃えるため)
      if (isExtendedPayload && workspace.pluginManager) {
        const uuids = payload.pluginUUIDs || [];
        const pluginInfo = payload.pluginInfo || [];
        const missingPlugins = [];

        // インストール済みチェック
        if (pluginInfo.length > 0) {
          pluginInfo.forEach(entry => {
            const [fullName] = entry.split('@');
            const repoUrl = `https://github.com/${fullName}`;
            const isInstalled = workspace.pluginManager.getRegistry().some(p =>
              p.repo === repoUrl || p.repo === repoUrl + '.git'
            );
            if (!isInstalled) {
              missingPlugins.push(entry);
            }
          });
        }

        // 有効化 (awaitして定義を確定させる)
        for (const uuid of uuids) {
          const pluginId = workspace.pluginManager.getPluginIdByUUID(uuid);
          if (pluginId) {
            try {
              await workspace.pluginManager.enablePlugin(pluginId);
            } catch (e) {
              console.warn(`Plugin activation failed during share import: ${pluginId}`, e);
            }
          }
        }

        // 互換性のため古い形式もサポート
        const oldPlugins = payload.plugins || [];
        for (const pluginId of oldPlugins) {
          try {
            await workspace.pluginManager.enablePlugin(pluginId);
          } catch (e) {
            console.warn(`Old plugin activation failed: ${pluginId}`, e);
          }
        }

        // 未インストールがあれば後で促す
        if (missingPlugins.length > 0) {
          // 非同期で提案 (読込完了後に表示されるように)
          setTimeout(() => workspace.pluginManager.suggestPlugins(missingPlugins), 500);
        }
      }

      // 最後にワークスペースを読み込む
      try {
        Blockly.serialization.workspaces.load(workspaceData, workspace);
      } catch (loadError) {
        console.warn('Blockly load encountered errors (possibly missing block definitions):', loadError);
        // 部分的に読み込める場合もあるため、致命的エラーにはしない
      }

      return true;
    } catch (error) {
      console.error('圧縮ワークスペースの読み込みに失敗しました。', error);
      return false;
    }
  }

  static #stripIds(value) {
    if (Array.isArray(value)) {
      return value.map((item) => WorkspaceShareCodec.#stripIds(item));
    }
    if (!value || typeof value !== 'object') {
      return value;
    }
    // ブロック間の参照に不要なidだけを落としてサイズ削減
    const result = {};
    for (const [key, val] of Object.entries(value)) {
      if (key === 'id') continue;
      result[key] = WorkspaceShareCodec.#stripIds(val);
    }
    return result;
  }
}

export default class WorkspaceStorage {
  static STORAGE_KEY = 'discord_bot_builder_workspace_v5';
  static DEFAULT_TITLE = 'bot-project';

  #workspace;
  #titleProvider = () => WorkspaceStorage.DEFAULT_TITLE;

  constructor(workspace) {
    this.#workspace = workspace;
  }

  setTitleProvider(provider) {
    if (typeof provider === 'function') {
      this.#titleProvider = provider;
    } else {
      this.#titleProvider = () => WorkspaceStorage.DEFAULT_TITLE;
    }
  }

  static sanitizeTitle(rawTitle) {
    if (!rawTitle || typeof rawTitle !== 'string') {
      return WorkspaceStorage.DEFAULT_TITLE;
    }
    const normalized = rawTitle.trim().replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '-');
    return normalized || WorkspaceStorage.DEFAULT_TITLE;
  }

  static buildDownloadName(title, date = new Date()) {
    const safeTitle = WorkspaceStorage.sanitizeTitle(title);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const timestamp = `${month}-${day}-${hours}${minutes}`;
    return `EDBB-${safeTitle}-${timestamp}.json`;
  }

  static normalizeDownloadName(rawName, fallbackName) {
    const fallback =
      typeof fallbackName === 'string' && fallbackName.trim()
        ? fallbackName.trim()
        : WorkspaceStorage.buildDownloadName(WorkspaceStorage.DEFAULT_TITLE);
    if (!rawName || typeof rawName !== 'string') {
      return fallback;
    }
    const cleaned = rawName.trim().replace(/[\\/:*?"<>|]/g, '');
    if (!cleaned) {
      return fallback;
    }
    return /\.json$/i.test(cleaned) ? cleaned : `${cleaned}.json`;
  }

  #resolveTitle() {
    try {
      const provided = typeof this.#titleProvider === 'function' ? this.#titleProvider() : '';
      return WorkspaceStorage.sanitizeTitle(provided);
    } catch (error) {
      console.warn('Failed to resolve project title', error);
      return WorkspaceStorage.DEFAULT_TITLE;
    }
  }

  #resolveDownloadName(fileName) {
    const fallback = WorkspaceStorage.buildDownloadName(this.#resolveTitle());
    return WorkspaceStorage.normalizeDownloadName(fileName, fallback);
  }

  // XMLかどうかの大まかな判定
  static #looksLikeXml(text) {
    return typeof text === 'string' && text.trim().startsWith('<');
  }

  // Fileオブジェクトをテキストとして読む
  static #readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => resolve(event.target?.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file, 'utf-8');
    });
  }

  // --- 公開API ---

  // JSON文字列として取得（ダウンロードせずに利用）
  exportText({ pretty = false } = {}) {
    if (!this.#workspace) return '';
    try {
      const data = Blockly.serialization.workspaces.save(this.#workspace);
      return JSON.stringify(data, null, pretty ? 2 : 0);
    } catch (error) {
      console.error('ワークスペースのシリアライズに失敗しました。', error);
      return '';
    }
  }

  // JSONまたはXML文字列を判別して読み込む
  importText(text) {
    if (WorkspaceStorage.#looksLikeXml(text)) {
      // 旧フォーマット(XML)の場合はDOM化して読込
      const dom = Blockly.Xml.textToDom(text);
      Blockly.Xml.clearWorkspaceAndLoadFromXml(dom, this.#workspace);
      return true;
    }
    try {
      // JSONはシリアライズAPIを使って復元
      const data = JSON.parse(text);
      Blockly.serialization.workspaces.load(data, this.#workspace);
      return true;
    } catch (error) {
      return false;
    }
  }

  // 共有URL向けの極小データを生成
  exportMinified() {
    return WorkspaceShareCodec.compress(this.#workspace);
  }

  // 極小データを復元
  async importMinified(encoded) {
    return await WorkspaceShareCodec.decompress(encoded, this.#workspace);
  }

  // 現在のワークスペース状態をlocalStorageへ保存
  save() {
    const json = this.exportText({ pretty: false });
    if (!json) return;
    try {
      localStorage.setItem(WorkspaceStorage.STORAGE_KEY, json);
    } catch (error) {
      console.error('ワークスペースの保存に失敗しました。', error);
    }
  }

  // localStorageから保存済みデータを復元
  load() {
    const stored = localStorage.getItem(WorkspaceStorage.STORAGE_KEY);
    if (!stored) return false;
    try {
      if (this.importText(stored)) {
        // XMLから読み込んだ場合でも即JSONに変換し直す
        this.save();
        return true;
      }
    } catch (error) {
      console.error('ワークスペースの読み込みに失敗しました。', error);
    }
    return false;
  }

  // JSONファイルとしてダウンロード
  exportFile({ pretty = true, fileName } = {}) {
    const json = this.exportText({ pretty });
    if (!json) return false;
    try {
      const resolvedName = this.#resolveDownloadName(fileName);
      const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = resolvedName;
      a.click();
      URL.revokeObjectURL(url);
      return true;
    } catch (error) {
      console.error('ワークスペースのエクスポートに失敗しました。', error);
      return false;
    }
  }

  getDefaultExportFileName() {
    return this.#resolveDownloadName('');
  }

  async saveFileWithPicker({ pretty = true, fileName } = {}) {
    if (typeof window === 'undefined' || typeof window.showSaveFilePicker !== 'function') {
      return false;
    }
    const json = this.exportText({ pretty });
    if (!json) return false;

    const resolvedName = this.#resolveDownloadName(fileName);
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: resolvedName,
        types: [
          {
            description: 'JSON Files',
            accept: {
              'application/json': ['.json'],
            },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(new Blob([json], { type: 'application/json;charset=utf-8' }));
      await writable.close();
      return true;
    } catch (error) {
      if (error?.name === 'AbortError') {
        return false;
      }
      console.error('ファイルピッカー経由の保存に失敗しました。', error);
      return false;
    }
  }

  // ユーザーが選択したファイルを読み込み
  async importFile(file) {
    if (!file) return false;
    try {
      const text = await WorkspaceStorage.#readFile(file);
      if (typeof text !== 'string') throw new Error('ファイルを読み込めませんでした。');
      if (!this.importText(text)) {
        throw new Error('対応していないファイル形式です。');
      }
      this.save();
      return true;
    } catch (error) {
      console.error('ワークスペースのインポートに失敗しました。', error);
      return false;
    }
  }
}

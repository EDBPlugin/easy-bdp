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
      const payload = JSON.stringify(stripped);
      const compressed = lz.compressToEncodedURIComponent(payload);
      if (!compressed) throw new Error('圧縮に失敗しました。');
      return compressed;
    } catch (error) {
      console.error('ワークスペースの圧縮に失敗しました。', error);
      return '';
    }
  }

  static decompress(encoded, workspace) {
    if (!workspace || !encoded) return false;
    const lz = typeof window !== 'undefined' ? window.LZString : undefined;
    if (!lz?.decompressFromEncodedURIComponent) {
      console.error('LZStringが利用できないため復号できません。');
      return false;
    }
    try {
      const text = lz.decompressFromEncodedURIComponent(encoded);
      if (!text) throw new Error('データを展開できませんでした。');
      // 復号後はJSONを戻してそのままBlocklyへ読み込む
      const payload = JSON.parse(text);
      Blockly.serialization.workspaces.load(payload, workspace);
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

  #resolveTitle() {
    try {
      const provided = typeof this.#titleProvider === 'function' ? this.#titleProvider() : '';
      return WorkspaceStorage.sanitizeTitle(provided);
    } catch (error) {
      console.warn('Failed to resolve project title', error);
      return WorkspaceStorage.DEFAULT_TITLE;
    }
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
  importMinified(encoded) {
    return WorkspaceShareCodec.decompress(encoded, this.#workspace);
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
  exportFile() {
    const json = this.exportText({ pretty: true });
    if (!json) return;
    try {
      const fileName = WorkspaceStorage.buildDownloadName(this.#resolveTitle());
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('ワークスペースのエクスポートに失敗しました。', error);
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

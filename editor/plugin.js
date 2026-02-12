/**
 * EDBP Plugin System
 * Plugin management with GitHub discovery, trust levels, and uninstallation.
 */

export class PluginManager {
    /**
     * リトライ機能付きのfetch
     */
    async fetchWithRetry(url, options = {}, retries = 3, backoff = 500) {
        for (let i = 0; i < retries; i++) {
            try {
                const response = await fetch(url, options);
                if (response.ok) return response;
                // レート制限やサーバーエラー時はしばらく待ってリトライ
                if (response.status === 403 || response.status >= 500) {
                    await new Promise(r => setTimeout(r, backoff * (i + 1)));
                    continue;
                }
                return response;
            } catch (err) {
                if (i === retries - 1) throw err;
                await new Promise(r => setTimeout(r, backoff * (i + 1)));
            }
        }
    }

    constructor(workspace) {
        this.workspace = workspace;
        this.plugins = new Map();
        // インストール済みプラグインのメタデータ
        this.installedPlugins = JSON.parse(localStorage.getItem('edbb_installed_plugins') || '{}');

        // データの移行: 文字列から0(local)/1(github)へ
        let modified = false;
        Object.values(this.installedPlugins).forEach(p => {
            if (p.installedFrom === 'github') {
                p.installedFrom = 1;
                modified = true;
            } else if (p.installedFrom === 'local') {
                p.installedFrom = 0;
                modified = true;
            } else if (p.installedFrom === undefined) {
                // 明示されていない場合はlocal(0)
                p.installedFrom = 0;
                modified = true;
            }
        });
        if (modified) {
            this.saveInstalledPlugins();
        }

        // 有効化されているプラグインのID
        this.enabledPlugins = new Set(JSON.parse(localStorage.getItem('edbb_enabled_plugins') || '[]'));

        // 公認プラグインリストのキャッシュ
        this.certifiedPlugins = [];
        // ブラックリストのキャッシュ
        this.blacklistedPlugins = [];

        // 過去の負債を清算
        this._purgeLegacySystems();
    }

    _purgeLegacySystems() {
        const legacyBuiltinIds = ['vanilla-plugin'];
        const legacyBuiltinUUIDs = ['edbp-builtin-vanilla-001'];
        let purged = false;

        // 1. IDによるパージ
        legacyBuiltinIds.forEach(id => {
            if (this.installedPlugins[id]) {
                delete this.installedPlugins[id];
                purged = true;
            }
            if (this.enabledPlugins.has(id)) {
                this.enabledPlugins.delete(id);
                purged = true;
            }
        });

        // 2. UUIDによるパージ
        Object.keys(this.installedPlugins).forEach(id => {
            const plugin = this.installedPlugins[id];
            if (plugin && legacyBuiltinUUIDs.includes(plugin.uuid)) {
                delete this.installedPlugins[id];
                this.enabledPlugins.delete(id);
                purged = true;
            }
        });

        if (purged) {
            console.log('Legacy systems purged from local database.');
            this.saveInstalledPlugins();
            this.saveState();
        }
    }

    /**
     * すべてのプラグインデータを完全に削除し、初期状態に戻します。
     * 履歴消去などの操作と連動させるためのシステムです。
     */
    resetSystem() {
        console.warn('EDBP System Reset initiated. Purging all local plugin data.');
        this.installedPlugins = {};
        this.enabledPlugins = new Set();
        this.plugins.forEach(p => {
            if (p && typeof p.onunload === 'function') p.onunload();
        });
        this.plugins.clear();

        // localStorageの物理削除
        localStorage.removeItem('edbb_installed_plugins');
        localStorage.removeItem('edbb_enabled_plugins');

        console.log('All plugin data has been completely removed.');
    }


    async init() {
        console.log('PluginManager initializing...');

        // 公認プラグインリストを前の形で取得 (EDBP-API の plugins.json)
        try {
            const response = await this.fetchWithRetry('https://raw.githubusercontent.com/EDBPlugin/EDBP-API/main/plugins.json');
            if (response.ok) {
                this.certifiedPlugins = await response.json();
            }
        } catch (e) {
            console.warn('Failed to fetch certified plugins list', e);
        }

        // ブラックリストを取得 (EDBPlugin/Blacklist の plugins.json)
        try {
            const response = await this.fetchWithRetry('https://raw.githubusercontent.com/EDBPlugin/Blacklist/main/plugins.json');
            if (response.ok) {
                this.blacklistedPlugins = await response.json();
            }
        } catch (e) {
            console.warn('Failed to fetch blacklisted plugins list', e);
        }

        const enablePromises = Array.from(this.enabledPlugins).map(pluginId => {
            // テスト用プラグインは再読み込み時に自動で無効化する
            if (pluginId === 'test-danger' || pluginId === 'malicious-test-plugin') {
                this.enabledPlugins.delete(pluginId);
                this.saveState();
                console.log('Test danger plugin auto-disabled on reload');
                return Promise.resolve();
            }
            return this.enablePlugin(pluginId).catch(err => console.error(`Failed to enable ${pluginId} during init`, err));
        });
        await Promise.all(enablePromises);
    }


    // GitHubから edbp-plugin タグ/トピックの付いたリポジトリを検索
    async searchGitHubPlugins(query = '') {
        try {
            let q = 'topic:edbp-plugin';
            let filterLevel = null;

            if (query) {
                const parts = query.split(/\s+/);
                const queryParts = [];

                parts.forEach(part => {
                    if (part.startsWith('tag:')) {
                        const tag = part.substring(4);
                        if (tag) queryParts.push(`topic:${tag}`);
                    } else if (part.startsWith('author:')) {
                        const author = part.substring(7);
                        if (author) queryParts.push(`user:${author}`);
                    } else if (part.startsWith('badge:')) {
                        // Badge filtering is done client-side after fetch
                        filterLevel = part.split(':')[1].toLowerCase();
                    } else {
                        queryParts.push(part);
                    }
                });

                if (queryParts.length > 0) {
                    q = `${queryParts.join(' ')} topic:edbp-plugin`;
                }
            }

            const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc`;
            const response = await this.fetchWithRetry(url);

            if (!response.ok) {
                if (response.status === 403) throw new Error('GitHub API Rate Limit Exceeded');
                throw new Error(`GitHub API error: ${response.status}`);
            }

            let data = await response.json();

            // 検索結果の整形
            let items = data.items.map(repo => {
                const trustLevel = this.getTrustLevel(repo);
                return {
                    id: repo.name,
                    name: repo.name,
                    author: repo.owner.login,
                    description: repo.description,
                    repo: repo.html_url,
                    stars: repo.stargazers_count,
                    trustLevel: trustLevel,
                    fullName: repo.full_name,
                    defaultBranch: repo.default_branch
                };
            });

            // バッジフィルタリング (クライアントサイド)
            if (filterLevel) {
                const badgeMap = {
                    'official': 'official', '公式': 'official',
                    'certified': 'certified', '公認': 'certified',
                    'danger': 'danger', '危険': 'danger',
                    'invalid': 'invalid', '使用不可': 'invalid', '不可': 'invalid'
                };
                const targetLevel = badgeMap[filterLevel] || filterLevel;
                items = items.filter(item => {
                    const level = item.trustLevel?.level ?? item.trustLevel;
                    return level === targetLevel;
                });
            }

            return items;
        } catch (e) {
            console.error('Failed to search GitHub plugins', e);
            return [];
        }
    }

    // 信頼レベルの判定 (GitHub Search Result用)
    getTrustLevel(repo) {
        // ブラックリストチェックを優先
        const blacklistMatch = this._isInList(this.blacklistedPlugins, repo.full_name, repo.html_url);
        if (blacklistMatch) {
            return {
                level: 'danger',
                reason: typeof blacklistMatch === 'object' ? blacklistMatch.reason : null
            };
        }

        if (repo.owner.login === 'EDBPlugin') return { level: 'official' };

        // EDBP-APIのリストに含まれているかチェック
        const isCertified = this._isInList(this.certifiedPlugins, repo.full_name, repo.html_url);
        if (isCertified) return { level: 'certified' };

        return null;
    }

    // 信頼レベルの判定 (インストール済みマニフェスト用)
    getManifestTrustLevel(manifest) {
        const validation = this.validateManifest(manifest);
        let level = null;
        let reason = null;

        // ブラックリストチェック
        if (manifest.repo) {
            const blacklistMatch = this._isInList(this.blacklistedPlugins, null, manifest.repo);
            if (blacklistMatch) {
                level = 'danger';
                reason = typeof blacklistMatch === 'object' ? blacklistMatch.reason : null;
            }
        }

        if (!level) {
            if (manifest.author === 'EDBPlugin') {
                level = 'official';
            } else if (manifest.repo) {
                const isCertified = this._isInList(this.certifiedPlugins, null, manifest.repo);
                if (isCertified) level = 'certified';
            }
        }

        return {
            level: level,
            reason: reason,
            invalid: !validation.valid,
            invalidReason: validation.valid ? null : `必須項目が不足しています: ${validation.missing.join(', ')}`
        };
    }

    /**
     * マニフェストの必須項目をチェックします
     * @param {object} manifest 
     * @returns {object} { valid: boolean, missing: string[] }
     */
    validateManifest(manifest) {
        const required = ['name', 'version', 'author', 'affectsStyle', 'affectsBlocks'];
        const missing = [];

        required.forEach(field => {
            if (manifest[field] === undefined || manifest[field] === null || manifest[field] === '') {
                missing.push(field);
            }
        });

        return {
            valid: missing.length === 0,
            missing: missing
        };
    }

    /**
     * リスト（公認・ブラックリスト）に含まれているかチェックするヘルパー
     * 見つかった場合はそのエントリを、見つからない場合はnullを返します。
     */
    _isInList(list, fullName, url) {
        if (!Array.isArray(list)) return null;
        return list.find(p => {
            if (typeof p === 'string') {
                return (fullName && p === fullName) || (url && url.includes(p));
            }
            // オブジェクト形式 (URLプロパティがある場合)
            if (p && typeof p === 'object') {
                const targetUrl = p.URL || p.url || p.repo || p.id;
                return targetUrl && url && (url === targetUrl || url.includes(targetUrl));
            }
            return false;
        }) || null;
    }

    /**
     * GitHubのURLを解析して、所有者、リポジトリ、ブランチ、パスを抽出します。
     * @param {string} url 
     * @returns {object|null}
     */
    parseGitHubUrl(url) {
        if (!url || typeof url !== 'string' || !url.includes('github.com')) return null;

        try {
            // クエリパラメータを除去し、末尾のスラッシュや .git を取り除く
            const cleanUrl = url.split('?')[0].replace(/\/$/, '').replace(/\.git$/, '');

            // github.com/ 以降の部分を取得
            const pathParts = cleanUrl.split('github.com/')[1].split('/');
            if (pathParts.length < 2) return null;

            const owner = pathParts[0];
            const repo = pathParts[1];
            let branch = 'main';
            let path = '';

            // blob/branch/path or tree/branch/path の形式をチェック
            if (pathParts.length >= 4 && (pathParts[2] === 'tree' || pathParts[2] === 'blob')) {
                branch = pathParts[3];
                path = pathParts.slice(4).join('/');
            }

            return { owner, repo, branch, path, fullName: `${owner}/${repo}` };
        } catch (e) {
            console.warn('Failed to parse GitHub URL:', url, e);
            return null;
        }
    }

    // READMEの取得
    async getREADME(identifier, defaultBranch = 'main') {
        const repoInfo = this.parseGitHubUrl(identifier);

        let fullName = identifier;
        let branch = defaultBranch;
        let subPath = '';

        if (repoInfo) {
            fullName = repoInfo.fullName;
            // URLにブランチ指定があればそれを使用、なければ引数のデフォルト
            branch = (repoInfo.branch && repoInfo.branch !== 'main') ? repoInfo.branch : defaultBranch;
            subPath = repoInfo.path ? repoInfo.path + '/' : '';
        }

        // 検索するパスの優先順位: URL内のパス/README.md -> ルート/README.md
        const possiblePaths = [
            `${subPath}README.md`,
            'README.md'
        ];

        // 重複を除去
        const uniquePaths = [...new Set(possiblePaths)];

        for (const path of uniquePaths) {
            try {
                const url = `https://raw.githubusercontent.com/${fullName}/${branch}/${path}`;
                const response = await this.fetchWithRetry(url, {}, 2, 300);
                if (response.ok) return await response.text();
            } catch (e) { }
        }
        return 'READMEが見つかりませんでした。';
    }


    // GitHubのリリース一覧を取得
    async getReleases(fullName) {
        try {
            const response = await fetch(`https://api.github.com/repos/${fullName}/releases`);
            if (!response.ok) return [];
            return await response.json();
        } catch (e) {
            console.error('Failed to fetch releases', e);
            return [];
        }
    }

    /**
     * GitHubからmanifest.jsonを取得してオブジェクトとして返します
     * APIではなく raw を使用することで、マーケットプレイス表示時のAPIレート制限を回避します。
     */
    async getManifestFromGitHub(fullName, ref = 'main') {
        try {
            const url = `https://raw.githubusercontent.com/${fullName}/${encodeURIComponent(ref)}/manifest.json`;
            const response = await this.fetchWithRetry(url);
            if (!response.ok) return null;

            return await response.json();
        } catch (e) {
            console.warn('Failed to fetch manifest from GitHub (raw)', e);
            return null;
        }
    }

    // GitHubから直接インストール
    async installFromGitHub(fullName, branchOrUrl = 'main') {
        try {
            const parseRefFromInput = (value) => {
                if (!value || !value.startsWith('http')) return (value || 'main').replace(/\.zip$/, '');
                const normalizedUrl = value.split('?')[0];

                const zipballMatch = normalizedUrl.match(/\/zipball\/(.+)$/);
                if (zipballMatch) return decodeURIComponent(zipballMatch[1]);

                const githubArchiveMatch = normalizedUrl.match(/\/archive\/refs\/(?:heads|tags)\/(.+)\.zip$/);
                if (githubArchiveMatch) return decodeURIComponent(githubArchiveMatch[1]);

                const codeloadArchiveMatch = normalizedUrl.match(/\/zip\/refs\/(?:heads|tags)\/(.+)$/);
                if (codeloadArchiveMatch) return decodeURIComponent(codeloadArchiveMatch[1]);

                const releaseAssetMatch = normalizedUrl.match(/\/releases\/download\/([^\/]+)\//);
                if (releaseAssetMatch) return decodeURIComponent(releaseAssetMatch[1]);

                // リポジトリURL自体が渡された場合は、そのブランチを抽出
                const repoInfo = this.parseGitHubUrl(value);
                if (repoInfo && repoInfo.branch) return repoInfo.branch;

                return null;
            };

            const ref = parseRefFromInput(branchOrUrl);
            if (!ref) {
                throw new Error('Unsupported ZIP URL in browser. Choose Source code (zip) or install from local ZIP.');
            }

            const decodeBase64Utf8 = (encoded) => {
                const binary = atob(encoded.replace(/\n/g, ''));
                const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
                return new TextDecoder('utf-8').decode(bytes);
            };

            const fetchRepoFile = async (filePath) => {
                const apiUrl = `https://api.github.com/repos/${fullName}/contents/${filePath}?ref=${encodeURIComponent(ref)}`;
                try {
                    const response = await this.fetchWithRetry(apiUrl, {
                        headers: { Accept: 'application/vnd.github+json' }
                    });
                    if (!response.ok) return null;

                    const data = await response.json();
                    if (!data || data.type !== 'file' || !data.content) return null;
                    return decodeBase64Utf8(data.content);
                } catch (e) {
                    console.warn(`Failed to fetch file ${filePath} from GitHub`, e);
                    return null;
                }
            };

            const manifestText = await fetchRepoFile('manifest.json');
            if (!manifestText) throw new Error('manifest.json not found at repository root for selected ref');

            const manifest = JSON.parse(manifestText);

            // バリデーションチェック (新規追加)
            const validation = this.validateManifest(manifest);
            if (!validation.valid) {
                throw new Error(`マニフェストの必須項目が不足しています: ${validation.missing.join(', ')}`);
            }

            if (!manifest.uuid) {
                manifest.uuid = this.generateUUID(manifest.author, manifest.name);
            }

            const id = manifest.id || manifest.name.toLowerCase().replace(/\s+/g, '-');
            manifest.id = id;
            manifest.updateDate = new Date().toISOString().split('T')[0];

            const scriptText = await fetchRepoFile('plugin.js');
            if (scriptText) {
                manifest.script = scriptText;
            }

            manifest.installedFrom = 1; // 1: github
            manifest.installRef = ref; // インストール時のブランチ/タグ/URLを記録

            // manifest.repo を実際のインストール元URLに強制的に書き換える
            const repoUrl = `https://github.com/${fullName}`;
            if (manifest.repo !== repoUrl) {
                manifest.repo = repoUrl;
            }

            manifest.trustLevel = this.getManifestTrustLevel(manifest);

            this.installedPlugins[id] = manifest;
            this.saveInstalledPlugins();
            return manifest;
        } catch (error) {
            console.error("GitHub installation failed:", error);
            throw error;
        }
    }
    async uninstallPlugin(id) {
        await this.disablePlugin(id);
        delete this.installedPlugins[id];
        this.saveInstalledPlugins();
    }


    generateUUID(author, name) {
        const seed = `${author}-${name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        let hash = 0;
        for (let i = 0; i < seed.length; i++) {
            const char = seed.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        const hex = Math.abs(hash).toString(16).padStart(8, '0');
        return `edbp-${hex}-${Math.random().toString(36).substr(2, 4)}`;
    }

    async installFromZip(file) {
        try {
            const zip = await JSZip.loadAsync(file);
            const manifestFile = zip.file("manifest.json");
            if (!manifestFile) throw new Error("manifest.json が見つかりません。");

            const manifestText = await manifestFile.async("string");
            const manifest = JSON.parse(manifestText);

            // バリデーションチェック (新規追加)
            const validation = this.validateManifest(manifest);
            if (!validation.valid) {
                throw new Error(`マニフェストの必須項目が不足しています: ${validation.missing.join(', ')}`);
            }

            if (!manifest.name || !manifest.author) {
                throw new Error("マニフェストに名前または開発者情報が不足しています。");
            }

            if (!manifest.uuid) {
                manifest.uuid = this.generateUUID(manifest.author, manifest.name);
            }

            const id = manifest.id || manifest.name.toLowerCase().replace(/\s+/g, '-');
            manifest.id = id;
            manifest.updateDate = new Date().toISOString().split('T')[0];

            const scriptFile = zip.file("plugin.js");
            if (scriptFile) {
                manifest.script = await scriptFile.async("string");
            }

            manifest.installedFrom = 0; // 0: local
            manifest.trustLevel = this.getManifestTrustLevel(manifest);

            this.installedPlugins[id] = manifest;
            this.saveInstalledPlugins();

            return manifest;
        } catch (error) {
            console.error("Plugin installation failed:", error);
            throw error;
        }
    }

    async enablePlugin(id) {
        if (this.plugins.has(id)) return;

        const pluginMeta = this.installedPlugins[id];
        if (!pluginMeta) return;

        try {
            if (pluginMeta.script) {
                const pluginClass = new Function('workspace', `
                    try {
                        ${pluginMeta.script}
                        if (typeof Plugin === 'undefined') {
                            throw new Error('Plugin class not defined in script');
                        }
                        return new Plugin(workspace);
                    } catch (e) {
                        console.error('Error executing plugin script:', e);
                        throw e;
                    }
                `)(this.workspace);

                if (pluginClass && typeof pluginClass.onload === 'function') {
                    await pluginClass.onload();
                }
                this.plugins.set(id, pluginClass);
            } else if (pluginMeta.affectsStyle) {
                this.plugins.set(id, { onunload: () => { } });
            }

            this.enabledPlugins.add(id);
            this.saveState();
        } catch (e) {
            console.error(`Failed to enable plugin ${id}:`, e);
            // Re-throw if it's a critical error we want the UI to handle, 
            // but for now, we just log it as the user requested "solution".
            // Since the plugin code itself has the null error, we can catch it here.
        }

    }

    async disablePlugin(id) {
        const plugin = this.plugins.get(id);
        if (plugin) {
            if (typeof plugin.onunload === 'function') {
                await plugin.onunload();
            }
            this.plugins.delete(id);
        }
        this.enabledPlugins.delete(id);
        this.saveState();
    }

    saveState() {
        localStorage.setItem('edbb_enabled_plugins', JSON.stringify(Array.from(this.enabledPlugins)));
    }

    saveInstalledPlugins() {
        localStorage.setItem('edbb_installed_plugins', JSON.stringify(this.installedPlugins));
    }

    getRegistry() {
        return Object.values(this.installedPlugins).map(plugin => {
            // インストール済みデータから信頼レベルを再計算して付与（リスト更新反映のため）
            return {
                ...plugin,
                trustLevel: this.getManifestTrustLevel(plugin)
            };
        });
    }

    // プラグインインストール用のURLを生成
    getInstallUrl(id) {
        const meta = this.installedPlugins[id];
        if (!meta || meta.installedFrom !== 1 || !meta.repo) return null;

        const repoInfo = this.parseGitHubUrl(meta.repo);
        if (!repoInfo) return null;

        const baseUrl = window.location.origin + window.location.pathname;
        let installQuery = repoInfo.fullName;
        if (meta.installRef && meta.installRef !== 'main') {
            installQuery += `@${meta.installRef}`;
        }
        return `${baseUrl}?install-plugin=${encodeURIComponent(installQuery)}`;
    }

    isPluginEnabled(id) {
        return this.enabledPlugins.has(id);
    }

    getPluginUUIDsForShare() {
        const uuids = [];
        for (const id of this.enabledPlugins) {
            if (this.isPluginSharable(id)) {
                const meta = this.installedPlugins[id];
                if (meta) {
                    uuids.push(meta.uuid);
                }
            }
        }
        return uuids;
    }

    // 共有された際に、レシピエント側でインストールを促すための情報を取得
    getSharablePluginsInfo() {
        const infos = [];
        for (const id of this.enabledPlugins) {
            if (this.isPluginSharable(id)) {
                const meta = this.installedPlugins[id];
                if (meta.repo) {
                    infos.push(meta.repo);
                }
            }
        }
        return infos;
    }

    // 未インストールの共有プラグインがある場合に呼び出すコールバックを登録
    onPluginsSuggested(callback) {
        this.suggestCallback = callback;
    }

    suggestPlugins(pluginEntries) {
        if (typeof this.suggestCallback === 'function' && pluginEntries && pluginEntries.length > 0) {
            this.suggestCallback(pluginEntries);
        }
    }

    hasNonSharablePlugin() {
        for (const id of this.enabledPlugins) {
            if (!this.isPluginSharable(id)) {
                return true;
            }
        }
        return false;
    }

    getPluginIdByUUID(uuid) {
        for (const [id, meta] of Object.entries(this.installedPlugins)) {
            if (meta.uuid === uuid) return id;
        }
        return null;
    }

    // プラグインが共有可能か判断するロジック
    isPluginSharable(id) {
        const meta = this.installedPlugins[id];
        if (!meta) return false;

        // GitHubからインストールされたものは、リポジトリURLがあるため共有可能 (installedFrom: 1)

        if (meta.installedFrom === 1 && meta.repo) return true;

        // ローカルZIPからのものは、他人が持っていない可能性があるため基本は共有不可
        // (将来的にZIPごとプロジェクトに埋め込むなら可能になるかもしれないが、現在はUUIDのみ共有するため)
        return false;
    }

    // プラグインをZIPとしてエクスポート
    async exportPluginAsZip(id) {
        const meta = this.installedPlugins[id];
        if (!meta) throw new Error("プラグインが見つかりません。");

        const zip = new JSZip();
        const manifest = { ...meta };
        const script = manifest.script;

        // manifest.json はエクスポート時に不要な情報を削る
        delete manifest.script;
        delete manifest.installedFrom;

        zip.file("manifest.json", JSON.stringify(manifest, null, 2));
        if (script) {
            zip.file("plugin.js", script);
        }

        const blob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const safeName = (manifest.id || manifest.name || 'plugin').replace(/[^a-zA-Z0-9_-]/g, '_');
        a.download = `${safeName}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}
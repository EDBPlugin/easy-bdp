/**
 * EDBP Plugin System
 * Plugin management with GitHub discovery, trust levels, and uninstallation.
 */

export class PluginManager {
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

        // 組み込みプラグインのパージ（廃止された組み込みプラグインがあれば即座に削除）
        const legacyBuiltinIds = ['vanilla-plugin'];
        const legacyBuiltinUUIDs = ['edbp-builtin-vanilla-001'];
        let purged = false;

        // IDによるパージ
        legacyBuiltinIds.forEach(id => {
            if (this.installedPlugins[id]) {
                delete this.installedPlugins[id];
                purged = true;
                console.log(`Purged legacy plugin by ID: ${id}`);
            }
            if (this.enabledPlugins.has(id)) {
                this.enabledPlugins.delete(id);
                purged = true;
            }
        });

        // UUIDによるパージ
        Object.keys(this.installedPlugins).forEach(id => {
            const plugin = this.installedPlugins[id];
            if (plugin && legacyBuiltinUUIDs.includes(plugin.uuid)) {
                delete this.installedPlugins[id];
                this.enabledPlugins.delete(id);
                purged = true;
                console.log(`Purged legacy plugin by UUID: ${plugin.uuid} (ID: ${id})`);
            }
        });

        if (purged) {
            this.saveInstalledPlugins();
            this.saveState();
        }
    }


    async init() {
        console.log('PluginManager initializing...');

        // 公認プラグインリストの取得
        try {
            const response = await fetch('https://raw.githubusercontent.com/EDBPlugin/EDBP-API/main/plugins.json');
            if (response.ok) {
                this.certifiedPlugins = await response.json();
            }
        } catch (e) {
            console.warn('Failed to fetch certified plugins list', e);
        }

        for (const pluginId of this.enabledPlugins) {
            await this.enablePlugin(pluginId);
        }
    }


    // GitHubから edbp-plugin タグ/トピックの付いたリポジトリを検索
    async searchGitHubPlugins(query = '') {
        try {
            // 1. クエリがある場合は名前検索、ない場合はトピック検索
            // topic:edbp-plugin は必須条件
            let q = 'topic:edbp-plugin';
            if (query) {
                q = `${query} topic:edbp-plugin`;
            }

            const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc`;
            const response = await fetch(url);

            if (!response.ok) {
                if (response.status === 403) throw new Error('GitHub API Rate Limit Exceeded');
                throw new Error(`GitHub API error: ${response.status}`);
            }

            let data = await response.json();

            // もしトピック検索でヒットしなかった場合、かつ検索クエリが空だった場合
            // "edbp-plugin" というキーワードで広めに検索してみる
            if (data.total_count === 0 && !query) {
                const fallbackUrl = `https://api.github.com/search/repositories?q=edbp-plugin&sort=stars&order=desc`;
                const fallbackRes = await fetch(fallbackUrl);
                if (fallbackRes.ok) {
                    data = await fallbackRes.json();
                }
            }

            // 検索結果の整形
            return data.items.map(repo => {
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
        } catch (e) {
            console.error('Failed to search GitHub plugins', e);
            return [];
        }
    }

    // 信頼レベルの判定 (GitHub Search Result用)
    getTrustLevel(repo) {
        if (repo.owner.login === 'EDBPlugin') return 'official';
        // EDBP-APIのリストに含まれているかチェック
        const isCertified = Array.isArray(this.certifiedPlugins) && this.certifiedPlugins.some(p => {
            if (typeof p === 'string') {
                return p === repo.full_name || repo.html_url.includes(p);
            }
            return p.URL === repo.html_url ||
                p.URL === repo.url ||
                (p.URL && p.URL.includes(repo.full_name));
        });
        if (isCertified) return 'certified';
        return null;
    }

    // 信頼レベルの判定 (インストール済みマニフェスト用)
    getManifestTrustLevel(manifest) {
        if (manifest.author === 'EDBPlugin') return 'official';
        if (!manifest.repo) return null;

        const isCertified = Array.isArray(this.certifiedPlugins) && this.certifiedPlugins.some(p => {
            if (typeof p === 'string') {
                return manifest.repo.includes(p);
            }
            return p.URL === manifest.repo || (p.URL && manifest.repo.includes(p.URL));
        });

        if (isCertified) return 'certified';
        return null;
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
            `${subPath}readme.md`,
            'README.md',
            'readme.md',
            'README.MD'
        ];

        // 重複を除去
        const uniquePaths = [...new Set(possiblePaths)];

        for (const path of uniquePaths) {
            try {
                const url = `https://raw.githubusercontent.com/${fullName}/${branch}/${path}`;
                const response = await fetch(url);
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
                const response = await fetch(apiUrl, {
                    headers: { Accept: 'application/vnd.github+json' }
                });
                if (!response.ok) return null;

                const data = await response.json();
                if (!data || data.type !== 'file' || !data.content) return null;
                return decodeBase64Utf8(data.content);
            };

            const manifestText = await fetchRepoFile('manifest.json');
            if (!manifestText) throw new Error('manifest.json not found at repository root for selected ref');

            const manifest = JSON.parse(manifestText);

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

                // Ensure DOM is ready before executing plugin script
                if (document.readyState === 'loading') {
                    await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
                }

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

    isPluginEnabled(id) {
        return this.enabledPlugins.has(id);
    }

    getPluginUUIDsForShare() {
        const uuids = [];
        for (const id of this.enabledPlugins) {
            if (this.isPluginSharable(id)) {
                const meta = this.installedPlugins[id];
                if (meta && meta.affectsBlocks) {
                    uuids.push(meta.uuid);
                }
            }
        }
        return uuids;
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
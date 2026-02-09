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

        // 組み込みプラグインレジストリ
        this.builtinRegistry = [
            {
                id: 'vanilla-plugin',
                uuid: 'edbp-builtin-vanilla-001',
                name: 'Vanilla Plugin',
                author: 'EDBPlugin',
                version: '1.0.0',
                description: 'EDBPの基本機能を拡張するバニラプラグインです.',
                repo: 'https://github.com/EDBPlugin/easy-bdp',
                updateDate: '2026-02-07',
                affectsStyle: false,
                affectsBlocks: true,
                isCustom: false
            }
        ];
    }

    async init() {
        console.log('PluginManager initializing...');

        // 公認プラグインリストの取得
        try {
            const response = await fetch('https://raw.githubusercontent.com/EDBPlugin/EDBP-API/main/1.json');
            if (response.ok) {
                this.certifiedPlugins = await response.json();
            }
        } catch (e) {
            console.warn('Failed to fetch certified plugins list', e);
        }

        // 組み込みプラグインをインストール済みとして扱う
        this.builtinRegistry.forEach(p => {
            if (!this.installedPlugins[p.id]) {
                this.installedPlugins[p.id] = p;
            }
        });

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

    // 信頼レベルの判定
    getTrustLevel(repo) {
        if (repo.owner.login === 'EDBPlugin') return 'official';
        // EDBP-APIのリストに含まれているかチェック
        const isCertified = Array.isArray(this.certifiedPlugins) && this.certifiedPlugins.some(p =>
            p.URL === repo.html_url ||
            p.URL === repo.url ||
            (p.URL && p.URL.includes(repo.full_name))
        );
        if (isCertified) return 'certified';
        return null;
    }

    // READMEの取得
    async getREADME(fullName, defaultBranch = 'main') {
        const possiblePaths = ['README.md', 'readme.md', 'README.MD'];
        for (const path of possiblePaths) {
            try {
                const url = `https://raw.githubusercontent.com/${fullName}/${defaultBranch}/${path}`;
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

            this.installedPlugins[id] = manifest;
            this.saveInstalledPlugins();
            return manifest;
        } catch (error) {
            console.error("GitHub installation failed:", error);
            throw error;
        }
    }
    async uninstallPlugin(id) {
        if (this.builtinRegistry.some(p => p.id === id)) {
            throw new Error("組み込みプラグインは削除できません。");
        }

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
            if (id === 'vanilla-plugin') {
                const plugin = new VanillaPlugin(this.workspace);
                await plugin.onload();
                this.plugins.set(id, plugin);
            } else if (pluginMeta.script) {
                const pluginClass = new Function('workspace', `
                    ${pluginMeta.script}
                    return new Plugin(workspace);
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
        return Object.values(this.installedPlugins);
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

        // 組み込みプラグインは共有可能 (UUIDで管理)
        if (this.builtinRegistry.some(p => p.id === id)) return true;

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

        // manifest.js はエクスポート時に不要な情報を削る
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
        a.download = `${manifest.id || manifest.name}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

class VanillaPlugin {
    constructor(workspace) {
        this.workspace = workspace;
    }

    async onload() {
        console.log('Vanilla Plugin loaded');
        this.registerBlocks();
    }

    registerBlocks() {
        if (typeof Blockly === 'undefined') return;

        Blockly.Blocks['vanilla_plugin_test'] = {
            init: function () {
                this.appendDummyInput()
                    .appendField("🍦 バニラプラグイン・テスト");
                this.setPreviousStatement(true, null);
                this.setNextStatement(true, null);
                this.setColour(200);
                this.setTooltip("バニラプラグインが正常に動作しているか確認するためのブロックです。このブロックをフィールドに出すとコードを生成できません！");
            }
        };

        Blockly.Python['vanilla_plugin_test'] = function (block) {
            return "# Vanilla Plugin Test\n";
        };

        this.updateToolbox();
    }

    updateToolbox() {
        const toolbox = document.getElementById('toolbox');
        if (!toolbox) return;

        if (toolbox.querySelector('category[name="プラグイン"]')) return;

        const category = document.createElement('category');
        category.setAttribute('name', 'プラグイン');
        category.setAttribute('data-icon', '🔌');
        category.setAttribute('colour', '#200');
        category.innerHTML = '<block type="vanilla_plugin_test"></block>';

        toolbox.appendChild(category);

        if (this.workspace) {
            this.workspace.updateToolbox(toolbox);
        }
    }

    async onunload() {
        console.log('Vanilla Plugin unloaded');
        this.removeFromToolbox();
    }

    removeFromToolbox() {
        const toolbox = document.getElementById('toolbox');
        if (!toolbox) return;

        const category = toolbox.querySelector('category[name="プラグイン"]');
        if (category) {
            category.remove();
            if (this.workspace) {
                this.workspace.updateToolbox(toolbox);
            }
        }
    }
}

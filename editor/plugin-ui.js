/**
 * EDBP Plugin UI
 * Market-style plugin management with integrated search and uninstallation.
 */
const PLUGIN_MOBILE_WARNING_SKIP_KEY = 'edbb_plugin_mobile_warning_skip';

export class PluginUI {
    constructor(pluginManager) {
        this.pluginManager = pluginManager;
        this.modal = document.getElementById('pluginModal');
        this.btn = document.getElementById('pluginBtn');
        this.closeBtn = document.getElementById('pluginModalClose');
        this.pluginList = document.getElementById('pluginList');
        this.pluginDetailEmpty = document.getElementById('pluginDetailEmpty');
        this.pluginDetailContent = document.getElementById('pluginDetailContent');
        this.mobileWarningModal = document.getElementById('pluginMobileWarningModal');
        this.mobileWarningProceedBtn = document.getElementById('pluginMobileWarningProceedBtn');
        this.mobileWarningCancelBtn = document.getElementById('pluginMobileWarningCancelBtn');
        this.mobileWarningCloseBtn = document.getElementById('pluginMobileWarningClose');
        this.mobileWarningSkipCheckbox = document.getElementById('pluginMobileWarningSkipCheckbox');

        this.isOnlyInstalled = false;
        this.searchQuery = '';
        this.githubResults = [];
        this.currentSearchId = 0;
        this.mobileWarningResolver = null;

        this.init();
    }

    init() {
        this.btn.addEventListener('click', () => this.open());
        this.closeBtn.addEventListener('click', () => this.close());

        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.close();
        });

        // 検索・フィルターUIの取得
        const searchInput = document.querySelector('input[placeholder="プラグインを検索..."]');
        const filterToggle = this.modal?.querySelector('input[type="checkbox"]'); // インストール済みのみ表示

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value;
                this.renderMarketplace();
            });
        }

        if (filterToggle) {
            filterToggle.addEventListener('change', (e) => {
                this.isOnlyInstalled = e.target.checked;
                this.renderMarketplace();
            });
        }

        this.mobileWarningProceedBtn?.addEventListener('click', () => this.resolveMobileWarning(true));
        this.mobileWarningCancelBtn?.addEventListener('click', () => this.resolveMobileWarning(false));
        this.mobileWarningCloseBtn?.addEventListener('click', () => this.resolveMobileWarning(false));
        this.mobileWarningModal?.addEventListener('click', (e) => {
            if (e.target === this.mobileWarningModal) this.resolveMobileWarning(false);
        });
        this.boundMobileWarningEscHandler = (event) => {
            if (event.key === 'Escape' && this.isMobileWarningOpen()) {
                this.resolveMobileWarning(false);
            }
        };
        document.addEventListener('keydown', this.boundMobileWarningEscHandler);

        // ZIPインストールボタン
        const installBtn = document.getElementById('pluginInstallBtn');
        const installInput = document.getElementById('pluginInstallInput');
        if (installBtn && installInput) {
            installBtn.addEventListener('click', () => installInput.click());
            installInput.addEventListener('change', async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                    await this.pluginManager.installFromZip(file);
                    this.renderMarketplace();
                    alert('プラグインをインストールしました。');
                } catch (err) {
                    alert('プラグインのインストールに失敗しました: ' + err.message);
                }
                e.target.value = '';
            });
        }

        this.renderMarketplace();
    }

    async open() {
        if (this.shouldShowMobileWarning()) {
            const canOpen = await this.showMobileWarning();
            if (!canOpen) return;
        }
        this.modal.classList.remove('hidden');
        this.modal.classList.add('flex');
        void this.modal.offsetWidth;
        this.modal.classList.add('show-modal');
        this.renderMarketplace();
    }

    close() {
        this.modal.classList.remove('show-modal');
        setTimeout(() => {
            this.modal.classList.remove('flex');
            this.modal.classList.add('hidden');
        }, 300);
    }

    isMobileDevice() {
        return document.documentElement.classList.contains('is-mobile')
            || (typeof window !== 'undefined' && window.innerWidth < 768);
    }

    shouldSkipMobileWarning() {
        try {
            return window.localStorage?.getItem(PLUGIN_MOBILE_WARNING_SKIP_KEY) === '1';
        } catch (error) {
            return false;
        }
    }

    setSkipMobileWarning(shouldSkip) {
        try {
            if (shouldSkip) {
                window.localStorage?.setItem(PLUGIN_MOBILE_WARNING_SKIP_KEY, '1');
            } else {
                window.localStorage?.removeItem(PLUGIN_MOBILE_WARNING_SKIP_KEY);
            }
        } catch (error) {
            // localStorage unavailable
        }
    }

    shouldShowMobileWarning() {
        return this.isMobileDevice() && !this.shouldSkipMobileWarning();
    }

    isMobileWarningOpen() {
        return !!this.mobileWarningModal && !this.mobileWarningModal.classList.contains('hidden');
    }

    async showMobileWarning() {
        if (!this.mobileWarningModal) return true;
        if (this.mobileWarningSkipCheckbox) {
            this.mobileWarningSkipCheckbox.checked = false;
        }
        this.mobileWarningModal.setAttribute('aria-hidden', 'false');
        this.mobileWarningModal.classList.remove('hidden');
        this.mobileWarningModal.classList.add('flex');
        void this.mobileWarningModal.offsetWidth;
        this.mobileWarningModal.classList.add('show-modal');
        setTimeout(() => this.mobileWarningProceedBtn?.focus(), 0);
        return new Promise((resolve) => {
            this.mobileWarningResolver = resolve;
        });
    }

    hideMobileWarning() {
        if (!this.mobileWarningModal) return Promise.resolve();
        this.mobileWarningModal.setAttribute('aria-hidden', 'true');
        this.mobileWarningModal.classList.remove('show-modal');
        return new Promise((resolve) => {
            setTimeout(() => {
                this.mobileWarningModal?.classList.remove('flex');
                this.mobileWarningModal?.classList.add('hidden');
                resolve();
            }, 300);
        });
    }

    resolveMobileWarning(accepted) {
        if (!this.mobileWarningResolver) return;
        if (accepted) {
            this.setSkipMobileWarning(Boolean(this.mobileWarningSkipCheckbox?.checked));
        }
        const resolver = this.mobileWarningResolver;
        this.mobileWarningResolver = null;
        this.hideMobileWarning().then(() => resolver(accepted));
    }

    async renderMarketplace() {
        const searchId = ++this.currentSearchId;
        this.pluginList.innerHTML = '';
        const installed = this.pluginManager.getRegistry();

        // 1. インストール済みプラグインの表示 (検索クエリがある場合はフィルタリング)
        const filteredInstalled = installed.filter(p =>
            p.name.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
            p.author.toLowerCase().includes(this.searchQuery.toLowerCase())
        );

        if (filteredInstalled.length > 0) {
            const header = document.createElement('div');
            header.className = 'px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider';
            header.textContent = 'インストール済み';
            this.pluginList.appendChild(header);

            filteredInstalled.forEach(plugin => {
                this.addPluginItem(plugin, true);
            });
        }

        // 2. GitHub Marketplace (検索またはトピック表示)
        if (!this.isOnlyInstalled) {
            const header = document.createElement('div');
            header.className = 'px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-4 flex justify-between items-center';

            // クエリがある場合は「検索結果」、ない場合は「注目のコミュニティプラグイン」
            const title = this.searchQuery ? `GitHub リポジトリ検索: "${this.searchQuery}"` : '注目のコミュニティプラグイン (GitHub Topic)';
            header.innerHTML = `<span>${title}</span><span class="animate-pulse">GitHubから取得中...</span>`;
            this.pluginList.appendChild(header);

            // PluginManager.searchGitHubPlugins はクエリがあればリポジトリ検索、なければ topic:edbp-plugin 検索を行う
            const results = await this.pluginManager.searchGitHubPlugins(this.searchQuery);

            // 非同期処理の間に別の検索が開始されていたら中断
            if (searchId !== this.currentSearchId) return;

            const statusSpan = header.querySelector('span:last-child');
            if (statusSpan) statusSpan.remove();

            if (results.length === 0) {
                const empty = document.createElement('div');
                empty.className = 'px-3 py-4 text-center text-xs text-slate-400';
                empty.textContent = this.searchQuery ? '該当するリポジトリが見つかりませんでした' : '注目のプラグインがありません';
                this.pluginList.appendChild(empty);
            } else {
                results.forEach(plugin => {
                    // すでにインストール済みのものは重複表示しない
                    if (installed.some(p => p.repo === plugin.repo)) return;
                    this.addPluginItem(plugin, false);
                });
            }
        }
        lucide.createIcons();
    }

    addPluginItem(plugin, isInstalled) {
        const isEnabled = isInstalled && this.pluginManager.isPluginEnabled(plugin.id);
        const item = document.createElement('div');
        item.className = `p-3 rounded-lg cursor-pointer transition-colors ${isEnabled ? 'bg-indigo-50/50 dark:bg-indigo-900/20' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`;

        let trustBadge = '';
        if (plugin.author === 'EDBPlugin' || plugin.trustLevel === 'official') {
            trustBadge = '<span class="ml-1 text-[9px] px-1 rounded bg-blue-500 text-white">公式</span>';
        } else if (plugin.trustLevel === 'certified') {
            trustBadge = '<span class="ml-1 text-[9px] px-1 rounded bg-green-500 text-white">公認</span>';
        }

        item.innerHTML = `
            <div class="flex justify-between items-start">
                <div class="font-bold text-sm text-slate-900 dark:text-white flex items-center">${plugin.name}${trustBadge}</div>
                ${isEnabled ? '<div class="w-2 h-2 rounded-full bg-indigo-500 mt-1.5"></div>' : ''}
                ${!isInstalled ? '<i data-lucide="download-cloud" class="w-3.5 h-3.5 text-slate-300"></i>' : ''}
            </div>
            <div class="text-[11px] text-slate-500 dark:text-slate-400 mt-1">開発者: ${plugin.author}</div>
        `;
        item.addEventListener('click', () => isInstalled ? this.showDetail(plugin) : this.showGitHubDetail(plugin));
        this.pluginList.appendChild(item);
    }

    async showGitHubDetail(plugin) {
        this.pluginDetailEmpty.classList.add('hidden');
        this.pluginDetailContent.classList.remove('hidden');
        this.pluginDetailContent.innerHTML = '<div class="p-8 text-center text-slate-500">GitHubから情報を取得中...</div>';

        const [readme, releases] = await Promise.all([
            this.pluginManager.getREADME(plugin.fullName, plugin.defaultBranch),
            this.pluginManager.getReleases(plugin.fullName)
        ]);

        let trustBadge = '';
        if (plugin.trustLevel === 'official' || plugin.author === 'EDBPlugin') {
            trustBadge = '<span class="text-xs px-2 py-1 rounded bg-blue-500 text-white font-bold">公式プラグイン</span>';
        } else if (plugin.trustLevel === 'certified') {
            trustBadge = '<span class="text-xs px-2 py-1 rounded bg-green-500 text-white font-bold">公認プラグイン</span>';
        }

        this.pluginDetailContent.innerHTML = `
            <div class="flex flex-col mb-6">
                <div class="flex justify-between items-start mb-4">
                    <div>
                        <h1 class="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">${plugin.name} ${trustBadge}</h1>
                        <div class="flex flex-wrap items-center gap-4 mt-2 text-sm text-slate-500 dark:text-slate-400">
                            <span class="flex items-center gap-1"><i data-lucide="user" class="w-3.5 h-3.5"></i> 開発者: ${plugin.author}</span>
                            <span class="flex items-center gap-1"><i data-lucide="star" class="w-3.5 h-3.5"></i> ${plugin.stars} Stars</span>
                        </div>
                    </div>
                    <div class="text-sm text-indigo-500 dark:text-indigo-400">
                        <a href="${plugin.repo}" target="_blank" class="hover:underline flex items-center gap-1">
                            <i data-lucide="github" class="w-3.5 h-3.5"></i> GitHub
                        </a>
                    </div>
                </div>

                <!-- インストール設定 UI -->
                <div class="bg-slate-50 dark:bg-slate-950/20 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label class="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">バージョン (リリース)</label>
                            <select id="ghVersionSelect" class="w-full pl-3 pr-10 py-2.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2020%2020%22%3E%3Cpath%20stroke%3D%22%236b7280%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%221.5%22%20d%3D%22m6%208%204%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.25rem_1.25rem] bg-[right_0.5rem_center] bg-no-repeat transition-all">
                                <option value="default">デフォルト (${plugin.defaultBranch})</option>
                                ${releases.map(r => `<option value="${r.tag_name}">${r.tag_name} ${r.prerelease ? '(Pre-release)' : ''}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">ファイル (Zip)</label>
                            <select id="ghFileSelect" class="w-full pl-3 pr-10 py-2.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2020%2020%22%3E%3Cpath%20stroke%3D%22%236b7280%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%221.5%22%20d%3D%22m6%208%204%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.25rem_1.25rem] bg-[right_0.5rem_center] bg-no-repeat transition-all">
                                <option value="default-zip">Source code (zip)</option>
                            </select>
                        </div>
                    </div>
                    <button id="installFromGhBtn" class="w-full py-3 rounded-lg font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                        <i data-lucide="download" class="w-5 h-5"></i> <span>インストールを実行</span>
                    </button>
                </div>
            </div>
            
            <div class="prose dark:prose-invert max-w-none border-t border-slate-100 dark:border-slate-800 pt-6">
                <div class="bg-slate-50 dark:bg-slate-950/50 rounded-xl p-6 border border-slate-100 dark:border-slate-800 font-sans text-sm leading-relaxed">
                    <div class="readme-content">${this.renderMarkdown(readme)}</div>
                </div>
            </div>
        `;
        lucide.createIcons();

        const versionSelect = document.getElementById('ghVersionSelect');
        const fileSelect = document.getElementById('ghFileSelect');
        const installBtn = document.getElementById('installFromGhBtn');

        const updateFiles = () => {
            const tag = versionSelect.value;
            fileSelect.innerHTML = '';

            if (tag === 'default') {
                fileSelect.innerHTML = '<option value="default-zip">Source code (zip)</option>';
            } else {
                const release = releases.find(r => r.tag_name === tag);
                if (release) {
                    // ZIPアセットのみ抽出 (tar.gzは除外)
                    const assets = release.assets.filter(a => a.name.toLowerCase().endsWith('.zip'));
                    assets.forEach(a => {
                        const option = document.createElement('option');
                        option.value = a.browser_download_url;
                        option.textContent = a.name;
                        fileSelect.appendChild(option);
                    });

                    // Source code (zip) を最後に追加
                    const sourceZip = document.createElement('option');
                    sourceZip.value = release.zipball_url;
                    sourceZip.textContent = 'Source code (zip)';
                    fileSelect.appendChild(sourceZip);
                }
            }
        };

        versionSelect.addEventListener('change', updateFiles);
        updateFiles();

        installBtn.addEventListener('click', async () => {
            let zipUrl = fileSelect.value;
            if (zipUrl === 'default-zip') {
                zipUrl = plugin.defaultBranch;
            }

            installBtn.disabled = true;
            const originalContent = installBtn.innerHTML;
            installBtn.innerHTML = '<i class="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></i> <span>インストール中...</span>';

            try {
                const manifest = await this.pluginManager.installFromGitHub(plugin.fullName, zipUrl);
                this.renderMarketplace();
                this.showDetail(manifest);
                alert('インストールが完了しました！');
            } catch (err) {
                alert('インストールに失敗しました: ' + err.message);
                installBtn.disabled = false;
                installBtn.innerHTML = originalContent;
                lucide.createIcons();
            }
        });
    }

    showDetail(plugin) {
        this.pluginDetailEmpty.classList.add('hidden');
        this.pluginDetailContent.classList.remove('hidden');

        const isEnabled = this.pluginManager.isPluginEnabled(plugin.id);
        const isBuiltin = plugin.id === 'vanilla-plugin';

        let trustBadge = '';
        if (plugin.author === 'EDBPlugin' || plugin.trustLevel === 'official') {
            trustBadge = '<span class="text-xs px-2 py-1 rounded bg-blue-500 text-white font-bold">公式プラグイン</span>';
        } else if (plugin.trustLevel === 'certified') {
            trustBadge = '<span class="text-xs px-2 py-1 rounded bg-green-500 text-white font-bold">公認プラグイン</span>';
        }

        this.pluginDetailContent.innerHTML = `
            <div class="flex justify-between items-start mb-6">
                <div>
                    <h1 class="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">${plugin.name} ${trustBadge}</h1>
                    <div class="flex flex-wrap items-center gap-4 mt-2 text-sm text-slate-500 dark:text-slate-400">
                        <span class="flex items-center gap-1"><i data-lucide="user" class="w-3.5 h-3.5"></i> 開発者: ${plugin.author}</span>
                        <span class="flex items-center gap-1"><i data-lucide="tag" class="w-3.5 h-3.5"></i> バージョン: ${plugin.version}</span>
                    </div>
                    <div class="mt-1 text-[10px] font-mono text-slate-400">UUID: ${plugin.uuid}</div>
                    <div class="mt-2 flex gap-2 items-center">
                        ${plugin.repo ? `
                        <a href="${plugin.repo}" target="_blank" class="text-xs text-indigo-500 hover:underline flex items-center gap-1">
                            <i data-lucide="github" class="w-3 h-3"></i> リポジトリ
                        </a>` : ''}
                        <span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">
                            Source: ${plugin.installedFrom === 1 ? 'GitHub' : 'Local ZIP'}
                        </span>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <button id="sharePluginBtn" class="p-2 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:text-slate-400 dark:hover:text-indigo-400 dark:hover:bg-indigo-900/20 transition-all" title="共有・エクスポート">
                        <i data-lucide="share-2" class="w-5 h-5"></i>
                    </button>
                    <button id="togglePluginBtn" class="px-6 py-2 rounded-lg font-bold ${isEnabled ? 'bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-200' : 'bg-indigo-600 text-white hover:bg-indigo-700'} transition-all">
                        ${isEnabled ? '無効化' : '有効化'}
                    </button>
                    ${!isBuiltin ? `
                    <button id="uninstallPluginBtn" class="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all" title="削除">
                        <i data-lucide="trash-2" class="w-5 h-5"></i>
                    </button>
                    ` : ''}
                </div>
            </div>
            
            <div class="prose dark:prose-invert max-w-none border-t border-slate-100 dark:border-slate-800 pt-6">
                <div id="readme-container" class="bg-slate-50 dark:bg-slate-950/50 rounded-xl p-6 border border-slate-100 dark:border-slate-800">
                    <div class="animate-pulse flex flex-col gap-3">
                        <div class="h-4 bg-slate-200 dark:bg-slate-800 rounded w-3/4"></div>
                        <div class="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/2"></div>
                        <div class="h-4 bg-slate-200 dark:bg-slate-800 rounded w-5/6"></div>
                    </div>
                </div>
            </div>
        `;
        lucide.createIcons();

        this.loadLocalREADME(plugin);

        document.getElementById('togglePluginBtn').addEventListener('click', async () => {
            if (isEnabled) {
                await this.pluginManager.disablePlugin(plugin.id);
            } else {
                await this.pluginManager.enablePlugin(plugin.id);
            }
            this.renderMarketplace();
            this.showDetail(plugin);
        });

        document.getElementById('sharePluginBtn').addEventListener('click', async () => {
            const isSharable = this.pluginManager.isPluginSharable(plugin.id);

            if (plugin.repo) {
                // GitHubリポジトリがある場合はURLをコピー
                try {
                    await navigator.clipboard.writeText(plugin.repo);
                    alert('リポジトリのURLをコピーしました！');
                } catch (e) {
                    alert('URLのコピーに失敗しました: ' + plugin.repo);
                }
            } else if (!isSharable) {
                // 共有不可（ローカル）な場合はZIPエクスポートを提案
                if (confirm('このプラグインはローカルに保存されています。ZIPファイルとしてエクスポートして共有しますか？')) {
                    try {
                        await this.pluginManager.exportPluginAsZip(plugin.id);
                    } catch (e) {
                        alert('エクスポートに失敗しました: ' + e.message);
                    }
                }
            }
        });

        const uninstallBtn = document.getElementById('uninstallPluginBtn');
        if (uninstallBtn) {
            uninstallBtn.addEventListener('click', async () => {
                if (confirm(`プラグイン「${plugin.name}」を削除してもよろしいですか？`)) {
                    try {
                        await this.pluginManager.uninstallPlugin(plugin.id);
                        this.renderMarketplace();
                        this.pluginDetailContent.classList.add('hidden');
                        this.pluginDetailEmpty.classList.remove('hidden');
                        alert('プラグインを削除しました。');
                    } catch (err) {
                        alert('削除に失敗しました: ' + err.message);
                    }
                }
            });
        }
    }

    async loadLocalREADME(plugin) {
        const container = document.getElementById('readme-container');
        if (!container) return;

        if (plugin.repo && plugin.repo.includes('github.com')) {
            const fullName = plugin.repo.split('github.com/')[1].replace(/\/$/, '');
            const readme = await this.pluginManager.getREADME(fullName);
            container.innerHTML = `<div class="font-sans text-sm leading-relaxed"><div class="readme-content">${this.renderMarkdown(readme)}</div></div>`;
        } else {
            container.innerHTML = `<p class="text-sm text-slate-500">${plugin.description}</p>`;
        }
    }

    renderMarkdown(markdown) {
        if (typeof marked === 'undefined') return markdown;

        // marked.js のオプション設定
        marked.setOptions({
            gfm: true,
            breaks: true,
            headerIds: true,
            mangle: false
        });

        // marked.js を使用して Markdown を HTML に変換
        // HTMLタグをそのまま通すようにパース
        const rawHtml = marked.parse(markdown);

        // DOMPurify を使用して安全な HTML にサニタイズ
        if (typeof DOMPurify !== 'undefined') {
            return DOMPurify.sanitize(rawHtml, {
                // GitHubのREADMEでよく使われるタグと属性を許可
                ADD_TAGS: ['div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'span', 'img', 'a', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'code', 'pre', 'blockquote', 'hr', 'details', 'summary', 'b', 'i', 'strong', 'em', 'del', 'center'],
                ADD_ATTR: ['class', 'style', 'src', 'href', 'target', 'alt', 'width', 'height', 'align', 'valign', 'border'],
                // インラインスタイルを許可 (中央揃えなどに必要)
                FORBID_ATTR: [],
                FORBID_TAGS: []
            });
        }
        return rawHtml;
    }

    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}

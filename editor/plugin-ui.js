/**
 * EDBP Plugin UI
 * Market-style plugin management with integrated search and uninstallation.
 */

export class PluginUI {
    constructor(pluginManager) {
        this.pluginManager = pluginManager;
        this.modal = document.getElementById('pluginModal');
        this.btn = document.getElementById('pluginBtn');
        this.closeBtn = document.getElementById('pluginModalClose');
        this.pluginList = document.getElementById('pluginList');
        this.pluginDetailEmpty = document.getElementById('pluginDetailEmpty');
        this.pluginDetailContent = document.getElementById('pluginDetailContent');
        
        this.isOnlyInstalled = false;
        this.searchQuery = '';
        this.githubResults = [];
        
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
        const filterToggle = document.querySelector('input[type="checkbox"]'); // インストール済みのみ表示
        
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

    open() {
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

    async renderMarketplace() {
        this.pluginList.innerHTML = '';
        
        // 1. インストール済みプラグインの表示
        const installed = this.pluginManager.getRegistry();
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

        // 2. GitHubからの検索結果の表示 (インストール済みのみ表示がOFFの場合)
        if (!this.isOnlyInstalled && this.searchQuery.length >= 2) {
            const header = document.createElement('div');
            header.className = 'px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-4 flex justify-between items-center';
            header.innerHTML = '<span>GitHub Marketplace</span><span class="animate-pulse">Searching...</span>';
            this.pluginList.appendChild(header);

            const results = await this.pluginManager.searchGitHubPlugins(this.searchQuery);
            header.querySelector('span:last-child').remove();
            
            if (results.length === 0) {
                const empty = document.createElement('div');
                empty.className = 'px-3 py-4 text-center text-xs text-slate-400';
                empty.textContent = 'GitHubに該当するプラグインはありません';
                this.pluginList.appendChild(empty);
            } else {
                results.forEach(plugin => {
                    // すでにインストール済みのものはスキップ
                    if (installed.some(p => p.repo === plugin.repo)) return;
                    this.addPluginItem(plugin, false);
                });
            }
        } else if (!this.isOnlyInstalled && this.searchQuery === '') {
            // デフォルトのレコメンド表示 (edbp-pluginタグのついたもの)
            const header = document.createElement('div');
            header.className = 'px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-4';
            header.textContent = '注目のコミュニティプラグイン';
            this.pluginList.appendChild(header);

            const results = await this.pluginManager.searchGitHubPlugins();
            results.forEach(plugin => {
                if (installed.some(p => p.repo === plugin.repo)) return;
                this.addPluginItem(plugin, false);
            });
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
            <div class="flex gap-1 mt-1">
                ${plugin.affectsStyle ? '<span class="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">スタイル</span>' : ''}
                ${plugin.affectsBlocks ? '<span class="text-[9px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">ブロック</span>' : ''}
                ${plugin.isCustom ? '<span class="text-[9px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">自作</span>' : ''}
            </div>
        `;
        item.addEventListener('click', () => isInstalled ? this.showDetail(plugin) : this.showGitHubDetail(plugin));
        this.pluginList.appendChild(item);
    }

    async showGitHubDetail(plugin) {
        this.pluginDetailEmpty.classList.add('hidden');
        this.pluginDetailContent.classList.remove('hidden');
        this.pluginDetailContent.innerHTML = '<div class="p-8 text-center text-slate-500">GitHubから情報を取得中...</div>';

        const readme = await this.pluginManager.getREADME(plugin.fullName, plugin.defaultBranch);
        
        let trustBadge = '';
        if (plugin.trustLevel === 'official' || plugin.author === 'EDBPlugin') {
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
                        <span class="flex items-center gap-1"><i data-lucide="star" class="w-3.5 h-3.5"></i> ${plugin.stars} Stars</span>
                    </div>
                    <div class="mt-2 text-sm text-indigo-500 dark:text-indigo-400">
                        <a href="${plugin.repo}" target="_blank" class="hover:underline flex items-center gap-1">
                            <i data-lucide="github" class="w-3.5 h-3.5"></i> GitHubでソースを見る
                        </a>
                    </div>
                </div>
                <div>
                    <button id="installFromGhBtn" class="px-6 py-2 rounded-lg font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg transition-all flex items-center gap-2">
                        <i data-lucide="download" class="w-4 h-4"></i> インストール
                    </button>
                </div>
            </div>
            
            <div class="prose dark:prose-invert max-w-none border-t border-slate-100 dark:border-slate-800 pt-6">
                <div class="bg-slate-50 dark:bg-slate-950/50 rounded-xl p-6 border border-slate-100 dark:border-slate-800 font-sans text-sm leading-relaxed whitespace-pre-wrap">
                    ${this.escapeHtml(readme)}
                </div>
            </div>
        `;
        lucide.createIcons();

        document.getElementById('installFromGhBtn').addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            btn.disabled = true;
            btn.innerHTML = '<i class="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></i> インストール中...';
            try {
                const manifest = await this.pluginManager.installFromGitHub(plugin.fullName, plugin.defaultBranch);
                this.renderMarketplace();
                this.showDetail(manifest);
                alert('インストールが完了しました！');
            } catch (err) {
                alert('インストールに失敗しました: ' + err.message);
                btn.disabled = false;
                btn.innerHTML = '<i data-lucide="download" class="w-4 h-4"></i> インストール';
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
        if (plugin.author === 'EDBPlugin') {
            trustBadge = '<span class="text-xs px-2 py-1 rounded bg-blue-500 text-white font-bold">公式プラグイン</span>';
        }

        this.pluginDetailContent.innerHTML = `
            <div class="flex justify-between items-start mb-6">
                <div>
                    <h1 class="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">${plugin.name} ${trustBadge}</h1>
                    <div class="flex flex-wrap items-center gap-4 mt-2 text-sm text-slate-500 dark:text-slate-400">
                        <span class="flex items-center gap-1"><i data-lucide="user" class="w-3.5 h-3.5"></i> 開発者: ${plugin.author}</span>
                        <span class="flex items-center gap-1"><i data-lucide="tag" class="w-3.5 h-3.5"></i> バージョン: ${plugin.version}</span>
                        <span class="flex items-center gap-1 font-mono text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">UUID: ${plugin.uuid}</span>
                    </div>
                    <div class="mt-2 text-sm text-indigo-500 dark:text-indigo-400">
                        <a href="${plugin.repo}" target="_blank" class="hover:underline flex items-center gap-1">
                            <i data-lucide="github" class="w-3.5 h-3.5"></i> リポジトリ
                        </a>
                    </div>
                    <div class="flex gap-2 mt-3">
                        ${plugin.affectsStyle ? '<span class="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 flex items-center gap-1"><i data-lucide="palette" class="w-3 h-3"></i> スタイル干渉</span>' : ''}
                        ${plugin.affectsBlocks ? '<span class="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 flex items-center gap-1"><i data-lucide="blocks" class="w-3 h-3"></i> ブロック追加</span>' : ''}
                        ${plugin.isCustom ? '<span class="text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 flex items-center gap-1"><i data-lucide="user-cog" class="w-3 h-3"></i> 自作プラグイン</span>' : ''}
                    </div>
                </div>
                <div class="flex flex-col gap-2 items-end">
                    <div class="flex gap-2">
                        <button id="togglePluginBtn" class="px-6 py-2 rounded-lg font-bold transition-all shadow-md ${isEnabled ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}">
                            ${isEnabled ? '無効化' : '有効化'}
                        </button>
                        ${!isBuiltin ? `
                        <button id="uninstallPluginBtn" class="p-2 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 dark:border-red-900/30 dark:hover:bg-red-900/20 transition-colors" title="アンインストール">
                            <i data-lucide="trash-2" class="w-5 h-5"></i>
                        </button>
                        ` : ''}
                    </div>
                </div>
            </div>
            
            <div class="prose dark:prose-invert max-w-none border-t border-slate-100 dark:border-slate-800 pt-6">
                <div id="readme-container" class="bg-slate-50 dark:bg-slate-950/50 rounded-xl p-6 border border-slate-100 dark:border-slate-800">
                    <p class="text-xs text-slate-400 italic">README情報を読み込んでいます...</p>
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
            this.showDetail(plugin);
            this.renderMarketplace();
        });

        const uninstallBtn = document.getElementById('uninstallPluginBtn');
        if (uninstallBtn) {
            uninstallBtn.addEventListener('click', async () => {
                if (confirm(`${plugin.name} を削除してもよろしいですか？`)) {
                    await this.pluginManager.uninstallPlugin(plugin.id);
                    this.renderMarketplace();
                    this.pluginDetailContent.classList.add('hidden');
                    this.pluginDetailEmpty.classList.remove('hidden');
                    alert('プラグインを削除しました。');
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
            container.innerHTML = `<div class="font-sans text-sm leading-relaxed whitespace-pre-wrap">${this.escapeHtml(readme)}</div>`;
        } else {
            container.innerHTML = `<p class="text-sm text-slate-500">${plugin.description}</p>`;
        }
    }

    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}

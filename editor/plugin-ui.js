/**
 * EDBP Plugin UI
 * Handles plugin management with GitHub discovery and trust levels.
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
        
        this.activeTab = 'installed'; // 'installed' or 'github'
        this.githubPlugins = [];
        
        this.init();
    }

    init() {
        this.btn.addEventListener('click', () => this.open());
        this.closeBtn.addEventListener('click', () => this.close());
        
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.close();
        });

        // タブ切り替えUIの構築
        const sidebar = this.pluginList.parentElement;
        const tabContainer = document.createElement('div');
        tabContainer.className = 'flex border-b border-slate-100 dark:border-slate-800 mb-4';
        tabContainer.innerHTML = `
            <button id="tab-installed" class="flex-1 py-2 text-xs font-bold border-b-2 border-indigo-500 text-indigo-600">インストール済み</button>
            <button id="tab-github" class="flex-1 py-2 text-xs font-bold border-b-2 border-transparent text-slate-500 hover:text-slate-700">GitHubで探す</button>
        `;
        sidebar.insertBefore(tabContainer, this.pluginList);

        document.getElementById('tab-installed').addEventListener('click', () => this.switchTab('installed'));
        document.getElementById('tab-github').addEventListener('click', () => this.switchTab('github'));

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
                    this.renderPluginList();
                    alert('プラグインをインストールしました。');
                } catch (err) {
                    alert('プラグインのインストールに失敗しました: ' + err.message);
                }
                e.target.value = '';
            });
        }

        this.renderPluginList();
    }

    switchTab(tab) {
        this.activeTab = tab;
        const tabInst = document.getElementById('tab-installed');
        const tabGh = document.getElementById('tab-github');

        if (tab === 'installed') {
            tabInst.className = 'flex-1 py-2 text-xs font-bold border-b-2 border-indigo-500 text-indigo-600';
            tabGh.className = 'flex-1 py-2 text-xs font-bold border-b-2 border-transparent text-slate-500 hover:text-slate-700';
            this.renderPluginList();
        } else {
            tabGh.className = 'flex-1 py-2 text-xs font-bold border-b-2 border-indigo-500 text-indigo-600';
            tabInst.className = 'flex-1 py-2 text-xs font-bold border-b-2 border-transparent text-slate-500 hover:text-slate-700';
            this.renderGitHubList();
        }
    }

    open() {
        this.modal.classList.remove('hidden');
        this.modal.classList.add('flex');
        void this.modal.offsetWidth;
        this.modal.classList.add('show-modal');
        this.renderPluginList();
    }

    close() {
        this.modal.classList.remove('show-modal');
        setTimeout(() => {
            this.modal.classList.remove('flex');
            this.modal.classList.add('hidden');
        }, 300);
    }

    renderPluginList() {
        const registry = this.pluginManager.getRegistry();
        this.pluginList.innerHTML = '';
        
        registry.forEach(plugin => {
            const isEnabled = this.pluginManager.isPluginEnabled(plugin.id);
            const item = document.createElement('div');
            item.className = `p-3 rounded-lg cursor-pointer transition-colors ${isEnabled ? 'bg-indigo-50/50 dark:bg-indigo-900/20' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`;
            
            let trustBadge = '';
            if (plugin.author === 'EDBPlugin') {
                trustBadge = '<span class="ml-1 text-[9px] px-1 rounded bg-blue-500 text-white">公式</span>';
            }

            item.innerHTML = `
                <div class="flex justify-between items-start">
                    <div class="font-bold text-sm text-slate-900 dark:text-white flex items-center">${plugin.name}${trustBadge}</div>
                    ${isEnabled ? '<div class="w-2 h-2 rounded-full bg-indigo-500 mt-1.5"></div>' : ''}
                </div>
                <div class="text-[11px] text-slate-500 dark:text-slate-400 mt-1">開発者: ${plugin.author}</div>
                <div class="flex gap-1 mt-1">
                    ${plugin.affectsStyle ? '<span class="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">スタイル</span>' : ''}
                    ${plugin.affectsBlocks ? '<span class="text-[9px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">ブロック</span>' : ''}
                    ${plugin.isCustom ? '<span class="text-[9px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">自作</span>' : ''}
                </div>
            `;
            item.addEventListener('click', () => this.showDetail(plugin));
            this.pluginList.appendChild(item);
        });
    }

    async renderGitHubList() {
        this.pluginList.innerHTML = '<div class="p-4 text-center text-xs text-slate-500">GitHubから検索中...</div>';
        this.githubPlugins = await this.pluginManager.searchGitHubPlugins();
        this.pluginList.innerHTML = '';

        if (this.githubPlugins.length === 0) {
            this.pluginList.innerHTML = '<div class="p-4 text-center text-xs text-slate-500">プラグインが見つかりませんでした。</div>';
            return;
        }

        this.githubPlugins.forEach(plugin => {
            const item = document.createElement('div');
            item.className = `p-3 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors`;
            
            let trustBadge = '';
            if (plugin.trustLevel === 'official') {
                trustBadge = '<span class="ml-1 text-[9px] px-1 rounded bg-blue-500 text-white">公式</span>';
            } else if (plugin.trustLevel === 'certified') {
                trustBadge = '<span class="ml-1 text-[9px] px-1 rounded bg-green-500 text-white">公認</span>';
            }

            item.innerHTML = `
                <div class="flex justify-between items-start">
                    <div class="font-bold text-sm text-slate-900 dark:text-white flex items-center">${plugin.name}${trustBadge}</div>
                    <div class="text-[10px] text-slate-400 flex items-center gap-0.5"><i data-lucide="star" class="w-2.5 h-2.5"></i> ${plugin.stars}</div>
                </div>
                <div class="text-[11px] text-slate-500 dark:text-slate-400 mt-1">開発者: ${plugin.author}</div>
                <div class="text-[10px] text-slate-400 mt-1 truncate">${plugin.description || ''}</div>
            `;
            item.addEventListener('click', () => this.showGitHubDetail(plugin));
            this.pluginList.appendChild(item);
        });
        lucide.createIcons();
    }

    async showGitHubDetail(plugin) {
        this.pluginDetailEmpty.classList.add('hidden');
        this.pluginDetailContent.classList.remove('hidden');
        this.pluginDetailContent.innerHTML = '<div class="p-8 text-center text-slate-500">読み込み中...</div>';

        const readme = await this.pluginManager.getREADME(plugin.fullName, plugin.defaultBranch);
        
        let trustBadge = '';
        if (plugin.trustLevel === 'official') {
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
                            <i data-lucide="github" class="w-3.5 h-3.5"></i> GitHubリポジトリで見る
                        </a>
                    </div>
                </div>
                <div>
                    <button class="px-6 py-2 rounded-lg font-bold bg-slate-200 text-slate-600 cursor-not-allowed" disabled>
                        GitHubから直接インストール（開発中）
                    </button>
                    <p class="text-[10px] text-slate-400 mt-2 text-center">ZIPをダウンロードしてインストールしてください</p>
                </div>
            </div>
            
            <div class="prose dark:prose-invert max-w-none border-t border-slate-100 dark:border-slate-800 pt-6">
                <div class="bg-slate-50 dark:bg-slate-950/50 rounded-xl p-6 border border-slate-100 dark:border-slate-800 font-sans text-sm leading-relaxed whitespace-pre-wrap">
                    ${this.escapeHtml(readme)}
                </div>
            </div>
        `;
        lucide.createIcons();
    }

    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    showDetail(plugin) {
        this.pluginDetailEmpty.classList.add('hidden');
        this.pluginDetailContent.classList.remove('hidden');
        
        const isEnabled = this.pluginManager.isPluginEnabled(plugin.id);
        
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
                <div class="flex gap-2">
                    <button id="togglePluginBtn" class="px-6 py-2 rounded-lg font-bold transition-all ${isEnabled ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}">
                        ${isEnabled ? '無効化' : 'インストール'}
                    </button>
                </div>
            </div>
            
            <div class="prose dark:prose-invert max-w-none border-t border-slate-100 dark:border-slate-800 pt-6">
                <p class="text-slate-600 dark:text-slate-300 leading-relaxed">${plugin.description}</p>
                <div id="readme-container" class="mt-8 bg-slate-50 dark:bg-slate-950/50 rounded-xl p-6 border border-slate-100 dark:border-slate-800">
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
            this.renderPluginList();
        });
    }

    async loadLocalREADME(plugin) {
        const container = document.getElementById('readme-container');
        if (!container) return;

        // リポジトリURLから README を取得試行
        if (plugin.repo && plugin.repo.includes('github.com')) {
            const fullName = plugin.repo.split('github.com/')[1].replace(/\/$/, '');
            const readme = await this.pluginManager.getREADME(fullName);
            container.innerHTML = `<div class="font-sans text-sm leading-relaxed whitespace-pre-wrap">${this.escapeHtml(readme)}</div>`;
        } else {
            container.innerHTML = `<p class="text-sm text-slate-500">${plugin.description}</p>`;
        }
    }
}

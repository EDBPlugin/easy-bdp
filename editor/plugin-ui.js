/**
 * EDBP Plugin UI
 * Handles the Obsidian-like plugin management interface.
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
        
        this.init();
    }

    init() {
        this.btn.addEventListener('click', () => this.open());
        this.closeBtn.addEventListener('click', () => this.close());
        
        // Close on backdrop click
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.close();
        });

        this.renderPluginList();
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
            item.innerHTML = `
                <div class="flex justify-between items-start">
                    <div class="font-bold text-sm text-slate-900 dark:text-white">${plugin.name}</div>
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

    showDetail(plugin) {
        this.pluginDetailEmpty.classList.add('hidden');
        this.pluginDetailContent.classList.remove('hidden');
        
        const isEnabled = this.pluginManager.isPluginEnabled(plugin.id);
        
        this.pluginDetailContent.innerHTML = `
            <div class="flex justify-between items-start mb-6">
                <div>
                    <h1 class="text-3xl font-bold text-slate-900 dark:text-white">${plugin.name}</h1>
                    <div class="flex items-center gap-4 mt-2 text-sm text-slate-500 dark:text-slate-400">
                        <span class="flex items-center gap-1"><i data-lucide="user" class="w-3.5 h-3.5"></i> 開発者: ${plugin.author}</span>
                        <span class="flex items-center gap-1"><i data-lucide="tag" class="w-3.5 h-3.5"></i> バージョン: ${plugin.version}</span>
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
                    <button class="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800">
                        <i data-lucide="share-2" class="w-5 h-5"></i>
                    </button>
                </div>
            </div>
            
            <div class="prose dark:prose-invert max-w-none border-t border-slate-100 dark:border-slate-800 pt-6">
                <p class="text-slate-600 dark:text-slate-300 leading-relaxed">${plugin.description}</p>
                
                <h3 class="text-lg font-bold mt-8 mb-4 text-slate-900 dark:text-white">README中身</h3>
                <div class="bg-slate-50 dark:bg-slate-950/50 rounded-xl p-6 border border-slate-100 dark:border-slate-800">
                    <h1 class="text-2xl font-bold mb-4">${plugin.name}</h1>
                    <p>このプラグインはEDBPに新しい機能を追加します。</p>
                    <ul class="list-disc pl-5 mt-4 space-y-2">
                        <li>カスタムブロックの追加</li>
                        <li>UIのカスタマイズ</li>
                        <li>外部サービスとの連携</li>
                    </ul>
                </div>
            </div>
        `;
        
        lucide.createIcons();
        
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
}

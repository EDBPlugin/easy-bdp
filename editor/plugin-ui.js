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

        this.bulkInstallModal = document.getElementById('pluginBulkInstallModal');
        this.bulkInstallList = document.getElementById('pluginBulkInstallList');
        this.bulkInstallConfirmBtn = document.getElementById('pluginBulkInstallConfirmBtn');
        this.bulkInstallCancelBtn = document.getElementById('pluginBulkInstallCancelBtn');
        this.bulkInstallCloseBtn = document.getElementById('pluginBulkInstallClose');

        this.init();
    }

    init() {
        this.btn.addEventListener('click', () => this.open());
        this.closeBtn.addEventListener('click', () => this.close());

        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.close();
        });

        // 検索・フィルターUIの取得
        const searchInput = document.querySelector('input[placeholder="プラグインを検索..."], input[placeholder*="tag:"]');
        const filterToggle = this.modal?.querySelector('input[type="checkbox"]'); // インストール済みのみ表示

        if (searchInput) {
            searchInput.placeholder = "検索 (例: tag:utility author:name badge:不可)";
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

        // システムリセットボタン（履歴を消すボタン等から呼び出し可能にする）
        const resetBtn = document.getElementById('resetSystemBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                if (confirm('すべてのプラグインと設定を完全に削除し、初期状態に戻しますか？\nこの操作は取り消せません。')) {
                    this.pluginManager.resetSystem();
                    this.renderMarketplace();
                    alert('システムが完全にリセットされました。');
                }
            });
        }

        this.bulkInstallCloseBtn?.addEventListener('click', () => this.closeBulkInstall());
        this.bulkInstallCancelBtn?.addEventListener('click', () => this.closeBulkInstall());
        this.bulkInstallModal?.addEventListener('click', (e) => {
            if (e.target === this.bulkInstallModal) this.closeBulkInstall();
        });

        // URLパラメータによるプラグインインストールのチェック
        this.handleUrlParams();

        // 一括共有ボタン
        const bulkShareBtn = document.getElementById('pluginBulkShareBtn');
        if (bulkShareBtn) {
            bulkShareBtn.addEventListener('click', () => {
                const enabledPlugins = this.pluginManager.getRegistry().filter(p =>
                    this.pluginManager.isPluginEnabled(p.id) && p.installedFrom === 1 && p.repo
                );

                if (enabledPlugins.length === 0) {
                    alert('共有可能な有効なプラグインがありません。\n(GitHubからインストールされたものが対象です)');
                    return;
                }

                const repoNames = enabledPlugins.map(p => {
                    const info = this.pluginManager.parseGitHubUrl(p.repo);
                    if (!info) return null;
                    let name = info.fullName;
                    if (p.installRef && p.installRef !== 'main') {
                        name += `@${p.installRef}`;
                    }
                    return name;
                }).filter(name => name !== null);

                if (repoNames.length === 0) {
                    alert('共有可能なプラグインが見つかりませんでした。');
                    return;
                }

                const baseUrl = window.location.origin + window.location.pathname;
                const shareUrl = `${baseUrl}?install-plugins=${encodeURIComponent(repoNames.join(','))}`;

                navigator.clipboard.writeText(shareUrl).then(() => {
                    alert('有効なプラグインを一括インストールするためのURLをコピーしました！');
                }).catch(err => {
                    alert('URLのコピーに失敗しました。\n' + shareUrl);
                });
            });
        }
    }

    async handleUrlParams() {
        const params = new URLSearchParams(window.location.search);

        // パラメータの取得（単数・複数どちらも一括インストールのUIで処理する）
        const single = params.get('install-plugin');
        const multiple = params.get('install-plugins');

        if (single) {
            this.clearUrlParam('install-plugin');
            await this.handleBulkInstall(single);
        } else if (multiple) {
            this.clearUrlParam('install-plugins');
            await this.handleBulkInstall(multiple);
        }
    }

    clearUrlParam(key) {
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete(key);
        window.history.replaceState({}, '', newUrl);
    }

    async handleBulkInstall(installRepos) {
        const repos = installRepos.split(',').map(r => r.trim()).filter(r => r.length > 0);
        if (repos.length === 0) return;

        this.bulkInstallList.innerHTML = '<div class="p-8 text-center text-slate-500">プラグイン情報を取得中...</div>';
        this.bulkInstallModal.classList.remove('hidden');
        this.bulkInstallModal.classList.add('flex');
        void this.bulkInstallModal.offsetWidth;
        this.bulkInstallModal.classList.add('show-modal');

        const repoInfos = await Promise.all(repos.map(async (entry) => {
            // URLか fullName@ref かを判定してパース
            let info = this.pluginManager.parseGitHubUrl(entry);
            let repoUrl = entry;

            if (!info && entry.includes('/')) {
                // 旧形式 fullName@ref
                const [fullName, ref] = entry.split('@');
                repoUrl = `https://github.com/${fullName}${ref ? `/tree/${ref}` : ''}`;
                info = this.pluginManager.parseGitHubUrl(repoUrl);
            }

            if (!info) return null;

            // 既にインストールされているかチェック
            const installed = this.pluginManager.getRegistry();
            const cleanTarget = repoUrl.split('?')[0].replace(/\/$/, '').replace(/\.git$/, '');
            const existing = installed.find(p => {
                const pClean = p.repo?.split('?')[0].replace(/\/$/, '').replace(/\.git$/, '');
                return pClean === cleanTarget;
            });

            return {
                fullName: info.fullName,
                repoUrl: repoUrl,
                ref: info.branch || 'main',
                author: info.owner,
                name: info.repo,
                existing: !!existing
            };
        }));

        const validInfos = repoInfos.filter(i => i !== null);
        this.renderBulkInstallList(validInfos);

        this.bulkInstallConfirmBtn.onclick = async () => {
            const selectedEntries = Array.from(this.bulkInstallList.querySelectorAll('input[type="checkbox"]:checked'))
                .map(cb => cb.value);

            if (selectedEntries.length === 0) {
                alert('インストールするプラグインを選択してください。');
                return;
            }

            this.bulkInstallConfirmBtn.disabled = true;
            const originalText = this.bulkInstallConfirmBtn.innerHTML;
            this.bulkInstallConfirmBtn.innerHTML = '<i class="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></i> <span>インストール中...</span>';

            let successCount = 0;
            let failCount = 0;

            for (const entryUrl of selectedEntries) {
                const info = this.pluginManager.parseGitHubUrl(entryUrl);
                if (!info) {
                    failCount++;
                    continue;
                }
                try {
                    await this.pluginManager.installFromGitHub(info.fullName, entryUrl);
                    successCount++;
                } catch (e) {
                    console.error(`Failed to install ${info.fullName}:`, e);
                    failCount++;
                }
            }

            alert(`${successCount}個のプラグインをインストールしました。${failCount > 0 ? `\n${failCount}個のインストールに失敗しました。` : ''}`);
            this.bulkInstallConfirmBtn.disabled = false;
            this.bulkInstallConfirmBtn.innerHTML = originalText;
            this.closeBulkInstall();
            this.renderMarketplace();
        };
    }

    renderBulkInstallList(infos) {
        this.bulkInstallList.innerHTML = '';
        infos.forEach(info => {
            const container = document.createElement('div');
            container.className = 'flex flex-col gap-2';

            const item = document.createElement('div');
            item.className = `flex items-center gap-3 p-4 rounded-xl border transition-all ${info.existing ? 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 opacity-60' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-500 cursor-pointer'}`;

            const value = info.repoUrl;
            const versionLabel = info.ref !== 'main' ? `<span class="ml-2 px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 font-mono text-[10px]">${info.ref}</span>` : '';

            item.innerHTML = `
                <input type="checkbox" value="${value}" ${info.existing ? 'disabled' : 'checked'} class="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 shrink-0">
                <div class="flex-grow info-area">
                    <div class="font-bold text-lg text-slate-900 dark:text-white flex items-center">${info.name}${versionLabel}</div>
                    <div class="text-sm text-slate-500 dark:text-slate-400">開発者: ${info.author} ${info.existing ? '(インストール済み)' : ''}</div>
                </div>
                <i data-lucide="chevron-down" class="w-4 h-4 text-slate-300 detail-icon"></i>
            `;

            const detailView = document.createElement('div');
            detailView.className = 'hidden p-4 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 text-sm overflow-hidden';
            detailView.innerHTML = '<div class="animate-pulse flex flex-col gap-2"><div class="h-3 bg-slate-200 dark:bg-slate-800 rounded w-full"></div><div class="h-3 bg-slate-200 dark:bg-slate-800 rounded w-5/6"></div></div>';

            const checkbox = item.querySelector('input[type="checkbox"]');
            const infoArea = item.querySelector('.info-area');
            const detailIcon = item.querySelector('.detail-icon');

            const toggleDetail = async (e) => {
                // チェックボックス自体のクリックなら無視（デフォルト挙動に任せる）
                if (e.target === checkbox) return;

                const isHidden = detailView.classList.contains('hidden');

                // 他のプラグインの詳細を閉じる
                this.bulkInstallList.querySelectorAll('.detail-view').forEach(el => {
                    if (el !== detailView) el.classList.add('hidden');
                });
                this.bulkInstallList.querySelectorAll('.detail-icon').forEach(el => {
                    if (el !== detailIcon) el.style.transform = 'rotate(0deg)';
                });

                if (isHidden) {
                    detailView.classList.remove('hidden');
                    detailView.classList.add('detail-view');
                    detailIcon.style.transform = 'rotate(180deg)';
                    detailIcon.style.transition = 'transform 0.2s';

                    // READMEの読み込み
                    try {
                        const readme = await this.pluginManager.getREADME(info.repoUrl);
                        detailView.innerHTML = `<div class="prose dark:prose-invert max-w-none 
                            prose-h1:text-2xl prose-h1:font-bold prose-h1:mb-4 prose-h1:text-slate-900 dark:prose-h1:text-white
                            prose-h2:text-xl prose-h2:font-bold prose-h2:mt-6 prose-h2:mb-3 prose-h2:text-slate-800 dark:prose-h2:text-slate-100
                            prose-h3:text-lg prose-h3:font-bold prose-h3:mt-4 prose-h3:mb-2
                            prose-p:text-slate-600 dark:prose-p:text-slate-300 prose-p:leading-relaxed">${this.renderMarkdown(readme)}</div>`;
                    } catch (err) {
                        detailView.innerHTML = `<p class="text-xs text-red-500">READMEの取得に失敗しました: ${err.message}</p>`;
                    }
                } else {
                    detailView.classList.add('hidden');
                    detailIcon.style.transform = 'rotate(0deg)';
                }
            };

            item.addEventListener('click', toggleDetail);

            container.appendChild(item);
            container.appendChild(detailView);
            this.bulkInstallList.appendChild(container);
        });
        lucide.createIcons();
    }

    async open() {
        if (this.shouldShowMobileWarning()) {
            const canOpen = await this.showMobileWarning();
            if (!canOpen) return;
        }

        // Blocklyのポップアップ（ツールチップやメニュー）を閉じる
        if (this.pluginManager.workspace && typeof Blockly !== 'undefined') {
            Blockly.hideChaff();
        }

        // 既存の終了タイマーがあればクリア
        if (this.closeTimer) {
            clearTimeout(this.closeTimer);
            this.closeTimer = null;
        }

        this.modal.classList.remove('hidden');
        this.modal.classList.add('flex');
        this.modal.setAttribute('aria-hidden', 'false');
        void this.modal.offsetWidth;
        this.modal.classList.add('show-modal');
        this.renderMarketplace();
    }

    close() {
        // 既存の終了タイマーがあればクリア
        if (this.closeTimer) {
            clearTimeout(this.closeTimer);
            this.closeTimer = null;
        }

        // モバイル表示用の詳細画面状態もリセット
        this.modal.classList.remove('detail-open');
        this.modal.classList.remove('show-modal');

        // モバイル警告モーダルが開いていればそれも閉じる
        if (this.isMobileWarningOpen()) {
            this.resolveMobileWarning(false);
        }

        this.closeTimer = setTimeout(() => {
            if (!this.modal) return;
            this.modal.classList.remove('flex');
            this.modal.classList.add('hidden');
            this.modal.setAttribute('aria-hidden', 'true');
            this.closeTimer = null;
        }, 300);
    }

    closeBulkInstall() {
        this.bulkInstallModal.classList.remove('show-modal');
        setTimeout(() => {
            this.bulkInstallModal.classList.add('hidden');
            this.bulkInstallModal.classList.remove('flex');
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

        // クエリの解析
        const parseQuery = (q) => {
            const filter = { tags: [], authors: [], badges: [], text: [] };
            if (!q) return filter;

            const parts = q.split(/\s+/);
            parts.forEach(part => {
                if (part.startsWith('tag:')) {
                    filter.tags.push(part.substring(4).toLowerCase());
                } else if (part.startsWith('author:')) {
                    filter.authors.push(part.substring(7).toLowerCase());
                } else if (part.startsWith('badge:')) {
                    const val = part.split(':')[1].toLowerCase();
                    const badgeMap = {
                        'official': 'official', '公式': 'official',
                        'certified': 'certified', '公認': 'certified',
                        'danger': 'danger', '危険': 'danger',
                        'invalid': 'invalid', '使用不可': 'invalid', '不可': 'invalid'
                    };
                    filter.badges.push(badgeMap[val] || val);
                } else {
                    filter.text.push(part.toLowerCase());
                }
            });
            return filter;
        };

        const filter = parseQuery(this.searchQuery);

        // 1. インストール済みプラグインの表示 (検索クエリがある場合はフィルタリング)
        const filteredInstalled = installed.filter(p => {
            // テキスト検索 (名前または作者)
            const matchesText = filter.text.length === 0 || filter.text.every(txt =>
                p.name.toLowerCase().includes(txt) || p.author.toLowerCase().includes(txt)
            );

            // 作者検索
            const matchesAuthor = filter.authors.length === 0 || filter.authors.some(a =>
                p.author.toLowerCase().includes(a)
            );

            // タグ検索
            const matchesTag = filter.tags.length === 0 || (p.tags && filter.tags.every(t =>
                p.tags.some(pt => pt.toLowerCase().includes(t))
            ));

            // バッジ検索
            const level = p.trustLevel?.level ?? p.trustLevel;
            const matchesBadge = filter.badges.length === 0 || filter.badges.includes(level);

            return matchesText && matchesAuthor && matchesTag && matchesBadge;
        });

        if (filteredInstalled.length > 0) {
            const header = document.createElement('div');
            header.className = 'px-3 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider';
            header.textContent = 'インストール済み';
            this.pluginList.appendChild(header);

            filteredInstalled.forEach(plugin => {
                this.addPluginItem(plugin, true);
            });
        }

        // 2. GitHub Marketplace (検索またはトピック表示)
        if (!this.isOnlyInstalled) {
            // テストモード: "@test" で指定のリポジトリを表示
            if (this.searchQuery === '@test') {
                const header = document.createElement('div');
                header.className = 'px-3 py-2 text-xs font-bold text-amber-500 uppercase tracking-wider mt-4';
                header.textContent = 'UIテストモード';
                this.pluginList.appendChild(header);

                this.addPluginItem({
                    id: 'malicious-test-plugin',
                    name: 'Malicious-Test-Plugin',
                    author: 'appipinopi',
                    fullName: 'appipinopi/Malicious-Test-Plugin',
                    repo: 'https://github.com/appipinopi/Malicious-Test-Plugin',
                    description: 'GitHub連携テスト用の危険なプラグイン。',
                    trustLevel: {
                        level: 'danger',
                        reason: 'トークン窃取の可能性があるため。'
                    },
                    stars: 0,
                    defaultBranch: 'main'
                }, false);

                lucide.createIcons();
                return;
            }

            const header = document.createElement('div');
            header.className = 'px-3 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider mt-4 flex justify-between items-center';

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
                results.forEach(async plugin => {
                    // すでにインストール済みのものは重複表示しない
                    if (installed.some(p => p.repo === plugin.repo)) return;

                    const item = this.addPluginItem(plugin, false);

                    // 非同期でマニフェストを確認して使用不可バッジを付与
                    try {
                        const manifest = await this.pluginManager.getManifestFromGitHub(plugin.fullName, plugin.defaultBranch);
                        const validation = manifest ? this.pluginManager.validateManifest(manifest) : { valid: false, missing: ['manifest.jsonが見つかりません'] };

                        if (!validation.valid) {
                            const nameEl = item.querySelector('.font-bold');
                            if (nameEl && !nameEl.innerHTML.includes('不可')) {
                                const reason = validation.missing ? `必須項目が不足しています: ${validation.missing.join(', ')}` : '必須項目が不足しています。';
                                const badge = document.createElement('span');
                                badge.className = 'ml-1 text-[10px] px-1.5 py-0.5 rounded bg-slate-400 text-white leading-none cursor-help';
                                badge.title = reason;
                                badge.textContent = '不可';
                                nameEl.appendChild(badge);
                            }
                        }
                    } catch (e) {
                        // レート制限などのエラーは無視
                    }
                });
            }
        }
        lucide.createIcons();
    }

    addPluginItem(plugin, isInstalled) {
        const isEnabled = isInstalled && this.pluginManager.isPluginEnabled(plugin.id);
        const item = document.createElement('div');
        item.className = `p-3 rounded-lg cursor-pointer transition-colors ${isEnabled ? 'bg-indigo-50/50 dark:bg-indigo-900/20' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`;

        const level = plugin.trustLevel?.level ?? plugin.trustLevel;

        const badges = [];
        const isOfficial = plugin.author === 'EDBPlugin' || level === 'official';
        if (isOfficial) badges.push('<span class="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-blue-500 text-white leading-none">公式</span>');
        if (level === 'certified') badges.push('<span class="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-green-500 text-white leading-none">公認</span>');
        if (level === 'danger') {
            const reason = plugin.trustLevel?.reason ?? '危険性が報告されています。';
            badges.push(`<span class="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-red-500 text-white leading-none cursor-help" title="危険の理由: ${reason}">危険</span>`);
        }

        // 不可バッジ (独立判定)
        const isInvalid = level === 'invalid' || plugin.trustLevel?.invalid;
        const validation = isInstalled ? this.pluginManager.validateManifest(plugin) : { valid: !isInvalid };
        if (!validation.valid || isInvalid) {
            const reason = validation.missing ? `必須項目が不足しています: ${validation.missing.join(', ')}` : (plugin.trustLevel?.invalidReason || plugin.trustLevel?.reason || '必須項目が不足しています。');
            badges.push(`<span class="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-slate-400 text-white leading-none cursor-help" title="${reason}">不可</span>`);
        }
        const trustBadge = badges.join('');

        // アイコンの処理
        let iconHtml = '<div class="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-lg shrink-0 overflow-hidden">';
        if (plugin.icon) {
            if (plugin.icon.match(/^http|data:image/)) {
                iconHtml += `<img src="${plugin.icon}" class="w-full h-full object-cover">`;
            } else {
                iconHtml += `<span>${plugin.icon}</span>`; // Emoji or character icon
            }
        } else {
            iconHtml += '<i data-lucide="puzzle" class="w-4 h-4 text-slate-400"></i>';
        }
        iconHtml += '</div>';

        item.innerHTML = `
            <div class="flex gap-3 items-center">
                ${iconHtml}
                <div class="flex-grow min-w-0">
                    <div class="flex justify-between items-start">
                        <div class="font-bold text-sm text-slate-900 dark:text-white flex flex-wrap items-center gap-y-1">
                            <span class="break-words">${plugin.name}</span>${trustBadge}
                        </div>
                        ${isEnabled ? '<div class="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 ml-1 shrink-0"></div>' : ''}
                        ${!isInstalled ? '<i data-lucide="download-cloud" class="w-3.5 h-3.5 text-slate-300 ml-1 shrink-0"></i>' : ''}
                    </div>
                    <div class="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">開発者: ${plugin.author}</div>
                </div>
            </div>
        `;
        item.addEventListener('click', () => isInstalled ? this.showDetail(plugin) : this.showGitHubDetail(plugin));
        this.pluginList.appendChild(item);
        return item;
    }

    async showGitHubDetail(plugin) {
        this.pluginDetailEmpty.classList.add('hidden');
        this.pluginDetailContent.classList.remove('hidden');
        this.pluginDetailContent.innerHTML = '<div class="p-8 text-center text-slate-500">GitHubから情報を取得中...</div>';

        const isMock = plugin.id && plugin.id.startsWith('test-');
        let readme = 'READMEが見つかりませんでした。';
        let releases = [];

        if (!isMock) {
            const results = await Promise.all([
                this.pluginManager.getREADME(plugin.fullName, plugin.defaultBranch),
                this.pluginManager.getReleases(plugin.fullName)
            ]);
            readme = results[0];
            releases = results[1];
        } else {
            readme = plugin.description || 'テスト用プラグインのデモページです。';
        }

        const level = plugin.trustLevel?.level ?? plugin.trustLevel;
        const badges = [];
        if (plugin.author === 'EDBPlugin' || level === 'official') {
            badges.push('<span class="text-[10px] px-2 py-1 rounded bg-blue-500 text-white font-bold leading-none shrink-0">公式プラグイン</span>');
        }
        if (level === 'certified') {
            badges.push('<span class="text-[10px] px-2 py-1 rounded bg-green-500 text-white font-bold leading-none shrink-0">公認プラグイン</span>');
        }
        if (level === 'danger') {
            badges.push('<span class="text-[10px] px-2 py-1 rounded bg-red-500 text-white font-bold leading-none shrink-0">危険なプラグイン</span>');
        }

        const dangerReason = level === 'danger' ? (plugin.trustLevel?.reason || '悪意のあるコードが含まれているか、重大なセキュリティリスクがある可能性があるため、インストールは推奨されません。') : '';

        const dangerWarning = level === 'danger' ? `
            <div class="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-start gap-3">
                <i data-lucide="alert-triangle" class="w-5 h-5 text-red-500 shrink-0 mt-0.5"></i>
                <div class="text-sm">
                    <div class="font-bold text-red-600 dark:text-red-400">警告: このプラグインはブラックリストに登録されています</div>
                    <div class="text-red-500/80 dark:text-red-400/80 mt-1">理由: ${dangerReason}</div>
                </div>
            </div>
        ` : '';

        // マニフェスト取得とバリデーション
        let validation = { valid: true };
        if (!isMock) {
            const manifest = await this.pluginManager.getManifestFromGitHub(plugin.fullName, plugin.defaultBranch);
            if (manifest) {
                validation = this.pluginManager.validateManifest(manifest);
            } else {
                validation = { valid: false, missing: ['manifest.jsonが見つかりません'] };
            }
        }

        if (!validation.valid) {
            badges.push('<span class="text-[10px] px-2 py-1 rounded bg-slate-400 text-white font-bold leading-none shrink-0">使用不可のプラグイン</span>');
        }
        const trustBadge = badges.join(' ');

        const invalidWarning = !validation.valid ? `
            <div class="mb-6 p-4 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-start gap-3">
                <i data-lucide="slash" class="w-5 h-5 text-slate-500 shrink-0 mt-0.5"></i>
                <div class="text-sm">
                    <div class="font-bold text-slate-700 dark:text-slate-200">このプラグインは使用できません</div>
                    <div class="text-slate-500 dark:text-slate-400 mt-1">理由: 必須項目（${validation.missing.join(', ')}）がマニフェストに含まれていません。</div>
                </div>
            </div>
        ` : '';

        this.pluginDetailContent.innerHTML = `
            ${dangerWarning}
            ${invalidWarning}
            <div class="flex flex-col mb-6">
                <div class="flex justify-between items-start mb-4">
                    <div>
                        <h1 class="text-3xl font-bold text-slate-900 dark:text-white flex flex-wrap items-center gap-3">${plugin.name} ${trustBadge}</h1>
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
                    <button id="installFromGhBtn" ${!validation.valid ? 'disabled' : ''} class="w-full py-3 rounded-lg font-bold ${!validation.valid ? 'bg-slate-300 dark:bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20'} active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                        <i data-lucide="${!validation.valid ? 'lock' : 'download'}" class="w-5 h-5"></i> <span>${!validation.valid ? 'インストール不可' : 'インストールを実行'}</span>
                    </button>
                </div>
            </div>
            
            <div class="prose dark:prose-invert max-w-none border-t border-slate-100 dark:border-slate-800 pt-6">
                <div class="bg-slate-50 dark:bg-slate-950/50 rounded-xl p-6 border border-slate-100 dark:border-slate-800 font-sans text-sm leading-relaxed">
                    <div class="readme-content prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl prose-h1:font-bold prose-h2:font-bold">${this.renderMarkdown(readme)}</div>
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
                if (isMock) {
                    // モックプラグインのインストール擬似処理
                    const mockManifest = {
                        ...plugin,
                        installedFrom: 0, // 0: local (擬似的に)
                        updateDate: new Date().toISOString().split('T')[0],
                        trustLevel: plugin.trustLevel
                    };
                    delete mockManifest.stars;

                    this.pluginManager.installedPlugins[plugin.id] = mockManifest;
                    this.pluginManager.saveInstalledPlugins();

                    this.renderMarketplace();
                    this.showDetail(mockManifest);
                    alert('テスト用プラグインを擬似インストールしました！');
                    return;
                }

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

        const level = plugin.trustLevel?.level ?? plugin.trustLevel;
        const badges = [];
        if (plugin.author === 'EDBPlugin' || level === 'official') {
            badges.push('<span class="text-[10px] px-2 py-1 rounded bg-blue-500 text-white font-bold leading-none shrink-0">公式プラグイン</span>');
        }
        if (level === 'certified') {
            badges.push('<span class="text-[10px] px-2 py-1 rounded bg-green-500 text-white font-bold leading-none shrink-0">公認プラグイン</span>');
        }
        if (level === 'danger') {
            badges.push('<span class="text-[10px] px-2 py-1 rounded bg-red-500 text-white font-bold leading-none shrink-0">危険なプラグイン</span>');
        }

        // 使用不可バッジ (独立判定)
        const isInvalid = level === 'invalid' || plugin.trustLevel?.invalid;
        const validation = this.pluginManager.validateManifest(plugin);
        const invalidReason = !validation.valid ? `必須項目が不足しています: ${validation.missing.join(', ')}` : (plugin.trustLevel?.invalidReason || '');

        if (!validation.valid || isInvalid) {
            badges.push('<span class="text-[10px] px-2 py-1 rounded bg-slate-400 text-white font-bold leading-none shrink-0">使用不可のプラグイン</span>');
        }
        const trustBadge = badges.join(' ');


        const dangerReason = level === 'danger' ? (plugin.trustLevel?.reason || 'このプラグインの使用は推奨されません。速やかにアンインストールすることを検討してください。') : '';

        const dangerWarning = level === 'danger' ? `
            <div class="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-start gap-3">
                <i data-lucide="alert-triangle" class="w-5 h-5 text-red-500 shrink-0 mt-0.5"></i>
                <div class="text-sm">
                    <div class="font-bold text-red-600 dark:text-red-400">警告: このプラグインはブラックリストに登録されています</div>
                    <div class="text-red-500/80 dark:text-red-400/80 mt-1">理由: ${dangerReason}</div>
                </div>
            </div>
        ` : '';

        const invalidWarning = (!validation.valid || isInvalid) ? `
            <div class="mb-6 p-4 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-start gap-3">
                <i data-lucide="slash" class="w-5 h-5 text-slate-500 shrink-0 mt-0.5"></i>
                <div class="text-sm">
                    <div class="font-bold text-slate-700 dark:text-slate-200">このプラグインは使用できません</div>
                    <div class="text-slate-500 dark:text-slate-400 mt-1">理由: ${invalidReason}</div>
                </div>
            </div>
        ` : '';

        this.pluginDetailContent.innerHTML = `
            ${dangerWarning}
            ${invalidWarning}
            <div class="flex justify-between items-start mb-6">
                <div class="min-w-0 flex-grow">
                    <h1 class="text-3xl font-bold text-slate-900 dark:text-white flex flex-wrap items-center gap-3 break-words">${plugin.name} ${trustBadge}</h1>
                    <div class="flex flex-wrap items-center gap-4 mt-2 text-sm text-slate-500 dark:text-slate-400">
                        <span class="flex items-center gap-1"><i data-lucide="user" class="w-3.5 h-3.5"></i> 開発者: ${plugin.author}</span>
                        <span class="flex items-center gap-1"><i data-lucide="tag" class="w-3.5 h-3.5"></i> バージョン: ${plugin.version}</span>
                    </div>
                    <div class="mt-1 text-xs font-mono text-slate-400">UUID: ${plugin.uuid}</div>
                    <div class="mt-2 flex gap-2 items-center">
                        ${plugin.repo ? `
                        <a href="${plugin.repo}" target="_blank" class="text-xs text-indigo-500 hover:underline flex items-center gap-1">
                            <i data-lucide="github" class="w-3 h-3"></i> リポジトリ
                        </a>` : ''}
                        <span class="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">
                            Source: ${plugin.installedFrom === 1 ? 'GitHub' : 'Local ZIP'}
                        </span>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <button id="sharePluginBtn" class="p-2 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:text-slate-400 dark:hover:text-indigo-400 dark:hover:bg-indigo-900/20 transition-all" title="共有・エクスポート">
                        <i data-lucide="share-2" class="w-5 h-5"></i>
                    </button>
                    <button id="togglePluginBtn" ${(!validation.valid || isInvalid) ? 'disabled' : ''} class="flex items-center justify-center gap-2 px-6 py-2 rounded-lg font-bold ${(!validation.valid || isInvalid) ? 'bg-slate-200 text-slate-400 cursor-not-allowed dark:bg-slate-800 dark:text-slate-600' : isEnabled ? 'bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-200' : 'bg-indigo-600 text-white hover:bg-indigo-700'} transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                        <span class="btn-text">${(!validation.valid || isInvalid) ? '使用不可' : isEnabled ? '無効化' : '有効化'}</span>
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

        const toggleBtn = document.getElementById('togglePluginBtn');
        toggleBtn.addEventListener('click', async () => {
            if (toggleBtn.disabled) return;

            const btnText = toggleBtn.querySelector('.btn-text');
            const originalText = btnText.textContent;

            try {
                toggleBtn.disabled = true;
                btnText.textContent = '処理中...';

                // 現在の状態を再確認（クロージャ内のisEnabledは古い可能性があるため）
                const currentlyEnabled = this.pluginManager.isPluginEnabled(plugin.id);

                if (currentlyEnabled) {
                    await this.pluginManager.disablePlugin(plugin.id);
                } else {
                    await this.pluginManager.enablePlugin(plugin.id);
                }

                // リストの更新はバックグラウンドで（GitHub通信が含まれる可能性があるため待たない）
                this.renderMarketplace();

                // 詳細表示を即座に更新してレスポンスを良くする
                this.showDetail(plugin);
            } catch (error) {
                console.error('Plugin toggle failed:', error);
                alert('プラグインの切り替えに失敗しました: ' + error.message);
                btnText.textContent = originalText;
                toggleBtn.disabled = false;
            }
        });

        document.getElementById('sharePluginBtn').addEventListener('click', async () => {
            const isSharable = this.pluginManager.isPluginSharable(plugin.id);

            if (isSharable) {
                // インストール用URLを生成
                const installUrl = this.pluginManager.getInstallUrl(plugin.id);
                if (installUrl) {
                    try {
                        await navigator.clipboard.writeText(installUrl);
                        alert('このプラグインを共有するためのURLをコピーしました！\nこのリンクを開くと、直接インストール画面が表示されます。');
                    } catch (e) {
                        alert('URLのコピーに失敗しました: ' + installUrl);
                    }
                } else if (plugin.repo) {
                    // フォールバック: リポジトリURL
                    try {
                        await navigator.clipboard.writeText(plugin.repo);
                        alert('リポジトリのURLをコピーしました！');
                    } catch (e) {
                        alert('URLのコピーに失敗しました: ' + plugin.repo);
                    }
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
            // manifestに記載されているURLをそのまま渡してREADMEを解決させる
            const readme = await this.pluginManager.getREADME(plugin.repo);
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

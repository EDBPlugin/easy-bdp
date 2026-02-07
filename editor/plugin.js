/**
 * EDBP Plugin System
 * Obsidian-like plugin management and vanilla plugin support.
 */

export class PluginManager {
    constructor(workspace) {
        this.workspace = workspace;
        this.plugins = new Map();
        this.enabledPlugins = new Set(JSON.parse(localStorage.getItem('edbb_enabled_plugins') || '[]'));
        
        // プラグインレジストリ
        // 実際には外部から取得する可能性がありますが、現在はハードコード
        this.pluginRegistry = [
            {
                id: 'vanilla-plugin',
                name: 'Vanilla Plugin',
                author: 'EDBP Team',
                version: '1.0.0',
                description: 'EDBPの基本機能を拡張するバニラプラグインです。',
                repo: 'https://github.com/EDBPlugin/easy-bdp',
                updateDate: '2026-02-07',
                affectsStyle: false,
                affectsBlocks: true,
                isCustom: false
            },
            {
                id: 'style-plugin-example',
                name: 'Theme Extension',
                author: 'EDBP Team',
                version: '1.0.0',
                description: 'エディタのスタイルをカスタマイズするプラグインです。',
                repo: 'https://github.com/EDBPlugin/easy-bdp',
                updateDate: '2026-02-07',
                affectsStyle: true,
                affectsBlocks: false,
                isCustom: false
            },
            {
                id: 'custom-block-plugin',
                name: 'Custom Blocks',
                author: 'User',
                version: '1.0.0',
                description: '自作のブロックを追加するプラグインです。',
                repo: '',
                updateDate: '2026-02-07',
                affectsStyle: false,
                affectsBlocks: true,
                isCustom: true
            }
        ];
    }

    async init() {
        console.log('PluginManager initializing...');
        for (const pluginId of this.enabledPlugins) {
            await this.enablePlugin(pluginId);
        }
    }

    async enablePlugin(id) {
        if (this.plugins.has(id)) return;
        
        const pluginMeta = this.pluginRegistry.find(p => p.id === id);
        if (!pluginMeta) return;

        // プラグインの実装（現在はデモ用にハードコード）
        if (id === 'vanilla-plugin') {
            const plugin = new VanillaPlugin(this.workspace);
            await plugin.onload();
            this.plugins.set(id, plugin);
        } else if (id === 'style-plugin-example') {
            // スタイル変更の例
            document.body.classList.add('custom-theme-active');
            this.plugins.set(id, { onunload: () => document.body.classList.remove('custom-theme-active') });
        } else if (id === 'custom-block-plugin') {
            // 自作ブロックの例
            const plugin = new CustomBlockPlugin(this.workspace);
            await plugin.onload();
            this.plugins.set(id, plugin);
        }
        
        this.enabledPlugins.add(id);
        this.saveState();
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

    getRegistry() {
        return this.pluginRegistry;
    }

    isPluginEnabled(id) {
        return this.enabledPlugins.has(id);
    }

    // 共有時に必要なプラグイン情報を取得
    getPluginsForShare() {
        const activePlugins = [];
        for (const id of this.enabledPlugins) {
            const meta = this.pluginRegistry.find(p => p.id === id);
            if (meta) {
                // スタイルに干渉するプラグインは除外
                if (meta.affectsStyle) continue;
                
                // ブロックに干渉するプラグインのうち、自作以外を許可
                if (meta.affectsBlocks && !meta.isCustom) {
                    activePlugins.push(id);
                }
            }
        }
        return activePlugins;
    }

    // 自作プラグイン（ブロック干渉）が使用されているか確認
    hasCustomBlockPlugin() {
        for (const id of this.enabledPlugins) {
            const meta = this.pluginRegistry.find(p => p.id === id);
            if (meta && meta.affectsBlocks && meta.isCustom) {
                return true;
            }
        }
        return false;
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
            init: function() {
                this.appendDummyInput()
                    .appendField("🍦 バニラプラグイン・テスト");
                this.setPreviousStatement(true, null);
                this.setNextStatement(true, null);
                this.setColour(200);
                this.setTooltip("バニラプラグインが正常に動作しているか確認するためのブロックです。");
            }
        };

        Blockly.Python['vanilla_plugin_test'] = function(block) {
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

class CustomBlockPlugin {
    constructor(workspace) {
        this.workspace = workspace;
    }

    async onload() {
        console.log('Custom Block Plugin loaded');
        this.registerBlocks();
    }

    registerBlocks() {
        if (typeof Blockly === 'undefined') return;

        Blockly.Blocks['custom_plugin_block'] = {
            init: function() {
                this.appendDummyInput()
                    .appendField("🛠️ 自作ブロック");
                this.setPreviousStatement(true, null);
                this.setNextStatement(true, null);
                this.setColour(100);
            }
        };

        Blockly.Python['custom_plugin_block'] = function(block) {
            return "# Custom Block\n";
        };

        this.updateToolbox();
    }

    updateToolbox() {
        const toolbox = document.getElementById('toolbox');
        if (!toolbox) return;

        let category = toolbox.querySelector('category[name="自作"]');
        if (!category) {
            category = document.createElement('category');
            category.setAttribute('name', '自作');
            category.setAttribute('data-icon', '🛠️');
            category.setAttribute('colour', '#100');
            toolbox.appendChild(category);
        }
        category.innerHTML += '<block type="custom_plugin_block"></block>';
        
        if (this.workspace) {
            this.workspace.updateToolbox(toolbox);
        }
    }

    async onunload() {
        const toolbox = document.getElementById('toolbox');
        if (!toolbox) return;
        const category = toolbox.querySelector('category[name="自作"]');
        if (category) {
            category.remove();
            if (this.workspace) {
                this.workspace.updateToolbox(toolbox);
            }
        }
    }
}

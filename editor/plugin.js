/**
 * EDBP Plugin System
 * Obsidian-like plugin management and vanilla plugin support.
 */

export class PluginManager {
    constructor(workspace) {
        this.workspace = workspace;
        this.plugins = new Map();
        this.enabledPlugins = new Set(JSON.parse(localStorage.getItem('edbb_enabled_plugins') || '[]'));
        this.pluginRegistry = [
            {
                id: 'vanilla-plugin',
                name: 'Vanilla Plugin',
                author: 'EDBP Team',
                version: '1.0.0',
                description: 'EDBPの基本機能を拡張するバニラプラグインです。',
                repo: 'https://github.com/EDBPlugin/easy-bdp',
                updateDate: '2026-02-07'
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
        
        // In a real scenario, we might fetch and eval script here.
        // For vanilla-plugin, we can implement it directly or as a module.
        if (id === 'vanilla-plugin') {
            const plugin = new VanillaPlugin(this.workspace);
            await plugin.onload();
            this.plugins.set(id, plugin);
        }
        
        this.enabledPlugins.add(id);
        this.saveState();
    }

    async disablePlugin(id) {
        const plugin = this.plugins.get(id);
        if (plugin) {
            await plugin.onunload();
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

        // Check if category already exists
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

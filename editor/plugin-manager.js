class PluginManager {
  constructor(workspace, Blockly) {
    this.workspace = workspace;
    this.Blockly = Blockly;

    this.plugins = [];        // manifest 情報
    this.registry = {
      blocks: [],
      categories: [],
      styles: []
    };
  }

  async loadAllPlugins() {
    // 1. plugin list 読み込み
    const list = await fetch('./plugin/plugins.json').then(r => r.json());

    // vanilla を最優先
    list.sort(p => (p.id === 'edbb.os.vanilla' ? -1 : 1));

    // 2. 収集フェーズ
    for (const plugin of list) {
      await this.collectPlugin(plugin);
    }

    // 3. 実行フェーズ
    for (const plugin of list) {
      await this.executePlugin(plugin);
    }

    console.log('[EDBP] all plugins loaded');
  }

  async collectPlugin(plugin) {
    this.plugins.push(plugin);

    if (plugin.provides?.blocks) {
      const blocks = await fetch(`./plugin/${plugin.id}/blocks.json`).then(r => r.json());
      this.registry.blocks.push(...blocks);
    }

    if (plugin.provides?.categories) {
      const cats = await fetch(`./plugin/${plugin.id}/categories.json`).then(r => r.json());
      this.registry.categories.push(...cats);
    }

    if (plugin.provides?.styles) {
      const styles = await fetch(`./plugin/${plugin.id}/styles.json`).then(r => r.json());
      this.registry.styles.push(...styles);
    }
  }

  async executePlugin(plugin) {
    if (!plugin.entry) return;

    const code = await fetch(`./plugin/${plugin.id}/${plugin.entry}`).then(r => r.text());

    const fn = new Function(
      'api',
      'Blockly',
      'workspace',
      code
    );

    fn(this.createAPI(), this.Blockly, this.workspace);
  }

  createAPI() {
    return {
      registerBlock: b => this.registry.blocks.push(b),
      registerCategory: c => this.registry.categories.push(c),
      registerStyle: s => this.registry.styles.push(s)
    };
  }
}

window.PluginManager = PluginManager;

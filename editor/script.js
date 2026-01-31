import Blocks from './blocks.js';
import WorkspaceStorage from './storage.js';
import { initShareFeature } from "./share.js";

let workspace;
let storage;

Blockly.Blocks['custom_python_code'] = {
  init: function () {
    this.appendDummyInput().appendField('🐍 Pythonコード実行');
    this.appendDummyInput().appendField(
      new Blockly.FieldMultilineInput("print('Hello World')"),
      'CODE',
    );
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(60);
    this.setTooltip('任意のPythonコードをここに記述して実行させます。');
  },
};

const setupBlocklyEnvironment = () => {
  // Modern Theme Definition
  const modernLightTheme = Blockly.Theme.defineTheme('modernLight', {
    base: Blockly.Themes.Classic,
    componentStyles: {
      workspaceBackgroundColour: '#f8fafc', // slate-50
      toolboxBackgroundColour: '#ffffff',
      toolboxForegroundColour: '#475569',
      flyoutBackgroundColour: '#ffffff',
      flyoutForegroundColour: '#475569',
      flyoutOpacity: 0.95,
      scrollbarColour: '#cbd5e1',
      insertionMarkerColour: '#6366f1', // Indigo
      insertionMarkerOpacity: 0.3,
      cursorColour: '#6366f1',
    },
    fontStyle: {
      family: 'Plus Jakarta Sans, sans-serif',
      weight: '600',
      size: 12,
    },
  });

  const modernDarkTheme = Blockly.Theme.defineTheme('modernDark', {
    base: Blockly.Themes.Classic,
    componentStyles: {
      workspaceBackgroundColour: '#020617', // slate-950
      toolboxBackgroundColour: '#0f172a', // slate-900
      toolboxForegroundColour: '#cbd5e1',
      flyoutBackgroundColour: '#0f172a',
      flyoutForegroundColour: '#cbd5e1',
      flyoutOpacity: 0.95,
      scrollbarColour: '#334155',
      insertionMarkerColour: '#818cf8', // Indigo light
      insertionMarkerOpacity: 0.3,
      cursorColour: '#818cf8',
    },
    fontStyle: {
      family: 'Plus Jakarta Sans, sans-serif',
      weight: '600',
      size: 12,
    },
    blockStyles: {
      hat_blocks: { colourPrimary: '#a55b80' },
    },
  });

  Blockly.Python = Blocks.Python;
  Blockly.Blocks = Blocks.Blocks;
  Blockly.Python.INDENT = '    ';

  return { modernLightTheme, modernDarkTheme };
};

const html = document.documentElement;

const extractInteractionEvents = (rawCode) => {
  const lines = rawCode.split('\n');
  let filteredLines = [];
  let componentEvents = '';
  let modalEvents = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('# BUTTON_EVENT:')) {
      const currentEventName = line.split(':')[1].trim();
      componentEvents +=
        `            if interaction.data.get('custom_id') == '${currentEventName}':\n` +
        `                await on_button_${currentEventName}(interaction)\n`;
      filteredLines.push(line);
    } else if (line.includes('# MODAL_EVENT:')) {
      const currentEventName = line.split(':')[1].trim();
      modalEvents +=
        `            if interaction.data.get('custom_id') == '${currentEventName}':\n` +
        `                await on_modal_${currentEventName}(interaction)\n`;
      filteredLines.push(line);
    } else {
      filteredLines.push(line);
    }
  }

  const cleanedCode = filteredLines.join('\n');
  return {
    cleanedCode,
    componentEvents,
    modalEvents,
    hasComponentEvents: componentEvents.trim().length > 0,
    hasModalEvents: modalEvents.trim().length > 0,
  };
};

// --- Code Generation & UI Sync ---
const generatePythonCode = () => {
  if (!workspace) return '';
  const rawCode = Blockly.Python.workspaceToCode(workspace);
  const {
    cleanedCode,
    componentEvents: componentEventsRaw,
    modalEvents: modalEventsRaw,
    hasComponentEvents,
    hasModalEvents,
  } = extractInteractionEvents(rawCode);
  let componentEvents = componentEventsRaw;
  let modalEvents = modalEventsRaw;
  const bodyCode = cleanedCode;

  if (!componentEvents.trim()) componentEvents = '            pass';
  if (!modalEvents.trim()) modalEvents = '            pass';

  // --- Dependency Analysis ---
  const usesJson = bodyCode.includes('_load_json_data') || bodyCode.includes('_save_json_data') || bodyCode.includes('json.');
  const usesModal = bodyCode.includes('EasyModal');
  const usesRandom = bodyCode.includes('random.');
  const usesAsyncio = bodyCode.includes('asyncio.');
  const usesDatetime = bodyCode.includes('datetime.');
  const usesMath = bodyCode.includes('math.');
  const usesLogging = bodyCode.includes('logging.') || usesJson; // JSON helpers use logging
  const needInteractionHandler = hasComponentEvents || hasModalEvents;

  // --- Build Imports ---
  const imports = [
    'import discord',
    'from discord import app_commands',
    'from discord.ext import commands',
  ];
  if (needInteractionHandler || usesModal || bodyCode.includes('discord.ui')) imports.push('from discord import ui');
  if (usesRandom) imports.push('import random');
  if (usesAsyncio) imports.push('import asyncio');
  if (usesDatetime) imports.push('import datetime');
  if (usesMath) imports.push('import math');
  if (usesJson) {
    imports.push('import json');
    imports.push('import os');
  }
  if (usesLogging) imports.push('import logging');

  const header = imports.join('\n');

  const fullBoiler = `
# Easy Discord Bot Builderによって作成されました！ 製作：@himais0giiiin
# Created with Easy Discord Bot Builder! created by @himais0giiiin!
# Optimized Version

${header}

intents = discord.Intents.default()
intents.message_content = True 
intents.members = True 
intents.voice_states = True

# Botの作成
bot = commands.Bot(command_prefix='!', intents=intents)

# グローバルエラーハンドラー
@bot.event
async def on_command_error(ctx, error):
    if isinstance(error, commands.CommandNotFound):
        return
    logging.error(f"Command Error: {error}")

# ---JSON操作---
def _load_json_data(filename):
    if not os.path.exists(filename):
        return {}
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        logging.error(f"JSON Load Error: {e}")
        return {}

def _save_json_data(filename, data):
    try:
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=4)
    except Exception as e:
        logging.error(f"JSON Save Error: {e}")

# --- モーダルクラス ---
class EasyModal(discord.ui.Modal):
    def __init__(self, title, custom_id, inputs):
        super().__init__(title=title, timeout=None, custom_id=custom_id)
        for item in inputs:
            self.add_item(discord.ui.TextInput(label=item['label'], custom_id=item['id']))

# --- インタラクションハンドラー ---
@bot.event
async def on_interaction(interaction):
    try:
        if interaction.type == discord.InteractionType.component:
${componentEvents}
        elif interaction.type == discord.InteractionType.modal_submit:
${modalEvents}
    except Exception as e:
        print(f"Interaction Error: {e}")

# ----------------------------

# --- ユーザー作成部分 ---
${bodyCode}
# --------------------------

if __name__ == "__main__":
    # Token check
    # bot.run('TOKEN') # 実行時はここにTokenを入れてください!
    pass
`;

  return fullBoiler.trim();
};

const updateLivePreview = () => {
  const code = generatePythonCode();
  const preview = document.getElementById('codePreviewContent');
  preview.textContent = code;
  hljs.highlightElement(preview);
};

const toggleTheme = (modernLightTheme, modernDarkTheme) => {
  const currentTheme = html.classList.contains('dark') ? 'dark' : 'light';
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  html.classList.remove(currentTheme);
  html.classList.add(newTheme);
  localStorage.setItem('theme', newTheme);
  if (workspace) {
    workspace.setTheme(newTheme === 'dark' ? modernDarkTheme : modernLightTheme);
  }
};

const indentBlock = (block, spaces = 4) =>
  block
    .split('\n')
    .map((line) => (line.trim() === '' ? '' : `${' '.repeat(spaces)}${line}`))
    .join('\n');

const addSelfParam = (block) =>
  block.replace(/async def ([^(]+)\(([^)]*)\)/, (match, name, params) => {
    const trimmed = params.trim();
    if (!trimmed) return `async def ${name}(self)`;
    if (trimmed.startsWith('self')) return `async def ${name}(${trimmed})`;
    return `async def ${name}(self, ${trimmed})`;
  });

const convertEventBlock = (block) => {
  let updated = block.replace('@bot.event', '@commands.Cog.listener()');
  updated = addSelfParam(updated);
  updated = updated.replace(/\bbot\./g, 'self.bot.');
  return updated;
};

const convertSlashCommandBlock = (block) => {
  let updated = block.replace('@bot.tree.command', '@app_commands.command');
  updated = addSelfParam(updated);
  updated = updated.replace(/\bbot\./g, 'self.bot.');
  return updated;
};

const convertPrefixCommandBlock = (block) => {
  let updated = block.replace('@bot.command', '@commands.command');
  updated = addSelfParam(updated);
  updated = updated.replace(/\bbot\./g, 'self.bot.');
  return updated;
};

const convertComponentBlock = (block) => {
  let updated = addSelfParam(block);
  updated = updated.replace(/\bbot\./g, 'self.bot.');
  return updated;
};

const buildInteractionHandler = (componentEvents, modalEvents) => {
  let componentBody = componentEvents.trim()
    ? componentEvents.replace(/await on_button_/g, 'await self.on_button_')
    : '            pass';
  let modalBody = modalEvents.trim()
    ? modalEvents.replace(/await on_modal_/g, 'await self.on_modal_')
    : '            pass';

  return `
@commands.Cog.listener()
async def on_interaction(self, interaction):
    try:
        if interaction.type == discord.InteractionType.component:
${componentBody}
        elif interaction.type == discord.InteractionType.modal_submit:
${modalBody}
    except Exception as e:
        print(f"Interaction Error: {e}")
`.trim();
};

const buildImports = (bodyCode, needsInteractionHandler) => {
  const imports = [
    'import discord',
    'from discord import app_commands',
    'from discord.ext import commands',
  ];
  if (needsInteractionHandler || bodyCode.includes('EasyModal') || bodyCode.includes('discord.ui')) {
    imports.push('from discord import ui');
  }
  if (bodyCode.includes('random.')) imports.push('import random');
  if (bodyCode.includes('asyncio.')) imports.push('import asyncio');
  if (bodyCode.includes('datetime.')) imports.push('import datetime');
  if (bodyCode.includes('math.')) imports.push('import math');
  if (
    bodyCode.includes('_load_json_data') ||
    bodyCode.includes('_save_json_data') ||
    bodyCode.includes('json.')
  ) {
    imports.push('import json');
    imports.push('import os');
  }
  if (bodyCode.includes('logging.') || bodyCode.includes('_load_json_data') || bodyCode.includes('_save_json_data')) {
    imports.push('import logging');
  }
  return imports;
};

const buildSharedModule = (bodyCode) => {
  const usesJson =
    bodyCode.includes('_load_json_data') ||
    bodyCode.includes('_save_json_data') ||
    bodyCode.includes('json.');
  const usesModal = bodyCode.includes('EasyModal');
  const usesLogging = bodyCode.includes('logging.') || usesJson;

  if (!usesJson && !usesModal && !usesLogging) return '';

  let content = `# Shared helpers\n`;
  if (usesLogging) {
    content += `import logging\n\n`;
    content += `logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')\n\n`;
  }
  if (usesJson) {
    content += `import json\nimport os\n\n`;
    content += `def _load_json_data(filename):\n`;
    content += `    if not os.path.exists(filename):\n`;
    content += `        return {}\n`;
    content += `    try:\n`;
    content += `        with open(filename, 'r', encoding='utf-8') as f:\n`;
    content += `            return json.load(f)\n`;
    content += `    except Exception as e:\n`;
    content += `        logging.error(f"JSON Load Error: {e}")\n`;
    content += `        return {}\n\n`;
    content += `def _save_json_data(filename, data):\n`;
    content += `    try:\n`;
    content += `        with open(filename, 'w', encoding='utf-8') as f:\n`;
    content += `            json.dump(data, f, ensure_ascii=False, indent=4)\n`;
    content += `    except Exception as e:\n`;
    content += `        logging.error(f"JSON Save Error: {e}")\n\n`;
  }
  if (usesModal) {
    content += `import discord\n\n`;
    content += `class EasyModal(discord.ui.Modal):\n`;
    content += `    def __init__(self, title, custom_id, inputs):\n`;
    content += `        super().__init__(title=title, timeout=None, custom_id=custom_id)\n`;
    content += `        for item in inputs:\n`;
    content += `            self.add_item(discord.ui.TextInput(label=item['label'], custom_id=item['id']))\n`;
  }
  return content.trim();
};

const buildCogFile = (className, blocks, imports, sharedImports = '') => {
  const body = blocks.map((block) => indentBlock(block)).join('\n\n');
  const header = `${imports.join('\n')}\n${sharedImports}`.trim();
  return `
${header}

class ${className}(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

${body}

async def setup(bot):
    await bot.add_cog(${className}(bot))
`.trim();
};

const buildModuleFile = (imports, sharedImports, body) => {
  const header = `${imports.join('\n')}\n${sharedImports}`.trim();
  return `
${header}

${body}

async def setup(bot):
    pass
`.trim();
};

const blockCodeToString = (code) => {
  if (!code) return '';
  if (Array.isArray(code)) return code[0] || '';
  return code;
};

const slugify = (value) => {
  const base = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return base || 'group';
};

const toPascalCase = (value) =>
  value
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');

const deriveGroupMeta = (block) => {
  const type = block?.type || 'group';
  let kind = 'misc';
  let label = type;

  if (['on_ready', 'on_message_create', 'on_member_join', 'on_member_remove', 'on_reaction_add'].includes(type)) {
    kind = 'event';
  } else if (type === 'on_command_executed') {
    kind = 'slash';
  } else if (type === 'prefix_command') {
    kind = 'prefix';
  } else if (type === 'on_button_click') {
    kind = 'button';
  } else if (type === 'on_modal_submit') {
    kind = 'modal';
  }

  if (type === 'on_command_executed' || type === 'prefix_command') {
    label = block.getFieldValue('COMMAND_NAME') || type;
  } else if (type === 'on_button_click' || type === 'on_modal_submit') {
    label = block.getFieldValue('CUSTOM_ID') || type;
  }

  return { kind, label, type };
};

const generateSplitPythonFiles = () => {
  if (!workspace) return {};
  const topBlocks = workspace.getTopBlocks(true);
  const rawAll = topBlocks.map((block) => blockCodeToString(Blockly.Python.blockToCode(block))).join('\n');
  const { cleanedCode: allCleaned } = extractInteractionEvents(rawAll);

  const sharedModule = buildSharedModule(allCleaned);
  const files = { 'cogs/__init__.py': '' };
  if (sharedModule) files['cogs/shared.py'] = sharedModule;

  const nameCounter = new Map();
  const cogsToLoad = [];

  const makeUniqueSlug = (base) => {
    const current = nameCounter.get(base) || 0;
    nameCounter.set(base, current + 1);
    return current === 0 ? base : `${base}_${current + 1}`;
  };

  topBlocks.forEach((block) => {
    const rawGroup = blockCodeToString(Blockly.Python.blockToCode(block));
    if (!rawGroup || !rawGroup.trim()) return;

    const {
      cleanedCode,
      componentEvents,
      modalEvents,
      hasComponentEvents,
      hasModalEvents,
    } = extractInteractionEvents(rawGroup);

    const { kind, label } = deriveGroupMeta(block);
    const baseSlug = slugify(`${kind}_${label}`);
    const fileSlug = makeUniqueSlug(baseSlug);
    const className = `${toPascalCase(fileSlug)}Cog`.replace(/^[0-9]/, 'Cog$&');

    const needsInteractionHandler = hasComponentEvents || hasModalEvents;
    const imports = buildImports(cleanedCode, needsInteractionHandler);
    const usesJson =
      cleanedCode.includes('_load_json_data') ||
      cleanedCode.includes('_save_json_data') ||
      cleanedCode.includes('json.');
    const usesModal = cleanedCode.includes('EasyModal');
    const sharedSymbols = [];
    if (usesJson) sharedSymbols.push('_load_json_data', '_save_json_data');
    if (usesModal) sharedSymbols.push('EasyModal');
    const sharedImports =
      sharedModule && sharedSymbols.length
        ? `from .shared import ${sharedSymbols.join(', ')}`
        : '';

    let fileContent = '';
    if (kind === 'event') {
      fileContent = buildCogFile(className, [convertEventBlock(cleanedCode)], imports, sharedImports);
    } else if (kind === 'slash') {
      fileContent = buildCogFile(className, [convertSlashCommandBlock(cleanedCode)], imports, sharedImports);
    } else if (kind === 'prefix') {
      fileContent = buildCogFile(className, [convertPrefixCommandBlock(cleanedCode)], imports, sharedImports);
    } else if (kind === 'button' || kind === 'modal') {
      const blocks = [];
      if (needsInteractionHandler) {
        blocks.push(buildInteractionHandler(componentEvents, modalEvents));
      }
      blocks.push(convertComponentBlock(cleanedCode));
      fileContent = buildCogFile(className, blocks, imports, sharedImports);
    } else {
      fileContent = buildModuleFile(imports, sharedImports, cleanedCode.trim());
    }

    const filePath = `cogs/${fileSlug}.py`;
    files[filePath] = fileContent;
    cogsToLoad.push(filePath.replace('cogs/', 'cogs.').replace('.py', ''));
  });

  const botFile = `
# Easy Discord Bot Builder - Split Cogs Version

import discord
from discord.ext import commands

intents = discord.Intents.default()
intents.message_content = True 
intents.members = True 
intents.voice_states = True

class EasyBot(commands.Bot):
    async def setup_hook(self):
        for ext in ${JSON.stringify(cogsToLoad)}:
            await self.load_extension(ext)

bot = EasyBot(command_prefix='!', intents=intents)

if __name__ == "__main__":
    print('\\x1b[31m!!!!Warning!!!! If you have not set a token, please set the token in the "TOKEN" section at the end of the code before execution.\\x1b[0m')
    bot.run('TOKEN')
`.trim();

  files['bot.py'] = botFile;
  return files;
};

const downloadTextFile = (filename, content) => {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const renderSplitFiles = (files) => {
  const container = document.getElementById('splitFileList');
  container.innerHTML = '';
  Object.entries(files).forEach(([path, content]) => {
    if (!content) return;
    const item = document.createElement('div');
    item.className =
      'rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden';
    item.innerHTML = `
      <div class="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
        <div class="text-xs font-mono text-slate-600 dark:text-slate-300">${path}</div>
        <div class="flex items-center gap-2">
          <button class="splitCopyBtn inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800" data-path="${path}">
            <i data-lucide="copy" class="w-3.5 h-3.5"></i> Copy
          </button>
          <button class="splitDownloadBtn inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-indigo-600 hover:bg-indigo-700 text-white" data-path="${path}">
            <i data-lucide="download" class="w-3.5 h-3.5"></i> DL
          </button>
        </div>
      </div>
      <pre class="p-4 text-xs font-mono bg-[#0f172a] text-[#e2e8f0] overflow-x-auto"></pre>
    `;
    const pre = item.querySelector('pre');
    if (pre) pre.textContent = content;
    container.appendChild(item);
  });

  container.querySelectorAll('.splitCopyBtn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const path = btn.getAttribute('data-path');
      if (!path || !files[path]) return;
      navigator.clipboard.writeText(files[path]);
      btn.textContent = 'Copied';
      setTimeout(() => {
        btn.innerHTML = '<i data-lucide="copy" class="w-3.5 h-3.5"></i> Copy';
        lucide.createIcons();
      }, 1200);
    });
  });

  container.querySelectorAll('.splitDownloadBtn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const path = btn.getAttribute('data-path');
      if (!path || !files[path]) return;
      const safeName = path.replace(/\//g, '__');
      downloadTextFile(safeName, files[path]);
    });
  });

  lucide.createIcons();
};

def _load_json_data(filename):
    if not os.path.exists(filename):
        return {}
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        logging.error(f"JSON Load Error: {e}")
        return {}

def _save_json_data(filename, data):
    try:
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=4)
    except Exception as e:
        logging.error(f"JSON Save Error: {e}")

# --- モーダルクラス ---
class EasyModal(discord.ui.Modal):
    def __init__(self, title, custom_id, inputs):
        super().__init__(title=title, timeout=None, custom_id=custom_id)
        for item in inputs:
            self.add_item(discord.ui.TextInput(label=item['label'], custom_id=item['id']))

# --- インタラクションハンドラー ---
@bot.event
async def on_interaction(interaction):
    try:
        if interaction.type == discord.InteractionType.component:
${componentEvents}
        elif interaction.type == discord.InteractionType.modal_submit:
${modalEvents}
    except Exception as e:
        print(f"Interaction Error: {e}")

# ----------------------------

# --- ユーザー作成部分 ---
${bodyCode}
# --------------------------

if __name__ == "__main__":
    # Token check
    # bot.run('TOKEN') # 実行時はここにTokenを入れてください!
    pass
`;
  return boilerplate.trim();
};

const updateLivePreview = () => {
  const code = generatePythonCode();
  const preview = document.getElementById('codePreviewContent');
  preview.textContent = code;
  hljs.highlightElement(preview);
};

const toggleTheme = (modernLightTheme, modernDarkTheme) => {
  const currentTheme = html.classList.contains('dark') ? 'dark' : 'light';
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  html.classList.remove(currentTheme);
  html.classList.add(newTheme);
  localStorage.setItem('theme', newTheme);
  if (workspace) {
    workspace.setTheme(newTheme === 'dark' ? modernDarkTheme : modernLightTheme);
  }
};

const indentBlock = (block, spaces = 4) =>
  block
    .split('\n')
    .map((line) => (line.trim() === '' ? '' : `${' '.repeat(spaces)}${line}`))
    .join('\n');

const addSelfParam = (block) =>
  block.replace(/async def ([^(]+)\(([^)]*)\)/, (match, name, params) => {
    const trimmed = params.trim();
    if (!trimmed) return `async def ${name}(self)`;
    if (trimmed.startsWith('self')) return `async def ${name}(${trimmed})`;
    return `async def ${name}(self, ${trimmed})`;
  });

const convertEventBlock = (block) => {
  let updated = block.replace('@bot.event', '@commands.Cog.listener()');
  updated = addSelfParam(updated);
  updated = updated.replace(/\bbot\./g, 'self.bot.');
  return updated;
};

const convertSlashCommandBlock = (block) => {
  let updated = block.replace('@bot.tree.command', '@app_commands.command');
  updated = addSelfParam(updated);
  updated = updated.replace(/\bbot\./g, 'self.bot.');
  return updated;
};

const convertPrefixCommandBlock = (block) => {
  let updated = block.replace('@bot.command', '@commands.command');
  updated = addSelfParam(updated);
  updated = updated.replace(/\bbot\./g, 'self.bot.');
  return updated;
};

const convertComponentBlock = (block) => {
  let updated = addSelfParam(block);
  updated = updated.replace(/\bbot\./g, 'self.bot.');
  return updated;
};

const buildInteractionHandler = (componentEvents, modalEvents) => {
  let componentBody = componentEvents.trim()
    ? componentEvents.replace(/await on_button_/g, 'await self.on_button_')
    : '            pass';
  let modalBody = modalEvents.trim()
    ? modalEvents.replace(/await on_modal_/g, 'await self.on_modal_')
    : '            pass';

  return `
@commands.Cog.listener()
async def on_interaction(self, interaction):
    try:
        if interaction.type == discord.InteractionType.component:
${componentBody}
        elif interaction.type == discord.InteractionType.modal_submit:
${modalBody}
    except Exception as e:
        print(f"Interaction Error: {e}")
`.trim();
};

const buildImports = (bodyCode, needsInteractionHandler) => {
  const imports = [
    'import discord',
    'from discord import app_commands',
    'from discord.ext import commands',
  ];
  if (needsInteractionHandler || bodyCode.includes('EasyModal') || bodyCode.includes('discord.ui')) {
    imports.push('from discord import ui');
  }
  if (bodyCode.includes('random.')) imports.push('import random');
  if (bodyCode.includes('asyncio.')) imports.push('import asyncio');
  if (bodyCode.includes('datetime.')) imports.push('import datetime');
  if (bodyCode.includes('math.')) imports.push('import math');
  if (
    bodyCode.includes('_load_json_data') ||
    bodyCode.includes('_save_json_data') ||
    bodyCode.includes('json.')
  ) {
    imports.push('import json');
    imports.push('import os');
  }
  if (bodyCode.includes('logging.') || bodyCode.includes('_load_json_data') || bodyCode.includes('_save_json_data')) {
    imports.push('import logging');
  }
  return imports;
};

const buildSharedModule = (bodyCode) => {
  const usesJson =
    bodyCode.includes('_load_json_data') ||
    bodyCode.includes('_save_json_data') ||
    bodyCode.includes('json.');
  const usesModal = bodyCode.includes('EasyModal');
  const usesLogging = bodyCode.includes('logging.') || usesJson;

  if (!usesJson && !usesModal && !usesLogging) return '';

  let content = `# Shared helpers\n`;
  if (usesLogging) {
    content += `import logging\n\n`;
    content += `logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')\n\n`;
  }
  if (usesJson) {
    content += `import json\nimport os\n\n`;
    content += `def _load_json_data(filename):\n`;
    content += `    if not os.path.exists(filename):\n`;
    content += `        return {}\n`;
    content += `    try:\n`;
    content += `        with open(filename, 'r', encoding='utf-8') as f:\n`;
    content += `            return json.load(f)\n`;
    content += `    except Exception as e:\n`;
    content += `        logging.error(f"JSON Load Error: {e}")\n`;
    content += `        return {}\n\n`;
    content += `def _save_json_data(filename, data):\n`;
    content += `    try:\n`;
    content += `        with open(filename, 'w', encoding='utf-8') as f:\n`;
    content += `            json.dump(data, f, ensure_ascii=False, indent=4)\n`;
    content += `    except Exception as e:\n`;
    content += `        logging.error(f"JSON Save Error: {e}")\n\n`;
  }
  if (usesModal) {
    content += `import discord\n\n`;
    content += `class EasyModal(discord.ui.Modal):\n`;
    content += `    def __init__(self, title, custom_id, inputs):\n`;
    content += `        super().__init__(title=title, timeout=None, custom_id=custom_id)\n`;
    content += `        for item in inputs:\n`;
    content += `            self.add_item(discord.ui.TextInput(label=item['label'], custom_id=item['id']))\n`;
  }
  return content.trim();
};

const buildCogFile = (className, blocks, imports, sharedImports = '') => {
  const body = blocks.map((block) => indentBlock(block)).join('\n\n');
  const header = `${imports.join('\n')}\n${sharedImports}`.trim();
  return `
${header}

class ${className}(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

${body}

async def setup(bot):
    await bot.add_cog(${className}(bot))
`.trim();
};

const buildModuleFile = (imports, sharedImports, body) => {
  const header = `${imports.join('\n')}\n${sharedImports}`.trim();
  return `
${header}

${body}

async def setup(bot):
    pass
`.trim();
};

const blockCodeToString = (code) => {
  if (!code) return '';
  if (Array.isArray(code)) return code[0] || '';
  return code;
};

const slugify = (value) => {
  const base = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return base || 'group';
};

const toPascalCase = (value) =>
  value
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');

const deriveGroupMeta = (block) => {
  const type = block?.type || 'group';
  let kind = 'misc';
  let label = type;

  if (['on_ready', 'on_message_create', 'on_member_join', 'on_member_remove', 'on_reaction_add'].includes(type)) {
    kind = 'event';
  } else if (type === 'on_command_executed') {
    kind = 'slash';
  } else if (type === 'prefix_command') {
    kind = 'prefix';
  } else if (type === 'on_button_click') {
    kind = 'button';
  } else if (type === 'on_modal_submit') {
    kind = 'modal';
  }

  if (type === 'on_command_executed' || type === 'prefix_command') {
    label = block.getFieldValue('COMMAND_NAME') || type;
  } else if (type === 'on_button_click' || type === 'on_modal_submit') {
    label = block.getFieldValue('CUSTOM_ID') || type;
  }

  return { kind, label, type };
};

const generateSplitPythonFiles = () => {
  if (!workspace) return {};
  const topBlocks = workspace.getTopBlocks(true);
  const rawAll = topBlocks.map((block) => blockCodeToString(Blockly.Python.blockToCode(block))).join('\n');
  const { cleanedCode: allCleaned } = extractInteractionEvents(rawAll);

  const sharedModule = buildSharedModule(allCleaned);
  const files = { 'cogs/__init__.py': '' };
  if (sharedModule) files['cogs/shared.py'] = sharedModule;

  const nameCounter = new Map();
  const cogsToLoad = [];

  const makeUniqueSlug = (base) => {
    const current = nameCounter.get(base) || 0;
    nameCounter.set(base, current + 1);
    return current === 0 ? base : `${base}_${current + 1}`;
  };

  topBlocks.forEach((block) => {
    const rawGroup = blockCodeToString(Blockly.Python.blockToCode(block));
    if (!rawGroup || !rawGroup.trim()) return;

    const {
      cleanedCode,
      componentEvents,
      modalEvents,
      hasComponentEvents,
      hasModalEvents,
    } = extractInteractionEvents(rawGroup);

    const { kind, label } = deriveGroupMeta(block);
    const baseSlug = slugify(`${kind}_${label}`);
    const fileSlug = makeUniqueSlug(baseSlug);
    const className = `${toPascalCase(fileSlug)}Cog`.replace(/^[0-9]/, 'Cog$&');

    const needsInteractionHandler = hasComponentEvents || hasModalEvents;
    const imports = buildImports(cleanedCode, needsInteractionHandler);
    const usesJson =
      cleanedCode.includes('_load_json_data') ||
      cleanedCode.includes('_save_json_data') ||
      cleanedCode.includes('json.');
    const usesModal = cleanedCode.includes('EasyModal');
    const sharedSymbols = [];
    if (usesJson) sharedSymbols.push('_load_json_data', '_save_json_data');
    if (usesModal) sharedSymbols.push('EasyModal');
    const sharedImports =
      sharedModule && sharedSymbols.length
        ? `from .shared import ${sharedSymbols.join(', ')}`
        : '';

    let fileContent = '';
    if (kind === 'event') {
      fileContent = buildCogFile(className, [convertEventBlock(cleanedCode)], imports, sharedImports);
    } else if (kind === 'slash') {
      fileContent = buildCogFile(className, [convertSlashCommandBlock(cleanedCode)], imports, sharedImports);
    } else if (kind === 'prefix') {
      fileContent = buildCogFile(className, [convertPrefixCommandBlock(cleanedCode)], imports, sharedImports);
    } else if (kind === 'button' || kind === 'modal') {
      const blocks = [];
      if (needsInteractionHandler) {
        blocks.push(buildInteractionHandler(componentEvents, modalEvents));
      }
      blocks.push(convertComponentBlock(cleanedCode));
      fileContent = buildCogFile(className, blocks, imports, sharedImports);
    } else {
      fileContent = buildModuleFile(imports, sharedImports, cleanedCode.trim());
    }

    const filePath = `cogs/${fileSlug}.py`;
    files[filePath] = fileContent;
    cogsToLoad.push(filePath.replace('cogs/', 'cogs.').replace('.py', ''));
  });

  const botFile = `
# Easy Discord Bot Builder - Split Cogs Version

import discord
from discord.ext import commands

intents = discord.Intents.default()
intents.message_content = True 
intents.members = True 
intents.voice_states = True

class EasyBot(commands.Bot):
    async def setup_hook(self):
        for ext in ${JSON.stringify(cogsToLoad)}:
            await self.load_extension(ext)

bot = EasyBot(command_prefix='!', intents=intents)

if __name__ == "__main__":
    print('\\x1b[31m!!!!Warning!!!! If you have not set a token, please set the token in the "TOKEN" section at the end of the code before execution.\\x1b[0m')
    bot.run('TOKEN')
`.trim();

  files['bot.py'] = botFile;
  return files;
};

const downloadTextFile = (filename, content) => {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const renderSplitFiles = (files) => {
  const container = document.getElementById('splitFileList');
  container.innerHTML = '';
  Object.entries(files).forEach(([path, content]) => {
    if (!content) return;
    const item = document.createElement('div');
    item.className =
      'rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden';
    item.innerHTML = `
      <div class="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
        <div class="text-xs font-mono text-slate-600 dark:text-slate-300">${path}</div>
        <div class="flex items-center gap-2">
          <button class="splitCopyBtn inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800" data-path="${path}">
            <i data-lucide="copy" class="w-3.5 h-3.5"></i> Copy
          </button>
          <button class="splitDownloadBtn inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-indigo-600 hover:bg-indigo-700 text-white" data-path="${path}">
            <i data-lucide="download" class="w-3.5 h-3.5"></i> DL
          </button>
        </div>
      </div>
      <pre class="p-4 text-xs font-mono bg-[#0f172a] text-[#e2e8f0] overflow-x-auto"></pre>
    `;
    const pre = item.querySelector('pre');
    if (pre) pre.textContent = content;
    container.appendChild(item);
  });

  container.querySelectorAll('.splitCopyBtn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const path = btn.getAttribute('data-path');
      if (!path || !files[path]) return;
      navigator.clipboard.writeText(files[path]);
      btn.textContent = 'Copied';
      setTimeout(() => {
        btn.innerHTML = '<i data-lucide="copy" class="w-3.5 h-3.5"></i> Copy';
        lucide.createIcons();
      }, 1200);
    });
  });

  container.querySelectorAll('.splitDownloadBtn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const path = btn.getAttribute('data-path');
      if (!path || !files[path]) return;
      const safeName = path.replace(/\//g, '__');
      downloadTextFile(safeName, files[path]);
    });
  });

  lucide.createIcons();
};

const initializeApp = () => {
  lucide.createIcons();
  const { modernLightTheme, modernDarkTheme } = setupBlocklyEnvironment();

  const blocklyDiv = document.getElementById('blocklyDiv');
  const toolbox = document.getElementById('toolbox');
  const themeToggle = document.getElementById('themeToggle');
  // ヘッダーのコード生成ボタン
  const showCodeBtn = document.getElementById('showCodeBtn');
  // モーダル関連
  const codeModal = document.getElementById('codeModal');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const codeOutput = document.getElementById('codeOutput');
  const copyCodeBtn = document.getElementById('copyCodeBtn');
  const splitCodeBtn = document.getElementById('splitCodeBtn');
  const splitCodeModal = document.getElementById('splitCodeModal');
  const splitModalClose = document.getElementById('splitModalClose');
  const splitDownloadAllBtn = document.getElementById('splitDownloadAllBtn');

  const importBtn = document.getElementById('importBtn');
  const exportBtn = document.getElementById('exportBtn');
  const importInput = document.getElementById('importInput');
  const workspaceContainer = document.getElementById('workspace-container');
  const layoutBlockBtn = document.getElementById('layoutBlockBtn');
  const layoutSplitBtn = document.getElementById('layoutSplitBtn');

  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') html.classList.add('dark');
  const initialTheme = savedTheme === 'dark' ? modernDarkTheme : modernLightTheme;

  // --- パレット固定化の強制適用 (Zoom Fix) ---
  // フライアウト（パレット）のスケールを常に1に固定するオーバーライド
  Blockly.VerticalFlyout.prototype.getFlyoutScale = function () {
    return 1;
  };

  // --- Blocklyワークスペースの初期化 ---
  workspace = Blockly.inject(blocklyDiv, {
    toolbox: toolbox,
    horizontalLayout: false,
    trashcan: true,
    zoom: {
      controls: true,
      wheel: true,
      startScale: 1.0,
      maxScale: 3,
      minScale: 0.3,
      scaleSpeed: 1.2,
    },
    renderer: 'zelos',
    theme: initialTheme,
  });

  // --- ワークスペース保存クラスの初期化 ---
  storage = new WorkspaceStorage(workspace);

  // --- Blocklyのブロック定義 ---
  const shareFeature = initShareFeature({
    workspace,
    storage,
  });

  // --- パレット（フライアウト）の固定設定 ---
  if (workspace.getToolbox()) {
    const flyout = workspace.getToolbox().getFlyout();
    if (flyout) {
      flyout.autoClose = false;
    }
  }

  // --- Layout Switching Logic ---
  const setLayout = (mode) => {
    if (mode === 'split') {
      workspaceContainer.classList.add('split-view');
      layoutSplitBtn.classList.remove('text-slate-500', 'dark:text-slate-400');
      layoutSplitBtn.classList.add(
        'bg-white',
        'dark:bg-slate-800',
        'shadow-sm',
        'text-indigo-600',
        'dark:text-indigo-400',
      );

      layoutBlockBtn.classList.remove(
        'bg-white',
        'dark:bg-slate-800',
        'shadow-sm',
        'text-indigo-600',
        'dark:text-indigo-400',
      );
      layoutBlockBtn.classList.add('text-slate-500', 'dark:text-slate-400');
      updateLivePreview();
    } else {
      workspaceContainer.classList.remove('split-view');
      layoutBlockBtn.classList.remove('text-slate-500', 'dark:text-slate-400');
      layoutBlockBtn.classList.add(
        'bg-white',
        'dark:bg-slate-800',
        'shadow-sm',
        'text-indigo-600',
        'dark:text-indigo-400',
      );

      layoutSplitBtn.classList.remove(
        'bg-white',
        'dark:bg-slate-800',
        'shadow-sm',
        'text-indigo-600',
        'dark:text-indigo-400',
      );
      layoutSplitBtn.classList.add('text-slate-500', 'dark:text-slate-400');
    }
    setTimeout(() => Blockly.svgResize(workspace), 350);
  };

  layoutBlockBtn.addEventListener('click', () => setLayout('block'));
  layoutSplitBtn.addEventListener('click', () => setLayout('split'));

  // --- Realtime Sync ---
  workspace.addChangeListener((e) => {
    // UIイベント以外で更新
    if (e.type !== Blockly.Events.UI && workspaceContainer.classList.contains('split-view')) {
      updateLivePreview();
    }

    // Auto Save
    if (
      !shareFeature.isShareViewMode() &&
      !e.isUiEvent &&
      e.type !== Blockly.Events.FINISHED_LOADING
    ) {
      storage?.save();
      const saveStatus = document.getElementById('saveStatus');
      saveStatus.setAttribute('data-show', 'true');
      setTimeout(() => saveStatus.setAttribute('data-show', 'false'), 2000);
    }
  });

  // --- Toolbox Pin Button (Re-implementation) ---
  const pinBtn = document.createElement('button');
  pinBtn.id = 'toolboxPinBtn';
  pinBtn.className =
    'absolute z-20 p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:text-slate-500 dark:hover:text-indigo-400 dark:hover:bg-indigo-900/30 transition-all duration-200 shadow-sm border border-transparent hover:border-indigo-100 dark:hover:border-indigo-900/50';
  pinBtn.style.top = '12px';

  const updatePinState = () => {
    if (!workspace) return;
    const toolbox = workspace.getToolbox();
    if (!toolbox) return;

    let isVisible = true;
    if (typeof toolbox.isVisible === 'function') {
      isVisible = toolbox.isVisible();
    } else if (typeof toolbox.getWidth === 'function') {
      isVisible = toolbox.getWidth() > 0;
    }

    const width = typeof toolbox.getWidth === 'function' ? toolbox.getWidth() : 0;

    if (isVisible) {
      pinBtn.style.left = `${width - 38}px`;
      pinBtn.innerHTML =
        '<i data-lucide="pin" class="w-3.5 h-3.5 fill-indigo-500 text-indigo-600"></i>';
      pinBtn.classList.add('bg-white', 'dark:bg-slate-800');
    } else {
      pinBtn.style.left = '12px';
      pinBtn.innerHTML = '<i data-lucide="pin-off" class="w-3.5 h-3.5"></i>';
      pinBtn.classList.remove('bg-white', 'dark:bg-slate-800');
      pinBtn.classList.add('bg-white/80', 'dark:bg-slate-800/80', 'backdrop-blur-sm');
    }
    lucide.createIcons();
  };

  pinBtn.onclick = () => {
    const toolbox = workspace.getToolbox();
    if (!toolbox) return;
    const isVisible =
      typeof toolbox.isVisible === 'function' ? toolbox.isVisible() : toolbox.getWidth() > 0;
    if (typeof toolbox.setVisible === 'function') toolbox.setVisible(!isVisible);
    Blockly.svgResize(workspace);
    setTimeout(updatePinState, 50);
  };
  document.getElementById('blocklyDiv').appendChild(pinBtn);
  // ピン留めボタンの表示/非表示切り替え
  const syncPinVisibility = (isViewOnly = shareFeature.isShareViewMode()) => {
    pinBtn.classList.toggle('hidden', isViewOnly);
    pinBtn.setAttribute('aria-hidden', isViewOnly ? 'true' : 'false');
  };
  // 共有リンクの閲覧モードではユーザーにツールボックス表示切替を触らせない
  shareFeature.onShareViewModeChange((isViewOnly) => {
    syncPinVisibility(isViewOnly);
    if (!isViewOnly) {
      setTimeout(updatePinState, 50);
    }
  });
  syncPinVisibility();
  setTimeout(updatePinState, 100);
  window.addEventListener('resize', () => {
    Blockly.svgResize(workspace);
    updatePinState();
  });
  workspace.addChangeListener((e) => {
    if (e.type === Blockly.Events.TOOLBOX_ITEM_SELECT) setTimeout(updatePinState, 50);
  });

  // --- Load Saved Data ---
  const sharedApplied = shareFeature.applySharedLayoutFromQuery();
  if (!sharedApplied) {
    storage?.load();
  }

  themeToggle.addEventListener('click', () => toggleTheme(modernLightTheme, modernDarkTheme));

  importBtn.addEventListener('click', () => importInput.click());
  importInput.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file || !storage) return;
    storage
      .importFile(file)
      .then(() => {
        Blockly.svgResize(workspace);
      })
      .catch((err) => console.error(err))
      .finally(() => {
        e.target.value = '';
      });
  });

  exportBtn.addEventListener('click', () => {
    storage?.exportFile();
  });

  // --- モーダル表示ロジック (アニメーション付き) ---
  showCodeBtn.addEventListener('click', () => {
    showCodeBtn.blur();
    // Blocklyの選択ハイライトなどを解除
    if (workspace) Blockly.hideChaff();
    codeOutput.textContent = generatePythonCode();
    codeModal.classList.remove('hidden');
    codeModal.classList.add('flex');
    // Force reflow
    void codeModal.offsetWidth;
    codeModal.classList.add('show-modal');
  });

  const openSplitModal = () => {
    if (!splitCodeModal) return;
    const files = generateSplitPythonFiles();
    renderSplitFiles(files);
    splitCodeModal.classList.remove('hidden');
    splitCodeModal.classList.add('flex');
    void splitCodeModal.offsetWidth;
    splitCodeModal.classList.add('show-modal');
  };

  splitCodeBtn?.addEventListener('click', () => {
    openSplitModal();
  });

  closeModalBtn.addEventListener('click', () => {
    codeModal.classList.remove('show-modal');
    setTimeout(() => {
      codeModal.classList.remove('flex');
      codeModal.classList.add('hidden');
    }, 300); // Wait for transition
  });

  splitModalClose?.addEventListener('click', () => {
    splitCodeModal.classList.remove('show-modal');
    setTimeout(() => {
      splitCodeModal.classList.remove('flex');
      splitCodeModal.classList.add('hidden');
    }, 300);
  });

  splitDownloadAllBtn?.addEventListener('click', () => {
    const files = generateSplitPythonFiles();
    Object.entries(files).forEach(([path, content]) => {
      if (!content) return;
      const safeName = path.replace(/\//g, '__');
      downloadTextFile(safeName, content);
    });
  });

  copyCodeBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(codeOutput.textContent);
    const originalHtml = copyCodeBtn.innerHTML;
    copyCodeBtn.innerHTML = '<i data-lucide="check" class="w-3.5 h-3.5"></i> コピー完了';
    copyCodeBtn.classList.remove('bg-indigo-600', 'hover:bg-indigo-500');
    copyCodeBtn.classList.add('bg-emerald-600', 'hover:bg-emerald-500', 'border-emerald-400');
    lucide.createIcons();

    setTimeout(() => {
      copyCodeBtn.innerHTML = originalHtml;
      copyCodeBtn.classList.add('bg-indigo-600', 'hover:bg-indigo-500');
      copyCodeBtn.classList.remove('bg-emerald-600', 'hover:bg-emerald-500', 'border-emerald-400');
      lucide.createIcons();
    }, 2000);
  });
};

window.onload = initializeApp;

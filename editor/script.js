// Note: blocks.js modifies the global Blockly object directly
// We import it to ensure it's loaded and executed
import './blocks.js';
import WorkspaceStorage from './storage.js';
import { initShareFeature } from "./share.js";
import { PluginManager } from "./plugin.js";
import { PluginUI } from "./plugin-ui.js";

const PROJECT_TITLE_STORAGE_KEY = 'edbb_project_title';

let workspace;
let storage;

const LIST_STORE_KEY = 'edbb_list_store';

const listStore = (() => {
  let lists = new Map();

  const normalizeItems = (items) => {
    if (!Array.isArray(items)) return [];
    return items.map((item) => (item == null ? '' : String(item)));
  };

  const ensureList = (id) => {
    if (!id) return [];
    if (!lists.has(id)) lists.set(id, []);
    return lists.get(id) || [];
  };

  const setItems = (id, items) => {
    if (!id) return;
    lists.set(id, normalizeItems(items));
  };

  const getItems = (id) => lists.get(id) || [];

  const appendItem = (id, value = '') => {
    if (!id) return;
    const items = [...getItems(id), String(value)];
    lists.set(id, items);
  };

  const updateItem = (id, index, value) => {
    if (!id) return;
    const items = [...getItems(id)];
    if (index < 0 || index >= items.length) return;
    items[index] = String(value ?? '');
    lists.set(id, items);
  };

  const removeItem = (id, index) => {
    if (!id) return;
    const items = [...getItems(id)];
    if (index < 0 || index >= items.length) return;
    items.splice(index, 1);
    lists.set(id, items);
  };

  const removeList = (id) => {
    if (!id) return;
    lists.delete(id);
  };

  const getEntries = () =>
    Array.from(lists.entries()).map(([id, items]) => ({ id, items: [...items] }));

  const getIds = () => Array.from(lists.keys());

  const toJSON = (workspaceRef) => {
    const payload = { lists: [] };
    if (!workspaceRef) return payload;
    lists.forEach((items, id) => {
      const variable = workspaceRef.getVariableById(id);
      if (!variable) return;
      payload.lists.push({
        name: variable.name,
        items: [...items],
      });
    });
    return payload;
  };

  const fromJSON = (data, workspaceRef) => {
    lists = new Map();
    if (!data || typeof data !== 'object') return;

    if (Array.isArray(data.lists)) {
      data.lists.forEach((entry) => {
        if (!entry || typeof entry !== 'object') return;
        const name = String(entry.name || '').trim();
        if (!name) return;
        let variable = null;
        if (workspaceRef?.getVariableMap) {
          const variableMap = workspaceRef.getVariableMap();
          variable =
            variableMap?.getVariable?.(name) ||
            variableMap?.getVariableByName?.(name) ||
            variableMap?.getAllVariables?.().find((item) => item.name === name) ||
            null;
        }
        if (!variable && workspaceRef?.createVariable) {
          variable = workspaceRef.createVariable(name);
        }
        if (!variable) return;
        lists.set(variable.getId(), normalizeItems(entry.items));
      });
      return;
    }

    // Backward compatibility: id -> items map
    Object.entries(data).forEach(([id, items]) => {
      if (!Array.isArray(items)) return;
      const variable = workspaceRef?.getVariableById?.(id);
      if (!variable) return;
      lists.set(variable.getId(), normalizeItems(items));
    });
  };

  return {
    ensureList,
    setItems,
    getItems,
    appendItem,
    updateItem,
    removeItem,
    removeList,
    getEntries,
    getIds,
    toJSON,
    fromJSON,
  };
})();

if (typeof Blockly !== 'undefined') {
  Blockly.edbbListStore = listStore;
}

const toPythonLiteral = (raw) => {
  const original = String(raw ?? '');
  const trimmed = original.trim();
  if (!trimmed) return null;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return trimmed;
  const lowered = trimmed.toLowerCase();
  if (lowered === 'true') return 'True';
  if (lowered === 'false') return 'False';
  if (lowered === 'none' || lowered === 'null') return 'None';
  const quoted =
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"));
  if (quoted) return trimmed;
  return JSON.stringify(original);
};

const buildListInitializationCode = (generator) => {
  if (!workspace) return '';
  const entries = listStore.getEntries();
  if (!entries.length) return '';
  if (!generator?.nameDB_) return '';
  const lines = [];
  entries.forEach(({ id, items }) => {
    const variable = workspace.getVariableById(id);
    if (!variable) return;
    const name = generator.nameDB_.getName(variable.name, Blockly.Names.VARIABLE_NAME);
    const serialized = items
      .map((item) => toPythonLiteral(item))
      .filter((item) => item !== null);
    lines.push(`${name} = [${serialized.join(', ')}]`);
  });
  return lines.join('\n');
};

const ensureListGenerator = (() => {
  let patched = false;
  return () => {
    if (patched || !Blockly?.Python?.finish) return;
    const originalFinish = Blockly.Python.finish;
    Blockly.Python.finish = function (code) {
      const listInit = buildListInitializationCode(this);
      if (listInit) {
        this.definitions_['edbb_list_init'] = listInit;
      } else if (this.definitions_) {
        delete this.definitions_['edbb_list_init'];
      }
      return originalFinish.call(this, code);
    };
    patched = true;
  };
})();

Blockly.Blocks['custom_python_code'] = {
  init: function () {
    this.appendDummyInput().appendField('🐍 Pythonコード実行');
    this.appendDummyInput().appendField(
      new FieldMultilineInput("print('Hello World')"),
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

  // blocks.js has already extended the global Blockly object
  // Just ensure Python.INDENT is set
  if (!Blockly.Python.INDENT) {
    Blockly.Python.INDENT = '    ';
  }

  return { modernLightTheme, modernDarkTheme };
};

const html = document.documentElement;
const isMobileDevice =
  typeof window !== 'undefined' && window.innerWidth < 768;
if (isMobileDevice) {
  html.classList.add('is-mobile');
}

const applyMobileToolboxIcons = (toolboxEl) => {
  if (!isMobileDevice || !toolboxEl) return;
  const categories = toolboxEl.querySelectorAll('category');
  categories.forEach((cat) => {
    const icon = cat.getAttribute('data-icon');
    if (icon) {
      const currentName = cat.getAttribute('name') || '';
      cat.setAttribute('data-label', currentName);
      cat.setAttribute('name', icon);
    }
  });
};

// --- Code Generation & UI Sync ---
const generatePythonCode = () => {
  if (!workspace) return '';
  let rawCode = Blockly.Python.workspaceToCode(workspace);

  // --- Event Handlers for Dynamic Components ---
  let componentEvents = '';
  let modalEvents = '';

  // Parse raw code to extract event handlers
  const lines = rawCode.split('\n');
  let filteredLines = [];
  let currentEventName = null;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (line.includes('# BUTTON_EVENT:')) {
      currentEventName = line.split(':')[1].trim();
      componentEvents += `            if interaction.data.get('custom_id') == '${currentEventName}':\n                await on_button_${currentEventName}(interaction)\n`;
      filteredLines.push(line); // Keep definition
    } else if (line.includes('# MODAL_EVENT:')) {
      currentEventName = line.split(':')[1].trim();
      modalEvents += `            if interaction.data.get('custom_id') == '${currentEventName}':\n                await on_modal_${currentEventName}(interaction)\n`;
      filteredLines.push(line);
    } else {
      filteredLines.push(line);
    }
  }

  rawCode = filteredLines.join('\n');
  
  const hasComponentEvents = componentEvents.trim().length > 0;
  const hasModalEvents = modalEvents.trim().length > 0;

  if (!componentEvents.trim()) componentEvents = '            pass';
  if (!modalEvents.trim()) modalEvents = '            pass';

  // --- Dependency Analysis ---
  const usesJson = rawCode.includes('_load_json_data') || rawCode.includes('_save_json_data') || rawCode.includes('json.');
  const usesModal = rawCode.includes('EasyModal');
  const usesRandom = rawCode.includes('random.');
  const usesAsyncio = rawCode.includes('asyncio.');
  const usesDatetime = rawCode.includes('datetime.');
  const usesMath = rawCode.includes('math.');

  // Build the final code
  let finalCode = `# Easy Discord Bot Builderによって作成されました！ 製作：@himais0giiiin
# Created with Easy Discord Bot Builder! created by @himais0giiiin!
# Optimized Version

import discord
from discord import app_commands
from discord.ext import commands
`;

  if (usesRandom) finalCode += 'import random\n';
  if (usesJson) finalCode += 'import json\n';
  if (usesAsyncio) finalCode += 'import asyncio\n';
  if (usesDatetime) finalCode += 'import datetime\n';
  if (usesMath) finalCode += 'import math\n';

  finalCode += `
intents = discord.Intents.default()
intents.message_content = True
intents.members = True
intents.voice_states = True

# Botの作成
bot = commands.Bot(command_prefix='!', intents=intents)

# ----------------------------

# --- ユーザー作成部分 ---

${rawCode}

# ----------------------------

if __name__ == "__main__":
    # Token check
    
    print('\\x1b[31m!!!!注意!!!! トークンを設定していない場合は、実行前にコードの最後にある"TOKEN"部分にトークンを記述してください。\\x1b[0m')
    print('\\x1b[31m!!!!Warning!!!! If you have not set a token, please set the token in the "TOKEN" section at the end of the code before running it.\\x1b[0m')
    # トークン設定後は注意を削除しても問題ありません / After setting the token, you may safely remove this check.

    bot.run("TOKEN")
`;
  return finalCode;
};

const setupListManager = ({ workspace, storage, shareFeature, workspaceContainer }) => {
  const panel = document.createElement('div');
  panel.id = 'listPanel';
  panel.className = 'hidden';
  
  const header = document.createElement('div');
  header.className = 'list-panel__header';
  header.textContent = 'リスト管理';
  panel.appendChild(header);

  const body = document.createElement('div');
  body.className = 'list-panel__body';
  panel.appendChild(body);

  workspaceContainer.appendChild(panel);

  const scheduleListSave = () => {
    storage?.save();
  };

  const renderListPanel = () => {
    body.innerHTML = '';
    const entries = listStore.getEntries();

    if (!entries.length) {
      panel.classList.add('hidden');
      return;
    }

    panel.classList.remove('hidden');
    entries.forEach(({ id, items }) => {
      const variable = workspace.getVariableById(id);
      if (!variable) return;

      const card = document.createElement('div');
      card.className = 'list-panel__list';
      card.dataset.listId = id;

      const cardHeader = document.createElement('div');
      cardHeader.className = 'list-panel__list-header';
      const name = document.createElement('span');
      name.className = 'list-panel__list-name';
      name.textContent = variable.name;
      cardHeader.appendChild(name);

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'list-panel__list-delete';
      deleteBtn.type = 'button';
      deleteBtn.textContent = '削除';
      deleteBtn.addEventListener('click', () => {
        const confirmed = window.confirm(`リスト「${variable.name}」を削除しますか？`);
        if (!confirmed) return;
        if (typeof workspace.deleteVariableById === 'function') {
          workspace.deleteVariableById(id);
        } else if (typeof workspace.deleteVariable === 'function') {
          workspace.deleteVariable(variable);
        }
        listStore.removeList(id);
        renderListPanel();
        scheduleListSave();
      });
      cardHeader.appendChild(deleteBtn);
      card.appendChild(cardHeader);

      const itemList = document.createElement('div');
      itemList.className = 'list-panel__items';

      items.forEach((item, index) => {
        const row = document.createElement('div');
        row.className = 'list-panel__item';

        const indexLabel = document.createElement('span');
        indexLabel.className = 'list-panel__item-index';
        indexLabel.textContent = String(index + 1);

        const input = document.createElement('input');
        input.className = 'list-panel__item-input';
        input.type = 'text';
        input.value = item;
        input.addEventListener('input', () => {
          listStore.updateItem(id, index, input.value);
          scheduleListSave();
        });

        const removeBtn = document.createElement('button');
        removeBtn.className = 'list-panel__item-remove';
        removeBtn.type = 'button';
        removeBtn.textContent = '×';
        removeBtn.addEventListener('click', () => {
          listStore.removeItem(id, index);
          renderListPanel();
          scheduleListSave();
        });

        row.appendChild(indexLabel);
        row.appendChild(input);
        row.appendChild(removeBtn);
        itemList.appendChild(row);
      });

      card.appendChild(itemList);

      const addBtn = document.createElement('button');
      addBtn.className = 'list-panel__item-add';
      addBtn.type = 'button';
      addBtn.textContent = '+ 追加';
      addBtn.addEventListener('click', () => {
        listStore.appendItem(id, '');
        renderListPanel();
        scheduleListSave();
        const latestInput = panel.querySelector(
          `[data-list-id="${id}"] .list-panel__item:last-child input`,
        );
        latestInput?.focus();
      });
      card.appendChild(addBtn);
      body.appendChild(card);
    });
  };

  const promptForListName = (callback) => {
    const defaultName = 'list';
    if (typeof Blockly.prompt === 'function') {
      Blockly.prompt('リスト名を入力してください', defaultName, (name) => callback(name));
    } else {
      callback(window.prompt('リスト名を入力してください', defaultName));
    }
  };

  const handleCreateList = () => {
    promptForListName((name) => {
      if (!name) return;
      const variable = workspace.createVariable(name);
      if (!variable) return;
      listStore.ensureList(variable.getId());
      renderListPanel();
      scheduleListSave();
    });
  };

  workspace.registerButtonCallback('CREATE_LIST_BUTTON', handleCreateList);

  const originalGetExtraState = workspace.getExtraState?.bind(workspace);
  const originalSetExtraState = workspace.setExtraState?.bind(workspace);

  workspace.getExtraState = () => {
    const base = originalGetExtraState ? originalGetExtraState() : {};
    const safeBase = base && typeof base === 'object' ? base : {};
    return { ...safeBase, [LIST_STORE_KEY]: listStore.toJSON(workspace) };
  };

  workspace.setExtraState = (state) => {
    if (originalSetExtraState) originalSetExtraState(state);
    listStore.fromJSON(state?.[LIST_STORE_KEY], workspace);
    renderListPanel();
  };

  workspace.addChangeListener((event) => {
    if (event.type === Blockly.Events.VAR_DELETE) {
      listStore.removeList(event.varId);
      renderListPanel();
      scheduleListSave();
    }
    if (event.type === Blockly.Events.VAR_RENAME) {
      renderListPanel();
      scheduleListSave();
    }
  });

  renderListPanel();

  return { renderListPanel, scheduleListSave };
};

const initializeApp = async () => {
  lucide.createIcons();
  const { modernLightTheme, modernDarkTheme } = setupBlocklyEnvironment();

  const blocklyDiv = document.getElementById('blocklyDiv');
  const toolbox = document.getElementById('toolbox');
  const themeToggle = document.getElementById('themeToggle');
  const headerActions = document.getElementById('headerActions');
  const mobileHeaderToggle = document.getElementById('mobileHeaderToggle');
  // ヘッダーのコード生成ボタン
  const showCodeBtn = document.getElementById('showCodeBtn');
  // モーダル関連
  const codeModal = document.getElementById('codeModal');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const codeOutput = document.getElementById('codeOutput');
  const copyCodeBtn = document.getElementById('copyCodeBtn');

  const importBtn = document.getElementById('importBtn');
  const exportBtn = document.getElementById('exportBtn');
  const importInput = document.getElementById('importInput');
  const workspaceContainer = document.getElementById('workspace-container');
  const layoutBlockBtn = document.getElementById('layoutBlockBtn');
  const layoutSplitBtn = document.getElementById('layoutSplitBtn');
  const projectTitleInput = document.getElementById('projectTitleInput');
  const initialScale = isMobileDevice ? 0.85 : 1.0;
  const maxScale = isMobileDevice ? 2.2 : 3;
  const minScale = isMobileDevice ? 0.5 : 0.3;

  const resolveProjectTitle = () =>
    (projectTitleInput?.value || '').trim() || WorkspaceStorage.DEFAULT_TITLE;

  const hydrateProjectTitle = () => {
    if (!projectTitleInput) return;
    try {
      const storedTitle = localStorage.getItem(PROJECT_TITLE_STORAGE_KEY);
      if (storedTitle) {
        projectTitleInput.value = storedTitle;
        return;
      }
    } catch (error) {
      // localStorage unavailable; fall back to default
    }
    if (!projectTitleInput.value) {
      projectTitleInput.value = WorkspaceStorage.DEFAULT_TITLE;
    }
  };

  hydrateProjectTitle();

  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') html.classList.add('dark');
  const initialTheme = savedTheme === 'dark' ? modernDarkTheme : modernLightTheme;
  applyMobileToolboxIcons(toolbox);

  // --- パレット固定化の強制適用 (Zoom Fix) ---
  // フライアウト（パレット）のスケールを常に1に固定するオーバーライド
  Blockly.VerticalFlyout.prototype.getFlyoutScale = function () {
    return isMobileDevice ? 0.9 : 1;
  };

  // --- Blocklyワークスペースの初期化 ---
  workspace = Blockly.inject(blocklyDiv, {
    toolbox: toolbox,
    horizontalLayout: false,
    trashcan: true,
    zoom: {
      controls: true,
      wheel: true,
      startScale: initialScale,
      maxScale,
      minScale,
      scaleSpeed: 1.2,
    },
    renderer: 'zelos',
    theme: initialTheme,
  });

  // --- ワークスペース保存クラスの初期化 ---
  storage = new WorkspaceStorage(workspace);
  storage.setTitleProvider(() => resolveProjectTitle());

  if (projectTitleInput) {
    projectTitleInput.addEventListener('input', () => {
      try {
        localStorage.setItem(PROJECT_TITLE_STORAGE_KEY, resolveProjectTitle());
      } catch (error) {
        // ignore storage errors
      }
    });
  }

  // --- Blocklyのブロック定義 ---
  const shareFeature = initShareFeature({
    workspace,
    storage,
  });
  setupListManager({
    workspace,
    storage,
    shareFeature,
    workspaceContainer,
  });
  if (isMobileDevice && headerActions && mobileHeaderToggle) {
    mobileHeaderToggle.classList.remove('hidden');
    let headerExpanded = false;
    const syncHeaderVisibility = () => {
      headerActions.classList.toggle('collapsed', !headerExpanded);
      mobileHeaderToggle.setAttribute('aria-expanded', headerExpanded ? 'true' : 'false');
      const label = mobileHeaderToggle.querySelector('#mobileHeaderToggleText');
      if (label) label.textContent = headerExpanded ? '操作を閉じる' : '操作を表示';
      const icon = mobileHeaderToggle.querySelector('svg');
      if (icon) icon.style.transform = headerExpanded ? 'rotate(180deg)' : 'rotate(0deg)';
      if (workspace) {
        setTimeout(() => Blockly.svgResize(workspace), 150);
      }
    };
    syncHeaderVisibility();
    mobileHeaderToggle.addEventListener('click', () => {
      headerExpanded = !headerExpanded;
      syncHeaderVisibility();
    });
  } else if (headerActions) {
    headerActions.classList.remove('collapsed');
  }

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
    if (workspace) {
      setTimeout(() => Blockly.svgResize(workspace), 450);
    }
  };

  layoutBlockBtn.addEventListener('click', () => setLayout('block'));
  layoutSplitBtn.addEventListener('click', () => setLayout('split'));

  // Live Preview Sync
  const liveCodeOutput = document.getElementById('codePreviewContent');
  workspace.addChangeListener((e) => {
    if (
      workspaceContainer.classList.contains('split-view') &&
      !e.isUiEvent &&
      liveCodeOutput
    ) {
      liveCodeOutput.textContent = generatePythonCode();
      hljs.highlightElement(liveCodeOutput);
    }

    // Auto-save
    if (
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

  // --- Plugin System ---
  const pluginManager = new PluginManager(workspace);
  const pluginUI = new PluginUI(pluginManager);
  await pluginManager.init();

  // --- Load Saved Data ---
  const sharedApplied = shareFeature.applySharedLayoutFromQuery();
  if (!sharedApplied) {
    storage?.load();
  }

  const toggleTheme = () => {
    const currentTheme = html.classList.contains('dark') ? 'dark' : 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    html.classList.remove(currentTheme);
    html.classList.add(newTheme);
    localStorage.setItem('theme', newTheme);
    if (workspace) {
      workspace.setTheme(newTheme === 'dark' ? modernDarkTheme : modernLightTheme);
    }
    // Re-apply share view UI state (e.g. hide toolbox)
    if (shareFeature.isShareViewMode()) {
      shareFeature.applyUiState();
    }
  };

  themeToggle.addEventListener('click', toggleTheme);

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
  const toggleModal = (modal, isOpen) => {
    if (isOpen) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      // Force reflow
      void modal.offsetWidth;
      modal.classList.add('show-modal');
    } else {
      modal.classList.remove('show-modal');
      setTimeout(() => {
        modal.classList.remove('flex');
        modal.classList.add('hidden');
      }, 300); // Wait for transition
    }
  };

  showCodeBtn.addEventListener('click', () => {
    showCodeBtn.blur();
    // Blocklyの選択ハイライトなどを解除
    if (workspace) Blockly.hideChaff();
    codeOutput.textContent = generatePythonCode();
    toggleModal(codeModal, true);
  });

  closeModalBtn.addEventListener('click', () => {
    toggleModal(codeModal, false);
  });

  // Backdrop click to close
  codeModal.addEventListener('click', (e) => {
    if (e.target === codeModal) toggleModal(codeModal, false);
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

// Initialize app when DOM is ready and all modules are loaded
// Use a small delay to ensure all module imports are complete
const startApp = () => {
  // Ensure Blockly is fully initialized with custom blocks
  if (typeof Blockly === 'undefined' || !Blockly.Blocks || !Blockly.Python) {
    // If Blockly is not ready, retry after a short delay
    setTimeout(startApp, 100);
    return;
  }
  
  // Verify custom blocks are registered
  if (!Blockly.Blocks['on_ready']) {
    // Custom blocks not yet registered, retry
    setTimeout(startApp, 100);
    return;
  }
  
  // All systems ready, initialize the app
  initializeApp();
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    // Add a small delay to ensure module imports are complete
    setTimeout(startApp, 50);
  });
} else {
  // DOM already loaded, start app with delay
  setTimeout(startApp, 50);
}

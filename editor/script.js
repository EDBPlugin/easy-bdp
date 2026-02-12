// Note: blocks.js modifies the global Blockly object directly
// We import it to ensure it's loaded and executed
// blocks.js is loaded dynamically in startApp

import WorkspaceStorage from './storage.js';
import { initShareFeature } from "./share.js";
import { PluginManager } from "./plugin.js";
import { PluginUI } from "./plugin-ui.js";

const PROJECT_TITLE_STORAGE_KEY = 'edbb_project_title';

let workspace;
let storage;

const LIST_STORE_KEY = 'edbb_list_store';
const JSON_DATA_STORE_KEY = 'edbb_json_store';
const JSON_GUI_DATASET_LOCAL_KEY = 'edbb_json_gui_dataset_store_v1';

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

const toPythonJsonLiteral = (value) => {
  if (value === null) return 'None';
  if (Array.isArray(value)) {
    return `[${value.map((item) => toPythonJsonLiteral(item)).join(', ')}]`;
  }
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '0';
  if (typeof value === 'boolean') return value ? 'True' : 'False';
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).map(
      ([key, item]) => `${JSON.stringify(key)}: ${toPythonJsonLiteral(item)}`,
    );
    return `{${entries.join(', ')}}`;
  }
  return 'None';
};

const jsonDataStore = (() => {
  const ALLOWED_TYPES = new Set(['string', 'number', 'boolean', 'null', 'object', 'array']);
  let datasets = new Map();

  const normalizeName = (name) => String(name ?? '').trim();
  const normalizeType = (type) => (ALLOWED_TYPES.has(type) ? type : 'string');
  const normalizeRow = (row) => ({
    key: String(row?.key ?? '').trim(),
    type: normalizeType(String(row?.type ?? 'string')),
    value: String(row?.value ?? ''),
  });
  const normalizeRows = (rows) => (Array.isArray(rows) ? rows.map((row) => normalizeRow(row)) : []);
  const cloneRows = (rows) => normalizeRows(rows);

  const setRows = (name, rows) => {
    const normalizedName = normalizeName(name);
    if (!normalizedName) return false;
    datasets.set(normalizedName, normalizeRows(rows));
    return true;
  };

  const getRows = (name) => cloneRows(datasets.get(normalizeName(name)) || []);

  const createDataset = (name, rows = []) => {
    const normalizedName = normalizeName(name);
    if (!normalizedName || datasets.has(normalizedName)) return false;
    datasets.set(normalizedName, normalizeRows(rows));
    return true;
  };

  const hasDataset = (name) => datasets.has(normalizeName(name));

  const renameDataset = (fromName, toName) => {
    const from = normalizeName(fromName);
    const to = normalizeName(toName);
    if (!from || !to || !datasets.has(from)) return false;
    if (from !== to && datasets.has(to)) return false;
    const rows = datasets.get(from) || [];
    datasets.delete(from);
    datasets.set(to, cloneRows(rows));
    return true;
  };

  const removeDataset = (name) => {
    const normalizedName = normalizeName(name);
    if (!normalizedName) return false;
    return datasets.delete(normalizedName);
  };

  const appendRow = (name, row = {}) => {
    const normalizedName = normalizeName(name);
    if (!normalizedName) return false;
    const rows = getRows(normalizedName);
    rows.push(normalizeRow(row));
    datasets.set(normalizedName, rows);
    return true;
  };

  const updateRow = (name, index, patch = {}) => {
    const normalizedName = normalizeName(name);
    if (!normalizedName) return false;
    const rows = getRows(normalizedName);
    if (index < 0 || index >= rows.length) return false;
    rows[index] = normalizeRow({ ...rows[index], ...patch });
    datasets.set(normalizedName, rows);
    return true;
  };

  const removeRow = (name, index) => {
    const normalizedName = normalizeName(name);
    if (!normalizedName) return false;
    const rows = getRows(normalizedName);
    if (index < 0 || index >= rows.length) return false;
    rows.splice(index, 1);
    datasets.set(normalizedName, rows);
    return true;
  };

  const parseBoolean = (rawValue) => {
    const lowered = String(rawValue ?? '')
      .trim()
      .toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(lowered)) return { value: true, error: null };
    if (['false', '0', 'no', 'off'].includes(lowered)) return { value: false, error: null };
    return { value: false, error: '真偽値は true / false で入力してください' };
  };

  const parseJsonStructure = (rawValue, expected) => {
    const fallback = expected === 'array' ? '[]' : '{}';
    const source = String(rawValue ?? '').trim() || fallback;
    try {
      const parsed = JSON.parse(source);
      if (expected === 'array' && !Array.isArray(parsed)) {
        return { value: [], error: '値はJSON配列で入力してください' };
      }
      if (expected === 'object' && (!parsed || Array.isArray(parsed) || typeof parsed !== 'object')) {
        return { value: {}, error: '値はJSONオブジェクトで入力してください' };
      }
      return { value: parsed, error: null };
    } catch (error) {
      return {
        value: expected === 'array' ? [] : {},
        error: expected === 'array' ? 'JSON配列の形式が不正です' : 'JSONオブジェクトの形式が不正です',
      };
    }
  };

  const buildDatasetData = (name) => {
    const normalizedName = normalizeName(name);
    const rows = datasets.get(normalizedName) || [];
    const data = {};
    const errors = [];

    rows.forEach((row, index) => {
      const key = normalizeName(row.key);
      const type = normalizeType(row.type);
      const valueText = String(row.value ?? '');

      if (!key) {
        errors.push(`${index + 1}行目: キーが空です`);
        return;
      }

      let value = valueText;
      let error = null;

      if (type === 'number') {
        const parsed = Number(valueText);
        if (Number.isFinite(parsed)) {
          value = parsed;
        } else {
          value = 0;
          error = '数値の形式が不正です';
        }
      } else if (type === 'boolean') {
        const parsed = parseBoolean(valueText);
        value = parsed.value;
        error = parsed.error;
      } else if (type === 'null') {
        value = null;
      } else if (type === 'object') {
        const parsed = parseJsonStructure(valueText, 'object');
        value = parsed.value;
        error = parsed.error;
      } else if (type === 'array') {
        const parsed = parseJsonStructure(valueText, 'array');
        value = parsed.value;
        error = parsed.error;
      }

      if (error) {
        errors.push(`${index + 1}行目 (${key}): ${error}`);
      }

      data[key] = value;
    });

    return { data, errors };
  };

  const toPythonLiteral = (name) => {
    const { data } = buildDatasetData(name);
    return toPythonJsonLiteral(data);
  };

  const getDatasetNames = () => Array.from(datasets.keys());

  const toJSON = () => ({
    datasets: getDatasetNames().map((name) => ({
      name,
      rows: getRows(name),
    })),
  });

  const fromJSON = (state) => {
    datasets = new Map();
    if (!state || typeof state !== 'object') return;

    if (Array.isArray(state.datasets)) {
      state.datasets.forEach((entry) => {
        const name = normalizeName(entry?.name);
        if (!name) return;
        datasets.set(name, normalizeRows(entry?.rows));
      });
      return;
    }

    Object.entries(state).forEach(([name, rows]) => {
      const normalizedName = normalizeName(name);
      if (!normalizedName) return;
      datasets.set(normalizedName, normalizeRows(rows));
    });
  };

  return {
    hasDataset,
    createDataset,
    renameDataset,
    removeDataset,
    getDatasetNames,
    getRows,
    setRows,
    appendRow,
    updateRow,
    removeRow,
    buildDatasetData,
    toPythonLiteral,
    toJSON,
    fromJSON,
  };
})();

// listStore assignment moved to initializeApp


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



const setupBlocklyEnvironment = () => {
  // Define custom blocks (moved from top-level to safe scope)
  if (!Blockly.Blocks['custom_python_code']) {
    Blockly.Blocks['custom_python_code'] = {
      init: function () {
        this.appendDummyInput().appendField('🐍 Pythonコード実行');
        // Check for FieldMultilineInput availability
        const FieldMultiline = (typeof FieldMultilineInput !== 'undefined')
          ? FieldMultilineInput
          : (Blockly.FieldMultilineInput || Blockly.FieldTextInput);

        this.appendDummyInput().appendField(
          new FieldMultiline("print('Hello World')"),
          'CODE',
        );
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(60);
        this.setTooltip('任意のPythonコードをここに記述して実行させます。');
      },
    };
  }


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
  // Keep indentation width fixed so generated function bodies are consistent.
  Blockly.Python.INDENT = '    ';

  return { modernLightTheme, modernDarkTheme };
};

const PRIMITIVE_LITERAL_INPUT_CHECKS = new Set(['String', 'Number']);

const getLiteralShadowTypeForChecks = (checks) => {
  const normalized = (Array.isArray(checks) ? checks : [checks]).filter(Boolean);
  if (!normalized.length) return null;
  const uniqueChecks = [...new Set(normalized)];
  if (uniqueChecks.some((check) => !PRIMITIVE_LITERAL_INPUT_CHECKS.has(check))) {
    return null;
  }
  if (uniqueChecks.includes('Number')) {
    return 'math_number';
  }
  return 'text';
};

const createLiteralShadowBlock = (workspaceRef, blockType) => {
  if (!workspaceRef || !blockType) return null;
  const shadow = workspaceRef.newBlock(blockType);
  shadow.setShadow(true);
  if (blockType === 'math_number') {
    shadow.setFieldValue('0', 'NUM');
  }
  if (blockType === 'text') {
    shadow.setFieldValue('', 'TEXT');
  }
  if (workspaceRef.rendered) {
    shadow.initSvg?.();
    shadow.render?.();
  }
  return shadow;
};

const ensureLiteralShadowForInput = (block, input) => {
  const valueInputType = Blockly.inputTypes?.VALUE ?? Blockly.INPUT_VALUE;
  if (!input || input.type !== valueInputType) return;
  const connection = input.connection;
  if (!connection || connection.targetConnection) return;
  const blockType = getLiteralShadowTypeForChecks(connection.getCheck?.() || null);
  if (!blockType) return;
  const shadow = createLiteralShadowBlock(block.workspace, blockType);
  if (!shadow?.outputConnection) return;
  try {
    connection.connect(shadow.outputConnection);
  } catch (error) {
    shadow.dispose(false, true);
  }
};

const ensureLiteralShadowsForBlock = (block) => {
  if (!block || block.isShadow?.() || block.isInsertionMarker?.()) return;
  if (block.workspace?.isFlyout) return;
  block.inputList?.forEach((input) => ensureLiteralShadowForInput(block, input));
};

const ensureLiteralShadowsForWorkspace = (workspaceRef) => {
  workspaceRef?.getAllBlocks(false).forEach((block) => ensureLiteralShadowsForBlock(block));
};

const setupLiteralInputAutofill = (workspaceRef) => {
  if (!workspaceRef) return;

  const queueBlockCheck = (blockId) => {
    if (!blockId) return;
    setTimeout(() => {
      const block = workspaceRef.getBlockById(blockId);
      ensureLiteralShadowsForBlock(block);
    }, 0);
  };

  workspaceRef.addChangeListener((event) => {
    if (!event || event.isUiEvent) return;
    if (event.type === Blockly.Events.FINISHED_LOADING) {
      ensureLiteralShadowsForWorkspace(workspaceRef);
      return;
    }
    if (event.type === Blockly.Events.BLOCK_CREATE) {
      (event.ids || []).forEach((id) => queueBlockCheck(id));
      return;
    }
    if (event.type === Blockly.Events.BLOCK_MOVE) {
      queueBlockCheck(event.blockId);
      queueBlockCheck(event.newParentId);
      queueBlockCheck(event.oldParentId);
      return;
    }
    if (event.type === Blockly.Events.BLOCK_CHANGE) {
      queueBlockCheck(event.blockId);
    }
  });

  ensureLiteralShadowsForWorkspace(workspaceRef);
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

function extractInteractionEvents(code) {
  const source = String(code || '');
  const markerRegex = /^[ \t]*#\s*(BUTTON_EVENT|MODAL_EVENT)\s*:\s*(.+?)\s*$/gm;
  const componentIds = [];
  const modalIds = [];
  let match;

  while ((match = markerRegex.exec(source)) !== null) {
    const eventType = match[1];
    const customId = String(match[2] || '').trim();
    if (!customId) continue;
    if (eventType === 'BUTTON_EVENT') {
      if (!componentIds.includes(customId)) componentIds.push(customId);
    } else if (eventType === 'MODAL_EVENT') {
      if (!modalIds.includes(customId)) modalIds.push(customId);
    }
  }

  const cleanedCode = source
    .split('\n')
    .filter((line) => !/^[ \t]*#\s*(BUTTON_EVENT|MODAL_EVENT)\s*:/.test(line))
    .join('\n');

  const buildDispatchBody = (ids, prefix) => {
    if (!ids.length) return '';
    const lines = [`            custom_id = str((interaction.data or {}).get('custom_id', ''))`];
    ids.forEach((id, index) => {
      const escapedId = id.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      const keyword = index === 0 ? 'if' : 'elif';
      lines.push(`            ${keyword} custom_id == '${escapedId}':`);
      lines.push(`                await ${prefix}${id}(interaction)`);
    });
    return lines.join('\n');
  };

  const componentEvents = buildDispatchBody(componentIds, 'on_button_');
  const modalEvents = buildDispatchBody(modalIds, 'on_modal_');

  return {
    cleanedCode,
    componentEvents,
    modalEvents,
    hasComponentEvents: componentIds.length > 0,
    hasModalEvents: modalIds.length > 0,
  };
}

const extractInteractionEventsSafe = (code) => {
  if (typeof extractInteractionEvents === 'function') {
    return extractInteractionEvents(code);
  }
  if (typeof window !== 'undefined' && typeof window.extractInteractionEvents === 'function') {
    return window.extractInteractionEvents(code);
  }
  return {
    cleanedCode: String(code || ''),
    componentEvents: '',
    modalEvents: '',
    hasComponentEvents: false,
    hasModalEvents: false,
  };
};

const PYTHON_IDENTIFIER_PATTERN = (() => {
  try {
    return new RegExp('^[_\\p{L}][_\\p{L}\\p{N}]*$', 'u');
  } catch (error) {
    return /^[A-Za-z_][A-Za-z0-9_]*$/;
  }
})();

const isPythonIdentifierLike = (value) => PYTHON_IDENTIFIER_PATTERN.test(String(value ?? ''));

const COMMAND_VALIDATION_RULES = {
  on_command_executed: {
    label: 'スラッシュコマンド',
    normalize: (rawName) => String(rawName ?? '').trim().toLowerCase(),
    invalidMessage:
      'このエディターではコマンド名を Python の関数名にも使うため、先頭は文字または_、以降は文字/数字/_のみ使用できます。',
  },
  prefix_command: {
    label: 'プレフィックスコマンド',
    normalize: (rawName) => String(rawName ?? '').trim().replace(/^[!~#&?]/, ''),
    invalidMessage:
      'このエディターではコマンド名を Python の関数名にも使うため、先頭は文字または_、以降は文字/数字/_のみ使用できます。',
  },
};

const formatBlockRef = (block) => {
  const shortId = String(block?.id || '').slice(0, 8);
  return shortId ? `ブロックID: ${shortId}` : 'ブロックID不明';
};

const analyzeWorkspaceForCodegen = (workspaceRef) => {
  if (!workspaceRef) return [];

  const diagnostics = [];
  const commandRegistry = new Map();
  const handlerRegistry = new Map();

  workspaceRef.getAllBlocks(false).forEach((block) => {
    if (!block || block.isShadow?.()) return;
    if (typeof block.isEnabled === 'function' && !block.isEnabled()) return;

    const rule = COMMAND_VALIDATION_RULES[block.type];
    if (!rule) return;

    const rawName = block.getFieldValue('COMMAND_NAME');
    const normalizedName = rule.normalize(rawName);
    const blockRef = formatBlockRef(block);
    const shownName = normalizedName || '(空)';

    if (!normalizedName) {
      diagnostics.push({
        blockId: block.id,
        message: `${rule.label}名が空です。${blockRef}`,
      });
      return;
    }

    if (!isPythonIdentifierLike(normalizedName)) {
      diagnostics.push({
        blockId: block.id,
        message: `${rule.label}名「${shownName}」は無効です。${rule.invalidMessage} ${blockRef}`,
      });
      return;
    }

    const commandKey = `${block.type}:${normalizedName}`;
    const firstRegisteredCommand = commandRegistry.get(commandKey);
    if (firstRegisteredCommand) {
      diagnostics.push({
        blockId: block.id,
        message: `${rule.label}名「${shownName}」が重複しています。${formatBlockRef(firstRegisteredCommand.block)} / ${blockRef}`,
      });
    } else {
      commandRegistry.set(commandKey, { block, normalizedName });
    }

    const handlerName = `${normalizedName}_cmd`;
    const firstRegisteredHandler = handlerRegistry.get(handlerName);
    if (firstRegisteredHandler && firstRegisteredHandler.block.id !== block.id) {
      diagnostics.push({
        blockId: block.id,
        message: `Python側の関数名「${handlerName}」が重複します。${formatBlockRef(firstRegisteredHandler.block)} / ${blockRef}`,
      });
    } else {
      handlerRegistry.set(handlerName, { block, handlerName });
    }
  });

  return diagnostics;
};

// --- Code Generation & UI Sync ---
const buildInlineRuntimeHelpers = ({ usesJson, usesModal, usesLogging }) => {
  let helpers = '';

  if (usesLogging) {
    helpers += `logging.basicConfig(level = logging.INFO, format = '%(asctime)s - %(levelname)s - %(message)s')\n\n`;
  }

  if (usesJson) {
    helpers += `def _load_json_data(filename):\n`;
    helpers += `    if not os.path.exists(filename):\n`;
    helpers += `        return {}\n`;
    helpers += `    try:\n`;
    helpers += `        with open(filename, 'r', encoding = 'utf-8') as f:\n`;
    helpers += `            return json.load(f)\n`;
    helpers += `    except Exception as e:\n`;
    helpers += `        logging.error(f"JSON Load Error: {e}")\n`;
    helpers += `        return {}\n\n`;
    helpers += `def _save_json_data(filename, data):\n`;
    helpers += `    try:\n`;
    helpers += `        with open(filename, 'w', encoding = 'utf-8') as f:\n`;
    helpers += `            json.dump(data, f, ensure_ascii = False, indent = 4)\n`;
    helpers += `    except Exception as e:\n`;
    helpers += `        logging.error(f"JSON Save Error: {e}")\n\n`;
    helpers += `def _save_json_dataset_cache():\n`;
    helpers += `    _cache = globals().get('_edbb_json_dataset_cache', {})\n`;
    helpers += `    _files = globals().get('_edbb_json_dataset_files', {})\n`;
    helpers += `    if not isinstance(_cache, dict) or not isinstance(_files, dict):\n`;
    helpers += `        return\n`;
    helpers += `    for _dataset_name, _dataset_data in _cache.items():\n`;
    helpers += `        _filename = _files.get(_dataset_name)\n`;
    helpers += `        if not _filename:\n`;
    helpers += `            continue\n`;
    helpers += `        _save_json_data(_filename, _dataset_data)\n\n`;
  }

  if (usesModal) {
    helpers += `class EasyModal(discord.ui.Modal):\n`;
    helpers += `    def __init__(self, title, custom_id, inputs):\n`;
    helpers += `        super().__init__(title = title, timeout = None, custom_id = custom_id)\n`;
    helpers += `        for item in inputs:\n`;
    helpers += `            self.add_item(discord.ui.TextInput(label = item['label'], custom_id = item['id']))\n\n`;
  }

  return helpers.trim();
};

const generatePythonCode = () => {
  if (!workspace) return '';
  const rawCode = Blockly.Python.workspaceToCode(workspace);
  const {
    cleanedCode,
    hasComponentEvents,
    hasModalEvents,
  } = extractInteractionEventsSafe(rawCode);
  const bodyCode = cleanedCode;

  // --- Dependency Analysis ---
  const usesJson =
    bodyCode.includes('_load_json_data') ||
    bodyCode.includes('_save_json_data') ||
    bodyCode.includes('_save_json_dataset_cache') ||
    bodyCode.includes('json.');
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
    'import os',
  ];
  if (needInteractionHandler || usesModal || bodyCode.includes('discord.ui')) imports.push('from discord import ui');
  if (usesRandom) imports.push('import random');
  if (usesAsyncio) imports.push('import asyncio');
  if (usesDatetime) imports.push('import datetime');
  if (usesMath) imports.push('import math');
  if (usesJson) {
    imports.push('import json');
  }
  if (usesLogging) imports.push('import logging');

  const header = imports.join('\n');
  const inlineHelpers = buildInlineRuntimeHelpers({ usesJson, usesModal, usesLogging });
  const helperSection = inlineHelpers ? `\n${inlineHelpers}\n` : '';

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

# ----------------------------

# --- ユーザー作成部分 ---
${helperSection}
${bodyCode}
# --------------------------

if __name__ == "__main__":
    # トークンの設定
    # Set your token here
    token = "TOKEN"

    # Token check
    token = os.getenv("DISCORD_TOKEN", token) # 環境変数DISCORD_TOKENがあればそちらを優先 (If DISCORD_TOKEN environment variable is set, it will be used)
    if token == "TOKEN":
        print('\\x1b[31m!!!!注意!!!! トークンを設定していない場合は、環境変数DISCORD_TOKENを設定するか、上のtoken変数を書き換えてください。\\x1b[0m')
        print('\\x1b[31m!!!!Warning!!!! If you have not set a token, please set the DISCORD_TOKEN environment variable or replace the token variable above.\\x1b[0m')
        exit(1)

    bot.run(token)
`;

  return fullBoiler.trim();
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

const setupJsonDataManager = ({ workspace, storage, shareFeature }) => {
  const modal = document.getElementById('jsonGuiModal');
  const openBtn = document.getElementById('jsonGuiBtn');
  const closeBtn = document.getElementById('jsonGuiModalClose');
  const cancelBtn = document.getElementById('jsonGuiCloseBtn');
  const datasetSelect = document.getElementById('jsonGuiDatasetSelect');
  const addDatasetBtn = document.getElementById('jsonGuiAddDatasetBtn');
  const renameDatasetBtn = document.getElementById('jsonGuiRenameDatasetBtn');
  const deleteDatasetBtn = document.getElementById('jsonGuiDeleteDatasetBtn');
  const rowsBody = document.getElementById('jsonGuiRows');
  const addRowBtn = document.getElementById('jsonGuiAddRowBtn');
  const preview = document.getElementById('jsonGuiPreview');
  const errorLabel = document.getElementById('jsonGuiError');

  let selectedDataset = '';
  let closeTimer = null;
  let autoSaveTimer = null;
  let hasPendingAutoSave = false;

  const readJsonDatasetLocalState = () => {
    try {
      const raw = localStorage.getItem(JSON_GUI_DATASET_LOCAL_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (error) {
      return null;
    }
  };

  const persistJsonDatasetLocalState = () => {
    try {
      localStorage.setItem(JSON_GUI_DATASET_LOCAL_KEY, JSON.stringify(jsonDataStore.toJSON()));
    } catch (error) {
      // ignore storage write failures
    }
  };

  const flushAutoSave = () => {
    if (!hasPendingAutoSave) return;
    hasPendingAutoSave = false;
    persistJsonDatasetLocalState();
    storage?.save?.();
  };

  const scheduleSave = () => {
    hasPendingAutoSave = true;
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
      autoSaveTimer = null;
      flushAutoSave();
    }, 250);
  };

  const saveNow = () => {
    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer);
      autoSaveTimer = null;
    }
    persistJsonDatasetLocalState();
    flushAutoSave();
  };

  const resolveDatasetSelection = () => {
    const names = jsonDataStore.getDatasetNames();
    if (!names.length) {
      selectedDataset = '';
      return;
    }
    if (!selectedDataset || !names.includes(selectedDataset)) {
      selectedDataset = names[0];
    }
  };

  const ensureDefaultDataset = () => {
    const names = jsonDataStore.getDatasetNames();
    if (names.length) return;
    jsonDataStore.createDataset('メイン', [{ key: 'message', type: 'string', value: 'こんにちは' }]);
    selectedDataset = 'メイン';
    scheduleSave();
  };

  const renderDatasetSelect = () => {
    if (!datasetSelect) return;
    resolveDatasetSelection();
    datasetSelect.innerHTML = '';
    const names = jsonDataStore.getDatasetNames();
    if (!names.length) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'データセットがありません';
      datasetSelect.appendChild(option);
      datasetSelect.value = '';
      return;
    }

    names.forEach((name) => {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      datasetSelect.appendChild(option);
    });
    datasetSelect.value = selectedDataset;
  };

  const renderPreview = () => {
    if (!preview || !errorLabel) return;
    if (!selectedDataset) {
      preview.value = '{}';
      errorLabel.textContent = '';
      errorLabel.classList.add('hidden');
      return;
    }
    const { data, errors } = jsonDataStore.buildDatasetData(selectedDataset);
    preview.value = JSON.stringify(data, null, 2);
    if (errors.length) {
      errorLabel.textContent = errors.join(' / ');
      errorLabel.classList.remove('hidden');
    } else {
      errorLabel.textContent = '';
      errorLabel.classList.add('hidden');
    }
  };

  const createTypeSelect = (value) => {
    const select = document.createElement('select');
    select.className =
      'json-gui__cell-select rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs';
    const options = [
      ['string', '文字列'],
      ['number', '数値'],
      ['boolean', '真偽値'],
      ['null', 'ヌル(null)'],
      ['object', 'オブジェクト'],
      ['array', '配列'],
    ];
    options.forEach(([raw, label]) => {
      const option = document.createElement('option');
      option.value = raw;
      option.textContent = label;
      select.appendChild(option);
    });
    select.value = value;
    return select;
  };

  const renderRows = () => {
    if (!rowsBody) return;
    rowsBody.innerHTML = '';
    if (!selectedDataset) {
      renderPreview();
      return;
    }

    const rows = jsonDataStore.getRows(selectedDataset);
    if (!rows.length) {
      const emptyRow = document.createElement('tr');
      emptyRow.innerHTML =
        '<td colspan="4" class="px-3 py-4 text-center text-xs text-slate-500 dark:text-slate-400">行がありません。「行を追加」を押してください。</td>';
      rowsBody.appendChild(emptyRow);
      renderPreview();
      return;
    }

    rows.forEach((row, index) => {
      const tr = document.createElement('tr');
      tr.className = 'border-b border-slate-100 dark:border-slate-800';

      const keyCell = document.createElement('td');
      keyCell.className = 'px-2 py-2 align-top';
      const keyInput = document.createElement('input');
      keyInput.type = 'text';
      keyInput.value = row.key;
      keyInput.placeholder = 'キー名';
      keyInput.className =
        'json-gui__cell-input w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs';
      keyInput.addEventListener('input', () => {
        jsonDataStore.updateRow(selectedDataset, index, { key: keyInput.value });
        renderPreview();
        scheduleSave();
      });
      keyCell.appendChild(keyInput);

      const typeCell = document.createElement('td');
      typeCell.className = 'px-2 py-2 align-top';
      const typeSelect = createTypeSelect(row.type);
      typeSelect.addEventListener('change', () => {
        jsonDataStore.updateRow(selectedDataset, index, { type: typeSelect.value });
        renderPreview();
        scheduleSave();
      });
      typeCell.appendChild(typeSelect);

      const valueCell = document.createElement('td');
      valueCell.className = 'px-2 py-2 align-top';
      const valueInput = document.createElement('input');
      valueInput.type = 'text';
      valueInput.value = row.value;
      valueInput.placeholder =
        row.type === 'object' ? '{"id": 1}' : row.type === 'array' ? '["a", "b"]' : '値';
      valueInput.className =
        'json-gui__cell-input w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs';
      valueInput.addEventListener('input', () => {
        jsonDataStore.updateRow(selectedDataset, index, { value: valueInput.value });
        renderPreview();
        scheduleSave();
      });
      valueCell.appendChild(valueInput);

      const actionCell = document.createElement('td');
      actionCell.className = 'px-2 py-2 align-top text-right';
      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className =
        'inline-flex items-center justify-center rounded-lg border border-rose-200 dark:border-rose-700 px-2 py-1 text-xs font-semibold text-rose-600 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-900/20';
      deleteBtn.textContent = '削除';
      deleteBtn.addEventListener('click', () => {
        jsonDataStore.removeRow(selectedDataset, index);
        renderRows();
        scheduleSave();
      });
      actionCell.appendChild(deleteBtn);

      tr.appendChild(keyCell);
      tr.appendChild(typeCell);
      tr.appendChild(valueCell);
      tr.appendChild(actionCell);
      rowsBody.appendChild(tr);
    });

    renderPreview();
  };

  const render = () => {
    renderDatasetSelect();
    renderRows();
  };

  const createDatasetPrompt = () => {
    const defaultName = `データセット_${jsonDataStore.getDatasetNames().length + 1}`;
    const name = window.prompt('データセット名', defaultName);
    const normalized = String(name || '').trim();
    if (!normalized) return;
    if (jsonDataStore.hasDataset(normalized)) {
      window.alert('同名のデータセットが既に存在します。');
      return;
    }
    jsonDataStore.createDataset(normalized, []);
    selectedDataset = normalized;
    render();
    scheduleSave();
  };

  const renameDatasetPrompt = () => {
    if (!selectedDataset) return;
    const name = window.prompt('データセット名を変更', selectedDataset);
    const normalized = String(name || '').trim();
    if (!normalized || normalized === selectedDataset) return;
    if (!jsonDataStore.renameDataset(selectedDataset, normalized)) {
      window.alert('データセット名の変更に失敗しました。');
      return;
    }
    selectedDataset = normalized;
    render();
    scheduleSave();
  };

  const deleteDataset = () => {
    if (!selectedDataset) return;
    const confirmed = window.confirm(`データセット「${selectedDataset}」を削除しますか？`);
    if (!confirmed) return;
    jsonDataStore.removeDataset(selectedDataset);
    resolveDatasetSelection();
    render();
    scheduleSave();
  };

  const openModal = () => {
    if (!modal) return;
    ensureDefaultDataset();
    render();
    if (typeof Blockly !== 'undefined') Blockly.hideChaff();
    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    void modal.offsetWidth;
    modal.classList.add('show-modal');
  };

  const closeModal = () => {
    saveNow();
    if (!modal) return;
    modal.classList.remove('show-modal');
    if (closeTimer) clearTimeout(closeTimer);
    closeTimer = setTimeout(() => {
      modal.classList.remove('flex');
      modal.classList.add('hidden');
      closeTimer = null;
    }, 300);
  };

  if (openBtn) {
    openBtn.addEventListener('click', () => {
      if (shareFeature?.isShareViewMode?.()) return;
      openModal();
    });
  }
  closeBtn?.addEventListener('click', closeModal);
  cancelBtn?.addEventListener('click', closeModal);
  modal?.addEventListener('click', (event) => {
    if (event.target === modal) closeModal();
  });

  datasetSelect?.addEventListener('change', () => {
    selectedDataset = datasetSelect.value || '';
    render();
  });

  addDatasetBtn?.addEventListener('click', createDatasetPrompt);
  renameDatasetBtn?.addEventListener('click', renameDatasetPrompt);
  deleteDatasetBtn?.addEventListener('click', deleteDataset);

  addRowBtn?.addEventListener('click', () => {
    if (!selectedDataset) return;
    jsonDataStore.appendRow(selectedDataset, { key: '', type: 'string', value: '' });
    renderRows();
    scheduleSave();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
      closeModal();
    }
  });
  window.addEventListener('beforeunload', saveNow);

  const applyShareViewState = (isViewOnly) => {
    if (!openBtn) return;
    openBtn.disabled = Boolean(isViewOnly);
    openBtn.classList.toggle('opacity-50', Boolean(isViewOnly));
    openBtn.classList.toggle('cursor-not-allowed', Boolean(isViewOnly));
    if (isViewOnly) closeModal();
  };

  shareFeature?.onShareViewModeChange?.(applyShareViewState);
  applyShareViewState(shareFeature?.isShareViewMode?.() || false);

  // Fallback source for legacy workspaces or save timing gaps.
  const localState = readJsonDatasetLocalState();
  if (localState) {
    jsonDataStore.fromJSON(localState);
    resolveDatasetSelection();
    render();
  }

  const originalGetExtraState = workspace.getExtraState?.bind(workspace);
  const originalSetExtraState = workspace.setExtraState?.bind(workspace);

  workspace.getExtraState = () => {
    const base = originalGetExtraState ? originalGetExtraState() : {};
    const safeBase = base && typeof base === 'object' ? base : {};
    return { ...safeBase, [JSON_DATA_STORE_KEY]: jsonDataStore.toJSON() };
  };

  workspace.setExtraState = (state) => {
    if (originalSetExtraState) originalSetExtraState(state);
    const hasJsonStore =
      Boolean(state) &&
      typeof state === 'object' &&
      Object.prototype.hasOwnProperty.call(state, JSON_DATA_STORE_KEY);
    if (hasJsonStore) {
      jsonDataStore.fromJSON(state?.[JSON_DATA_STORE_KEY]);
    } else {
      const fallbackState = readJsonDatasetLocalState();
      if (fallbackState) {
        jsonDataStore.fromJSON(fallbackState);
      }
    }
    persistJsonDatasetLocalState();
    resolveDatasetSelection();
    render();
  };

  return { render, saveNow };
};

const indentBlock = (block, spaces = 4) =>
  block
    .split('\n')
    .map((line) => (line.trim() === '' ? '' : `${' '.repeat(spaces)}${line} `))
    .join('\n');

const addSelfParam = (block) =>
  block.replace(/async def ([^(]+)\(([^)]*)\)/, (match, name, params) => {
    const trimmed = params.trim();
    if (!trimmed) return `async def ${name} (self)`;
    if (trimmed.startsWith('self')) return `async def ${name} (${trimmed})`;
    return `async def ${name} (self, ${trimmed})`;
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
    bodyCode.includes('_save_json_dataset_cache') ||
    bodyCode.includes('json.')
  ) {
    imports.push('import json');
    imports.push('import os');
  }
  if (
    bodyCode.includes('logging.') ||
    bodyCode.includes('_load_json_data') ||
    bodyCode.includes('_save_json_data') ||
    bodyCode.includes('_save_json_dataset_cache')
  ) {
    imports.push('import logging');
  }
  return imports;
};

const buildSharedModule = (bodyCode) => {
  const usesJson =
    bodyCode.includes('_load_json_data') ||
    bodyCode.includes('_save_json_data') ||
    bodyCode.includes('_save_json_dataset_cache') ||
    bodyCode.includes('json.');
  const usesModal = bodyCode.includes('EasyModal');
  const usesLogging = bodyCode.includes('logging.') || usesJson;

  if (!usesJson && !usesModal && !usesLogging) return '';

  let content = `# Shared helpers\n`;
  if (usesLogging) {
    content += `import logging\n\n`;
    content += `logging.basicConfig(level = logging.INFO, format = '%(asctime)s - %(levelname)s - %(message)s') \n\n`;
  }
  if (usesJson) {
    content += `import json\nimport os\n\n`;
    content += `def _load_json_data(filename): \n`;
    content += `    if not os.path.exists(filename): \n`;
    content += `        return {}\n`;
    content += `    try: \n`;
    content += `        with open(filename, 'r', encoding = 'utf-8') as f: \n`;
    content += `            return json.load(f) \n`;
    content += `    except Exception as e: \n`;
    content += `        logging.error(f"JSON Load Error: {e}") \n`;
    content += `        return {}\n\n`;
    content += `def _save_json_data(filename, data): \n`;
    content += `    try: \n`;
    content += `        with open(filename, 'w', encoding = 'utf-8') as f: \n`;
    content += `            json.dump(data, f, ensure_ascii = False, indent = 4) \n`;
    content += `    except Exception as e: \n`;
    content += `        logging.error(f"JSON Save Error: {e}") \n\n`;
    content += `def _save_json_dataset_cache(): \n`;
    content += `    _cache = globals().get('_edbb_json_dataset_cache', {}) \n`;
    content += `    _files = globals().get('_edbb_json_dataset_files', {}) \n`;
    content += `    if not isinstance(_cache, dict) or not isinstance(_files, dict): \n`;
    content += `        return \n`;
    content += `    for _dataset_name, _dataset_data in _cache.items(): \n`;
    content += `        _filename = _files.get(_dataset_name) \n`;
    content += `        if not _filename: \n`;
    content += `            continue \n`;
    content += `        _save_json_data(_filename, _dataset_data) \n\n`;
  }
  if (usesModal) {
    content += `import discord\n\n`;
    content += `class EasyModal(discord.ui.Modal): \n`;
    content += `    def __init__(self, title, custom_id, inputs): \n`;
    content += `        super().__init__(title = title, timeout = None, custom_id = custom_id) \n`;
    content += `        for item in inputs: \n`;
    content += `            self.add_item(discord.ui.TextInput(label = item['label'], custom_id = item['id'])) \n`;
  }
  return content.trim();
};

const buildCogFile = (className, blocks, imports, sharedImports = '', preamble = '') => {
  const body = blocks.map((block) => indentBlock(block)).join('\n\n');
  const header = `${imports.join('\n')} \n${sharedImports} `.trim();
  const preambleBlock = preamble ? `${preamble} \n\n` : '';
  return `
${header}

${preambleBlock} class ${className}(commands.Cog):
    def __init__(self, bot):
  self.bot = bot

${body}

async def setup(bot):
  await bot.add_cog(${className}(bot))
    `.trim();
};

const buildModuleFile = (imports, sharedImports, body, preamble = '') => {
  const header = `${imports.join('\n')} \n${sharedImports} `.trim();
  const preambleBlock = preamble ? `${preamble} \n\n` : '';
  return `
${header}

${preambleBlock}${body}

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
  const topBlockEntries = topBlocks.map((block) => ({
    block,
    rawGroup: blockCodeToString(Blockly.Python.blockToCode(block)),
  }));
  const rawAll = topBlockEntries.map(({ rawGroup }) => rawGroup).join('\n');
  const { cleanedCode: allCleaned } = extractInteractionEventsSafe(rawAll);

  const sharedModule = buildSharedModule(allCleaned);
  const files = { 'cogs/__init__.py': '' };
  if (sharedModule) files['cogs/shared.py'] = sharedModule;

  const procedureDefs = topBlockEntries
    .filter(({ block, rawGroup }) => block?.type?.startsWith('procedures_def') && rawGroup?.trim())
    .map(({ rawGroup }) => rawGroup.trim());
  const nameCounter = new Map();
  const cogsToLoad = [];

  const makeUniqueSlug = (base) => {
    const current = nameCounter.get(base) || 0;
    nameCounter.set(base, current + 1);
    return current === 0 ? base : `${base}_${current + 1} `;
  };

  topBlockEntries.forEach(({ block, rawGroup }) => {
    if (!rawGroup || !rawGroup.trim()) return;
    if (block?.type?.startsWith('procedures_def')) {
      return;
    }

    const {
      cleanedCode,
      componentEvents,
      modalEvents,
      hasComponentEvents,
      hasModalEvents,
    } = extractInteractionEventsSafe(rawGroup);

    const { kind, label } = deriveGroupMeta(block);
    const baseSlug = slugify(`${kind}_${label}`);
    const fileSlug = makeUniqueSlug(baseSlug);
    const className = `${toPascalCase(fileSlug)} Cog`.replace(/^[0-9]/, 'Cog$&');

    const needsInteractionHandler = hasComponentEvents || hasModalEvents;
    const imports = buildImports(cleanedCode, needsInteractionHandler);
    const usesJson =
      cleanedCode.includes('_load_json_data') ||
      cleanedCode.includes('_save_json_data') ||
      cleanedCode.includes('_save_json_dataset_cache') ||
      cleanedCode.includes('json.');
    const usesModal = cleanedCode.includes('EasyModal');
    const sharedSymbols = [];
    if (usesJson) sharedSymbols.push('_load_json_data', '_save_json_data', '_save_json_dataset_cache');
    if (usesModal) sharedSymbols.push('EasyModal');
    const sharedImports =
      sharedModule && sharedSymbols.length
        ? `from.shared import ${sharedSymbols.join(', ')} `
        : '';

    let fileContent = '';
    const procedurePreamble = procedureDefs.length ? procedureDefs.join('\n\n') : '';

    if (kind === 'event') {
      fileContent = buildCogFile(
        className,
        [convertEventBlock(cleanedCode)],
        imports,
        sharedImports,
        procedurePreamble,
      );
    } else if (kind === 'slash') {
      fileContent = buildCogFile(
        className,
        [convertSlashCommandBlock(cleanedCode)],
        imports,
        sharedImports,
        procedurePreamble,
      );
    } else if (kind === 'prefix') {
      fileContent = buildCogFile(
        className,
        [convertPrefixCommandBlock(cleanedCode)],
        imports,
        sharedImports,
        procedurePreamble,
      );
    } else if (kind === 'button' || kind === 'modal') {
      const blocks = [];
      if (needsInteractionHandler) {
        blocks.push(buildInteractionHandler(componentEvents, modalEvents));
      }
      blocks.push(convertComponentBlock(cleanedCode));
      fileContent = buildCogFile(className, blocks, imports, sharedImports, procedurePreamble);
    } else {
      fileContent = buildModuleFile(imports, sharedImports, cleanedCode.trim(), procedurePreamble);
    }

    const filePath = `cogs/${fileSlug}.py`;
    files[filePath] = fileContent;
    cogsToLoad.push(filePath.replace('cogs/', 'cogs.').replace('.py', ''));
  });

  const botFile = `
# Easy Discord Bot Builder - Split Cogs Version

import os
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
    # トークンの設定
    # Set your token here
    token = "TOKEN"

    # Token check
    token = os.getenv("DISCORD_TOKEN", token) # 環境変数DISCORD_TOKENがあればそちらを優先 (If DISCORD_TOKEN environment variable is set, it will be used)
    if token == "TOKEN":
        print('\\x1b[31m!!!!注意!!!! トークンを設定していない場合は、環境変数DISCORD_TOKENを設定するか、上のtoken変数を書き換えてください。\\x1b[0m')
        print('\\x1b[31m!!!!Warning!!!! If you have not set a token, please set the DISCORD_TOKEN environment variable or replace the token variable above.\\x1b[0m')
        exit(1)

    bot.run(token)
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
    if (content == null) return;
    const item = document.createElement('div');
    item.className =
      'rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden';
    item.innerHTML = `
      <div class="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono text-xs">
        <div class="text-slate-600 dark:text-slate-300 font-bold overflow-hidden text-ellipsis whitespace-nowrap" title="${path}">${path}</div>
        <div class="flex items-center gap-2 shrink-0">
          <button class="splitCopyBtn inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800" data-path="${path}">
            <i data-lucide="copy" class="w-3.5 h-3.5"></i> Copy
          </button>
          <button class="splitDownloadBtn inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm" data-path="${path}">
            <i data-lucide="download" class="w-3.5 h-3.5"></i> DL
          </button>
        </div>
      </div>
      <pre class="p-4 text-xs font-mono bg-[#0f172a] text-[#e2e8f0] overflow-x-auto selection:bg-indigo-500/30"></pre>
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

const initializeApp = async () => {
  window.__edbb_initialized = true;
  lucide.createIcons();

  const { modernLightTheme, modernDarkTheme } = setupBlocklyEnvironment();

  const blocklyDiv = document.getElementById('blocklyDiv');
  const toolbox = document.getElementById('toolbox');
  const themeToggle = document.getElementById('themeToggle');
  const headerActions = document.getElementById('headerActions');
  const mobileHeaderToggle = document.getElementById('mobileHeaderToggle');
  // ヘッダーのコード生成ボタン
  const showCodeBtn = document.getElementById('showCodeBtn');
  const runBotBtn = document.getElementById('runBotBtn');
  // モーダル関連
  const codeModal = document.getElementById('codeModal');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const codeOutput = document.getElementById('codeOutput');
  const codeGenErrorBox = document.getElementById('codeGenErrorBox');
  const codeGenErrorList = document.getElementById('codeGenErrorList');
  const copyCodeBtn = document.getElementById('copyCodeBtn');
  const splitCodeBtn = document.getElementById('splitCodeBtn');
  const splitCodeModal = document.getElementById('splitCodeModal');
  const splitModalClose = document.getElementById('splitModalClose');
  const splitDownloadAllBtn = document.getElementById('splitDownloadAllBtn');
  const saveJsonModal = document.getElementById('saveJsonModal');
  const saveJsonCloseBtn = document.getElementById('saveJsonCloseBtn');
  const saveJsonCancelBtn = document.getElementById('saveJsonCancelBtn');
  const saveJsonConfirmBtn = document.getElementById('saveJsonConfirmBtn');
  const saveJsonFilenameInput = document.getElementById('saveJsonFilename');
  const saveJsonPrettyCheckbox = document.getElementById('saveJsonPretty');
  const saveJsonMethodSelect = document.getElementById('saveJsonMethod');
  const saveJsonMethodHint = document.getElementById('saveJsonMethodHint');
  const runnerDownloadModal = document.getElementById('runnerDownloadModal');
  const runnerDownloadModalClose = document.getElementById('runnerDownloadModalClose');
  const runnerDownloadCancelBtn = document.getElementById('runnerDownloadCancelBtn');
  const runnerDownloadBtn = document.getElementById('runnerDownloadBtn');

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

  const supportsSaveFilePicker =
    typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function';

  const getDefaultJsonFileName = () =>
    storage?.getDefaultExportFileName?.() ||
    WorkspaceStorage.buildDownloadName(resolveProjectTitle());

  const normalizeJsonFileName = (rawName) =>
    WorkspaceStorage.normalizeDownloadName(rawName, getDefaultJsonFileName());

  const flashSaveStatus = (message = 'Saved') => {
    const status = document.getElementById('saveStatus');
    if (!status) return;
    const label = status.querySelector('span');
    const originalText = label?.textContent || 'Saved';
    if (label) {
      label.textContent = message;
    }
    status.setAttribute('data-show', 'true');
    setTimeout(() => {
      status.setAttribute('data-show', 'false');
      if (label) {
        label.textContent = originalText;
      }
    }, 2000);
  };

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
  setupLiteralInputAutofill(workspace);

  // --- ワークスペース保存クラスの初期化 ---
  storage = new WorkspaceStorage(workspace);
  storage.setTitleProvider(() => resolveProjectTitle());
  if (typeof Blockly !== 'undefined') {
    Blockly.edbbListStore = listStore;
    Blockly.edbbJsonDataStore = jsonDataStore;
  }

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
  setupJsonDataManager({
    workspace,
    storage,
    shareFeature,
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
  workspace.pluginManager = pluginManager; // storage.js からアクセスできるようにする
  storage.pluginManager = pluginManager; // share.js からアクセスできるようにする

  // プラグインの状態が変更されたら共有ボタンの状態を更新する
  const originalEnable = pluginManager.enablePlugin.bind(pluginManager);
  pluginManager.enablePlugin = async (id) => {
    await originalEnable(id);
    shareFeature?.updateShareButtonState?.();
  };
  const originalDisable = pluginManager.disablePlugin.bind(pluginManager);
  pluginManager.disablePlugin = async (id) => {
    await originalDisable(id);
    shareFeature?.updateShareButtonState?.();
  };

  const pluginUI = new PluginUI(pluginManager);
  pluginManager.onPluginsSuggested((entries) => {
    pluginUI.handleBulkInstall(entries.join(','));
  });
  await pluginManager.init();

  // --- Load Saved Data ---
  const sharedApplied = await shareFeature.applySharedLayoutFromQuery();
  if (!sharedApplied) {
    storage?.load();
    // Keep block interactivity aligned with current (non-share) mode.
    shareFeature.applyUiState();
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
        // Imported JSON/XML may contain stale block flags.
        shareFeature.applyUiState();
        Blockly.svgResize(workspace);
      })
      .catch((err) => console.error(err))
      .finally(() => {
        e.target.value = '';
      });
  });

  exportBtn.addEventListener('click', () => {
    if (!saveJsonModal || !storage) {
      storage?.exportFile();
      return;
    }
    if (saveJsonFilenameInput) {
      saveJsonFilenameInput.value = getDefaultJsonFileName();
    }
    if (saveJsonMethodSelect && !supportsSaveFilePicker) {
      saveJsonMethodSelect.value = 'download';
    }
    toggleModal(saveJsonModal, true);
    setTimeout(() => {
      saveJsonFilenameInput?.focus();
      saveJsonFilenameInput?.select();
    }, 0);
  });

  // --- モーダル表示ロジック (アニメーション付き) ---
  const modalTimers = new Map();
  const toggleModal = (modal, isOpen) => {
    if (!modal) return;

    // 既存のタイマーをクリア
    if (modalTimers.has(modal)) {
      clearTimeout(modalTimers.get(modal));
      modalTimers.delete(modal);
    }

    if (isOpen) {
      if (typeof Blockly !== 'undefined') Blockly.hideChaff();
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      // Force reflow
      void modal.offsetWidth;
      modal.classList.add('show-modal');
    } else {
      modal.classList.remove('show-modal');
      const timer = setTimeout(() => {
        modal.classList.remove('flex');
        modal.classList.add('hidden');
        modalTimers.delete(modal);
      }, 300); // Wait for transition
      modalTimers.set(modal, timer);
    }
  };

  const hideCodegenErrors = () => {
    if (!codeGenErrorBox || !codeGenErrorList) return;
    codeGenErrorList.innerHTML = '';
    codeGenErrorBox.classList.add('hidden');
  };

  const showCodegenErrors = (diagnostics) => {
    if (!Array.isArray(diagnostics) || !diagnostics.length) {
      hideCodegenErrors();
      return;
    }
    if (!codeGenErrorBox || !codeGenErrorList) {
      const messages = diagnostics.map((item) => item.message).join('\n');
      window.alert(`静的構文解析エラー:\n${messages}`);
      return;
    }
    codeGenErrorList.innerHTML = '';
    diagnostics.forEach((item) => {
      const li = document.createElement('li');
      li.textContent = item.message;
      codeGenErrorList.appendChild(li);
    });
    codeGenErrorBox.classList.remove('hidden');
  };

  const validateBeforeCodegen = () => {
    const diagnostics = analyzeWorkspaceForCodegen(workspace);
    if (!diagnostics.length) {
      hideCodegenErrors();
      return true;
    }
    showCodegenErrors(diagnostics);
    if (codeOutput) {
      codeOutput.textContent = '';
    }
    toggleModal(codeModal, true);
    return false;
  };

  const updateSaveJsonMethodHint = () => {
    if (!saveJsonMethodHint) return;
    const mode = saveJsonMethodSelect?.value || 'download';
    if (mode === 'picker') {
      saveJsonMethodHint.textContent = supportsSaveFilePicker
        ? '保存ダイアログを開いて、任意のフォルダに直接保存します。'
        : 'このブラウザでは「保存先を選んで保存」は使えません。通常ダウンロードを選んでください。';
      return;
    }
    saveJsonMethodHint.textContent =
      '通常のダウンロードとして保存します。ほぼ全ブラウザで利用できます。';
  };

  const closeSaveJsonModal = () => {
    if (!saveJsonModal) return;
    toggleModal(saveJsonModal, false);
  };

  const setSaveJsonBusy = (busy) => {
    if (!saveJsonConfirmBtn) return;
    saveJsonConfirmBtn.disabled = busy;
    saveJsonConfirmBtn.classList.toggle('opacity-70', busy);
    saveJsonConfirmBtn.classList.toggle('cursor-not-allowed', busy);
  };

  const handleSaveJsonConfirm = async () => {
    if (!storage) return;

    const pretty = Boolean(saveJsonPrettyCheckbox?.checked);
    const fileName = normalizeJsonFileName(saveJsonFilenameInput?.value || '');
    if (saveJsonFilenameInput) {
      saveJsonFilenameInput.value = fileName;
    }
    const method = saveJsonMethodSelect?.value || 'download';

    setSaveJsonBusy(true);
    let saved = false;
    try {
      if (method === 'picker' && supportsSaveFilePicker) {
        saved = await storage.saveFileWithPicker({ pretty, fileName });
      } else {
        saved = storage.exportFile({ pretty, fileName });
      }
    } finally {
      setSaveJsonBusy(false);
    }

    if (!saved) return;
    closeSaveJsonModal();
    flashSaveStatus('JSONを保存しました');
  };

  if (saveJsonMethodSelect && !supportsSaveFilePicker) {
    const pickerOption = saveJsonMethodSelect.querySelector('option[value="picker"]');
    if (pickerOption) {
      pickerOption.disabled = true;
    }
    saveJsonMethodSelect.value = 'download';
  }
  updateSaveJsonMethodHint();

  saveJsonMethodSelect?.addEventListener('change', updateSaveJsonMethodHint);
  saveJsonCloseBtn?.addEventListener('click', closeSaveJsonModal);
  saveJsonCancelBtn?.addEventListener('click', closeSaveJsonModal);
  saveJsonConfirmBtn?.addEventListener('click', () => {
    void handleSaveJsonConfirm();
  });
  saveJsonFilenameInput?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    void handleSaveJsonConfirm();
  });
  saveJsonModal?.addEventListener('click', (event) => {
    if (event.target === saveJsonModal) {
      closeSaveJsonModal();
    }
  });

  showCodeBtn.addEventListener('click', () => {
    showCodeBtn.blur();
    // Blocklyの選択ハイライトなどを解除
    if (workspace) Blockly.hideChaff();
    if (!validateBeforeCodegen()) return;
    codeOutput.textContent = generatePythonCode();
    toggleModal(codeModal, true);
  });

  // Run Bot Button - BOTの実行を開始
  runBotBtn?.addEventListener('click', async () => {
    runBotBtn.blur();
    if (workspace) Blockly.hideChaff();
    if (!validateBeforeCodegen()) return;

    // Show toast with loading state
    const runBotStatus = document.getElementById('runBotStatus');
    const runBotStatusText = document.getElementById('runBotStatusText');
    if (runBotStatus && runBotStatusText) {
      runBotStatus.dataset.state = 'success';
      runBotStatusText.textContent = 'BOTを起動中...';
      runBotStatus.setAttribute('data-show', 'true');
    }

    try {
      const botCode = generatePythonCode();
      const response = await fetch('http://localhost:6859', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: botCode,
        signal: AbortSignal.timeout(7000),
      });

      // Parse JSON response
      const responseData = await response.json();

      if (response.ok && responseData.status === 'ok') {
        // Success - show success toast
        if (runBotStatus && runBotStatusText) {
          runBotStatus.dataset.state = 'success';
          runBotStatusText.textContent = 'BOTの起動を開始しました';
          runBotStatus.setAttribute('data-show', 'true');
          setTimeout(() => runBotStatus.setAttribute('data-show', 'false'), 3000);
        }
      } else {
        throw new Error('Failed to start bot');
      }
    } catch (error) {
      console.error('Failed to run bot:', error);

      // Error - show error toast
      if (runBotStatus && runBotStatusText) {
        runBotStatus.dataset.state = 'error';
        runBotStatusText.textContent = 'BOTの起動に失敗しました';
        runBotStatus.setAttribute('data-show', 'true');
        setTimeout(() => runBotStatus.setAttribute('data-show', 'false'), 3000);
      }

      // Show download modal after a short delay
      setTimeout(() => {
        if (runnerDownloadModal) {
          toggleModal(runnerDownloadModal, true);
        }
      }, 500);
    }
  });

  // Runner Download Modal handlers
  const closeRunnerDownloadModal = () => {
    if (runnerDownloadModal) {
      toggleModal(runnerDownloadModal, false);
    }
  };

  runnerDownloadModalClose?.addEventListener('click', closeRunnerDownloadModal);
  runnerDownloadCancelBtn?.addEventListener('click', closeRunnerDownloadModal);

  runnerDownloadBtn?.addEventListener('click', () => {
    const hostname = window.location.hostname || '';
    const isBetaHost = /^beta(\.|-)/i.test(hostname);
    const downloadUrl = isBetaHost
      ? 'https://github.com/himais0giiiin/edbb-runner/archive/refs/heads/beta.zip'
      : 'https://github.com/himais0giiiin/edbb-runner/archive/refs/heads/main.zip';

    window.open(downloadUrl, '_blank');
    closeRunnerDownloadModal();
  });

  // Close modal on backdrop click
  runnerDownloadModal?.addEventListener('click', (e) => {
    if (e.target === runnerDownloadModal) {
      closeRunnerDownloadModal();
    }
  });

  const openSplitModal = () => {
    if (!splitCodeModal) return;
    if (!validateBeforeCodegen()) return;
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
    toggleModal(codeModal, false);
  });

  // Backdrop click to close
  codeModal.addEventListener('click', (e) => {
    if (e.target === codeModal) toggleModal(codeModal, false);
  });

  splitModalClose?.addEventListener('click', () => {
    toggleModal(splitCodeModal, false);
  });

  splitDownloadAllBtn?.addEventListener('click', () => {
    if (!validateBeforeCodegen()) {
      toggleModal(splitCodeModal, false);
      return;
    }
    const files = generateSplitPythonFiles();
    Object.entries(files).forEach(([path, content]) => {
      if (content == null) return;
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

// Initialize app when DOM is ready and all modules are loaded
const startApp = async (retryCount = 0) => {
  if (window.__edbb_initialized) return;

  // Use a second flag to prevent overlapping initialization attempts
  if (window.__edbb_starting && retryCount === 0) return;
  window.__edbb_starting = true;

  // Limit retries
  if (retryCount > 100) {
    console.error('App initialization timed out.');
    window.__edbb_starting = false;
    return;
  }

  // Ensure Blockly is fully initialized
  if (typeof Blockly === 'undefined' || !Blockly.Blocks || !Blockly.Python) {
    setTimeout(() => startApp(retryCount + 1), 100);
    return;
  }

  // Dynamically load blocks.js
  if (!Blockly.Blocks['on_ready']) {
    try {
      await import('./blocks.js');
    } catch (e) {
      console.error('Failed to load blocks.js', e);
    }
  }

  if (!Blockly.Blocks['on_ready']) {
    setTimeout(() => startApp(retryCount + 1), 100);
    return;
  }

  // All systems ready
  try {
    await initializeApp();
    window.__edbb_initialized = true;
  } catch (e) {
    console.error('App initialization failed:', e);
  } finally {
    window.__edbb_starting = false;
  }
};

const triggerStart = () => {
  if (window.__start_triggered) return;
  window.__start_triggered = true;
  setTimeout(startApp, 50);
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', triggerStart);
} else {
  triggerStart();
}

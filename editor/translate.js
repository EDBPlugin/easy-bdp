const RAW_TRANSLATIONS = {
  // UI - header and layout
  '共有リンクをコピーしました': 'Copied the share link',
  '共有リンクをコピーしました！': 'Copied the share link!',
  共有: 'Share',
  'コード生成': 'Generate code',
  'ブロックのみ表示': 'Blocks only',
  リアルタイムコード表示: 'Split view',
  閲覧モード: 'View-only mode',
  '共有ブロックを表示しています。編集を行う場合は「編集を開始」ボタンを押してください。':
    'Viewing shared blocks. Press "Start Editing" to edit.',
  '編集を開始': 'Start editing',

  // Code modal
  実行方法: 'How to run',
  '以下のコードを bot.py という名前で保存します。': 'Save the code below as bot.py.',
  'ターミナルで pip install discord.py[voice] を実行します (音声機能のため[voice]推奨)。':
    'Run `pip install discord.py[voice]` in your terminal (use [voice] for voice features).',
  'python bot.py を実行してBotを起動します。': 'Run `python bot.py` to start the bot.',
  '※音声再生にはシステムに FFmpeg がインストールされている必要があります。':
    'FFmpeg must be installed on your system for audio playback.',
  'Botコード (Python)': 'Bot code (Python)',
  コピー: 'Copy',
  コピー完了: 'Copied',
  'TokenはDiscord Developer Portalから取得し、他人には絶対に教えないでください。':
    'Get your token from the Discord Developer Portal and never share it with anyone.',

  // Share import modal
  '共有ブロックを読み込みますか？': 'Load shared blocks?',
  '現在のブロックは上書きされます': 'Current blocks will be overwritten.',
  '共有リンクを読み込むと、現在編集中のブロック全体が置き換わります。必要であれば、今のブロックをダウンロードしてバックアップを作成しておいてください。':
    'Loading a share link replaces your current blocks. Download them first if you need a backup.',
  '現在のブロックをダウンロード': 'Download current blocks',
  'JSONファイルとして保存し、あとから読み込めます。': 'Save as a JSON file and load it later.',
  '今のブロックを保存する': 'Save current blocks',
  '次回からこの警告を表示しない': 'Do not show this warning next time',
  キャンセル: 'Cancel',
  '共有ブロックを読み込む': 'Load shared blocks',

  // Share modal & statuses
  'ブロックを共有': 'Share blocks',
  'コピーして他のユーザーにブロックを共有できます': 'Copy to share your blocks with others',
  プレビュー画像: 'Preview image',
  'SNSなどで画像付きポストをするときに使えます。':
    'Use when posting with an image on social media.',
  'プレビュー画像をコピー': 'Copy preview image',
  '共有を開始するとここにプレビューが表示されます': 'Start sharing to see a preview here.',
  '共有ブロックURL': 'Shared blocks URL',
  '共有リンクとプレビュー画像をコピーして、友達に送ってみましょう。':
    'Copy the share link and preview image to share with friends.',
  'リンクをコピー': 'Copy link',
  'Xでポスト': 'Post on X',
  'クリップボードに画像をコピーできません': 'Cannot copy the image to clipboard.',
  'プレビュー画像をコピーしました！': 'Copied the preview image!',
  '画像のコピーに失敗しました': 'Failed to copy the image.',
  'ブロックエリアを撮影しています...': 'Capturing the block area...',
  'サムネイルの生成に失敗しました。再試行してください。':
    'Failed to generate the thumbnail. Please try again.',
  '共有ビューを再読込しました': 'Reloaded the share view.',
  '共有ビューへの復元に失敗しました': 'Failed to restore the share view.',
  '共有データを適用できませんでした': 'Could not apply shared data.',
  '共有リンクの生成に失敗しました': 'Failed to generate the share link.',
  '短縮URLの生成に失敗したため通常リンクを表示します':
    'URL shortener failed; showing the regular link instead.',
  'Xのポスト画面を開きました': 'Opened the X post screen.',
  '共有ブロックの編集を開始します。(Tips: ブラウザバックで元のブロックを復元できます)':
    'Starting to edit shared blocks. Tip: use browser back to restore the original blocks.',
  '共有ブロックを閲覧専用で開いています': 'Opened shared blocks in view-only mode.',
  '共有ブロックの読み込みをキャンセルしました': 'Cancelled loading the shared blocks.',
  '編集ビューへ戻りました': 'Returned to edit view.',
  '編集内容の復元に失敗しました': 'Failed to restore the edited content.',

  // Toolbox categories
  イベント: 'Events',
  'ボタン・フォーム': 'Buttons & Forms',
  リアクション: 'Reactions',
  情報取得: 'Information',
  メッセージ: 'Messages',
  '高度な操作': 'Advanced',
  'データ保存 (JSON)': 'Data storage (JSON)',
  'チャンネル・ボイス': 'Channels & Voice',
  Bot設定: 'Bot settings',
  管理機能: 'Moderation',
  '埋め込み (Embed)': 'Embeds',
  変数: 'Variables',
  'データ構造': 'Data structures',
  関数: 'Functions',
  '論理・比較': 'Logic & Comparison',
  繰り返し: 'Loops',
  '算術・乱数': 'Math & Random',
  文字列: 'Text',

  // Blocks - events & info
  '🐍 Pythonコード実行': '🐍 Run Python code',
  '任意のPythonコードをここに記述して実行させます。': 'Run any Python code you write here.',
  '🏁 Botが起動したとき': '🏁 When the bot starts',
  '📩 メッセージを受信したとき': '📩 When a message is received',
  '👤 メンバーが参加したとき': '👤 When a member joins',
  '👋 メンバーが退出したとき': '👋 When a member leaves',
  '受信したメッセージの内容': 'Received message content',
  '⚡ スラッシュコマンド /': '⚡ Slash command /',
  'を使われたとき': 'is used',
  '🗣️ プレフィックスコマンド': '🗣️ Prefix command',
  'を実行したとき': 'is run',
  コマンド引数: 'Command argument',
  'の値': 'value',
  '👤 実行者(対象)の': '👤 Executor (target)',
  'ユーザーID': 'User ID',
  '名前 (ユーザー名)': 'Username',
  '表示名 (ニックネーム)': 'Display name',
  'メンション (<@ID>)': 'Mention (<@ID>)',
  '👤 実行者(対象)の詳細:': '👤 Executor details:',
  アバターURL: 'Avatar URL',
  アカウント作成日: 'Account creation date',
  サーバー参加日: 'Server join date',
  ステータス: 'Status',
  '📺 現在の': '📺 Current',
  チャンネルID: 'Channel ID',
  チャンネル名: 'Channel name',
  'メンション (<#ID>)': 'Mention (<#ID>)',
  '🌐 サーバーの': '🌐 Server',
  サーバーID: 'Server ID',
  サーバー名: 'Server name',
  メンバー数: 'Member count',
  '❓ ユーザー': '❓ User',
  'がロール(ID)': 'has role (ID',
  を持っている: 'has it',
  '🕒 現在時刻 (文字列)': '🕒 Current time (string)',

  // Message blocks
  '↩️ 返信する': '↩️ Reply',
  '自分だけに表示': 'Show only to me',
  '📩 DMを送信 (ユーザーID': '📩 Send DM (user ID',
  ') 内容': ') Content',
  '⏳ 応答を保留する (考え中...)': '⏳ Defer reply (thinking...)',
  自分だけ: 'Only me',
  '✏️ 返信を編集する': '✏️ Edit reply',
  '✏️ 編集: チャンネルID': '✏️ Edit: Channel ID',
  メッセージID: 'Message ID',
  '新しい内容': 'New content',
  '#️⃣ チャンネルID': '#️⃣ Channel ID',
  に送信: 'send',
  '🗑️ このメッセージを削除': '🗑️ Delete this message',
  '🗑️ メッセージを一括削除（': '🗑️ Bulk delete messages (',
  '件）': 'messages)',
  '📌 このメッセージをピン留め': '📌 Pin this message',
  '👍 リアクションを付ける': '👍 Add reaction',
  '🧵 スレッドを作成（名前': '🧵 Create thread (name',
  '⏳ 返信を待つ (最大': '⏳ Wait for reply (max',
  '秒)': 'sec)',
  '🖨️ コンソールに表示': '🖨️ Print to console',

  // Data blocks
  '📂 JSONファイルを読み込む (': '📂 Load JSON file (',
  '💾 データを保存: ': '💾 Save data: ',
  ' ファイル名(': ' file name(',
  '📦 空の辞書(データ)を作成': '📦 Create empty dictionary',
  辞書: 'Dictionary',
  からキー: 'from key',
  'の値を取得': 'get value',
  'のキー': 'key of',
  に値: 'value',
  を設定: 'set',
  を追加: 'add',

  // Voice & channels
  '🔊 実行者のボイスチャンネルに参加': "🔊 Join executor's voice channel",
  '🔊 音楽ファイルを再生': '🔊 Play audio file',
  '(パス)': '(path)',
  'VC内で音楽を再生します。FFmpegが必要です。':
    'Play audio in the voice channel. FFmpeg is required.',
  '🔇 ボイスチャンネルから切断': '🔇 Leave voice channel',
  '📁 テキストチャンネル作成': '📁 Create text channel',
  '🗑️ チャンネル削除 (ID': '🗑️ Delete channel (ID',

  // Bot settings & embeds
  '🎮 ステータスを': '🎮 Set status to',
  プレイ中: 'Playing',
  視聴中: 'Watching',
  再生中: 'Listening',
  にする: 'set',
  秒待つ: 'wait seconds',
  '✨ 新しい埋め込み(Embed)作成': '✨ Create new embed',
  '設定：': 'Settings:',
  タイトル: 'Title',
  'タイトル:': 'Title:',
  説明文: 'Description',
  '色 (0xHex)': 'Color (0xHex)',
  画像URL: 'Image URL',
  項目名: 'Field name',
  内容: 'Content',
  横並び: 'Inline',

  // Moderation & roles
  '🔇 タイムアウト (ID': '🔇 Timeout (ID',
  分: 'minutes',
  '間)': ' minutes)',
  '👢 Kickする (ID': '👢 Kick (ID',
  '🚫 BANする (ID': '🚫 Ban (ID',
  理由: 'Reason',
  '➕ ロール付与 (ユーザーID': '➕ Add role (user ID',
  '➖ ロール剥奪 (ユーザーID': '➖ Remove role (user ID',
  ロールID: 'Role ID',
  '🔰 新規ロール作成 (名前': '🔰 Create role (name',
  '🏷️ ニックネーム変更 (ID': '🏷️ Change nickname (ID',
  '新しい名前': 'New name',

  // Lists, math, text
  リスト: 'List',
  'に項目': 'add item',
  'からランダムに1つ選ぶ': 'pick one at random',
  '🎲 リスト': '🎲 List',
  '🎲 乱数 (最小': '🎲 Random number (min',
  '〜 最大': ' - max',
  テキスト: 'Text',
  'の中の': 'in',
  を: 'to',
  に置換する: 'replace with',

  // Reactions & components
  '⭐ リアクションが付いたとき': '⭐ When a reaction is added',
  'メッセージID(任意):': 'Message ID (optional):',
  '絵文字(任意):': 'Emoji (optional):',
  '🔘 ボタン付きメッセージ送信': '🔘 Send message with button',
  ボタン名: 'Button label',
  ボタンID: 'Button ID',
  '🖱️ ボタンがクリックされたとき': '🖱️ When a button is clicked',
  'ボタンID:': 'Button ID:',
  '📝 モーダル(入力フォーム)を表示': '📝 Show modal (input form)',
  'フォームID:': 'Form ID:',
  '入力項目1:': 'Input item 1:',
  '入力項目2(任意):': 'Input item 2 (optional):',
  '📩 モーダルが送信されたとき': '📩 When the modal is submitted',
  入力項目: 'Input item',
  '1つ目': 'First',
  '2つ目': 'Second',
};

const ATTRIBUTE_TRANSLATIONS = {
  title: {
    'ブロックのみ表示': 'Blocks only',
    リアルタイムコード表示: 'Split view',
  },
};

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'CODE', 'PRE']);
const IGNORE_IDS = new Set(['codeOutput', 'codePreviewContent']);

const TRANSLATIONS = new Map(
  Object.entries(RAW_TRANSLATIONS).map(([ja, en]) => [normalize(ja), en]),
);

const ATTRIBUTE_MAPS = Object.fromEntries(
  Object.entries(ATTRIBUTE_TRANSLATIONS).map(([attr, table]) => [
    attr,
    new Map(Object.entries(table).map(([ja, en]) => [normalize(ja), en])),
  ]),
);

function normalize(text) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

function lookup(text, map = TRANSLATIONS) {
  if (!text) return null;
  const key = normalize(text);
  return map.get(key) || null;
}

function shouldSkipNode(node) {
  if (!node) return true;
  if (node.nodeType === Node.TEXT_NODE) {
    const parent = node.parentElement;
    if (!parent) return false;
    if (IGNORE_IDS.has(parent.id)) return true;
    return SKIP_TAGS.has(parent.tagName);
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return true;
  const el = node;
  if (IGNORE_IDS.has(el.id)) return true;
  if (el.closest('[data-translate-ignore]')) return true;
  return SKIP_TAGS.has(el.tagName);
}

function translateTextNode(node) {
  if (!node || node.nodeType !== Node.TEXT_NODE) return;
  if (shouldSkipNode(node)) return;
  const translated = lookup(node.textContent);
  if (translated) node.textContent = translated;
}

function translateAttributes(el) {
  if (!el || el.nodeType !== Node.ELEMENT_NODE) return;
  for (const [attr, map] of Object.entries(ATTRIBUTE_MAPS)) {
    if (!el.hasAttribute(attr)) continue;
    const translated = lookup(el.getAttribute(attr), map);
    if (translated) el.setAttribute(attr, translated);
  }
}

function walk(node) {
  if (!node || shouldSkipNode(node)) return;
  if (node.nodeType === Node.TEXT_NODE) {
    translateTextNode(node);
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  translateAttributes(node);
  node.childNodes.forEach((child) => walk(child));
}

function translateDom(root = document.body) {
  if (!root) return;
  walk(root);
}

function translateDropdown(field) {
  if (!field || typeof field.getOptions !== 'function') return;
  const generator = field.menuGenerator_;
  if (Array.isArray(generator)) {
    let changed = false;
    const mapped = generator.map(([label, value]) => {
      const translated = lookup(label);
      if (translated && translated !== label) changed = true;
      return [translated || label, value];
    });
    if (changed) {
      field.menuGenerator_ = mapped;
      const current = field.getValue();
      if (current !== null && current !== undefined) {
        field.setValue(current);
      }
    }
  }
  const text = typeof field.getText === 'function' ? field.getText() : null;
  const translatedText = lookup(text);
  if (translatedText && typeof field.setText === 'function') {
    field.setText(translatedText);
  }
}

function translateWorkspace(workspace) {
  if (!workspace || !window.Blockly) return;
  workspace.getAllBlocks(false).forEach((block) => {
    if (block.tooltip) {
      const translatedTooltip = lookup(block.tooltip);
      if (translatedTooltip) block.setTooltip(translatedTooltip);
    }
    block.inputList?.forEach((input) => {
      input.fieldRow?.forEach((field) => {
        if (field instanceof Blockly.FieldDropdown) {
          translateDropdown(field);
        } else if (field instanceof Blockly.FieldLabel) {
          const translated = lookup(field.getText ? field.getText() : null);
          if (translated && typeof field.setText === 'function') {
            field.setText(translated);
          }
        }
      });
    });
  });
}

export function applyTranslations({ workspace, live = true } = {}) {
  const run = () => {
    translateDom();
    translateWorkspace(workspace);
  };

  run();
  if (!live) return;

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'characterData') {
        translateTextNode(mutation.target);
      }
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          translateTextNode(node);
        } else {
          translateDom(node);
        }
      });
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  if (workspace) {
    let timer;
    workspace.addChangeListener(() => {
      clearTimeout(timer);
      timer = setTimeout(() => translateWorkspace(workspace), 0);
    });
  }
}

export const COMMENTS_KEY = 'edbbBlockComments';
const copy = value => JSON.parse(JSON.stringify(value));
const valid = value => value && typeof value.id === 'string' && value.id.length <= 100
  && typeof value.blockId === 'string' && value.blockId.length <= 100
  && typeof value.text === 'string' && value.text.trim() && value.text.length <= 2000
  && typeof value.author === 'string' && value.author.length <= 40
  && Number.isFinite(value.createdAt) && typeof value.resolved === 'boolean';

export class BlockComments {
  constructor(workspace, onChange = () => {}) {
    this.workspace = workspace;
    this.items = new Map();
    this.onChange = onChange;
    const get = workspace.getExtraState?.bind(workspace);
    const set = workspace.setExtraState?.bind(workspace);
    workspace.getExtraState = () => ({ ...get?.(), [COMMENTS_KEY]: this.list() });
    workspace.setExtraState = state => {
      set?.(state);
      this.items = new Map((Array.isArray(state?.[COMMENTS_KEY]) ? state[COMMENTS_KEY] : [])
        .filter(valid).map(item => [item.id, copy(item)]));
      this.onChange();
    };
    workspace.edbbComments = this;
  }
  list() { return [...this.items.values()].map(copy).sort((a, b) => a.createdAt - b.createdAt); }
  apply(operation) {
    if (operation?.action === 'add' && valid(operation.comment)) {
      // Replayed pending operations must be idempotent.
      if (!this.items.has(operation.comment.id)) this.items.set(operation.comment.id, copy(operation.comment));
    } else if (operation?.action === 'resolve' && typeof operation.resolved === 'boolean') {
      const item = this.items.get(operation.id);
      if (item) item.resolved = operation.resolved;
    } else if (operation?.action === 'delete' && typeof operation.id === 'string') {
      this.items.delete(operation.id);
    } else throw new Error('コメントのデータが不正です。');
    this.onChange();
  }
  add(blockId, text, author) {
    if (!this.workspace.getBlockById(blockId)) throw new Error('コメントするブロックを選択してください。');
    const comment = { id: crypto.randomUUID(), blockId, text: text.trim(),
      author: String(author || '自分').slice(0, 40), createdAt: Date.now(), resolved: false };
    const operation = { type: 'comment', action: 'add', comment };
    this.apply(operation);
    return operation;
  }
}

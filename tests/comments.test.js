import test from 'node:test';
import assert from 'node:assert/strict';
import { BlockComments, COMMENTS_KEY } from '../editor/comments.js';

function fixture() {
  const workspace = { extra: { lists: [1] }, getBlockById: id => id === 'a' ? { id } : null,
    getExtraState() { return this.extra; }, setExtraState(value) { this.extra = structuredClone(value); } };
  return { workspace, model: new BlockComments(workspace) };
}

test('comments round-trip with project data, preserve author text and clear on project change', () => {
  const { workspace, model } = fixture();
  const op = model.add('a', '<img src=x onerror=alert(1)>\n質問', '作者');
  const saved = workspace.getExtraState();
  assert.deepEqual(saved.lists, [1]);
  assert.equal(saved[COMMENTS_KEY][0].text, '<img src=x onerror=alert(1)>\n質問');
  model.apply({ action: 'resolve', id: op.comment.id, resolved: true });
  assert.equal(model.list()[0].resolved, true);
  workspace.setExtraState(saved);
  assert.equal(model.list()[0].resolved, false);
  workspace.setExtraState({ lists: [2] });
  assert.deepEqual(model.list(), []);
});

test('independent comments merge, replay is idempotent and concurrent deletion wins over resolution', () => {
  const first = fixture(), second = fixture();
  const a = first.model.add('a', '質問1', 'Alice');
  const b = second.model.add('a', '質問2', 'Bob');
  first.model.apply(b); second.model.apply(a);
  first.model.apply(a);
  assert.equal(first.model.list().length, 2);
  const remove = { action: 'delete', id: a.comment.id };
  const resolve = { action: 'resolve', id: a.comment.id, resolved: true };
  first.model.apply(remove); first.model.apply(resolve);
  second.model.apply(resolve); second.model.apply(remove);
  assert.deepEqual(first.model.list(), second.model.list());
});

test('invalid comments and missing target blocks are rejected', () => {
  const { workspace, model } = fixture();
  assert.throws(() => model.add('missing', '質問', 'Alice'), /ブロック/);
  assert.throws(() => model.add('a', 'x'.repeat(2001), 'Alice'), /不正/);
  assert.throws(() => model.apply({ action: 'add', comment: {} }), /不正/);
  workspace.setExtraState({ [COMMENTS_KEY]: [null, {}, { text: 'bad' }] });
  assert.deepEqual(model.list(), []);
});

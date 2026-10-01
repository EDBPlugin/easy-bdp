import { BlockComments } from './comments.js';
import { element, button, dateLabel, createDialog } from './project-ui.js';

export function setupCommentsUI({ workspace, storage, shareFeature, collabManager }) {
  const ui = createDialog('commentsDialog', 'ブロックコメント');
  const trigger = document.getElementById('commentsBtn');
  let selectedId = null;
  let onlyOpen = true;
  let model;
  const locked = () => shareFeature.isShareViewMode() || collabManager.isSyncing;
  const renderList = () => {
    if (!model) return;
    trigger.title = `コメント（未解決 ${model.list().filter(c => !c.resolved).length}件）`;
    if (!ui.dialog.open) return;
    const block = workspace.getBlockById(selectedId);
    target.textContent = block ? `投稿先: ${block.toString().slice(0, 80)}` : 'コメントするブロックを選択してから開いてください。';
    text.disabled = locked() || !block;
    submit.disabled = locked() || !block;
    ui.status.textContent = locked() ? '閲覧専用です。コメントの投稿・変更は編集開始後に使えます。' : '';
    list.replaceChildren();
    const items = model.list().filter(c => !onlyOpen || !c.resolved).reverse();
    if (!items.length) list.append(element('p', 'コメントはまだありません。', 'project-muted'));
    for (const c of items) {
      const row = element('article', null, `project-card${c.resolved ? ' comment-resolved' : ''}`);
      const related = workspace.getBlockById(c.blockId);
      row.append(element('p', `${c.author} · ${dateLabel(c.createdAt)}${c.resolved ? ' · 解決済み' : ''}`, 'project-muted'));
      row.append(element('p', c.text, 'comment-text'));
      const actions = element('div', null, 'project-toolbar');
      actions.append(button(related ? 'ブロックへ移動' : 'ブロック削除済み', () => {
        ui.dialog.close(); workspace.centerOnBlock(c.blockId); related.select();
      }, !related));
      actions.append(button(c.resolved ? '未解決に戻す' : '解決済みにする', () => update({ type: 'comment', action: 'resolve', id: c.id, resolved: !c.resolved }), locked()));
      // Confirmation remains inside the dialog and never trusts comment HTML.
      actions.append(button('削除', () => {
        actions.replaceChildren(button('削除を確定', () => update({ type: 'comment', action: 'delete', id: c.id }), locked()),
          button('キャンセル', renderList));
      }, locked()));
      row.append(actions); list.append(row);
    }
  };
  const update = operation => {
    if (locked()) return;
    try { model.apply(operation); collabManager.broadcastCommentChange(operation); storage.save(); }
    catch (error) { ui.report(error); }
  };
  const target = element('p', '', 'project-muted');
  const text = element('textarea'); text.rows = 3; text.maxLength = 2000;
  text.placeholder = '質問や修正メモを入力'; text.setAttribute('aria-label', 'コメント本文');
  const form = element('form', null, 'comment-form');
  const submit = button('コメントを投稿', () => {}); submit.type = 'submit';
  form.append(target, text, submit);
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (locked() || !text.value.trim()) return;
    try {
      const operation = model.add(selectedId, text.value, collabManager.myUser.name);
      collabManager.broadcastCommentChange(operation); storage.save(); text.value = ''; renderList();
    } catch (error) { ui.report(error); }
  });
  const filter = element('input'); filter.type = 'checkbox'; filter.checked = true;
  filter.addEventListener('change', () => { onlyOpen = filter.checked; renderList(); });
  const label = element('label', null, 'project-toolbar'); label.append(filter, document.createTextNode('未解決だけ表示'));
  const list = element('div');
  ui.body.append(element('p', 'ブロックを選択して投稿できます。コメントは共同編集で同期され、プロジェクトにも保存されます。', 'project-muted'), form, label, list);
  model = new BlockComments(workspace, renderList);
  const open = block => {
    selectedId = block?.workspace === workspace ? block.id : null;
    ui.open(); renderList(); if (!text.disabled) text.focus();
  };
  trigger.addEventListener('click', () => open(Blockly.getSelected?.()));
  const registry = Blockly.ContextMenuRegistry;
  if (registry && !registry.registry.getItem('edbb_block_comment')) registry.registry.register({
    id: 'edbb_block_comment', scopeType: registry.ScopeType.BLOCK, weight: 20,
    displayText: '共同編集のコメント',
    preconditionFn: scope => scope.block?.workspace === workspace && !scope.block.isShadow() ? 'enabled' : 'hidden',
    callback: scope => open(scope.block),
  });
  workspace.addChangeListener(event => {
    if (event.type === Blockly.Events.SELECTED) selectedId = event.newElementId || null;
    if (ui.dialog.open) renderList();
  });
  collabManager.onStateChange(() => renderList());
  shareFeature.onShareViewModeChange(renderList);
  renderList();
  return model;
}

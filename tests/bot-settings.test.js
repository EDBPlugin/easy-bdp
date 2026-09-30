import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BOT_SETTINGS_EXTRA_STATE_KEY,
  attachBotSettingsState,
  buildIntentsSection,
  normalizeBotSettings,
  normalizeCommandPrefix,
} from '../editor/bot-settings.js';

test('normalizes command prefixes and bot settings safely', () => {
  assert.equal(normalizeCommandPrefix('  edb!  '), 'edb!');
  assert.equal(normalizeCommandPrefix('\n\t'), '!');
  assert.equal(normalizeCommandPrefix('1234567890'), '12345678');
  assert.deepEqual(normalizeBotSettings(null), {
    commandPrefix: '!',
    autoDetectIntents: true,
    messageContent: false,
    members: false,
    presences: false,
    voiceStates: false,
  });
});

test('builds automatic and explicit Discord intent settings', () => {
  const automatic = buildIntentsSection(
    'async def on_message(message):\n    await bot.process_commands(message)\nasync def on_member_join(member):\n    pass\n',
    {},
  );
  assert.match(automatic, /intents\.message_content = True/);
  assert.match(automatic, /intents\.members = True/);

  const explicit = buildIntentsSection('', {
    autoDetectIntents: false,
    presences: true,
    voiceStates: true,
  });
  assert.doesNotMatch(explicit, /message_content/);
  assert.match(explicit, /intents\.presences = True/);
  assert.match(explicit, /intents\.voice_states = True/);
});

test('persists bot settings inside workspace extra state without dropping other data', () => {
  const workspace = {
    getExtraState: () => ({ existing: { keep: true } }),
    setExtraState(state) { this.loadedBase = state; },
  };
  const controller = attachBotSettingsState(workspace);
  controller.set({ commandPrefix: '?', members: true });

  const saved = workspace.getExtraState();
  assert.deepEqual(saved.existing, { keep: true });
  assert.equal(saved[BOT_SETTINGS_EXTRA_STATE_KEY].commandPrefix, '?');
  assert.equal(saved[BOT_SETTINGS_EXTRA_STATE_KEY].members, true);

  workspace.setExtraState({
    existing: { keep: false },
    [BOT_SETTINGS_EXTRA_STATE_KEY]: { commandPrefix: '>', messageContent: true },
  });
  assert.deepEqual(workspace.loadedBase.existing, { keep: false });
  assert.equal(controller.get().commandPrefix, '>');
  assert.equal(controller.get().messageContent, true);
});

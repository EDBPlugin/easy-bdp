Blockly.Python['custom_python_code'] = function (block) {
  const code = block.getFieldValue('CODE');
  return code + '\n';
};
Blockly.Blocks['on_ready'] = {
  init: function () {
    this.appendDummyInput().appendField('🏁 When the bot starts');
    this.appendStatementInput('DO').setCheck(null).appendField('Actions to run');
    this.setColour(30);
    this.setTooltip('Runs once after the bot finishes login and is ready.');
  },
};
Blockly.Blocks['on_message_create'] = {
  init: function () {
    this.appendDummyInput().appendField('📩 When a message is received');
    this.appendStatementInput('DO').setCheck(null).appendField('Actions to run');
    this.setColour(30);
    this.setTooltip('Runs when someone sends a message.');
  },
};
// --- NEW EVENTS ---
Blockly.Blocks['on_member_join'] = {
  init: function () {
    this.appendDummyInput().appendField('👤 When a member joins');
    this.appendStatementInput('DO').setCheck(null).appendField('Actions to run');
    this.setColour(30);
    this.setTooltip('Runs when a new member joins the server.');
  },
};
Blockly.Blocks['on_member_remove'] = {
  init: function () {
    this.appendDummyInput().appendField('👋 When a member leaves');
    this.appendStatementInput('DO').setCheck(null).appendField('Actions to run');
    this.setColour(30);
    this.setTooltip('Runs when a member leaves the server (or is kicked/banned).');
  },
};
// ------------------

Blockly.Blocks['get_message_content'] = {
  init: function () {
    this.appendDummyInput().appendField('Received message content');
    this.setOutput(true, 'String');
    this.setColour(30);
  },
};
Blockly.Blocks['on_command_executed'] = {
  init: function () {
    this.appendDummyInput()
      .appendField('⚡ Slash command /')
      .appendField(new Blockly.FieldTextInput('hello'), 'COMMAND_NAME')
      .appendField('is used');
    this.appendStatementInput('DO').setCheck(null).appendField('Actions to run');
    this.setColour(230);
  },
};
Blockly.Blocks['prefix_command'] = {
  init: function () {
    this.appendDummyInput()
      .appendField('🗣️ Prefix command')
      .appendField(new Blockly.FieldTextInput('!ping'), 'COMMAND_NAME')
      .appendField('is run');
    this.appendStatementInput('DO').setCheck(null).appendField('Actions to run');
    this.setColour(230);
  },
};
Blockly.Blocks['get_command_arg'] = {
  init: function () {
    this.appendDummyInput()
      .appendField('Command argument')
      .appendField(new Blockly.FieldTextInput('name'), 'ARG_NAME')
      .appendField('value');
    this.setOutput(true, ['String', 'Number']);
    this.setColour(230);
  },
};
Blockly.Blocks['get_user_info'] = {
  init: function () {
    this.appendDummyInput()
      .appendField('👤 Executor (target)')
      .appendField(
        new Blockly.FieldDropdown([
          ['User ID', 'id'],
          ['Username', 'name'],
          ['Display name', 'display_name'],
          ['Mention (<@ID>)', 'mention'],
        ]),
        'TYPE',
      );
    this.setOutput(true, 'String');
    this.setColour(260);
  },
};
Blockly.Blocks['get_member_detail'] = {
  init: function () {
    this.appendDummyInput()
      .appendField('👤 Executor details:')
      .appendField(
        new Blockly.FieldDropdown([
          ['Avatar URL', 'avatar.url'],
          ['Account creation date', 'created_at'],
          ['Server join date', 'joined_at'],
          ['Status', 'status'],
        ]),
        'TYPE',
      );
    this.setOutput(true, 'String');
    this.setColour(260);
  },
};
Blockly.Blocks['get_channel_info'] = {
  init: function () {
    this.appendDummyInput()
      .appendField('📺 Current')
      .appendField(
        new Blockly.FieldDropdown([
          ['Channel ID', 'id'],
          ['Channel name', 'name'],
          ['Mention (<#ID>)', 'mention'],
        ]),
        'TYPE',
      );
    this.setOutput(true, 'String');
    this.setColour(260);
  },
};
Blockly.Blocks['get_server_info'] = {
  init: function () {
    this.appendDummyInput()
      .appendField('🌐 Server')
      .appendField(
        new Blockly.FieldDropdown([
          ['Server ID', 'id'],
          ['Server name', 'name'],
          ['Member count', 'member_count'],
        ]),
        'TYPE',
      );
    this.setOutput(true, ['String', 'Number']);
    this.setColour(260);
  },
};
Blockly.Blocks['member_has_role'] = {
  init: function () {
    this.appendValueInput('USER').setCheck('String').appendField('❓ User');
    this.appendValueInput('ROLE_ID').setCheck('String').appendField('has role (ID');
    this.appendDummyInput().appendField('has it');
    this.setOutput(true, 'Boolean');
    this.setColour(260);
  },
};
Blockly.Blocks['get_current_time'] = {
  init: function () {
    this.appendDummyInput().appendField('🕒 Current time (string)');
    this.setOutput(true, 'String');
    this.setColour(260);
  },
};
Blockly.Blocks['reply_message'] = {
  init: function () {
    this.appendValueInput('MESSAGE').setCheck(['String', 'Embed']).appendField('↩️ Reply');
    this.appendDummyInput()
      .appendField('Show only to me')
      .appendField(new Blockly.FieldCheckbox('FALSE'), 'EPHEMERAL');
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(160);
  },
};
// --- NEW DM BLOCK ---
Blockly.Blocks['send_dm'] = {
  init: function () {
    this.appendValueInput('USER_ID').setCheck('String').appendField('📩 Send DM (user ID');
    this.appendValueInput('MESSAGE').setCheck(['String', 'Embed']).appendField(') Content');
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(160);
  },
};
// --------------------
Blockly.Blocks['defer_reply'] = {
  init: function () {
    this.appendDummyInput()
      .appendField('⏳ Defer reply (thinking...)')
      .appendField('Only me')
      .appendField(new Blockly.FieldCheckbox('FALSE'), 'EPHEMERAL');
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(160);
  },
};
Blockly.Blocks['edit_reply'] = {
  init: function () {
    this.appendValueInput('MESSAGE').setCheck(['String', 'Embed']).appendField('✏️ Edit reply');
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(160);
  },
};
Blockly.Blocks['edit_message_by_id'] = {
  init: function () {
    this.appendValueInput('CHANNEL_ID').setCheck('String').appendField('✏️ Edit: Channel ID');
    this.appendValueInput('MESSAGE_ID').setCheck('String').appendField('Message ID');
    this.appendValueInput('CONTENT').setCheck('String').appendField('New content');
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(160);
  },
};
Blockly.Blocks['send_channel_message'] = {
  init: function () {
    this.appendValueInput('CHANNEL_ID').setCheck('String').appendField('#️⃣ Channel ID');
    this.appendValueInput('MESSAGE').setCheck(['String', 'Embed']).appendField('send');
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(160);
  },
};
Blockly.Blocks['delete_message'] = {
  init: function () {
    this.appendDummyInput().appendField('🗑️ Delete this message');
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(160);
  },
};
Blockly.Blocks['purge_messages'] = {
  init: function () {
    this.appendValueInput('LIMIT').setCheck('Number').appendField('🗑️ Bulk delete messages (');
    this.appendDummyInput().appendField('messages)');
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(160);
  },
};
Blockly.Blocks['pin_message'] = {
  init: function () {
    this.appendDummyInput().appendField('📌 Pin this message');
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(160);
  },
};
Blockly.Blocks['add_reaction'] = {
  init: function () {
    this.appendValueInput('EMOJI').setCheck('String').appendField('👍 Add reaction');
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(160);
  },
};
Blockly.Blocks['create_thread'] = {
  init: function () {
    this.appendValueInput('NAME').setCheck('String').appendField('🧵 Create thread (name');
    this.appendDummyInput().appendField('）');
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(160);
  },
};
Blockly.Blocks['wait_for_message'] = {
  init: function () {
    this.appendValueInput('TIMEOUT').setCheck('Number').appendField('⏳ Wait for reply (max');
    this.appendDummyInput().appendField('sec)');
    this.setOutput(true, 'String');
    this.setColour(290);
  },
};
Blockly.Blocks['print_to_console'] = {
  init: function () {
    this.appendValueInput('TEXT').setCheck(null).appendField('🖨️ Print to console');
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(160);
  },
};
Blockly.Blocks['json_load'] = {
  init: function () {
    this.appendValueInput('FILENAME').setCheck('String').appendField('📂 Load JSON file (');
    this.appendDummyInput().appendField(')');
    this.setOutput(true, null);
    this.setColour(30);
  },
};
Blockly.Blocks['json_save'] = {
  init: function () {
    this.appendValueInput('DATA').setCheck(null).appendField('💾 Save data: ');
    this.appendValueInput('FILENAME').setCheck('String').appendField(' file name(');
    this.appendDummyInput().appendField(')');
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(30);
  },
};
Blockly.Blocks['dict_create'] = {
  init: function () {
    this.appendDummyInput().appendField('📦 Create empty dictionary');
    this.setOutput(true, null);
    this.setColour(30);
  },
};
Blockly.Blocks['dict_get'] = {
  init: function () {
    this.appendValueInput('DICT').setCheck(null).appendField('Dictionary');
    this.appendValueInput('KEY').setCheck('String').appendField('from key');
    this.appendDummyInput().appendField('get value');
    this.setOutput(true, null);
    this.setColour(30);
  },
};
Blockly.Blocks['dict_set'] = {
  init: function () {
    this.appendValueInput('DICT').setCheck(null).appendField('Dictionary');
    this.appendValueInput('KEY').setCheck('String').appendField('key of');
    this.appendValueInput('VALUE').setCheck(null).appendField('value');
    this.appendDummyInput().appendField('set');
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(30);
  },
};
Blockly.Blocks['join_voice_channel'] = {
  init: function () {
    this.appendDummyInput().appendField("🔊 Join executor's voice channel");
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(340);
  },
};
// --- NEW AUDIO PLAY BLOCK ---
Blockly.Blocks['play_audio_file'] = {
  init: function () {
    this.appendValueInput('FILEPATH').setCheck('String').appendField('🔊 Play audio file');
    this.appendDummyInput().appendField('(path)');
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(340);
    this.setTooltip('');
  },
};
// ----------------------------
Blockly.Blocks['leave_voice_channel'] = {
  init: function () {
    this.appendDummyInput().appendField('🔇 Leave voice channel');
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(340);
  },
};
Blockly.Blocks['create_text_channel'] = {
  init: function () {
    this.appendValueInput('NAME').setCheck('String').appendField('📁 Create text channel');
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(340);
  },
};
Blockly.Blocks['delete_channel'] = {
  init: function () {
    this.appendValueInput('CHANNEL_ID').setCheck('String').appendField('🗑️ Delete channel (ID');
    this.appendDummyInput().appendField(')');
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(340);
  },
};
Blockly.Blocks['set_bot_status'] = {
  init: function () {
    this.appendValueInput('STATUS').setCheck('String').appendField('🎮 Set status to');
    this.appendDummyInput()
      .appendField(
        new Blockly.FieldDropdown([
          ['Playing', 'playing'],
          ['Watching', 'watching'],
          ['Listening', 'listening'],
        ]),
        'TYPE',
      )
      .appendField('set');
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(260);
  },
};
Blockly.Blocks['wait_seconds'] = {
  init: function () {
    this.appendValueInput('SECONDS').setCheck('Number').appendField('⏳');
    this.appendDummyInput().appendField('wait seconds');
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(260);
  },
};
Blockly.Blocks['create_embed'] = {
  init: function () {
    this.appendDummyInput().appendField('✨ Create new embed');
    this.appendStatementInput('PROPERTIES').setCheck(null);
    this.setOutput(true, 'Embed');
    this.setColour(100);
  },
};
Blockly.Blocks['set_embed_property'] = {
  init: function () {
    this.appendValueInput('VALUE')
      .setCheck('String')
      .appendField('Settings:')
      .appendField(
        new Blockly.FieldDropdown([
          ['Title', 'title'],
          ['Description', 'description'],
          ['Color (0xHex)', 'color'],
          ['Image URL', 'image'],
        ]),
        'PROPERTY',
      );
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(100);
  },
};
Blockly.Blocks['add_embed_field'] = {
  init: function () {
    this.appendValueInput('NAME').setCheck('String').appendField('Field name');
    this.appendValueInput('VALUE').setCheck('String').appendField('Content');
    this.appendDummyInput()
      .appendField('Inline')
      .appendField(new Blockly.FieldCheckbox('TRUE'), 'INLINE');
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(100);
  },
};
Blockly.Blocks['kick_user'] = {
  init: function () {
    this.appendValueInput('USER_ID').setCheck('String').appendField('👢 Kick (ID');
    this.appendValueInput('REASON').setCheck('String').appendField('Reason');
    this.appendDummyInput().appendField(')');
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(0);
  },
};
Blockly.Blocks['ban_user'] = {
  init: function () {
    this.appendValueInput('USER_ID').setCheck('String').appendField('🚫 Ban (ID');
    this.appendValueInput('REASON').setCheck('String').appendField('Reason');
    this.appendDummyInput().appendField(')');
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(0);
  },
};
Blockly.Blocks['timeout_user'] = {
  init: function () {
    this.appendValueInput('USER_ID').setCheck('String').appendField('🔇 Timeout (ID');
    this.appendValueInput('MINUTES').setCheck('Number').appendField('minutes');
    this.appendDummyInput().appendField(' minutes)');
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(0);
  },
};
Blockly.Blocks['add_user_role'] = {
  init: function () {
    this.appendValueInput('USER_ID').setCheck('String').appendField('➕ Add role (user ID');
    this.appendValueInput('ROLE_ID').setCheck('String').appendField('Role ID');
    this.appendDummyInput().appendField(')');
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(0);
  },
};
Blockly.Blocks['remove_user_role'] = {
  init: function () {
    this.appendValueInput('USER_ID').setCheck('String').appendField('➖ Remove role (user ID');
    this.appendValueInput('ROLE_ID').setCheck('String').appendField('Role ID');
    this.appendDummyInput().appendField(')');
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(0);
  },
};
Blockly.Blocks['create_role'] = {
  init: function () {
    this.appendValueInput('NAME').setCheck('String').appendField('🔰 Create role (name');
    this.appendDummyInput().appendField(')');
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(0);
  },
};
Blockly.Blocks['change_nickname'] = {
  init: function () {
    this.appendValueInput('USER_ID').setCheck('String').appendField('🏷️ Change nickname (ID');
    this.appendValueInput('NAME').setCheck('String').appendField('New name');
    this.appendDummyInput().appendField(')');
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(0);
  },
};
Blockly.Blocks['lists_append_to'] = {
  init: function () {
    this.appendValueInput('LIST').setCheck('Array').appendField('List');
    this.appendValueInput('ITEM').setCheck(null).appendField('add item');
    this.appendDummyInput().appendField('add');
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(210);
  },
};
Blockly.Blocks['random_choice'] = {
  init: function () {
    this.appendValueInput('LIST').setCheck('Array').appendField('🎲 List');
    this.appendDummyInput().appendField('pick one at random');
    this.setOutput(true, null);
    this.setColour(230);
  },
};
Blockly.Blocks['random_integer'] = {
  init: function () {
    this.appendValueInput('FROM').setCheck('Number').appendField('🎲 Random number (min');
    this.appendValueInput('TO').setCheck('Number').appendField(' - max');
    this.appendDummyInput().appendField(')');
    this.setInputsInline(true);
    this.setOutput(true, 'Number');
    this.setColour(230);
  },
};
Blockly.Blocks['text_replace'] = {
  init: function () {
    this.appendValueInput('TEXT').setCheck('String').appendField('Text');
    this.appendValueInput('FROM').setCheck('String').appendField('in');
    this.appendValueInput('TO').setCheck('String').appendField('to');
    this.appendDummyInput().appendField('replace with');
    this.setInputsInline(true);
    this.setOutput(true, 'String');
    this.setColour(160);
  },
};

// New Blocks
Blockly.Blocks['on_reaction_add'] = {
  init: function () {
    this.appendDummyInput().appendField('⭐ When a reaction is added');
    this.appendDummyInput()
      .appendField('Message ID (optional):')
      .appendField(new Blockly.FieldTextInput(''), 'MESSAGE_ID');
    this.appendDummyInput()
      .appendField('Emoji (optional):')
      .appendField(new Blockly.FieldTextInput(''), 'EMOJI');
    this.appendStatementInput('DO').setCheck(null).appendField('Actions to run');
    this.setColour(30);
  },
};
Blockly.Blocks['send_button_message'] = {
  init: function () {
    this.appendValueInput('MESSAGE').setCheck('String').appendField('🔘 Send message with button');
    this.appendDummyInput()
      .appendField('Button label')
      .appendField(new Blockly.FieldTextInput('Click Me'), 'LABEL');
    this.appendDummyInput()
      .appendField('Button ID:')
      .appendField(new Blockly.FieldTextInput('button_1'), 'CUSTOM_ID');
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(350);
  },
};
Blockly.Blocks['on_button_click'] = {
  init: function () {
    this.appendDummyInput().appendField('🖱️ When a button is clicked');
    this.appendDummyInput()
      .appendField('Button ID:')
      .appendField(new Blockly.FieldTextInput('button_1'), 'CUSTOM_ID');
    this.appendStatementInput('DO').setCheck(null).appendField('Actions to run');
    this.setColour(350);
  },
};
Blockly.Blocks['show_modal'] = {
  init: function () {
    this.appendDummyInput().appendField('📝 Show modal (input form)');
    this.appendDummyInput()
      .appendField('Title:')
      .appendField(new Blockly.FieldTextInput('My Form'), 'TITLE');
    this.appendDummyInput()
      .appendField('Form ID:')
      .appendField(new Blockly.FieldTextInput('modal_1'), 'CUSTOM_ID');
    this.appendDummyInput()
      .appendField('Input item 1:')
      .appendField(new Blockly.FieldTextInput('Name'), 'LABEL1');
    this.appendDummyInput()
      .appendField('Input item 2 (optional):')
      .appendField(new Blockly.FieldTextInput(''), 'LABEL2');
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(350);
  },
};
Blockly.Blocks['on_modal_submit'] = {
  init: function () {
    this.appendDummyInput().appendField('📩 When the modal is submitted');
    this.appendDummyInput()
      .appendField('Form ID:')
      .appendField(new Blockly.FieldTextInput('modal_1'), 'CUSTOM_ID');
    this.appendStatementInput('DO').setCheck(null).appendField('Actions to run');
    this.setColour(350);
  },
};
Blockly.Blocks['get_input_value'] = {
  init: function () {
    this.appendDummyInput()
      .appendField('Input item')
      .appendField(
        new Blockly.FieldDropdown([
          ['First', '0'],
          ['Second', '1'],
        ]),
        'INDEX',
      )
      .appendField('value');
    this.setOutput(true, 'String');
    this.setColour(350);
  },
};

// Code Generators (Include previous ones)
const getBranchCode = (block, name) => {
  let code = Blockly.Python.statementToCode(block, name);
  if (!code || code.trim() === '') return Blockly.Python.INDENT + 'pass\n';
  return code;
};

Blockly.Python['on_ready'] = function (block) {
  const branch = getBranchCode(block, 'DO');
  return `\n@bot.event\nasync def on_ready():\n    print(f'Logged in as {bot.user}')\n    try:\n        synced = await bot.tree.sync()\n        print(f"Synced {len(synced)} command(s)")\n    except Exception as e:\n        print(e)\n${branch.trimEnd()}\n`;
};
Blockly.Python['on_message_create'] = function (block) {
  const branch = getBranchCode(block, 'DO');
  return `\n@bot.event\nasync def on_message(message):\n    if message.author == bot.user:\n        return\n    ctx = message\n    user = message.author\n${branch.trimEnd()}\n    await bot.process_commands(message)\n`;
};

// --- Generators for New Events ---
Blockly.Python['on_member_join'] = function (block) {
  const branch = getBranchCode(block, 'DO');
  return `\n@bot.event\nasync def on_member_join(member):\n    user = member\n    ctx = member\n${branch.trimEnd()}\n`;
};
Blockly.Python['on_member_remove'] = function (block) {
  const branch = getBranchCode(block, 'DO');
  return `\n@bot.event\nasync def on_member_remove(member):\n    user = member\n    ctx = member\n${branch.trimEnd()}\n`;
};
// ---------------------------------

Blockly.Python['get_message_content'] = function (block) {
  return [
    '(ctx.content if "ctx" in locals() and hasattr(ctx, "content") else "")',
    Blockly.Python.ORDER_ATOMIC,
  ];
};
Blockly.Python['on_command_executed'] = function (block) {
  const commandName = block.getFieldValue('COMMAND_NAME').toLowerCase();
  const branch = getBranchCode(block, 'DO');
  return `\n@bot.tree.command(name="${commandName}", description="${commandName} command")\nasync def ${commandName}_cmd(interaction: discord.Interaction):\n    ctx = interaction\n    user = interaction.user\n${branch.trimEnd()}\n`;
};
Blockly.Python['prefix_command'] = function (block) {
  const commandName = block.getFieldValue('COMMAND_NAME').replace(/^[!~#&?]/, '');
  const branch = getBranchCode(block, 'DO');
  return `\n@bot.command(name='${commandName}')\nasync def ${commandName}_cmd(ctx):\n    user = ctx.author\n${branch.trimEnd()}\n`;
};
Blockly.Python['get_command_arg'] = function (block) {
  const argName = block.getFieldValue('ARG_NAME');
  return [`# Argument '${argName}' needed`, Blockly.Python.ORDER_ATOMIC];
};
Blockly.Python['get_user_info'] = function (block) {
  const type = block.getFieldValue('TYPE');
  let code = `user.${type}`;
  if (type === 'name') code = 'user.name';
  if (type === 'display_name') code = 'user.display_name';
  return [`(${code} if "user" in locals() else "Unknown")`, Blockly.Python.ORDER_ATOMIC];
};
Blockly.Python['get_member_detail'] = function (block) {
  const type = block.getFieldValue('TYPE');
  let code = `user.${type}`;
  if (type === 'avatar.url') code = 'str(user.avatar.url) if user.avatar else ""';
  if (type === 'created_at') code = 'str(user.created_at.strftime("%Y-%m-%d %H:%M"))';
  if (type === 'joined_at')
    code = 'str(user.joined_at.strftime("%Y-%m-%d %H:%M")) if hasattr(user, "joined_at") else ""';
  if (type === 'status') code = 'str(user.status) if hasattr(user, "status") else "unknown"';
  return [`(${code} if "user" in locals() else "Unknown")`, Blockly.Python.ORDER_ATOMIC];
};
Blockly.Python['get_channel_info'] = function (block) {
  const type = block.getFieldValue('TYPE');
  let code = `ctx.channel.${type}`;
  // For member events (ctx=member), use member.guild.system_channel or similar if needed, but usually channel info is for messages
  return [
    `(${code} if "ctx" in locals() and hasattr(ctx, "channel") else "Unknown")`,
    Blockly.Python.ORDER_ATOMIC,
  ];
};
Blockly.Python['get_server_info'] = function (block) {
  const type = block.getFieldValue('TYPE');
  let code = `ctx.guild.${type}`;
  return [
    `(${code} if "ctx" in locals() and hasattr(ctx, "guild") and ctx.guild else "Unknown")`,
    Blockly.Python.ORDER_ATOMIC,
  ];
};
Blockly.Python['member_has_role'] = function (block) {
  const userCode = Blockly.Python.valueToCode(block, 'USER', Blockly.Python.ORDER_NONE) || '0';
  const roleId = Blockly.Python.valueToCode(block, 'ROLE_ID', Blockly.Python.ORDER_NONE) || '0';
  const code = `(discord.utils.get(ctx.guild.get_member(int(${userCode})).roles, id=int(${roleId})) is not None if "ctx" in locals() and ctx.guild and str(${userCode}).isdigit() and str(${roleId}).isdigit() else False)`;
  return [code, Blockly.Python.ORDER_ATOMIC];
};
Blockly.Python['get_current_time'] = function (block) {
  return [`datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')`, Blockly.Python.ORDER_ATOMIC];
};
Blockly.Python['reply_message'] = function (block) {
  const msg = Blockly.Python.valueToCode(block, 'MESSAGE', Blockly.Python.ORDER_NONE) || '""';
  const ephemeral = block.getFieldValue('EPHEMERAL') === 'TRUE' ? 'True' : 'False';
  let contentCode = msg.startsWith('discord.Embed') ? `embed=${msg}` : `content=${msg}`;
  return `\nif 'ctx' in locals():\n    if isinstance(ctx, discord.Interaction):\n        if ctx.response.is_done():\n            await ctx.followup.send(${contentCode}, ephemeral=${ephemeral})\n        else:\n            await ctx.response.send_message(${contentCode}, ephemeral=${ephemeral})\n    elif isinstance(ctx, commands.Context):\n        await ctx.send(${contentCode})\n    elif isinstance(ctx, discord.Message):\n        await ctx.reply(${contentCode})\n`;
};
// --- NEW DM GENERATOR ---
Blockly.Python['send_dm'] = function (block) {
  const userId = Blockly.Python.valueToCode(block, 'USER_ID', Blockly.Python.ORDER_NONE) || '0';
  const msg = Blockly.Python.valueToCode(block, 'MESSAGE', Blockly.Python.ORDER_NONE) || '""';
  const contentCode = msg.startsWith('discord.Embed') ? `embed=${msg}` : `content=${msg}`;
  return `\n_u_dm = bot.get_user(int(${userId})) or await bot.fetch_user(int(${userId}))\nif _u_dm:\n    await _u_dm.send(${contentCode})\n`;
};
// ------------------------

Blockly.Python['defer_reply'] = function (block) {
  const ephemeral = block.getFieldValue('EPHEMERAL') === 'TRUE' ? 'True' : 'False';
  return `\nif 'ctx' in locals():\n    if isinstance(ctx, discord.Interaction):\n        await ctx.response.defer(ephemeral=${ephemeral})\n    elif isinstance(ctx, commands.Context):\n        async with ctx.typing(): pass\n`;
};
Blockly.Python['edit_reply'] = function (block) {
  const msg = Blockly.Python.valueToCode(block, 'MESSAGE', Blockly.Python.ORDER_NONE) || '""';
  let contentCode = msg.startsWith('discord.Embed') ? `embed=${msg}` : `content=${msg}`;
  return `\nif 'ctx' in locals() and isinstance(ctx, discord.Interaction):\n    await ctx.edit_original_response(${contentCode})\n`;
};
Blockly.Python['edit_message_by_id'] = function (block) {
  const channelId =
    Blockly.Python.valueToCode(block, 'CHANNEL_ID', Blockly.Python.ORDER_NONE) || '0';
  const messageId =
    Blockly.Python.valueToCode(block, 'MESSAGE_ID', Blockly.Python.ORDER_NONE) || '0';
  const content = Blockly.Python.valueToCode(block, 'CONTENT', Blockly.Python.ORDER_NONE) || '""';
  return `\ntry:\n    _ch = bot.get_channel(int(${channelId}))\n    if _ch:\n        _msg = await _ch.fetch_message(int(${messageId}))\n        if _msg: await _msg.edit(content=${content})\nexcept Exception as e:\n    print(f"Edit Error: {e}")\n`;
};
Blockly.Python['send_channel_message'] = function (block) {
  const channelId =
    Blockly.Python.valueToCode(block, 'CHANNEL_ID', Blockly.Python.ORDER_NONE) || '0';
  const msg = Blockly.Python.valueToCode(block, 'MESSAGE', Blockly.Python.ORDER_NONE) || '""';
  const contentArg = msg.startsWith('discord.Embed') ? `embed=${msg}` : `content=${msg}`;
  return `\n_ch_id = int(${channelId}) if str(${channelId}).isdigit() else 0\n_channel = bot.get_channel(_ch_id)\nif _channel:\n    await _channel.send(${contentArg})\n`;
};
Blockly.Python['delete_message'] = function (block) {
  return `\nif 'ctx' in locals():\n    if isinstance(ctx, discord.Message):\n        await ctx.delete()\n    elif isinstance(ctx, commands.Context):\n        await ctx.message.delete()\n`;
};
Blockly.Python['purge_messages'] = function (block) {
  const limit = Blockly.Python.valueToCode(block, 'LIMIT', Blockly.Python.ORDER_NONE) || '5';
  return `\nif 'ctx' in locals() and hasattr(ctx, 'channel') and hasattr(ctx.channel, 'purge'):\n    await ctx.channel.purge(limit=int(${limit}))\n`;
};
Blockly.Python['pin_message'] = function (block) {
  return `\nif 'ctx' in locals():\n    if isinstance(ctx, discord.Message):\n        await ctx.pin()\n    elif isinstance(ctx, commands.Context):\n        await ctx.message.pin()\n`;
};
Blockly.Python['add_reaction'] = function (block) {
  const emoji = Blockly.Python.valueToCode(block, 'EMOJI', Blockly.Python.ORDER_NONE) || '"👍"';
  return `\ntry:\n    if 'ctx' in locals():\n        if isinstance(ctx, discord.Message): \n            await ctx.add_reaction(${emoji})\n        elif isinstance(ctx, commands.Context): \n            await ctx.message.add_reaction(${emoji})\nexcept Exception:\n    pass\n`;
};
Blockly.Python['create_thread'] = function (block) {
  const name =
    Blockly.Python.valueToCode(block, 'NAME', Blockly.Python.ORDER_NONE) || '"New Thread"';
  return `\ntry:\n    if 'ctx' in locals():\n        if isinstance(ctx, discord.Message): \n            await ctx.create_thread(name=${name})\n        elif isinstance(ctx, commands.Context): \n            await ctx.message.create_thread(name=${name})\nexcept Exception:\n    pass\n`;
};
Blockly.Python['wait_for_message'] = function (block) {
  const timeout = Blockly.Python.valueToCode(block, 'TIMEOUT', Blockly.Python.ORDER_NONE) || '30';
  const code =
    `\n(await bot.wait_for('message', check=lambda m: m.channel == ctx.channel and m.author == user, timeout=${timeout})).content\n`.trim();
  return [code, Blockly.Python.ORDER_ATOMIC];
};
Blockly.Python['print_to_console'] = function (block) {
  const text = Blockly.Python.valueToCode(block, 'TEXT', Blockly.Python.ORDER_NONE) || '""';
  return `print(${text})\n`;
};
// データ保存(JSON)
Blockly.Python['json_load'] = function(block) {
    const key = Blockly.Python.valueToCode(block, 'FILENAME', Blockly.Python.ORDER_NONE) || '"key"';
    return [`_load_json_data(${key})`, Blockly.Python.ORDER_ATOMIC];
};
Blockly.Python['json_save'] = function(block) {
    const key = Blockly.Python.valueToCode(block, 'FILENAME', Blockly.Python.ORDER_NONE) || '"key"';
    const value = Blockly.Python.valueToCode(block, 'DATA', Blockly.Python.ORDER_NONE) || 'None';
    return `_save_json_data(${key}, ${value})\n`;
};
Blockly.Python['dict_create'] = function (block) {
  return ['{}', Blockly.Python.ORDER_ATOMIC];
};
Blockly.Python['dict_get'] = function (block) {
  const dictCode = Blockly.Python.valueToCode(block, 'DICT', Blockly.Python.ORDER_NONE) || '{}';
  const keyCode = Blockly.Python.valueToCode(block, 'KEY', Blockly.Python.ORDER_NONE) || '""';
  const code = `(${dictCode}.get(${keyCode}, None))`;
  return [code, Blockly.Python.ORDER_ATOMIC];
};
Blockly.Python['dict_set'] = function (block) {
  const dictCode = Blockly.Python.valueToCode(block, 'DICT', Blockly.Python.ORDER_NONE) || '{}';
  const keyCode = Blockly.Python.valueToCode(block, 'KEY', Blockly.Python.ORDER_NONE) || '""';
  const valueCode = Blockly.Python.valueToCode(block, 'VALUE', Blockly.Python.ORDER_NONE) || 'None';
  return `${dictCode}.update({${keyCode}: ${valueCode}})\n`;
};
// Channels & Voice
Blockly.Python['join_voice_channel'] = function (block) {
  return `\nif 'user' in locals() and user.voice:\n    await user.voice.channel.connect()\n`;
};
// --- NEW AUDIO PLAY GENERATOR ---
Blockly.Python['play_audio_file'] = function (block) {
  const path = Blockly.Python.valueToCode(block, 'FILEPATH', Blockly.Python.ORDER_NONE) || '""';
  return `\nif 'ctx' in locals() and ctx.guild.voice_client:\n    if not ctx.guild.voice_client.is_playing():\n        ctx.guild.voice_client.play(discord.FFmpegPCMAudio(${path}))\n`;
};
// --------------------------------
Blockly.Python['leave_voice_channel'] = function (block) {
  return `\nif 'ctx' in locals() and ctx.guild.voice_client:\n    await ctx.guild.voice_client.disconnect()\n`;
};
Blockly.Python['create_text_channel'] = function (block) {
  const name =
    Blockly.Python.valueToCode(block, 'NAME', Blockly.Python.ORDER_NONE) || '"new-channel"';
  return `\nif 'ctx' in locals() and ctx.guild:\n    await ctx.guild.create_text_channel(name=${name})\n`;
};
Blockly.Python['delete_channel'] = function (block) {
  const channelId =
    Blockly.Python.valueToCode(block, 'CHANNEL_ID', Blockly.Python.ORDER_NONE) || '0';
  return `\n_ch = bot.get_channel(int(${channelId}))\nif _ch:\n    await _ch.delete()\n`;
};
Blockly.Python['set_bot_status'] = function (block) {
  const status = Blockly.Python.valueToCode(block, 'STATUS', Blockly.Python.ORDER_NONE) || '"Bot"';
  const type = block.getFieldValue('TYPE');
  let activityCode = `discord.Game(name=${status})`;
  if (type === 'watching')
    activityCode = `discord.Activity(type=discord.ActivityType.watching, name=${status})`;
  if (type === 'listening')
    activityCode = `discord.Activity(type=discord.ActivityType.listening, name=${status})`;
  return `await bot.change_presence(activity=${activityCode})\n`;
};
Blockly.Python['wait_seconds'] = function (block) {
  const sec = Blockly.Python.valueToCode(block, 'SECONDS', Blockly.Python.ORDER_NONE) || '1';
  return `await asyncio.sleep(${sec})\n`;
};
Blockly.Python['create_embed'] = function (block) {
  const embedVarName = Blockly.Python.variableDB_.getDistinctName(
    'embed',
    Blockly.Names.VARIABLE_NAME,
  );
  let code =
    `\n${embedVarName} = discord.Embed(title="No Title", description="...", color=0x3498DB)\n`.trim() +
    '\n';
  const propertiesCode = Blockly.Python.statementToCode(block, 'PROPERTIES');
  const lines = propertiesCode.split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    if (line.includes('# EMBED_VAR_PLACEHOLDER')) {
      code += line.replace(/# EMBED_VAR_PLACEHOLDER/g, embedVarName) + '\n';
    } else if (line.trim().startsWith('embed.')) {
      code += line.replace(/embed\./g, `${embedVarName}.`) + '\n';
    }
  }
  return [`${embedVarName}`, Blockly.Python.ORDER_ATOMIC];
};
Blockly.Python['set_embed_property'] = function (block) {
  const property = block.getFieldValue('PROPERTY');
  const value = Blockly.Python.valueToCode(block, 'VALUE', Blockly.Python.ORDER_NONE) || '""';
  if (property === 'color') return `embed.color = ${value}\n`;
  if (property === 'image') return `embed.set_image(url=${value})\n`;
  if (property === 'title') return `embed.title = ${value}\n`;
  if (property === 'description') return `embed.description = ${value}\n`;
  return '';
};
Blockly.Python['add_embed_field'] = function (block) {
  const name = Blockly.Python.valueToCode(block, 'NAME', Blockly.Python.ORDER_NONE) || '"Name"';
  const value = Blockly.Python.valueToCode(block, 'VALUE', Blockly.Python.ORDER_NONE) || '"Value"';
  const inline = block.getFieldValue('INLINE') === 'TRUE' ? 'True' : 'False';
  return `# EMBED_VAR_PLACEHOLDER.add_field(name=${name}, value=${value}, inline=${inline})\n`;
};
Blockly.Python['kick_user'] = function (block) {
  const user = Blockly.Python.valueToCode(block, 'USER_ID', Blockly.Python.ORDER_NONE) || '0';
  const reason = Blockly.Python.valueToCode(block, 'REASON', Blockly.Python.ORDER_NONE) || 'None';
  return `\nif 'ctx' in locals() and ctx.guild:\n    _m = ctx.guild.get_member(int(${user}))\n    if _m: await _m.kick(reason=${reason})\n`;
};
Blockly.Python['ban_user'] = function (block) {
  const user = Blockly.Python.valueToCode(block, 'USER_ID', Blockly.Python.ORDER_NONE) || '0';
  const reason = Blockly.Python.valueToCode(block, 'REASON', Blockly.Python.ORDER_NONE) || 'None';
  return `\nif 'ctx' in locals() and ctx.guild:\n    _m = ctx.guild.get_member(int(${user}))\n    if _m: await _m.ban(reason=${reason})\n`;
};
Blockly.Python['timeout_user'] = function (block) {
  const user = Blockly.Python.valueToCode(block, 'USER_ID', Blockly.Python.ORDER_NONE) || '0';
  const mins = Blockly.Python.valueToCode(block, 'MINUTES', Blockly.Python.ORDER_NONE) || '5';
  return `\nif 'ctx' in locals() and ctx.guild:\n    _m = ctx.guild.get_member(int(${user}))\n    if _m:\n        await _m.timeout(datetime.timedelta(minutes=int(${mins})))\n`;
};
Blockly.Python['add_user_role'] = function (block) {
  const user = Blockly.Python.valueToCode(block, 'USER_ID', Blockly.Python.ORDER_NONE) || '0';
  const role = Blockly.Python.valueToCode(block, 'ROLE_ID', Blockly.Python.ORDER_NONE) || '0';
  return `\nif 'ctx' in locals() and ctx.guild:\n    _m = ctx.guild.get_member(int(${user}))\n    _r = ctx.guild.get_role(int(${role}))\n    if _m and _r: await _m.add_roles(_r)\n`;
};
Blockly.Python['remove_user_role'] = function (block) {
  const user = Blockly.Python.valueToCode(block, 'USER_ID', Blockly.Python.ORDER_NONE) || '0';
  const role = Blockly.Python.valueToCode(block, 'ROLE_ID', Blockly.Python.ORDER_NONE) || '0';
  return `\nif 'ctx' in locals() and ctx.guild:\n    _m = ctx.guild.get_member(int(${user}))\n    _r = ctx.guild.get_role(int(${role}))\n    if _m and _r: await _m.remove_roles(_r)\n`;
};
Blockly.Python['create_role'] = function (block) {
  const name = Blockly.Python.valueToCode(block, 'NAME', Blockly.Python.ORDER_NONE) || '"New Role"';
  return `\nif 'ctx' in locals() and ctx.guild:\n    await ctx.guild.create_role(name=${name})\n`;
};
Blockly.Python['change_nickname'] = function (block) {
  const user = Blockly.Python.valueToCode(block, 'USER_ID', Blockly.Python.ORDER_NONE) || '0';
  const name = Blockly.Python.valueToCode(block, 'NAME', Blockly.Python.ORDER_NONE) || '"New Nick"';
  return `\nif 'ctx' in locals() and ctx.guild:\n    _m = ctx.guild.get_member(int(${user}))\n    if _m: await _m.edit(nick=${name})\n`;
};
Blockly.Python['procedures_defnoreturn'] = Blockly.Python['procedures_defreturn'] = function (
  block,
) {
  const funcName = Blockly.Python.variableDB_.getName(
    block.getFieldValue('NAME'),
    Blockly.Names.PROCEDURE_NAME,
  );
  const branch = getBranchCode(block, 'STACK');
  let args = [];
  for (let i = 0; i < block.arguments_.length; i++) {
    args.push(Blockly.Python.variableDB_.getName(block.arguments_[i], Blockly.Names.VARIABLE_NAME));
  }
  const argsString = args.join(', ');
  let returnValue = Blockly.Python.valueToCode(block, 'RETURN', Blockly.Python.ORDER_NONE) || '';
  let returnCode = '';
  if (block.type === 'procedures_defreturn' && returnValue) {
    returnCode = `${Blockly.Python.INDENT}return ${returnValue}\n`;
  }
  return `\nasync def ${funcName}(${argsString}):\n${branch.trimEnd()}\n${returnCode.trimEnd()}\n`;
};
Blockly.Python['procedures_callnoreturn'] = function (block) {
  const funcName = Blockly.Python.variableDB_.getName(
    block.getFieldValue('NAME'),
    Blockly.Names.PROCEDURE_NAME,
  );
  const args = [];
  for (let i = 0; i < block.arguments_.length; i++) {
    args.push(Blockly.Python.valueToCode(block, 'ARG' + i, Blockly.Python.ORDER_NONE) || 'None');
  }
  return `await ${funcName}(${args.join(', ')})\n`;
};
Blockly.Python['procedures_callreturn'] = function (block) {
  const funcName = Blockly.Python.variableDB_.getName(
    block.getFieldValue('NAME'),
    Blockly.Names.PROCEDURE_NAME,
  );
  const args = [];
  for (let i = 0; i < block.arguments_.length; i++) {
    args.push(Blockly.Python.valueToCode(block, 'ARG' + i, Blockly.Python.ORDER_NONE) || 'None');
  }
  return [`await ${funcName}(${args.join(', ')})`, Blockly.Python.ORDER_FUNCTION_CALL];
};
Blockly.Python['lists_create_with'] = function (block) {
  const elements = [];
  for (let i = 0; i < block.itemCount_; i++) {
    elements.push(
      Blockly.Python.valueToCode(block, 'ADD' + i, Blockly.Python.ORDER_NONE) || 'None',
    );
  }
  return ['[' + elements.join(', ') + ']', Blockly.Python.ORDER_ATOMIC];
};
Blockly.Python['lists_length'] = function (block) {
  const list = Blockly.Python.valueToCode(block, 'VALUE', Blockly.Python.ORDER_NONE) || '[]';
  return [`len(${list})`, Blockly.Python.ORDER_FUNCTION_CALL];
};
Blockly.Python['lists_append_to'] = function (block) {
  const list = Blockly.Python.valueToCode(block, 'LIST', Blockly.Python.ORDER_MEMBER) || '[]';
  const item = Blockly.Python.valueToCode(block, 'ITEM', Blockly.Python.ORDER_NONE) || 'None';
  return `${list}.append(${item})\n`;
};
Blockly.Python['random_choice'] = function (block) {
  const list = Blockly.Python.valueToCode(block, 'LIST', Blockly.Python.ORDER_NONE) || '[]';
  return [`random.choice(${list})`, Blockly.Python.ORDER_ATOMIC];
};
Blockly.Python['lists_getIndex'] = function (block) {
  const mode = block.getFieldValue('MODE') || 'GET';
  const where = block.getFieldValue('WHERE') || 'FROM_START';
  const list = Blockly.Python.valueToCode(block, 'VALUE', Blockly.Python.ORDER_MEMBER) || '[]';
  let code, at;
  if (where === 'FROM_START') {
    at = Blockly.Python.valueToCode(block, 'AT', Blockly.Python.ORDER_ADDITIVE) || '1';
    at = Blockly.isNumber(at) ? parseInt(at, 10) - 1 : `(int(${at}) - 1)`;
    if (mode === 'GET') code = `${list}[${at}]`;
    else if (mode === 'GET_REMOVE') code = `${list}.pop(${at})`;
    else if (mode === 'REMOVE') code = `del ${list}[${at}]\n`;
  } else if (where === 'FROM_END') {
    at = Blockly.Python.valueToCode(block, 'AT', Blockly.Python.ORDER_UNARY_SIGN) || '1';
    at = Blockly.isNumber(at) ? -parseInt(at, 10) : `-int(${at})`;
    if (mode === 'GET') code = `${list}[${at}]`;
    else if (mode === 'GET_REMOVE') code = `${list}.pop(${at})`;
    else if (mode === 'REMOVE') code = `del ${list}[${at}]\n`;
  } else if (where === 'FIRST') {
    if (mode === 'GET') code = `${list}[0]`;
    else if (mode === 'GET_REMOVE') code = `${list}.pop(0)`;
    else if (mode === 'REMOVE') code = `del ${list}[0]\n`;
  } else if (where === 'LAST') {
    if (mode === 'GET') code = `${list}[-1]`;
    else if (mode === 'GET_REMOVE') code = `${list}.pop()`;
    else if (mode === 'REMOVE') code = `del ${list}[-1]\n`;
  } else {
    return Blockly.Python.lists_getIndex(block);
  }
  if (mode === 'REMOVE') return code;
  return [code, Blockly.Python.ORDER_MEMBER];
};
Blockly.Python['lists_setIndex'] = function (block) {
  const mode = block.getFieldValue('MODE') || 'SET';
  const where = block.getFieldValue('WHERE') || 'FROM_START';
  const list = Blockly.Python.valueToCode(block, 'LIST', Blockly.Python.ORDER_MEMBER) || '[]';
  const value = Blockly.Python.valueToCode(block, 'VALUE', Blockly.Python.ORDER_NONE) || 'None';
  let code, at;
  if (where === 'FROM_START') {
    at = Blockly.Python.valueToCode(block, 'AT', Blockly.Python.ORDER_ADDITIVE) || '1';
    at = Blockly.isNumber(at) ? parseInt(at, 10) - 1 : `(int(${at}) - 1)`;
    if (mode === 'SET') code = `${list}[${at}] = ${value}\n`;
    else if (mode === 'INSERT') code = `${list}.insert(${at}, ${value})\n`;
  } else if (where === 'FIRST') {
    if (mode === 'SET') code = `${list}[0] = ${value}\n`;
    else if (mode === 'INSERT') code = `${list}.insert(0, ${value})\n`;
  } else if (where === 'LAST') {
    if (mode === 'SET') code = `${list}[-1] = ${value}\n`;
    else if (mode === 'INSERT') code = `${list}.append(${value})\n`;
  } else if (where === 'FROM_END') {
    at = Blockly.Python.valueToCode(block, 'AT', Blockly.Python.ORDER_UNARY_SIGN) || '1';
    if (mode === 'SET') {
      const setAt = Blockly.isNumber(at) ? -parseInt(at, 10) : `-int(${at})`;
      code = `${list}[${setAt}] = ${value}\n`;
    } else if (mode === 'INSERT') {
      const insertAt = Blockly.isNumber(at)
        ? `len(${list}) - ${parseInt(at, 10)}`
        : `len(${list}) - int(${at})`;
      code = `${list}.insert(${insertAt}, ${value})\n`;
    }
  } else {
    return Blockly.Python.lists_setIndex(block);
  }
  return code;
};
Blockly.Python['random_integer'] = function (block) {
  const from = Blockly.Python.valueToCode(block, 'FROM', Blockly.Python.ORDER_NONE) || '0';
  const to = Blockly.Python.valueToCode(block, 'TO', Blockly.Python.ORDER_NONE) || '100';
  return [`random.randint(int(${from}), int(${to}))`, Blockly.Python.ORDER_ATOMIC];
};
Blockly.Python['text_replace'] = function (block) {
  const text = Blockly.Python.valueToCode(block, 'TEXT', Blockly.Python.ORDER_MEMBER) || "''";
  const from = Blockly.Python.valueToCode(block, 'FROM', Blockly.Python.ORDER_NONE) || "''";
  const to = Blockly.Python.valueToCode(block, 'TO', Blockly.Python.ORDER_NONE) || "''";
  return [`str(${text}).replace(str(${from}), str(${to}))`, Blockly.Python.ORDER_MEMBER];
};
Blockly.Python['text_charAt'] = function (block) {
  const where = block.getFieldValue('WHERE') || 'FROM_START';
  const text = Blockly.Python.valueToCode(block, 'VALUE', Blockly.Python.ORDER_MEMBER) || "''";
  let code, at;
  if (where === 'FROM_START') {
    at = Blockly.Python.valueToCode(block, 'AT', Blockly.Python.ORDER_ADDITIVE) || '1';
    at = Blockly.isNumber(at) ? parseInt(at, 10) - 1 : `(int(${at}) - 1)`;
    code = `${text}[${at}]`;
  } else if (where === 'FIRST') {
    code = `${text}[0]`;
  } else if (where === 'LAST') {
    code = `${text}[-1]`;
  } else if (where === 'FROM_END') {
    at = Blockly.Python.valueToCode(block, 'AT', Blockly.Python.ORDER_UNARY_SIGN) || '1';
    at = Blockly.isNumber(at) ? -parseInt(at, 10) : `-int(${at})`;
    code = `${text}[${at}]`;
  } else {
    code = `${text}[0]`;
  }
  return [code, Blockly.Python.ORDER_MEMBER];
};
Blockly.Python['controls_if'] = function (block) {
  let code = '';
  let condition = Blockly.Python.valueToCode(block, 'IF0', Blockly.Python.ORDER_NONE) || 'False';
  let branchCode = getBranchCode(block, 'DO0');
  code += `if ${condition}:\n${branchCode}`;
  for (let i = 1; i <= block.elseifCount_; i++) {
    condition = Blockly.Python.valueToCode(block, 'IF' + i, Blockly.Python.ORDER_NONE) || 'False';
    branchCode = getBranchCode(block, 'DO' + i);
    code += `elif ${condition}:\n${branchCode}`;
  }
  if (block.elseCount_) {
    branchCode = getBranchCode(block, 'ELSE');
    code += `else:\n${branchCode}`;
  }
  return code;
};
Blockly.Python['on_reaction_add'] = function (block) {
  const msgId = block.getFieldValue('MESSAGE_ID');
  const emoji = block.getFieldValue('EMOJI');
  const branch = getBranchCode(block, 'DO');
  return `\n@bot.event\nasync def on_raw_reaction_add(payload):\n    if payload.user_id == bot.user.id:\n        return\n    if '${msgId}' and str(payload.message_id) != '${msgId}':\n        return\n    if '${emoji}' and str(payload.emoji) != '${emoji}':\n        return\n    channel = bot.get_channel(payload.channel_id)\n    message = await channel.fetch_message(payload.message_id)\n    user = payload.member or bot.get_user(payload.user_id)\n    ctx = message\n${branch.trimEnd()}\n`;
};
Blockly.Python['send_button_message'] = function (block) {
  const msg = Blockly.Python.valueToCode(block, 'MESSAGE', Blockly.Python.ORDER_NONE) || '""';
  const label = block.getFieldValue('LABEL');
  const customId = block.getFieldValue('CUSTOM_ID');
  return `\nview = discord.ui.View()\nview.add_item(discord.ui.Button(label="${label}", custom_id="${customId}"))\nif 'ctx' in locals():\n    if isinstance(ctx, discord.Interaction):\n        await ctx.response.send_message(content=${msg}, view=view)\n    else:\n        await ctx.send(content=${msg}, view=view)\n`;
};
Blockly.Python['on_button_click'] = function (block) {
  const customId = block.getFieldValue('CUSTOM_ID');
  const branch = getBranchCode(block, 'DO');
  return `\n# BUTTON_EVENT:${customId}\nasync def on_button_${customId}(interaction):\n    ctx = interaction\n    user = interaction.user\n    await interaction.response.defer()\n${branch.trimEnd()}\n`;
};
Blockly.Python['show_modal'] = function (block) {
  const title = block.getFieldValue('TITLE');
  const customId = block.getFieldValue('CUSTOM_ID');
  const label1 = block.getFieldValue('LABEL1');
  const label2 = block.getFieldValue('LABEL2');
  let inputs = `[{"label": "${label1}", "id": "input_0"}]`;
  if (label2)
    inputs = `[{"label": "${label1}", "id": "input_0"}, {"label": "${label2}", "id": "input_1"}]`;
  return `\nif isinstance(ctx, discord.Interaction):\n    await ctx.response.send_modal(EasyModal(title="${title}", custom_id="${customId}", inputs=${inputs}))\n`;
};
Blockly.Python['on_modal_submit'] = function (block) {
  const customId = block.getFieldValue('CUSTOM_ID');
  const branch = getBranchCode(block, 'DO');
  return `\n# MODAL_EVENT:${customId}\nasync def on_modal_${customId}(interaction):\n    ctx = interaction\n    user = interaction.user\n    await interaction.response.defer()\n${branch.trimEnd()}\n`;
};
Blockly.Python['get_input_value'] = function (block) {
  const idx = block.getFieldValue('INDEX');
  return [
    `interaction.data['components'][0]['components'][${idx}]['value']`,
    Blockly.Python.ORDER_ATOMIC,
  ];
};

export default Blockly;

let blockTemplates = {};

export async function loadTemplates() {
  try {
    const res = await fetch(new URL("./block2ui.json", import.meta.url));
    if (res.ok) {
      blockTemplates = await res.json();
      return;
    }
  } catch (e) {
    console.error("block2ui.json を読み込めませんでした", e);
  }
  blockTemplates = {};
}

export function generateBlocks() {
  const Blocks = {};

  Object.entries(blockTemplates).forEach(([type, schema]) => {
    Blocks[type] = {
      type,
      init: function () {
        if (schema.title) {
          this.appendDummyInput().appendField(schema.title);
        }

        const isV2 = Number(schema.version) === 2;
        if (isV2) {
          // Keep labels/inputs on one line for v2 layouts
          this.setInputsInline(true);
        }

        if (isV2) {
          const inlineOrder = Array.isArray(schema.inline) ? schema.inline : null;
          const baseItems = [];
          (schema.fields || []).forEach(f => baseItems.push(f));
          (schema.inputs || []).forEach(inp => baseItems.push({ kind: "value", ...inp }));

          let merged = baseItems;
          if (inlineOrder) {
            const inlineNames = inlineOrder.filter(item => typeof item === "string");
            const inlineNameSet = new Set(inlineNames);

            const inlineQueues = new Map();
            baseItems.forEach(item => {
              if (item && item.name && inlineNameSet.has(item.name)) {
                if (!inlineQueues.has(item.name)) inlineQueues.set(item.name, []);
                inlineQueues.get(item.name).push(item);
              }
            });

            const orderedInline = [];
            inlineOrder.forEach(item => {
              if (typeof item === "string") {
                const queue = inlineQueues.get(item);
                if (queue && queue.length) orderedInline.push(queue.shift());
              } else if (item && typeof item === "object") {
                orderedInline.push(item);
              }
            });

            baseItems.forEach(item => {
              if (item && item.name && inlineNameSet.has(item.name)) {
                const queue = inlineQueues.get(item.name);
                if (queue && queue.length) orderedInline.push(queue.shift());
              }
            });

            let inlineIdx = 0;
            merged = baseItems.map(item => {
              if (item && item.name && inlineNameSet.has(item.name)) {
                return orderedInline[inlineIdx++] || item;
              }
              return item;
            });
          }

          merged.forEach(f => {
            const kind = f.kind || "input";
            if (kind === "label" || kind === "input") {
              if (!this._dummyLine) this._dummyLine = this.appendDummyInput();
              const line = this._dummyLine;
              if (kind === "label") {
                line.appendField(f.text || "");
              } else {
                const type = f.inputType || "text";
                if (type === "dropdown") {
                  line.appendField(new Blockly.FieldDropdown(f.options || []), f.name);
                } else if (type === "checkbox") {
                  line.appendField(f.label || "");
                  line.appendField(
                    new Blockly.FieldCheckbox(f.default === "TRUE" ? "TRUE" : "FALSE"),
                    f.name
                  );
                } else if (type === "multiline_text") {
                  line.appendField(new Blockly.FieldMultilineInput(f.default || ""), f.name);
                } else {
                  line.appendField(new Blockly.FieldTextInput(f.default || ""), f.name);
                }
              }
            } else if (kind === "value") {
              const val = this.appendValueInput(f.name).setCheck(f.check || null);
              if (f.label) val.appendField(f.label);
              if (f.align) val.setAlign(f.align);
              this._dummyLine = null;
            }
            if (f.newline) {
              this._dummyLine = null;
            }
          });
        } else {
          (schema.fields || []).forEach(f => {
            const input = this.appendDummyInput();
            if (f.inputType === "dropdown") {
              input.appendField(new Blockly.FieldDropdown(f.options), f.name);
            } else if (f.inputType === "checkbox") {
              input.appendField(f.label || "");
              input.appendField(new Blockly.FieldCheckbox(f.default === "TRUE" ? "TRUE" : "FALSE"), f.name);
            } else if (f.inputType === "text") {
              input.appendField(new Blockly.FieldTextInput(f.default || ""), f.name);
            } else if (f.inputType === "multiline_text") {
              input.appendField(new Blockly.FieldMultilineInput(f.default || ""), f.name);
            }
          });
        }

        if (!isV2) {
          (schema.inputs || []).forEach(inp => {
            const i = this.appendValueInput(inp.name).setCheck(inp.check || null);
            if (inp.label) i.appendField(inp.label);
          });
        }

        (schema.statements || []).forEach(name => {
          this.appendStatementInput(name)
            .setCheck(null)
            .appendField(schema.statementLabels?.[name] || "");
        });

        if (schema.dynamicItems) {
          this.itemCount_ = 3;
          for (let i = 0; i < this.itemCount_; i++) {
            this.appendValueInput("ADD" + i)
              .setCheck(null)
              .appendField(i === 0 ? "項目" : "");
          }
        }

        if (schema.type === "output") {
          this.setOutput(true, schema.output || null);
        }

        if (schema.type === "statement") {
          if (schema.previous !== false) this.setPreviousStatement(true, null);
          if (schema.next !== false) this.setNextStatement(true, null);
        }

        this.setColour(schema.color || 200);
        if (schema.tooltip) this.setTooltip(schema.tooltip);
      }
    };
  });

  return Blocks;
}

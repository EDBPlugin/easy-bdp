
import re
import sys

file_path = 'editor/script.js'

try:
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Pattern to capture conflicts
    # Use non-greedy match for content
    # Note: git sometimes adds text after <<<<<<< HEAD, e.g. <<<<<<< HEAD:file.txt
    # But here we saw <<<<<<< HEAD
    # The branch name for theirs is easy-bdc/plugin
    pattern = re.compile(r'<<<<<<< HEAD\n(.*?)\n=======\n(.*?)\n>>>>>>> easy-bdc/plugin', re.DOTALL)

    def resolve(match):
        head = match.group(1)
        plugin = match.group(2)

        # 1. initializeApp block
        # HEAD has `const initializeApp = async () => {`
        # Plugin has `const toggleTheme = ...` and later `const initializeApp = () => {`
        if 'initializeApp' in head and 'toggleTheme' in plugin:
            print("Resolving initializeApp conflict (taking Plugin + fixing async)")
            # Fix the missing async in Plugin version
            fixed_plugin = plugin.replace('const initializeApp = () => {', 'const initializeApp = async () => {')
            return fixed_plugin

        # 2. Modal listener block
        # HEAD has `codeModal.addEventListener...`
        # Plugin (theirs) has `splitModalClose...`
        if 'codeModal.addEventListener' in head:
            print("Resolving modal listener conflict (Merging HEAD and Plugin)")
            return head + "\n" + plugin

        # 3. Default: Take Plugin
        # For extractInteractionEvents, generatePythonCode, etc.
        print("Resolving generic conflict (taking Plugin)")
        return plugin

    new_content, count = pattern.subn(resolve, content)

    print(f"Resolved {count} conflicts.")

    if count == 0:
        print("No conflicts found via regex.")
        if '<<<<<<<' in content:
            print("WARNING: Conflict markers found but regex didn't match! Dumping snippet:")
            start = content.find('<<<<<<<')
            print(content[start:start+100])

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)

except Exception as e:
    print(f"Error: {e}")


import re
import sys

file_path = 'editor/script.js'
try:
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Regex to find conflict blocks
    # Matches <<<<<<< HEAD ... ======= ... >>>>>>> easy-bdc/plugin
    # We want to keep the part after =======
    # Note: re.DOTALL makes . match newline
    pattern = re.compile(r'<<<<<<< HEAD\n(.*?)\n=======\n(.*?)\n>>>>>>> easy-bdc/plugin', re.DOTALL)

    def replace_with_theirs(match):
        # match.group(0) is full match
        # match.group(1) is HEAD content
        # match.group(2) is plugin content
        return match.group(2)

    new_content = pattern.sub(replace_with_theirs, content)

    # Verify no more conflicts
    if '<<<<<<< HEAD' in new_content:
        print("Warning: Some conflicts might remain.")

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)

    print('Resolved conflicts using plugin version.')
except Exception as e:
    print(f"Error: {e}")

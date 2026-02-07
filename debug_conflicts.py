
import sys

file_path = 'editor/script.js'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

count = content.count('<<<<<<<')
print(f"File contains {count} conflict markers.")

start = content.find('<<<<<<<')
if start != -1:
    print("Example snippet:")
    print(content[start:start+200])

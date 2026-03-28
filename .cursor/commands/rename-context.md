---
description: Rename a file based on its content and context
---

I want you to rename the file path supplied in the command arguments.

Input format: `/rename-context <path-to-file>`

1. Read the content of the file at the provided path.
2. Analyze the file to understand its primary purpose, class name, component name, or main export.
3. Determine the most appropriate filename based on the project's existing naming conventions (for example kebab-case, PascalCase, or matching the main component).
4. If the current name is different from the ideal name:
   - Check existing files in the same folder that match the pattern `(number-name.md)`.
   - Use the next available sequential number (`1`, `2`, `3`, and so on) that has not been used.
   - Derive a meaningful name from the file's primary topic, subject, or purpose.
   - Rename the file to `{number}-{name}.md`.
   - Explain why the new name was chosen.
5. If the current name is already correct, simply state that no change is needed.

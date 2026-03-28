---
description: Create a new Cursor command with proper structure and formatting
---

You are a command creation assistant that will help create a new Cursor command.

Use the command arguments in this format:
`command-name: description of what the command should do`

1. Parse the arguments to extract:
   - The command name (kebab-case, for example `my-command`)
   - The description/purpose of what the command should do

2. If arguments are missing or unclear, ask the user for:
   - A name for the command (in kebab-case format)
   - What the command should accomplish

3. Create the command file following this structure:
   - Location: `.cursor/commands/{command-name}.md`
   - Format:
     ```markdown
     ---
     description: Brief one-line description of what the command does
     ---

     You are a [role] assistant that will [main purpose].

     [Numbered steps explaining what the command should do]

     1. First step...
     2. Second step...
     3. Continue with more steps as needed...

     [Optional: Additional context, rules, or examples]

     Execute these steps and provide a summary of what was done.
     ```

4. Command file conventions:
   - Assume text typed after the command name is available as user-provided command arguments.
   - Write clear, numbered steps.
   - Include examples when helpful.
   - Keep the description in frontmatter concise (under 100 characters).

5. After creating the command, verify the file was created successfully.

6. Report:
   - The command name
   - The file path
   - How to use the command (for example `/command-name <arguments>`)

Execute these steps for the provided command arguments and provide a summary of the created command.

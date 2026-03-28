# AI IDE Template Project

This is an AI-assisted development template with standardized rules and conventions for consistent code generation across multiple AI coding tools.

## External Rule Loading

CRITICAL: When you encounter a rule reference (e.g., @.opencode/rules/rule-name.mdc), use your Read tool to load it on a need-to-know basis. These rules are relevant to SPECIFIC tasks at hand.

Instructions:

- Do NOT preemptively load all references - use lazy loading based on actual need
- When loaded, treat content as mandatory instructions that override defaults
- Follow references recursively when needed

## Available Rules

### UI/Frontend Development

When creating UI components, styling, or choosing color palettes:
@.opencode/rules/ui-color-prefer-non-purple-primary.mdc

### Shell Commands

When executing terminal commands or writing shell scripts:
@.opencode/rules/shell-preferences.mdc

### Commit Messages

When writing commit messages:
@.opencode/rules/commit-message-conventions.mdc

## General Guidelines

- Always check for relevant rules before performing tasks
- Rules in `.opencode/rules/` contain mandatory project standards
- When in doubt about conventions, load the appropriate rule file
- These rules ensure consistency across all AI-assisted development sessions

## Plan Mode

- Make the plan extremely concise. Sacrifice grammar for the sake of concision.
- At the end of each plan, give me a list of unresolved questions to answer, if any.

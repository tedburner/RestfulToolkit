# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This project uses OpenSpec (v1.3.0) for spec-driven development. OpenSpec is an AI-native system that structures development through proposals, specs, design, and tasks.

## OpenSpec Workflow

**Schema**: spec-driven (proposal → specs → design → tasks)

**Key Commands**:
- `/opsx:explore` - Enter explore mode for thinking, investigating, and clarifying requirements before creating changes
- `/opsx:propose <name>` - Create a new change proposal with all artifacts (proposal, specs, design, tasks) in one step
- `/opsx:apply <name>` - Implement tasks from a change proposal
- `/opsx:archive <name>` - Archive a completed change

**OpenSpec CLI Commands**:
- `openspec new change "<name>"` - Create scaffolded change directory
- `openspec list` - List active changes
- `openspec list --specs` - List specifications
- `openspec status --change "<name>" --json` - Get artifact status and dependencies
- `openspec instructions <artifact> --change "<name>" --json` - Get artifact creation instructions
- `openspec archive "<name>"` - Archive a completed change

## Project Structure

```
openspec/
├── config.yaml          # Project context and artifact rules
├── changes/             # Active change proposals
│   └── archive/         # Archived completed changes
└── specs/               # Specification documents

.claude/
├── skills/              # Custom OpenSpec skills
│   ├── openspec-explore/
│   ├── openspec-propose/
│   ├── openspec-apply-change/
│   └── openspec-archive-change/
└── commands/            # Custom slash commands (opsx)
```

## Workflow Usage

**Starting New Work**:
1. Use `/opsx:explore` to think through requirements and design
2. Use `/opsx:propose <change-name>` to create a complete change with all artifacts
3. Use `/opsx:apply <change-name>` to implement the tasks
4. Use `/opsx:archive <change-name>` when complete

**Exploring Before Proposing**:
The explore mode (`/opsx:explore`) is a thinking partner stance - there's no fixed workflow. Use it to:
- Clarify requirements through questions
- Investigate the codebase
- Compare approaches
- Visualize architecture with ASCII diagrams
- Surface risks and unknowns

Explore mode never implements code - only thinks, reads files, and optionally creates/updates OpenSpec artifacts.

**Creating Artifacts**:
- The propose skill handles all artifact creation automatically in dependency order
- Each artifact has dependencies defined by the schema
- Context and rules from CLI instructions guide what to write but should never appear in output files
- Read dependency artifacts before creating new ones

**Implementing Changes**:
- The apply skill reads context files (proposal, specs, design, tasks) before implementation
- Tasks are executed sequentially, marking each complete with `[x]` in tasks.md
- Pause on blockers, unclear requirements, or design issues - don't guess
- Keep changes minimal and scoped to each task
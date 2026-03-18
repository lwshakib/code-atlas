# Contributing to Code Atlas

First off, thank you for considering contributing to Code Atlas! It's people like you that make Code Atlas such a great tool.

## 🌈 How Can I Contribute?

### Reporting Bugs

- Before creating a new issue, please search existing issues to see if it has already been reported.
- Use a clear and descriptive title.
- Describe the exact steps which reproduce the problem in as many details as possible.
- Explain which behavior you expected to see and why.

### Suggesting Enhancements

- Check the current [README](README.md) to understand the project's goals.
- Use a clear and descriptive title for the issue.
- Provide a step-by-step description of the suggested enhancement.

### Pull Requests

- Fill in the pull request template.
- Do not include issue numbers in the PR title.
- Include screenshots and animated GIFs in your pull request whenever possible.
- Ensure that the PR passes all CI checks.

---

## 💻 Local Development Setup

Code Atlas relies on a specific set of databases and background workers. Follow these steps to get a functional environment:

### 0. Clone the Repository

```bash
git clone https://github.com/lwshakib/code-atlas.git
cd code-atlas
```

### 1. Environment Variables

You MUST have a valid `.env` file. See `.env.example` for the required keys.
Specifically, ensure you have:

- `NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_PASSWORD`
- `PINECONE_API_KEY`, `PINECONE_INDEX`
- `DATABASE_URL` (PostgreSQL)
- `INNGEST_SIGNING_KEY` (for production/preview) or run `npx inngest-cli@latest dev` locally.

### 2. Databases via Docker

The easiest way to run the required infra is via the provided `docker-compose.yml`:

```bash
docker-compose up -d
```

This starts:

- **PostgreSQL**: For core application data.
- **Neo4j**: For graph-native code mapping.

### 3. Inngest Dev Server

Code Atlas uses Inngest for background indexing. You must run the Inngest Dev Server locally to capture and execute functions:

```bash
npx inngest-cli@latest dev
```

### 4. Running the App

```bash
bun dev
```

---

## 🏗️ Architecture Overview

When contributing to different parts of the system, keep these patterns in mind:

- **Graph Structure**: Neo4j nodes should follow the `:File`, `:Module`, `:Function` labels with appropriate `DEPENDS_ON` or `CALLS` relationships.
- **Semantic Search**: Every file indexed in Neo4j must have a corresponding vector in Pinecone for semantic search to stay in sync.
- **Real-time Updates**: Use Inngest Realtime events to push status updates to the UI. Avoid polling the database.

---

## 🎨 Style Guide

- **TypeScript**: Use strict types. Avoid `any` whenever possible.
- **Tailwind CSS**: Follow mobile-first design. Use `cn()` utility from `lib/utils` for conditional classes.
- **Component Structure**: Keep components small and focused. Use Server Components by default; add `"use client"` only when necessary for interactivity.

---

## 📜 License

By contributing, you agree that your contributions will be licensed under its [MIT License](LICENSE).

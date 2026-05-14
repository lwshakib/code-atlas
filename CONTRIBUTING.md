# Contributing to Code Atlas

Thank you for your interest in contributing to Code Atlas! This guide will help you get started with our development process.

## 🚀 Getting Started

### 1. Fork and Clone

1.  Fork the repository on GitHub.
2.  Clone your fork locally:
    ```bash
    git clone https://github.com/YOUR_USERNAME/code-atlas.git
    cd code-atlas
    ```
3.  Add the upstream remote:
    ```bash
    git remote add upstream https://github.com/lwshakib/code-atlas.git
    ```

### 2. Local Setup

We use **PNPM** as our package manager. Please ensure you have it installed.

```bash
# Install dependencies
pnpm install

# Setup environment
cp .env.example .env
# Update .env with your local/dev credentials

# Start infra
docker-compose up -d

# Generate Prisma client
pnpm run db:generate
```

## 🛠️ Development Workflow

### 1. Branching

Always create a new branch for your work:

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

### 2. Code Quality

Before submitting a pull request, ensure your code passes all checks:

```bash
# Run type checking
pnpm run typecheck

# Run linting
pnpm run lint

# Check formatting
pnpm run format:check

# Run build
pnpm run build
```

### 3. Pull Requests

1.  Push your branch to your fork:
    ```bash
    git push origin feature/your-feature-name
    ```
2.  Open a Pull Request against the `main` branch of the upstream repository.
3.  Fill out the PR template completely.
4.  Ensure all CI checks pass.

## 🏗️ Architecture Best Practices

- **Type Safety**: Use strict TypeScript. Avoid `any` - define interfaces for complex data structures.
- **Background Tasks**: Long-running logic (indexing, heavy LLM calls) must be implemented as Inngest functions.
- **UI Components**: Use Tailwind CSS and Shadcn UI. Keep components accessible and responsive.

## ⚖️ Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

## 📜 License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).

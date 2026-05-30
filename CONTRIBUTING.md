# Contributing to Workstation Monitoring System

Thank you for your interest in contributing! Here's how to get started.

## Getting Started

1. Fork the repository and clone your fork
2. Follow the [Local Development](README.md#local-development) section in the README to set up your environment
3. Create a feature branch: `git checkout -b feat/my-feature`
4. Make your changes, commit, and open a pull request against `main`

## Development Setup

```bash
# Start the database
docker compose -f docker-compose.dev.yml up -d

# Start the API server
cd server && cp .env.example .env && npm install && npm run dev

# Start the frontend (in a new terminal, from the project root)
npm install && npm run dev
```

## Code Style

- **TypeScript** — strict mode is enabled; avoid `any`
- **Go** — run `gofmt` before committing
- **React** — functional components and hooks only; no class components
- Comments only where the **why** is non-obvious

## Pull Request Guidelines

- Keep PRs focused — one feature or fix per PR
- Include a clear description of what changed and why
- If you're fixing a bug, describe how to reproduce it
- Screenshots are helpful for UI changes

## Reporting Issues

Open a GitHub issue with:
- A clear title and description
- Steps to reproduce (for bugs)
- Your OS, Docker version, and browser (if relevant)
- Logs from `docker compose logs server` if applicable

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).

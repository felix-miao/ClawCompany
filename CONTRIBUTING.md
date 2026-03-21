# Contributing to ClawCompany

First off, thank you for considering contributing to ClawCompany! 🦞

## Code of Conduct

This project and everyone participating in it is governed by the [ClawCompany Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the issue list as you might find out that you don't need to create one. When you are creating a bug report, please include as many details as possible:

**Bug Report Template:**
```markdown
**Description**
A clear description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:
1. Go to '...'
2. Click on '....'
3. Scroll down to '....'
4. See error

**Expected Behavior**
A clear description of what you expected to happen.

**Screenshots**
If applicable, add screenshots to help explain your problem.

**Environment:**
 - OS: [e.g. macOS, Windows, Linux]
 - Node.js version: [e.g. 18.0.0]
 - ClawCompany version: [e.g. 1.0.0]

**Additional Context**
Add any other context about the problem here.
```

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, include:

**Enhancement Template:**
```markdown
**Is your feature request related to a problem?**
A clear description of what the problem is.

**Describe the solution you'd like**
A clear description of what you want to happen.

**Describe alternatives you've considered**
A clear description of any alternative solutions or features you've considered.

**Additional Context**
Add any other context or screenshots about the feature request here.
```

### Pull Requests

1. **Fork the repo** and create your branch from `main`.
2. **Make your changes** with clear commit messages.
3. **Add tests** if you've added code that should be tested.
4. **Update documentation** if you've changed APIs or functionality.
5. **Ensure tests pass** by running `npm test`.
6. **Submit a pull request**!

## Development Setup

### Prerequisites

- Node.js >= 18.0.0
- npm or yarn
- Git
- OpenClaw Gateway (for E2E testing)
- GLM-5 API key (for real agent testing)

### Installation

```bash
# Clone your fork
git clone https://github.com/your-username/ClawCompany.git
cd ClawCompany

# Install dependencies
cd skill
npm install

# Run tests
npm test

# Build
npm run build
```

### Project Structure

```
ClawCompany/
├── skill/                   # Main skill package
│   ├── src/
│   │   ├── orchestrator.ts  # Core orchestrator
│   │   ├── agents/          # Agent implementations
│   │   └── types/           # TypeScript types
│   ├── tests/               # Unit tests
│   ├── scripts/             # Utility scripts
│   └── package.json
├── docs/                    # Documentation
├── ai-team-demo/            # Web demo (Next.js)
└── README.md
```

### Coding Standards

#### TypeScript

- Use TypeScript for all new code
- Enable strict mode
- Add type annotations
- Avoid `any` when possible

#### Testing

- Write unit tests for new features
- Maintain or improve test coverage
- Use Jest testing framework
- Mock external dependencies

#### Documentation

- Update README.md for user-facing changes
- Update CHANGELOG.md for all changes
- Add inline comments for complex logic
- Update API documentation if needed

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Types:**
- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `test`: Adding or updating tests
- `refactor`: Code refactoring
- `chore`: Maintenance tasks

**Examples:**
```
feat: add intelligent seat selection
fix: resolve TypeScript compilation errors
docs: update API documentation
test: add orchestrator unit tests
```

### Testing

```bash
# Run all tests
npm test

# Run specific test file
npm test orchestrator.test.ts

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

### E2E Testing

E2E tests require OpenClaw environment:

```bash
# In OpenClaw environment
cd skill
npx ts-node scripts/e2e-test.ts
```

## Community

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: General discussion and questions
- **Discord**: OpenClaw community (link in README)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing! 🎉

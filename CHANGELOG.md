# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-03-21

### Added

#### Core Features
- **AI Virtual Team System**: PM/Dev/Reviewer three-agent collaboration
- **OpenClaw Orchestrator**: OpenClaw as the "foreman" coordinating agents
- **Real Architecture**: Based on OpenClaw sessions_spawn, not simulation
- **Mock Mode Support**: <1s response for demo recording

#### Agents
- **PM Agent**: Requirement analysis and task breakdown (GLM-5)
- **Dev Agent**: Code implementation (ACP runtime with Codex/OpenCode)
- **Reviewer Agent**: Code review and quality assurance (GLM-5)

#### Integration
- OpenClaw Gateway integration
- GLM-5 API support
- ACP Agent runtime support (Codex, Claude Code, OpenCode)
- File system operations (read/write/edit)

#### Testing
- 4 unit tests (100% pass rate)
- Jest configuration with ts-jest
- TypeScript type safety
- Mock strategy for OpenClaw tools

#### Documentation
- Complete README with quick start guide
- Architecture documentation (ARCHITECTURE-v2.md)
- Project description (PROJECT-DESCRIPTION.md)
- Demo storyboard and scripts
- TDD checklist
- ClawHub publish plan

### Technical Details

#### TypeScript Configuration
- Proper OpenClaw type declarations
- `declare const` for global tools
- tsconfig.json with strict mode
- Jest configuration with ts-jest

#### Code Quality
- TypeScript type safety
- Modular architecture
- Clear separation of concerns
- Comprehensive error handling

### Performance
- Unit test execution: ~0.4s
- Mock mode response: <1s
- Real agent workflow: varies by task complexity

### Known Limitations
- E2E tests require OpenClaw environment
- ACP Agent needs Codex/Claude Code configuration
- Concurrent limit: 8 sub-agents
- Task timeout: 10 minutes max

## [0.1.0] - 2026-03-15

### Added
- Initial project structure
- Basic orchestrator concept
- Demo web UI (Next.js)
- GLM-5 integration prototype

---

## Release Notes Template

### [Unreleased]

#### To Add
- [ ] Real code generation with Codex
- [ ] Multi-project management
- [ ] Web UI for configuration
- [ ] GUI client (PyQt5)
- [ ] Verification code recognition (OCR)
- [ ] Intelligent seat selection
- [ ] Itinerary management

#### To Improve
- [ ] Error handling
- [ ] Logging system
- [ ] Performance optimization
- [ ] Documentation completeness

---

**Note:** This project follows [Semantic Versioning](https://semver.org/). 
Given a version number MAJOR.MINOR.PATCH, increment the:
- MAJOR version for incompatible API changes
- MINOR version for backwards-compatible functionality additions
- PATCH version for backwards-compatible bug fixes

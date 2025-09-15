# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Junkdrawer is a Tauri desktop application for storing and organizing digital content. It combines React/TypeScript frontend with Rust backend and integrates Typesense server for search functionality.

## Architecture

- **Frontend**: React 19 + TypeScript with Vite for development
- **Backend**: Rust with Tauri framework providing native desktop capabilities
- **Search Engine**: Embedded Typesense server managed as sidecar process
- **Package Manager**: pnpm with workspace configuration

### Key Components

- `src/`: React frontend application
  - `lib/typesense.ts`: Frontend API for Typesense server management
  - `lib/useTypesense.ts`: React hooks for server state management
- `src-tauri/`: Rust backend application
  - `src/typesense.rs`: Server lifecycle management and health monitoring
  - `src/lib.rs` & `src/main.rs`: Core Tauri application setup
- `typesense/`: Contains Typesense server binary

### Tauri Integration

The app uses Tauri's sidecar feature to manage the Typesense server as an external binary. The Rust backend handles server lifecycle (start/stop/health checks) and communicates with the React frontend through Tauri's invoke system.

## Development Commands

### Frontend Development
- `pnpm dev` - Start Vite development server (port 1420)
- `pnpm build` - Build React application for production
- `pnpm preview` - Preview production build

### Tauri Development
- `pnpm tauri dev` - Start Tauri in development mode (runs `pnpm dev` automatically)
- `pnpm tauri build` - Build Tauri application for production

### Binary Management
- `just download-macos-binary` - Download Typesense server binary for macOS ARM64

## Configuration Files

- `vite.config.ts`: Vite configuration with Tauri-specific settings
- `src-tauri/tauri.conf.json`: Tauri application configuration including sidecar binary setup
- `src-tauri/Cargo.toml`: Rust dependencies and build configuration
- `tsconfig.json`: TypeScript configuration with strict settings
- `llmc.toml`: Custom configuration for commit message generation using Conventional Commits

## Testing and Quality

The project uses strict TypeScript configuration with:
- `noUnusedLocals` and `noUnusedParameters` enabled
- Strict type checking
- Modern ES2020 target

Run `pnpm build` to perform TypeScript compilation and catch type errors.
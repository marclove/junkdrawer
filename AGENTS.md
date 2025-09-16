# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Junkdrawer is a Tauri desktop application for storing and organizing digital content. It combines React/TypeScript frontend with Rust backend and integrates Typesense server for search functionality.

## Architecture

- **Frontend**: React 19 + TypeScript with Vite for development
- **Backend**: Rust with Tauri framework providing native desktop capabilities
- **Database**: SQLite with SeaORM for data persistence and migrations
- **Search Engine**: Embedded Typesense server managed as sidecar process
- **Package Manager**: pnpm with workspace configuration

### Key Components

- `src/`: React frontend application
  - `lib/typesense.ts`: Frontend API for Typesense server management
  - `lib/useTypesense.ts`: React hooks for server state management
  - `lib/database.ts`: Frontend API for database operations
  - `types/database.ts`: TypeScript interfaces for database entities
  - `components/NotesWorkspace.tsx`: Notes experience with autosave and search sync
- `src-tauri/`: Rust backend application
  - `src/typesense.rs`: Server lifecycle management and health monitoring
  - `src/database.rs`: Database connection management with SeaORM
  - `src/entities/`: SeaORM entity models for database tables
  - `src/migration/`: SeaORM migration files for schema management
  - `src/db_commands.rs`: Tauri commands for database operations
  - `src/bookmarks.rs`: URL metadata fetching with retry logic
  - `src/lib.rs` & `src/main.rs`: Core Tauri application setup
- `typesense/`: Contains Typesense server binary

### Tauri Integration

The app uses Tauri's sidecar feature to manage the Typesense server as an external binary. The Rust backend handles server lifecycle (start/stop/health checks) and communicates with the React frontend through Tauri's invoke system.

### Database Integration

The application uses SeaORM with SQLite for data persistence:

- **Database Location**: Stored in platform-specific app data directory (`~/Library/Application Support/com.marc.junkdrawer/junkdrawer.sqlite` on macOS)
- **Connection Management**: Handled by `DatabaseState` in `src-tauri/src/database.rs`
- **Migrations**: Automatic schema management using SeaORM migration system
- **Entity Models**: Type-safe database models in `src-tauri/src/entities/`
- **Tauri Commands**: Database operations exposed as `create_item`, `get_all_items`, `get_item_by_id`, `delete_item`, `update_item`, `create_bookmark`

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

### Database Management
- `just db-path` - Show database file location for current platform
- `just db-status` - Check database status, size, tables, and migration history
- `just db-reset` - Delete database file (recreated on next app start with migrations)
- `just db-backup` - Create timestamped backup of current database
- `just db-new-migration "name"` - Generate new migration file with template
- `just db-shell` - Open SQLite CLI connected to the database

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

### Testing Best Practices

When adding new features:
1. Add all required mocks upfront when creating new API functions
2. Update existing tests when changing UI text or behavior
3. Test database migrations on empty database before committing
4. Write tests as you implement, not after
5. Consider component complexity when writing tests - complex components are harder to test

Example mock setup for new database functions:
```typescript
const databaseMocks = vi.hoisted(() => ({
  getAllItems: vi.fn(),
  createItem: vi.fn(),
  // Add new functions here immediately when implementing
  createBookmark: vi.fn(),  // Don't forget new functions!
}))
```

## Component Architecture Guidelines

### Managing Component Complexity
- Biome enforces max cognitive complexity of 15
- Extract sub-components when approaching limits
- Use custom hooks for complex logic
- Prefer composition over monolithic components

Example refactoring pattern:
```typescript
// Instead of one large component
export function WorkspaceComponent() {
  // 400+ lines of code...
}

// Extract logical sub-components
export function WorkspaceComponent() {
  return (
    <>
      <Header />
      <ItemList items={items} />
      <ItemDetail item={selected} />
    </>
  )
}
```

When complexity warning appears, either:
1. Refactor immediately (preferred)
2. Add temporary ignore with refactor ticket:
   ```typescript
   // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Will refactor in next iteration
   ```

## Development Workflow Best Practices

### Pre-Implementation Checklist
- [ ] Check database-specific constraints (especially SQLite limitations)
- [ ] Verify all dependency versions are compatible
- [ ] Update tests for any UI text changes
- [ ] Plan for component complexity limits (max 15)

### During Development
- Run `pnpm lint` frequently to catch complexity issues early
- Test migrations on fresh database: `just db-reset` then restart app
- When adding new API functions, update all mocks in test files
- Keep components under complexity threshold or extract sub-components

### Common Pitfalls
1. **SQLite migrations**: Must use separate ALTER TABLE statements
2. **Test maintenance**: UI text changes break tests - update immediately
3. **Component complexity**: Extract components before hitting limits
4. **HTML parsing**: Start simple (regex/string parsing) before complex libraries

## SeaORM Database Management

### Entity Model Requirements

When creating or modifying SeaORM entities:

1. **Required imports**:
   ```rust
   use sea_orm::entity::prelude::*;
   use sea_orm::Set;
   use serde::{Deserialize, Serialize};
   ```

2. **Entity structure**:
   ```rust
   #[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, Serialize, Deserialize)]
   #[sea_orm(table_name = "table_name")]  // CRITICAL: Must match migration table name
   pub struct Model {
       #[sea_orm(primary_key)]
       pub id: i32,
       // ... other fields
       pub created_at: chrono::NaiveDateTime,  // Use NaiveDateTime, not DateTime<Utc>
       pub updated_at: chrono::NaiveDateTime,
   }
   ```

3. **Required traits**:
   ```rust
   #[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
   pub enum Relation {}

   impl ActiveModelBehavior for ActiveModel {
       fn new() -> Self {
           Self {
               created_at: Set(chrono::Utc::now().naive_utc()),
               updated_at: Set(chrono::Utc::now().naive_utc()),
               ..ActiveModelTrait::default()
           }
       }
   }
   ```

### Migration System Implementation

**CRITICAL**: Always use SeaORM's migration system, never manual SQL migrations.

#### Using Just Commands for Migration Workflow

For efficient development workflow, use these just commands:

1. **Create new migration**: `just db-new-migration "create_users_table"`
2. **Check current state**: `just db-status` 
3. **Reset for testing**: `just db-reset` then restart app
4. **Backup before changes**: `just db-backup`
5. **Debug with SQL**: `just db-shell`

#### Creating Tables

1. **Migration file naming**: `m{YYYYMMDD}_{HHMMSS}_{description}.rs` (e.g., `m20241215_000002_create_users_table.rs`)

2. **Migration structure**:
   ```rust
   use sea_orm_migration::prelude::*;

   #[derive(DeriveMigrationName)]
   pub struct Migration;

   #[async_trait::async_trait]
   impl MigrationTrait for Migration {
       async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
           manager.create_table(
               Table::create()
                   .table(TableName::Table)
                   .if_not_exists()  // CRITICAL: Always include this
                   .col(ColumnDef::new(TableName::Id).integer().not_null().auto_increment().primary_key())
                   // ... other columns
                   .to_owned(),
           ).await
       }

       async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
           manager.drop_table(Table::drop().table(TableName::Table).to_owned()).await
       }
   }

   #[derive(DeriveIden)]
   enum TableName {
       #[sea_orm(iden = "actual_table_name")]  // CRITICAL: Table name must match entity
       Table,
       Id,
       // ... field names (use PascalCase)
   }
   ```

3. **Register in migrator**:
   - Add `mod` declaration in `src-tauri/src/migration/mod.rs`
   - Add to `migrations()` vector in correct chronological order

#### Modifying Tables

1. **Always create new migration file** - never modify existing migrations
2. **Update entity model first**, then create migration

#### SQLite-Specific Limitations

**CRITICAL for SQLite**: Each ALTER TABLE statement must be separate:
```rust
// ❌ WRONG - SQLite will fail with "doesn't support multiple alter options"
manager.alter_table(
    Table::alter()
        .table(Item::Table)
        .add_column(ColumnDef::new(Item::Field1).string())
        .add_column(ColumnDef::new(Item::Field2).string())  // FAILS!
        .to_owned(),
).await

// ✅ CORRECT - Separate ALTER statements
manager.alter_table(
    Table::alter()
        .table(Item::Table)
        .add_column(ColumnDef::new(Item::Field1).string())
        .to_owned(),
).await?;

manager.alter_table(
    Table::alter()
        .table(Item::Table)
        .add_column(ColumnDef::new(Item::Field2).string())
        .to_owned(),
).await?;
```

3. **Common operations**:
   ```rust
   // Add column
   manager.alter_table(
       Table::alter()
           .table(TableName::Table)
           .add_column(ColumnDef::new(TableName::NewField).string().null())
           .to_owned(),
   ).await

   // Drop column
   manager.alter_table(
       Table::alter()
           .table(TableName::Table)
           .drop_column(TableName::OldField)
           .to_owned(),
   ).await

   // Add index
   manager.create_index(
       Index::create()
           .if_not_exists()
           .name("idx_table_column")
           .table(TableName::Table)
           .col(TableName::Column)
           .to_owned(),
   ).await
   ```

#### Dropping Tables

1. **Create migration with drop operation**:
   ```rust
   async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
       manager.drop_table(Table::drop().table(TableName::Table).to_owned()).await
   }
   ```

2. **Remove entity file and update `mod.rs`**

### Database Connection Management

- Database connection is managed by `DatabaseState` in `src-tauri/src/database.rs`
- Connection is stored in `Arc<Mutex<Option<DatabaseConnection>>>`
- Access via `state.get_connection().await`
- Always check if connection exists before using

### Tauri Command Integration

When creating database operations:

1. **Command structure**:
   ```rust
   #[tauri::command]
   pub async fn operation_name(
       params: RequestStruct,
       state: tauri::State<'_, DatabaseState>,
   ) -> Result<ResponseType, String> {
       let db = state.get_connection().await.ok_or("Database not connected")?;
       // ... database operations
       Ok(result)
   }
   ```

2. **Register in `src-tauri/src/lib.rs`**:
   - Add to `invoke_handler![]` macro
   - Import function from `db_commands` module

3. **Frontend types**: Create matching TypeScript interfaces in `src/types/database.ts`

### Common Pitfalls to Avoid

- **Table naming mismatch**: Entity `table_name` must match migration table identifier
- **DateTime types**: Use `chrono::NaiveDateTime` in entities, not `DateTime<Utc>`
- **Missing IF NOT EXISTS**: Always include in CREATE statements
- **Modifying existing migrations**: Always create new migration files
- **Missing entity registration**: Update `entities/mod.rs` when adding new entities
- **Migration order**: Migrations must be registered in chronological order

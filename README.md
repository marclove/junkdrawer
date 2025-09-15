# Junkdrawer

Junkdrawer is a place to stash all the digital stuff you think you might want later without having to think about how, when, or exactly why.

junk draw·er (noun): a drawer used for storing small, miscellaneous, occasionally useful objects of little to no (or unclear) monetary value, and possibly significant sentimental value.

## Architecture

Junkdrawer is built as a Tauri desktop application combining:
- **Frontend**: React 19 + TypeScript with Vite
- **Backend**: Rust with Tauri framework
- **Database**: SQLite with SeaORM for data persistence
- **Search**: Embedded Typesense server for full-text search

## Development Setup

### Prerequisites
- Node.js and pnpm
- Rust toolchain
- Tauri CLI

### Getting Started

1. **Install dependencies**:
   ```bash
   pnpm install
   ```

2. **Development mode**:
   ```bash
   pnpm tauri dev
   ```

3. **Build for production**:
   ```bash
   pnpm tauri build
   ```

### Database Commands
Common database management tasks:
```bash
just db-status              # Check database status
just db-reset               # Reset database for fresh start
just db-new-migration "name" # Create new migration file
just db-backup              # Create timestamped backup
```

## Database System

Junkdrawer uses SQLite with SeaORM for robust data persistence:

### Database Location
- **macOS**: `~/Library/Application Support/com.marc.junkdrawer/junkdrawer.sqlite`
- **Windows**: `%APPDATA%\com.marc.junkdrawer\junkdrawer.sqlite`
- **Linux**: `~/.local/share/com.marc.junkdrawer/junkdrawer.sqlite`

### Schema Management
Database schema is managed through SeaORM migrations located in `src-tauri/src/migration/`. 

**Current schema**:
- `items` table: Stores digital content with title, content, type, tags, and timestamps
- Automatic migration system ensures schema stays up-to-date

### Available Operations
- Create, read, update, delete items
- Full-text search via Typesense integration
- Automatic timestamp management
- Type-safe database operations through SeaORM

### Developer Commands

The project includes convenient just commands for database management:

```bash
# View database location for your platform
just db-path

# Check database status and migration info
just db-status

# Reset database (deletes and recreates on next run)
just db-reset

# Create a timestamped backup
just db-backup

# Create a new migration file
just db-new-migration "add_user_table"

# Open SQLite shell for direct database access
just db-shell
```

### Resetting Database
To start with a fresh database (useful during development):
```bash
just db-reset
# Then restart the application
pnpm tauri dev
```

The migration system will automatically recreate the database with the latest schema.

## Database Schema Management

### Creating New Tables

1. **Create Entity Model**:
   Create a new file in `src-tauri/src/entities/` (e.g., `user.rs`):
   ```rust
   use sea_orm::entity::prelude::*;
   use serde::{Deserialize, Serialize};

   #[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, Serialize, Deserialize)]
   #[sea_orm(table_name = "users")]
   pub struct Model {
       #[sea_orm(primary_key)]
       pub id: i32,
       pub name: String,
       pub email: String,
       pub created_at: chrono::NaiveDateTime,
   }

   #[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
   pub enum Relation {}

   impl ActiveModelBehavior for ActiveModel {
       fn new() -> Self {
           Self {
               created_at: Set(chrono::Utc::now().naive_utc()),
               ..ActiveModelTrait::default()
           }
       }
   }
   ```

2. **Update entities/mod.rs**:
   ```rust
   pub mod item;
   pub mod user;  // Add this line

   pub use item::{Entity as Item, Model as ItemModel, ActiveModel as ItemActiveModel};
   pub use user::{Entity as User, Model as UserModel, ActiveModel as UserActiveModel};
   ```

3. **Create Migration File**:
   Create `src-tauri/src/migration/m20241215_000002_create_users_table.rs`:
   ```rust
   use sea_orm_migration::prelude::*;

   #[derive(DeriveMigrationName)]
   pub struct Migration;

   #[async_trait::async_trait]
   impl MigrationTrait for Migration {
       async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
           manager
               .create_table(
                   Table::create()
                       .table(User::Table)
                       .if_not_exists()
                       .col(ColumnDef::new(User::Id).integer().not_null().auto_increment().primary_key())
                       .col(ColumnDef::new(User::Name).string().not_null())
                       .col(ColumnDef::new(User::Email).string().not_null())
                       .col(ColumnDef::new(User::CreatedAt).timestamp().not_null())
                       .to_owned(),
               )
               .await
       }

       async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
           manager.drop_table(Table::drop().table(User::Table).to_owned()).await
       }
   }

   #[derive(DeriveIden)]
   enum User {
       #[sea_orm(iden = "users")]
       Table,
       Id,
       Name,
       Email,
       CreatedAt,
   }
   ```

4. **Register Migration**:
   Update `src-tauri/src/migration/mod.rs`:
   ```rust
   mod m20241215_000001_create_items_table;
   mod m20241215_000002_create_users_table;  // Add this line

   impl MigratorTrait for Migrator {
       fn migrations() -> Vec<Box<dyn MigrationTrait>> {
           vec![
               Box::new(m20241215_000001_create_items_table::Migration),
               Box::new(m20241215_000002_create_users_table::Migration),  // Add this line
           ]
       }
   }
   ```

### Modifying Existing Tables

1. **Update Entity Model** with new fields
2. **Create Alter Migration**:
   ```rust
   // Example: Adding a column
   async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
       manager
           .alter_table(
               Table::alter()
                   .table(Item::Table)
                   .add_column(ColumnDef::new(Item::NewField).string())
                   .to_owned(),
           )
           .await
   }
   ```

### Dropping Tables

1. **Create Drop Migration**:
   ```rust
   async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
       manager.drop_table(Table::drop().table(User::Table).to_owned()).await
   }
   ```

2. **Remove Entity Model** and update `mod.rs`

### Running Migrations

Migrations run automatically on app startup. For manual control:
- Reset database: Delete the SQLite file and restart
- Migrations are tracked in the `seaql_migrations` table

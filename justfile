# Development setup
download-macos-binary:
    curl -O https://dl.typesense.org/releases/29.0/typesense-server-29.0-darwin-arm64.tar.gz
    tar -xzf typesense-server-29.0-darwin-arm64.tar.gz
    mv typesense-server typesense/typesense-server-aarch64-apple-darwin
    rm typesense-server-29.0-darwin-arm64.tar.gz typesense-server.md5.txt

# Database management
db-path:
    @echo "Database locations by platform:"
    @echo "macOS: ~/Library/Application Support/com.marc.junkdrawer/junkdrawer.sqlite"
    @echo "Linux: ~/.local/share/com.marc.junkdrawer/junkdrawer.sqlite"
    @echo "Windows: %APPDATA%\\com.marc.junkdrawer\\junkdrawer.sqlite"

db-reset:
    #!/usr/bin/env bash
    set -euo pipefail
    DB_PATH=""
    if [[ "$OSTYPE" == "darwin"* ]]; then
        DB_PATH="$HOME/Library/Application Support/com.marc.junkdrawer/junkdrawer.sqlite"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        DB_PATH="$HOME/.local/share/com.marc.junkdrawer/junkdrawer.sqlite"
    elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
        DB_PATH="$APPDATA/com.marc.junkdrawer/junkdrawer.sqlite"
    else
        echo "Unsupported platform: $OSTYPE"
        exit 1
    fi

    if [ -f "$DB_PATH" ]; then
        echo "Removing database: $DB_PATH"
        rm "$DB_PATH"
        echo "Database reset complete. Restart the app to recreate with latest migrations."
    else
        echo "Database not found at: $DB_PATH"
        echo "Nothing to reset."
    fi

db-status:
    #!/usr/bin/env bash
    set -euo pipefail
    DB_PATH=""
    if [[ "$OSTYPE" == "darwin"* ]]; then
        DB_PATH="$HOME/Library/Application Support/com.marc.junkdrawer/junkdrawer.sqlite"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        DB_PATH="$HOME/.local/share/com.marc.junkdrawer/junkdrawer.sqlite"
    elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
        DB_PATH="$APPDATA/com.marc.junkdrawer/junkdrawer.sqlite"
    else
        echo "Unsupported platform: $OSTYPE"
        exit 1
    fi

    echo "Database path: $DB_PATH"
    if [ -f "$DB_PATH" ]; then
        echo "Status: Database exists"
        echo "Size: $(du -h "$DB_PATH" | cut -f1)"
        if command -v sqlite3 &> /dev/null; then
            echo "Tables:"
            sqlite3 "$DB_PATH" ".tables"
            echo "Migration status:"
            sqlite3 "$DB_PATH" "SELECT version, applied_at FROM seaql_migrations ORDER BY version;" 2>/dev/null || echo "No migration table found"
        else
            echo "Install sqlite3 CLI for detailed database inspection"
        fi
    else
        echo "Status: Database does not exist"
        echo "Run the app to create it with initial migrations"
    fi

db-backup:
    #!/usr/bin/env bash
    set -euo pipefail
    DB_PATH=""
    if [[ "$OSTYPE" == "darwin"* ]]; then
        DB_PATH="$HOME/Library/Application Support/com.marc.junkdrawer/junkdrawer.sqlite"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        DB_PATH="$HOME/.local/share/com.marc.junkdrawer/junkdrawer.sqlite"
    elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
        DB_PATH="$APPDATA/com.marc.junkdrawer/junkdrawer.sqlite"
    else
        echo "Unsupported platform: $OSTYPE"
        exit 1
    fi

    if [ -f "$DB_PATH" ]; then
        BACKUP_PATH="${DB_PATH}.backup.$(date +%Y%m%d_%H%M%S)"
        cp "$DB_PATH" "$BACKUP_PATH"
        echo "Database backed up to: $BACKUP_PATH"
    else
        echo "Database not found at: $DB_PATH"
        echo "Nothing to backup."
    fi

db-new-migration name:
    #!/usr/bin/env bash
    set -euo pipefail
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    FILENAME="m${TIMESTAMP}_{{ name }}.rs"
    FILEPATH="src-tauri/src/migration/$FILENAME"

    if [ -f "$FILEPATH" ]; then
        echo "Migration file already exists: $FILEPATH"
        exit 1
    fi

    cat > "$FILEPATH" << 'EOF'
    use sea_orm_migration::prelude::*;

    #[derive(DeriveMigrationName)]
    pub struct Migration;

    #[async_trait::async_trait]
    impl MigrationTrait for Migration {
        async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
            // Add your migration logic here
            todo!("Implement migration up")
        }

        async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
            // Add your rollback logic here
            todo!("Implement migration down")
        }
    }

    // Define your table/column identifiers here
    #[derive(DeriveIden)]
    enum YourTable {
        #[sea_orm(iden = "your_table_name")]
        Table,
        Id,
        // Add other columns here
    }
    EOF

    echo "Created migration file: $FILEPATH"
    echo ""
    echo "Next steps:"
    echo "1. Edit $FILEPATH and implement your migration"
    echo "2. Add 'mod $FILENAME;' to src-tauri/src/migration/mod.rs (without .rs extension)"
    echo "3. Add the migration to the migrations() vector in mod.rs"
    echo "4. Test with 'just db-reset' and restart the app"

db-shell:
    #!/usr/bin/env bash
    set -euo pipefail
    if ! command -v sqlite3 &> /dev/null; then
        echo "sqlite3 CLI not found. Please install sqlite3."
        exit 1
    fi

    DB_PATH=""
    if [[ "$OSTYPE" == "darwin"* ]]; then
        DB_PATH="$HOME/Library/Application Support/com.marc.junkdrawer/junkdrawer.sqlite"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        DB_PATH="$HOME/.local/share/com.marc.junkdrawer/junkdrawer.sqlite"
    elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
        DB_PATH="$APPDATA/com.marc.junkdrawer/junkdrawer.sqlite"
    else
        echo "Unsupported platform: $OSTYPE"
        exit 1
    fi

    if [ -f "$DB_PATH" ]; then
        echo "Opening SQLite shell for: $DB_PATH"
        sqlite3 "$DB_PATH"
    else
        echo "Database not found at: $DB_PATH"
        echo "Run the app first to create the database."
    fi

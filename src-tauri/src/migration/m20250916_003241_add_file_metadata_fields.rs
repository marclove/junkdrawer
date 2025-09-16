use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Add mime_type column
        manager
            .alter_table(
                Table::alter()
                    .table(Item::Table)
                    .add_column(ColumnDef::new(Item::MimeType).string())
                    .to_owned(),
            )
            .await?;

        // Add file_size column
        manager
            .alter_table(
                Table::alter()
                    .table(Item::Table)
                    .add_column(ColumnDef::new(Item::FileSize).big_integer())
                    .to_owned(),
            )
            .await?;

        // Add file_modified_at column
        manager
            .alter_table(
                Table::alter()
                    .table(Item::Table)
                    .add_column(ColumnDef::new(Item::FileModifiedAt).timestamp())
                    .to_owned(),
            )
            .await?;

        // Add metadata JSON column for flexible future fields
        manager
            .alter_table(
                Table::alter()
                    .table(Item::Table)
                    .add_column(ColumnDef::new(Item::Metadata).text())
                    .to_owned(),
            )
            .await

    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Drop metadata column
        manager
            .alter_table(
                Table::alter()
                    .table(Item::Table)
                    .drop_column(Item::Metadata)
                    .to_owned(),
            )
            .await?;

        // Drop file_modified_at column  
        manager
            .alter_table(
                Table::alter()
                    .table(Item::Table)
                    .drop_column(Item::FileModifiedAt)
                    .to_owned(),
            )
            .await?;

        // Drop file_size column
        manager
            .alter_table(
                Table::alter()
                    .table(Item::Table)
                    .drop_column(Item::FileSize)
                    .to_owned(),
            )
            .await?;

        // Drop mime_type column
        manager
            .alter_table(
                Table::alter()
                    .table(Item::Table)
                    .drop_column(Item::MimeType)
                    .to_owned(),
            )
            .await
    }
}

#[derive(DeriveIden)]
enum Item {
    #[sea_orm(iden = "items")]
    Table,
    MimeType,
    FileSize,
    FileModifiedAt,
    Metadata,
}

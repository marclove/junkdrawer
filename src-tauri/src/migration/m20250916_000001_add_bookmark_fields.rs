use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Add source_type column
        manager
            .alter_table(
                Table::alter()
                    .table(Item::Table)
                    .add_column(ColumnDef::new(Item::SourceType).string())
                    .to_owned(),
            )
            .await?;

        // Add source_url column  
        manager
            .alter_table(
                Table::alter()
                    .table(Item::Table)
                    .add_column(ColumnDef::new(Item::SourceUrl).text())
                    .to_owned(),
            )
            .await?;

        // Create index on source_type for efficient filtering
        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_items_source_type")
                    .table(Item::Table)
                    .col(Item::SourceType)
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Drop source_url column
        manager
            .alter_table(
                Table::alter()
                    .table(Item::Table)
                    .drop_column(Item::SourceUrl)
                    .to_owned(),
            )
            .await?;

        // Drop source_type column
        manager
            .alter_table(
                Table::alter()
                    .table(Item::Table)
                    .drop_column(Item::SourceType)
                    .to_owned(),
            )
            .await
    }
}

#[derive(DeriveIden)]
enum Item {
    #[sea_orm(iden = "items")]
    Table,
    SourceType,
    SourceUrl,
}
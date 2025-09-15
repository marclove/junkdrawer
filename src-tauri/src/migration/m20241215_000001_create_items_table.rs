use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(Item::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(Item::Id)
                            .integer()
                            .not_null()
                            .auto_increment()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(Item::Title).string().not_null())
                    .col(ColumnDef::new(Item::Content).text())
                    .col(ColumnDef::new(Item::ItemType).string().not_null())
                    .col(ColumnDef::new(Item::Tags).text())
                    .col(ColumnDef::new(Item::CreatedAt).timestamp().not_null())
                    .col(ColumnDef::new(Item::UpdatedAt).timestamp().not_null())
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_items_title")
                    .table(Item::Table)
                    .col(Item::Title)
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(Item::Table).to_owned())
            .await
    }
}

#[derive(DeriveIden)]
enum Item {
    #[sea_orm(iden = "items")]
    Table,
    Id,
    Title,
    Content,
    ItemType,
    Tags,
    CreatedAt,
    UpdatedAt,
}

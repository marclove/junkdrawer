pub use sea_orm_migration::prelude::*;

mod m20241215_000001_create_items_table;
mod m20250916_000001_add_bookmark_fields;
mod m20250916_003241_add_file_metadata_fields;

pub struct Migrator;

#[async_trait::async_trait]
impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        vec![
            Box::new(m20241215_000001_create_items_table::Migration),
            Box::new(m20250916_000001_add_bookmark_fields::Migration),
            Box::new(m20250916_003241_add_file_metadata_fields::Migration),
        ]
    }
}

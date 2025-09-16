# Junkdrawer Product Roadmap

## Vision Statement

Transform Junkdrawer from a simple notes app into a powerful multi-dimensional information management system that makes stashing digital content effortless and discovering structure within that content surprisingly useful.

## Core Principles

- **Effortless Capture**: Adding information should require minimal cognitive overhead
- **Rich Discovery**: Multiple ways to navigate and find connections in stored data
- **Flexible Organization**: Support various mental models and workflows
- **Semantic Understanding**: Leverage NLP/ML to reveal hidden patterns and relationships
- **Personal Knowledge Graph**: Build a interconnected web of your digital life

## Current State Analysis

**What We Have:**
- Basic notes workspace with autosave
- SQLite database with SeaORM migrations
- Typesense integration for search
- Tauri desktop app architecture
- Minimal shadcn UI components (button, input, textarea)

**Pain Points:**
- Single view mode (notes only)
- Limited content types (text notes only)
- No file system integration
- Basic tagging system
- No relationship modeling
- Linear browsing experience

## Transformation Phases

### Phase 1: Foundation & Data Model

**Database Schema Extensions**

Extend the `items` table with richer metadata:
```sql
ALTER TABLE items ADD COLUMN source_type TEXT; -- bookmark, file, directory, note, snippet, image, pdf, etc.
ALTER TABLE items ADD COLUMN source_url TEXT; -- Original URL or file path
ALTER TABLE items ADD COLUMN mime_type TEXT; -- Content type for proper handling  
ALTER TABLE items ADD COLUMN metadata TEXT; -- JSON field for flexible metadata storage
ALTER TABLE items ADD COLUMN extracted_text TEXT; -- Full text from PDFs/docs
ALTER TABLE items ADD COLUMN file_size INTEGER; -- File size in bytes
ALTER TABLE items ADD COLUMN file_modified_at TIMESTAMP; -- Original file modification time
```

**New Supporting Tables**

1. **Collections Table**
   ```sql
   CREATE TABLE collections (
     id INTEGER PRIMARY KEY,
     name TEXT NOT NULL,
     description TEXT,
     color TEXT,
     icon TEXT,
     query_rules TEXT, -- JSON for smart collections
     created_at TIMESTAMP,
     updated_at TIMESTAMP
   );
   
   CREATE TABLE collection_items (
     collection_id INTEGER,
     item_id INTEGER,
     added_at TIMESTAMP,
     PRIMARY KEY (collection_id, item_id)
   );
   ```

2. **Item Relationships Table**
   ```sql
   CREATE TABLE item_relationships (
     id INTEGER PRIMARY KEY,
     source_item_id INTEGER,
     target_item_id INTEGER,
     relationship_type TEXT, -- references, mentions, similar_to, part_of
     strength REAL, -- 0.0 to 1.0 confidence score
     metadata TEXT, -- JSON for relationship details
     created_at TIMESTAMP
   );
   ```

3. **Watched Paths Table**
   ```sql
   CREATE TABLE watched_paths (
     id INTEGER PRIMARY KEY,
     path TEXT UNIQUE NOT NULL,
     recursive BOOLEAN DEFAULT TRUE,
     file_pattern TEXT, -- glob pattern for file matching
     auto_import BOOLEAN DEFAULT TRUE,
     last_scan TIMESTAMP,
     created_at TIMESTAMP
   );
   ```

4. **Extracted Entities Table**
   ```sql
   CREATE TABLE extracted_entities (
     id INTEGER PRIMARY KEY,
     item_id INTEGER,
     entity_type TEXT, -- PERSON, ORG, LOCATION, DATE, TOPIC
     entity_value TEXT,
     confidence REAL,
     context TEXT, -- surrounding text
     position_start INTEGER,
     position_end INTEGER,
     created_at TIMESTAMP
   );
   ```

5. **Auto Tags Table**
   ```sql
   CREATE TABLE auto_tags (
     id INTEGER PRIMARY KEY,
     item_id INTEGER,
     tag TEXT,
     tag_type TEXT, -- topic, sentiment, category, keyword
     confidence REAL,
     algorithm TEXT, -- which ML model generated this
     created_at TIMESTAMP
   );
   ```

6. **Embeddings Table**
   ```sql
   CREATE TABLE embeddings (
     id INTEGER PRIMARY KEY,
     item_id INTEGER,
     model_name TEXT, -- e.g., 'sentence-transformers/all-MiniLM-L6-v2'
     embedding BLOB, -- serialized vector
     chunk_index INTEGER DEFAULT 0, -- for large documents split into chunks
     created_at TIMESTAMP
   );
   ```

### Phase 2: UI Architecture Redesign

**Core Layout Transformation**

Replace single-pane notes interface with flexible multi-panel workspace:

```
┌─────────────────────────────────────────────────────────────┐
│ Header: Logo | Global Search | Quick Add | View Mode | User │
├─────────┬───────────────────────────────────┬───────────────┤
│         │                                   │               │
│ Left    │           Content Area            │ Right Panel   │
│ Panel   │                                   │               │
│         │  ┌─────────────────────────────┐  │               │
│ Nav     │  │                             │  │ Item Details  │
│ ├─────  │  │    Item Cards/List/Graph    │  │               │
│ │Recent │  │                             │  │ Metadata      │
│ │Collections│  │  [Card] [Card] [Card]  │  │ Tags          │
│ │All Items│  │  [Card] [Card] [Card]     │  │ Related Items │
│ │Types  │  │  [Card] [Card] [Card]      │  │ Quick Actions │
│ │       │  │                             │  │               │
│ Filters │  └─────────────────────────────┘  │               │
│ ├─────  │                                   │               │
│ │Dates  │  View Controls:                   │               │
│ │Sources│  [Grid] [List] [Timeline] [Graph] │               │
│ │Tags   │                                   │               │
│         │                                   │               │
└─────────┴───────────────────────────────────┴───────────────┘
```

**Navigation Dimensions**

1. **Temporal Navigation**
   - Timeline slider for date range selection
   - "Today", "This Week", "This Month" quick filters
   - Activity heatmap calendar view

2. **Categorical Navigation**
   - Content type filters (notes, bookmarks, files, etc.)
   - Source filters (web, filesystem, manual entry)
   - Collection-based organization

3. **Semantic Navigation**
   - Tag cloud with size indicating frequency
   - Topic clusters from topic modeling
   - Similar items recommendations

4. **Relationship Navigation**
   - Graph view of item connections
   - Breadcrumb trails for exploration paths
   - "How you got here" history

### Phase 3: shadcn Component Implementation

**Essential Components to Add:**

**Data Display:**
- `Card` - Primary container for items in grid view
- `Badge` - Tags, content types, and metadata indicators
- `Avatar` - Icons for different content sources
- `Separator` - Visual organization in lists and panels

**Navigation & Commands:**
- `Command` - Quick capture and global search (⌘K)
- `Breadcrumb` - Show navigation path
- `Tabs` - Switch between view modes
- `Pagination` - Handle large result sets

**Interaction:**
- `Dialog` - Item details and editing modals
- `Dropdown Menu` - Context menus for items
- `Sheet` - Slide-out panels for filters and details
- `Tooltip` - Contextual help and previews

**Form & Input:**
- `Select` - Dropdowns for filters and categories
- `Checkbox` - Bulk selection and filter options
- `RadioGroup` - Exclusive selection options
- `Toggle Group` - View mode switching
- `Slider` - Timeline navigation and confidence thresholds

**Feedback:**
- `Toast` - Success/error notifications
- `Progress` - File uploads and processing status
- `Alert` - Important system messages
- `Skeleton` - Loading states for content

**Layout:**
- `ScrollArea` - Better scrolling experience
- `Resizable` - Adjustable panel sizes
- `Collapsible` - Expandable sections

### Phase 4: Core Features Implementation

#### 4.1 Quick Capture System

**Global Command Palette (⌘K)**
- Floating modal overlay with fuzzy search
- Quick actions: "Add URL", "Upload File", "Create Note", "Scan Folder"
- Recent items for quick access
- Search across all content with live results
- Keyboard shortcuts for power users

**Capture Methods:**
```typescript
interface CaptureMethod {
  type: 'url' | 'file' | 'text' | 'directory' | 'voice';
  handler: (input: unknown) => Promise<Item>;
  validation: (input: unknown) => boolean;
}
```

1. **URL Capture**
   - Auto-fetch title, description, favicon
   - Screenshot generation for visual bookmarks
   - Content extraction for articles
   - Detect content type (article, video, product, etc.)

2. **File Upload**
   - Drag & drop interface
   - Bulk upload support
   - Progress indicators
   - Auto-text extraction for supported formats

3. **Directory Watching**
   - Select folders to monitor
   - Automatic import of new/modified files
   - Configurable file type filters
   - Respect .gitignore style rules

4. **Quick Note Creation**
   - Inline editing in capture modal
   - Auto-save as you type
   - Tag suggestions based on content
   - Template support for common note types

#### 4.2 Multi-View System

**Grid View (Default)**
```typescript
interface GridViewConfig {
  cardSize: 'small' | 'medium' | 'large';
  columns: 'auto' | number;
  showPreviews: boolean;
  groupBy?: 'date' | 'type' | 'collection' | 'source';
}
```
- Pinterest-style masonry layout
- Rich preview cards with thumbnails
- Hover interactions for quick actions
- Infinite scroll with virtualization

**List View**
```typescript
interface ListViewConfig {
  density: 'compact' | 'comfortable' | 'spacious';
  showMetadata: boolean;
  sortBy: 'created' | 'modified' | 'relevance' | 'title';
  sortOrder: 'asc' | 'desc';
}
```
- Sortable columns
- Bulk selection
- Inline quick edit
- Keyboard navigation

**Timeline View**
```typescript
interface TimelineViewConfig {
  grouping: 'day' | 'week' | 'month' | 'year';
  showEmpty: boolean;
  activityHeatmap: boolean;
}
```
- Chronological organization
- Zoom levels (day/week/month/year)
- Activity patterns visualization
- Time-based filtering

**Graph View**
```typescript
interface GraphViewConfig {
  layout: 'force' | 'hierarchical' | 'circular';
  nodeSize: 'uniform' | 'by-connections' | 'by-recency';
  showLabels: boolean;
  relationshipTypes: string[];
}
```
- Interactive node-link diagram
- Relationship visualization
- Cluster detection
- Path finding between items

**Kanban View**
```typescript
interface KanbanViewConfig {
  columns: KanbanColumn[];
  swimlanes?: 'collection' | 'source' | 'type';
  cardFields: string[];
}

interface KanbanColumn {
  id: string;
  title: string;
  query: ItemQuery;
  limit?: number;
}
```
- Customizable columns based on queries
- Drag & drop between columns
- WIP limits
- Progress tracking

#### 4.3 Smart Filtering & Search

**Faceted Search Interface**
```typescript
interface SearchState {
  query: string;
  filters: {
    contentType: string[];
    dateRange: [Date, Date] | null;
    tags: string[];
    source: string[];
    collections: string[];
    hasRelations: boolean;
    confidence: [number, number];
  };
  sort: SortOption;
  view: ViewMode;
}
```

**Search Capabilities:**
1. **Full-text Search** via Typesense
2. **Semantic Search** via embeddings
3. **Hybrid Search** combining BM25 + vector similarity
4. **Faceted Filtering** with live count updates
5. **Saved Searches** as virtual collections
6. **Search Suggestions** based on content and history

**Filter Panel Components:**
- Date range picker with presets
- Tag autocomplete with frequency counts
- Content type toggles with icons
- Source filter tree
- Confidence sliders for ML-generated data

#### 4.4 Rich Item Cards

**Card Component Structure:**
```typescript
interface ItemCard {
  item: Item;
  size: 'small' | 'medium' | 'large';
  showPreview: boolean;
  showMetadata: boolean;
  actions: CardAction[];
}

interface CardAction {
  icon: ReactNode;
  label: string;
  handler: (item: Item) => void;
  shortcut?: string;
}
```

**Card Features:**
- **Visual Previews**: Thumbnails, favicons, file type icons
- **Metadata Badges**: Content type, source, confidence scores
- **Quick Actions**: Edit, delete, share, relate, collect
- **Hover Preview**: Expanded content without navigation
- **Status Indicators**: Sync status, processing state, errors

### Phase 5: File System Integration

#### 5.1 Directory Watching

**Watch Configuration:**
```typescript
interface WatchConfig {
  path: string;
  recursive: boolean;
  patterns: string[]; // glob patterns
  excludePatterns: string[];
  autoImport: boolean;
  extractText: boolean;
  generateThumbnails: boolean;
}
```

**Supported File Types:**
- **Text**: .md, .txt, .rtf, .html
- **Documents**: .pdf, .docx, .pptx, .xlsx
- **Code**: .js, .ts, .py, .rs, .md, .json
- **Images**: .jpg, .png, .gif, .svg, .webp
- **Archives**: .zip, .tar.gz (extract and index contents)

**Processing Pipeline:**
1. **File Detection**: Watch filesystem events
2. **Content Extraction**: Pull text from various formats
3. **Metadata Extraction**: File stats, EXIF data, document properties
4. **Thumbnail Generation**: Visual previews for supported types
5. **Text Analysis**: Entity extraction, keyword identification
6. **Embedding Generation**: Vector representations for semantic search

#### 5.2 Import & Processing

**Tauri Commands for File Operations:**
```rust
#[tauri::command]
async fn watch_directory(path: String, config: WatchConfig) -> Result<(), String>;

#[tauri::command]
async fn extract_text_from_file(path: String) -> Result<String, String>;

#[tauri::command]
async fn generate_thumbnail(path: String, size: u32) -> Result<String, String>;

#[tauri::command]
async fn bulk_import_directory(path: String, recursive: bool) -> Result<Vec<Item>, String>;
```

### Phase 6: NLP & ML Features

#### 6.1 Auto-Enrichment Pipeline

**Text Processing Pipeline:**
```typescript
interface ProcessingPipeline {
  steps: ProcessingStep[];
  parallel: boolean;
  retryOnFailure: boolean;
}

interface ProcessingStep {
  name: string;
  processor: TextProcessor;
  dependencies: string[];
  optional: boolean;
}
```

**Processing Steps:**

1. **Named Entity Recognition (NER)**
   - Extract people, organizations, locations, dates
   - Use spaCy or Transformers models
   - Store with confidence scores and context

2. **Keyword Extraction**
   - TF-IDF based extraction
   - YAKE algorithm for unsupervised extraction
   - Store top N keywords with scores

3. **Topic Modeling**
   - LDA or BERTopic for document topics
   - Hierarchical topic clustering
   - Topic evolution over time

4. **Sentiment Analysis**
   - Document-level sentiment scoring
   - Emotion detection (joy, anger, fear, etc.)
   - Subjectivity analysis

5. **Document Classification**
   - Content type classification (article, documentation, personal note)
   - Intent classification (information, task, reference)
   - Quality scoring

6. **Embedding Generation**
   - Sentence-BERT or similar models
   - Store 384/768 dimensional vectors
   - Support for chunking large documents

#### 6.2 Discovery Features

**Similarity & Recommendations:**
```typescript
interface SimilarityEngine {
  findSimilar(itemId: number, limit: number): Promise<SimilarItem[]>;
  findClusters(items: Item[]): Promise<ItemCluster[]>;
  recommendedActions(item: Item): Promise<RecommendedAction[]>;
}

interface SimilarItem {
  item: Item;
  similarity: number;
  reasons: string[];
}
```

**Discovery Components:**

1. **Similar Items Widget**
   - Vector similarity using embeddings
   - Content-based filtering
   - Collaborative filtering based on collections
   - Hybrid recommendations

2. **Trending Topics Dashboard**
   - Topic frequency over time
   - Emerging topics detection
   - Personal interest trends
   - Content velocity metrics

3. **Connection Graph Visualization**
   - Force-directed layout
   - Relationship strength visualization
   - Path discovery between items
   - Community detection

4. **Smart Collections**
   - Rule-based auto-collections
   - ML-powered content grouping
   - Temporal collections (e.g., "This week's discoveries")
   - Collaborative collections

### Phase 7: Advanced Features

#### 7.1 Collaboration & Sharing

**Sharing Mechanisms:**
- Export collections as JSON/Markdown
- Generate shareable links for public collections
- Real-time collaboration on shared collections
- Import from external sources (Pocket, Instapaper, etc.)

#### 7.2 API & Integrations

**REST API:**
- CRUD operations for all entities
- GraphQL endpoint for complex queries
- Webhook support for external integrations
- Plugin system for custom processors

**Browser Extension:**
- One-click bookmark saving
- Highlight and save text snippets
- Automatic tagging based on page content
- Sync with desktop app

#### 7.3 Data Management

**Backup & Sync:**
- Automatic local backups
- Cloud storage integration (optional)
- Export in standard formats
- Data portability guarantees

**Performance Optimization:**
- Database indexing strategy
- Vector index for embedding search
- Lazy loading for large collections
- Background processing for heavy operations

## Implementation Strategy

### Iterative Development Approach

Each phase should be broken down into small, deliverable user stories following INVEST principles:

- **Independent**: Can be developed and deployed separately
- **Negotiable**: Scope can be adjusted based on learning
- **Valuable**: Provides immediate user benefit
- **Estimable**: Can be reasonably estimated for effort
- **Small**: Can be completed in 1-2 weeks max
- **Testable**: Has clear acceptance criteria

### Technical Debt Considerations

1. **Migration Strategy**: Each database schema change needs proper migrations
2. **Component Library**: Gradually expand shadcn components as needed
3. **Performance**: Monitor and optimize search performance as content grows
4. **Error Handling**: Robust error handling for file operations and ML processing
5. **Testing**: Comprehensive test coverage for core features

### Success Metrics

**User Experience Metrics:**
- Time to capture new content (target: <10 seconds)
- Search result relevance (user feedback scores)
- Discovery rate (items found through exploration vs search)
- Collection creation and usage patterns

**Technical Metrics:**
- Search response time (target: <200ms)
- Import processing time per file type
- Vector similarity accuracy
- Database query performance

**Content Metrics:**
- Content growth rate
- Content type diversity
- Relationship density in graph
- Tag usage patterns

## Next Steps

1. **Create User Story Backlog**: Break down Phase 1 into implementable stories
2. **Technical Spike**: Research embedding models and vector databases
3. **UI Mockups**: Create detailed mockups for new interface
4. **Architecture Review**: Validate technical approach
5. **Prototype**: Build minimal viable version of multi-view interface
export interface Item {
  id: number
  title: string
  content: string | null
  item_type: string
  tags: string | null
  source_type: string | null
  source_url: string | null
  created_at: string
  updated_at: string
}

export interface CreateItemRequest {
  title: string
  content?: string | null
  item_type: string
  tags?: string | null
  source_type?: string | null
  source_url?: string | null
}

export interface UpdateItemRequest {
  id: number
  title: string
  content?: string | null
  item_type: string
  tags?: string | null
  source_type?: string | null
  source_url?: string | null
}

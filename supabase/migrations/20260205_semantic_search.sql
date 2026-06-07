-- Enable pgvector extension if not already enabled
create extension if not exists vector;

-- Create a function to search notes by embedding similarity
create or replace function match_notes(
  query_embedding vector(768),
  match_workspace_id uuid,
  match_count int default 5,
  exclude_note_id uuid default null
)
returns table (
  id uuid,
  title text,
  transcript text,
  image_url text,
  created_at timestamptz,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    n.id,
    n.title,
    n.transcript,
    n.image_url,
    n.created_at,
    1 - (n.embedding <=> query_embedding) as similarity
  from notes n
  where n.workspace_id = match_workspace_id
    and n.embedding is not null
    and (exclude_note_id is null or n.id != exclude_note_id)
  order by n.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- Create index for faster vector searches (if not exists)
create index if not exists notes_embedding_idx on notes using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

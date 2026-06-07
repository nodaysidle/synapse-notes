export interface User {
    id: string;
    email: string;
    created_at: Date;
    updated_at: Date;
}

export interface Note {
    id: string;
    user_id: string;
    title: string;
    content?: string;
    transcript?: string;
    audio_url?: string;
    image_url?: string; // Generated visualization URL
    duration?: number;
    embedding_status: 'pending' | 'processing' | 'completed' | 'failed';
    created_at: Date;
    updated_at: Date;
}

export interface Tag {
    id: string;
    name: string;
    user_id: string;
    created_at: Date;
}

export interface NoteTag {
    note_id: string;
    tag_id: string;
}

export interface ManualLink {
    id: string;
    source_note_id: string;
    target_note_id: string;
    created_at: Date;
}

export interface CreateNoteDto {
    title?: string;
    content?: string;
    tags?: string[];
}

export interface UpdateNoteDto {
    title?: string;
    content?: string;
    tags?: string[];
}

export interface NoteWithDetails extends Note {
    tags?: Tag[];
    manual_links?: ManualLink[];
    related_notes?: RelatedNote[];
}

export interface AudioUploadResponse {
    note_id: string;
    audio_url: string;
    duration: number;
}

export interface SearchRequest {
    query: string;
    limit?: number;
    threshold?: number;
}

export interface SearchResult {
    note: Note;
    transcript_snippet?: string;
    similarity_score: number;
}

export interface TranscriptionJob {
    note_id: string;
    audio_path: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    error?: string;
}

export interface RelatedNote extends Note {
    similarity_score: number;
    connection_reason: string;
}

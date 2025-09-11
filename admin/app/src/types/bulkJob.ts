export interface BulkJobDocuments {
  document_type: string;
  post_ids?: number[];
  post_types?: string[];
  titles?: string[];
}

export interface BulkJob {
  id: string;
  job_id: string;
  user_id: string;
  total_documents: string;
  processed_documents: string;
  successful_documents: string;
  failed_documents: string;
  status: 'scheduled' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'partial';
  documents: BulkJobDocuments;
  errors: Array<{
    document_title: string;
    error: string;
  }>;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  progress: number;
}

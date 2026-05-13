import { supabase } from '@/lib/supabase';

export interface QuoteAttachment {
  id: string;
  quote_id: string;
  org_id: string;
  file_name: string;
  file_path: string;
  file_url: string;
  mime_type: string | null;
  file_size: number | null;
  uploaded_by: string | null;
  created_at: string;
}

export async function fetchQuoteAttachments(quoteId: string) {
  const { data, error } = await supabase
    .from('quote_attachments')
    .select('*')
    .eq('quote_id', quoteId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as QuoteAttachment[];
}

// Sanitizes a filename for use in a storage path. Strips characters that
// can trip up storage paths or browsers ([/\\?%*:|"<>]), collapses spaces.
function safeFileName(name: string): string {
  return name
    .replace(/[/\\?%*:|"<>]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 120);
}

export async function uploadQuoteAttachment(
  file: File,
  quoteId: string,
  orgId: string,
): Promise<QuoteAttachment> {
  const cleanName = safeFileName(file.name);
  // Random prefix prevents collisions when the same file is uploaded twice.
  const randomPrefix = crypto.randomUUID().slice(0, 8);
  const path = `${orgId}/${quoteId}/${randomPrefix}-${cleanName}`;

  const { error: uploadError } = await supabase.storage
    .from('quote-attachments')
    .upload(path, file, { contentType: file.type, upsert: false });

  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage
    .from('quote-attachments')
    .getPublicUrl(path);

  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('quote_attachments')
    .insert({
      quote_id: quoteId,
      org_id: orgId,
      file_name: file.name,
      file_path: path,
      file_url: urlData.publicUrl,
      mime_type: file.type || null,
      file_size: file.size,
      uploaded_by: user?.id ?? null,
    })
    .select()
    .single();

  if (error) {
    // Roll back the storage upload if the metadata insert fails so we
    // don't leak orphaned files in the bucket.
    await supabase.storage.from('quote-attachments').remove([path]);
    throw error;
  }
  return data as QuoteAttachment;
}

export async function deleteQuoteAttachment(attachment: QuoteAttachment) {
  // Storage first; if the DB delete fails afterwards the row will be a
  // pointer to a missing file, but we never want the file to outlive the
  // metadata.
  await supabase.storage.from('quote-attachments').remove([attachment.file_path]);
  const { error } = await supabase
    .from('quote_attachments')
    .delete()
    .eq('id', attachment.id);
  if (error) throw error;
}

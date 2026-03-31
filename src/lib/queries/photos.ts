import { supabase } from '@/lib/supabase';
import type { Photo } from '@/lib/types';

export async function fetchPhotos(leadId: string, type?: Photo['type']) {
  let query = supabase
    .from('photos')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false });

  if (type) {
    query = query.eq('type', type);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as Photo[];
}

export async function uploadPhoto(
  file: File,
  leadId: string,
  orgId: string,
  type: Photo['type'],
  caption?: string,
) {
  const timestamp = Date.now();
  const path = `${orgId}/${leadId}/${type}_${timestamp}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from('photos')
    .upload(path, file, { contentType: file.type });

  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage.from('photos').getPublicUrl(path);

  const { data, error } = await supabase
    .from('photos')
    .insert({
      lead_id: leadId,
      org_id: orgId,
      type,
      url: urlData.publicUrl,
      caption: caption || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Photo;
}

export async function deletePhoto(id: string) {
  const { data: photo, error: fetchError } = await supabase
    .from('photos')
    .select('url')
    .eq('id', id)
    .single();

  if (fetchError) throw fetchError;

  const url = (photo as { url: string }).url;
  const pathMatch = url.match(/\/photos\/(.+)$/);
  if (pathMatch?.[1]) {
    await supabase.storage.from('photos').remove([pathMatch[1]]);
  }

  const { error } = await supabase.from('photos').delete().eq('id', id);
  if (error) throw error;
}

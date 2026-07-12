import { supabaseAdmin } from '@/lib/supabase'
import { randomUUID } from 'crypto'

const BUCKET = 'snaptogether-photos'

/**
 * Uploads a base64 data URL (e.g. "data:image/jpeg;base64,...") captured
 * from a canvas to Supabase Storage and returns its public URL.
 *
 * folder: subfolder within the bucket, e.g. "photos" or "strips"
 */
export async function uploadDataUrl(dataUrl: string, folder: string): Promise<string> {
  const match = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/)
  if (!match) {
    throw new Error('Invalid data URL format')
  }

  const mimeType = match[1]
  const base64Data = match[2]
  const extension = mimeType.split('/')[1] || 'jpg'
  const buffer = Buffer.from(base64Data, 'base64')

  const path = `${folder}/${randomUUID()}.${extension}`

  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType: mimeType,
      upsert: false,
    })

  if (uploadError) {
    throw new Error(`Supabase upload failed: ${uploadError.message}`)
  }

  const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

import { createClient } from './client'
import type { Database } from './types'

type Batch = Database['public']['Tables']['batches']['Row']
type Image = Database['public']['Tables']['images']['Row']
type ImageInsert = Database['public']['Tables']['images']['Insert']

// =============================================
// Batch Queries
// =============================================

export async function getBatches() {
  const supabase = createClient()
  
  const { data: batches, error } = await supabase
    .from('batches')
    .select(`
      *,
      images:images(count)
    `)
    .order('created_at', { ascending: false })

  if (error) throw error
  
  return batches.map(batch => ({
    ...batch,
    photoCount: batch.images?.[0]?.count || 0
  }))
}

export async function getBatchById(batchId: string) {
  const supabase = createClient()
  
  const { data: batch, error } = await supabase
    .from('batches')
    .select('*')
    .eq('id', batchId)
    .single()

  if (error) throw error
  return batch
}

export async function createBatch() {
  const supabase = createClient()
  
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) throw new Error('Usuario no autenticado')

  const { data: batch, error } = await supabase
    .from('batches')
    .insert({ user_id: user.id })
    .select()
    .single()

  if (error) throw error
  return batch
}

export async function deleteBatch(batchId: string) {
  const supabase = createClient()
  
  const { error } = await supabase
    .from('batches')
    .delete()
    .eq('id', batchId)

  if (error) throw error
}

// =============================================
// Image Queries
// =============================================

export async function getImagesByBatchId(batchId: string) {
  const supabase = createClient()
  
  const { data: images, error } = await supabase
    .from('images')
    .select('*')
    .eq('batch_id', batchId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return images
}

export async function createImage(imageData: ImageInsert) {
  const supabase = createClient()
  
  const { data: image, error } = await supabase
    .from('images')
    .insert(imageData)
    .select()
    .single()

  if (error) throw error
  return image
}

export async function updateImageStatus(imageId: string, status: Image['status'], processedUrl?: string) {
  const supabase = createClient()
  
  const updateData: Partial<Image> = { status }
  if (processedUrl) {
    updateData.processed_url = processedUrl
  }

  const { data: image, error } = await supabase
    .from('images')
    .update(updateData)
    .eq('id', imageId)
    .select()
    .single()

  if (error) throw error
  return image
}

export async function deleteImage(imageId: string) {
  const supabase = createClient()
  
  const { error } = await supabase
    .from('images')
    .delete()
    .eq('id', imageId)

  if (error) throw error
}

// =============================================
// Storage Queries
// =============================================

export async function uploadImage(file: File, batchId: string) {
  const supabase = createClient()
  
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) throw new Error('Usuario no autenticado')

  const fileExt = file.name.split('.').pop()
  const fileName = `${user.id}/${batchId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`

  const { data, error } = await supabase.storage
    .from('images')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false
    })

  if (error) throw error

  // Usar signed URL en lugar de public URL para evitar problemas de permisos
  // La URL es válida por 1 año (31536000 segundos)
  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from('images')
    .createSignedUrl(data.path, 31536000)

  if (signedUrlError || !signedUrlData?.signedUrl) {
    // Fallback a URL pública si falla la firma
    console.warn('Error creando signed URL, usando public URL:', signedUrlError)
    const { data: { publicUrl } } = supabase.storage
      .from('images')
      .getPublicUrl(data.path)
    return publicUrl
  }

  return signedUrlData.signedUrl
}

export async function deleteImageFromStorage(imageUrl: string) {
  const supabase = createClient()
  
  // Extract path from URL
  const url = new URL(imageUrl)
  const pathParts = url.pathname.split('/storage/v1/object/public/images/')
  if (pathParts.length < 2) return

  const filePath = pathParts[1]

  const { error } = await supabase.storage
    .from('images')
    .remove([filePath])

  if (error) throw error
}

// =============================================
// Stats Queries
// =============================================

export async function getDashboardStats() {
  const supabase = createClient()
  
  const { data: batches, error: batchError } = await supabase
    .from('batches')
    .select(`
      id,
      images:images(count)
    `)

  if (batchError) throw batchError

  const { data: processingImages, error: processingError } = await supabase
    .from('images')
    .select('id', { count: 'exact' })
    .in('status', ['pending', 'processing'])

  if (processingError) throw processingError

  const totalBatches = batches.length
  const totalPhotos = batches.reduce((acc, batch) => acc + (batch.images?.[0]?.count || 0), 0)
  const processingCount = processingImages.length

  return {
    totalBatches,
    totalPhotos,
    processingCount
  }
}

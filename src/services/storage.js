import { supabase } from '../lib/supabase'

function dataUrlToBlob(dataUrl) {
  const [header, base64] = dataUrl.split(',')
  const mime = header.match(/:(.*?);/)[1]
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

export async function uploadDataUrl(bucket, path, dataUrl) {
  const blob = dataUrlToBlob(dataUrl)
  const ext = blob.type === 'image/png' ? 'png' : 'jpg'
  // Every replacement gets a new object. Supabase Storage upsert requires
  // additional SELECT permission and fails for our write-only public policy.
  const uniqueSuffix = `${Date.now()}-${crypto.randomUUID()}`
  const filePath = `${path}-${uniqueSuffix}.${ext}`
  const file = new File([blob], filePath, { type: blob.type })

  const { error } = await supabase.storage
    .from(bucket)
    .upload(filePath, file, { upsert: false, contentType: blob.type })

  if (error) throw error

  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath)
  // เพิ่ม cache-bust เพื่อให้ browser โหลดรูปใหม่ทันที (ไม่ติด CDN cache)
  const cacheBust = `?t=${Date.now()}`
  return `${data.publicUrl}${cacheBust}`
}

export function getStoragePath(bucket, publicUrl) {
  if (!publicUrl || typeof publicUrl !== 'string') return null
  const marker = `/storage/v1/object/public/${bucket}/`
  const markerIndex = publicUrl.indexOf(marker)
  if (markerIndex < 0) return null
  return decodeURIComponent(publicUrl.slice(markerIndex + marker.length).split('?')[0]) || null
}

export async function removeStorageObject(bucket, publicUrl) {
  const path = getStoragePath(bucket, publicUrl)
  if (!path) return
  const { error } = await supabase.storage.from(bucket).remove([path])
  if (error) throw error
}

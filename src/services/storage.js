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
  // ใช้ชื่อไฟล์เดียวกันทั้ง upload และ getPublicUrl (มีนามสกุล)
  const filePath = `${path}.${ext}`
  const file = new File([blob], filePath, { type: blob.type })

  const { error } = await supabase.storage
    .from(bucket)
    .upload(filePath, file, { upsert: true, contentType: blob.type })

  if (error) throw error

  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath)
  // เพิ่ม cache-bust เพื่อให้ browser โหลดรูปใหม่ทันที (ไม่ติด CDN cache)
  const cacheBust = `?t=${Date.now()}`
  return `${data.publicUrl}${cacheBust}`
}

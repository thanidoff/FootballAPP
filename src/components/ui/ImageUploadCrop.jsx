import { useState, useCallback, useRef, useEffect } from 'react'
import Cropper from 'react-easy-crop'
import Button from './Button'

async function getCroppedImg(src, pixels, circular = false) {
  const image = await new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })

  const OUT = 512
  const canvas = document.createElement('canvas')
  canvas.width = OUT
  canvas.height = OUT
  const ctx = canvas.getContext('2d')

  if (circular) {
    ctx.beginPath()
    ctx.arc(OUT / 2, OUT / 2, OUT / 2, 0, Math.PI * 2)
    ctx.clip()
  }

  const scaleX = OUT / pixels.width
  const scaleY = OUT / pixels.height
  const srcX = Math.max(0, pixels.x)
  const srcY = Math.max(0, pixels.y)
  const srcRight = Math.min(image.width, pixels.x + pixels.width)
  const srcBottom = Math.min(image.height, pixels.y + pixels.height)

  if (srcRight > srcX && srcBottom > srcY) {
    const srcW = srcRight - srcX
    const srcH = srcBottom - srcY
    const dstX = (srcX - pixels.x) * scaleX
    const dstY = (srcY - pixels.y) * scaleY
    ctx.drawImage(image, srcX, srcY, srcW, srcH, dstX, dstY, srcW * scaleX, srcH * scaleY)
  }

  return canvas.toDataURL('image/png')
}

// FIX BUG-C: เพิ่ม processing state ใน CropModal
function CropModal({ src, aspect, onDone, onCancel }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)
  const [processing, setProcessing] = useState(false)

  const onCropComplete = useCallback((_, pixels) => {
    setCroppedAreaPixels(pixels)
  }, [])

  async function handleConfirm() {
    if (!croppedAreaPixels || processing) return
    setProcessing(true)
    try {
      await onDone(croppedAreaPixels)
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* ไม่ให้ปิด modal ระหว่าง processing */}
      <div className="absolute inset-0 bg-black/70" onClick={processing ? undefined : onCancel} />
      <div className="relative w-full max-w-md bg-white rounded-2xl overflow-hidden shadow-2xl">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-heading font-black text-lg uppercase tracking-wide">Crop Image</h3>
        </div>

        <div className="relative w-full bg-white" style={{ height: 320 }}>
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            cropShape={aspect === 1 ? 'round' : 'rect'}
            showGrid={false}
            restrictPosition={false}
          />
        </div>

        <div className="px-5 py-3 border-b border-gray-100">
          <label className="block text-xs font-heading font-bold tracking-wider uppercase text-gray-400 mb-2">
            Zoom
          </label>
          <input
            type="range"
            min={0.5}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full h-1.5 appearance-none bg-gray-200 rounded-full accent-gray-900 cursor-pointer"
          />
        </div>

        <div className="flex gap-2 px-5 py-4">
          <Button
            variant="secondary"
            className="flex-1 justify-center"
            onClick={onCancel}
            disabled={processing}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 justify-center"
            onClick={handleConfirm}
            disabled={!croppedAreaPixels || processing}
          >
            {/* FIX BUG-C: แสดง "Processing..." แทนปุ่มหายไป */}
            {processing ? 'Processing...' : 'Confirm Crop'}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function ImageUploadCrop({
  value,
  onChange,
  aspect = 1,
  label = 'Photo',
  placeholder,
  shape = 'circle',
}) {
  const [rawSrc, setRawSrc] = useState(null)
  const [cropping, setCropping] = useState(false)
  const [cachedDataUrl, setCachedDataUrl] = useState(null)
  const inputRef = useRef()

  // FIX BUG-B: strip cache-bust query string ก่อนใช้ URL เพื่อ fetch
  useEffect(() => {
    const rawUrl = value?.src ?? value?.preview ?? null
    if (!rawUrl) {
      setCachedDataUrl(null)
      return
    }
    // ถ้าเป็น data: URL (crop ใหม่) ใช้ตรงๆ ไม่ต้อง fetch
    if (rawUrl.startsWith('data:')) {
      setCachedDataUrl(rawUrl)
      return
    }
    // เป็น http URL → fetch แปลงเป็น data URL เพื่อ re-crop ได้
    setCachedDataUrl(null)
    fetch(rawUrl)
      .then(r => r.blob())
      .then(blob => new Promise((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.readAsDataURL(blob)
      }))
      .then(dataUrl => setCachedDataUrl(dataUrl))
      .catch(() => setCachedDataUrl(rawUrl)) // fallback: ใช้ URL ตรงๆ
  }, [value?.src, value?.preview])

  useEffect(() => {
    function handlePaste(e) {
      const item = Array.from(e.clipboardData?.items ?? []).find(i => i.type.startsWith('image/'))
      if (!item) return
      const file = item.getAsFile()
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        setRawSrc(reader.result)
        setCropping(true)
      }
      reader.readAsDataURL(file)
    }
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [])

  function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setRawSrc(reader.result)
      setCropping(true)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  // FIX BUG-C: ปิด modal หลัง getCroppedImg เสร็จ ไม่ใช่ก่อน
  // FIX BUG-B: ส่ง _ts เพื่อให้ parent รู้ว่า value เปลี่ยน → force re-render
  async function handleCropDone(pixels) {
    const preview = await getCroppedImg(rawSrc, pixels, shape === 'circle')
    onChange({ src: rawSrc, pixels, preview, _ts: Date.now() })
    setRawSrc(null)
    setCropping(false) // ปิดหลัง onChange เพื่อให้ preview update ก่อน UI หาย
  }

  function handleRecrop() {
    const src = cachedDataUrl ?? value?.src ?? value?.preview ?? null
    if (!src) return
    setRawSrc(src)
    setCropping(true)
  }

  const previewUrl = value?.preview ?? value?.src ?? null
  const isCircle = shape === 'circle'

  return (
    <>
      <div className="flex flex-col gap-1">
        {label && (
          <label className="text-xs font-heading font-bold tracking-wider uppercase text-gray-500">
            {label}
          </label>
        )}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={previewUrl ? handleRecrop : () => inputRef.current?.click()}
            title={previewUrl ? 'Click to re-crop' : undefined}
            className={`
              group relative flex-shrink-0 bg-white border-2 border-dashed border-gray-300
              hover:border-gray-500 hover:bg-gray-50 transition-colors overflow-hidden
              ${isCircle ? 'w-20 h-20 rounded-full' : 'w-24 h-20 rounded-xl'}
            `}
          >
            {previewUrl ? (
              <>
                {/* FIX BUG-B: key บน img → force reload ทันทีเมื่อ previewUrl เปลี่ยน */}
                <img
                  key={previewUrl}
                  src={previewUrl}
                  alt=""
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-white">
                    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-1">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-gray-400">
                  <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                {placeholder && (
                  <span className="text-xs text-gray-400 font-heading font-bold">{placeholder}</span>
                )}
              </div>
            )}
          </button>
          {previewUrl && (
            <div className="flex flex-col gap-1.5">
              <Button type="button" variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>
                Change
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
                Remove
              </Button>
            </div>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFile}
        />
      </div>

      {cropping && rawSrc && (
        <CropModal
          src={rawSrc}
          aspect={aspect}
          onDone={handleCropDone}
          onCancel={() => { setCropping(false); setRawSrc(null) }}
        />
      )}
    </>
  )
}

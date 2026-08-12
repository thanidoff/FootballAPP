import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../lib/supabase', () => ({
  supabase: {
    storage: {
      from: vi.fn(),
    },
  },
}))

import { supabase } from '../lib/supabase'
import { getStoragePath, uploadDataUrl } from '../services/storage'

const SAMPLE_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

describe('uploadDataUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uploads using a filename with an extension and returns a cache-busted URL', async () => {
    const upload = vi.fn().mockResolvedValue({ error: null })
    const getPublicUrl = vi.fn().mockReturnValue({
      data: { publicUrl: 'https://example.supabase.co/storage/v1/object/public/player-photos/player-abc.png' },
    })
    supabase.storage.from.mockReturnValue({ upload, getPublicUrl })

    const result = await uploadDataUrl('player-photos', 'player-abc', SAMPLE_PNG_DATA_URL)

    const uploadedPath = upload.mock.calls[0][0]
    expect(uploadedPath).toMatch(/^player-abc-\d+-[\w-]+\.png$/)
    expect(upload).toHaveBeenCalledWith(
      uploadedPath,
      expect.any(File),
      expect.objectContaining({ upsert: false, contentType: 'image/png' }),
    )
    expect(getPublicUrl).toHaveBeenCalledWith(uploadedPath)
    expect(result).toMatch(/\?t=\d+$/)
  })

  it('throws when upload fails', async () => {
    supabase.storage.from.mockReturnValue({
      upload: vi.fn().mockResolvedValue({ error: new Error('Upload failed') }),
      getPublicUrl: vi.fn(),
    })

    await expect(uploadDataUrl('player-photos', 'bad', SAMPLE_PNG_DATA_URL)).rejects.toThrow('Upload failed')
  })

  it('detects the jpeg extension', async () => {
    const upload = vi.fn().mockResolvedValue({ error: null })
    supabase.storage.from.mockReturnValue({
      upload,
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/photo.jpg' } }),
    })

    await uploadDataUrl('player-photos', 'player-jpeg', SAMPLE_PNG_DATA_URL.replace('image/png', 'image/jpeg'))

    expect(upload.mock.calls[0][0]).toMatch(/^player-jpeg-\d+-[\w-]+\.jpg$/)
  })

  it('adds a cache-busting timestamp to every public URL', async () => {
    supabase.storage.from.mockReturnValue({
      upload: vi.fn().mockResolvedValue({ error: null }),
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/photo.png' } }),
    })

    const result = await uploadDataUrl('player-photos', 'player-cache', SAMPLE_PNG_DATA_URL)

    expect(result).toMatch(/\?t=\d+$/)
  })
})

describe('getStoragePath', () => {
  it('extracts and decodes a public storage object path', () => {
    expect(getStoragePath(
      'coach-photos',
      'https://example.supabase.co/storage/v1/object/public/coach-photos/folder/coach%201.png?t=123',
    )).toBe('folder/coach 1.png')
  })

  it('ignores URLs outside the requested bucket', () => {
    expect(getStoragePath('coach-photos', 'https://example.com/image.png')).toBeNull()
  })
})

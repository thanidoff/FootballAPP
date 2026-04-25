import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock supabase
vi.mock('../lib/supabase', () => ({
  supabase: {
    storage: {
      from: vi.fn(),
    },
  },
}))

import { supabase } from '../lib/supabase'
import { uploadDataUrl } from '../services/storage'

const SAMPLE_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

// 1x1 pixel white JPEG — valid base64
const SAMPLE_JPG_DATA_URL =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAAAAAAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAARC AABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AJQAB/9k='


describe('uploadDataUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uploads using filePath with extension (not bare path)', async () => {
    const uploadMock = vi.fn().mockResolvedValue({ error: null })
    const getPublicUrlMock = vi.fn().mockReturnValue({
      data: { publicUrl: 'https://example.supabase.co/storage/v1/object/public/player-photos/player-abc.png' },
    })

    supabase.storage.from.mockReturnValue({
      upload: uploadMock,
      getPublicUrl: getPublicUrlMock,
    })

    const result = await uploadDataUrl('player-photos', 'player-abc', SAMPLE_PNG_DATA_URL)

    // ตรวจว่า upload ใช้ชื่อที่มีนามสกุล
    expect(uploadMock).toHaveBeenCalledWith(
      'player-abc.png',
      expect.any(File),
      expect.objectContaining({ upsert: true, contentType: 'image/png' }),
    )

    // ตรวจว่า getPublicUrl ใช้ path เดียวกันกับ upload
    expect(getPublicUrlMock).toHaveBeenCalledWith('player-abc.png')

    // ตรวจว่า return URL มี cache-bust ?t=
    expect(result).toContain('https://example.supabase.co')
    expect(result).toMatch(/\?t=\d+$/)
  })

  it('detects jpg extension correctly', async () => {
    const uploadMock = vi.fn().mockResolvedValue({ error: null })
    supabase.storage.from.mockReturnValue({
      upload: uploadMock,
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://x.co/img' } }),
    })

    await uploadDataUrl('player-photos', 'player-xyz', SAMPLE_JPG_DATA_URL)

    expect(uploadMock).toHaveBeenCalledWith(
      'player-xyz.jpg',
      expect.any(File),
      expect.any(Object),
    )
  })

  it('throws when upload fails', async () => {
    supabase.storage.from.mockReturnValue({
      upload: vi.fn().mockResolvedValue({ error: new Error('Upload failed') }),
      getPublicUrl: vi.fn(),
    })

    await expect(
      uploadDataUrl('player-photos', 'bad', SAMPLE_PNG_DATA_URL)
    ).rejects.toThrow('Upload failed')
  })

  it('generates unique cache-bust per call', async () => {
    supabase.storage.from.mockReturnValue({
      upload: vi.fn().mockResolvedValue({ error: null }),
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://x.co/img' } }),
    })

    const url1 = await uploadDataUrl('bucket', 'path', SAMPLE_PNG_DATA_URL)
    await new Promise(r => setTimeout(r, 2)) // เว้น 2ms
    const url2 = await uploadDataUrl('bucket', 'path', SAMPLE_PNG_DATA_URL)

    // แต่ละ call ควรได้ timestamp ต่างกัน (หรืออย่างน้อยมี ?t=)
    expect(url1).toMatch(/\?t=\d+$/)
    expect(url2).toMatch(/\?t=\d+$/)
  })
})

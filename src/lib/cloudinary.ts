export interface UploadOptions {
  /** 'raw' dipakai untuk file terenkripsi (ciphertext biner). */
  resourceType?: 'auto' | 'raw' | 'image' | 'video'
  onProgress?: (percent: number) => void
  signal?: AbortSignal
}

/** Upload ke Cloudinary (unsigned preset) dengan progress. Melempar Error bila gagal. */
export function uploadToCloudinary(file: Blob, opts: UploadOptions = {}): Promise<string> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET

  return new Promise((resolve, reject) => {
    if (!cloudName || !uploadPreset) {
      reject(new Error('Konfigurasi Cloudinary belum diisi (.env).'))
      return
    }

    const xhr = new XMLHttpRequest()
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/${opts.resourceType ?? 'auto'}/upload`)

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) opts.onProgress?.(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText)
        if (data.secure_url) resolve(data.secure_url as string)
        else reject(new Error(data.error?.message ?? 'Upload gagal.'))
      } catch {
        reject(new Error('Respons upload tidak valid.'))
      }
    }
    xhr.onerror = () => reject(new Error('Koneksi terputus saat mengunggah.'))
    xhr.onabort = () => reject(new Error('Upload dibatalkan.'))
    opts.signal?.addEventListener('abort', () => xhr.abort())

    const form = new FormData()
    form.append('file', file, file instanceof File ? file.name : 'upload.bin')
    form.append('upload_preset', uploadPreset)
    xhr.send(form)
  })
}

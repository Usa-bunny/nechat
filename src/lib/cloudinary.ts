export async function uploadToCloudinary(file: File): Promise<string | null> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!;

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);

  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, // 'auto' mendeteksi image/video/raw
      {
        method: 'POST',
        body: formData,
      }
    );

    const data = await response.json();
    
    if (data.secure_url) {
      return data.secure_url; // Ini URL publik dari Cloudinary
    }
    return null;
  } catch (error) {
    console.error('Gagal upload ke Cloudinary:', error);
    return null;
  }
}
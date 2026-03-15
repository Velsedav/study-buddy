async function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function fileToCompressedDataUrl(
  file: File,
  options?: { maxSide?: number; type?: string; quality?: number }
): Promise<string> {
  if (!file.type.startsWith("image/")) {
    return fileToDataUrl(file);
  }

  const maxSide = options?.maxSide ?? 800;
  const type = options?.type ?? "image/webp";
  const quality = options?.quality ?? 0.65;

  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;

    const scale = Math.min(1, maxSide / Math.max(width, height));
    const w = Math.round(width * scale);
    const h = Math.round(height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();

    const blob = await canvasToBlob(canvas, type, quality);
    if (blob) return blobToDataUrl(blob);

    // fallback to JPEG
    const jpegBlob = await canvasToBlob(canvas, "image/jpeg", Math.min(quality + 0.2, 0.85));
    if (jpegBlob) return blobToDataUrl(jpegBlob);
  } catch {
    // ignore and fall through
  }

  return fileToDataUrl(file);
}

/** 上传目标上限（与 API upload_max_bytes 一致） */
export const UPLOAD_MAX_BYTES = 2 * 1024 * 1024;

/** 选图上限：超过则直接拒绝，避免浏览器内存爆掉 */
const PICKER_MAX_BYTES = 25 * 1024 * 1024;

const MAX_EDGE_START = 2048;
const MIN_EDGE = 640;

const JPEG_TYPE = "image/jpeg";
const WEBP_TYPE = "image/webp";

export type CompressImageResult = {
  file: File;
  compressed: boolean;
  originalSize: number;
  finalSize: number;
};

function outputMime(): string {
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    if (canvas.toDataURL(WEBP_TYPE).startsWith("data:image/webp")) {
      return WEBP_TYPE;
    }
  }
  return JPEG_TYPE;
}

function extForMime(mime: string): string {
  return mime === WEBP_TYPE ? ".webp" : ".jpg";
}

function renameWithExt(name: string, ext: string): string {
  const base = name.replace(/\.[^.]+$/, "") || "image";
  return `${base}${ext}`;
}

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("无法读取图片，请换一张或改用 JPG/PNG"));
    };
    img.src = url;
  });
}

function scaledSize(width: number, height: number, maxEdge: number) {
  if (width <= maxEdge && height <= maxEdge) {
    return { width, height };
  }
  const ratio = Math.min(maxEdge / width, maxEdge / height);
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

async function rasterizeToBlob(
  img: HTMLImageElement,
  maxEdge: number,
  mime: string,
  quality: number,
): Promise<Blob | null> {
  const { width, height } = scaledSize(img.naturalWidth, img.naturalHeight, maxEdge);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, width, height);
  return canvasToBlob(canvas, mime, quality);
}

async function encodeUnderLimit(
  img: HTMLImageElement,
  mime: string,
  maxBytes: number,
): Promise<Blob> {
  let maxEdge = MAX_EDGE_START;

  while (maxEdge >= MIN_EDGE) {
    const qualities = [0.92, 0.85, 0.78, 0.7, 0.62, 0.55, 0.48, 0.4];
    for (const q of qualities) {
      const blob = await rasterizeToBlob(img, maxEdge, mime, q);
      if (blob && blob.size <= maxBytes) {
        return blob;
      }
    }
    maxEdge = Math.round(maxEdge * 0.75);
  }

  const last = await rasterizeToBlob(img, MIN_EDGE, mime, 0.4);
  if (last && last.size <= maxBytes) {
    return last;
  }

  throw new Error("图片过大，压缩后仍超过 2MB，请换一张更小的照片");
}

/**
 * 将用户选择的图片压缩到可上传大小（≤2MB）。
 * 已满足大小的静态图也会按需缩小过长边，减轻流量。
 */
export async function compressImageForUpload(file: File): Promise<CompressImageResult> {
  if (!file.type.startsWith("image/")) {
    throw new Error("请选择图片文件");
  }
  if (file.size > PICKER_MAX_BYTES) {
    throw new Error("图片不能超过 25MB，请先裁剪或换一张");
  }

  const originalSize = file.size;

  // 小 GIF 原样上传以保留动图
  if (file.type === "image/gif" && file.size <= UPLOAD_MAX_BYTES) {
    return { file, compressed: false, originalSize, finalSize: file.size };
  }

  const mime = outputMime();
  const alreadySmall =
    file.size <= UPLOAD_MAX_BYTES &&
    (file.type === JPEG_TYPE || file.type === WEBP_TYPE || file.type === "image/jpg");

  if (alreadySmall) {
    return { file, compressed: false, originalSize, finalSize: file.size };
  }

  const img = await loadImageElement(file);
  const blob = await encodeUnderLimit(img, mime, UPLOAD_MAX_BYTES);
  const outName = renameWithExt(file.name, extForMime(mime));
  const outFile = new File([blob], outName, { type: mime, lastModified: Date.now() });

  return {
    file: outFile,
    compressed: true,
    originalSize,
    finalSize: outFile.size,
  };
}

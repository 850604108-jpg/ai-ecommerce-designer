import JSZip from "jszip";

export const imageDownloadFormats = ["original", "png", "jpeg", "webp"] as const;

export type ImageDownloadFormat = (typeof imageDownloadFormats)[number];

export type DownloadableImage = {
  fileName: string;
  url: string;
};

const formatExtensions: Record<Exclude<ImageDownloadFormat, "original">, string> = {
  jpeg: "jpg",
  png: "png",
  webp: "webp",
};

const formatMimeTypes: Record<Exclude<ImageDownloadFormat, "original">, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

function sanitizeFileName(value: string) {
  return (
    value
      .trim()
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 90) || "image"
  );
}

function getOriginalExtension(url: string, fallback = "webp") {
  try {
    const pathname = new URL(url).pathname;
    const extension = pathname.split(".").pop()?.toLowerCase();

    if (extension && ["jpg", "jpeg", "png", "webp", "gif"].includes(extension)) {
      return extension === "jpeg" ? "jpg" : extension;
    }
  } catch {
    // Keep fallback when URL parsing fails.
  }

  return fallback;
}

function getDownloadFileName(input: {
  fileName: string;
  format: ImageDownloadFormat;
  url: string;
}) {
  const cleanName = sanitizeFileName(input.fileName).replace(/\.[a-z0-9]+$/i, "");
  const extension =
    input.format === "original"
      ? getOriginalExtension(input.url)
      : formatExtensions[input.format];

  return `${cleanName}.${extension}`;
}

async function fetchImageBlob(url: string) {
  const response = await fetch(url, { mode: "cors" });

  if (!response.ok) {
    throw new Error("Failed to download image.");
  }

  return response.blob();
}

async function convertImageBlob(
  blob: Blob,
  format: Exclude<ImageDownloadFormat, "original">,
) {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");

  canvas.width = bitmap.width;
  canvas.height = bitmap.height;

  const context = canvas.getContext("2d");

  if (!context) {
    bitmap.close();
    throw new Error("Canvas is not available.");
  }

  context.drawImage(bitmap, 0, 0);
  bitmap.close();

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (convertedBlob) => {
        if (!convertedBlob) {
          reject(new Error("Image conversion failed."));
          return;
        }

        resolve(convertedBlob);
      },
      formatMimeTypes[format],
      format === "jpeg" || format === "webp" ? 0.92 : undefined,
    );
  });
}

async function getDownloadBlob(
  image: DownloadableImage,
  format: ImageDownloadFormat,
) {
  const originalBlob = await fetchImageBlob(image.url);

  if (format === "original") {
    return originalBlob;
  }

  return convertImageBlob(originalBlob, format);
}

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export async function downloadImageAsset(
  image: DownloadableImage,
  format: ImageDownloadFormat,
) {
  const blob = await getDownloadBlob(image, format);
  triggerDownload(
    blob,
    getDownloadFileName({
      fileName: image.fileName,
      format,
      url: image.url,
    }),
  );
}

export async function downloadImageBatch(input: {
  archiveName: string;
  format: ImageDownloadFormat;
  images: DownloadableImage[];
}) {
  const zip = new JSZip();

  await Promise.all(
    input.images.map(async (image, index) => {
      const blob = await getDownloadBlob(image, input.format);
      const fileName = getDownloadFileName({
        fileName: `${String(index + 1).padStart(2, "0")}-${image.fileName}`,
        format: input.format,
        url: image.url,
      });

      zip.file(fileName, blob);
    }),
  );

  const archive = await zip.generateAsync({ type: "blob" });
  triggerDownload(archive, `${sanitizeFileName(input.archiveName)}.zip`);
}

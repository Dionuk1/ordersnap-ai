import { createWorker } from "tesseract.js";

/**
 * Run OCR on a screenshot (client-side, no API key needed).
 * Uses tesseract.js with English + Albanian-ish latin recognition (eng covers
 * Albanian latin characters well enough for chat text).
 */
export async function runOcr(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<string> {
  const worker = await createWorker("eng", 1, {
    logger: (m) => {
      if (m.status === "recognizing text" && onProgress) {
        onProgress(Math.round((m.progress ?? 0) * 100));
      }
    },
  });
  try {
    const { data } = await worker.recognize(file);
    return data.text ?? "";
  } finally {
    await worker.terminate();
  }
}

/** Convert a File/Blob to a base64 string (without the data: prefix). */
export function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(new Error("Leximi i skedarit dështoi"));
    reader.readAsDataURL(file);
  });
}

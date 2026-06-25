// Batch processing logic — runs in main thread but processes sequentially
// Uses OffscreenCanvas where available for better performance

import type { CRTParams } from "@/hooks/useCRTRenderer";

export interface BatchJob {
  file: File;
  status: "queued" | "processing" | "done" | "error";
  result?: Blob;
  error?: string;
}

export async function processBatchImages(
  files: File[],
  params: CRTParams,
  renderer: any,
  onProgress: (completed: number, total: number, jobs: BatchJob[]) => void,
): Promise<BatchJob[]> {
  const jobs: BatchJob[] = files.map(f => ({ file: f, status: "queued" as const }));
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  for (let i = 0; i < jobs.length; i++) {
    jobs[i].status = "processing";
    onProgress(i, files.length, [...jobs]);

    try {
      const img = new Image();
      const url = URL.createObjectURL(jobs[i].file);
      img.src = url;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Failed to load"));
      });

      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;

      // Render through CRT pipeline
      renderer.setImage(img, 1);
      renderer.render(ctx, canvas.width, canvas.height, 0, params, 0, 30, {});

      // Convert to blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          b => b ? resolve(b) : reject(new Error("Canvas toBlob failed")),
          "image/png"
        );
      });

      jobs[i].status = "done";
      jobs[i].result = blob;
      URL.revokeObjectURL(url);
    } catch (err: any) {
      jobs[i].status = "error";
      jobs[i].error = err?.message || "Unknown error";
    }

    onProgress(i + 1, files.length, [...jobs]);
  }

  return jobs;
}

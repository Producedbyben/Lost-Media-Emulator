import { useState, useCallback, useRef } from "react";
import { Layers, Download, Loader2, X, Archive, CheckCircle2, AlertCircle } from "lucide-react";
import { processBatchImages, BatchJob } from "@/lib/batch-worker";
import type { CRTParams } from "@/hooks/useCRTRenderer";

interface BatchProcessorProps {
  hasImage: boolean;
  currentParams: CRTParams;
  getRenderer: () => any;
}

const BatchProcessor = ({ hasImage, currentParams, getRenderer }: BatchProcessorProps) => {
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [jobs, setJobs] = useState<BatchJob[]>([]);
  const [completed, setCompleted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback((fileList: FileList | null) => {
    if (!fileList) return;
    const images = Array.from(fileList).filter(f => f.type.startsWith("image/"));
    setFiles(prev => [...prev, ...images].slice(0, 50));
    setCompleted(false);
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleProcess = useCallback(async () => {
    if (files.length === 0) return;
    setProcessing(true);
    setProgress(0);
    setTotal(files.length);
    setCompleted(false);

    const renderer = getRenderer();
    if (!renderer) {
      setProcessing(false);
      return;
    }

    const results = await processBatchImages(
      files,
      currentParams,
      renderer,
      (done, tot, currentJobs) => {
        setProgress(done);
        setTotal(tot);
        setJobs(currentJobs);
      }
    );

    setJobs(results);
    setProcessing(false);
    setCompleted(true);
  }, [files, currentParams, getRenderer]);

  const handleDownloadZip = useCallback(async () => {
    const completedJobs = jobs.filter(j => j.status === "done" && j.result);
    if (completedJobs.length === 0) return;

    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();

    completedJobs.forEach((job, i) => {
      const name = job.file.name.replace(/\.[^.]+$/, "") + "_processed.png";
      zip.file(name, job.result!);
    });

    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `batch-export-${Date.now()}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  }, [jobs]);

  const doneCount = jobs.filter(j => j.status === "done").length;
  const errorCount = jobs.filter(j => j.status === "error").length;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Layers className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-foreground">Batch Processing</span>
      </div>
      <p className="text-[12px] text-muted-foreground">Apply current look to multiple images. Exports as ZIP.</p>

      <div
        className="border-2 border-dashed border-border rounded-lg p-3 text-center cursor-pointer hover:border-primary/40 transition-colors"
        onClick={() => inputRef.current?.click()}
        onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
        onDragOver={(e) => e.preventDefault()}
      >
        <input ref={inputRef} type="file" multiple accept="image/*" className="hidden"
          onChange={(e) => handleFiles(e.target.files)} />
        <p className="text-xs text-muted-foreground">
          {files.length > 0 ? `${files.length} image${files.length > 1 ? "s" : ""} queued` : "Drop images or click to add (max 50)"}
        </p>
      </div>

      {files.length > 0 && !processing && (
        <div className="max-h-24 overflow-y-auto space-y-0.5">
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-2 px-2 py-1 text-[12px] bg-secondary rounded">
              <span className="flex-1 truncate text-secondary-foreground">{f.name}</span>
              <span className="text-muted-foreground">{(f.size / 1024).toFixed(0)}KB</span>
              <button onClick={() => removeFile(i)} className="hover:text-destructive transition-colors">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {processing && (
        <div className="space-y-1">
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${total > 0 ? (progress / total) * 100 : 0}%` }} />
          </div>
          <p className="text-[12px] text-muted-foreground text-center">
            Processing {progress}/{total}…
          </p>
        </div>
      )}

      {completed && (
        <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <CheckCircle2 className="w-3.5 h-3.5 text-primary" /> {doneCount} processed
          {errorCount > 0 && <><AlertCircle className="w-3.5 h-3.5 text-destructive ml-2" /> {errorCount} failed</>}
        </div>
      )}

      <div className="flex gap-2">
        {!completed ? (
          <button
            onClick={handleProcess}
            disabled={files.length === 0 || processing}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-40 transition-colors"
          >
            {processing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            {processing ? "Processing…" : "Process all"}
          </button>
        ) : (
          <button
            onClick={handleDownloadZip}
            disabled={doneCount === 0}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-40 transition-colors"
          >
            <Archive className="w-3.5 h-3.5" /> Download ZIP ({doneCount} files)
          </button>
        )}
        {files.length > 0 && !processing && (
          <button onClick={() => { setFiles([]); setJobs([]); setCompleted(false); }}
            className="px-3 py-1.5 text-xs font-medium bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 border border-border">
            Clear
          </button>
        )}
      </div>
    </div>
  );
};

export default BatchProcessor;

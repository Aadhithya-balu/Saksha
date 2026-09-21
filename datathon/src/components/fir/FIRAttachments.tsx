import React, { useState, useRef } from "react";
import {
  type FIRDetailRecord,
  type FIRAttachmentRecord,
  uploadFIRAttachment,
  deleteFIRAttachment,
  downloadFIRAttachment,
} from "../../services/api";
import { FileText, UploadCloud, Trash2, ShieldAlert, Download } from "lucide-react";
import { useAuthStore } from "../../store/authStore";
import { useAuditStore } from "../../store/auditStore";
interface FIRAttachmentsProps {
  fir: FIRDetailRecord;
  onAttachmentAdded: (updatedAttachments: FIRAttachmentRecord[]) => void;
}

export const FIRAttachments: React.FC<FIRAttachmentsProps> = ({
  fir,
  onAttachmentAdded,
}) => {
  const { user } = useAuthStore();
  const { addLog } = useAuditStore();
  const [attachments, setAttachments] = useState<FIRAttachmentRecord[]>(
    (fir.attachments as FIRAttachmentRecord[]) || [],
  );
  const [uploadingFile, setUploadingFile] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatSize = (bytes: number) => {
    if (!bytes) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      void handleUpload(e.target.files[0]);
    }
  };

  const handleUpload = async (file: File) => {
    setError(null);
    setUploadingFile(file.name);
    try {
      const updated = await uploadFIRAttachment(fir.id, file);
      setAttachments(updated);
      onAttachmentAdded(updated);

      if (user) {
        addLog(
          user.name,
          user.badgeId,
          "UPLOAD",
          `Uploaded document [${file.name}] to FIR [${fir.fir_number}]`,
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      setUploadingFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDelete = async (attachment: FIRAttachmentRecord) => {
    if (!window.confirm(`Are you sure you want to remove ${attachment.name}?`)) {
      return;
    }
    setError(null);
    try {
      const updated = await deleteFIRAttachment(fir.id, attachment.id);
      setAttachments(updated);
      onAttachmentAdded(updated);

      if (user) {
        addLog(
          user.name,
          user.badgeId,
          "DELETE",
          `Removed document [${attachment.name}] from FIR [${fir.fir_number}]`,
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove attachment.");
    }
  };

  const handleDownload = async (attachment: FIRAttachmentRecord) => {
    if (!attachment.has_file) {
      setError("This attachment record has no stored file.");
      return;
    }
    setError(null);
    try {
      await downloadFIRAttachment(fir.id, attachment.id, attachment.name);
      if (user) {
        addLog(
          user.name,
          user.badgeId,
          "DOWNLOAD",
          `Downloaded document [${attachment.name}] from FIR [${fir.fir_number}]`,
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed.");
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const onDragLeave = () => {
    setIsDragOver(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      void handleUpload(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="bg-[var(--bg-tertiary)]/30 border border-border-color p-5 rounded-card flex flex-col justify-between overflow-hidden">
      <div className="flex items-center gap-2 border-b border-[var(--border-primary)] pb-3 mb-4">
        <UploadCloud className="w-4 h-4 text-[var(--accent-teal)]" />
        <span className="text-[10px] font-bold text-[var(--text-primary)] uppercase tracking-wider">
          FIR Attachments
        </span>
      </div>

      <div className="space-y-4 text-xs font-mono">
        {/* Drop zone */}
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-5 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all duration-200 ${
            isDragOver
              ? "border-[var(--accent-teal)] bg-[var(--accent-teal)]/10"
              : "border-[var(--border-primary)] hover:border-[var(--border-secondary)] bg-[var(--bg-secondary)]/40 hover:bg-[var(--bg-secondary)]/75"
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
          />

          {uploadingFile ? (
            <div className="w-full text-center space-y-2">
              <p className="text-[9.5px] uppercase text-[var(--text-primary)] truncate">
                Uploading: {uploadingFile}
              </p>
              <div className="w-full h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden border border-[var(--border-primary)]">
                <div className="h-full w-1/2 bg-emerald-500 rounded-full animate-pulse" />
              </div>
              <span className="text-[8px] text-[var(--text-muted)]">
                Sending file to secure storage…
              </span>
            </div>
          ) : (
            <>
              <UploadCloud className="w-8 h-8 text-[var(--text-muted)]" />
              <span className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] text-center">
                Drag investigative reports or click to browse
              </span>
              <span className="text-[7.5px] text-[var(--text-muted)] uppercase">
                PDF, JPG, PNG · max 50 MB
              </span>
            </>
          )}
        </div>

        {error && (
          <div className="flex items-start gap-2 p-2 rounded border border-red-500/30 bg-red-500/10 text-red-400 text-[9px]">
            <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Attachments List */}
        <div className="space-y-2 max-h-[180px] overflow-y-auto custom-scrollbar pr-1">
          {attachments.map((file) => (
            <div
              key={file.id}
              className="flex items-center justify-between p-2.5 bg-[var(--bg-secondary)]/60 border border-[var(--border-primary)] rounded-md transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <FileText className="w-4 h-4 text-[var(--text-secondary)] shrink-0" />
                <div className="truncate">
                  <p className="text-[10px] text-[var(--text-primary)] font-medium truncate select-all">
                    {file.name}
                  </p>
                  <p className="text-[8px] text-[var(--text-muted)] mt-0.5">
                    {formatSize(file.size)}
                    {file.uploaded_by ? ` · ${file.uploaded_by}` : ""}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => handleDownload(file)}
                  disabled={!file.has_file}
                  title={file.has_file ? "Download file" : "No stored file for this record"}
                  className="p-1 text-[var(--text-muted)] hover:text-[var(--accent-blue)] hover:bg-[var(--bg-tertiary)] rounded cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(file)}
                  className="p-1 text-[var(--text-muted)] hover:text-red-400 hover:bg-[var(--bg-tertiary)] rounded cursor-pointer transition-colors"
                  title="Remove Document"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}

          {attachments.length === 0 && !uploadingFile && (
            <div className="flex flex-col items-center justify-center p-6 border border-dashed border-[var(--border-primary)] rounded-lg text-[var(--text-muted)] text-center gap-1">
              <ShieldAlert className="w-4 h-4 text-amber-500/60" />
              <span className="text-[9px] uppercase tracking-wide">
                No documents attached
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default FIRAttachments;

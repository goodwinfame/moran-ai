"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

interface FileUploadDialogProps {
  open: boolean;
  onClose: () => void;
  onUpload: (file: File) => void;
}

export function FileUploadDialog({ open, onClose, onUpload }: FileUploadDialogProps) {
  const [dragActive, setDragActive] = React.useState(false);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const acceptedFormats = [".txt", ".md", ".docx", ".pdf"];
  const maxSize = 10 * 1024 * 1024; // 10MB

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const validateFile = (file: File): boolean => {
    setError(null);
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!acceptedFormats.includes(ext)) {
      setError(`不支持的文件格式：${ext}。请上传 .txt, .md, .docx 或 .pdf 文件。`);
      return false;
    }
    if (file.size > maxSize) {
      setError("文件大小超出限制（最大 10MB）。");
      return false;
    }
    return true;
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (validateFile(file)) {
        setSelectedFile(file);
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (validateFile(file)) {
        setSelectedFile(file);
      }
    }
  };

  const handleUploadClick = () => {
    if (selectedFile) {
      onUpload(selectedFile);
      setSelectedFile(null);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>上传参考资料</DialogTitle>
          <DialogDescription>
            支持上传 .txt, .md, .docx, .pdf 格式的文件，大小不超过 10MB。
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          <div
            className={`border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center transition-colors cursor-pointer
              ${dragActive ? "border-primary bg-primary/10" : "border-muted-foreground/30 hover:bg-secondary/50"}
              ${selectedFile ? "bg-secondary/20 border-primary/50" : ""}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".txt,.md,.docx,.pdf"
              onChange={handleChange}
            />
            <Icon 
              name={selectedFile ? "description" : "upload_file"} 
              size={48} 
              filled 
              className={selectedFile ? "text-primary" : "text-muted-foreground"}
            />
            <div className="mt-4 text-center">
              {selectedFile ? (
                <div>
                  <p className="font-medium text-sm text-foreground">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-sm font-medium">点击选择文件，或将文件拖拽到此处</p>
                  <p className="text-xs text-muted-foreground">支持 TXT, MD, DOCX, PDF</p>
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md flex items-start gap-2">
              <Icon name="error" size={18} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => {
            setSelectedFile(null);
            setError(null);
            onClose();
          }}>
            取消
          </Button>
          <Button onClick={handleUploadClick} disabled={!selectedFile}>
            确认上传
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

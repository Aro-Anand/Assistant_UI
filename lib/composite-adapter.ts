import { CompositeAttachmentAdapter } from "@assistant-ui/react";
import { PDFAttachmentAdapter } from "./pdf-adapter";

// Create adapter that supports PDFs and other file types
export const createAttachmentAdapter = () => {
  return new CompositeAttachmentAdapter([
    new PDFAttachmentAdapter(),
    // Add more adapters here if needed (images, text files, etc.)
  ]);
};
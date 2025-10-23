import { CompositeAttachmentAdapter } from "@assistant-ui/react";
import { PDFAttachmentAdapter } from "./pdf-adapter";

export function createAttachmentAdapter() {
  return new CompositeAttachmentAdapter([
    new PDFAttachmentAdapter(),
    // The default adapters from useChatRuntime will be added automatically
  ]);
}
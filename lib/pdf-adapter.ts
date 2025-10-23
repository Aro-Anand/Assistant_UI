import {
  AttachmentAdapter,
  PendingAttachment,
  CompleteAttachment,
} from "@assistant-ui/react";

export class PDFAttachmentAdapter implements AttachmentAdapter {
  accept = "application/pdf";

  async add({ file }: { file: File }): Promise<PendingAttachment> {
    // Validate file size (20MB limit)
    const maxSize = 20 * 1024 * 1024;
    if (file.size > maxSize) {
      return {
        id: crypto.randomUUID(),
        type: "document",
        name: file.name,
        file,
        status: {
          type: "incomplete",
          reason: "error",
          error: new Error("PDF size exceeds 20MB limit"),
        },
      };
    }

    return {
      id: crypto.randomUUID(),
      type: "document",
      name: file.name,
      file,
      status: { type: "running" },
    };
  }

  async send(attachment: PendingAttachment): Promise<CompleteAttachment> {
    try {
      // Convert PDF to base64
      const base64Data = await this.fileToBase64(attachment.file);

      return {
        id: attachment.id,
        type: "document",
        name: attachment.name,
        content: [
          {
            type: "file",
            data: `data:application/pdf;base64,${base64Data}`,
            mimeType: "application/pdf",
          },
        ],
        status: { type: "complete" },
      };
    } catch (error) {
      throw new Error(
        `Failed to process PDF: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  async remove(attachment: PendingAttachment): Promise<void> {
    // Cleanup if needed
  }

  private async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
}
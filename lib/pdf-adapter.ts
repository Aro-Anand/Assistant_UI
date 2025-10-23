import {
  AttachmentAdapter,
  PendingAttachment,
  CompleteAttachment,
} from "@assistant-ui/react";
import { OPENWEBUI_CONFIG, OPENWEBUI_ENDPOINTS } from './openwebui-config';

export class PDFAttachmentAdapter implements AttachmentAdapter {
  accept = "application/pdf,.pdf,.doc,.docx,.txt,.tex";

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
          error: new Error("File size exceeds 20MB limit"),
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
      // Upload to OpenWebUI
      const formData = new FormData();
      formData.append('file', attachment.file);

      const response = await fetch(
        `${OPENWEBUI_CONFIG.baseUrl}${OPENWEBUI_ENDPOINTS.uploadFile}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENWEBUI_CONFIG.apiKey}`,
            'Accept': 'application/json',
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`File upload failed: ${error}`);
      }

      const result = await response.json();
      const fileId = result.id;

      console.log('File uploaded to OpenWebUI:', fileId);

      return {
        id: fileId, // Use OpenWebUI's file ID
        type: "document",
        name: attachment.name,
        content: [
          {
            type: "file",
            data: fileId, // Store OpenWebUI file ID
            mimeType: attachment.file.type,
          },
        ],
        status: { type: "complete" },
      };
    } catch (error) {
      throw new Error(
        `Failed to upload file to OpenWebUI: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  async remove(attachment: PendingAttachment): Promise<void> {
    // Optionally delete from OpenWebUI
    try {
      if (attachment.id) {
        await fetch(
          `${OPENWEBUI_CONFIG.baseUrl}${OPENWEBUI_ENDPOINTS.files}/${attachment.id}`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${OPENWEBUI_CONFIG.apiKey}`,
            },
          }
        );
      }
    } catch (error) {
      console.error('Failed to delete file from OpenWebUI:', error);
    }
  }
}
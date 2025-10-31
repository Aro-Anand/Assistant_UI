import {
  AttachmentAdapter,
  PendingAttachment,
  CompleteAttachment,
  FileMessagePart,
} from "@assistant-ui/react";

// Extend the FileMessagePart type to include URL
type ExtendedFileMessagePart = FileMessagePart & {
  url?: string;
  mediaType?: string;
  filename?: string;
};
import { OPENWEBUI_CONFIG, OPENWEBUI_ENDPOINTS } from './openwebui-config';

export class PDFAttachmentAdapter implements AttachmentAdapter {
  accept = ".pdf, .doc, .docx, .txt, .tex, application/pdf, application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document, text/plain";

  private async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          // Remove the data URL prefix
          const base64 = reader.result.split(',')[1];
          resolve(base64);
        } else {
          reject(new Error('Failed to read file as base64'));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async add({ file }: { file: File }): Promise<PendingAttachment> {
    // Validate file size (20MB limit)
    const maxSize = 20 * 1024 * 1024;
    if (file.size > maxSize) {
      return {
        id: crypto.randomUUID(),
        type: "document",
        contentType: "application/pdf",
        name: file.name,
        file,
        status: {
          type: "incomplete",
          reason: "error"
        },
      };
    }

    return {
      id: crypto.randomUUID(),
      type: "document",
      contentType: "application/pdf",
      name: file.name,
      file,
      status: { 
        type: "running",
        reason: "uploading",
        progress: 0
      },
    };
  }

  async send(attachment: PendingAttachment): Promise<CompleteAttachment> {
    try {
      // First convert file to base64
      const base64Content = await this.fileToBase64(attachment.file);
      
      // Create multipart form data
      const formData = new FormData();
      formData.append('file', new Blob([Buffer.from(base64Content, 'base64')], { type: 'application/pdf' }), attachment.name);

      console.log('Uploading file to OpenWebUI:', {
        name: attachment.name,
        type: attachment.file.type,
        size: attachment.file.size
      });

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
        console.error('OpenWebUI upload error:', error);
        throw new Error(`File upload failed: ${error}`);
      }

      const result = await response.json();
      const fileId = result.id || result.file_id;

      if (!fileId) {
        throw new Error('No file ID returned from OpenWebUI');
      }

      console.log('File uploaded to OpenWebUI:', { fileId, result });

      return {
        id: fileId,
        type: "document",
        contentType: attachment.file.type || "application/pdf",
        name: attachment.name,
        content: [
          {
            type: "file",
            url: `data:${attachment.file.type || "application/pdf"};base64,${base64Content}`,
            mediaType: attachment.file.type || "application/pdf",
            filename: attachment.name
          } as ExtendedFileMessagePart,
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
// lib/pdf-adapter.ts - Enhanced version with proper OpenWebUI integration
import {
  AttachmentAdapter,
  PendingAttachment,
  CompleteAttachment,
} from "@assistant-ui/react";

import { OPENWEBUI_CONFIG, OPENWEBUI_ENDPOINTS } from './openwebui-config';

export class PDFAttachmentAdapter implements AttachmentAdapter {
  accept = ".pdf,.doc,.docx,.txt,.tex,.md,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown";

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
          type: "requires-action",
          reason: "error"
        },
      };
    }

    return {
      id: crypto.randomUUID(),
      type: "document",
      name: file.name,
      file,
      status: { 
        type: "requires-action",
        reason: "composer-send",
      },
    };
  }

  async send(attachment: PendingAttachment): Promise<CompleteAttachment> {
    try {
      console.log('📤 Uploading file to OpenWebUI:', {
        name: attachment.name,
        type: attachment.file.type,
        size: attachment.file.size
      });

      // Create FormData for file upload
      const formData = new FormData();
      formData.append('file', attachment.file);

      const uploadUrl = `${OPENWEBUI_CONFIG.baseUrl}${OPENWEBUI_ENDPOINTS.uploadFile}`;
      
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENWEBUI_CONFIG.apiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('❌ OpenWebUI upload error:', error);
        throw new Error(`File upload failed: ${response.status} - ${error}`);
      }

      const result = await response.json();
      console.log('✅ File uploaded successfully:', result);

      // OpenWebUI returns the file with an ID
      const fileId = result.id;

      if (!fileId) {
        throw new Error('No file ID returned from OpenWebUI');
      }

      // Return the complete attachment with file reference
      return {
        id: fileId,
        type: "document",
        name: attachment.name,
        content: [
          {
            type: "file",
            // Store file ID for chat completion API
            data: JSON.stringify({
              type: "file",
              id: fileId,
              name: attachment.name
            })
          } as any,
        ],
        status: { type: "complete" },
      };
    } catch (error) {
      console.error('❌ Upload error:', error);
      throw new Error(
        `Failed to upload file: ${error instanceof Error ? error.message : "Unknown error"}`
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
        console.log('🗑️ File deleted from OpenWebUI:', attachment.id);
      }
    } catch (error) {
      console.error('⚠️ Failed to delete file from OpenWebUI:', error);
    }
  }
}
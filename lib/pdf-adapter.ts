// lib/pdf-adapter.ts - FINAL FIXED VERSION
import {
  AttachmentAdapter,
  PendingAttachment,
  CompleteAttachment,
} from "@assistant-ui/react";

import { OPENWEBUI_CONFIG, OPENWEBUI_ENDPOINTS } from './openwebui-config';
import type { OpenWebUIAdapter } from './openwebui-adapter';

// Global adapter reference
let globalChatAdapter: OpenWebUIAdapter | null = null;

export function setGlobalChatAdapter(adapter: OpenWebUIAdapter) {
  globalChatAdapter = adapter;
  console.log('✅ Global chat adapter set');
}

export class PDFAttachmentAdapter implements AttachmentAdapter {
  accept = ".pdf,.doc,.docx,.txt,.tex,.md,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown";

  async add({ file }: { file: File }): Promise<PendingAttachment> {
    console.log('📄 PDFAttachmentAdapter.add() called:', file.name);
    
    // Validate file size (20MB limit)
    const maxSize = 20 * 1024 * 1024;
    if (file.size > maxSize) {
      console.error('❌ File too large:', file.size);
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

    console.log('✅ File accepted:', file.name, file.size, 'bytes');
    
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
      console.log('📤 Starting file upload to OpenWebUI');
      console.log('📄 File:', attachment.name);
      console.log('🔗 Global adapter exists:', !!globalChatAdapter);

      if (!attachment.file) {
        throw new Error('No file to upload');
      }

      // Create FormData for file upload
      const formData = new FormData();
      formData.append('file', attachment.file);

      const uploadUrl = `${OPENWEBUI_CONFIG.baseUrl}${OPENWEBUI_ENDPOINTS.uploadFile}`;
      console.log('🌐 Upload URL:', uploadUrl);
      
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENWEBUI_CONFIG.apiKey}`,
        },
        body: formData,
      });

      console.log('📥 Upload response status:', response.status);

      if (!response.ok) {
        const error = await response.text();
        console.error('❌ OpenWebUI upload error:', error);
        throw new Error(`File upload failed: ${response.status} - ${error}`);
      }

      const result = await response.json();
      console.log('✅ File uploaded successfully');
      console.log('📋 Response:', JSON.stringify(result, null, 2));

      const fileId = result.id;

      if (!fileId) {
        throw new Error('No file ID returned from OpenWebUI');
      }

      console.log('🎯 File ID:', fileId);

      // CRITICAL: Add file ID to the global chat adapter
      if (globalChatAdapter) {
        globalChatAdapter.addFileIds([fileId]);
        console.log('✅ File ID added to chat adapter');
        console.log('📎 Current adapter file IDs:', globalChatAdapter.getFileIds());
      } else {
        console.error('❌ No global chat adapter available!');
        console.error('⚠️ File uploaded but cannot be attached to messages');
      }

      // Return the complete attachment
      return {
        id: fileId,
        type: "document",
        name: attachment.name,
        content: [
          {
            type: "text",
            text: `[Uploaded: ${attachment.name}]`
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
    try {
      console.log('🗑️ Removing file:', attachment.id);
      
      if (attachment.id) {
        const deleteUrl = `${OPENWEBUI_CONFIG.baseUrl}${OPENWEBUI_ENDPOINTS.files}/${attachment.id}`;
        
        await fetch(deleteUrl, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${OPENWEBUI_CONFIG.apiKey}`,
          },
        });
        
        console.log('✅ File deleted from OpenWebUI');
      }
    } catch (error) {
      console.error('⚠️ Failed to delete file from OpenWebUI:', error);
    }
  }
}
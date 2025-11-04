// lib/openwebui-adapter.ts - FINAL FIXED VERSION
import type { ChatModelAdapter } from "@assistant-ui/react";

export class OpenWebUIAdapter implements ChatModelAdapter {
  private fileIds: Set<string> = new Set();

  constructor(private apiEndpoint: string) {
    this.run = this.run.bind(this);
    console.log('✅ OpenWebUIAdapter initialized');
  }

  // Method to add file IDs
  addFileIds(ids: string[]) {
    ids.forEach(id => this.fileIds.add(id));
    console.log('📎 File IDs added to adapter:', Array.from(this.fileIds));
  }

  // Method to clear file IDs (call this after message is sent)
  clearFileIds() {
    console.log('🗑️ Clearing file IDs:', Array.from(this.fileIds));
    this.fileIds.clear();
  }

  // Get current file IDs
  getFileIds(): string[] {
    return Array.from(this.fileIds);
  }

  async *run({ messages, abortSignal }: { messages: any[]; abortSignal: AbortSignal }) {
    const currentFileIds = this.getFileIds();
    
    console.log('🚀 OpenWebUIAdapter.run() called');
    console.log('📨 Messages count:', messages.length);
    console.log('📎 Current file IDs:', currentFileIds);

    try {
      // Normalize messages format
      const normalizedMessages = messages.map(msg => {
        let content = '';
        
        if (typeof msg.content === 'string') {
          content = msg.content;
        } else if (Array.isArray(msg.content)) {
          content = msg.content
            .filter((p: any) => p.type === 'text')
            .map((p: any) => p.text || '')
            .join('');
        } else if (Array.isArray(msg.parts)) {
          content = msg.parts
            .filter((p: any) => p.type === 'text')
            .map((p: any) => p.text || '')
            .join('');
        }
        
        return {
          role: msg.role,
          content: content.trim(),
        };
      });

      console.log('📝 Sending to API:', {
        messagesCount: normalizedMessages.length,
        fileIdsCount: currentFileIds.length,
        hasFiles: currentFileIds.length > 0
      });

      // Make API request with file IDs
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          messages: normalizedMessages,
          fileIds: currentFileIds.length > 0 ? currentFileIds : undefined
        }),
        signal: abortSignal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API error:', errorText);
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let buffer = '';
      let accumulatedText = '';
      let chunkCount = 0;

      console.log('📡 Starting to read stream...');

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          console.log('✅ Stream completed');
          console.log('📝 Total accumulated text length:', accumulatedText.length);
          console.log('📦 Total chunks processed:', chunkCount);
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) continue;

          try {
            let content: string | undefined;

            // Parse SSE format from API
            if (trimmedLine.startsWith('data: ')) {
              const data = trimmedLine.slice(6);
              if (data === '[DONE]') {
                console.log('🏁 Received [DONE] marker');
                continue;
              }

              const parsed = JSON.parse(data);
              
              // Handle text-delta format from our API
              if (parsed.type === 'text-delta' && parsed.delta) {
                content = parsed.delta;
              }
            }

            if (content) {
              chunkCount++;
              accumulatedText += content;
              
              // Log first few chunks for debugging
              if (chunkCount <= 5) {
                console.log(`📦 Chunk ${chunkCount}:`, content);
              }
              
              // Yield in the format assistant-ui expects
              yield {
                content: [
                  {
                    type: "text" as const,
                    text: accumulatedText,
                  }
                ],
              };
            }
          } catch (e) {
            console.error('⚠️ Parse error:', e, 'Line:', trimmedLine.substring(0, 100));
          }
        }
      }

      reader.releaseLock();
      
      // Clear file IDs after successful completion
      if (currentFileIds.length > 0) {
        console.log('🧹 Clearing file IDs after message completion');
        this.clearFileIds();
      }
      
    } catch (error) {
      console.error('❌ Adapter error:', error);
      throw error;
    }
  }
}
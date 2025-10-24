// lib/custom-transport.ts
import type { ChatModelAdapter } from "@assistant-ui/react";

interface Message {
  role: string;
  content: string | any[];
}

export class OpenWebUIChatAdapter implements ChatModelAdapter {
  constructor(private apiEndpoint: string) {}

  async run({
    messages,
    abortSignal,
  }: {
    messages: Message[];
    abortSignal: AbortSignal;
  }) {
    console.log('🚀 OpenWebUIChatAdapter run() called with messages:', messages);

    const response = await fetch(this.apiEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messages }),
      signal: abortSignal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API request failed:', errorText);
      throw new Error(`API request failed: ${response.status} - ${errorText}`);
    }

    if (!response.body) {
      throw new Error("No response body available");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    // Return the proper ChatModelRunResult format
    return {
      content: [
        {
          type: "text" as const,
          text: (async function* () {
            try {
              let accumulatedText = '';
              
              while (true) {
                const { done, value } = await reader.read();
                
                if (done) {
                  console.log('✅ Stream completed');
                  break;
                }

                const chunk = decoder.decode(value, { stream: true });
                accumulatedText += chunk;
                
                console.log('📦 Chunk received:', chunk.substring(0, 50));
                
                // Yield each chunk
                yield chunk;
              }
              
              console.log('📝 Total accumulated text:', accumulatedText.substring(0, 100));
            } catch (error) {
              console.error('❌ Stream error:', error);
              throw error;
            } finally {
              reader.releaseLock();
            }
          })(),
        },
      ],
    };
  }
}
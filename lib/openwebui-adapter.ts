import type { ChatModelAdapter } from "@assistant-ui/react";

export class OpenWebUIAdapter implements ChatModelAdapter {
  constructor(private apiEndpoint: string) {
    // Bind the run method to ensure 'this' context is preserved
    this.run = this.run.bind(this);
  }

  async run({ messages, abortSignal }: { messages: any[]; abortSignal: AbortSignal }) {
    console.log('🚀 OpenWebUIAdapter.run() called with messages:', messages);

    const response = await fetch(this.apiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
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

    // Return the proper ChatModelRunResult format
    return {
      content: [
        {
          type: 'text' as const,
          text: (async function* () {
            try {
              let buffer = '';
              let fullText = '';

              while (true) {
                const { done, value } = await reader.read();
                
                if (done) {
                  console.log('✅ Stream completed. Full text:', fullText);
                  break;
                }

                const chunk = decoder.decode(value, { stream: true });
                buffer += chunk;

                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                  if (line.trim().startsWith('0:')) {
                    try {
                      // Parse AI SDK format: 0:"content"
                      const jsonContent = line.slice(2).trim();
                      const content = JSON.parse(jsonContent);
                      fullText += content;
                      console.log('📝 Yielding:', content);
                      yield content;
                    } catch (e) {
                      console.error('⚠️ Parse error for line:', line, e);
                    }
                  } else if (line.trim().startsWith('e:')) {
                    // Finish event
                    console.log('🏁 Finish event received');
                  }
                }
              }
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
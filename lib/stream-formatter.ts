import type { AIAdapter } from "@assistant-ui/react";

export class OpenWebUIAdapter implements ChatModelAdapter {
  constructor(private apiEndpoint: string) {
    // Bind the run method to ensure 'this' context is preserved
    this.run = this.run.bind(this);
  }

  async run({ messages, abortSignal }: { messages: any[]; abortSignal: AbortSignal }) {
    console.log('🚀 OpenWebUIAdapter.run() called with messages:', messages);
    console.log('📡 Endpoint:', this.apiEndpoint);

    // Generate a unique message ID
    const messageId = `msg_${Math.random().toString(36).substr(2, 9)}`;

    // Normalize messages format
    const normalizedMessages = messages.map(msg => ({
      role: msg.role,
      content: typeof msg.content === 'string' ? msg.content : 
               Array.isArray(msg.content) ? msg.content.map((p: any) => p.text).join('') : 
               msg.content?.text || ''
    }));

    console.log('📝 Normalized messages:', normalizedMessages);

    const response = await fetch(this.apiEndpoint, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream'
      },
      body: JSON.stringify({ messages: normalizedMessages }),
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
              let started = false;

              // Helper function to format and yield events
              function* yieldEvent(type: string, content?: string) {
                const event = {
                  type,
                  id: messageId,
                  ...(content && { delta: content })
                };
                return JSON.stringify(event);
              }

              // Yield initial events
              yield* yieldEvent('start');
              yield* yieldEvent('start-step');
              yield* yieldEvent('text-start');

              while (true) {
                const { done, value } = await reader.read();
                
                if (done) {
                  console.log('✅ Stream completed. Full text:', fullText);
                  // Yield closing events
                  yield* yieldEvent('text-end');
                  yield* yieldEvent('finish-step');
                  yield* yieldEvent('finish');
                  break;
                }

                const chunk = decoder.decode(value, { stream: true });
                buffer += chunk;

                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                  const trimmedLine = line.trim();
                  if (!trimmedLine) continue;

                  console.log('📥 Received line:', trimmedLine.substring(0, 100));

                  try {
                    let content: string | undefined;

                    // Format 1: OpenAI-style SSE format
                    if (trimmedLine.startsWith('data: ')) {
                      const data = trimmedLine.slice(6);
                      if (data === '[DONE]') continue;

                      const parsed = JSON.parse(data);
                      content = parsed.choices?.[0]?.delta?.content;
                    }
                    // Format 2: AI SDK format (0:"content")
                    else if (trimmedLine.startsWith('0:')) {
                      const jsonContent = trimmedLine.slice(2).trim();
                      content = JSON.parse(jsonContent);
                    }
                    // Format 3: Direct content format
                    else if (!trimmedLine.startsWith('e:')) {
                      try {
                        const parsed = JSON.parse(trimmedLine);
                        content = typeof parsed === 'string' ? parsed :
                                parsed.content || parsed.text || 
                                parsed.choices?.[0]?.message?.content ||
                                parsed.choices?.[0]?.delta?.content;
                      } catch {
                        content = trimmedLine;
                      }
                    }

                    if (content) {
                      console.log('📝 Yielding content:', content);
                      fullText += content;
                      yield* yieldEvent('text-delta', content);
                    }
                  } catch (e) {
                    console.error('⚠️ Parse error for line:', trimmedLine, e);
                    // Try to salvage content even on parse error
                    if (trimmedLine && !trimmedLine.startsWith('e:')) {
                      console.log('🔄 Fallback: yielding as plain text');
                      fullText += trimmedLine;
                      yield trimmedLine;
                    }
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
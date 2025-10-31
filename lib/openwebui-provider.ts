// lib/openwebui-provider.ts
import { LanguageModelV1 } from "ai";

interface MessagePart {
  type: string;
  text?: string;
  url?: string;
  mediaType?: string;
  filename?: string;
}

interface Message {
  role: string;
  parts: MessagePart[];
}

interface ProviderOptions {
  prompt: Array<{
    role: string;
    content: MessagePart[];
  }>;
  abortSignal: AbortSignal;
}

export function createOpenWebUIProvider(config: {
  baseURL: string;
  apiKey: string;
}): LanguageModelV1 {
  return {
    specificationVersion: "v1" as const,
    provider: "openwebui" as const,
    modelId: "default",
    defaultObjectGenerationMode: "json" as const,

    async doGenerate(options: ProviderOptions) {
      const { prompt, abortSignal } = options;
      
      const messages: Message[] = prompt.map((msg) => ({
        role: msg.role,
        parts: msg.content.map((part: MessagePart) => {
          if (part.type === 'text') return { type: 'text', text: part.text };
          if (part.type === 'file') {
            return {
              type: 'file',
              url: part.url,
              mediaType: part.mediaType,
              filename: part.filename
            };
          }
          return part;
        })
      }));

      const response = await fetch(`${config.baseURL}/api/chat/completions`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: messages.map(msg => ({
            role: msg.role,
            content: msg.parts.map(part => {
              if (part.type === 'text') return part.text || '';
              if (part.type === 'file') return `[File: ${part.filename}]\n${part.url || ''}`;
              return '';
            }).join(' ')
          })),
          stream: false,
        }),
        signal: abortSignal,
      });

      if (!response.ok) {
        throw new Error(`OpenWebUI API error: ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content || "";

      return {
        text: content,
        finishReason: "stop" as const,
        usage: {
          promptTokens: 0,
          completionTokens: 0,
        },
      };
    },

    async doStream(options: ProviderOptions) {
      const { prompt, abortSignal } = options;
      
      const messages: Message[] = prompt.map((msg) => ({
        role: msg.role,
        parts: msg.content.map((part: MessagePart) => {
          if (part.type === 'text') return { type: 'text', text: part.text };
          if (part.type === 'file') {
            return {
              type: 'file',
              url: part.url,
              mediaType: part.mediaType,
              filename: part.filename
            };
          }
          return part;
        })
      }));

      const response = await fetch(`${config.baseURL}/api/chat/completions`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: messages.map(msg => ({
            role: msg.role,
            content: msg.parts.map(part => {
              if (part.type === 'text') return part.text || '';
              if (part.type === 'file') return `[File: ${part.filename}]\n${part.url || ''}`;
              return '';
            }).join(' ')
          })),
          stream: true,
        }),
        signal: abortSignal,
      });

      if (!response.ok) {
        throw new Error(`OpenWebUI API error: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      return {
        stream: {
          async *[Symbol.asyncIterator]() {
            if (!reader) return;

            try {
              let buffer = "";

              while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";

                for (const line of lines) {
                  if (!line.trim() || !line.startsWith("data: ")) continue;
                  
                  const data = line.slice(6).trim();
                  if (data === "[DONE]") continue;

                  try {
                    const parsed = JSON.parse(data);
                    const content = parsed.choices?.[0]?.delta?.content;

                    if (content) {
                      yield {
                        type: "text-delta" as const,
                        textDelta: content,
                      };
                    }
                  } catch (e) {
                    console.error("Parse error:", e);
                  }
                }
              }
            } finally {
              reader.releaseLock();
            }
          },
        },
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
  };
}
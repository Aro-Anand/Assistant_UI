// route.ts
import { NextRequest } from 'next/server';
import { OPENWEBUI_CONFIG, OPENWEBUI_ENDPOINTS } from '@/lib/openwebui-config';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();
    
    console.log('Received messages:', JSON.stringify(messages, null, 2));

    // Extract file IDs from messages if any
    const fileIds: string[] = [];
    messages.forEach((msg: any) => {
      if (msg.files && Array.isArray(msg.files)) {
        fileIds.push(...msg.files.map((f: any) => f.id));
      }
    });

    // Prepare OpenWebUI-compatible request
    const openWebUIRequest: any = {
      model: process.env.NEXT_PUBLIC_DEFAULT_MODEL || 'gpt-4o-mini',
      messages: messages.map((msg: any) => {
        // Extract content from message
        let content = '';
        
        if (msg.content) {
          content = msg.content;
        } else if (msg.parts && Array.isArray(msg.parts)) {
          content = msg.parts
            .filter((part: any) => part.type === 'text')
            .map((part: any) => part.text)
            .join('');
        }
        
        return {
          role: msg.role,
          content: content,
        };
      }),
      stream: true,
    };

    // Add files to request if any
    if (fileIds.length > 0) {
      openWebUIRequest.files = fileIds.map(id => ({
        type: 'file',
        id: id,
      }));
    }

    console.log('Sending to OpenWebUI:', JSON.stringify(openWebUIRequest, null, 2));

    // Forward to OpenWebUI
    const response = await fetch(
      `${OPENWEBUI_CONFIG.baseUrl}${OPENWEBUI_ENDPOINTS.chat}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENWEBUI_CONFIG.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(openWebUIRequest),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenWebUI API error:', error);
      return Response.json(
        { error: 'OpenWebUI API request failed', details: error },
        { status: response.status }
      );
    }

    // Get the reader from OpenWebUI response
    const reader = response.body?.getReader();
    if (!reader) {
      return Response.json(
        { error: 'No response body available for streaming' },
        { status: 500 }
      );
    }
    
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    
    // Create a transform stream to convert OpenAI format to AI SDK UI Message Stream format
    const stream = new ReadableStream({
      async start(controller) {
        let buffer = '';
        
        // Helper to send data in AI SDK format
        const sendData = (content: string) => {
          // AI SDK UI Message Stream format
          const data = `0:${JSON.stringify(content)}\n`;
          controller.enqueue(encoder.encode(data));
        };
        
        try {
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
              // Process any remaining buffer
              if (buffer.trim()) {
                const lines = buffer.split('\n');
                for (const line of lines) {
                  if (!line.trim() || !line.startsWith('data: ')) continue;
                  
                  const data = line.slice(6);
                  if (data !== '[DONE]') {
                    try {
                      const parsed = JSON.parse(data);
                      if (parsed.choices?.[0]?.delta?.content) {
                        const content = parsed.choices[0].delta.content;
                        sendData(content);
                        console.log('Streaming content:', content);
                      }
                    } catch (e) {
                      console.error('Error parsing final chunk:', e);
                    }
                  }
                }
              }
              
              // Send finish message in AI SDK format
              const finishData = `d:${JSON.stringify({ finishReason: 'stop' })}\n`;
              controller.enqueue(encoder.encode(finishData));
              controller.close();
              break;
            }
            
            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;
            
            // Process complete lines
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep incomplete line in buffer
            
            for (const line of lines) {
              if (!line.trim()) continue;
              
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                
                if (data === '[DONE]') {
                  // Send finish message
                  const finishData = `d:${JSON.stringify({ finishReason: 'stop' })}\n`;
                  controller.enqueue(encoder.encode(finishData));
                  controller.close();
                  return;
                }
                
                try {
                  const parsed = JSON.parse(data);
                  
                  // Extract content from the delta
                  if (parsed.choices?.[0]?.delta?.content) {
                    const content = parsed.choices[0].delta.content;
                    sendData(content);
                    console.log('Streaming content:', content);
                  }
                } catch (e) {
                  console.error('Error parsing chunk:', e, 'Line:', line);
                }
              }
            }
          }
        } catch (error) {
          console.error('Stream error:', error);
          controller.error(error);
        } finally {
          try {
            reader.releaseLock();
          } catch (e) {
            // Ignore lock errors
          }
        }
      },
      
      cancel() {
        reader.cancel();
      }
    });
    
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Vercel-AI-Data-Stream': 'v1',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Error in chat API:', error);
    return Response.json(
      { 
        error: 'Failed to process chat request', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
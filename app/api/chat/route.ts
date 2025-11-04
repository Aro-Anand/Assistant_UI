// app/api/chat/route.ts - Enhanced with file handling
import { NextRequest } from 'next/server';
import { OPENWEBUI_CONFIG, OPENWEBUI_ENDPOINTS } from '@/lib/openwebui-config';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();
  try {
    const { messages } = await req.json();
    
    console.log('=== CHAT API START ===');
    console.log('📨 Raw request messages:', JSON.stringify(messages, null, 2));

    // Extract file IDs from messages
    const fileIds: string[] = [];
    
    // Convert messages to OpenWebUI format and extract files
    interface MessagePart {
      type: 'text' | 'file';
      text?: string;
      fileId?: string;
    }

    interface MessagePart {
      type: 'text' | 'file';
      text?: string;
      url?: string;
      fileId?: string;
      filename?: string;
    }

    const convertedMessages = messages.map((msg: any) => {
      const parts: MessagePart[] = [];
      
      // Handle parts array
      if (Array.isArray(msg.parts)) {
        msg.parts.forEach((part: any) => {
          if (part.type === 'text') {
            parts.push({
              type: 'text',
              text: part.text || part.content || ''
            });
          } else if (part.type === 'file' && part.url) {
            try {
              const fileData = JSON.parse(part.url);
              if (fileData.id) {
                fileIds.push(fileData.id);
                console.log('📎 Found file attachment:', fileData);
                parts.push({
                  type: 'file',
                  fileId: fileData.id,
                  filename: part.filename || fileData.name
                });
              }
            } catch (e) {
              console.error('⚠️ Failed to parse file data:', e);
            }
          }
        });
      }
      // Handle content array
      else if (Array.isArray(msg.content)) {
        msg.content.forEach((part: any) => {
          if (part.type === 'text') {
            parts.push({
              type: 'text',
              text: part.text || part.content || ''
            });
          } else if (part.type === 'file' && part.url) {
            try {
              const fileData = JSON.parse(part.url);
              if (fileData.id) {
                fileIds.push(fileData.id);
                console.log('📎 Found file attachment:', fileData);
                parts.push({
                  type: 'file',
                  fileId: fileData.id,
                  filename: part.filename || fileData.name
                });
              }
            } catch (e) {
              console.error('⚠️ Failed to parse file data:', e);
            }
          }
        });
      }
      // Handle string content
      else if (typeof msg.content === 'string') {
        parts.push({
          type: 'text',
          text: msg.content
        });
      }
      
      return {
        role: msg.role,
        content: parts.length > 0 ? parts : [{ type: 'text', text: '' }]
      };
    });

    console.log('🔄 Converted messages:', JSON.stringify(convertedMessages, null, 2));
    console.log('📎 Extracted file IDs:', fileIds);

    if (convertedMessages.length === 0) {
      console.error('❌ No valid messages');
      return new Response(
        JSON.stringify({ error: 'No valid messages' }), 
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    interface OpenWebUIMessage {
      role: string;
      content: string;
    }

    // Build OpenWebUI request with files attached
    const openWebUIRequest: {
      model: string;
      messages: OpenWebUIMessage[];
      stream: boolean;
      files?: Array<{ type: string; id: string; }>;
    } = {
      model: process.env.NEXT_PUBLIC_DEFAULT_MODEL || 'gpt-4o-mini',
      messages: convertedMessages.map((msg: { role: string; content: MessagePart[]; }) => ({
        role: msg.role,
        content: msg.content.map((part: MessagePart) => {
          if (part.type === 'text') {
            return part.text || '';
          }
          return '';
        }).join(' ').trim()
      })),
      stream: true,
    };

    // Add files to request if any were uploaded
    if (fileIds.length > 0) {
      openWebUIRequest.files = fileIds.map(id => ({
        type: 'file',
        id: id
      }));
      console.log('📁 Attaching files to request:', openWebUIRequest.files);
    }

    const openwebuiUrl = `${OPENWEBUI_CONFIG.baseUrl}${OPENWEBUI_ENDPOINTS.chat}`;
    console.log('🌐 Calling OpenWebUI:', openwebuiUrl);

    const response = await fetch(openwebuiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENWEBUI_CONFIG.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(openWebUIRequest),
    });

    console.log('📥 OpenWebUI response status:', response.status);

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ OpenWebUI error:', error);
      return new Response(JSON.stringify({ error: 'OpenWebUI failed', details: error }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!response.body) {
      console.error('❌ No response body');
      return new Response(JSON.stringify({ error: 'No response body' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    console.log('🔄 Starting stream processing...');

    let buffer = '';
    let isStreamActive = true;
    const stream = new ReadableStream({
      async start(controller) {
        try {
          while (isStreamActive) {
            const { done, value } = await reader.read();
            
            if (done) {
              console.log('✅ Stream completed');
              if (isStreamActive) {
                controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              }
              break;
            }

            if (!isStreamActive) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (!line.trim() || !isStreamActive) continue;
              
              try {
                let content: string | undefined;
                
                if (line.startsWith('data: ')) {
                  const data = line.slice(6).trim();
                  if (data === '[DONE]') continue;
                  
                  const parsed = JSON.parse(data);
                  content = parsed.choices?.[0]?.delta?.content;
                } else if (line.startsWith('0:')) {
                  content = JSON.parse(line.slice(2).trim());
                }

                if (content) {
                  const chunk = `data: ${JSON.stringify({
                    choices: [{
                      delta: { 
                        content: [{
                          type: 'text',
                          text: content
                        }]
                      },
                      index: 0,
                      finish_reason: null
                    }]
                  })}\n\n`;
                  controller.enqueue(encoder.encode(chunk));
                }
              } catch (e) {
                console.error('⚠️ Parse error:', e, 'Line:', line);
              }
            }
          }
        } catch (error) {
          console.error('❌ Stream error:', error);
          if (isStreamActive) {
            controller.error(error);
          }
        } finally {
          isStreamActive = false;
          reader.releaseLock();
        }
      },
      
      cancel() {
        console.log('🛑 Stream cancelled by client');
        isStreamActive = false;
        reader.cancel();
      }
    });

    console.log('📡 Returning stream response');
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
    
  } catch (error) {
    console.error('❌ Fatal error in chat API:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to process chat request', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 788
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
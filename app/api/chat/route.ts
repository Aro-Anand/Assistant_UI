// app/api/chat/route.ts - WITH MCP TOOLS SUPPORT
import { NextRequest } from 'next/server';
import { OPENWEBUI_CONFIG, OPENWEBUI_ENDPOINTS } from '@/lib/openwebui-config';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();
  
  try {
    const body = await req.json();
    const { messages, fileIds, tool_servers } = body;
    
    console.log('=== CHAT API START ===');
    console.log('📨 Messages:', messages?.length);
    console.log('📎 File IDs:', fileIds?.length || 0);
    console.log('🔧 Tool servers:', tool_servers?.length || 0);

    if (!messages || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No messages provided' }), 
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Build OpenWebUI request payload
    const openWebUIRequest: any = {
      model: process.env.NEXT_PUBLIC_DEFAULT_MODEL || 'gpt-4o-mini',
      messages: messages,
      stream: true,
    };

    // Add files if provided
    if (fileIds && Array.isArray(fileIds) && fileIds.length > 0) {
      openWebUIRequest.files = fileIds.map((id: string) => ({
        type: 'file',
        id: id
      }));
      console.log('📎 Including files:', openWebUIRequest.files);
    }

    // CRITICAL: Add tool_servers for MCP support
    if (tool_servers && Array.isArray(tool_servers) && tool_servers.length > 0) {
      openWebUIRequest.tool_servers = tool_servers;
      console.log('🔧 Including tool servers:', tool_servers.map((t: any) => ({
        url: t.url,
        toolCount: t.specs?.length || 0
      })));
    }

    // Add other required parameters from your payload
    openWebUIRequest.params = {};
    openWebUIRequest.features = {
      image_generation: false,
      code_interpreter: false,
      web_search: false
    };

    const openwebuiUrl = `${OPENWEBUI_CONFIG.baseUrl}${OPENWEBUI_ENDPOINTS.chat}`;
    console.log('🌐 Calling:', openwebuiUrl);
    console.log('📤 Full payload:', JSON.stringify({
      ...openWebUIRequest,
      messages: `[${openWebUIRequest.messages.length} messages]`
    }, null, 2));

    const response = await fetch(openwebuiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENWEBUI_CONFIG.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(openWebUIRequest),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ OpenWebUI error:', error);
      return new Response(
        JSON.stringify({ error: 'OpenWebUI request failed', details: error }), 
        { status: response.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!response.body) {
      return new Response(
        JSON.stringify({ error: 'No response body' }), 
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    // Create SSE stream
    const stream = new ReadableStream({
      async start(controller) {
        let buffer = '';
        const messageId = `msg_${Date.now()}`;
        
        try {
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
              console.log('✅ Stream completed');
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (!line.trim()) continue;
              
              try {
                let content: string | undefined;
                let toolCalls: any[] | undefined;
                
                // Parse OpenWebUI SSE format
                if (line.startsWith('data: ')) {
                  const data = line.slice(6).trim();
                  if (data === '[DONE]') continue;
                  
                  const parsed = JSON.parse(data);
                  
                  // Check for text content
                  content = parsed.choices?.[0]?.delta?.content;
                  
                  // Check for tool calls
                  toolCalls = parsed.choices?.[0]?.delta?.tool_calls;
                  
                  if (toolCalls) {
                    console.log('🔧 Tool calls in stream:', toolCalls);
                    // Forward tool calls to client
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({
                        type: 'tool-call',
                        id: messageId,
                        tool_calls: toolCalls
                      })}\n\n`)
                    );
                  }
                }

                if (content) {
                  // Send text content
                  const event = {
                    type: 'text-delta',
                    id: messageId,
                    delta: content
                  };
                  
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
                  );
                }
              } catch (e) {
                console.error('⚠️ Parse error:', e);
              }
            }
          }
        } catch (error) {
          console.error('❌ Stream error:', error);
          controller.error(error);
        } finally {
          reader.releaseLock();
          controller.close();
        }
      },
      
      cancel() {
        console.log('🛑 Stream cancelled');
        reader.cancel();
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
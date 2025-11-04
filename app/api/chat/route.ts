// app/api/chat/route.ts - SIMPLIFIED AND FIXED VERSION
import { NextRequest } from 'next/server';
import { OPENWEBUI_CONFIG, OPENWEBUI_ENDPOINTS } from '@/lib/openwebui-config';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();
  
  try {
    const body = await req.json();
    const { messages, fileIds } = body;
    
    console.log('=== CHAT API START ===');
    console.log('📨 Received messages:', messages?.length);
    console.log('📎 File IDs:', fileIds);

    if (!messages || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No messages provided' }), 
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Build OpenWebUI request
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

    const openwebuiUrl = `${OPENWEBUI_CONFIG.baseUrl}${OPENWEBUI_ENDPOINTS.chat}`;
    console.log('🌐 Calling:', openwebuiUrl);

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
                
                // Parse OpenWebUI SSE format
                if (line.startsWith('data: ')) {
                  const data = line.slice(6).trim();
                  if (data === '[DONE]') continue;
                  
                  const parsed = JSON.parse(data);
                  content = parsed.choices?.[0]?.delta?.content;
                }

                if (content) {
                  // Send in SSE format with text-delta type
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
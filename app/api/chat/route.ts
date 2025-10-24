import { NextRequest } from 'next/server';
import { OPENWEBUI_CONFIG, OPENWEBUI_ENDPOINTS } from '@/lib/openwebui-config';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();
    
    console.log('=== CHAT API START ===');
    console.log('📨 Raw request messages:', JSON.stringify(messages, null, 2));

    // Convert messages to OpenWebUI format
    const convertedMessages = messages.map((msg: any) => {
      let content = '';
      
      if (typeof msg.content === 'string') {
        content = msg.content;
      } else if (Array.isArray(msg.content)) {
        content = msg.content
          .filter((p: any) => p.type === 'text')
          .map((p: any) => p.text || p.content || '')
          .join('');
      } else if (Array.isArray(msg.parts)) {
        content = msg.parts
          .filter((p: any) => p.type === 'text')
          .map((p: any) => p.text || p.content || '')
          .join('');
      }
      
      return {
        role: msg.role,
        content: content.trim(),
      };
    }).filter((msg: any) => msg.content);

    console.log('🔄 Converted for OpenWebUI:', JSON.stringify(convertedMessages, null, 2));

    if (convertedMessages.length === 0) {
      console.error('❌ No valid messages');
      return new Response(
        JSON.stringify({ error: 'No valid messages' }), 
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const openWebUIRequest = {
      model: process.env.NEXT_PUBLIC_DEFAULT_MODEL || 'gpt-4o-mini',
      messages: convertedMessages,
      stream: true,
    };

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
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    console.log('🔄 Starting stream processing...');

    const stream = new ReadableStream({
      async start(controller) {
        let buffer = '';
        let chunkCount = 0;
        const messageId = `msg_${Math.random().toString(36).substr(2, 9)}`;
        
        // Send initial events
        const startEvents = [
          `data: {"type":"start"}\n\n`,
          `data: {"type":"start-step"}\n\n`,
          `data: {"type":"text-start","id":"${messageId}"}\n\n`
        ];
        
        for (const event of startEvents) {
          controller.enqueue(encoder.encode(event));
        }
        
        try {
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
              console.log(`✅ Stream done. Total chunks: ${chunkCount}`);
              
              // Send closing events
              const endEvents = [
                `data: {"type":"text-end","id":"${messageId}"}\n\n`,
                `data: {"type":"finish-step"}\n\n`,
                `data: {"type":"finish"}\n\n`,
                `data: [DONE]\n\n`
              ];
              
              for (const event of endEvents) {
                controller.enqueue(encoder.encode(event));
              }
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (!line.trim()) continue;
              
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
                  chunkCount++;
                  const event = `data: {"type":"text-delta","id":"${messageId}","delta":${JSON.stringify(content)}}\n\n`;
                  console.log(`📤 Chunk ${chunkCount}:`, { content, id: messageId });
                  controller.enqueue(encoder.encode(event));
                }
              } catch (e) {
                console.error('⚠️ Parse error:', e, 'Line:', line);
              }
            }
          }
          
          console.log('🔚 Closing stream');
          controller.close();
        } catch (error) {
          console.error('❌ Stream error:', error);
          controller.error(error);
        }
      },
      
      cancel() {
        console.log('🛑 Stream cancelled by client');
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
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
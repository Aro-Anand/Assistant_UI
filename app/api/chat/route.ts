import { NextRequest } from 'next/server';
import { OPENWEBUI_CONFIG, OPENWEBUI_ENDPOINTS } from '@/lib/openwebui-config';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();
    
    console.log('📨 Received messages:', JSON.stringify(messages, null, 2));

    // Convert messages to OpenWebUI format - handle both content and parts
    const convertedMessages = messages.map((msg: any) => {
      let content = '';
      
      // Handle string content
      if (typeof msg.content === 'string') {
        content = msg.content;
      }
      // Handle content array (assistant-ui format)
      else if (Array.isArray(msg.content)) {
        content = msg.content
          .filter((p: any) => p.type === 'text')
          .map((p: any) => p.text || p.content || '')
          .join('');
      }
      // Handle parts array (from useChatRuntime)
      else if (Array.isArray(msg.parts)) {
        content = msg.parts
          .filter((p: any) => p.type === 'text')
          .map((p: any) => p.text || p.content || '')
          .join('');
      }
      
      return {
        role: msg.role,
        content: content.trim(),
      };
    }).filter((msg: any) => msg.content); // Only keep messages with content

    console.log('🔄 Converted messages:', JSON.stringify(convertedMessages, null, 2));

    if (convertedMessages.length === 0) {
      console.error('❌ No valid messages after conversion');
      return new Response(
        JSON.stringify({ error: 'No valid messages to send' }), 
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Extract files if present
    const files: any[] = [];
    messages.forEach((msg: any) => {
      // Check content array
      if (Array.isArray(msg.content)) {
        msg.content.forEach((part: any) => {
          if (part.type === 'file' || part.type === 'image') {
            files.push({ 
              type: 'file', 
              id: part.data || part.id || part.file 
            });
          }
        });
      }
      // Check parts array
      if (Array.isArray(msg.parts)) {
        msg.parts.forEach((part: any) => {
          if (part.type === 'file' || part.type === 'image') {
            files.push({ 
              type: 'file', 
              id: part.data || part.id || part.file 
            });
          }
        });
      }
    });

    const openWebUIRequest: any = {
      model: process.env.NEXT_PUBLIC_DEFAULT_MODEL || 'gpt-4o-mini',
      messages: convertedMessages,
      stream: true,
    };

    if (files.length > 0) {
      openWebUIRequest.files = files;
      console.log('📎 Including files:', files);
    }

    console.log('➡️ Sending to OpenWebUI:', JSON.stringify(openWebUIRequest, null, 2));

    const openwebuiUrl = `${OPENWEBUI_CONFIG.baseUrl}${OPENWEBUI_ENDPOINTS.chat}`;
    console.log('🌐 OpenWebUI URL:', openwebuiUrl);

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
      console.error('❌ OpenWebUI API error:', error);
      return new Response(JSON.stringify({ error: 'OpenWebUI API request failed', details: error }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!response.body) {
      return new Response(JSON.stringify({ error: 'No response body' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Parse OpenWebUI SSE stream and convert to AI SDK format
    const reader = response.body.getReader();
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        let buffer = '';
        
        try {
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
              console.log('✅ Stream completed');
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (!line.trim() || !line.startsWith('data: ')) continue;
              
              const data = line.slice(6).trim();
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content;

                if (content) {
                  // Format for AI SDK: "0:{content}\n"
                  controller.enqueue(encoder.encode(`0:${JSON.stringify(content)}\n`));
                  console.log('📤 Chunk:', content.substring(0, 50));
                }
              } catch (e) {
                console.error('⚠️ Parse error:', e);
              }
            }
          }
          
          controller.close();
        } catch (error) {
          console.error('❌ Stream error:', error);
          controller.error(error);
        }
      },
      
      cancel() {
        console.log('🛑 Stream cancelled');
        reader.cancel();
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
    
  } catch (error) {
    console.error('❌ Error in chat API:', error);
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
// route.ts
import { NextRequest } from 'next/server';
import { OPENWEBUI_CONFIG, OPENWEBUI_ENDPOINTS } from '@/lib/openwebui-config';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();
    
    console.log('Received messages:', JSON.stringify(messages, null, 2));

    // Convert messages to OpenWebUI format
    const convertedMessages = messages.map((msg: any) => {
      let content = '';
      
      if (typeof msg.content === 'string') {
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
    });

    // Extract files
    const files: any[] = [];
    messages.forEach((msg: any) => {
      if (msg.parts && Array.isArray(msg.parts)) {
        msg.parts.forEach((part: any) => {
          if (part.type === 'file') {
            files.push({ type: 'file', id: part.data || part.id });
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
      console.log('Including files in request:', files);
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

    const reader = response.body?.getReader();
    if (!reader) {
      return Response.json(
        { error: 'No response body available for streaming' },
        { status: 500 }
      );
    }
    
    const decoder = new TextDecoder();
    
    // Create a simple text stream
    const stream = new ReadableStream({
      async start(controller) {
        let buffer = '';
        
        try {
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;
            
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            
            for (const line of lines) {
              if (!line.trim() || !line.startsWith('data: ')) continue;
              
              const data = line.slice(6).trim();
              if (data === '[DONE]') continue;
              
              try {
                const parsed = JSON.parse(data);
                
                if (parsed.choices?.[0]?.delta?.content) {
                  const content = parsed.choices[0].delta.content;
                  controller.enqueue(new TextEncoder().encode(content));
                  console.log('Streaming content:', content);
                }
              } catch (e) {
                console.error('Error parsing chunk:', e);
              }
            }
          }
          
          controller.close();
        } catch (error) {
          console.error('Stream error:', error);
          controller.error(error);
        }
      },
      
      cancel() {
        reader.cancel();
      }
    });
    
    // Use standard Response with proper headers for text streaming
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
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
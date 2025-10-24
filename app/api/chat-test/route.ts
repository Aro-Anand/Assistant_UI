// Create this as app/api/chat-test/route.ts
// This bypasses OpenWebUI to test if the frontend works at all

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  console.log('🧪 TEST ROUTE: Starting simple test');
  
  const { messages } = await req.json();
  console.log('🧪 TEST ROUTE: Received messages:', messages);

  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Send a simple test message word by word
        const testMessage = "Hello from test route! This is working!";
        const words = testMessage.split(' ');
        
        console.log('🧪 TEST ROUTE: Sending words:', words);
        
        for (let i = 0; i < words.length; i++) {
          const word = words[i];
          const chunk = `0:${JSON.stringify(word + ' ')}\n`;
          
          console.log(`🧪 TEST ROUTE: Sending chunk ${i}:`, chunk);
          controller.enqueue(encoder.encode(chunk));
          
          // Small delay to simulate streaming
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        console.log('🧪 TEST ROUTE: All chunks sent, closing');
        controller.close();
      } catch (error) {
        console.error('🧪 TEST ROUTE: Error:', error);
        controller.error(error);
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
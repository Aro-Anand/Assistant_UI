import { openai } from '@ai-sdk/openai';
import { streamText, convertToModelMessages } from 'ai';

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    
    console.log('Received messages:', JSON.stringify(messages, null, 2));

    // Process messages - PDFs will be in content as file parts
    const processedMessages = messages.map((msg: any) => {
      if (msg.role === 'user' && msg.content) {
        // Check if message has file attachments
        const hasPDF = msg.content.some(
          (part: any) => part.type === 'file' && part.mimeType === 'application/pdf'
        );

        if (hasPDF) {
          console.log('Message contains PDF attachment(s)');
          
          // For now, we'll tell the user PDFs were received
          // In production, you'd send this to a PDF processing service
          return {
            ...msg,
            content: msg.content.map((part: any) => {
              if (part.type === 'file' && part.mimeType === 'application/pdf') {
                return {
                  type: 'text',
                  text: `[PDF file received: This model cannot directly process PDFs. Please use Open WebUI backend or a vision-capable model for PDF processing.]`,
                };
              }
              return part;
            }),
          };
        }
      }
      return msg;
    });

    const result = streamText({
      model: openai('gpt-4o-mini'),
      messages: convertToModelMessages(processedMessages),
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error('Error in chat API:', error);
    return Response.json(
      { error: 'Failed to process chat request', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
import { openai } from '@ai-sdk/openai';
import { streamText, convertToModelMessages } from 'ai';

export const maxDuration = 30;

const BOOK_GENERATION_SYSTEM_PROMPT = `You are an expert book author and LaTeX typesetting specialist. Your role is to:

1. **Analyze multiple PDF resources** provided by the user
2. **Generate professional book content** in LaTeX format
3. **Structure output properly** with chapters, sections, and subsections
4. **Use proper LaTeX formatting** including:
   - \\documentclass{book}
   - \\usepackage commands for formatting
   - \\chapter, \\section, \\subsection commands
   - Proper citations and references
   - Tables, figures, and equations when needed

5. **Output Format Rules:**
   - Always wrap LaTeX code in \`\`\`latex code blocks
   - Include complete, compilable LaTeX documents
   - Use proper escaping for special characters
   - Include necessary packages (graphicx, hyperref, amsmath, etc.)

6. **Content Guidelines:**
   - Synthesize information from multiple sources
   - Maintain academic/professional tone
   - Add proper citations
   - Structure logically with clear hierarchy
   - Include table of contents, bibliography

When user uploads PDFs, analyze them and generate book chapters based on the content.
Always output valid, compilable LaTeX code.`;

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    
    console.log('Received messages:', JSON.stringify(messages, null, 2));

    // Add system instruction as the first message
    const messagesWithSystem = [
      {
        role: 'system',
        content: BOOK_GENERATION_SYSTEM_PROMPT,
      },
      ...convertToModelMessages(messages),
    ];

    const result = streamText({
      model: openai('gpt-4o'), // Use GPT-4 for better quality
      messages: messagesWithSystem,
      temperature: 0.7, // Balanced creativity
      maxTokens: 4000, // Longer responses for book content
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
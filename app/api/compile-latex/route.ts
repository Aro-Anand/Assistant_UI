import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { latexCode } = await req.json();

    // Option 1: Use LaTeX Online API
    const response = await fetch('https://latexonline.cc/compile?target=book.tex', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-tar',
      },
      body: createTarArchive({
        'book.tex': latexCode,
      }),
    });

    if (!response.ok) {
      throw new Error('LaTeX compilation failed');
    }

    const pdfBlob = await response.blob();
    
    return new NextResponse(pdfBlob, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="book.pdf"',
      },
    });
  } catch (error) {
    console.error('Compilation error:', error);
    return NextResponse.json(
      { error: 'Failed to compile LaTeX', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Simple tar archive creator for single file
function createTarArchive(files: Record<string, string>): Uint8Array {
  // Simplified - in production, use a proper tar library
  const filename = Object.keys(files)[0];
  const content = files[filename];
  
  // For now, return the raw LaTeX content
  // In production, use a library like 'tar-stream' to create proper tar archive
  return new TextEncoder().encode(content);
}
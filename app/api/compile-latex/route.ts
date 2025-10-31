// app/api/compile-latex/route.ts
// OPTIONAL: This endpoint compiles LaTeX to PDF
// Requires pdflatex to be installed on the server
// You can also use a third-party service like LaTeX.Online API

import { NextRequest } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';

const execAsync = promisify(exec);

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const { latexCode } = await req.json();

    if (!latexCode) {
      return new Response(
        JSON.stringify({ error: 'No LaTeX code provided' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if LaTeX is enabled
    const compilationEnabled = process.env.ENABLE_PDF_COMPILATION === 'true';
    
    if (!compilationEnabled) {
      return new Response(
        JSON.stringify({ 
          error: 'PDF compilation is not enabled on this server',
          message: 'Please download the .tex file and compile locally or use Overleaf'
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create temporary directory
    const tempId = randomBytes(16).toString('hex');
    const tempDir = join(tmpdir(), `latex-${tempId}`);
    await mkdir(tempDir, { recursive: true });

    const texFile = join(tempDir, 'document.tex');
    const pdfFile = join(tempDir, 'document.pdf');

    try {
      // Write LaTeX file
      await writeFile(texFile, latexCode, 'utf-8');

      console.log('🔨 Compiling LaTeX to PDF...');

      // Compile LaTeX (run twice for references)
      try {
        await execAsync(`pdflatex -interaction=nonstopmode -output-directory="${tempDir}" "${texFile}"`, {
          timeout: 20000,
        });
        
        // Second pass for references
        await execAsync(`pdflatex -interaction=nonstopmode -output-directory="${tempDir}" "${texFile}"`, {
          timeout: 20000,
        });
      } catch (execError: any) {
        console.error('LaTeX compilation error:', execError.stderr || execError.message);
        
        // Check if PDF was still generated despite warnings
        try {
          await readFile(pdfFile);
        } catch {
          throw new Error(`LaTeX compilation failed: ${execError.stderr || execError.message}`);
        }
      }

      // Read compiled PDF
      const pdfBuffer = await readFile(pdfFile);

      console.log('✅ PDF compiled successfully');

      // Cleanup
      await cleanup(tempDir);

      // Return PDF
      return new Response(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="document.pdf"',
        },
      });

    } catch (error) {
      // Cleanup on error
      await cleanup(tempDir);
      throw error;
    }

  } catch (error) {
    console.error('❌ Compilation error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to compile LaTeX',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function cleanup(dir: string) {
  try {
    // Remove all files in directory
    const { readdir } = await import('fs/promises');
    const files = await readdir(dir);
    
    await Promise.all(
      files.map(file => unlink(join(dir, file)).catch(() => {}))
    );
    
    // Remove directory
    const { rmdir } = await import('fs/promises');
    await rmdir(dir).catch(() => {});
  } catch (error) {
    console.error('Cleanup error:', error);
  }
}

// ============================================
// ALTERNATIVE: Use LaTeX.Online API
// ============================================
// If you don't want to install LaTeX locally, use this instead:

/*
export async function POST(req: NextRequest) {
  try {
    const { latexCode } = await req.json();

    // LaTeX.Online API
    const response = await fetch('https://latex.ytotech.com/builds/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        compiler: 'pdflatex',
        resources: [
          {
            main: true,
            file: 'document.tex',
            content: latexCode,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error('LaTeX compilation failed');
    }

    const pdfBuffer = await response.arrayBuffer();

    return new Response(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="document.pdf"',
      },
    });

  } catch (error) {
    console.error('Compilation error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to compile LaTeX' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
*/
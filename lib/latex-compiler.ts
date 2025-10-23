export async function compileLaTeX(latexCode: string): Promise<string> {
  try {
    // Option 1: Client-side compilation with latex.js
    const latex = await import('latex.js');
    const generator = latex.HtmlGenerator({ hyphenate: false });
    const doc = latex.parse(latexCode, { generator });
    return doc.documentElement.outerHTML;
  } catch (error) {
    console.error('LaTeX compilation error:', error);
    throw new Error('Failed to compile LaTeX');
  }
}

export async function compileLaTeXToPDF(latexCode: string): Promise<Blob> {
  // This requires a server-side LaTeX installation or API service
  // We'll use an API approach
  
  try {
    const response = await fetch('https://latexonline.cc/compile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code: latexCode,
        format: 'pdf',
      }),
    });

    if (!response.ok) {
      throw new Error('LaTeX compilation failed');
    }

    return await response.blob();
  } catch (error) {
    console.error('PDF compilation error:', error);
    throw new Error('Failed to compile LaTeX to PDF');
  }
}
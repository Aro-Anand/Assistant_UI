'use client';

import { useState } from 'react';
import { Download, Eye, Code } from 'lucide-react';

interface LaTeXPreviewProps {
  latexCode: string;
}

export function LaTeXPreview({ latexCode }: LaTeXPreviewProps) {
  const [view, setView] = useState<'code' | 'preview'>('code');
  const [isCompiling, setIsCompiling] = useState(false);

  const handleDownloadLaTeX = () => {
    const blob = new Blob([latexCode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'book.tex';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCompileToPDF = async () => {
    setIsCompiling(true);
    try {
      const response = await fetch('/api/compile-latex', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latexCode }),
      });

      if (!response.ok) {
        throw new Error('Compilation failed');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'book.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Compilation error:', error);
      alert('Failed to compile PDF. Please check the LaTeX code.');
    } finally {
      setIsCompiling(false);
    }
  };

  return (
    <div className="border rounded-lg overflow-hidden my-4">
      {/* Toolbar */}
      <div className="bg-gray-100 border-b px-4 py-2 flex items-center gap-2">
        <button
          onClick={() => setView('code')}
          className={`px-3 py-1 rounded flex items-center gap-2 ${
            view === 'code' ? 'bg-white shadow' : 'hover:bg-gray-200'
          }`}
        >
          <Code size={16} />
          Code
        </button>
        <button
          onClick={() => setView('preview')}
          className={`px-3 py-1 rounded flex items-center gap-2 ${
            view === 'preview' ? 'bg-white shadow' : 'hover:bg-gray-200'
          }`}
        >
          <Eye size={16} />
          Preview
        </button>
        <div className="flex-1" />
        <button
          onClick={handleDownloadLaTeX}
          className="px-3 py-1 rounded hover:bg-gray-200 flex items-center gap-2"
        >
          <Download size={16} />
          Download .tex
        </button>
        <button
          onClick={handleCompileToPDF}
          disabled={isCompiling}
          className="px-3 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2"
        >
          <Download size={16} />
          {isCompiling ? 'Compiling...' : 'Compile to PDF'}
        </button>
      </div>

      {/* Content */}
      <div className="p-4 max-h-96 overflow-auto">
        {view === 'code' ? (
          <pre className="text-sm bg-gray-50 p-4 rounded overflow-x-auto">
            <code>{latexCode}</code>
          </pre>
        ) : (
          <div className="prose max-w-none">
            <p className="text-gray-500 italic">
              Preview coming soon. Download the .tex file or compile to PDF to view.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
// components/tools-debug.tsx - For testing MCP tools integration
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

export function ToolsDebug() {
  const [tools, setTools] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchTools();
  }, []);

  const fetchTools = async () => {
    try {
      setIsLoading(true);
      const baseUrl = process.env.NEXT_PUBLIC_OPENWEBUI_URL || 'http://localhost:3000';
      const apiKey = process.env.NEXT_PUBLIC_OPENWEBUI_API_KEY || '';
      
      console.log('🔍 Fetching from:', `${baseUrl}/api/v1/tools`);
      
      const response = await fetch(`${baseUrl}/api/v1/tools`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to fetch tools:', response.status, errorText);
        return;
      }

      const data = await response.json();
      console.log('📦 Raw response:', data);
      
      // Handle different response formats
      const toolsList = Array.isArray(data) ? data : (data.tools || []);
      setTools(toolsList);
      console.log('🔧 Available tools:', toolsList);
    } catch (error) {
      console.error('Error fetching tools:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 p-4 bg-card border rounded-lg shadow-lg max-w-md">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-sm">MCP Tools Debug</h3>
        <Button size="sm" variant="outline" onClick={fetchTools}>
          Refresh
        </Button>
      </div>
      
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading tools...</p>
      ) : tools.length === 0 ? (
        <div className="text-xs space-y-1">
          <p className="text-yellow-600 dark:text-yellow-400">
            ⚠️ No tools found
          </p>
          <p className="text-muted-foreground">
            Make sure:
            <br />• MCP servers are connected in OpenWebUI
            <br />• Tools are enabled
            <br />• API key has correct permissions
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          <p className="text-xs text-green-600 dark:text-green-400">
            ✅ Found {tools.length} tool(s)
          </p>
          {tools.map((tool, i) => (
            <div key={i} className="text-xs p-2 bg-muted rounded space-y-1">
              <div className="font-medium">
                {tool.name || tool.openapi?.info?.title || tool.id || 'Unknown'}
              </div>
              <div className="text-muted-foreground text-[10px]">
                Type: {tool.type || 'unknown'}
                {tool.url && <> • URL: {tool.url}</>}
              </div>
              {tool.enabled !== undefined && (
                <div className={`text-[10px] ${tool.enabled ? 'text-green-600' : 'text-red-600'}`}>
                  {tool.enabled ? '✓ Enabled' : '✗ Disabled'}
                </div>
              )}
              {(tool.specs?.specs || tool.tools || tool.specs)?.length > 0 && (
                <div className="ml-2 space-y-0.5 mt-1 border-l-2 pl-2">
                  {(tool.specs?.specs || tool.tools || tool.specs).map((spec: any, j: number) => (
                    <div key={j} className="text-[10px] text-muted-foreground">
                      • {spec.name || spec.operationId}: {spec.description || 'No description'}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Usage: Add this to your main layout or assistant component temporarily
// import { ToolsDebug } from '@/components/tools-debug';
// <ToolsDebug />
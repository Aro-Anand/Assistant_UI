// lib/openwebui-adapter.ts - FINAL VERSION WITH COMPLETE MCP SUPPORT
import type { ChatModelAdapter } from "@assistant-ui/react";
import { OPENWEBUI_CONFIG } from './openwebui-config';

interface ToolServer {
  url: string;
  openapi: any;
  info?: any;
  specs: any[];
}

export class OpenWebUIAdapter implements ChatModelAdapter {
  private fileIds: Set<string> = new Set();
  private toolServers: ToolServer[] = [];
  private toolsLoaded: boolean = false;

  constructor(private apiEndpoint: string) {
    this.run = this.run.bind(this);
    console.log('✅ OpenWebUIAdapter initialized');
    
    // Fetch tools immediately
    this.initializeTools();
  }

  // Initialize tools with retry logic
  private async initializeTools() {
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts && !this.toolsLoaded) {
      attempts++;
      console.log(`🔄 Fetching tools (attempt ${attempts}/${maxAttempts})...`);
      
      const success = await this.fetchToolServers();
      if (success) {
        this.toolsLoaded = true;
        return;
      }
      
      // Wait before retry
      if (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    if (!this.toolsLoaded) {
      console.warn('⚠️ Could not load tools after', maxAttempts, 'attempts');
    }
  }

  // Fetch tool servers from OpenWebUI
  private async fetchToolServers(): Promise<boolean> {
    try {
      console.log('🔍 Fetching tools from:', `${OPENWEBUI_CONFIG.baseUrl}/api/v1/tools`);
      
      const response = await fetch(`${OPENWEBUI_CONFIG.baseUrl}/api/v1/tools`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${OPENWEBUI_CONFIG.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.error('❌ Tool fetch failed:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('Error response:', errorText.substring(0, 200));
        return false;
      }

      const data = await response.json();
      console.log('📦 Tools API response:', data);

      // Handle different response formats from OpenWebUI
      let toolsList: any[] = [];
      
      if (Array.isArray(data)) {
        toolsList = data;
      } else if (data.data && Array.isArray(data.data)) {
        toolsList = data.data;
      } else if (data.tools && Array.isArray(data.tools)) {
        toolsList = data.tools;
      } else {
        console.warn('⚠️ Unexpected tools response format:', Object.keys(data));
        return false;
      }

      console.log('🔧 Processing', toolsList.length, 'tools');

      // Process each tool
      this.toolServers = toolsList
        .filter((tool: any) => {
          // Only include enabled tools with MCP type
          if (tool.enabled === false) {
            console.log('⏭️ Skipping disabled tool:', tool.id);
            return false;
          }
          return true;
        })
        .map((tool: any) => {
          console.log('📋 Processing tool:', {
            id: tool.id,
            name: tool.name,
            type: tool.type,
            hasUrl: !!tool.url,
            hasSpecs: !!(tool.specs || tool.tools || tool.openapi)
          });

          // Build tool server object in the format OpenWebUI expects
          const toolServer: ToolServer = {
            url: tool.url || tool.server_url || `http://localhost:${tool.port || 8000}`,
            openapi: tool.openapi || tool.specs?.openapi || {},
            info: tool.specs?.info || tool.openapi?.info || {
              title: tool.name || 'Unknown Tool',
              description: tool.description || '',
            },
            specs: [],
          };

          // Extract tool specs from various possible locations
          if (tool.specs?.specs && Array.isArray(tool.specs.specs)) {
            toolServer.specs = tool.specs.specs;
          } else if (tool.tools && Array.isArray(tool.tools)) {
            toolServer.specs = tool.tools;
          } else if (tool.specs && Array.isArray(tool.specs)) {
            toolServer.specs = tool.specs;
          } else if (tool.openapi?.paths) {
            // Extract specs from OpenAPI paths
            toolServer.specs = this.extractSpecsFromOpenAPI(tool.openapi);
          }

          return toolServer;
        })
        .filter((ts: ToolServer) => ts.url && ts.specs.length > 0);

      console.log('✅ Loaded', this.toolServers.length, 'tool server(s)');
      
      if (this.toolServers.length > 0) {
        this.toolServers.forEach((ts, i) => {
          console.log(`🔧 Tool Server ${i + 1}:`, {
            url: ts.url,
            title: ts.info?.title || ts.openapi?.info?.title,
            toolCount: ts.specs.length,
            tools: ts.specs.map(s => s.name).slice(0, 5),
          });
        });
      }

      return this.toolServers.length > 0;
    } catch (error) {
      console.error('⚠️ Failed to fetch tool servers:', error);
      return false;
    }
  }

  // Extract tool specs from OpenAPI specification
  private extractSpecsFromOpenAPI(openapi: any): any[] {
    const specs: any[] = [];
    
    if (!openapi?.paths) return specs;

    Object.entries(openapi.paths).forEach(([path, pathItem]: [string, any]) => {
      Object.entries(pathItem).forEach(([method, operation]: [string, any]) => {
        if (method === 'parameters') return; // Skip parameters
        
        specs.push({
          name: operation.operationId || `${method}_${path.replace(/\//g, '_')}`,
          description: operation.description || operation.summary || '',
          parameters: operation.requestBody?.content?.['application/json']?.schema || 
                     operation.parameters || {},
        });
      });
    });

    return specs;
  }

  // Method to add file IDs
  addFileIds(ids: string[]) {
    ids.forEach(id => this.fileIds.add(id));
    console.log('📎 File IDs added:', Array.from(this.fileIds));
  }

  // Clear file IDs after message sent
  clearFileIds() {
    console.log('🗑️ Clearing file IDs');
    this.fileIds.clear();
  }

  // Get current file IDs
  getFileIds(): string[] {
    return Array.from(this.fileIds);
  }

  // Get tool servers
  getToolServers(): ToolServer[] {
    return this.toolServers;
  }

  async *run({ messages, abortSignal }: { messages: any[]; abortSignal: AbortSignal }) {
    // Wait for tools to load (with timeout)
    const startTime = Date.now();
    while (!this.toolsLoaded && Date.now() - startTime < 5000) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const currentFileIds = this.getFileIds();
    const toolServers = this.getToolServers();
    
    console.log('🚀 OpenWebUIAdapter.run()');
    console.log('📨 Messages:', messages.length);
    console.log('📎 Files:', currentFileIds.length);
    console.log('🔧 Tools:', toolServers.length);

    try {
      // Normalize messages
      const normalizedMessages = messages.map(msg => {
        let content = '';
        
        if (typeof msg.content === 'string') {
          content = msg.content;
        } else if (Array.isArray(msg.content)) {
          content = msg.content
            .filter((p: any) => p.type === 'text')
            .map((p: any) => p.text || '')
            .join('');
        } else if (Array.isArray(msg.parts)) {
          content = msg.parts
            .filter((p: any) => p.type === 'text')
            .map((p: any) => p.text || '')
            .join('');
        }
        
        return {
          role: msg.role,
          content: content.trim(),
        };
      });

      // Build request payload
      const requestBody: any = { 
        messages: normalizedMessages,
      };

      // Add file IDs if present
      if (currentFileIds.length > 0) {
        requestBody.fileIds = currentFileIds;
      }

      // CRITICAL: Add tool_servers for MCP support
      if (toolServers.length > 0) {
        requestBody.tool_servers = toolServers;
        console.log('🔧 Including', toolServers.length, 'tool server(s) in request');
      } else {
        console.warn('⚠️ No tools available for this request');
      }

      console.log('📤 Request summary:', {
        messagesCount: normalizedMessages.length,
        fileIdsCount: currentFileIds.length,
        toolServersCount: toolServers.length,
        lastMessage: normalizedMessages[normalizedMessages.length - 1]?.content?.substring(0, 100),
      });

      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: abortSignal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API error:', errorText);
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let buffer = '';
      let accumulatedText = '';
      let chunkCount = 0;
      let toolCallsDetected = 0;

      console.log('📡 Reading stream...');

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          console.log('✅ Stream completed');
          console.log('📝 Total text:', accumulatedText.length, 'chars');
          console.log('📦 Chunks:', chunkCount);
          console.log('🔧 Tool calls:', toolCallsDetected);
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) continue;

          try {
            let content: string | undefined;

            if (trimmedLine.startsWith('data: ')) {
              const data = trimmedLine.slice(6);
              if (data === '[DONE]') {
                console.log('🏁 [DONE]');
                continue;
              }

              const parsed = JSON.parse(data);
              
              // Handle text-delta
              if (parsed.type === 'text-delta' && parsed.delta) {
                content = parsed.delta;
              }
              // Handle tool calls
              else if (parsed.choices?.[0]?.delta?.tool_calls) {
                toolCallsDetected++;
                console.log('🔧 Tool call detected:', parsed.choices[0].delta.tool_calls);
              }
            }

            if (content) {
              chunkCount++;
              accumulatedText += content;
              
              if (chunkCount <= 3) {
                console.log(`📦 Chunk ${chunkCount}:`, content.substring(0, 50));
              }
              
              yield {
                content: [
                  {
                    type: "text" as const,
                    text: accumulatedText,
                  }
                ],
              };
            }
          } catch (e) {
            console.error('⚠️ Parse error:', e);
          }
        }
      }

      reader.releaseLock();
      
      // Clear file IDs after completion
      if (currentFileIds.length > 0) {
        this.clearFileIds();
      }
      
    } catch (error) {
      console.error('❌ Adapter error:', error);
      throw error;
    }
  }

  // Manual refresh of tools
  async refreshTools(): Promise<boolean> {
    console.log('🔄 Manually refreshing tools...');
    this.toolsLoaded = false;
    this.toolServers = [];
    return await this.fetchToolServers();
  }
}
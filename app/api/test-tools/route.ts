// app/api/test-tools/route.ts - Test endpoint to debug tool fetching
import { NextRequest, NextResponse } from 'next/server';
import { OPENWEBUI_CONFIG } from '@/lib/openwebui-config';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    console.log('🧪 Testing tools API...');
    console.log('📍 Base URL:', OPENWEBUI_CONFIG.baseUrl);
    
    // Test different endpoints
    const endpoints = [
      '/api/v1/tools',
      '/api/tools', 
      '/api/v1/tools/list',
    ];
    
    const results: any = {};
    
    for (const endpoint of endpoints) {
      const url = `${OPENWEBUI_CONFIG.baseUrl}${endpoint}`;
      console.log(`\n🔍 Testing: ${url}`);
      
      try {
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${OPENWEBUI_CONFIG.apiKey}`,
            'Content-Type': 'application/json',
          },
        });
        
        console.log(`Status: ${response.status}`);
        
        if (response.ok) {
          const data = await response.json();
          results[endpoint] = {
            success: true,
            status: response.status,
            data: data,
          };
          console.log(`✅ Success:`, data);
        } else {
          const errorText = await response.text();
          results[endpoint] = {
            success: false,
            status: response.status,
            error: errorText,
          };
          console.log(`❌ Failed:`, errorText);
        }
      } catch (error) {
        results[endpoint] = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
        console.log(`❌ Error:`, error);
      }
    }
    
    // Also test the models endpoint to verify auth is working
    try {
      const modelsUrl = `${OPENWEBUI_CONFIG.baseUrl}/api/models`;
      const modelsResponse = await fetch(modelsUrl, {
        headers: {
          'Authorization': `Bearer ${OPENWEBUI_CONFIG.apiKey}`,
        },
      });
      
      if (modelsResponse.ok) {
        results.models = {
          success: true,
          message: 'Auth is working - models endpoint accessible',
        };
      }
    } catch (e) {
      // Ignore
    }
    
    return NextResponse.json({
      config: {
        baseUrl: OPENWEBUI_CONFIG.baseUrl,
        hasApiKey: !!OPENWEBUI_CONFIG.apiKey,
      },
      results,
    }, { status: 200 });
    
  } catch (error) {
    console.error('❌ Test error:', error);
    return NextResponse.json({
      error: 'Test failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

// Usage: Visit http://localhost:3001/api/test-tools in your browser
// This will show you exactly what endpoints work and what data structure is returned
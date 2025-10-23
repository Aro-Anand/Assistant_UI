// Test script to verify the streaming fix
const testStreamingFix = async () => {
    console.log('🧪 Testing streaming fix...');

    try {
        const response = await fetch('http://localhost:3001/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messages: [
                    {
                        id: 'test-streaming',
                        role: 'user',
                        parts: [
                            {
                                type: 'text',
                                text: 'Test streaming with a longer message to ensure proper handling of multiple chunks'
                            }
                        ]
                    }
                ]
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        console.log('✅ API request successful');

        // Test streaming
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let chunkCount = 0;
        let hasError = false;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            chunkCount++;

            // Check for error patterns in the chunk
            if (chunk.includes('Controller is already closed') || chunk.includes('ERR_INVALID_STATE')) {
                hasError = true;
                console.error('❌ Found controller error in chunk:', chunk);
            }

            // Log first few chunks for verification
            if (chunkCount <= 3) {
                console.log(`Chunk ${chunkCount}:`, chunk.substring(0, 100) + (chunk.length > 100 ? '...' : ''));
            }
        }

        if (hasError) {
            console.error('❌ Test failed: Controller errors detected');
        } else {
            console.log(`✅ Test passed: ${chunkCount} chunks processed without errors`);
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
};

// Run the test
testStreamingFix();

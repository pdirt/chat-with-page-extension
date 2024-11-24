chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Message received in background.js:', message);

  if (message.type === 'SCRAPED_CONTENT') {
    chrome.storage.local.get(['openaiApiKey'], async (result) => {
      const apiKey = result.openaiApiKey;

      if (!apiKey) {
        console.error('API Key is missing.');
        sendResponse({
          success: false,
          error: 'API Key is missing. Please provide it in the popup.',
        });
        return;
      }

      try {
        console.log('Sending scraped content and user message to GPT...');
        const gptResponse = await sendToGPT(
          apiKey,
          message.content,
          message.userMessage
        );
        console.log('GPT Response:', gptResponse);
        sendResponse({ success: true, gptResponse });
      } catch (error) {
        console.error('Error fetching GPT response:', error);
        sendResponse({ success: false, error: error.message });
      }
    });

    return true; // Indicates asynchronous response
  }

  sendResponse({ success: false, error: 'Unknown message type.' });
});

async function sendToGPT(apiKey, context, userMessage) {
  try {
    // Truncate context to avoid exceeding token limits
    const maxContextLength = 4096; // Half of the token limit for context
    if (context.length > maxContextLength) {
      console.warn('Truncating context to fit token limit.');
      context = context.slice(-maxContextLength); // Use the last part of the context
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `You are a helpful assistant. Context: ${context}`,
          },
          { role: 'user', content: userMessage },
        ],
        max_tokens: 300, // Limit tokens for the response
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenAI API Error Response:', errorData);
      throw new Error(
        errorData.error?.message || 'Unknown error occurred during the fetch.'
      );
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || 'No response received.';
  } catch (error) {
    console.error('Error during GPT API call:', error);
    throw error;
  }
}

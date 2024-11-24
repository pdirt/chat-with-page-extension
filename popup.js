let sessionId = null;

// Initialize session for tracking user interactions
function initializeSession() {
  sessionId = `session_${Date.now()}`;
  chrome.storage.local.set({ sessionId, [sessionId]: [] }, () => {
    console.log('New session initialized:', sessionId);
  });
}

// Save messages to the session
function saveMessageToSession(role, content) {
  if (!sessionId) {
    console.error('Session ID is not initialized.');
    return;
  }

  chrome.storage.local.get(sessionId, (result) => {
    const sessionLog = result[sessionId] || [];
    sessionLog.push({ role, content, timestamp: new Date().toISOString() });

    chrome.storage.local.set({ [sessionId]: sessionLog }, () => {
      console.log('Message saved to session:', { role, content });
    });
  });
}

// Retrieve and truncate chat history
function truncateChatHistory(callback) {
  if (!sessionId) {
    console.error('Session ID is not initialized.');
    return callback('');
  }

  chrome.storage.local.get([sessionId], (result) => {
    const sessionLog = result[sessionId] || [];
    const serializedChat = sessionLog
      .map((msg) => `${msg.role}: ${msg.content}`)
      .join('\n');

    // Limit chat history to 4096 characters
    const truncatedChat = serializedChat.slice(-4096);
    callback(truncatedChat);
  });
}

// Check if API key exists and toggle visibility of the input field
function checkApiKey() {
  chrome.storage.local.get('openaiApiKey', (result) => {
    const apiKeySection = document.getElementById('apiKeySection');
    const apiKeySavedMessage = document.getElementById('apiKeySavedMessage');

    if (result.openaiApiKey) {
      apiKeySection.classList.add('hidden');
      apiKeySavedMessage.classList.remove('hidden');
    } else {
      apiKeySection.classList.remove('hidden');
      apiKeySavedMessage.classList.add('hidden');
    }
  });
}

// Save the API key when the user enters it
document.getElementById('saveApiKey').addEventListener('click', () => {
  const apiKey = document.getElementById('apiKey').value.trim();
  if (!apiKey) {
    document.getElementById('error').innerText = 'API Key cannot be empty.';
    return;
  }

  chrome.storage.local.set({ openaiApiKey: apiKey }, () => {
    document.getElementById('error').innerText = '';
    checkApiKey(); // Update UI to reflect API key saved status
  });
});

// Initialize the session and check for API key on popup load
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(['sessionId'], (result) => {
    if (result.sessionId) {
      sessionId = result.sessionId; // Use existing session ID
      console.log('Existing session resumed:', sessionId);
    } else {
      initializeSession(); // Create a new session
    }
  });

  checkApiKey(); // Check API key status and update UI
});

// Handle the Reset Chat functionality
document.getElementById('reset').addEventListener('click', () => {
  chrome.storage.local.remove(sessionId, () => {
    console.log('Session cleared:', sessionId);
    initializeSession(); // Start a new session
  });

  document.getElementById('messages').innerHTML = ''; // Clear chat messages
  document.getElementById('error').innerText = ''; // Clear error messages
});

// Handle Send button functionality
document.getElementById('send').addEventListener('click', () => {
  const userMessage = document.getElementById('userInput').value.trim();
  if (!userMessage) return;

  addMessage(userMessage, true); // Display user message
  saveMessageToSession('user', userMessage); // Save user message to session
  document.getElementById('userInput').value = ''; // Clear input field

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabId = tabs[0]?.id;

    if (!tabId) {
      console.error('Failed to find active tab.');
      addMessage('Error: Unable to locate the active tab.', false);
      return;
    }

    chrome.scripting.executeScript(
      { target: { tabId }, files: ['content.js'] },
      () => {
        chrome.tabs.sendMessage(
          tabId,
          { type: 'SCRAPE_REQUEST' },
          (response) => {
            if (!response || !response.success) {
              console.error(
                'Scrape error:',
                response?.error || 'Unknown error'
              );
              addMessage(
                `Error: ${response?.error || 'Failed to scrape the page.'}`,
                false
              );
              return;
            }

            // Retrieve chat history and send to GPT
            truncateChatHistory((chatHistory) => {
              chrome.runtime.sendMessage(
                {
                  type: 'SCRAPED_CONTENT',
                  content: `${chatHistory}\n${response.content}`, // Combine chat history and context
                  userMessage,
                },
                (gptResponse) => {
                  if (gptResponse && gptResponse.gptResponse) {
                    addMessage(gptResponse.gptResponse, false); // Display GPT response
                  } else {
                    addMessage(
                      `Error: ${
                        gptResponse?.error ||
                        'Failed to fetch response from GPT.'
                      }`,
                      false
                    );
                  }
                }
              );
            });
          }
        );
      }
    );
  });
});

// Add a message to the chat display
function addMessage(content, isUser = false) {
  const messagesDiv = document.getElementById('messages');
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${isUser ? 'user' : 'bot'}`;
  messageDiv.innerText = content;
  messagesDiv.appendChild(messageDiv);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

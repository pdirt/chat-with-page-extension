if (!window.isScriptInjected) {
  console.log('Initializing content.js...');

  /**
   * Function to scrape content from the page
   */
  const scrapeContent = async () => {
    console.log('Scraping started...');
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const pageUrl = window.location.href; // Get the page URL
    const pageTitle = document.title; // Get the page title

    // Scrape meaningful text content from visible elements
    const mainContent = Array.from(
      document.querySelectorAll(
        'main, article, section, div, p, h1, h2, h3, ul, ol, li'
      )
    )
      .filter(
        (el) =>
          !el.closest("button, a, input, textarea, [role='button'], [onclick]")
      ) // Exclude interactive elements
      .map((el) => el.innerText.trim())
      .filter((text) => text.length > 30) // Filter out very short or empty elements
      .join('\n\n');

    console.log('Scraped content:', mainContent);

    if (!mainContent) {
      console.warn('No meaningful content found to scrape.');
      return {
        success: false,
        error: 'No meaningful content found on the page.',
      };
    }

    return {
      success: true,
      url: pageUrl || 'Unknown URL',
      title: pageTitle || 'Untitled Page',
      content: mainContent || 'No content found.',
    };
  };

  // Listener for messages from the popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SCRAPE_REQUEST') {
      scrapeContent()
        .then((result) => {
          console.log('Scraping result:', result);
          sendResponse(result);
        })
        .catch((error) => {
          console.error('Error during scraping:', error);
          sendResponse({ success: false, error: error.message });
        });

      return true; // Keep the message channel open for async response
    }
  });

  window.isScriptInjected = true;
}

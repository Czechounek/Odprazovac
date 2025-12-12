let dictionary = {};
let pageCount = 0;
let isEnabled = true;
let observer = null;

async function init() {
  const response = await fetch(chrome.runtime.getURL('dictionary.json'));
  dictionary = await response.json();
  
  const { enabled = true } = await chrome.storage.local.get(['enabled']);
  isEnabled = enabled;
  
  if (isEnabled) {
    replaceTextInPage();
    observePageChanges();
  }
}

function replaceTextInPage() {
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function(node) {
        if (node.parentElement.tagName === 'SCRIPT' || 
            node.parentElement.tagName === 'STYLE' ||
            node.parentElement.isContentEditable) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );
  
  const nodes = [];
  while (walker.nextNode()) {
    nodes.push(walker.currentNode);
  }
  
  let localCount = 0;
  nodes.forEach(node => {
    const originalText = node.nodeValue;
    const result = replaceWords(originalText);
    
    if (result.newText !== originalText) {
      node.nodeValue = result.newText;
      localCount += result.count;
    }
  });
  
  if (localCount > 0) {
    pageCount += localCount;
    chrome.runtime.sendMessage({ 
      action: 'incrementCounters', 
      count: localCount 
    });
  }
}

function replaceWords(text) {
  let replaced = text;
  let count = 0;
  
  for (const [colloquial, standard] of Object.entries(dictionary)) {
    const regex = new RegExp(`\\b${colloquial}\\b`, 'gi');
    replaced = replaced.replace(regex, (match) => {
      count++;
      if (match[0] === match[0].toUpperCase()) {
        return standard.charAt(0).toUpperCase() + standard.slice(1);
      }
      return standard;
    });
  }
  
  return { newText: replaced, count };
}

function observePageChanges() {
  if (observer) observer.disconnect();
  
  observer = new MutationObserver((mutations) => {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.TEXT_NODE) {
          const originalText = node.nodeValue;
          const result = replaceWords(originalText);
          if (result.newText !== originalText) {
            node.nodeValue = result.newText;
            pageCount += result.count;
            chrome.runtime.sendMessage({ 
              action: 'incrementCounters', 
              count: result.count 
            });
          }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          replaceTextInElement(node);
        }
      });
    });
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

function replaceTextInElement(element) {
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function(node) {
        if (node.parentElement.tagName === 'SCRIPT' || 
            node.parentElement.tagName === 'STYLE' ||
            node.parentElement.isContentEditable) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );
  
  let localCount = 0;
  while (walker.nextNode()) {
    const originalText = walker.currentNode.nodeValue;
    const result = replaceWords(originalText);
    
    if (result.newText !== originalText) {
      walker.currentNode.nodeValue = result.newText;
      localCount += result.count;
    }
  }
  
  if (localCount > 0) {
    pageCount += localCount;
    chrome.runtime.sendMessage({ 
      action: 'incrementCounters', 
      count: localCount 
    });
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getPageCount') {
    sendResponse(pageCount);
    return true;
  } else if (message.action === 'toggleExtension') {
    isEnabled = message.enabled;
    if (isEnabled) {
      pageCount = 0;
      replaceTextInPage();
      observePageChanges();
    } else {
      if (observer) observer.disconnect();
    }
  }
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

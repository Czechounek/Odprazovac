let dictionary = {};
let pageCount = 0;
let isEnabled = true;
let observer = null;
let toastTimeout = null;

async function init() {
  const response = await fetch(chrome.runtime.getURL('dictionary.json'));
  dictionary = await response.json();
  
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = chrome.runtime.getURL('toast.css');
  document.head.appendChild(link);

  const { enabled = true } = await chrome.storage.local.get(['enabled']);
  isEnabled = enabled;
  
  if (isEnabled) {
    replaceTextInPage();
    observePageChanges();
  }
}

function showToast(count) {
  const existingToast = document.querySelector('.odprazovac-toast');
  if (existingToast) {
    existingToast.remove();
  }
  
  if (toastTimeout) {
    clearTimeout(toastTimeout);
  }
  
  const toast = document.createElement('div');
  toast.className = 'odprazovac-toast';
  toast.innerHTML = `
    <div class="odprazovac-toast-icon">✨</div>
    <div class="odprazovac-toast-text">
      <div>Odpraženo!</div>
      <div class="odprazovac-toast-count">${count} ${count === 1 ? 'slovo' : count < 5 ? 'slova' : 'slov'} opraveno</div>
    </div>
  `;
  
  document.body.appendChild(toast);
  
  toastTimeout = setTimeout(() => {
    toast.classList.add('hiding');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
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
    showToast(localCount);
    chrome.runtime.sendMessage({ 
      action: 'incrementCounters', 
      count: localCount 
    });
  }
}

function replaceWords(text) {
  let replaced = text;
  let count = 0;
  
  for (const [colloquial, standard] of Object.entries(dictionary.replacements || {})) {
    const regex = new RegExp(`\\b${colloquial}\\b`, 'gi');
    replaced = replaced.replace(regex, (match) => {
      count++;
      if (match[0] === match[0].toUpperCase()) {
        return standard.charAt(0).toUpperCase() + standard.slice(1);
      }
      return standard;
    });
  }
  
  if (dictionary.patterns && dictionary.patterns.adj_ej_to_y) {
    const exceptions = new Set(
      (dictionary.exceptions?.adj_ej_endings || []).map(word => word.toLowerCase())
    );
    
    const ejPattern = /\b(\w+ej)\b/gi;
    replaced = replaced.replace(ejPattern, (match) => {
      const lowerMatch = match.toLowerCase();
      
      if (exceptions.has(lowerMatch)) {
        return match;
      }
      
      count++;
      const newWord = match.slice(0, -2) + 'ý';
      
      if (match[0] === match[0].toUpperCase()) {
        return newWord.charAt(0).toUpperCase() + newWord.slice(1);
      }
      return newWord;
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
            showToast(result.count);
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
    showToast(localCount);
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

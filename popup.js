document.addEventListener('DOMContentLoaded', async () => {
  const pageCounter = document.getElementById('pageCounter');
  const totalCounter = document.getElementById('totalCounter');
  const globalCounter = document.getElementById('globalCounter');
  const toggleButton = document.getElementById('toggleButton');
  const githubButton = document.getElementById('githubButton');
  const themeToggle = document.getElementById('themeToggle');
  const versionElement = document.getElementById('version');

  const manifest = chrome.runtime.getManifest();
  versionElement.textContent = manifest.version;

  const { theme = 'light' } = await chrome.storage.local.get(['theme']);
  document.body.setAttribute('data-theme', theme);

  const { enabled = true, totalCount = 0, globalCount = 0 } = await chrome.storage.local.get(['enabled', 'totalCount', 'globalCount']);

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const pageCount = await chrome.tabs.sendMessage(tab.id, { action: 'getPageCount' }).catch(() => 0);

  pageCounter.textContent = pageCount || 0;
  totalCounter.textContent = totalCount;
  globalCounter.textContent = globalCount;
  toggleButton.textContent = enabled ? 'Vypnout' : 'Zapnout';
  toggleButton.classList.toggle('disabled', !enabled);

  themeToggle.addEventListener('click', async () => {
    const currentTheme = document.body.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.body.setAttribute('data-theme', newTheme);
    await chrome.storage.local.set({ theme: newTheme });
  });

  toggleButton.addEventListener('click', async () => {
    const newState = !enabled;
    await chrome.storage.local.set({ enabled: newState });
    toggleButton.textContent = newState ? 'Vypnout' : 'Zapnout';
    toggleButton.classList.toggle('disabled', !newState);
    chrome.tabs.sendMessage(tab.id, { action: 'toggleExtension', enabled: newState });
  });

  githubButton.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://github.com/JirkaUlbricht' });
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'updateCounters') {
      pageCounter.textContent = message.pageCount;
      totalCounter.textContent = message.totalCount;
      globalCounter.textContent = message.globalCount;
    }
  });
});
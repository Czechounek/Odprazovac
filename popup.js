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

  await loadCounters();

  themeToggle.addEventListener('click', async () => {
    const currentTheme = document.body.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.body.setAttribute('data-theme', newTheme);
    await chrome.storage.local.set({ theme: newTheme });
  });

  toggleButton.addEventListener('click', async () => {
    const { enabled = true } = await chrome.storage.local.get(['enabled']);
    const newState = !enabled;
    await chrome.storage.local.set({ enabled: newState });
    toggleButton.textContent = newState ? 'Vypnout' : 'Zapnout';
    toggleButton.classList.toggle('disabled', !newState);
    
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.tabs.sendMessage(tab.id, { action: 'toggleExtension', enabled: newState }).catch(() => {});
  });

  githubButton.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://github.com/JirkaUlbricht' });
  });

  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
      if (changes.totalCount) {
        totalCounter.textContent = changes.totalCount.newValue || 0;
      }
      if (changes.globalCount) {
        globalCounter.textContent = changes.globalCount.newValue || 0;
      }
    }
  });

  async function loadCounters() {
    const { enabled = true, totalCount = 0, globalCount = 0 } = await chrome.storage.local.get(['enabled', 'totalCount', 'globalCount']);

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    let pageCount = 0;
    
    try {
      pageCount = await chrome.tabs.sendMessage(tab.id, { action: 'getPageCount' });
    } catch (error) {
      pageCount = 0;
    }

    pageCounter.textContent = pageCount || 0;
    totalCounter.textContent = totalCount;
    globalCounter.textContent = globalCount;
    toggleButton.textContent = enabled ? 'Vypnout' : 'Zapnout';
    toggleButton.classList.toggle('disabled', !enabled);
  }
});
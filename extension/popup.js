chrome.tabs.query({}, (tabs) => {
  const validTabs = tabs.filter(
    (tab) =>
      tab.url &&
      !tab.url.startsWith('chrome://') &&
      !tab.url.startsWith('chrome-extension://') &&
      !tab.url.startsWith('about:') &&
      !tab.url.startsWith('edge://')
  );

  const countEl = document.getElementById('count');
  const importBtn = document.getElementById('import-btn');
  const progressEl = document.getElementById('progress');

  countEl.textContent = validTabs.length + ' tab' + (validTabs.length !== 1 ? 's' : '') + ' detected';

  if (validTabs.length > 0) {
    importBtn.disabled = false;
  }

  importBtn.addEventListener('click', () => {
    importBtn.disabled = true;
    progressEl.textContent = 'Opening Wick…';

    const urls = validTabs.map((t) => t.url).join('|');
    const wickUrl = 'https://wick-delta.vercel.app?import=' + encodeURIComponent(urls);

    chrome.tabs.create({ url: wickUrl });
    window.close();
  });

  document.getElementById('open-btn').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://wick-delta.vercel.app' });
    window.close();
  });
});

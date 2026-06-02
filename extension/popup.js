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

  countEl.textContent =
    validTabs.length + ' tab' + (validTabs.length !== 1 ? 's' : '') + ' detected';

  if (validTabs.length > 0) {
    importBtn.disabled = false;
  }

  importBtn.addEventListener('click', () => {
    importBtn.disabled = true;
    importBtn.innerHTML = '<span class="spinner"></span> Importing tabs…';

    const urls = validTabs.map((t) => t.url).join('|');
    const wickUrl =
      'https://wick-delta.vercel.app?import=' + encodeURIComponent(urls);

    chrome.tabs.create({ url: wickUrl });

    // Show success state then auto-close
    setTimeout(() => {
      importBtn.innerHTML = '✓ Tabs sent to Wick';
      importBtn.classList.add('success');
      progressEl.textContent = 'Closing in 3 seconds…';

      let remaining = 3;
      const interval = setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
          clearInterval(interval);
          window.close();
        } else {
          progressEl.textContent = 'Closing in ' + remaining + ' second' + (remaining !== 1 ? 's' : '') + '…';
        }
      }, 1000);
    }, 600);
  });

  document.getElementById('open-btn').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://wick-delta.vercel.app' });
    window.close();
  });
});

function checker(details) {
  const isGitUrl = details.url.match(/(\/\/git)(?=.*pull)(?=.*files)/);
  if (isGitUrl) {
    const urlConstructed = new URL(details.url);
    const isHidingWhitespace = !!urlConstructed.searchParams.get("w");

    if (!isHidingWhitespace) {
      urlConstructed.searchParams.set("w", "1");
      chrome.tabs.update({
        url: urlConstructed.toString(),
      });
    }
  }
}

chrome.webNavigation.onBeforeNavigate.addListener(checker);
chrome.webNavigation.onHistoryStateUpdated.addListener(checker);

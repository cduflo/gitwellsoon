let shouldHideWhitespace = true;

const isGitPRUrl = (url) => {
  return !!url.match(
    /(\/\/git)((?=.*pull)(?=.*files)|(?=.*compare)|(?=.*commit))/
  );
};

const isGithubUrl = (url) => {
  return !!url.match(/\/\/github.com/);
};

const isGitEnterpriseUrl = (url) => {
  return !!url.match(/\/\/git\./);
};

const setWhitespaceQueryParam = (url, constructedUrl) => {
  constructedUrl.searchParams.set("w", shouldHideWhitespace ? "1" : "0");

  if (isGitEnterpriseUrl(url)) {
    chrome.tabs.update({
      url: constructedUrl.toString(),
    });
  } else if (isGithubUrl(url)) {
    chrome.tabs.query({ currentWindow: true, active: true }).then((tab) => {
      chrome.scripting.executeScript({
        target: { tabId: tab[0].id },
        function: (stringifiedSearchParams) => {
          window.history.replaceState("", "", `?${stringifiedSearchParams}`);
          window.location.reload();
        },
        args: [constructedUrl.searchParams.toString()],
      });
    });
  }
};

const resetUserOverride = () => {
  shouldHideWhitespace = true;
};

const handlePageLoad = ({ url }) => {
  if (isGitPRUrl(url)) {
    const constructedUrl = new URL(url);
    const isHidingWhitespace = constructedUrl.searchParams.get("w");

    if (isHidingWhitespace === null) {
      setWhitespaceQueryParam(url, constructedUrl);
    }

    if (isHidingWhitespace === "0") {
      resetUserOverride();
    }
  }
};

const setShouldHideWhitespace = (request) => {
  shouldHideWhitespace = request.hideWhitespace;
};

chrome.runtime.onMessage.addListener(setShouldHideWhitespace);
chrome.history.onVisited.addListener(handlePageLoad);

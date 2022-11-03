window.onload = () => {
  document
    .querySelector("input[name='w'][type='checkbox']")
    .addEventListener("click", (e) => {
      chrome.runtime.sendMessage({ hideWhitespace: e.target.checked });
    });
};

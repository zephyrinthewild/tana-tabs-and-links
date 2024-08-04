/* 
  background.js is the web worker code, which is basically "faceless" from a
  browser tab perspective.

  From here we execute the content.js script against the active tab when the 
  extension is invoked.
*/

chrome.action.onClicked.addListener(async (tab) => {
  console.log("got click");
  await chrome.scripting.executeScript(
    {
      target: { tabId: tab.id },
      files: ["content.js"],
    }
  );
  // Update badge text to a tick
  chrome.action.setBadgeText({ text: "✔️" });

  // Optionally set badge background color (if needed)
  chrome.action.setBadgeBackgroundColor({ color: "#000000" }); // Example color

  // Clear the badge after 2 seconds
  setTimeout(() => {
    chrome.action.setBadgeText({ text: "" }); // Clear badge text
    chrome.action.setBadgeBackgroundColor({ color: [0, 0, 0, 0] }); // Clear badge background color
  }, 2000); // 2000 milliseconds = 2 seconds
});

chrome.runtime.onInstalled.addListener(() => {
  console.log("Installed clip2tana");
  // mark our extension to say we're alive
  // chrome.action.setBadgeText({
  //   text: "WOKE",
  // });
   // Create a context menu item
   chrome.contextMenus.create({
    id: "clip2tanaContextMenu",
    title: "Open Tana URL from Clipboard",
    contexts: ["all"]
  });
});

// Object to store interval IDs for each tab
const activeTabIntervals = {};

// Define a function to periodically check and update tab title
function checkAndUpdateTabTitle(tabId) {
  // Check if an interval is already running for this tab
  if (activeTabIntervals[tabId]) {
    console.log(`Tab ${tabId} is already being tracked.`);
    return;
  }

  chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: () => {
      const intervalId = setInterval(() => {
        const titleElement = document.querySelector('.NodePanelHeader-module_breadcrumbsAndTitle__H0Jfe h1[class^="NodePanelHeaderTitle-module_heading__"] span.editable');
        if (titleElement) {
          const newTitle = titleElement.textContent.trim();
          document.title = newTitle; // Update the tab title
          console.log("Updated tab title:", newTitle);
        } else {
          console.log("Title element not found.");
        }
      }, 2000); // 2000 milliseconds = 2 seconds

      // Store the interval ID in the window object for access outside the injected script
      window.intervalId = intervalId;
    }
  }, (injectionResults) => {
    if (chrome.runtime.lastError) {
      console.error("Script execution failed:", chrome.runtime.lastError.message);
    } else {
      // Retrieve intervalId from the injected script
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: () => window.intervalId,
      }, (results) => {
        if (results && results[0]) {
          activeTabIntervals[tabId] = results[0].result; // Store interval ID
          console.log(`Tracking started for tab ${tabId}. Interval ID: ${results[0].result}`);
        }
      });
    }
  });
}

// Handle tab activation event with a delay
chrome.tabs.onActivated.addListener((activeInfo) => {
  setTimeout(() => {
    chrome.tabs.get(activeInfo.tabId, (tab) => {
      console.log("Tab activated:", tab);
      if (tab.url && tab.url.startsWith('https://app.tana.inc')) {
        console.log(`Activated tab ${tab.id} (${tab.title}) matches criteria.`);
        checkAndUpdateTabTitle(tab.id);
      } else {
        console.log(`Activated tab ${tab.id} (${tab.title}) does not match criteria yet.`);
      }
    });
  }, 4000); // Wait for 4 seconds before checking and updating
});

// Handle the context menu click
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "clip2tanaContextMenu") {
    // Use the content script to read the clipboard
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: readClipboardAndOpenTanaUrl
    });
  }
});

// Handle keyboard shortcut
chrome.commands.onCommand.addListener((command) => {
  if (command === "open-tana-url") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        func: readClipboardAndOpenTanaUrl
      });
    });
  }
});

function readClipboardAndOpenTanaUrl() {
  navigator.clipboard.readText().then(text => {
    const tanaUrlStart = "https://app.tana.inc?nodeid=";
    if (text.startsWith(tanaUrlStart)) {
      chrome.runtime.sendMessage({ action: "openUrl", url: text });
    } else {
      console.error("Clipboard content is not a valid Tana URL");
    }
  }).catch(err => {
    console.error("Failed to read clipboard content:", err);
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "openUrl") {
    // chrome.windows.create({ url: message.url });
    chrome.tabs.create({ url: message.url, active: true });
  }
});


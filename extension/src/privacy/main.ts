import "../styles/tokens.css";

const ver = document.getElementById("ver");
if (ver) ver.textContent = chrome.runtime.getManifest().version;

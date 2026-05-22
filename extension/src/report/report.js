(function () {
  const el = document.getElementById("content");
  const md = sessionStorage.getItem("bookmrkd_report");
  if (!md) {
    el.textContent = "No report data. Run analysis in the extension popup, then open Report again.";
    return;
  }
  el.classList.remove("empty");
  el.textContent = md;
})();

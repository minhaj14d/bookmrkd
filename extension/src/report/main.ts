import "../styles/tokens.css";

const pre = document.getElementById("content");
if (!pre) throw new Error("Missing #content");

const md = sessionStorage.getItem("bookmrkd_report");
if (!md) {
  pre.textContent = "No report data. Run analysis from Advanced settings first.";
  pre.classList.add("empty");
} else {
  pre.textContent = md;
  pre.classList.remove("empty");
}

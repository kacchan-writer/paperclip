const listPanel = document.getElementById("list-panel");
const detailPanel = document.getElementById("detail-panel");
const paperList = document.getElementById("paper-list");
const searchForm = document.getElementById("search-form");
const backButton = document.getElementById("back-to-list");
const detailTitle = document.getElementById("detail-title");
const detailMeta = document.getElementById("detail-meta");
const detailAbstract = document.getElementById("detail-abstract");
const detailSummary = document.getElementById("detail-summary");
const detailSummaryJa = document.getElementById("detail-summary-ja");
const pdfCanvas = document.getElementById("pdf-canvas");
const pdfPlaceholder = document.getElementById("pdf-placeholder");
const lastUpdated = document.getElementById("last-updated");

const pdfjsLib = window["pdfjs-dist/build/pdf"] || window.pdfjsLib;

if (pdfjsLib?.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
}

const fetchPapers = async (query = "") => {
  const response = await fetch(`/api/papers${query}`);
  return response.json();
};

const renderList = (papers, updatedAt) => {
  paperList.innerHTML = "";
  if (updatedAt && lastUpdated) {
    lastUpdated.textContent = `（最終更新: ${new Date(updatedAt).toLocaleString()}）`;
  }

  if (!papers.length) {
    paperList.innerHTML = "<p>該当する論文がありません。</p>";
    return;
  }

  papers.forEach((paper) => {
    const card = document.createElement("article");
    card.className = "paper-card";
    card.innerHTML = `
      <h3>${paper.title}</h3>
      <p>${paper.summary || paper.abstract}</p>
      <small>${paper.authors.join(", ")} · ${paper.category}</small>
      <small>公開日: ${paper.publishedAt}</small>
    `;
    card.addEventListener("click", () => showDetail(paper.id));
    paperList.appendChild(card);
  });
};

const showDetail = async (paperId) => {
  const response = await fetch(`/api/papers/${paperId}`);
  const paper = await response.json();

  detailTitle.textContent = paper.title;
  detailMeta.textContent = `${paper.authors.join(", ")} · ${paper.category} · ${paper.publishedAt}`;
  detailAbstract.textContent = paper.abstract;
  detailSummary.textContent = paper.summary || "要点がまだありません。";
  detailSummaryJa.textContent =
    paper.summaryJa || "日本語要約は未取得です（翻訳 API を設定してください）。";

  listPanel.hidden = true;
  detailPanel.hidden = false;

  await renderPdf(paper.pdfUrl);
};

const renderPdf = async (pdfUrl) => {
  pdfPlaceholder.style.display = "grid";
  const loadingTask = pdfjsLib.getDocument(pdfUrl);
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 1.2 });

  const context = pdfCanvas.getContext("2d");
  pdfCanvas.height = viewport.height;
  pdfCanvas.width = viewport.width;

  await page.render({ canvasContext: context, viewport }).promise;
  pdfPlaceholder.style.display = "none";
};

searchForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(searchForm);
  const query = new URLSearchParams(formData).toString();
  const result = await fetchPapers(`?${query}`);
  renderList(result.items, result.lastUpdated);
});

backButton.addEventListener("click", () => {
  detailPanel.hidden = true;
  listPanel.hidden = false;
});

(async () => {
  const result = await fetchPapers();
  renderList(result.items, result.lastUpdated);
})();

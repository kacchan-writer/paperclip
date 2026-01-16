const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const port = process.env.PORT || 3000;
const publicDir = path.join(__dirname, "public");

const papers = [
  {
    id: "paper-001",
    title: "Graph Neural Networks for Citation Analysis",
    abstract:
      "We explore graph neural networks to predict citation trajectories and discover related work.",
    authors: ["Aiko Tanaka", "Kenji Watanabe"],
    category: "Machine Learning",
    publishedAt: "2023-08-17",
    pdfUrl: "/sample.pdf"
  },
  {
    id: "paper-002",
    title: "Efficient Transformers for Long Documents",
    abstract:
      "This paper proposes a sparse attention mechanism for long document understanding.",
    authors: ["Maya Suzuki", "Sora Ito"],
    category: "Natural Language Processing",
    publishedAt: "2024-01-05",
    pdfUrl: "/sample.pdf"
  },
  {
    id: "paper-003",
    title: "Privacy-Preserving Federated Analytics",
    abstract:
      "We introduce differential privacy guarantees for federated analytics at scale.",
    authors: ["Ren Nakamura"],
    category: "Security",
    publishedAt: "2022-11-02",
    pdfUrl: "/sample.pdf"
  }
];

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".pdf": "application/pdf"
};

const sendJson = (res, statusCode, payload) => {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload, null, 2));
};

const serveStatic = (res, pathname) => {
  const filePath = path.join(publicDir, pathname === "/" ? "index.html" : pathname);

  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": contentTypes[ext] || "text/plain" });
    res.end(data);
  });
};

const filterPapers = (query) => {
  const keyword = (query.get("keyword") || "").toLowerCase();
  const category = (query.get("category") || "").toLowerCase();
  const author = (query.get("author") || "").toLowerCase();
  const publishedFrom = query.get("published_from") || "";
  const publishedTo = query.get("published_to") || "";

  return papers.filter((paper) => {
    const matchesKeyword =
      !keyword ||
      paper.title.toLowerCase().includes(keyword) ||
      paper.abstract.toLowerCase().includes(keyword);

    const matchesCategory =
      !category || paper.category.toLowerCase().includes(category);

    const matchesAuthor =
      !author || paper.authors.some((name) => name.toLowerCase().includes(author));

    const publishedDate = new Date(paper.publishedAt);
    const afterFrom = !publishedFrom || publishedDate >= new Date(publishedFrom);
    const beforeTo = !publishedTo || publishedDate <= new Date(publishedTo);

    return matchesKeyword && matchesCategory && matchesAuthor && afterFrom && beforeTo;
  });
};

const server = http.createServer((req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);

  if (requestUrl.pathname === "/api/papers" && req.method === "GET") {
    const filtered = filterPapers(requestUrl.searchParams);
    return sendJson(res, 200, { total: filtered.length, items: filtered });
  }

  if (requestUrl.pathname.startsWith("/api/papers/") && req.method === "GET") {
    const paperId = requestUrl.pathname.replace("/api/papers/", "");
    const paper = papers.find((item) => item.id === paperId);

    if (!paper) {
      return sendJson(res, 404, { message: "Paper not found" });
    }

    return sendJson(res, 200, paper);
  }

  return serveStatic(res, requestUrl.pathname);
});

server.listen(port, () => {
  console.log(`Paperclip server running at http://localhost:${port}`);
});

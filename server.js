const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const port = process.env.PORT || 3000;
const publicDir = path.join(__dirname, "public");

const samplePapers = [
  {
    id: "paper-001",
    title: "Graph Neural Networks for Citation Analysis",
    abstract:
      "We explore graph neural networks to predict citation trajectories and discover related work.",
    authors: ["Aiko Tanaka", "Kenji Watanabe"],
    category: "Machine Learning",
    publishedAt: "2023-08-17",
    pdfUrl: "/sample.pdf",
    summary:
      "We explore graph neural networks to predict citation trajectories and discover related work.",
    summaryJa: ""
  },
  {
    id: "paper-002",
    title: "Efficient Transformers for Long Documents",
    abstract:
      "This paper proposes a sparse attention mechanism for long document understanding.",
    authors: ["Maya Suzuki", "Sora Ito"],
    category: "Natural Language Processing",
    publishedAt: "2024-01-05",
    pdfUrl: "/sample.pdf",
    summary:
      "This paper proposes a sparse attention mechanism for long document understanding.",
    summaryJa: ""
  },
  {
    id: "paper-003",
    title: "Privacy-Preserving Federated Analytics",
    abstract:
      "We introduce differential privacy guarantees for federated analytics at scale.",
    authors: ["Ren Nakamura"],
    category: "Security",
    publishedAt: "2022-11-02",
    pdfUrl: "/sample.pdf",
    summary:
      "We introduce differential privacy guarantees for federated analytics at scale.",
    summaryJa: ""
  }
];

const dataDir = path.join(__dirname, "data");
const storePath = path.join(dataDir, "papers.json");
const defaultQuery = process.env.PAPERCLIP_DEFAULT_QUERY || "machine learning";
const refreshIntervalMinutes = Number(process.env.PAPERCLIP_REFRESH_MINUTES || 60);
const autoRefreshEnabled = process.env.PAPERCLIP_AUTO_REFRESH !== "false";

let refreshInProgress = false;
let paperStore = {
  lastUpdated: null,
  items: samplePapers
};

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

const ensureDataDir = () => {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
};

const loadStore = () => {
  try {
    if (!fs.existsSync(storePath)) {
      return;
    }
    const payload = JSON.parse(fs.readFileSync(storePath, "utf-8"));
    if (payload && Array.isArray(payload.items)) {
      paperStore = payload;
    }
  } catch (error) {
    console.error("Failed to load paper store:", error);
  }
};

const saveStore = () => {
  try {
    ensureDataDir();
    fs.writeFileSync(storePath, JSON.stringify(paperStore, null, 2), "utf-8");
  } catch (error) {
    console.error("Failed to save paper store:", error);
  }
};

const summarizeAbstract = (text) => {
  if (!text) return "";
  const sentences = text.split(/(?<=[.!?])\s+/);
  return sentences.slice(0, 2).join(" ");
};

const requestJson = (url, options = {}) =>
  new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on("error", reject);
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });

const translateText = async (text) => {
  const apiUrl = process.env.PAPERCLIP_TRANSLATE_URL;
  if (!apiUrl || !text) {
    return "";
  }
  try {
    const body = JSON.stringify({
      q: text,
      source: "en",
      target: "ja",
      format: "text",
      api_key: process.env.PAPERCLIP_TRANSLATE_KEY || undefined
    });
    const response = await requestJson(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body)
      },
      body
    });
    return response.translatedText || "";
  } catch (error) {
    console.warn("Translation failed:", error);
    return "";
  }
};

const normalizePaper = async (paper, index) => {
  const publishedAt =
    paper.publicationDate || (paper.year ? `${paper.year}-01-01` : "1970-01-01");
  const abstract = paper.abstract || "";
  const summary = summarizeAbstract(abstract);
  const summaryJa = await translateText(summary);
  return {
    id: paper.paperId || `semantic-${index}`,
    title: paper.title || "Untitled",
    abstract,
    authors: (paper.authors || []).map((author) => author.name),
    category: (paper.fieldsOfStudy || [])[0] || "General",
    publishedAt,
    pdfUrl: paper.openAccessPdf?.url || "",
    summary,
    summaryJa
  };
};

const fetchLatestPapers = async (query) => {
  const url = new URL("https://api.semanticscholar.org/graph/v1/paper/search");
  url.searchParams.set("query", query);
  url.searchParams.set("limit", "20");
  url.searchParams.set(
    "fields",
    [
      "title",
      "abstract",
      "authors",
      "year",
      "publicationDate",
      "fieldsOfStudy",
      "openAccessPdf"
    ].join(",")
  );
  const response = await requestJson(url);
  return response.data || [];
};

const refreshPapers = async (query = defaultQuery) => {
  if (refreshInProgress) {
    return paperStore;
  }
  refreshInProgress = true;
  try {
    const fetched = await fetchLatestPapers(query);
    const normalized = [];
    for (let i = 0; i < fetched.length; i += 1) {
      normalized.push(await normalizePaper(fetched[i], i));
    }
    const deduped = new Map();
    [...normalized, ...paperStore.items].forEach((item) => {
      if (item.id) {
        deduped.set(item.id, item);
      }
    });
    paperStore = {
      lastUpdated: new Date().toISOString(),
      items: Array.from(deduped.values())
    };
    saveStore();
  } catch (error) {
    console.error("Paper refresh failed:", error);
  } finally {
    refreshInProgress = false;
  }
  return paperStore;
};

const filterPapers = (query) => {
  const keyword = (query.get("keyword") || "").toLowerCase();
  const category = (query.get("category") || "").toLowerCase();
  const author = (query.get("author") || "").toLowerCase();
  const publishedFrom = query.get("published_from") || "";
  const publishedTo = query.get("published_to") || "";

  return paperStore.items.filter((paper) => {
    const matchesKeyword =
      !keyword ||
      paper.title.toLowerCase().includes(keyword) ||
      paper.abstract.toLowerCase().includes(keyword) ||
      (paper.summary || "").toLowerCase().includes(keyword) ||
      (paper.summaryJa || "").toLowerCase().includes(keyword);

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
    return sendJson(res, 200, {
      total: filtered.length,
      items: filtered,
      lastUpdated: paperStore.lastUpdated
    });
  }

  if (requestUrl.pathname.startsWith("/api/papers/") && req.method === "GET") {
    const paperId = requestUrl.pathname.replace("/api/papers/", "");
    const paper = paperStore.items.find((item) => item.id === paperId);

    if (!paper) {
      return sendJson(res, 404, { message: "Paper not found" });
    }

    return sendJson(res, 200, paper);
  }

  if (requestUrl.pathname === "/api/refresh" && req.method === "POST") {
    refreshPapers(requestUrl.searchParams.get("query") || defaultQuery)
      .then((store) => sendJson(res, 200, store))
      .catch((error) => {
        console.error(error);
        sendJson(res, 500, { message: "Failed to refresh papers." });
      });
    return;
  }

  return serveStatic(res, requestUrl.pathname);
});

loadStore();
if (autoRefreshEnabled) {
  refreshPapers(defaultQuery);
  if (Number.isFinite(refreshIntervalMinutes) && refreshIntervalMinutes > 0) {
    setInterval(() => {
      refreshPapers(defaultQuery);
    }, refreshIntervalMinutes * 60 * 1000);
  }
}

server.listen(port, () => {
  console.log(`Paperclip server running at http://localhost:${port}`);
});

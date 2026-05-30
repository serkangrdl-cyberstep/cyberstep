// ─── Helpers ──────────────────────────────────────────────────────────────────
function scoreColor(score) {
  if (score >= 80) return { hex: "#16a34a", bg: "rgba(22,163,74,0.15)", label: "İyi", risk: "Güvenli" };
  if (score >= 60) return { hex: "#ca8a04", bg: "rgba(202,138,4,0.15)", label: "B", risk: "Orta Risk" };
  if (score >= 40) return { hex: "#ea580c", bg: "rgba(234,88,12,0.15)", label: "C", risk: "Zayıf" };
  return { hex: "#dc2626", bg: "rgba(220,38,38,0.15)", label: "F", risk: "Kritik Risk" };
}

function gradeFromScore(score) {
  if (score >= 80) return "A";
  if (score >= 60) return "B";
  if (score >= 40) return "C";
  return "F";
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return `Son tarama: ${d.toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" })}`;
}

function show(id) { document.getElementById(id).style.display = ""; }
function hide(id) { document.getElementById(id).style.display = "none"; }

function makeBtn(text, href, cls) {
  const a = document.createElement("a");
  a.href = href;
  a.target = "_blank";
  a.className = `btn ${cls}`;
  a.textContent = text;
  return a;
}

// ─── Indicator builder ────────────────────────────────────────────────────────
function buildIndicators(summary, domain) {
  const items = [
    { label: "SPF", ok: summary.spf },
    { label: "DMARC", ok: summary.dmarc },
    { label: "SSL/TLS", ok: summary.ssl },
    { label: "Kara Liste", ok: !summary.blacklisted },
  ];
  const container = document.getElementById("indicators");
  container.innerHTML = "";
  for (const item of items) {
    const div = document.createElement("div");
    div.className = "ind";
    const dot = document.createElement("span");
    dot.className = `dot ${item.ok ? "ok" : "warn"}`;
    div.appendChild(dot);
    div.appendChild(document.createTextNode(item.label + ": " + (item.ok ? "Geçti" : "Başarısız")));
    container.appendChild(div);
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────────
chrome.runtime.sendMessage({ type: "GET_SCAN_URL" }, (scanBase) => {
  chrome.runtime.sendMessage({ type: "GET_TAB_SCORE" }, (data) => {
    hide("loading");

    if (!data || data.status === "system_page") {
      show("system-view");
      return;
    }

    const domain = data.domain ?? "—";
    document.getElementById("domain-chip").textContent = domain;

    if (data.status === "not_scanned") {
      document.getElementById("not-scanned-domain").textContent = domain;
      show("not-scanned-view");

      const btn = makeBtn("Bu Domaini Ücretsiz Tara →", `${scanBase}?domain=${encodeURIComponent(domain)}`, "btn-primary");
      document.getElementById("actions-not-scanned").appendChild(btn);
      return;
    }

    // Scanned
    const score = data.score;
    const col = scoreColor(score);

    // Score ring
    const ring = document.getElementById("score-ring");
    ring.style.setProperty("--score-color", col.hex);
    ring.style.setProperty("--score-color-bg", col.bg);
    document.getElementById("score-number").textContent = score;
    document.getElementById("score-number").style.color = col.hex;

    // Grade badge
    const badge = document.getElementById("grade-badge");
    badge.textContent = gradeFromScore(score);
    badge.style.color = col.hex;
    badge.style.background = col.bg;

    // Risk label
    document.getElementById("risk-label").textContent = col.risk;
    document.getElementById("scan-date").textContent = formatDate(data.lastScanAt);

    // Indicators
    if (data.summary) buildIndicators(data.summary, domain);

    // Actions
    const actionsEl = document.getElementById("actions-scanned");
    const reportUrl = `${scanBase.replace("/domain-tarama", "")}/domain-tarama?domain=${encodeURIComponent(domain)}`;
    actionsEl.appendChild(makeBtn("Tam Raporu Görüntüle →", reportUrl, "btn-primary"));
    actionsEl.appendChild(makeBtn("Yeni Tarama Başlat", `${scanBase}?domain=${encodeURIComponent(domain)}`, "btn-outline"));

    show("score-view");
  });
});

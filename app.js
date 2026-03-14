const API_BASE = "https://yc-oss.github.io/api";

// Translation cache and function for English -> Traditional Chinese
const _translationCache = {};

// Split text into chunks at sentence boundaries (for APIs with char limits)
function _splitTextChunks(text, maxLen) {
  if (text.length <= maxLen) return [text];
  const sentences = text.match(/[^.!?]+[.!?]+\s*/g) || [text];
  const chunks = [];
  let current = "";
  for (const s of sentences) {
    if (current.length + s.length > maxLen && current.length > 0) {
      chunks.push(current.trim());
      current = s;
    } else {
      current += s;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

// Try Google Translate API
async function _tryGoogleTranslate(text) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-TW&dt=t&q=${encodeURIComponent(text)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Google HTTP ${res.status}`);
  const data = await res.json();
  return data[0].map((seg) => seg[0]).join("");
}

// Try MyMemory API (supports CORS, 500 char limit per request)
async function _tryMyMemoryTranslate(text) {
  const chunks = _splitTextChunks(text, 480);
  const results = [];
  for (const chunk of chunks) {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}&langpair=en|zh-TW`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`MyMemory HTTP ${res.status}`);
    const data = await res.json();
    if (data.responseStatus === 200 && data.responseData?.translatedText) {
      results.push(data.responseData.translatedText);
    } else {
      throw new Error(`MyMemory error: ${data.responseStatus}`);
    }
  }
  return results.join("");
}

async function translateToZhTW(text) {
  if (!text || text.trim().length === 0) return text;
  // Skip if already contains mostly Chinese characters
  const chineseRatio = (text.match(/[\u4e00-\u9fff]/g) || []).length / text.length;
  if (chineseRatio > 0.3) return text;

  const cacheKey = text.trim();
  if (_translationCache[cacheKey]) return _translationCache[cacheKey];

  try {
    // Try Google Translate first, fallback to MyMemory
    let translated;
    try {
      translated = await _tryGoogleTranslate(cacheKey);
    } catch (e) {
      console.warn("Google Translate failed, trying MyMemory:", e.message);
      translated = await _tryMyMemoryTranslate(cacheKey);
    }
    _translationCache[cacheKey] = translated;
    return translated;
  } catch (e) {
    console.warn("All translation APIs failed:", e);
    return text;
  }
}

// Available batches (most recent first)
const BATCHES = [
  { id: "summer-2026", label: "S26", display: "2026 夏季批次 (S26)" },
  { id: "spring-2026", label: "X26", display: "2026 春季批次 (X26)" },
  { id: "winter-2026", label: "W26", display: "2026 冬季批次 (W26)" },
  { id: "fall-2025", label: "F25", display: "2025 秋季批次 (F25)" },
  { id: "summer-2025", label: "S25", display: "2025 夏季批次 (S25)" },
  { id: "spring-2025", label: "X25", display: "2025 春季批次 (X25)" },
  { id: "winter-2025", label: "W25", display: "2025 冬季批次 (W25)" },
  { id: "fall-2024", label: "F24", display: "2024 秋季批次 (F24)" },
  { id: "summer-2024", label: "S24", display: "2024 夏季批次 (S24)" },
  { id: "winter-2024", label: "W24", display: "2024 冬季批次 (W24)" },
];

// Auto-detect the best default batch based on current date
function getDefaultBatchIndex() {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  const year = now.getFullYear();

  // YC batch schedule (approximate):
  // Winter (W): Jan-Mar, Summer (S): Jun-Sep, Fall (F): Sep-Nov, Spring (X): Mar-May
  let targetLabel;
  if (month >= 1 && month <= 3) {
    targetLabel = `W${String(year).slice(2)}`;
  } else if (month >= 4 && month <= 5) {
    targetLabel = `X${String(year).slice(2)}`;
  } else if (month >= 6 && month <= 8) {
    targetLabel = `S${String(year).slice(2)}`;
  } else {
    targetLabel = `F${String(year).slice(2)}`;
  }

  const idx = BATCHES.findIndex((b) => b.label === targetLabel);
  return idx >= 0 ? idx : 0;
}

class YCMonitorApp {
  constructor() {
    this.companies = [];
    this.filteredCompanies = [];
    this.defaultBatchIndex = getDefaultBatchIndex();
    this.selectedBatches = new Set([BATCHES[this.defaultBatchIndex].id]);
    this.selectedIndustries = new Set(); // empty = "all"
    this.currentView = "list";
    this.searchQuery = "";
    this.favorites = this._loadFavorites();
    this.showFavoritesOnly = false;

    this.init();
  }

  init() {
    this._parseURL(); // Restore state from URL before loading
    this.setupBatchSelector();
    this.setupSearch();
    this.loadData();

    // Listen for back/forward navigation and modal close
    window.addEventListener("popstate", () => {
      // Close modal if open
      if (document.getElementById("modalOverlay").style.display !== "none") {
        this.closeModal();
        return;
      }
      this._parseURL();
      this.renderBatchChips();
      this._syncSearchInput();
      this.loadData();
    });
  }

  // ==================== URL State Sync ====================

  _updateURL() {
    const params = new URLSearchParams();

    // Batches
    const batchLabels = Array.from(this.selectedBatches).map((id) => {
      const b = BATCHES.find((b) => b.id === id);
      return b ? b.label : null;
    }).filter(Boolean);
    params.set("b", batchLabels.join(","));

    // Search
    if (this.searchQuery) {
      params.set("q", this.searchQuery);
    }

    // Industry filters
    if (this.selectedIndustries.size > 0) {
      params.set("ind", Array.from(this.selectedIndustries).join(","));
    }

    // View
    if (this.currentView !== "list") {
      params.set("v", this.currentView);
    }

    // Favorites filter
    if (this.showFavoritesOnly) {
      params.set("fav", "1");
    }

    const hash = "#" + params.toString();
    if (window.location.hash !== hash) {
      history.replaceState(null, "", hash);
    }
  }

  _parseURL() {
    const hash = window.location.hash.slice(1);
    if (!hash) return;

    const params = new URLSearchParams(hash);

    // Batches
    const bParam = params.get("b");
    if (bParam) {
      const labels = bParam.split(",").filter(Boolean);
      const ids = labels.map((label) => {
        const b = BATCHES.find((b) => b.label === label);
        return b ? b.id : null;
      }).filter(Boolean);
      if (ids.length > 0) {
        this.selectedBatches = new Set(ids);
      }
    }

    // Search
    const q = params.get("q");
    if (q) {
      this.searchQuery = q.toLowerCase();
    }

    // Industry filters
    const ind = params.get("ind");
    if (ind) {
      this.selectedIndustries = new Set(ind.split(",").filter(Boolean));
    }

    // View
    const v = params.get("v");
    if (v && ["list", "favorites", "trends", "about"].includes(v)) {
      this.currentView = v;
    }

    // Favorites filter
    if (params.get("fav") === "1") {
      this.showFavoritesOnly = true;
    }
  }

  _syncSearchInput() {
    const input = document.getElementById("searchInput");
    const clearBtn = document.getElementById("clearSearch");
    if (input) {
      input.value = this.searchQuery;
      clearBtn.style.display = this.searchQuery ? "block" : "none";
    }
  }

  // ==================== Favorites ====================

  _loadFavorites() {
    try {
      return new Set(JSON.parse(localStorage.getItem("yc_favorites") || "[]"));
    } catch {
      return new Set();
    }
  }

  _saveFavorites() {
    localStorage.setItem("yc_favorites", JSON.stringify(Array.from(this.favorites)));
  }

  _getCompanyId(company) {
    return company.slug || `${company.name}__${company.batch}`;
  }

  isFavorite(company) {
    return this.favorites.has(this._getCompanyId(company));
  }

  toggleFavorite(companyId, event) {
    if (event) {
      event.stopPropagation();
    }
    if (this.favorites.has(companyId)) {
      this.favorites.delete(companyId);
    } else {
      this.favorites.add(companyId);
    }
    this._saveFavorites();

    // Update the heart button that was clicked
    document.querySelectorAll(`.fav-btn[data-id="${companyId}"]`).forEach((btn) => {
      btn.classList.toggle("fav-active", this.favorites.has(companyId));
    });

    // Update favorites chip count
    this._updateFavChipCount();

    // If we're showing favorites only and just unfavorited, re-filter
    if (this.showFavoritesOnly) {
      this.applyFilters();
    }
  }

  _updateFavChipCount() {
    const chip = document.querySelector('.chip[data-industry="favorites"]');
    if (chip) {
      const count = chip.querySelector(".chip-count");
      if (count) {
        const favCount = this.companies.filter((c) => this.isFavorite(c)).length;
        count.textContent = favCount;
      }
    }
  }

  toggleFavoritesFilter() {
    this.showFavoritesOnly = !this.showFavoritesOnly;
    const chip = document.querySelector('.chip[data-industry="favorites"]');
    if (chip) {
      chip.classList.toggle("active", this.showFavoritesOnly);
    }
    this.applyFilters();
    this._updateURL();
  }

  setupBatchSelector() {
    this.renderBatchChips();
  }

  renderBatchChips() {
    const container = document.getElementById("batchChips");
    container.innerHTML = BATCHES.map((b) => {
      const active = this.selectedBatches.has(b.id) ? "active" : "";
      return `<button class="chip batch-chip ${active}" data-batch="${b.id}" onclick="app.toggleBatch('${b.id}')">${b.label}</button>`;
    }).join("");
  }

  toggleBatch(batchId) {
    if (this.selectedBatches.has(batchId)) {
      // Don't allow deselecting all
      if (this.selectedBatches.size <= 1) return;
      this.selectedBatches.delete(batchId);
    } else {
      this.selectedBatches.add(batchId);
    }
    this.renderBatchChips();
    this.selectedIndustries.clear();
    this.showFavoritesOnly = false;
    this.loadData();
    this._updateURL();
  }

  setupSearch() {
    const input = document.getElementById("searchInput");
    const clearBtn = document.getElementById("clearSearch");

    // Restore search from URL state
    if (this.searchQuery) {
      input.value = this.searchQuery;
      clearBtn.style.display = "block";
    }

    input.addEventListener("input", (e) => {
      this.searchQuery = e.target.value.trim().toLowerCase();
      clearBtn.style.display = this.searchQuery ? "block" : "none";
      this.applyFilters();
      this._updateURL();
    });

    clearBtn.addEventListener("click", () => {
      input.value = "";
      this.searchQuery = "";
      clearBtn.style.display = "none";
      this.applyFilters();
      this._updateURL();
    });
  }

  async loadData() {
    const loading = document.getElementById("loading");
    const error = document.getElementById("error");
    const companyList = document.getElementById("companyList");

    loading.style.display = "flex";
    error.style.display = "none";
    companyList.innerHTML = "";

    try {
      // Fetch all selected batches in parallel
      const batchIds = Array.from(this.selectedBatches);
      const results = await Promise.all(
        batchIds.map(async (batchId) => {
          const url = `${API_BASE}/batches/${batchId}.json`;
          const res = await fetch(url);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
      );
      this.companies = results.flat();

      this.updateStats();
      this.buildFilterChips();
      this.applyFilters();
      this._updateURL();

      // Restore view from URL if not list
      if (this.currentView !== "list") {
        this.switchView(this.currentView);
      }

      loading.style.display = "none";
    } catch (err) {
      console.error("Failed to load data:", err);
      loading.style.display = "none";
      error.style.display = "block";

      this.tryFallback();
    }
  }

  async tryFallback() {
    try {
      const url = `${API_BASE}/companies/all.json`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const all = await res.json();

      const selectedLabels = new Set(
        Array.from(this.selectedBatches).map((id) => {
          const b = BATCHES.find((b) => b.id === id);
          return b ? b.label : null;
        }).filter(Boolean)
      );

      this.companies = all.filter((c) => selectedLabels.has(c.batch));

      if (this.companies.length > 0) {
        document.getElementById("error").style.display = "none";
        this.updateStats();
        this.buildFilterChips();
        this.applyFilters();
      }
    } catch (e) {
      console.error("Fallback also failed:", e);
    }
  }

  updateStats() {
    document.getElementById("totalCount").textContent = this.companies.length;
    const labels = Array.from(this.selectedBatches).map((id) => {
      const b = BATCHES.find((b) => b.id === id);
      return b ? b.label : "";
    }).filter(Boolean);
    document.getElementById("batchName").textContent = labels.join(", ") || "-";
    document.getElementById("batchName").title = labels.join(", ");
    const now = new Date();
    const syncDate = `${now.getMonth() + 1}/${now.getDate()}`;
    const syncTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    document.getElementById("lastSync").textContent = `${syncDate} ${syncTime}`;
  }

  buildFilterChips() {
    const chips = document.getElementById("filterChips");
    const industryCount = {};

    this.companies.forEach((c) => {
      const industries = c.industries || [];
      if (industries.length === 0) {
        industryCount["Unspecified"] = (industryCount["Unspecified"] || 0) + 1;
      }
      industries.forEach((ind) => {
        industryCount[ind] = (industryCount[ind] || 0) + 1;
      });
    });

    const sorted = Object.entries(industryCount).sort((a, b) => b[1] - a[1]);
    this._allIndustries = sorted;
    this._chipsExpanded = false;

    this._renderChips(chips, sorted);
  }

  _renderChips(container, sorted) {
    const INITIAL_COUNT = 8;
    const showAll = this._chipsExpanded;
    const visible = showAll ? sorted : sorted.slice(0, INITIAL_COUNT);
    const hasMore = sorted.length > INITIAL_COUNT;

    const isAll = this.selectedIndustries.size === 0;
    const favCount = this.companies.filter((c) => this.isFavorite(c)).length;

    let html = `<button class="chip ${isAll && !this.showFavoritesOnly ? "active" : ""}" data-industry="all" onclick="app.filterByIndustry('all')">全部<span class="chip-count">${this.companies.length}</span></button>`;
    html += `<button class="chip fav-chip ${this.showFavoritesOnly ? "active" : ""}" data-industry="favorites" onclick="app.toggleFavoritesFilter()"><svg viewBox="0 0 24 24" width="12" height="12" style="margin-right:3px;vertical-align:-1px"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="currentColor"/></svg>收藏<span class="chip-count">${favCount}</span></button>`;

    visible.forEach(([ind, count]) => {
      const zh = translateIndustry(ind);
      const active = this.selectedIndustries.has(ind) ? "active" : "";
      html += `<button class="chip ${active}" data-industry="${ind}" onclick="app.filterByIndustry('${ind.replace(/'/g, "\\'")}')">${zh}<span class="chip-count">${count}</span></button>`;
    });

    if (hasMore) {
      const label = showAll ? "收起" : `+${sorted.length - INITIAL_COUNT} 更多`;
      html += `<button class="chip-toggle" onclick="app.toggleChips()">${label}</button>`;
    }

    container.innerHTML = html;
    container.classList.toggle("expanded", showAll);
  }

  toggleChips() {
    this._chipsExpanded = !this._chipsExpanded;
    const chips = document.getElementById("filterChips");
    this._renderChips(chips, this._allIndustries);
  }

  filterByIndustry(industry) {
    if (industry === "all") {
      this.selectedIndustries.clear();
      this.showFavoritesOnly = false;
    } else {
      if (this.selectedIndustries.has(industry)) {
        this.selectedIndustries.delete(industry);
      } else {
        this.selectedIndustries.add(industry);
      }
    }
    // Re-render chips to update active states
    const chips = document.getElementById("filterChips");
    this._renderChips(chips, this._allIndustries);
    this.applyFilters();
    this._updateURL();
  }

  applyFilters() {
    let result = [...this.companies];

    // Favorites filter
    if (this.showFavoritesOnly) {
      result = result.filter((c) => this.isFavorite(c));
    }

    // Industry filter (multi-select: show companies matching ANY selected industry)
    if (this.selectedIndustries.size > 0) {
      result = result.filter((c) => {
        const industries = c.industries || [];
        if (this.selectedIndustries.has("Unspecified")) {
          if (industries.length === 0) return true;
        }
        return industries.some((ind) => this.selectedIndustries.has(ind));
      });
    }

    // Search filter
    if (this.searchQuery) {
      result = result.filter((c) => {
        const searchable = [
          c.name,
          c.one_liner,
          c.long_description,
          ...(c.industries || []),
          ...(c.tags || []),
          c.batch,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return searchable.includes(this.searchQuery);
      });
    }

    this.filteredCompanies = result;
    this.renderCompanies();
    this.renderIndustrySummary();
  }

  renderCompanies() {
    const list = document.getElementById("companyList");
    const empty = document.getElementById("emptyState");

    if (this.currentView !== "list") {
      list.style.display = "none";
      return;
    }

    list.style.display = "";

    if (this.filteredCompanies.length === 0) {
      list.innerHTML = "";
      empty.style.display = "block";
      return;
    }

    empty.style.display = "none";

    list.innerHTML = this.filteredCompanies
      .map((company, i) => this.renderCard(company, i))
      .join("");

    // Translate card one_liners asynchronously
    this._translateCardOneLiners();
  }

  async _translateCardOneLiners() {
    const cards = document.querySelectorAll(".company-oneliner[data-translate]");
    // Translate in small batches to avoid overwhelming the API
    const batchSize = 5;
    for (let i = 0; i < cards.length; i += batchSize) {
      const batch = Array.from(cards).slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (el) => {
          const original = el.getAttribute("data-translate");
          if (!original) return;
          const translated = await translateToZhTW(original);
          el.textContent = translated;
        })
      );
    }
  }

  renderCard(company, index) {
    const name = this.escapeHtml(company.name || "Unknown");
    const oneLiner = this.escapeHtml(company.one_liner || "");
    const batch = company.batch || "";
    const batchZh = translateBatch(batch);
    const companyId = this._getCompanyId(company);
    const favActive = this.isFavorite(company) ? "fav-active" : "";

    // Limit to 2 industry tags + 2 general tags max
    const industries = (company.industries || [])
      .slice(0, 2)
      .map((i) => `<span class="tag tag-industry">${this.escapeHtml(translateIndustry(i))}</span>`)
      .join("");
    const tags = (company.tags || [])
      .slice(0, 2)
      .map((t) => `<span class="tag">${this.escapeHtml(translateIndustry(t))}</span>`)
      .join("");

    const initial = name.charAt(0).toUpperCase();
    const logoUrl = company.small_logo_thumb_url || "";
    const logoHtml = logoUrl
      ? `<img src="${logoUrl}" alt="${name}" onerror="this.parentElement.textContent='${initial}'">`
      : initial;

    return `
      <div class="company-card" onclick="app.showDetail(${index})">
        <div class="card-header">
          <div class="company-logo">${logoHtml}</div>
          <div class="card-title-area">
            <div class="company-name">${name}</div>
            <span class="company-batch">${this.escapeHtml(batchZh)}</span>
          </div>
          <button class="fav-btn ${favActive}" data-id="${this.escapeHtml(companyId)}" onclick="app.toggleFavorite('${companyId.replace(/'/g, "\\'")}', event)" title="收藏">
            <svg viewBox="0 0 24 24" width="18" height="18"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
          </button>
        </div>
        <div class="company-oneliner" data-translate="${this.escapeHtml(company.one_liner || "")}">${oneLiner}</div>
        <div class="card-tags">${industries}${tags}</div>
      </div>
    `;
  }

  renderIndustrySummary() {
    const container = document.getElementById("industrySummary");
    const chart = document.getElementById("industryChart");

    // Only show when no industry filter is active and there are companies
    if (this.currentView !== "list" || this.companies.length === 0 || this.selectedIndustries.size > 0 || this.searchQuery) {
      container.style.display = "none";
      return;
    }

    container.style.display = "block";

    const industryCount = {};
    this.companies.forEach((c) => {
      (c.industries || ["Unspecified"]).forEach((ind) => {
        industryCount[ind] = (industryCount[ind] || 0) + 1;
      });
    });

    const sorted = Object.entries(industryCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const max = sorted[0]?.[1] || 1;

    chart.innerHTML = sorted
      .map(([ind, count]) => {
        const pct = (count / max) * 100;
        return `
          <div class="chart-row">
            <span class="chart-label">${this.escapeHtml(translateIndustry(ind))}</span>
            <div class="chart-bar-bg">
              <div class="chart-bar" style="width:${pct}%"></div>
            </div>
            <span class="chart-count">${count}</span>
          </div>
        `;
      })
      .join("");
  }

  showDetail(index) {
    const company = this.filteredCompanies[index];
    if (!company) return;

    const overlay = document.getElementById("modalOverlay");
    const content = document.getElementById("modalContent");

    const name = this.escapeHtml(company.name || "Unknown");
    const batchZh = translateBatch(company.batch);
    const oneLiner = company.one_liner || "無描述";
    const longDesc = company.long_description || company.one_liner || "暫無詳細描述";
    const website = company.website || "";
    const ycUrl = company.url || "";
    const teamSize = company.team_size || "未知";
    const status = translateStatus(company.status);
    const stage = translateStage(company.stage);
    const industries = (company.industries || [])
      .map((i) => translateIndustry(i))
      .join("、");
    const tags = (company.tags || [])
      .map((t) => translateIndustry(t))
      .join("、");
    const regions = (company.regions || []).join("、");

    const logoUrl = company.small_logo_thumb_url || "";
    const initial = name.charAt(0).toUpperCase();
    const logoHtml = logoUrl
      ? `<img src="${logoUrl}" alt="${name}" style="width:60px;height:60px;border-radius:14px;" onerror="this.style.display='none'">`
      : `<div style="width:60px;height:60px;border-radius:14px;background:#f0f0f5;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:bold;color:#666">${initial}</div>`;

    const translatingHint = '<span style="color:#999;font-size:12px"> 翻譯中...</span>';

    const companyId = this._getCompanyId(company);
    const favActive = this.isFavorite(company) ? "fav-active" : "";

    content.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
        ${logoHtml}
        <div style="flex:1">
          <div class="company-name">${name}</div>
          <span class="company-batch">${this.escapeHtml(batchZh)}</span>
        </div>
        <button class="fav-btn fav-btn-modal ${favActive}" data-id="${this.escapeHtml(companyId)}" onclick="app.toggleFavorite('${companyId.replace(/'/g, "\\'")}', event)" title="收藏">
          <svg viewBox="0 0 24 24" width="22" height="22"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
        </button>
      </div>

      <div class="modal-detail-row">
        <div class="modal-detail-label">簡介${translatingHint}</div>
        <div class="modal-detail-value" id="modal-oneliner">${this.escapeHtml(oneLiner)}</div>
      </div>

      <div class="modal-detail-row">
        <div class="modal-detail-label">詳細說明${translatingHint}</div>
        <div class="modal-detail-value" id="modal-longdesc">${this.escapeHtml(longDesc)}</div>
      </div>

      ${
        industries
          ? `<div class="modal-detail-row">
        <div class="modal-detail-label">產業領域</div>
        <div class="modal-detail-value">${this.escapeHtml(industries)}</div>
      </div>`
          : ""
      }

      ${
        tags
          ? `<div class="modal-detail-row">
        <div class="modal-detail-label">標籤</div>
        <div class="modal-detail-value">${this.escapeHtml(tags)}</div>
      </div>`
          : ""
      }

      <div class="modal-detail-row">
        <div class="modal-detail-label">團隊規模</div>
        <div class="modal-detail-value">${teamSize} 人</div>
      </div>

      <div class="modal-detail-row">
        <div class="modal-detail-label">狀態</div>
        <div class="modal-detail-value">${this.escapeHtml(status)}</div>
      </div>

      ${
        stage
          ? `<div class="modal-detail-row">
        <div class="modal-detail-label">階段</div>
        <div class="modal-detail-value">${this.escapeHtml(stage)}</div>
      </div>`
          : ""
      }

      ${
        regions
          ? `<div class="modal-detail-row">
        <div class="modal-detail-label">地區</div>
        <div class="modal-detail-value">${this.escapeHtml(regions)}</div>
      </div>`
          : ""
      }

      <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">
        ${
          website
            ? `<a href="${website}" target="_blank" rel="noopener" class="modal-link">前往官網</a>`
            : ""
        }
        ${
          ycUrl
            ? `<a href="${ycUrl}" target="_blank" rel="noopener" class="modal-link" style="background:#555">YC 頁面</a>`
            : ""
        }
      </div>
    `;

    overlay.style.display = "flex";
    document.body.style.overflow = "hidden";

    // Translate one_liner and long_description asynchronously
    this._translateModalTexts(oneLiner, longDesc);
  }

  async _translateModalTexts(oneLiner, longDesc) {
    const [translatedOneLiner, translatedLongDesc] = await Promise.all([
      translateToZhTW(oneLiner),
      translateToZhTW(longDesc),
    ]);

    const oneLinerEl = document.getElementById("modal-oneliner");
    const longDescEl = document.getElementById("modal-longdesc");

    if (oneLinerEl) {
      oneLinerEl.textContent = translatedOneLiner;
      // Remove translating hint from label
      const label = oneLinerEl.closest(".modal-detail-row")?.querySelector(".modal-detail-label");
      if (label) label.innerHTML = "簡介";
    }
    if (longDescEl) {
      longDescEl.textContent = translatedLongDesc;
      const label = longDescEl.closest(".modal-detail-row")?.querySelector(".modal-detail-label");
      if (label) label.innerHTML = "詳細說明";
    }
  }

  closeModal() {
    document.getElementById("modalOverlay").style.display = "none";
    document.body.style.overflow = "";
  }

  switchView(view) {
    this.currentView = view;
    this._updateURL();

    // Update nav buttons
    document.querySelectorAll(".nav-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.view === view);
    });

    const content = document.querySelector(".content");

    if (view === "list") {
      content.innerHTML = `
        <div class="loading" id="loading" style="display:none">
          <div class="spinner"></div>
          <p>正在同步 YC 最新資料...</p>
        </div>
        <div class="error" id="error" style="display:none">
          <p>無法載入資料，請稍後再試</p>
          <button onclick="app.loadData()">重新載入</button>
        </div>
        <div class="industry-summary" id="industrySummary" style="display:none">
          <h2>投資領域分布</h2>
          <div class="industry-chart" id="industryChart"></div>
        </div>
        <div class="company-list" id="companyList"></div>
        <div class="empty-state" id="emptyState" style="display:none">
          <p>找不到符合條件的新創公司</p>
        </div>
      `;
      this.applyFilters();
    } else if (view === "favorites") {
      this.renderFavorites(content);
    } else if (view === "trends") {
      this.renderTrends(content);
    } else if (view === "about") {
      this.renderAbout(content);
    }
  }

  renderFavorites(container) {
    const favCompanies = this.companies.filter((c) => this.isFavorite(c));

    if (favCompanies.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="display:block">
          <p style="font-size:40px;margin-bottom:12px">&#9825;</p>
          <p>還沒有收藏的公司</p>
          <p style="font-size:13px;color:var(--text-tertiary);margin-top:8px">在新創列表中點擊愛心即可收藏</p>
        </div>
      `;
      return;
    }

    // Store favorites in filteredCompanies so showDetail works
    this.filteredCompanies = favCompanies;

    container.innerHTML = `
      <div style="padding-top:8px">
        <h2 style="font-size:18px;font-weight:700;margin-bottom:16px">我的收藏 (${favCompanies.length})</h2>
      </div>
      <div class="company-list" id="companyList">
        ${favCompanies.map((company, i) => this.renderCard(company, i)).join("")}
      </div>
    `;

    this._translateCardOneLiners();
  }

  renderTrends(container) {
    if (this.companies.length === 0) {
      container.innerHTML = `<div class="empty-state"><p>請先載入批次資料</p></div>`;
      return;
    }

    // Industry distribution
    const industryCount = {};
    this.companies.forEach((c) => {
      (c.industries || ["Unspecified"]).forEach((ind) => {
        industryCount[ind] = (industryCount[ind] || 0) + 1;
      });
    });
    const topIndustries = Object.entries(industryCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15);

    // Tag distribution
    const tagCount = {};
    this.companies.forEach((c) => {
      (c.tags || []).forEach((t) => {
        tagCount[t] = (tagCount[t] || 0) + 1;
      });
    });
    const topTags = Object.entries(tagCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15);

    // Status distribution
    const statusCount = {};
    this.companies.forEach((c) => {
      const s = c.status || "Unknown";
      statusCount[s] = (statusCount[s] || 0) + 1;
    });

    // Hiring stats
    const hiringCount = this.companies.filter((c) => c.isHiring).length;

    // Region distribution
    const regionCount = {};
    this.companies.forEach((c) => {
      (c.regions || []).forEach((r) => {
        regionCount[r] = (regionCount[r] || 0) + 1;
      });
    });
    const topRegions = Object.entries(regionCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const batchInfo = BATCHES.find((b) => b.id === this.currentBatch);

    container.innerHTML = `
      <div style="padding-top:8px">
        <h2 style="font-size:18px;font-weight:700;margin-bottom:16px">${batchInfo ? batchInfo.display : ""} 趨勢分析</h2>

        <div class="trends-section">
          <h3>投資領域排行</h3>
          ${topIndustries
            .map(
              ([ind, count]) => `
            <div class="trend-item">
              <span class="trend-name">${this.escapeHtml(translateIndustry(ind))}</span>
              <span class="trend-value">${count} 家</span>
            </div>
          `
            )
            .join("")}
        </div>

        <div class="trends-section">
          <h3>熱門標籤</h3>
          ${topTags
            .map(
              ([tag, count]) => `
            <div class="trend-item">
              <span class="trend-name">${this.escapeHtml(translateIndustry(tag))}</span>
              <span class="trend-value">${count}</span>
            </div>
          `
            )
            .join("")}
        </div>

        <div class="trends-section">
          <h3>快速統計</h3>
          <div class="trend-item">
            <span class="trend-name">新創公司總數</span>
            <span class="trend-value">${this.companies.length}</span>
          </div>
          <div class="trend-item">
            <span class="trend-name">正在招募中</span>
            <span class="trend-value">${hiringCount} 家 (${Math.round((hiringCount / this.companies.length) * 100)}%)</span>
          </div>
          ${Object.entries(statusCount)
            .map(
              ([s, c]) => `
            <div class="trend-item">
              <span class="trend-name">${this.escapeHtml(translateStatus(s))}</span>
              <span class="trend-value">${c} 家</span>
            </div>
          `
            )
            .join("")}
        </div>

        ${
          topRegions.length > 0
            ? `<div class="trends-section">
          <h3>地區分布</h3>
          ${topRegions
            .map(
              ([region, count]) => `
            <div class="trend-item">
              <span class="trend-name">${this.escapeHtml(region)}</span>
              <span class="trend-value">${count}</span>
            </div>
          `
            )
            .join("")}
        </div>`
            : ""
        }
      </div>
    `;
  }

  renderAbout(container) {
    container.innerHTML = `
      <div class="about-view" style="display:block">
        <div class="about-card">
          <h3>YC 新創監測站</h3>
          <p>這是一個追蹤 Y Combinator 最新投資動態的行動網頁應用程式。自動同步 YC 公開的新創公司資料，並將產業分類、標籤等資訊翻譯為台灣繁體中文，讓您輕鬆掌握 YC 的投資趨勢。</p>
        </div>
        <div class="about-card">
          <h3>功能特色</h3>
          <p>
            • 即時同步 YC 各批次新創公司資料<br>
            • 產業分類與標籤中文翻譯<br>
            • 依產業篩選與關鍵字搜尋<br>
            • 投資領域分布圖表<br>
            • 趨勢分析與統計數據<br>
            • 行動裝置優先的響應式設計
          </p>
        </div>
        <div class="about-card">
          <h3>資料來源</h3>
          <p>資料來自 <a href="https://github.com/yc-oss/api" target="_blank" style="color:var(--primary)">yc-oss/api</a> 開源專案，該專案每日從 Y Combinator 的 Algolia 搜尋索引自動更新資料。</p>
          <p style="margin-top:8px">原始資料：<a href="https://www.ycombinator.com/launches" target="_blank" style="color:var(--primary)">ycombinator.com/launches</a></p>
        </div>
        <div class="about-card">
          <h3>免責聲明</h3>
          <p>本應用程式為獨立開發的工具，與 Y Combinator 無任何隸屬關係。所有資料皆為公開資訊。</p>
        </div>
      </div>
    `;
  }

  escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
}

// Handle modal close on overlay click
document.getElementById("modalOverlay").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) {
    app.closeModal();
  }
});

// Initialize app
const app = new YCMonitorApp();

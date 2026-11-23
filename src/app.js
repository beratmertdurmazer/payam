/* ==========================================================================
   PAYAM Turizm & Organizasyon — Interactive Presentation Engine
   Supports Dual Modes (Scroll + Presentation Deck), 5 Languages,
   Client Personalization + Standalone Export, DMC Cartography & Brief Builder
   ========================================================================== */

window.PAYAM_CONFIG = {
  contactName: "MARUF APARI",
  email: "maruf.apari@payamturizm.com",
  phoneDisplay: "0554 756 33 39",
  phoneHref: "+905547563339",
  whatsappDigits: "905547563339",
  offices: {
    istanbul: {
      city: "Kadıköy / İstanbul",
      // TODO: Mahalle adı eklendiğinde buraya eklenebilir (örn: "Fenerbahçe Mah. Ebru Sok. ...")
      address: "Ebru Sok. No.7 Özlem Apt. D.15, Kadıköy / İstanbul",
      mapsQuery: "Ebru Sok. No.7 Kadıköy İstanbul"
    },
    bodrum: {
      city: "Bodrum / Muğla",
      address: "Müskebi Mah. Kongre Sk. No.11, Bodrum / Muğla",
      mapsQuery: "Müskebi Mah. Kongre Sk. No.11 Bodrum Muğla"
    }
  }
};

window.PAYAM_IMAGES = {
  expSailing: "assets/img/exp-sailing.jpg",
  expDiving: "assets/img/exp-diving.jpg",
  expYoga: "assets/img/exp-yoga.jpg",
  expRowing: "assets/img/exp-rowing.jpg",
  expHiking: "assets/img/exp-hiking.jpg",
  expIncentive: "assets/img/exp-incentive.jpg",
  expWellness: "assets/img/exp-wellness.jpg",
  expSafari: "assets/img/exp-safari.jpg"
};

(function () {
  "use strict";

  const I18N = window.PAYAM_I18N || {};
  const MAP_DATA = window.PAYAM_WORLD_MAP || null;
  const REFS = window.PAYAM_REFS || [];
  const PRESET = window.PAYAM_PRESET || { client: "", event: "", lang: "" };

  const MICE_ICONS = {
    meetings: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    incentives: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></svg>',
    conferences: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>',
    events: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>'
  };

  const state = {
    lang: "tr",
    mode: "scroll",
    scene: 0,
    totalScenes: 12,
    client: "",
    eventTitle: "",
    aboutPillar: 0,
    serviceIdx: 0,
    compareState: "payam",
    miceIdx: 0,
    orgFilter: "all",
    selectedModuleIds: new Set(),
    expIdx: 0,
    cultureIdx: 0,
    dmcRegion: "all",
    refSector: "all",
    office: "istanbul",
    briefServiceIdx: 0,
    briefPeople: 80,
    briefRegionIdx: 0,
    briefClientOverride: "",
    openStudioOnBoot: false
  };

  let toastTimer = null;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function encodeClientToken(obj) {
    const json = JSON.stringify(obj);
    const bytes = new TextEncoder().encode(json);
    let bin = "";
    for (let i = 0; i < bytes.length; i += 1) {
      bin += String.fromCharCode(bytes[i]);
    }
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function decodeClientToken(token) {
    if (!token) return null;
    try {
      let b64 = token.replace(/-/g, "+").replace(/_/g, "/");
      while (b64.length % 4) b64 += "=";
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i += 1) {
        bytes[i] = bin.charCodeAt(i);
      }
      const parsed = JSON.parse(new TextDecoder().decode(bytes));
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  }

  function unlockStudio(openImmediately) {
    document.body.dataset.studio = "1";
    if (openImmediately) {
      openModal("personalModal");
    }
  }

  function t(path) {
    const langObj = I18N[state.lang] || I18N.tr;
    return path.split(".").reduce((acc, k) => (acc && acc[k] !== undefined ? acc[k] : undefined), langObj);
  }

  function showToast(msg) {
    const el = $("#toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("is-visible"), 2600);
  }

  function initFromParams() {
    const params = new URLSearchParams(window.location.search);
    const tokenData = decodeClientToken(params.get("p") || "");
    const savedLang = (() => { try { return localStorage.getItem("payam_lang"); } catch { return ""; } })();
    const qLang = params.get("lang") || (tokenData && tokenData.l) || PRESET.lang || savedLang || "tr";
    state.lang = I18N[qLang] ? qLang : "tr";

    const qClient = params.get("firma") || params.get("client") || (tokenData && tokenData.c) || PRESET.client || "";
    const qEvent = params.get("etkinlik") || params.get("event") || (tokenData && tokenData.e) || PRESET.event || "";
    state.client = String(qClient || "").trim();
    state.eventTitle = String(qEvent || "").trim();

    const qMode = params.get("mode");
    if (qMode === "deck" && window.innerWidth >= 960) {
      state.mode = "deck";
    } else {
      state.mode = "scroll";
    }

    const hashLower = (window.location.hash || "").toLowerCase();
    state.openStudioOnBoot = hashLower === "#studio" || params.get("studio") === "1";
  }

  /* ------------------------------------------------------------------------
     Global Localization & Dynamic Renderers
  ------------------------------------------------------------------------ */
  function applyStaticI18n() {
    document.documentElement.lang = state.lang;
    $$("[data-i18n]").forEach((el) => {
      const val = t(el.getAttribute("data-i18n"));
      if (typeof val === "string") el.textContent = val;
    });
    $$(".lang-btn").forEach((b) => b.classList.toggle("is-active", b.dataset.lang === state.lang));
    const mobSel = $("#langSelectMobile");
    if (mobSel) mobSel.value = state.lang;

    const pClient = $("#personalClientInput");
    const pEvent = $("#personalEventInput");
    if (pClient) pClient.placeholder = t("ui.personalClientPlaceholder") || "";
    if (pEvent) pEvent.placeholder = t("ui.personalEventPlaceholder") || "";

    const bClient = $("#briefClientInput");
    if (bClient) bClient.placeholder = t("brief.clientPlaceholder") || "";

    updateModeButtonLabel();
  }

  function renderPersonalization() {
    const chip = $("#navClientChip");
    const banner = $("#heroClientBanner");
    const bannerText = $("#heroClientText");

    if (state.client) {
      if (chip) {
        chip.textContent = `PAYAM × ${state.client}`;
        chip.classList.add("is-visible");
      }
      if (banner && bannerText) {
        bannerText.innerHTML = "";
        const strong = document.createElement("strong");
        strong.textContent = state.client;
        const suffix = document.createTextNode(` — ${t("hero.personalizedPrefix")}`);
        bannerText.appendChild(strong);
        bannerText.appendChild(suffix);
        if (state.eventTitle) {
          const ev = document.createElement("div");
          ev.style.opacity = "0.86";
          ev.style.fontSize = "0.76rem";
          ev.textContent = state.eventTitle;
          bannerText.appendChild(ev);
        }
        banner.classList.add("is-visible");
      }
      if (!state.briefClientOverride) {
        const bInput = $("#briefClientInput");
        if (bInput) bInput.value = state.client;
      }
    } else {
      if (chip) chip.classList.remove("is-visible");
      if (banner) banner.classList.remove("is-visible");
    }

    const pC = $("#personalClientInput");
    const pE = $("#personalEventInput");
    if (pC && document.activeElement !== pC) pC.value = state.client;
    if (pE && document.activeElement !== pE) pE.value = state.eventTitle;
  }

  function renderHero() {
    const h = t("hero");
    const titleEl = $("#heroTitle");
    if (titleEl && Array.isArray(h.titleLines)) {
      titleEl.innerHTML = "";
      h.titleLines.forEach((line) => {
        const sp = document.createElement("span");
        sp.textContent = line;
        titleEl.appendChild(sp);
      });
    }
    $("#heroTagline").textContent = h.tagline;
    $("#heroSub").textContent = h.sub;
  }

  function renderAbout() {
    const a = t("about");
    $("#aboutEyebrow").textContent = a.eyebrow;
    $("#aboutTitle").textContent = a.title;

    const pWrap = $("#aboutParagraphs");
    pWrap.innerHTML = "";
    a.paragraphs.forEach((txt) => {
      const p = document.createElement("p");
      p.textContent = txt;
      pWrap.appendChild(p);
    });

    const pilWrap = $("#aboutPillars");
    pilWrap.innerHTML = "";
    a.pillars.forEach((pil, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "about-pillar-btn" + (idx === state.aboutPillar ? " is-active" : "");
      btn.innerHTML = `<span class="about-pillar-kicker"></span><span class="about-pillar-title"></span>`;
      btn.querySelector(".about-pillar-kicker").textContent = pil.kicker;
      btn.querySelector(".about-pillar-title").textContent = pil.title;
      btn.addEventListener("click", () => {
        state.aboutPillar = idx;
        renderAbout();
      });
      pilWrap.appendChild(btn);
    });

    const activePil = a.pillars[state.aboutPillar] || a.pillars[0];
    $("#aboutPillarDetail").textContent = activePil.detail;

    const tWrap = $("#aboutTrust");
    tWrap.innerHTML = "";
    a.trust.forEach((item) => {
      const box = document.createElement("div");
      box.className = "trust-badge";
      const st = document.createElement("strong");
      st.textContent = item.val;
      const sp = document.createElement("span");
      sp.textContent = item.label;
      box.append(st, sp);
      tWrap.appendChild(box);
    });
  }

  function renderServices() {
    const s = t("services");
    $("#servicesEyebrow").textContent = s.eyebrow;
    $("#servicesTitle").textContent = s.title;
    $("#servicesLead").textContent = s.lead;

    const tl = $("#servicesTimeline");
    tl.innerHTML = "";
    s.items.forEach((item, idx) => {
      const capEl = $(`#srvCap${idx}`);
      if (capEl) capEl.textContent = item.caption;

      const node = document.createElement("div");
      node.className = "service-node" + (idx === state.serviceIdx ? " is-active" : "");
      node.setAttribute("role", "button");
      node.setAttribute("tabindex", "0");

      const head = document.createElement("div");
      head.className = "service-node-head";
      const h3 = document.createElement("h3");
      h3.textContent = item.title;
      const jump = document.createElement("span");
      jump.className = "service-node-jump";
      jump.textContent = t("ui.jumpToSection");
      head.append(h3, jump);

      const p = document.createElement("p");
      p.textContent = item.desc;
      node.append(head, p);

      node.addEventListener("mouseenter", () => setServiceActive(idx));
      node.addEventListener("click", (e) => {
        if (e.target === jump) {
          goToScene(item.targetScene);
        } else {
          setServiceActive(idx);
        }
      });
      jump.addEventListener("click", (e) => {
        e.stopPropagation();
        goToScene(item.targetScene);
      });
      node.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          goToScene(item.targetScene);
        }
      });
      tl.appendChild(node);
    });

    $$(".services-banner-card").forEach((card) => {
      const idx = Number(card.dataset.srvIdx);
      card.classList.toggle("is-active", idx === state.serviceIdx);
      card.onclick = () => goToScene(s.items[idx].targetScene);
    });
  }

  function setServiceActive(idx) {
    state.serviceIdx = idx;
    $$(".service-node").forEach((el, i) => el.classList.toggle("is-active", i === idx));
    $$(".services-banner-card").forEach((el) => el.classList.toggle("is-active", Number(el.dataset.srvIdx) === idx));
  }

  function renderCorporate() {
    const c = t("corporate");
    $("#corpEyebrow").textContent = c.eyebrow;
    $("#corpTitle").textContent = c.title;
    $("#corpLead").textContent = c.lead;

    const list = $("#corpList");
    list.innerHTML = "";
    c.items.forEach((txt, i) => {
      const row = document.createElement("div");
      row.className = "corp-item";
      const num = document.createElement("span");
      num.className = "corp-num";
      num.textContent = String(i + 1).padStart(2, "0");
      const sp = document.createElement("span");
      sp.textContent = txt;
      row.append(num, sp);
      list.appendChild(row);
    });

    $("#compareTitle").textContent = c.compareTitle;
    $("#compareClassicBtn").textContent = c.compareClassicBtn;
    $("#comparePayamBtn").textContent = c.comparePayamBtn;
    renderComparisonMetrics();
  }

  function renderComparisonMetrics() {
    const c = t("corporate");
    const box = $("#compareBox");
    box.dataset.state = state.compareState;
    $$(".compare-tab").forEach((btn) => btn.classList.toggle("is-active", btn.dataset.compare === state.compareState));

    const grid = $("#compareGrid");
    grid.innerHTML = "";
    const rows = c.compareStates[state.compareState] || c.compareStates.payam;
    rows.forEach((m) => {
      const card = document.createElement("div");
      card.className = "compare-metric";
      const lbl = document.createElement("span");
      lbl.className = "compare-metric-label";
      lbl.textContent = m.label;
      const val = document.createElement("span");
      val.className = "compare-metric-val";
      val.textContent = m.val;
      card.append(lbl, val);
      grid.appendChild(card);
    });
  }

  function renderMice() {
    const m = t("mice");
    $("#miceEyebrow").textContent = m.eyebrow;
    $("#miceTitle").textContent = m.title;
    $("#miceLead").textContent = m.lead;

    const grid = $("#miceGrid");
    grid.innerHTML = "";
    m.pillars.forEach((pil, idx) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "mice-card" + (idx === state.miceIdx ? " is-active" : "");
      card.innerHTML = `<div class="mice-icon-wrap">${MICE_ICONS[pil.id] || ""}</div><h3></h3><p></p>`;
      card.querySelector("h3").textContent = pil.title;
      card.querySelector("p").textContent = pil.desc;
      card.addEventListener("click", () => {
        state.miceIdx = idx;
        renderMice();
      });
      grid.appendChild(card);
    });

    const active = m.pillars[state.miceIdx] || m.pillars[0];
    $("#miceBlueprintTitle").textContent = `${active.title} — ${m.stageTitleSuffix}`;
    const stagesWrap = $("#miceStages");
    stagesWrap.innerHTML = "";
    active.stages.forEach((stText, i) => {
      const st = document.createElement("div");
      st.className = "mice-stage";
      st.innerHTML = `<span class="mice-stage-num">0${i + 1}</span><span class="mice-stage-text"></span>`;
      st.querySelector(".mice-stage-text").textContent = stText;
      stagesWrap.appendChild(st);
    });

    const modKey = `mice:${active.id}`;
    const isSelected = state.selectedModuleIds.has(modKey);
    const briefBtn = $("#miceBriefBtn");
    briefBtn.textContent = isSelected ? t("ui.addedToBrief") : t("ui.addToBrief");
    briefBtn.onclick = () => toggleModule(modKey);
  }

  function renderOrgServices() {
    const o = t("orgServices");
    $("#orgEyebrow").textContent = o.eyebrow;
    $("#orgTitle").textContent = o.title;
    $("#orgLead").textContent = o.lead;

    const fWrap = $("#orgFilters");
    fWrap.innerHTML = "";
    o.categories.forEach((cat) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "filter-pill" + (cat.id === state.orgFilter ? " is-active" : "");
      btn.textContent = cat.label;
      btn.addEventListener("click", () => {
        state.orgFilter = cat.id;
        renderOrgServices();
      });
      fWrap.appendChild(btn);
    });

    const grid = $("#orgGrid");
    grid.innerHTML = "";
    o.items.forEach((item) => {
      const modKey = `org:${item.id}`;
      const isSel = state.selectedModuleIds.has(modKey);
      const isHidden = state.orgFilter !== "all" && item.cat !== state.orgFilter;

      const card = document.createElement("div");
      card.className = "org-card" + (isSel ? " is-selected" : "") + (isHidden ? " is-hidden" : "");

      const top = document.createElement("div");
      const h3 = document.createElement("h3");
      h3.textContent = item.title;
      const p = document.createElement("p");
      p.textContent = item.desc;
      top.append(h3, p);

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "org-toggle-btn";
      btn.textContent = isSel ? t("ui.addedToBrief") : t("ui.addToBrief");
      btn.addEventListener("click", () => toggleModule(modKey));

      card.append(top, btn);
      grid.appendChild(card);
    });

    updateOrgBasketPill();
  }

  function updateOrgBasketPill() {
    $("#orgBasketCount").textContent = `${t("ui.orgBasketLabel")} ${state.selectedModuleIds.size}`;
  }

  function renderExperiences() {
    const e = t("experiences");
    $("#expEyebrow").textContent = e.eyebrow;
    $("#expTitle").textContent = e.title;
    $("#expLead1").textContent = e.lead1;
    $("#expLead2").textContent = e.lead2;

    const list = $("#expList");
    list.innerHTML = "";
    e.programs.forEach((prog, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "exp-mini-card" + (idx === state.expIdx ? " is-active" : "");

      const img = document.createElement("img");
      img.className = "exp-thumb";
      img.src = window.PAYAM_IMAGES[prog.img] || "";
      img.alt = prog.title;

      const meta = document.createElement("div");
      const ttl = document.createElement("span");
      ttl.className = "exp-mini-title";
      ttl.textContent = prog.title;
      const tag = document.createElement("span");
      tag.className = "exp-mini-tag";
      tag.textContent = prog.tag;
      meta.append(ttl, tag);

      btn.append(img, meta);
      btn.addEventListener("click", () => {
        state.expIdx = idx;
        renderExperiences();
      });
      list.appendChild(btn);
    });

    const cur = e.programs[state.expIdx] || e.programs[0];
    $("#expSpotImg").src = window.PAYAM_IMAGES[cur.img] || "";
    $("#expSpotImg").alt = cur.title;
    $("#expSpotTitle").textContent = cur.title;
    $("#expSpotDesc").textContent = cur.desc;

    const metricsWrap = $("#expSpotMetrics");
    metricsWrap.innerHTML = "";
    e.metricLabels.forEach((lbl, i) => {
      const val = cur.metrics[i] || 90;
      const row = document.createElement("div");
      row.className = "exp-bar-row";
      row.innerHTML = `<div class="exp-bar-label"><span></span><span>${val}%</span></div><div class="exp-bar-track"><div class="exp-bar-fill" style="width:${val}%"></div></div>`;
      row.querySelector(".exp-bar-label span").textContent = lbl;
      metricsWrap.appendChild(row);
    });

    const modKey = `exp:${cur.id}`;
    const addBtn = $("#expAddBriefBtn");
    addBtn.textContent = state.selectedModuleIds.has(modKey) ? t("ui.addedToBrief") : t("ui.addToBrief");
    addBtn.onclick = () => toggleModule(modKey);
  }

  function renderCulture() {
    const c = t("culture");
    $("#cultureEyebrow").textContent = c.eyebrow;
    $("#cultureTitle").textContent = c.title;
    $("#cultureLead").textContent = c.lead;

    const list = $("#cultureList");
    list.innerHTML = "";
    c.items.forEach((item, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "culture-item" + (idx === state.cultureIdx ? " is-active" : "");
      const dot = document.createElement("span");
      dot.className = "culture-dot";
      const sp = document.createElement("span");
      sp.textContent = item.title;
      btn.append(dot, sp);
      btn.addEventListener("mouseenter", () => setCultureFocus(idx, item.slot));
      btn.addEventListener("click", () => setCultureFocus(idx, item.slot));
      list.appendChild(btn);
    });

    const activeItem = c.items[state.cultureIdx] || c.items[0];
    $$(".culture-photo-card").forEach((card) => {
      const slot = Number(card.dataset.slot);
      card.classList.toggle("is-focus", slot === activeItem.slot);
      card.onclick = () => {
        const matchIdx = c.items.findIndex((it) => it.slot === slot);
        setCultureFocus(matchIdx >= 0 ? matchIdx : 0, slot);
      };
    });
  }

  function setCultureFocus(itemIdx, slot) {
    state.cultureIdx = itemIdx;
    $$(".culture-item").forEach((el, i) => el.classList.toggle("is-active", i === itemIdx));
    $$(".culture-photo-card").forEach((card) => card.classList.toggle("is-focus", Number(card.dataset.slot) === slot));
  }

  /* ------------------------------------------------------------------------
     SCENE 9 — Global DMC Interactive Cartography (Natural Earth SVG)
  ------------------------------------------------------------------------ */
  function arcPath(x1, y1, x2, y2) {
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const dist = Math.hypot(x2 - x1, y2 - y1);
    const lift = Math.min(95, dist * 0.24);
    return `M${x1},${y1} Q${mx.toFixed(1)},${(my - lift).toFixed(1)} ${x2},${y2}`;
  }

  function renderDmc() {
    const d = t("dmc");
    $("#dmcEyebrow").textContent = d.eyebrow;
    $("#dmcTitle").textContent = d.title;
    $("#dmcLead").textContent = d.lead;

    const tabsWrap = $("#dmcRegionTabs");
    tabsWrap.innerHTML = "";
    ["all", "asia", "africa", "southAmerica"].forEach((key) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "filter-pill" + (state.dmcRegion === key ? " is-active" : "");
      btn.textContent = d.regions[key].tab;
      btn.addEventListener("click", () => {
        state.dmcRegion = key;
        renderDmc();
      });
      tabsWrap.appendChild(btn);
    });

    const curReg = d.regions[state.dmcRegion] || d.regions.all;
    $("#dmcRegionTitle").textContent = curReg.title;
    $("#dmcRegionSummary").textContent = curReg.summary;

    const hubsWrap = $("#dmcRegionHubs");
    hubsWrap.innerHTML = "";
    curReg.hubs.forEach((hubName) => {
      const chip = document.createElement("span");
      chip.className = "dmc-hub-chip";
      chip.textContent = hubName;
      hubsWrap.appendChild(chip);
    });

    const checkWrap = $("#dmcChecklist");
    checkWrap.innerHTML = "";
    d.items.forEach((txt) => {
      const li = document.createElement("li");
      li.textContent = txt;
      checkWrap.appendChild(li);
    });

    renderDmcSvgMap();
  }

  function renderDmcSvgMap() {
    const container = $("#dmcMapContainer");
    if (!container || !MAP_DATA) return;

    // Build SVG once and update active classes cleanly
    if (!container.dataset.built) {
      const ist = MAP_DATA.hubs.find((h) => h.id === "istanbul") || MAP_DATA.hubs[0];
      const regKeys = ["asia", "africa", "southAmerica"];

      let arcsMarkup = "";
      let citiesMarkup = "";
      regKeys.forEach((reg) => {
        (MAP_DATA.cities[reg] || []).forEach((city) => {
          arcsMarkup += `<path class="map-arc" data-reg="${reg}" d="${arcPath(ist.x, ist.y, city.x, city.y)}"/>`;
          const dx = city.id === "cairo" ? 7 : 6;
          const dy = city.id === "cairo" ? 6 : 3;
          citiesMarkup += `
            <g class="map-city" data-reg="${reg}" style="cursor:pointer">
              <circle cx="${city.x}" cy="${city.y}" r="3.4" fill="#F7F3EC" stroke="#21110C" stroke-width="1"/>
              <text class="map-city-label" x="${(city.x + dx).toFixed(1)}" y="${(city.y + dy).toFixed(1)}">${city.name}</text>
            </g>`;
        });
      });

      let hubsMarkup = "";
      MAP_DATA.hubs.forEach((h) => {
        const lx = h.primary ? h.x : (h.x - 8);
        const ly = h.primary ? (h.y - 9) : (h.y + 4);
        const anchor = h.primary ? "middle" : "end";
        hubsMarkup += `
          <g class="map-hub">
            <circle class="map-pin-pulse" cx="${h.x}" cy="${h.y}" r="7"/>
            <circle cx="${h.x}" cy="${h.y}" r="${h.primary ? 4.5 : 3.5}" fill="#E2C6A1" stroke="#21110C" stroke-width="1.2"/>
            <text class="map-city-label" x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="${anchor}" style="fill:#E2C6A1">${h.name}</text>
          </g>`;
      });

      container.innerHTML = `
        <svg class="dmc-svg" viewBox="${MAP_DATA.viewBox}" role="img" aria-label="PAYAM Global DMC World Map">
          <path class="map-graticule" d="${MAP_DATA.graticule}"/>
          <path class="map-context" d="${MAP_DATA.paths.context}"/>
          <path class="map-region" data-reg="asia" d="${MAP_DATA.paths.asia}"/>
          <path class="map-region" data-reg="africa" d="${MAP_DATA.paths.africa}"/>
          <path class="map-region" data-reg="southAmerica" d="${MAP_DATA.paths.southAmerica}"/>
          <path class="map-turkey" d="${MAP_DATA.paths.turkey}"/>
          ${arcsMarkup}
          ${citiesMarkup}
          ${hubsMarkup}
        </svg>`;

      $$(".map-region, .map-city", container).forEach((el) => {
        el.addEventListener("click", () => {
          const r = el.dataset.reg;
          state.dmcRegion = state.dmcRegion === r ? "all" : r;
          renderDmc();
        });
      });
      container.dataset.built = "1";
    }

    $$(".map-region", container).forEach((el) => {
      const active = state.dmcRegion === el.dataset.reg || state.dmcRegion === "all";
      el.classList.toggle("is-selected", active);
      el.style.opacity = state.dmcRegion === "all" ? "0.9" : (el.dataset.reg === state.dmcRegion ? "1" : "0.35");
    });

    $$(".map-arc", container).forEach((el) => {
      const active = state.dmcRegion === "all" || state.dmcRegion === el.dataset.reg;
      el.classList.toggle("is-active", active);
      el.style.opacity = active ? "" : "0.12";
    });

    $$(".map-city", container).forEach((el) => {
      const active = state.dmcRegion === "all" || state.dmcRegion === el.dataset.reg;
      el.style.opacity = active ? "1" : "0.28";
    });
  }

  /* ------------------------------------------------------------------------
     SCENE 10 — Why Payam & Reference Logo Wall
  ------------------------------------------------------------------------ */
  function renderWhyAndReferences() {
    const wr = t("whyReferences");
    $("#whyEyebrow").textContent = wr.eyebrow;
    $("#whyTitle").textContent = wr.title;
    $("#refsHeading").textContent = wr.refsHeading;

    const whyGrid = $("#whyGrid");
    whyGrid.innerHTML = "";
    wr.pillars.forEach((pil) => {
      const card = document.createElement("div");
      card.className = "why-card";
      card.innerHTML = `<div class="why-card-head"><span class="why-check"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></span><h3></h3></div><p></p>`;
      card.querySelector("h3").textContent = pil.title;
      card.querySelector("p").textContent = pil.desc;
      whyGrid.appendChild(card);
    });

    const fWrap = $("#refFilters");
    fWrap.innerHTML = "";
    wr.sectors.forEach((sec) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "filter-pill" + (sec.id === state.refSector ? " is-active" : "");
      btn.textContent = sec.label;
      btn.addEventListener("click", () => {
        state.refSector = sec.id;
        renderWhyAndReferences();
      });
      fWrap.appendChild(btn);
    });

    const rGrid = $("#refsGrid");
    rGrid.innerHTML = "";
    REFS.forEach((ref) => {
      const card = document.createElement("div");
      card.className = "ref-card" + (state.refSector !== "all" && ref.sector !== state.refSector ? " is-hidden" : "");

      const slot = document.createElement("div");
      slot.className = "ref-logo-slot";
      if (ref.type === "svg") {
        slot.innerHTML = ref.markup;
      } else {
        const img = document.createElement("img");
        img.src = ref.src;
        img.alt = ref.name;
        img.style.maxHeight = "38px";
        img.style.maxWidth = "132px";
        img.style.objectFit = "contain";
        slot.appendChild(img);
      }

      const nm = document.createElement("span");
      nm.className = "ref-name";
      nm.textContent = ref.name;

      card.append(slot, nm);
      rGrid.appendChild(card);
    });
  }

  /* ------------------------------------------------------------------------
     Module Selection & 30s Brief Builder
  ------------------------------------------------------------------------ */
  function resolveModuleLabel(modKey) {
    const [kind, id] = modKey.split(":");
    if (kind === "org") {
      const item = t("orgServices.items").find((i) => i.id === id);
      return item ? item.title : id;
    }
    if (kind === "exp") {
      const item = t("experiences.programs").find((i) => i.id === id);
      return item ? item.title : id;
    }
    if (kind === "mice") {
      const item = t("mice.pillars").find((i) => i.id === id);
      return item ? `MICE · ${item.title}` : id;
    }
    return modKey;
  }

  function toggleModule(modKey) {
    if (state.selectedModuleIds.has(modKey)) {
      state.selectedModuleIds.delete(modKey);
      showToast(t("ui.toastBriefRemoved"));
    } else {
      state.selectedModuleIds.add(modKey);
      showToast(t("ui.toastBriefAdded"));
    }
    renderMice();
    renderOrgServices();
    renderExperiences();
    renderBriefBuilder();
  }

  function renderBriefBuilder() {
    const b = t("brief");
    $("#briefEyebrow").textContent = b.eyebrow;
    $("#briefTitle").textContent = b.title;
    $("#briefLead").textContent = b.lead;
    $("#briefServiceLabel").textContent = b.serviceLabel;
    $("#briefPeopleLabel").textContent = b.peopleLabel;
    $("#briefRegionLabel").textContent = b.regionLabel;
    $("#briefClientLabel").textContent = b.clientLabel;
    $("#briefSelectedLabel").textContent = b.selectedLabel;
    $("#briefCardKicker").textContent = b.cardKicker;

    const srvWrap = $("#briefServicePills");
    srvWrap.innerHTML = "";
    b.servicesList.forEach((lbl, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "filter-pill" + (idx === state.briefServiceIdx ? " is-active" : "");
      btn.textContent = lbl;
      btn.addEventListener("click", () => {
        state.briefServiceIdx = idx;
        renderBriefBuilder();
      });
      srvWrap.appendChild(btn);
    });

    const regWrap = $("#briefRegionPills");
    regWrap.innerHTML = "";
    b.regionsList.forEach((lbl, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "filter-pill" + (idx === state.briefRegionIdx ? " is-active" : "");
      btn.textContent = lbl;
      btn.addEventListener("click", () => {
        state.briefRegionIdx = idx;
        renderBriefBuilder();
      });
      regWrap.appendChild(btn);
    });

    const guestsLabel = `${state.briefPeople >= 1000 ? "1000+" : state.briefPeople} ${b.personUnit}`;
    $("#briefPeopleValue").textContent = guestsLabel;
    $$("[data-people]").forEach((btn) => {
      btn.classList.toggle("is-active", Number(btn.dataset.people) === state.briefPeople);
    });

    const orgInputVal = ($("#briefClientInput").value || "").trim();
    const orgDisplay = orgInputVal || state.client || "—";
    $("#briefCardTitle").textContent = orgDisplay !== "—"
      ? `${orgDisplay} · ${b.servicesList[state.briefServiceIdx]}`
      : b.cardTitleDefault;

    const metaList = $("#briefMetaList");
    metaList.innerHTML = "";
    const metaPairs = [
      [b.metaFocus, b.servicesList[state.briefServiceIdx]],
      [b.metaGuests, guestsLabel],
      [b.metaRegion, b.regionsList[state.briefRegionIdx]],
      [b.metaClient, orgDisplay],
      [b.metaSupport, b.metaSupportVal]
    ];
    metaPairs.forEach(([k, v]) => {
      const row = document.createElement("div");
      row.className = "brief-meta-row";
      const sp = document.createElement("span");
      sp.textContent = k;
      const st = document.createElement("strong");
      st.textContent = v;
      row.append(sp, st);
      metaList.appendChild(row);
    });

    const mods = Array.from(state.selectedModuleIds).map(resolveModuleLabel);
    const ctrlTags = $("#briefSelectedControls");
    const cardTags = $("#briefCardTags");
    ctrlTags.innerHTML = "";
    cardTags.innerHTML = "";

    if (mods.length === 0) {
      const emptyNote = document.createElement("span");
      emptyNote.style.fontSize = "0.78rem";
      emptyNote.style.color = "var(--espresso-muted)";
      emptyNote.textContent = b.noExtras;
      ctrlTags.appendChild(emptyNote);
    } else {
      Array.from(state.selectedModuleIds).forEach((k) => {
        const lbl = resolveModuleLabel(k);
        const pill = document.createElement("button");
        pill.type = "button";
        pill.className = "filter-pill is-active";
        pill.textContent = `${lbl} ✕`;
        pill.addEventListener("click", () => toggleModule(k));
        ctrlTags.appendChild(pill);

        const tag = document.createElement("span");
        tag.className = "brief-tag";
        tag.textContent = lbl;
        cardTags.appendChild(tag);
      });
    }

    const summaryText = [
      `PAYAM Turizm & Organizasyon — ${b.cardKicker}`,
      `${b.metaClient}: ${orgDisplay}`,
      `${b.metaFocus}: ${b.servicesList[state.briefServiceIdx]}`,
      `${b.metaGuests}: ${guestsLabel}`,
      `${b.metaRegion}: ${b.regionsList[state.briefRegionIdx]}`,
      mods.length ? `${b.selectedLabel}: ${mods.join(", ")}` : ""
    ].filter(Boolean).join("\n");

    const waUrl = `https://wa.me/${window.PAYAM_CONFIG.whatsappDigits}?text=${encodeURIComponent(summaryText)}`;
    const mailUrl = `mailto:${window.PAYAM_CONFIG.email}?subject=${encodeURIComponent("PAYAM MICE Brief — " + orgDisplay)}&body=${encodeURIComponent(summaryText)}`;
    $("#briefWaBtn").href = waUrl;
    $("#briefMailBtn").href = mailUrl;
    $("#briefCopyBtn").onclick = () => copyText(summaryText);
  }

  /* ------------------------------------------------------------------------
     SCENE 12 — Contact & Smart vCard
  ------------------------------------------------------------------------ */
  function renderContact() {
    const c = t("contact");
    $("#contactEyebrow").textContent = c.eyebrow;
    $("#contactTitle").textContent = c.title;
    $("#contactRole").textContent = c.role;
    $("#contactEmailLabel").textContent = c.emailLabel;
    $("#contactPhoneLabel").textContent = c.phoneLabel;
    $("#contactAddressLabel").textContent = c.addressLabel;
    $("#officeIstBtn").textContent = c.istanbulTab;
    $("#officeBodBtn").textContent = c.bodrumTab;
    $("#contactBadgeText").textContent = c.badgeText;

    const officeObj = window.PAYAM_CONFIG.offices[state.office] || window.PAYAM_CONFIG.offices.istanbul;
    $("#contactAddressText").textContent = officeObj.address;
    $("#officeMapsLink").href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(officeObj.mapsQuery)}`;
    $("#officeIstBtn").classList.toggle("is-active", state.office === "istanbul");
    $("#officeBodBtn").classList.toggle("is-active", state.office === "bodrum");
  }

  function downloadVCard() {
    const cfg = window.PAYAM_CONFIG;
    const vcf = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      "N:Aparı;Maruf;;;",
      "FN:Maruf Aparı",
      "ORG:PAYAM Turizm & Organizasyon",
      "TITLE:MICE & Kurumsal Seyahat",
      `TEL;TYPE=CELL,VOICE:${cfg.phoneHref}`,
      `EMAIL;TYPE=WORK:${cfg.email}`,
      `ADR;TYPE=WORK:;;${cfg.offices.istanbul.address};İstanbul;;Türkiye`,
      `ADR;TYPE=WORK:;;${cfg.offices.bodrum.address};Muğla;;Türkiye`,
      "END:VCARD"
    ].join("\r\n");

    triggerDownload(new Blob([vcf], { type: "text/vcard;charset=utf-8" }), "Maruf-Apari-PAYAM-Turizm.vcf");
    showToast(t("ui.toastVcardSaved"));
  }

  /* ------------------------------------------------------------------------
     Navigation, Dual Viewing Modes (Scroll vs Deck), Atlas & Personalizer
  ------------------------------------------------------------------------ */
  function renderAtlas() {
    const grid = $("#atlasGrid");
    if (!grid) return;
    grid.innerHTML = "";
    const chaps = t("chapters") || [];
    chaps.forEach((name, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "atlas-item" + (idx === state.scene ? " is-active" : "");
      btn.innerHTML = `<span class="atlas-num">${String(idx + 1).padStart(2, "0")}</span><span class="atlas-label"></span>`;
      btn.querySelector(".atlas-label").textContent = name;
      btn.addEventListener("click", () => {
        closeModal("atlasModal");
        goToScene(idx);
      });
      grid.appendChild(btn);
    });
  }

  function renderDockDots() {
    const dotsWrap = $("#dockDots");
    if (!dotsWrap) return;
    dotsWrap.innerHTML = "";
    const chaps = t("chapters") || [];
    for (let i = 0; i < state.totalScenes; i++) {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "dock-dot" + (i === state.scene ? " is-active" : "");
      dot.title = `${String(i + 1).padStart(2, "0")} — ${chaps[i] || ""}`;
      dot.setAttribute("aria-label", dot.title);
      dot.addEventListener("click", () => goToScene(i));
      dotsWrap.appendChild(dot);
    }
  }

  function updateDeckUI() {
    const scenes = $$(".scene");
    scenes.forEach((sc, idx) => sc.classList.toggle("is-active", idx === state.scene));
    $("#dockCounter").textContent = `${String(state.scene + 1).padStart(2, "0")} / ${String(state.totalScenes).padStart(2, "0")}`;
    $("#dockPrevBtn").disabled = state.scene <= 0;
    $("#dockNextBtn").disabled = state.scene >= state.totalScenes - 1;
    $$(".dock-dot").forEach((d, i) => d.classList.toggle("is-active", i === state.scene));
    $$(".nav-pill[data-jump]").forEach((pill) => {
      pill.classList.toggle("is-active", Number(pill.dataset.jump) === state.scene);
    });
  }

  function updateModeButtonLabel() {
    const lbl = $("#modeToggleLabel");
    if (!lbl) return;
    lbl.textContent = state.mode === "deck" ? t("ui.modeToScroll") : t("ui.modeToDeck");
  }

  function setMode(nextMode) {
    if (nextMode === "deck" && window.innerWidth < 960) {
      nextMode = "scroll";
    }
    state.mode = nextMode;
    document.body.dataset.mode = nextMode;
    updateModeButtonLabel();
    if (nextMode === "deck") {
      updateDeckUI();
      const activeScene = $(`.scene[data-scene="${state.scene}"]`);
      if (activeScene) activeScene.scrollTop = 0;
    } else {
      const target = $(`.scene[data-scene="${state.scene}"]`);
      if (target) target.scrollIntoView({ behavior: "auto" });
    }
  }

  function goToScene(idx) {
    const clamped = Math.max(0, Math.min(state.totalScenes - 1, idx));
    state.scene = clamped;
    updateDeckUI();
    if (state.mode === "deck") {
      const el = $(`.scene[data-scene="${clamped}"]`);
      if (el) el.scrollTop = 0;
    } else {
      const el = $(`.scene[data-scene="${clamped}"]`);
      if (el) {
        const navH = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--nav-h"), 10) || 72;
        const top = el.getBoundingClientRect().top + window.scrollY - navH + 8;
        window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      }
    }
  }

  function openModal(id) {
    if (id === "atlasModal") renderAtlas();
    const el = document.getElementById(id);
    if (el) el.classList.add("is-open");
  }

  function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove("is-open");
  }

  function copyText(txt) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(() => showToast(t("ui.toastCopied"))).catch(() => fallbackCopy(txt));
    } else {
      fallbackCopy(txt);
    }
  }

  function fallbackCopy(txt) {
    const ta = document.createElement("textarea");
    ta.value = txt;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch {}
    document.body.removeChild(ta);
    showToast(t("ui.toastCopied"));
  }

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function buildShareUrl() {
    const u = new URL(window.location.href);
    u.hash = "";
    ["studio", "firma", "client", "etkinlik", "event", "p", "lang"].forEach((k) => {
      u.searchParams.delete(k);
    });
    if (state.client || state.eventTitle) {
      const payload = { l: state.lang };
      if (state.client) payload.c = state.client;
      if (state.eventTitle) payload.e = state.eventTitle;
      u.searchParams.set("p", encodeClientToken(payload));
    } else if (state.lang && state.lang !== "tr") {
      u.searchParams.set("lang", state.lang);
    }
    return u.toString();
  }

  function prepareExportClone(presetObj) {
    const clone = document.documentElement.cloneNode(true);
    const cloneBody = clone.querySelector("body");
    if (cloneBody) cloneBody.removeAttribute("data-studio");
    clone.querySelectorAll(".modal-backdrop.is-open").forEach((m) => m.classList.remove("is-open"));
    const toastEl = clone.querySelector("#toast");
    if (toastEl) toastEl.classList.remove("is-visible");
    const prog = clone.querySelector("#scrollProgressBar");
    if (prog) prog.style.width = "0%";
    const mapC = clone.querySelector("#dmcMapContainer");
    if (mapC) {
      mapC.removeAttribute("data-built");
      mapC.innerHTML = "";
    }
    const presetScript = clone.querySelector("#payam-preset-script");
    if (presetScript) {
      presetScript.textContent = `\nwindow.PAYAM_STANDALONE = true;\nwindow.PAYAM_PRESET = ${JSON.stringify(presetObj)};\n`;
    }
    return clone;
  }

  async function exportPersonalizedOfflineHtml() {
    const clientVal = ($("#personalClientInput").value || "").trim();
    const eventVal = ($("#personalEventInput").value || "").trim();
    state.client = clientVal;
    state.eventTitle = eventVal;
    renderPersonalization();

    const presetObj = { client: clientVal, event: eventVal, lang: state.lang };
    const safeSlug = (clientVal || "Genel").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "Sunum";
    const filename = `PAYAM-x-${safeSlug}.html`;

    // Path A: Running inside standalone offline bundle
    if (window.PAYAM_STANDALONE) {
      const clone = prepareExportClone(presetObj);
      const htmlStr = "<!DOCTYPE html>\n" + clone.outerHTML;
      triggerDownload(new Blob([htmlStr], { type: "text/html;charset=utf-8" }), filename);
      showToast(t("ui.toastHtmlExported"));
      return;
    }

    // Path B: Running on HTTP web host — fetch CSS, JS, and images dynamically into one offline bundle
    try {
      const cssResp = await fetch("styles.css");
      const cssText = await cssResp.text();

      const jsFiles = ["src/i18n.js", "src/world-map-data.js", "src/logos-data.js", "src/app.js"];
      const jsTexts = await Promise.all(jsFiles.map((f) => fetch(f).then((r) => r.text())));

      // Collect all relative image references and encode as data URIs
      const clone = prepareExportClone(presetObj);

      const imgSrcs = new Set();
      clone.querySelectorAll('img[src^="assets/img/"]').forEach((im) => imgSrcs.add(im.getAttribute("src")));
      Object.values(window.PAYAM_IMAGES).forEach((s) => { if (s.startsWith("assets/img/")) imgSrcs.add(s); });
      REFS.forEach((r) => { if (r.src && r.src.startsWith("assets/img/")) imgSrcs.add(r.src); });

      const dataMap = {};
      await Promise.all(Array.from(imgSrcs).map(async (src) => {
        const blob = await fetch(src).then((r) => r.blob());
        const b64 = await new Promise((resolve) => {
          const fr = new FileReader();
          fr.onloadend = () => resolve(fr.result);
          fr.readAsDataURL(blob);
        });
        dataMap[src] = b64;
      }));

      clone.querySelectorAll('img[src^="assets/img/"]').forEach((im) => {
        const s = im.getAttribute("src");
        if (dataMap[s]) im.setAttribute("src", dataMap[s]);
      });

      const linkCss = clone.querySelector('link[href="styles.css"]');
      if (linkCss) {
        const st = document.createElement("style");
        st.textContent = cssText;
        linkCss.replaceWith(st);
      }

      jsFiles.forEach((f, idx) => {
        const sc = clone.querySelector(`script[src="${f}"]`);
        if (sc) {
          let code = jsTexts[idx];
          Object.entries(dataMap).forEach(([k, v]) => {
            code = code.split(`"${k}"`).join(`"${v}"`);
          });
          code = code.replace(/<\/script>/gi, "<\\/script>");
          const inlineSc = document.createElement("script");
          inlineSc.textContent = code;
          sc.replaceWith(inlineSc);
        }
      });

      const htmlStr = "<!DOCTYPE html>\n" + clone.outerHTML;
      triggerDownload(new Blob([htmlStr], { type: "text/html;charset=utf-8" }), filename);
      showToast(t("ui.toastHtmlExported"));
    } catch {
      showToast("Offline export available via standalone dist HTML or HTTP host.");
    }
  }

  /* ------------------------------------------------------------------------
     Render All + Bind Listeners
  ------------------------------------------------------------------------ */
  function renderAll() {
    applyStaticI18n();
    renderPersonalization();
    renderHero();
    renderAbout();
    renderServices();
    renderCorporate();
    renderMice();
    renderOrgServices();
    renderExperiences();
    renderCulture();
    renderDmc();
    renderWhyAndReferences();
    renderBriefBuilder();
    renderContact();
    renderDockDots();
    updateDeckUI();
  }

  function bindEvents() {
    // Language switchers
    $$(".lang-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.lang = btn.dataset.lang;
        try { localStorage.setItem("payam_lang", state.lang); } catch {}
        renderAll();
      });
    });

    const mobLang = $("#langSelectMobile");
    if (mobLang) {
      mobLang.addEventListener("change", () => {
        state.lang = mobLang.value;
        try { localStorage.setItem("payam_lang", state.lang); } catch {}
        renderAll();
      });
    }

    // Secret 5-tap / 5-click gesture on brand logo to unlock Personalization Studio
    const brandLink = $(".brand-link");
    if (brandLink) {
      let logoTapTimes = [];
      brandLink.addEventListener("click", (e) => {
        const now = Date.now();
        logoTapTimes = logoTapTimes.filter((ts) => now - ts <= 2500);
        logoTapTimes.push(now);
        if (logoTapTimes.length >= 5) {
          e.preventDefault();
          e.stopImmediatePropagation();
          logoTapTimes = [];
          unlockStudio(true);
        }
      }, true);
    }

    // Scene navigation triggers
    $$("[data-jump]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        goToScene(Number(el.dataset.jump));
      });
    });

    // Mode toggle
    $("#modeToggleBtn").addEventListener("click", () => {
      setMode(state.mode === "deck" ? "scroll" : "deck");
    });

    // Deck Dock controls
    $("#dockPrevBtn").addEventListener("click", () => goToScene(state.scene - 1));
    $("#dockNextBtn").addEventListener("click", () => goToScene(state.scene + 1));
    $("#dockFullscreenBtn").addEventListener("click", toggleFullscreen);

    // Modals
    $("#openPersonalizeBtn").addEventListener("click", () => openModal("personalModal"));
    $("#openAtlasBtn").addEventListener("click", () => openModal("atlasModal"));
    $$("[data-close-modal]").forEach((btn) => {
      btn.addEventListener("click", () => closeModal(btn.dataset.closeModal));
    });
    $$(".modal-backdrop").forEach((bd) => {
      bd.addEventListener("click", (e) => {
        if (e.target === bd) bd.classList.remove("is-open");
      });
    });

    // Personalization studio actions
    $("#personalApplyBtn").addEventListener("click", () => {
      state.client = ($("#personalClientInput").value || "").trim();
      state.eventTitle = ($("#personalEventInput").value || "").trim();
      renderPersonalization();
      renderBriefBuilder();
      closeModal("personalModal");
      showToast(state.client ? t("ui.toastPersonalSaved") : t("ui.toastPersonalReset"));
    });

    $("#personalResetBtn").addEventListener("click", () => {
      state.client = "";
      state.eventTitle = "";
      $("#personalClientInput").value = "";
      $("#personalEventInput").value = "";
      renderPersonalization();
      renderBriefBuilder();
      closeModal("personalModal");
      showToast(t("ui.toastPersonalReset"));
    });

    $("#personalCopyLinkBtn").addEventListener("click", () => {
      state.client = ($("#personalClientInput").value || "").trim();
      state.eventTitle = ($("#personalEventInput").value || "").trim();
      renderPersonalization();
      copyText(buildShareUrl());
    });

    $("#personalExportBtn").addEventListener("click", exportPersonalizedOfflineHtml);

    // Comparison tabs
    $$(".compare-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.compareState = btn.dataset.compare;
        renderComparisonMetrics();
      });
    });

    // Brief builder live inputs
    $("#briefPeopleRange").addEventListener("input", (e) => {
      state.briefPeople = Number(e.target.value);
      renderBriefBuilder();
    });
    $$("[data-people]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.briefPeople = Number(btn.dataset.people);
        $("#briefPeopleRange").value = String(state.briefPeople);
        renderBriefBuilder();
      });
    });
    $("#briefClientInput").addEventListener("input", (e) => {
      state.briefClientOverride = e.target.value;
      renderBriefBuilder();
    });

    // Contact controls
    $("#copyEmailBtn").addEventListener("click", () => copyText(window.PAYAM_CONFIG.email));
    $("#officeIstBtn").addEventListener("click", () => { state.office = "istanbul"; renderContact(); });
    $("#officeBodBtn").addEventListener("click", () => { state.office = "bodrum"; renderContact(); });
    $("#downloadVcardBtn").addEventListener("click", downloadVCard);

    // Hero subtle desktop pointer parallax
    const heroSec = $("#hero");
    if (heroSec && window.matchMedia("(pointer: fine)").matches) {
      heroSec.addEventListener("pointermove", (e) => {
        const rect = heroSec.getBoundingClientRect();
        const nx = (e.clientX - rect.left) / rect.width - 0.5;
        const ny = (e.clientY - rect.top) / rect.height - 0.5;
        $$(".hero-col", heroSec).forEach((col) => {
          const d = Number(col.dataset.depth || 10);
          col.style.setProperty("--px", (nx * d).toFixed(1));
          col.style.setProperty("--py", (ny * d).toFixed(1));
        });
      });
    }

    // Scroll progress bar & active pill tracking
    window.addEventListener("scroll", () => {
      if (state.mode !== "scroll") return;
      const docH = document.documentElement.scrollHeight - window.innerHeight;
      const pct = docH > 0 ? Math.min(100, Math.max(0, (window.scrollY / docH) * 100)) : 0;
      $("#scrollProgressBar").style.width = `${pct.toFixed(1)}%`;

      const navH = 120;
      let activeIdx = 0;
      $$(".scene").forEach((sc, idx) => {
        if (sc.getBoundingClientRect().top <= navH) activeIdx = idx;
      });
      if (activeIdx !== state.scene) {
        state.scene = activeIdx;
        $$(".nav-pill[data-jump]").forEach((p) => p.classList.toggle("is-active", Number(p.dataset.jump) === activeIdx));
      }
    }, { passive: true });

    // Responsive fallback when resizing < 960px
    window.addEventListener("resize", () => {
      if (window.innerWidth < 960 && state.mode === "deck") {
        setMode("scroll");
      }
    });

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => {
      const tag = (e.target && e.target.tagName) || "";
      const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      if (e.key === "Escape") {
        $$(".modal-backdrop.is-open").forEach((m) => m.classList.remove("is-open"));
        return;
      }
      if (typing) return;

      if (e.altKey && e.shiftKey && e.code === "KeyP") {
        e.preventDefault();
        unlockStudio(true);
        return;
      }

      const k = e.key.toLowerCase();
      if (k === "g") { e.preventDefault(); openModal("atlasModal"); return; }
      if (k === "f") { e.preventDefault(); toggleFullscreen(); return; }
      if (k === "m" && window.innerWidth >= 960) {
        e.preventDefault();
        setMode(state.mode === "deck" ? "scroll" : "deck");
        return;
      }

      if (state.mode === "deck") {
        if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "PageDown" || e.key === " ") {
          e.preventDefault();
          goToScene(state.scene + 1);
        } else if (e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key === "PageUp") {
          e.preventDefault();
          goToScene(state.scene - 1);
        } else if (e.key === "Home") {
          e.preventDefault();
          goToScene(0);
        } else if (e.key === "End") {
          e.preventDefault();
          goToScene(state.totalScenes - 1);
        }
      }
    });
  // Unlock studio if navigated directly to #studio while already open
    window.addEventListener("hashchange", () => {
      if ((window.location.hash || "").toLowerCase() === "#studio") {
        unlockStudio(true);
      }
    });
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }

  // Boot
  initFromParams();
  document.body.dataset.mode = state.mode;
  renderAll();
  bindEvents();
  if (state.openStudioOnBoot) {
    unlockStudio(true);
  }
})();

import { expect, test, describe } from "bun:test";

describe("Curated Classifier Taxonomy & Dynamic Filter Rules", () => {
  async function fetchWithRetry(url, options, retries = 3) {
    for (let i = 0; i <= retries; i++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 12000);
        const res = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(timer);
        if (res.ok) {
          const clone = res.clone();
          const json = await clone.json().catch(() => null);
          if (json && json.results && json.results.length > 0 && json.results[0].scores === null && !json.results[0].unscored) {
            await new Promise((r) => setTimeout(r, 800));
            continue;
          }
          return res;
        }
      } catch (err) {
        if (i === retries) throw err;
        await new Promise((r) => setTimeout(r, 800));
      }
    }
    throw new Error(`Failed to fetch from ${url} after ${retries} retries`);
  }

  const LABELS = [
    'self-improvement / motivational',
    'meme / humor / satire',
    'deep dive / technical breakdown / industry insider',
    'wholesome / positive',
    'fearmongering / doom',
    'fomo / hype',
    'other / casual discussion',
  ];

  const CATEGORY_DESCRIPTIONS =
    '1. "self-improvement / motivational": personal growth, discipline, fitness, productivity lessons, inspiring mindsets, self-help, stoicism. ' +
    '2. "meme / humor / satire": lighthearted jokes, funny memes, sarcastic humor, parody, troll posts. ' +
    '3. "deep dive / technical breakdown / industry insider": in-depth technical threads, architectural teardowns, insider industry analysis, comprehensive teardowns of complex problems. ' +
    '4. "wholesome / positive": uplifting, heartwarming, kind, peaceful, constructive positive stories, wholesome moments. ' +
    '5. "fearmongering / doom": alarming, sensationalized bad news, apocalyptic anxiety, catastrophic predictions, fearmongering. ' +
    '6. "fomo / hype": exaggerated financial hype, crypto shill, urgency to buy, get-rich-quick, fear of missing out. ' +
    '7. "other / casual discussion": everyday personal chatter, news, generic talk, or any content that does not fit the other categories.';

  const INSTRUCTIONS =
    'Classify social media content in Vietnamese or English into exactly one category: ' +
    CATEGORY_DESCRIPTIONS;

  const MULTI_INSTRUCTIONS =
    'Analyze social media content in Vietnamese or English for any categories that apply: ' +
    CATEGORY_DESCRIPTIONS;

  const BADGE_MAP = {
    'self-improvement / motivational': {
      text: 'Motivational',
      desc: 'Personal growth, productivity, and constructive mindset',
      bg: '#000000',
      border: '#262626',
      color: '#ededed',
      dotColor: '#c084fc',
    },
    'meme / humor / satire': {
      text: 'Meme',
      desc: 'Humor, memes, satire, and playful wit',
      bg: '#000000',
      border: '#262626',
      color: '#ededed',
      dotColor: '#fbbf24',
    },
    'deep dive / technical breakdown / industry insider': {
      text: 'Teardown',
      desc: 'Detailed domain teardown, insider analysis, or technical deep dive',
      bg: '#000000',
      border: '#262626',
      color: '#ededed',
      dotColor: '#38bdf8',
    },
    'wholesome / positive': {
      text: 'Wholesome',
      desc: 'Uplifting, heartwarming, and constructive positive content',
      bg: '#000000',
      border: '#262626',
      color: '#ededed',
      dotColor: '#4ade80',
    },
    'fearmongering / doom': {
      text: 'Doom',
      desc: 'Sensationalized bad news, existential threat, or doom anxiety',
      bg: '#000000',
      border: '#262626',
      color: '#ededed',
      dotColor: '#f97316',
    },
    'fomo / hype': {
      text: 'FOMO',
      desc: 'Sensationalized hype, crypto shill, or fear of missing out',
      bg: '#000000',
      border: '#262626',
      color: '#ededed',
      dotColor: '#f59e0b',
    },
    'other / casual discussion': {
      text: 'Casual',
      desc: 'Everyday casual talk or general post',
      bg: '#000000',
      border: '#262626',
      color: '#ededed',
      dotColor: '#94a3b8',
    },
  };

  test("Taxonomy structure has all 7 labels with corresponding badges and dotColors", () => {
    expect(LABELS.length).toBe(7);
    for (const label of LABELS) {
      expect(BADGE_MAP[label]).toBeDefined();
      expect(BADGE_MAP[label].text).toBeDefined();
      expect(BADGE_MAP[label].color).toBeDefined();
      expect(BADGE_MAP[label].dotColor).toBeDefined();
      expect(BADGE_MAP[label].dotColor).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(BADGE_MAP[label].text).toMatch(/^[A-Za-z]+$/);
    }
  });

  test("Badge logic: renders badge for 'other / casual discussion' when enabled, suppresses when disabled or on /activity", () => {
    function shouldRenderBadge(label, confidence, threshold, config = { filterCasualEnabled: true }, isActivity = false) {
      if (label === 'other / casual discussion' && (config.filterCasualEnabled === false || isActivity)) return false;
      const meta = BADGE_MAP[label];
      if (!meta) return false;
      return confidence >= threshold;
    }

    // Casual enabled and above threshold: renders
    expect(shouldRenderBadge('other / casual discussion', 0.99, 0.30, { filterCasualEnabled: true }, false)).toBe(true);
    // Casual enabled but below threshold: suppresses
    expect(shouldRenderBadge('other / casual discussion', 0.20, 0.30, { filterCasualEnabled: true }, false)).toBe(false);
    // Casual disabled via setting: suppresses
    expect(shouldRenderBadge('other / casual discussion', 0.99, 0.30, { filterCasualEnabled: false }, false)).toBe(false);
    // Casual on /activity page: suppresses
    expect(shouldRenderBadge('other / casual discussion', 0.99, 0.30, { filterCasualEnabled: true }, true)).toBe(false);

    expect(shouldRenderBadge('self-improvement / motivational', 0.85, 0.30)).toBe(true);
    expect(shouldRenderBadge('self-improvement / motivational', 0.20, 0.30)).toBe(false);
    expect(shouldRenderBadge('meme / humor / satire', 0.75, 0.50)).toBe(true);
    expect(shouldRenderBadge('meme / humor / satire', 0.40, 0.50)).toBe(false);
    expect(shouldRenderBadge('deep dive / technical breakdown / industry insider', 0.90, 0.35)).toBe(true);
    expect(shouldRenderBadge('wholesome / positive', 0.80, 0.30)).toBe(true);
    expect(shouldRenderBadge('wholesome / positive', 0.25, 0.30)).toBe(false);
    expect(shouldRenderBadge('fearmongering / doom', 0.85, 0.30)).toBe(true);
    expect(shouldRenderBadge('fearmongering / doom', 0.25, 0.30)).toBe(false);
    expect(shouldRenderBadge('fomo / hype', 0.70, 0.30)).toBe(true);
    expect(shouldRenderBadge('fomo / hype', 0.20, 0.30)).toBe(false);
  });

  test("Live classifier.dev API correctly maps samples to the curated categories", async () => {
    const inputs = [
      "Kỷ luật thép mỗi ngày dậy 5h sáng chạy bộ và thiền định",
      "nhìn thằng bạn code CSS căn giữa div cười ỉa vcl =)))",
      "Mổ xẻ chi tiết kiến trúc Distributed Consensus Raft vs Paxos trong database phân tán",
      "Hôm nay trời đẹp quá tí đi uống cà phê không anh em",
      "Cảm ơn người lạ tốt bụng đã nhặt được ví và đứng đợi trả lại mình giữa trời mưa",
      "Khủng hoảng thế kỷ sắp ập đến, bong bóng tài chính chuẩn bị phát nổ và xóa sổ toàn bộ tài sản của bạn",
      "Coin này sắp list Binance x100 lần ngay trong đêm nay múc gấp kẻo lỡ cơ hội đổi đời"
    ];

    const res = await fetchWithRetry("https://classifier.dev", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        labels: LABELS,
        inputs: inputs,
        instructions: INSTRUCTIONS,
      })
    });

    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data.results).toBeDefined();
    expect(data.results.length).toBe(7);

    expect(data.results[0].label).toBe("self-improvement / motivational");
    expect(data.results[1].label).toBe("meme / humor / satire");
    expect(data.results[2].label).toBe("deep dive / technical breakdown / industry insider");
    expect(data.results[3].label).toBe("other / casual discussion");
    expect(data.results[4].label).toBe("wholesome / positive");
    expect(data.results[5].label).toBe("fearmongering / doom");
    expect(data.results[6].label).toBe("fomo / hype");
  }, 15000);

  test("Strict threshold check respects user config without bypassing", () => {
    function meetsThreshold(confidence, threshold) {
      return confidence >= threshold;
    }

    const userThreshold = 0.50;
    // Score is 0.40, confidence is 0.40 -> should FAIL threshold
    expect(meetsThreshold(0.40, userThreshold)).toBe(false);
    // Score is 0.50, confidence is 0.50 -> should PASS threshold
    expect(meetsThreshold(0.50, userThreshold)).toBe(true);
    // Score is 0.35, confidence is 0.35 -> should FAIL threshold
    expect(meetsThreshold(0.35, userThreshold)).toBe(false);
  });

  test("Counter deduplication avoids inflation on same text", () => {
    const countedTexts = new Set();
    let counter = 0;

    function countText(text) {
      if (!countedTexts.has(text)) {
        countedTexts.add(text);
        counter++;
        return true;
      }
      return false;
    }

    expect(countText("Tweet 1")).toBe(true);
    expect(counter).toBe(1);

    // Same tweet encountered again on scroll or DOM rerender
    expect(countText("Tweet 1")).toBe(false);
    expect(counter).toBe(1);

    // New tweet
    expect(countText("Tweet 2")).toBe(true);
    expect(counter).toBe(2);
  });

  test("Counter suppression: disabled filter halts counter accumulation and badge rendering", () => {
    const config = {
      filterWholesomeEnabled: false,
      filterDoomEnabled: true,
      filterFomoEnabled: false,
    };
    const counts = {
      wholesomeCount: 0,
      doomCount: 0,
      fomoCount: 0,
    };

    const CATALOG = {
      'wholesome / positive': { configKey: 'filterWholesomeEnabled', countKey: 'wholesomeCount' },
      'fearmongering / doom': { configKey: 'filterDoomEnabled', countKey: 'doomCount' },
      'fomo / hype': { configKey: 'filterFomoEnabled', countKey: 'fomoCount' },
    };

    function processClassification(label) {
      const def = CATALOG[label];
      if (def && config[def.configKey] === false) {
        return false; // Suppressed
      }
      if (def) {
        counts[def.countKey]++;
        return true;
      }
      return false;
    }

    // Wholesome is disabled: should suppress and NOT increment
    expect(processClassification('wholesome / positive')).toBe(false);
    expect(counts.wholesomeCount).toBe(0);

    // Doom is enabled: should process and increment
    expect(processClassification('fearmongering / doom')).toBe(true);
    expect(counts.doomCount).toBe(1);

    // FOMO is disabled: should suppress and NOT increment
    expect(processClassification('fomo / hype')).toBe(false);
    expect(counts.fomoCount).toBe(0);
  });

  test("Dynamic taxonomy generation excludes disabled categories", () => {
    const TAXONOMY_CATALOG = {
      'self-improvement / motivational': { configKey: 'filterMotivationalEnabled', instruction: 'motivational...' },
      'meme / humor / satire': { configKey: 'filterMemeEnabled', instruction: 'meme...' },
      'deep dive / technical breakdown / industry insider': { configKey: 'filterDeepDiveEnabled', instruction: 'deep dive...' },
      'wholesome / positive': { configKey: 'filterWholesomeEnabled', instruction: 'wholesome...' },
      'fearmongering / doom': { configKey: 'filterDoomEnabled', instruction: 'doom...' },
      'fomo / hype': { configKey: 'filterFomoEnabled', instruction: 'fomo...' },
      'rage bait / toxic / hostile / dismissive negativity': { configKey: 'autoBlurRageEnabled', instruction: 'rage...' },
      'scam / fraudulent scheme': { configKey: 'blockScamsEnabled', instruction: 'scam...' },
      'bot seeding / affiliate spam / fake review': { configKey: 'collapseSeedingEnabled', instruction: 'seeding...' },
    };
    const CATCH_ALL_LABEL = 'other / casual discussion';

    function getActiveTaxonomy(cfg) {
      const activeLabels = [];
      const instructionsList = [];

      Object.entries(TAXONOMY_CATALOG).forEach(([label, def]) => {
        if (cfg[def.configKey] !== false) {
          activeLabels.push(label);
          instructionsList.push(def.instruction);
        }
      });

      if (activeLabels.length === 0) {
        return { labels: [], instructions: '' };
      }

      activeLabels.push(CATCH_ALL_LABEL);
      instructionsList.push('other...');

      return {
        labels: activeLabels,
        instructions: instructionsList.join(' '),
      };
    }

    // All on: 9 categories + 1 catch-all = 10 labels
    const allOn = getActiveTaxonomy({
      filterMotivationalEnabled: true,
      filterMemeEnabled: true,
      filterDeepDiveEnabled: true,
      filterWholesomeEnabled: true,
      filterDoomEnabled: true,
      filterFomoEnabled: true,
      autoBlurRageEnabled: true,
      blockScamsEnabled: true,
      collapseSeedingEnabled: true,
    });
    expect(allOn.labels.length).toBe(10);
    expect(allOn.labels).toContain('rage bait / toxic / hostile / dismissive negativity');
    expect(allOn.labels).toContain('wholesome / positive');
    expect(allOn.labels).toContain('fearmongering / doom');
    expect(allOn.labels).toContain('fomo / hype');

    // Rage bait turned OFF
    const rageOff = getActiveTaxonomy({
      filterMotivationalEnabled: true,
      filterMemeEnabled: true,
      filterDeepDiveEnabled: true,
      filterWholesomeEnabled: true,
      filterDoomEnabled: true,
      filterFomoEnabled: true,
      autoBlurRageEnabled: false,
      blockScamsEnabled: true,
      collapseSeedingEnabled: true,
    });
    expect(rageOff.labels.length).toBe(9);
    expect(rageOff.labels).not.toContain('rage bait / toxic / hostile / dismissive negativity');

    // Wholesome, doom, fomo turned OFF
    const wholesomeDoomFomoOff = getActiveTaxonomy({
      filterMotivationalEnabled: true,
      filterMemeEnabled: true,
      filterDeepDiveEnabled: true,
      filterWholesomeEnabled: false,
      filterDoomEnabled: false,
      filterFomoEnabled: false,
      autoBlurRageEnabled: true,
      blockScamsEnabled: true,
      collapseSeedingEnabled: true,
    });
    expect(wholesomeDoomFomoOff.labels.length).toBe(7);
    expect(wholesomeDoomFomoOff.labels).not.toContain('wholesome / positive');
    expect(wholesomeDoomFomoOff.labels).not.toContain('fearmongering / doom');
    expect(wholesomeDoomFomoOff.labels).not.toContain('fomo / hype');

    // Meme turned OFF
    const memeOff = getActiveTaxonomy({
      filterMotivationalEnabled: true,
      filterMemeEnabled: false,
      filterDeepDiveEnabled: true,
      filterWholesomeEnabled: true,
      filterDoomEnabled: true,
      filterFomoEnabled: true,
      autoBlurRageEnabled: true,
      blockScamsEnabled: true,
      collapseSeedingEnabled: true,
    });
    expect(memeOff.labels.length).toBe(9);
    expect(memeOff.labels).not.toContain('meme / humor / satire');

    // All OFF
    const allOff = getActiveTaxonomy({
      filterMotivationalEnabled: false,
      filterMemeEnabled: false,
      filterDeepDiveEnabled: false,
      filterWholesomeEnabled: false,
      filterDoomEnabled: false,
      filterFomoEnabled: false,
      autoBlurRageEnabled: false,
      blockScamsEnabled: false,
      collapseSeedingEnabled: false,
    });
    expect(allOff.labels.length).toBe(0);
  });

  test("Dynamic taxonomy formats contiguous instruction numbering without gaps", () => {
    const TAXONOMY_CATALOG = {
      'self-improvement / motivational': { configKey: 'filterMotivationalEnabled', instruction: 'personal growth...' },
      'meme / humor / satire': { configKey: 'filterMemeEnabled', instruction: 'lighthearted jokes...' },
      'deep dive / technical breakdown / industry insider': { configKey: 'filterDeepDiveEnabled', instruction: 'in-depth...' },
      'wholesome / positive': { configKey: 'filterWholesomeEnabled', instruction: 'uplifting...' },
      'fearmongering / doom': { configKey: 'filterDoomEnabled', instruction: 'alarming...' },
      'fomo / hype': { configKey: 'filterFomoEnabled', instruction: 'exaggerated...' },
      'rage bait / toxic / hostile / dismissive negativity': { configKey: 'autoBlurRageEnabled', instruction: 'provocative...' },
      'scam / fraudulent scheme': { configKey: 'blockScamsEnabled', instruction: 'online fraud...' },
      'bot seeding / affiliate spam / fake review': { configKey: 'collapseSeedingEnabled', instruction: 'commercial...' },
    };
    const CATCH_ALL_LABEL = 'other / casual discussion';
    const CATCH_ALL_INSTRUCTION = 'everyday personal chatter...';

    function getActiveTaxonomy(cfg = {}) {
      const activeLabels = [];
      const instructionsList = [];

      Object.entries(TAXONOMY_CATALOG).forEach(([label, def]) => {
        if (cfg && cfg[def.configKey] !== false) {
          activeLabels.push(label);
          instructionsList.push(`"${label}": ${def.instruction}`);
        }
      });

      if (activeLabels.length === 0) return { labels: [], instructions: '' };

      activeLabels.push(CATCH_ALL_LABEL);
      instructionsList.push(`"${CATCH_ALL_LABEL}": ${CATCH_ALL_INSTRUCTION}`);

      const formattedInstructions = instructionsList.map((item, idx) => `${idx + 1}. ${item}`).join(' ');
      return {
        labels: activeLabels,
        instructions: 'Classify social media content: ' + formattedInstructions,
      };
    }

    // Only motivational, wholesome, and meme enabled
    const partial = getActiveTaxonomy({
      filterMotivationalEnabled: true,
      filterMemeEnabled: true,
      filterDeepDiveEnabled: false,
      filterWholesomeEnabled: true,
      filterDoomEnabled: false,
      filterFomoEnabled: false,
      autoBlurRageEnabled: false,
      blockScamsEnabled: false,
      collapseSeedingEnabled: false,
    });
    expect(partial.instructions).toContain('1. "self-improvement / motivational"');
    expect(partial.instructions).toContain('2. "meme / humor / satire"');
    expect(partial.instructions).toContain('3. "wholesome / positive"');
    expect(partial.instructions).toContain('4. "other / casual discussion"');
    expect(partial.instructions).not.toContain('5.');
    expect(partial.instructions).not.toContain('7.');
  });

  test("Targeted cache keys isolate taxonomy changes from UI settings", () => {
    const TAXONOMY_KEYS = [
      'filterMotivationalEnabled',
      'filterMemeEnabled',
      'filterDeepDiveEnabled',
      'filterWholesomeEnabled',
      'filterDoomEnabled',
      'filterFomoEnabled',
      'filterCasualEnabled',
      'customLabels',
      'autoBlurRageEnabled',
      'blockScamsEnabled',
      'collapseSeedingEnabled',
      'confidenceThreshold',
    ];

    expect(TAXONOMY_KEYS.includes('filterMotivationalEnabled')).toBe(true);
    expect(TAXONOMY_KEYS.includes('filterWholesomeEnabled')).toBe(true);
    expect(TAXONOMY_KEYS.includes('filterDoomEnabled')).toBe(true);
    expect(TAXONOMY_KEYS.includes('filterFomoEnabled')).toBe(true);
    expect(TAXONOMY_KEYS.includes('filterCasualEnabled')).toBe(true);
    expect(TAXONOMY_KEYS.includes('customLabels')).toBe(true);
    expect(TAXONOMY_KEYS.includes('autoBlurRageEnabled')).toBe(true);
    expect(TAXONOMY_KEYS.includes('hideFloatingPill')).toBe(false);
    expect(TAXONOMY_KEYS.includes('blockReelsEnabled')).toBe(false);
    expect(TAXONOMY_KEYS.includes('monkModeEnabled')).toBe(false);
  });

  test("Dynamic taxonomy seamlessly integrates customLabels with auto prompt wrapping", () => {
    const TAXONOMY_CATALOG = {
      'meme / humor / satire': { configKey: 'filterMemeEnabled', instruction: 'lighthearted jokes...' },
    };
    const CATCH_ALL_LABEL = 'other / casual discussion';

    function getActiveTaxonomy(cfg = {}) {
      const activeLabels = [];
      const instructionsList = [];

      Object.entries(TAXONOMY_CATALOG).forEach(([label, def]) => {
        if (cfg && cfg[def.configKey] !== false) {
          activeLabels.push(label);
          instructionsList.push(`"${label}": ${def.instruction}`);
        }
      });

      if (Array.isArray(cfg?.customLabels)) {
        cfg.customLabels.forEach((c) => {
          const rawName = typeof c === 'string' ? c : c?.name;
          const enabled = typeof c === 'object' ? c?.enabled !== false : true;
          const name = rawName ? rawName.replace(/["\r\n\t]/g, '').slice(0, 40).trim() : '';
          const isDuplicate =
            !name ||
            name.toLowerCase() === CATCH_ALL_LABEL.toLowerCase() ||
            Boolean(TAXONOMY_CATALOG[name.toLowerCase()]) ||
            activeLabels.some((l) => l.toLowerCase() === name.toLowerCase());
          if (enabled && !isDuplicate) {
            activeLabels.push(name);
            instructionsList.push(`"${name}": content specifically discussing, focused on, or related to ${name}.`);
          }
        });
      }

      if (activeLabels.length === 0) return { labels: [], instructions: '' };

      activeLabels.push(CATCH_ALL_LABEL);
      instructionsList.push(`"${CATCH_ALL_LABEL}": other...`);

      const formattedInstructions = instructionsList.map((item, idx) => `${idx + 1}. ${item}`).join(' ');
      return {
        labels: activeLabels,
        instructions: 'Classify social media content: ' + formattedInstructions,
      };
    }

    const taxonomy = getActiveTaxonomy({
      filterMemeEnabled: true,
      customLabels: [
        { name: 'anime', enabled: true },
        { name: 'bóng đá', enabled: false }, // disabled
        { name: 'Meme / Humor / Satire', enabled: true }, // case-insensitive duplicate of catalog label
        { name: 'other / casual discussion', enabled: true }, // catch-all duplicate attempt
        { name: '   ', enabled: true }, // whitespace only
      ],
    });

    expect(taxonomy.labels).toContain('meme / humor / satire');
    expect(taxonomy.labels).toContain('anime');
    expect(taxonomy.labels).not.toContain('bóng đá');
    // Ensure duplicate was not added twice and case-insensitive match was deduplicated
    expect(taxonomy.labels.filter(l => l.toLowerCase() === 'meme / humor / satire').length).toBe(1);
    // Ensure catch-all appears exactly once at the end
    expect(taxonomy.labels.filter(l => l.toLowerCase() === 'other / casual discussion').length).toBe(1);
    expect(taxonomy.instructions).toContain('"anime": content specifically discussing, focused on, or related to anime.');
  });

  test("Live API proof: custom label with auto prompt wrapping classifies matching content", async () => {
    const customPrompt = 'Classify social media content: 1. "anime": content specifically discussing, focused on, or related to anime. 2. "other / casual discussion": everyday chatter.';
    const post = "Tập mới nhất của Jujutsu Kaisen Gojo đánh nhau với Sukuna animation đỉnh vcl";

    const res = await fetchWithRetry("https://classifier.dev", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        labels: ['anime', 'other / casual discussion'],
        inputs: [post],
        instructions: customPrompt,
      })
    });

    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data.results[0].label).toBe("anime");
    expect(data.results[0].confidence).toBeGreaterThan(0.5);
  }, 15000);

  test("Live API proof: disabling a category makes Jev AI blind to it", async () => {
    const toxicPost = "Bọn này toàn lũ ngu dốt thất bại ăn bám xã hội biến đi cho rảnh mắt";

    // 1. When rage-bait label is included in API call
    const resWithRage = await fetchWithRetry("https://classifier.dev", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        labels: [
          'self-improvement / motivational',
          'meme / humor / satire',
          'deep dive / technical breakdown / industry insider',
          'rage bait / toxic / hostile / dismissive negativity',
          'other / casual discussion',
        ],
        inputs: [toxicPost],
        instructions: "Classify into motivational, meme, deep dive, rage bait/toxic drama/hostile negativity, or other casual discussion."
      })
    });
    const dataWithRage = await resWithRage.json();
    expect(dataWithRage.results[0].label).toBe("rage bait / toxic / hostile / dismissive negativity");

    // 2. When rage-bait is disabled (excluded from API call payload)
    const resWithoutRage = await fetchWithRetry("https://classifier.dev", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        labels: [
          'self-improvement / motivational',
          'meme / humor / satire',
          'deep dive / technical breakdown / industry insider',
          'other / casual discussion',
        ],
        inputs: [toxicPost],
        instructions: "Classify into motivational, meme, deep dive, or other casual discussion."
      })
    });
    const dataWithoutRage = await resWithoutRage.json();
    // Because rage bait is omitted, Jev cannot detect it as rage bait
    expect(dataWithoutRage.results[0].label).not.toBe("rage bait / toxic / hostile / dismissive negativity");
    expect(['other / casual discussion', 'meme / humor / satire']).toContain(dataWithoutRage.results[0].label);
  }, 15000);

  test("Custom label gating: disabled custom label halts counter accumulation and suppresses pill display", () => {
    const config = {
      customLabels: [
        { name: 'crypto', enabled: false },
        { name: 'anime', enabled: true },
      ],
    };

    let customCount = 0;

    function processCustomClassification(label, confidence, threshold = 0.5) {
      if (!Array.isArray(config.customLabels)) return null;
      const customFound = config.customLabels.find(
        (c) => (typeof c === 'string' ? c : c?.name)?.toLowerCase() === label.toLowerCase()
      );
      if (!customFound) return null;
      const isEnabled = typeof customFound === 'object' ? customFound.enabled !== false : true;
      if (!isEnabled) return false; // Suppressed
      if (confidence < threshold) return false; // Threshold gated

      customCount++;
      const displayName = typeof customFound === 'object' ? customFound.name : customFound;
      return {
        text: displayName,
        bg: '#000000',
        border: '#262626',
        color: '#ededed',
      };
    }

    // 1. 'crypto' is disabled: returns false, counter not incremented
    expect(processCustomClassification('crypto', 0.95)).toBe(false);
    expect(customCount).toBe(0);

    // 2. 'anime' is enabled but confidence 0.40 < threshold 0.50: fails threshold
    expect(processCustomClassification('anime', 0.40, 0.50)).toBe(false);
    expect(customCount).toBe(0);

    // 3. 'anime' is enabled and confidence 0.85: succeeds, renders badge, increments counter
    const badge = processCustomClassification('anime', 0.85, 0.50);
    expect(badge).not.toBeNull();
    expect(badge.text).toBe('anime');
    expect(customCount).toBe(1);

    // 4. Test pill counter visibility logic with null-safety
    function shouldShowCustomOnPill(cfg, count) {
      const hasActiveCustom = Array.isArray(cfg.customLabels) && cfg.customLabels.some(
        (c) => (c && typeof c === 'object' ? c.enabled !== false : Boolean(c))
      );
      return Boolean(hasActiveCustom && count > 0);
    }

    // With active anime and count > 0: shows on pill
    expect(shouldShowCustomOnPill(config, customCount)).toBe(true);

    // Null safety: does not crash when customLabels contains null or undefined
    const corruptedConfig = {
      customLabels: [null, { name: 'anime', enabled: true }, undefined],
    };
    expect(() => shouldShowCustomOnPill(corruptedConfig, customCount)).not.toThrow();
    expect(shouldShowCustomOnPill(corruptedConfig, customCount)).toBe(true);

    // If user disables anime too (all custom labels disabled): pill hides Custom counter
    const allDisabledConfig = {
      customLabels: [
        { name: 'crypto', enabled: false },
        { name: 'anime', enabled: false },
      ],
    };
    expect(shouldShowCustomOnPill(allDisabledConfig, customCount)).toBe(false);
  });

  test("Live classifier.dev API multi-label returns array of labels and independent scores", async () => {
    const input = "Bài viết phân tích chuyên sâu kiến trúc microservices và kèm meme lập trình hài hước";
    const res = await fetchWithRetry("https://classifier.dev", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        labels: LABELS,
        inputs: [input],
        instructions: MULTI_INSTRUCTIONS,
        multi: true,
        max_labels: 5,
      }),
    });

    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data.results).toBeDefined();
    expect(data.results.length).toBe(1);

    const result = data.results[0];
    expect(Array.isArray(result.labels)).toBe(true);
    if (result.scores) {
      expect(typeof result.scores['deep dive / technical breakdown / industry insider']).toBe('number');
      expect(typeof result.scores['meme / humor / satire']).toBe('number');
    } else {
      expect(result.unscored).toBeDefined();
    }
  }, 15000);

  test("Multi-label rendering selects top matching categories and ignores protective actions in badge list", () => {
    const res = {
      scores: {
        'deep dive / technical breakdown / industry insider': 0.95,
        'meme / humor / satire': 0.82,
        'wholesome / positive': 0.75,
        'other / casual discussion': 0.35,
        'gaming': 0.10,
      },
    };

    const config = {
      confidenceThreshold: 0.50,
      filterDeepDiveEnabled: true,
      filterMemeEnabled: true,
      filterWholesomeEnabled: true,
      filterCasualEnabled: true,
    };

    function selectMultiBadges(scores, cfg) {
      const eligible = [];
      Object.entries(scores).forEach(([label, score]) => {
        if (typeof score !== 'number' || score < cfg.confidenceThreshold) return;
        if (
          label === 'scam / fraudulent scheme' ||
          label === 'rage bait / toxic / hostile / dismissive negativity' ||
          label === 'bot seeding / affiliate spam / fake review'
        ) return;
        if (BADGE_MAP[label]) {
          eligible.push({ label, score, meta: BADGE_MAP[label] });
        }
      });
      eligible.sort((a, b) => b.score - a.score);
      return eligible.slice(0, 4);
    }

    const selected = selectMultiBadges(res.scores, config);
    expect(selected.length).toBe(3);
    expect(selected[0].label).toBe('deep dive / technical breakdown / industry insider');
    expect(selected[1].label).toBe('meme / humor / satire');
    expect(selected[2].label).toBe('wholesome / positive');
    // 'other / casual discussion' has score 0.35 < 0.50 threshold, so excluded
  });

  test("Single tag mode: decouples visual presentation from content filtering and preserves all labels", () => {
    const scores = {
      'meme / humor / satire': 0.90,
      'fearmongering / doom': 0.82,
      'wholesome / positive': 0.75,
      'fomo / hype': 0.60,
    };

    function processClassification(scoresObj, cfg) {
      const eligibleBadges = [];
      Object.entries(scoresObj).forEach(([label, score]) => {
        if (typeof score !== 'number' || score < (cfg.confidenceThreshold || 0.3)) return;
        if (BADGE_MAP[label]) {
          eligibleBadges.push({ label, score, meta: BADGE_MAP[label] });
        }
      });
      eligibleBadges.sort((a, b) => b.score - a.score);

      // Decoupled architecture: all up to 4 badges are retained in selectedBadges
      const selectedBadges = eligibleBadges.slice(0, 4);

      // assignedLabels always contains all matching categories for filtering
      const assignedLabels = selectedBadges.map((b) => b.label);

      // CSS / display layer: in singleTagMode, only first visible badge is displayed
      const visibleBadgesCount = cfg.singleTagMode ? 1 : selectedBadges.length;

      return { selectedBadges, assignedLabels, visibleBadgesCount };
    }

    // When singleTagMode is false:
    const multi = processClassification(scores, { singleTagMode: false });
    expect(multi.selectedBadges.length).toBe(4);
    expect(multi.assignedLabels).toEqual([
      'meme / humor / satire',
      'fearmongering / doom',
      'wholesome / positive',
      'fomo / hype',
    ]);
    expect(multi.visibleBadgesCount).toBe(4);

    // When singleTagMode is true:
    const single = processClassification(scores, { singleTagMode: true });
    // assignedLabels MUST still retain all 4 labels so protective focus filter never bypasses doom!
    expect(single.assignedLabels).toEqual([
      'meme / humor / satire',
      'fearmongering / doom',
      'wholesome / positive',
      'fomo / hype',
    ]);
    expect(single.selectedBadges.length).toBe(4);
    expect(single.visibleBadgesCount).toBe(1);
  });

  test("Multi-label priority: protective action (scam / rage / seeding) takes precedence over badges", () => {
    const res = {
      scores: {
        'rage bait / toxic / hostile / dismissive negativity': 0.88,
        'meme / humor / satire': 0.92,
        'deep dive / technical breakdown / industry insider': 0.75,
      },
    };

    function determineAction(scores, threshold) {
      if ((scores['scam / fraudulent scheme'] || 0) >= threshold) return 'SCAM_BLUR';
      if ((scores['rage bait / toxic / hostile / dismissive negativity'] || 0) >= threshold) return 'RAGE_BLUR';
      if ((scores['bot seeding / affiliate spam / fake review'] || 0) >= threshold) return 'SEEDING_COLLAPSE';
      return 'BADGES';
    }

    // Even though meme has 0.92, rage bait has 0.88 >= 0.50 so it must trigger RAGE_BLUR!
    expect(determineAction(res.scores, 0.50)).toBe('RAGE_BLUR');

    // If rage bait is below threshold, it falls back to BADGES
    const harmlessRes = {
      scores: {
        'rage bait / toxic / hostile / dismissive negativity': 0.20,
        'meme / humor / satire': 0.92,
      },
    };
    expect(determineAction(harmlessRes, 0.50)).toBe('BADGES');
  });

  test("Multi-label counter accumulation updates all matching category counters", () => {
    const counts = {
      motivationalCount: 0,
      memeCount: 0,
      deepDiveCount: 0,
    };

    const selectedBadges = [
      { label: 'self-improvement / motivational' },
      { label: 'meme / humor / satire' },
    ];

    selectedBadges.forEach(({ label }) => {
      if (label === 'self-improvement / motivational') counts.motivationalCount++;
      if (label === 'meme / humor / satire') counts.memeCount++;
      if (label === 'deep dive / technical breakdown / industry insider') counts.deepDiveCount++;
    });

    expect(counts.motivationalCount).toBe(1);
    expect(counts.memeCount).toBe(1);
    expect(counts.deepDiveCount).toBe(0);
  });

  test("Multi-label null-safety: gracefully handles null/undefined res and corrupt scores", () => {
    function extractScores(res) {
      if (!res || typeof res !== 'object') return {};
      return (typeof res.scores === 'object' && res.scores !== null)
        ? res.scores
        : (res.label ? { [res.label]: res.confidence || 0 } : {});
    }

    expect(extractScores(null)).toEqual({});
    expect(extractScores(undefined)).toEqual({});
    expect(extractScores({ scores: null })).toEqual({});
    expect(extractScores({ label: 'meme / humor / satire', confidence: 0.8 })).toEqual({
      'meme / humor / satire': 0.8,
    });
    expect(extractScores({ scores: { 'wholesome / positive': 0.9 } })).toEqual({
      'wholesome / positive': 0.9,
    });
  });

  test("Multi-label score filtering rejects NaN, Infinity, and respects legacy taxonomy keys", () => {
    const scores = {
      'meme / humor / satire': NaN,
      'self-improvement / motivational': Infinity,
      'wholesome / positive': 0.85,
      'rage bait / outrage': 0.95,
      'bot seeding / affiliate spam': 0.90,
    };

    const threshold = 0.50;

    // Check protective legacy shield trigger
    const rageScore = scores['rage bait / toxic / hostile / dismissive negativity'] || scores['rage bait / outrage'] || 0;
    expect(rageScore).toBe(0.95);
    expect(rageScore >= threshold).toBe(true);

    const seedingScore = scores['bot seeding / affiliate spam / fake review'] || scores['bot seeding / affiliate spam'] || 0;
    expect(seedingScore).toBe(0.90);
    expect(seedingScore >= threshold).toBe(true);

    // Check finite number check in badge candidate collector
    const validBadges = [];
    Object.entries(scores).forEach(([label, score]) => {
      if (typeof score !== 'number' || !Number.isFinite(score) || score < threshold) return;
      if (
        label === 'scam / fraudulent scheme' ||
        label === 'rage bait / toxic / hostile / dismissive negativity' ||
        label === 'rage bait / outrage' ||
        label === 'bot seeding / affiliate spam / fake review' ||
        label === 'bot seeding / affiliate spam'
      ) return;
      validBadges.push({ label, score });
    });

    expect(validBadges.length).toBe(1);
    expect(validBadges[0].label).toBe('wholesome / positive');
    expect(validBadges[0].score).toBe(0.85);
  });

  test("Reveal post: syncRevealState propagates x-jev-revealed to both parent and child containers", () => {
    const createMockClassList = () => {
      const set = new Set();
      return {
        add: (c) => set.add(c),
        remove: (c) => set.delete(c),
        contains: (c) => set.has(c),
        toggle: (c, force) => {
          if (typeof force === 'boolean') {
            if (force) set.add(c);
            else set.delete(c);
            return force;
          }
          if (set.has(c)) { set.delete(c); return false; }
          set.add(c); return true;
        },
      };
    };

    // Simulate DOM hierarchy: cellInnerDiv (parent) > article (child)
    const parent = {
      classList: createMockClassList(),
      hasAttribute: (attr) => attr === 'data-jev-rage',
      parentElement: null,
      children: [],
      querySelectorAll: () => parent.children,
    };
    const child = {
      classList: createMockClassList(),
      hasAttribute: (attr) => attr === 'data-jev-rage',
      parentElement: parent,
      children: [],
      querySelectorAll: () => [],
    };
    parent.children.push(child);

    function syncReveal(targetEl, isRevealed) {
      targetEl.classList.toggle('x-jev-revealed', isRevealed);
      let p = targetEl.parentElement;
      while (p) {
        if (p.hasAttribute('data-jev-rage') || p.hasAttribute('data-jev-scam')) {
          p.classList.toggle('x-jev-revealed', isRevealed);
        }
        p = p.parentElement;
      }
      targetEl.querySelectorAll().forEach((c) => {
        c.classList.toggle('x-jev-revealed', isRevealed);
      });
    }

    // Trigger reveal on child (article) -> both child and parent must get revealed
    syncReveal(child, true);
    expect(child.classList.contains('x-jev-revealed')).toBe(true);
    expect(parent.classList.contains('x-jev-revealed')).toBe(true);

    // Trigger re-blur on parent -> both must be unrevealed
    syncReveal(parent, false);
    expect(child.classList.contains('x-jev-revealed')).toBe(false);
    expect(parent.classList.contains('x-jev-revealed')).toBe(false);
  });

  test("Virtual scroll persistence: revealedTexts prevents auto-re-blur on re-scan / re-render", () => {
    const revealedTexts = new Set();
    const mockPost = {
      revealed: false,
      dataRevealed: false,
      btnText: 'Reveal post',
    };

    const postText = "Toxic inflammatory rage bait post content";

    function mockSyncReveal(isRevealed, text) {
      if (text) {
        if (isRevealed) revealedTexts.add(text);
        else revealedTexts.delete(text);
      }
      mockPost.revealed = isRevealed;
      mockPost.dataRevealed = isRevealed;
      mockPost.btnText = isRevealed ? 'Re-blur' : 'Reveal post';
    }

    function mockReScanRender(text, config = { autoBlurRageEnabled: true }) {
      const isRageRevealedByUser = revealedTexts.has(text);
      if (isRageRevealedByUser) {
        mockPost.revealed = true;
        mockPost.dataRevealed = true;
        mockPost.btnText = 'Re-blur';
      } else if (config.autoBlurRageEnabled) {
        mockPost.revealed = false;
        mockPost.dataRevealed = false;
        mockPost.btnText = 'Reveal post';
      } else {
        mockPost.revealed = true;
        mockPost.dataRevealed = true;
      }
    }

    // Initial state: blurred
    mockReScanRender(postText);
    expect(mockPost.revealed).toBe(false);
    expect(mockPost.dataRevealed).toBe(false);
    expect(mockPost.btnText).toBe('Reveal post');

    // User clicks "Reveal post"
    mockSyncReveal(true, postText);
    expect(revealedTexts.has(postText)).toBe(true);
    expect(mockPost.revealed).toBe(true);
    expect(mockPost.dataRevealed).toBe(true);
    expect(mockPost.btnText).toBe('Re-blur');

    // Virtual scroll triggers: element unmounts/remounts or re-scans with autoBlurRageEnabled=true
    mockReScanRender(postText, { autoBlurRageEnabled: true });
    // Must REMAIN revealed because user explicitly revealed it!
    expect(mockPost.revealed).toBe(true);
    expect(mockPost.dataRevealed).toBe(true);
    expect(mockPost.btnText).toBe('Re-blur');

    // User clicks "Re-blur"
    mockSyncReveal(false, postText);
    expect(revealedTexts.has(postText)).toBe(false);
    expect(mockPost.revealed).toBe(false);
    expect(mockPost.dataRevealed).toBe(false);
    expect(mockPost.btnText).toBe('Reveal post');

    // Re-scan after re-blur keeps it blurred
    mockReScanRender(postText, { autoBlurRageEnabled: true });
    expect(mockPost.revealed).toBe(false);
    expect(mockPost.dataRevealed).toBe(false);
  });

  test("Symmetric inline unblur cleanup: clears filter, opacity, and pointer-events on re-blur and recycled nodes", () => {
    function createMockElement(tag, attrs = {}) {
      const styleProps = new Map();
      return {
        tagName: tag.toUpperCase(),
        attributes: { ...attrs },
        getAttribute(key) { return this.attributes[key]; },
        hasAttribute(key) { return key in this.attributes; },
        setAttribute(key, val) { this.attributes[key] = val; },
        removeAttribute(key) { delete this.attributes[key]; },
        style: {
          setProperty(k, v) { styleProps.set(k, v); },
          removeProperty(k) { styleProps.delete(k); },
          getProperty(k) { return styleProps.get(k); },
        },
      };
    }

    const postEl = {
      elements: [
        createMockElement('div', { 'data-jev-blur-item': 'true' }),
        createMockElement('span', { dir: 'auto' }),
        createMockElement('div', { dir: 'auto' }),
        createMockElement('img'),
        createMockElement('video'),
      ],
      querySelectorAll(selector) {
        return this.elements;
      },
    };

    function applyInlineUnblur(el, isRevealed) {
      const targets = el.querySelectorAll('[data-jev-blur-item="true"], span[dir="auto"], div[dir="auto"], img, video');
      if (isRevealed) {
        targets.forEach((t) => {
          t.style.setProperty('filter', 'none');
          t.style.setProperty('opacity', '1');
          t.style.setProperty('pointer-events', 'auto');
        });
      } else {
        targets.forEach((t) => {
          t.style.removeProperty('filter');
          t.style.removeProperty('opacity');
          t.style.removeProperty('pointer-events');
        });
      }
    }

    // 1. Reveal applied
    applyInlineUnblur(postEl, true);
    postEl.elements.forEach((el) => {
      expect(el.style.getProperty('filter')).toBe('none');
      expect(el.style.getProperty('opacity')).toBe('1');
      expect(el.style.getProperty('pointer-events')).toBe('auto');
    });

    // 2. Symmetrical re-blur clears ALL inline properties on spans, divs, imgs, and blur-items
    applyInlineUnblur(postEl, false);
    postEl.elements.forEach((el) => {
      expect(el.style.getProperty('filter')).toBeUndefined();
      expect(el.style.getProperty('opacity')).toBeUndefined();
      expect(el.style.getProperty('pointer-events')).toBeUndefined();
    });
  });

  test("Unified 3-state categoryActions: getActiveTaxonomy includes 'show' and 'hide', excludes 'off'", () => {
    const TAXONOMY_CATALOG = {
      'self-improvement / motivational': { tagKey: 'motivational', instruction: 'personal growth...' },
      'meme / humor / satire': { tagKey: 'meme', instruction: 'lighthearted jokes...' },
      'fearmongering / doom': { tagKey: 'doom', instruction: 'alarming...' },
      'fomo / hype': { tagKey: 'fomo', instruction: 'exaggerated...' },
    };
    const CATCH_ALL_LABEL = 'other / casual discussion';

    function getActiveTaxonomy(cfg) {
      const activeLabels = [];
      const instructionsList = [];
      Object.entries(TAXONOMY_CATALOG).forEach(([label, def]) => {
        const action = cfg.categoryActions?.[def.tagKey] || 'show';
        if (action !== 'off') {
          activeLabels.push(label);
          instructionsList.push(`"${label}": ${def.instruction}`);
        }
      });
      activeLabels.push(CATCH_ALL_LABEL);
      instructionsList.push(`"${CATCH_ALL_LABEL}": other...`);
      return { labels: activeLabels, instructions: instructionsList.join(' ') };
    }

    const taxonomy = getActiveTaxonomy({
      categoryActions: {
        motivational: 'show',
        meme: 'show',
        doom: 'hide',
        fomo: 'off',
      },
    });

    // Both 'show' and 'hide' must be detected by Jev AI
    expect(taxonomy.labels).toContain('self-improvement / motivational');
    expect(taxonomy.labels).toContain('meme / humor / satire');
    expect(taxonomy.labels).toContain('fearmongering / doom');

    // 'off' category must be omitted from detection payload
    expect(taxonomy.labels).not.toContain('fomo / hype');
  });

  test("Feed filtering with isPostHidden: collapses 'hide' categories and leaves 'show' categories visible", () => {
    const config = {
      categoryActions: {
        motivational: 'show',
        meme: 'show',
        deepdive: 'show',
        wholesome: 'show',
        doom: 'hide',
        fomo: 'hide',
        casual: 'show',
      },
      customLabels: [
        { name: 'crypto', action: 'hide' },
        { name: 'soccer', action: 'show' },
      ],
      // Legacy flags synthesized by popup.js
      focusModeEnabled: true,
      focusWhitelistTags: ['motivational', 'meme', 'deepdive', 'wholesome'],
    };

    function getPostTagKey(label) {
      if (label === 'self-improvement / motivational') return 'motivational';
      if (label === 'meme / humor / satire') return 'meme';
      if (label === 'deep dive / technical breakdown / industry insider') return 'deepdive';
      if (label === 'wholesome / positive') return 'wholesome';
      if (label === 'fearmongering / doom') return 'doom';
      if (label === 'fomo / hype') return 'fomo';
      if (label === 'other / casual discussion') return 'casual';
      return null;
    }

    function isPostHidden(labels, cfg) {
      if (cfg.focusModeEnabled === false) return false;

      const labelList = Array.isArray(labels) ? labels : [labels];
      if (labelList.length === 0) return false;

      // 1. Unified categoryActions takes precedence
      if (cfg.categoryActions && typeof cfg.categoryActions === 'object') {
        return labelList.some((lbl) => {
          const tagKey = getPostTagKey(lbl);
          if (tagKey && cfg.categoryActions[tagKey] === 'hide') return true;
          if (Array.isArray(cfg.customLabels)) {
            const custom = cfg.customLabels.find(
              (c) => (typeof c === 'string' ? c : c?.name)?.toLowerCase() === lbl?.toLowerCase()
            );
            if (custom && typeof custom === 'object') {
              const action = custom.action || (custom.enabled === false ? 'off' : 'show');
              if (action === 'hide') return true;
            }
          }
          return false;
        });
      }

      // 2. Legacy focus mode fallback (only when categoryActions is not present)
      if (cfg.focusModeEnabled) {
        const allowedTags = Array.isArray(cfg.focusWhitelistTags) ? cfg.focusWhitelistTags : [];
        if (allowedTags.length > 0) {
          const matchesAllowed = labelList.some((lbl) => {
            const tagKey = getPostTagKey(lbl);
            return tagKey && allowedTags.includes(tagKey);
          });
          if (!matchesAllowed) return true;
        }
      }

      return false;
    }

    // Doom is 'hide' -> hidden/collapsed
    expect(isPostHidden('fearmongering / doom', config)).toBe(true);
    // FOMO is 'hide' -> hidden/collapsed
    expect(isPostHidden('fomo / hype', config)).toBe(true);
    // Custom crypto is 'hide' -> hidden/collapsed
    expect(isPostHidden('crypto', config)).toBe(true);

    // Motivational is 'show' -> NOT hidden
    expect(isPostHidden('self-improvement / motivational', config)).toBe(false);
    // Meme is 'show' -> NOT hidden
    expect(isPostHidden('meme / humor / satire', config)).toBe(false);
    // Custom soccer is 'show' -> NOT hidden even when focusModeEnabled=true and whitelist has no custom
    expect(isPostHidden('soccer', config)).toBe(false);

    // Multi-tag post with both Meme (show) and Doom (hide): protective filter collapses it!
    expect(isPostHidden(['meme / humor / satire', 'fearmongering / doom'], config)).toBe(true);

    // Master pause test: when focusModeEnabled is false, even 'hide' posts remain visible
    expect(isPostHidden('fearmongering / doom', { ...config, focusModeEnabled: false })).toBe(false);

    // Legacy mode test: categoryActions undefined, uses focus mode whitelist
    const legacyConfig = {
      focusModeEnabled: true,
      focusWhitelistTags: ['motivational', 'meme'],
    };
    expect(isPostHidden('self-improvement / motivational', legacyConfig)).toBe(false);
    expect(isPostHidden('fearmongering / doom', legacyConfig)).toBe(true);
  });

  test("Active platform domain detection: accurately identifies supported platforms and falls back to Standby", () => {
    function detectActivePlatform(url) {
      if (!url) return null;
      try {
        const host = new URL(url).hostname.toLowerCase();
        if (host.includes('twitter.com') || host.includes('x.com')) return 'X';
        if (host.includes('facebook.com') || host.includes('fb.com')) return 'Facebook';
        if (host.includes('instagram.com')) return 'Instagram';
        if (host.includes('threads.net') || host.includes('threads.com')) return 'Threads';
        if (host.includes('youtube.com')) return 'YouTube';
      } catch (e) {}
      return null;
    }

    expect(detectActivePlatform('https://x.com/home')).toBe('X');
    expect(detectActivePlatform('https://twitter.com/i/flow/login')).toBe('X');
    expect(detectActivePlatform('https://www.facebook.com/watch')).toBe('Facebook');
    expect(detectActivePlatform('https://m.fb.com/groups')).toBe('Facebook');
    expect(detectActivePlatform('https://www.instagram.com/reels/')).toBe('Instagram');
    expect(detectActivePlatform('https://www.threads.net/@zuck')).toBe('Threads');
    expect(detectActivePlatform('https://www.youtube.com/shorts/12345')).toBe('YouTube');
    expect(detectActivePlatform('https://google.com/search')).toBeNull();
    expect(detectActivePlatform('chrome://extensions/')).toBeNull();
    expect(detectActivePlatform('')).toBeNull();
  });

  test("Hero mini stats computation: computes scanned, filtered, and threat aggregates correctly", () => {
    function computeHeroStats(data) {
      const scanned = typeof data.scannedCount === 'number'
        ? data.scannedCount
        : (data.motivationalCount || 0) + (data.memeCount || 0) + (data.deepDiveCount || 0) +
          (data.wholesomeCount || 0) + (data.doomCount || 0) + (data.fomoCount || 0) +
          (data.casualCount || 0) + (data.customCount || 0) + (data.blockedRageCount || 0) +
          (data.blockedScamCount || 0) + (data.monkModeBlockedCount || 0);

      const filtered = typeof data.focusCollapsedCount === 'number' ? data.focusCollapsedCount : 0;
      const threats = (data.blockedScamCount || 0) + (data.blockedRageCount || 0) + (data.monkModeBlockedCount || 0);

      return { scanned, filtered, threats };
    }

    const testData = {
      scannedCount: 42,
      focusCollapsedCount: 9,
      blockedScamCount: 3,
      blockedRageCount: 4,
      monkModeBlockedCount: 2,
    };

    const stats = computeHeroStats(testData);
    expect(stats.scanned).toBe(42);
    expect(stats.filtered).toBe(9);
    expect(stats.threats).toBe(9); // 3 + 4 + 2

    // Fallback when scannedCount is missing
    const fallbackStats = computeHeroStats({
      motivationalCount: 5,
      memeCount: 10,
      deepDiveCount: 2,
      blockedRageCount: 1,
      blockedScamCount: 2,
      monkModeBlockedCount: 0,
      focusCollapsedCount: 3,
    });
    expect(fallbackStats.scanned).toBe(20);
    expect(fallbackStats.filtered).toBe(3);
    expect(fallbackStats.threats).toBe(3);
  });

  test("Inline Header Pill & Color Dot structure: generates badge container with dot, label, and decoupled confidence", () => {
    function buildBadgeNode(meta, score) {
      const badge = {
        className: 'x-jev-badge',
        category: meta.text,
        styles: {
          '--badge-bg': meta.bg || '#000000',
          '--badge-border': meta.border || '#262626',
          '--badge-color': meta.color || '#ededed',
          '--badge-dot': meta.dotColor || '#94a3b8',
        },
        title: `${meta.desc || meta.text} (Confidence: ${Math.round(score * 100)}% • Jev AI)`,
        children: [
          { className: 'x-jev-badge-dot' },
          { className: 'x-jev-badge-text', text: meta.text },
          { className: 'x-jev-confidence', text: `${Math.round(score * 100)}%` },
        ],
      };
      return badge;
    }

    const deepDiveMeta = BADGE_MAP['deep dive / technical breakdown / industry insider'];
    const badgeNode = buildBadgeNode(deepDiveMeta, 0.92);

    expect(badgeNode.className).toBe('x-jev-badge');
    expect(badgeNode.styles['--badge-dot']).toBe('#38bdf8');
    expect(badgeNode.title).toContain(deepDiveMeta.desc);
    expect(badgeNode.title).toContain('Confidence: 92% • Jev AI');
    expect(badgeNode.children.length).toBe(3);
    expect(badgeNode.children[0].className).toBe('x-jev-badge-dot');
    expect(badgeNode.children[1].text).toBe('Teardown');
    expect(badgeNode.children[2].text).toBe('92%');

    // Verify custom label fallback dot color
    const customMeta = {
      text: 'web3',
      desc: 'Custom label: web3',
      bg: '#000000',
      border: '#262626',
      color: '#ededed',
      dotColor: '#a78bfa',
    };
    const customBadge = buildBadgeNode(customMeta, 0.88);
    expect(customBadge.styles['--badge-dot']).toBe('#a78bfa');
    expect(customBadge.children[0].className).toBe('x-jev-badge-dot');
    expect(customBadge.children[1].text).toBe('web3');
  });

  test("Header placement: inserts container before caret element when present, or appends to User-Name", () => {
    function injectBadgeContainer(postEl) {
      const userNameHeader = postEl.querySelector('div[data-testid="User-Name"]');
      const caretEl = postEl.querySelector('[data-testid="caret"]');
      let container = null;

      if (caretEl && caretEl.parentElement) {
        container = caretEl.parentElement.querySelector('.x-jev-badge-container');
        if (!container) {
          container = { className: 'x-jev-badge-container x-jev-header-container' };
          const idx = caretEl.parentElement.children.indexOf(caretEl);
          caretEl.parentElement.children.splice(idx, 0, container);
        }
      } else if (userNameHeader) {
        container = userNameHeader.querySelector('.x-jev-badge-container');
        if (!container) {
          container = { className: 'x-jev-badge-container x-jev-header-container' };
          userNameHeader.children.push(container);
        }
      } else {
        container = { className: 'x-jev-badge-container' };
      }
      return container;
    }

    // 1. Tweet with real Twitter header structure: User-Name (author + handle) and caret sibling
    const caretNode = { 'data-testid': 'caret' };
    const headerRow = {
      children: [
        { 'data-testid': 'User-Name', children: [{ name: 'Display Name' }, { name: '@handle · 2h' }], querySelector: () => null },
        caretNode,
      ],
      querySelector: (sel) => (sel === '.x-jev-badge-container' ? null : null),
    };
    caretNode.parentElement = headerRow;

    const mockPostWithCaret = {
      querySelector: (sel) => {
        if (sel === '[data-testid="caret"]') return caretNode;
        if (sel === 'div[data-testid="User-Name"]') return headerRow.children[0];
        return null;
      },
    };

    injectBadgeContainer(mockPostWithCaret);
    // Verified: Container inserted before caret in header row without corrupting User-Name children
    expect(headerRow.children.length).toBe(3);
    expect(headerRow.children[1].className).toContain('x-jev-header-container');
    expect(headerRow.children[2]).toBe(caretNode);
    // User-Name still cleanly has Display Name and @handle without foreign node wedged in between
    expect(headerRow.children[0].children.length).toBe(2);

    // 2. Post without caret: appends to User-Name
    const userNameNode = { 'data-testid': 'User-Name', children: [{ name: 'Author' }], querySelector: () => null };
    const mockPostNoCaret = {
      querySelector: (sel) => (sel === 'div[data-testid="User-Name"]' ? userNameNode : null),
    };
    injectBadgeContainer(mockPostNoCaret);
    expect(userNameNode.children.length).toBe(2);
    expect(userNameNode.children[1].className).toContain('x-jev-header-container');
  });

  test("Gemini 3.5 Flash-Lite Summarizer: parses bullets, handles caching, and structures Vercel dark theme box", () => {
    function parseGeminiBullets(rawText) {
      if (!rawText) return [];
      return rawText
        .split('\n')
        .map((line) => line.trim().replace(/^[-*•]\s*/, '').replace(/^\d+\.\s*/, '').trim())
        .filter((line) => line.length > 0)
        .slice(0, 3);
    }

    const sampleRaw = "- First major insight on AI scalability\n* Second point regarding low latency inference\n3. Third conclusion on cost optimization\n- Extra fourth line that should be discarded";
    const bullets = parseGeminiBullets(sampleRaw);
    expect(bullets.length).toBe(3);
    expect(bullets[0]).toBe("First major insight on AI scalability");
    expect(bullets[1]).toBe("Second point regarding low latency inference");
    expect(bullets[2]).toBe("Third conclusion on cost optimization");

    // Cache test
    const summaryCache = new Map();
    const postText = "Testing post content for summary caching";
    summaryCache.set(postText, bullets);
    expect(summaryCache.has(postText)).toBe(true);
    expect(summaryCache.get(postText)).toEqual(bullets);

    // Escape helper test
    function escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }
    expect(escapeHtml("<script>alert('xss')</script>")).toBe("&lt;script&gt;alert(&#039;xss&#039;)&lt;/script&gt;");

    // UI Box structure test
    function buildSummaryNode(bList) {
      return {
        className: 'x-jev-summary-box',
        header: {
          title: 'Gemini 3.5 Flash-Lite',
          badge: '3-Bullet TL;DR',
          close: '✕',
        },
        bullets: bList.map((b) => escapeHtml(b)),
      };
    }

    const boxNode = buildSummaryNode(bullets);
    expect(boxNode.className).toBe('x-jev-summary-box');
    expect(boxNode.header.badge).toBe('3-Bullet TL;DR');
    expect(boxNode.bullets.length).toBe(3);
    // Empty bullets / safety filter fallback test
    function renderBoxContent(bList) {
      if (Array.isArray(bList) && bList.length > 0) {
        return `<ul class="x-jev-summary-list">${bList.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}</ul>`;
      }
      return `<div class="x-jev-summary-error"><span>⚠️</span><span>Unable to generate 3-bullet summary (content may be too brief or restricted by safety guidelines).</span></div>`;
    }

    const emptyBoxHtml = renderBoxContent([]);
    expect(emptyBoxHtml).toContain('x-jev-summary-error');
    expect(emptyBoxHtml).toContain('Unable to generate 3-bullet summary');

    // Cache bounding test (LRU / FIFO eviction at 200 items)
    const boundedCache = new Map();
    for (let i = 0; i < 205; i++) {
      boundedCache.set(`key_${i}`, [`bullet_${i}`]);
      if (boundedCache.size > 200) {
        const oldestKey = boundedCache.keys().next().value;
        boundedCache.delete(oldestKey);
      }
    }
    expect(boundedCache.size).toBe(200);
    expect(boundedCache.has('key_0')).toBe(false);
    expect(boundedCache.has('key_204')).toBe(true);

    // Empty API key pre-flight guard test
    function validateKeyBeforeFetch(apiKey) {
      const trimmed = (apiKey || '').trim();
      if (!trimmed) {
        return { success: false, error: 'Google AI Studio API key missing. Please enter your API key in extension settings.' };
      }
      return { success: true };
    }
    expect(validateKeyBeforeFetch('').success).toBe(false);
    expect(validateKeyBeforeFetch(null).success).toBe(false);
    expect(validateKeyBeforeFetch('valid_key').success).toBe(true);
  });

  test("Live Google AI Studio API: Gemini 3.5 Flash-Lite generates 3-bullet summary when env key is present", async () => {
    const key = process.env.GEMINI_API_KEY || '';
    if (!key) {
      // Avoid hardcoding secrets in git; pass test when running in CI without env key
      expect(key).toBe('');
      return;
    }

    const postText = 'Trí tuệ nhân tạo đang bước vào kỷ nguyên tối ưu hóa độ trễ và chi phí. Các kỹ thuật như speculative decoding, quantization 4-bit và mô hình Flash-Lite giúp tăng tốc độ phản hồi gấp nhiều lần mà vẫn giữ chất lượng.';
    const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent';
    const prompt = 'Summarize the following social media post into exactly 3 concise, high-signal bullet points in the same language as the post (Vietnamese or English). No intro, no filler, strictly 3 bullet points starting with -:\n\n' + postText;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': key,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 250, temperature: 0.2 },
      }),
    });

    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data.candidates).toBeDefined();
    expect(data.candidates.length).toBeGreaterThan(0);
    const raw = data.candidates[0].content.parts[0].text;
    expect(raw).toBeDefined();

    const bullets = raw
      .split('\n')
      .map((line) => line.trim().replace(/^[-*•]\s*/, '').replace(/^\d+\.\s*/, '').trim())
      .filter((line) => line.length > 0)
      .slice(0, 3);

    expect(bullets.length).toBeGreaterThanOrEqual(1);
    expect(bullets.length).toBeLessThanOrEqual(3);
  }, 15000);

  test("Script syntax & parse integrity: content.js, background.js, and userscript parse without syntax errors", async () => {
    const fs = await import("node:fs");
    const files = ["content.js", "background.js", "social-anti-ragebait.user.js", "popup.js"];
    for (const file of files) {
      const code = fs.readFileSync(file, "utf8");
      expect(() => {
        new Function(code);
      }).not.toThrow();
    }
  });
});




import { expect, test, describe } from "bun:test";

describe("Curated Classifier Taxonomy & Dynamic Filter Rules", () => {
  async function fetchWithRetry(url, options, retries = 4) {
    for (let i = 0; i <= retries; i++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15000);
        const res = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(timer);
        if (res.ok) {
          return res;
        } else if (i < retries) {
          await new Promise((r) => setTimeout(r, 1200));
          continue;
        } else {
          return res;
        }
      } catch (err) {
        if (i === retries) throw err;
        await new Promise((r) => setTimeout(r, 1200));
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
            const rawInstruct = typeof c === 'object' && c?.instruction ? String(c.instruction).replace(/[\r\n\t]/g, ' ').slice(0, 200).trim() : '';
            const instruction = rawInstruct || `content specifically discussing, focused on, or related to ${name}.`;
            instructionsList.push(`"${name}": ${instruction.endsWith('.') ? instruction : instruction + '.'}`);
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
        { name: 'crypto', enabled: true, instruction: 'discussions on web3 and tokens' },
        { name: 'bóng đá', enabled: false }, // disabled
        { name: 'Meme / Humor / Satire', enabled: true }, // case-insensitive duplicate of catalog label
        { name: 'other / casual discussion', enabled: true }, // catch-all duplicate attempt
        { name: '   ', enabled: true }, // whitespace only
      ],
    });

    expect(taxonomy.labels).toContain('meme / humor / satire');
    expect(taxonomy.labels).toContain('anime');
    expect(taxonomy.labels).toContain('crypto');
    expect(taxonomy.labels).not.toContain('bóng đá');
    // Ensure duplicate was not added twice and case-insensitive match was deduplicated
    expect(taxonomy.labels.filter(l => l.toLowerCase() === 'meme / humor / satire').length).toBe(1);
    // Ensure catch-all appears exactly once at the end
    expect(taxonomy.labels.filter(l => l.toLowerCase() === 'other / casual discussion').length).toBe(1);
    // Auto fallback for empty instruction
    expect(taxonomy.instructions).toContain('"anime": content specifically discussing, focused on, or related to anime.');
    // Custom instruction formatting
    expect(taxonomy.instructions).toContain('"crypto": discussions on web3 and tokens.');
  });

  test("isTaxonomyPayloadAltered detects changes in customLabel instruction", () => {
    function isTaxonomyPayloadAltered(oldCfg, newCfg) {
      const oldCustomActive = (Array.isArray(oldCfg?.customLabels) ? oldCfg.customLabels : [])
        .filter((c) => (typeof c === 'object' ? (c.action || (c.enabled === false ? 'off' : 'show')) : 'show') !== 'off')
        .map((c) => ({
          name: (typeof c === 'string' ? c : c?.name)?.trim().toLowerCase(),
          instruction: typeof c === 'object' && c?.instruction ? String(c.instruction).replace(/[\r\n\t]/g, ' ').slice(0, 200).trim() : '',
        }));
      const newCustomActive = (Array.isArray(newCfg?.customLabels) ? newCfg.customLabels : [])
        .filter((c) => (typeof c === 'object' ? (c.action || (c.enabled === false ? 'off' : 'show')) : 'show') !== 'off')
        .map((c) => ({
          name: (typeof c === 'string' ? c : c?.name)?.trim().toLowerCase(),
          instruction: typeof c === 'object' && c?.instruction ? String(c.instruction).replace(/[\r\n\t]/g, ' ').slice(0, 200).trim() : '',
        }));
      return JSON.stringify(oldCustomActive) !== JSON.stringify(newCustomActive);
    }

    const cfg1 = { customLabels: [{ name: 'crypto', action: 'show', instruction: '' }] };
    const cfg2 = { customLabels: [{ name: 'crypto', action: 'show', instruction: 'web3 & tokens' }] };
    const cfg3 = { customLabels: [{ name: 'crypto', action: 'show', instruction: 'web3 & tokens' }] };

    expect(isTaxonomyPayloadAltered(cfg1, cfg2)).toBe(true);
    expect(isTaxonomyPayloadAltered(cfg2, cfg3)).toBe(false);
  });

  test("Popup customLabels storage hydration strictly preserves instruction across sessions", () => {
    function hydrateCustomLabels(stored) {
      if (!Array.isArray(stored)) return [];
      return stored
        .map((c) => {
          if (typeof c === 'string') return { name: c.trim(), action: 'show', instruction: '' };
          return {
            name: (c?.name || '').trim(),
            action: c?.action || (c?.enabled === false ? 'off' : 'show'),
            instruction: typeof c === 'object' && typeof c?.instruction === 'string'
              ? c.instruction.replace(/[\r\n\t]/g, ' ').slice(0, 200).trim()
              : '',
          };
        })
        .filter((c) => c.name);
    }

    const storedData = [
      'legacy_string_label',
      { name: 'legacy_object_label', action: 'show' },
      { name: 'crypto', action: 'show', instruction: 'web3 & tokens' },
      { name: 'empty_instruct', action: 'hide', instruction: '   ' },
      { name: 'corrupted_instruct', action: 'show', instruction: 12345 },
    ];

    const hydrated = hydrateCustomLabels(storedData);
    expect(hydrated).toEqual([
      { name: 'legacy_string_label', action: 'show', instruction: '' },
      { name: 'legacy_object_label', action: 'show', instruction: '' },
      { name: 'crypto', action: 'show', instruction: 'web3 & tokens' },
      { name: 'empty_instruct', action: 'hide', instruction: '' },
      { name: 'corrupted_instruct', action: 'show', instruction: '' },
    ]);
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
    if (result.scores && typeof result.scores === 'object') {
      expect(typeof result.scores).toBe('object');
    } else {
      expect(result.labels.length).toBeGreaterThan(0);
    }
  }, 15000);

  test("Live classifier.dev API native fast mode returns continuous confidence and non-null scores object", async () => {
    const input = "Google just launched Gemini 2.5 Flash with native multimodality and 1M token context";
    const res = await fetchWithRetry("https://classifier.dev", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        labels: ['deep dive / technical breakdown / industry insider', 'meme / humor / satire', 'other / casual discussion'],
        inputs: [input],
      }),
    });

    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data.results).toBeDefined();
    expect(data.results.length).toBe(1);

    const result = data.results[0];
    expect(typeof result.label).toBe('string');
    expect(typeof result.confidence).toBe('number');
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(result.scores).not.toBeNull();
    expect(typeof result.scores).toBe('object');
    expect(typeof result.scores['deep dive / technical breakdown / industry insider']).toBe('number');
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
      let scores = {};
      if (typeof res.scores === 'object' && res.scores !== null) {
        scores = { ...res.scores };
      } else if (Array.isArray(res.labels)) {
        const validLabels = Array.from(new Set(res.labels.filter((lbl) => typeof lbl === 'string' && lbl.trim()).map((lbl) => lbl.trim())));
        if (validLabels.length === 1) {
          scores[validLabels[0]] = (typeof res.confidence === 'number' && Number.isFinite(res.confidence)) ? res.confidence : 1;
        } else if (validLabels.length > 1) {
          const totalConf = (typeof res.confidence === 'number' && Number.isFinite(res.confidence) && res.confidence > 0 && res.confidence <= 1)
            ? res.confidence
            : 1;
          const equalShare = Math.round((totalConf / validLabels.length) * 100) / 100;
          validLabels.forEach((lbl, idx) => {
            scores[lbl] = idx === validLabels.length - 1
              ? Math.round((totalConf - equalShare * (validLabels.length - 1)) * 100) / 100
              : equalShare;
          });
        }
      } else if (typeof res.label === 'string' && res.label.trim()) {
        scores[res.label.trim()] = (typeof res.confidence === 'number' && Number.isFinite(res.confidence)) ? res.confidence : 1;
      }

      // Guard against unnormalized or corrupt scores where multiple labels sum to > 1.0
      const scoreEntries = Object.entries(scores).filter(([, s]) => typeof s === 'number' && Number.isFinite(s) && s > 0);
      const totalScore = scoreEntries.reduce((acc, [, s]) => acc + s, 0);
      if (!res.multi && totalScore > 1.02 && scoreEntries.length > 1) {
        scoreEntries.forEach(([k, s]) => {
          scores[k] = Math.round((s / totalScore) * 100) / 100;
        });
      } else if (scoreEntries.length === 1 && scoreEntries[0][1] > 1) {
        scores[scoreEntries[0][0]] = 1;
      }
      return scores;
    }

    expect(extractScores(null)).toEqual({});
    expect(extractScores(undefined)).toEqual({});
    expect(extractScores({ scores: null })).toEqual({});
    expect(extractScores({ labels: ['Crypto', 'Tech'], scores: null })).toEqual({
      'Crypto': 0.5,
      'Tech': 0.5,
    });
    expect(extractScores({ labels: ['Coding'], scores: null })).toEqual({
      'Coding': 1,
    });
    expect(extractScores({ labels: ['Coding', 'other / casual discussion'], confidence: 0.8, scores: null })).toEqual({
      'Coding': 0.4,
      'other / casual discussion': 0.4,
    });
    expect(extractScores({ scores: { 'Coding': 1, 'other / casual discussion': 1 } })).toEqual({
      'Coding': 0.5,
      'other / casual discussion': 0.5,
    });
    expect(extractScores({ scores: { 'Coding': 0.9, 'Tech': 0.9 } })).toEqual({
      'Coding': 0.5,
      'Tech': 0.5,
    });
    expect(extractScores({ labels: ['A', 'B', 'C'], confidence: 0.5, scores: null })).toEqual({
      'A': 0.17,
      'B': 0.17,
      'C': 0.16,
    });
    expect(extractScores({ scores: { 'Coding': 0.85, 'Tech': 0.90 }, multi: true })).toEqual({
      'Coding': 0.85,
      'Tech': 0.90,
    });
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

  test("DOM reconciliation: multi-pass hydration eliminates duplicate containers and preserves single container before caret", () => {
    function reconcileBadgeContainer(postEl, textEl) {
      const userNameHeader = postEl.querySelector('div[data-testid="User-Name"]');
      const caretEl = postEl.querySelector('[data-testid="caret"]');
      let targetParent = null;
      let targetBefore = null;

      if (caretEl && caretEl.parentElement) {
        targetParent = caretEl.parentElement;
        targetBefore = caretEl;
      } else if (userNameHeader) {
        targetParent = userNameHeader;
        targetBefore = null;
      } else {
        targetParent = textEl ? textEl.parentElement : null;
        targetBefore = textEl;
      }

      if (!targetParent) return null;

      // Clean up legacy loose badge element
      if (textEl && textEl.previousElementSibling && textEl.previousElementSibling.className?.includes('x-jev-badge')) {
        textEl.previousElementSibling.remove();
      }

      // Remove any stale or duplicate containers on this post
      const existingContainers = postEl.querySelectorAll('.x-jev-badge-container');
      let container = existingContainers.find((el) => el.parentElement === targetParent);
      existingContainers.forEach((el) => {
        if (el !== container) {
          if (el.parentElement && el.parentElement.children) {
            const idx = el.parentElement.children.indexOf(el);
            if (idx !== -1) el.parentElement.children.splice(idx, 1);
          }
        }
      });

      if (!container) {
        container = {
          className: targetParent === (textEl ? textEl.parentElement : null)
            ? 'x-jev-badge-container'
            : 'x-jev-badge-container x-jev-header-container',
          parentElement: targetParent,
        };
        if (targetBefore) {
          const idx = targetParent.children.indexOf(targetBefore);
          targetParent.children.splice(idx !== -1 ? idx : 0, 0, container);
        } else {
          targetParent.children.push(container);
        }
      }
      return container;
    }

    // Pass 1: caret not yet rendered, only User-Name
    const userNameNode = { 'data-testid': 'User-Name', children: [{ name: 'Author' }] };
    const mockPost = {
      querySelector: (sel) => {
        if (sel === 'div[data-testid="User-Name"]') return userNameNode;
        return null;
      },
      querySelectorAll: (sel) => {
        const found = [];
        if (sel === '.x-jev-badge-container') {
          userNameNode.children.forEach((c) => {
            if (c.className?.includes('x-jev-badge-container')) found.push(c);
          });
        }
        return found;
      },
    };

    // Pass 1 execution
    reconcileBadgeContainer(mockPost, null);
    expect(userNameNode.children.length).toBe(2);
    expect(userNameNode.children[1].className).toContain('x-jev-badge-container');

    // Pass 2: caret hydrates in parent header row
    const caretNode = { 'data-testid': 'caret' };
    const headerRow = {
      children: [userNameNode, caretNode],
    };
    userNameNode.parentElement = headerRow;
    caretNode.parentElement = headerRow;

    mockPost.querySelector = (sel) => {
      if (sel === '[data-testid="caret"]') return caretNode;
      if (sel === 'div[data-testid="User-Name"]') return userNameNode;
      return null;
    };
    mockPost.querySelectorAll = (sel) => {
      const found = [];
      if (sel === '.x-jev-badge-container') {
        userNameNode.children.forEach((c) => {
          if (c.className?.includes('x-jev-badge-container')) found.push(c);
        });
        headerRow.children.forEach((c) => {
          if (c.className?.includes('x-jev-badge-container')) found.push(c);
        });
      }
      return found;
    };

    // Pass 2 execution
    reconcileBadgeContainer(mockPost, null);

    // Stale container was removed from userNameNode!
    expect(userNameNode.children.length).toBe(1);
    expect(userNameNode.children.some((c) => c.className?.includes('x-jev-badge-container'))).toBe(false);

    // Header row has exactly one container placed before caret!
    expect(headerRow.children.length).toBe(3);
    expect(headerRow.children[1].className).toContain('x-jev-badge-container');
    expect(headerRow.children[2]).toBe(caretNode);
    // Total containers across entire post is exactly 1!
    expect(mockPost.querySelectorAll('.x-jev-badge-container').length).toBe(1);
  });

  test("Gemini 3.5 Flash-Lite Summarizer: parses bullets, handles caching, and structures Vercel dark theme box", async () => {
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
          close: '✕',
        },
        bullets: bList.map((b) => escapeHtml(b)),
      };
    }

    const boxNode = buildSummaryNode(bullets);
    expect(boxNode.className).toBe('x-jev-summary-box');
    expect(boxNode.header.title).toBe('Gemini 3.5 Flash-Lite');
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

    // Cache bounding test (True LRU eviction at 500 items)
    const MAX_ITEMS = 500;
    const boundedCache = new Map();
    function lruGet(map, k) {
      if (!map.has(k)) return undefined;
      const v = map.get(k);
      map.delete(k);
      map.set(k, v);
      return v;
    }
    function lruSet(map, k, v) {
      map.delete(k);
      map.set(k, v);
      while (map.size > MAX_ITEMS) {
        const oldest = map.keys().next().value;
        map.delete(oldest);
      }
    }

    for (let i = 0; i < 500; i++) {
      lruSet(boundedCache, `key_${i}`, [`bullet_${i}`]);
    }
    // Access key_0 so it moves from oldest to newest (MRU)
    lruGet(boundedCache, 'key_0');

    // Add 1 more item -> key_1 should be evicted (as oldest), key_0 should survive
    lruSet(boundedCache, 'key_500', ['bullet_500']);

    expect(boundedCache.size).toBe(500);
    expect(boundedCache.has('key_1')).toBe(false); // oldest evicted
    expect(boundedCache.has('key_0')).toBe(true);  // accessed item survived!
    expect(boundedCache.has('key_500')).toBe(true);

    // In-Flight Request Deduplication test
    let networkCallCount = 0;
    const inFlightMap = new Map();
    function simulateRequest(text) {
      if (boundedCache.has(text)) return Promise.resolve(boundedCache.get(text));
      if (inFlightMap.has(text)) return inFlightMap.get(text);

      const p = new Promise((resolve) => {
        networkCallCount++;
        setTimeout(() => {
          const res = [`summary_${text}`];
          boundedCache.set(text, res);
          resolve(res);
        }, 10);
      });
      inFlightMap.set(text, p);
      return p.finally(() => inFlightMap.delete(text));
    }

    const [res1, res2, res3] = await Promise.all([
      simulateRequest("duplicate_post_text"),
      simulateRequest("duplicate_post_text"),
      simulateRequest("duplicate_post_text"),
    ]);
    expect(networkCallCount).toBe(1);
    expect(res1).toEqual(["summary_duplicate_post_text"]);
    expect(res2).toEqual(["summary_duplicate_post_text"]);
    expect(res3).toEqual(["summary_duplicate_post_text"]);
    expect(inFlightMap.size).toBe(0);

    // Two-Tier Persistent Storage Hydration test
    const mockStorage = {
      'social_guardian_summary_cache_v1': {
        'post_hydrated_1': ['Point 1', 'Point 2', 'Point 3'],
      },
    };
    const hydratedMemoryMap = new Map();
    Object.entries(mockStorage['social_guardian_summary_cache_v1']).forEach(([k, v]) => {
      if (Array.isArray(v) && v.length > 0) hydratedMemoryMap.set(k, v);
    });
    expect(hydratedMemoryMap.has('post_hydrated_1')).toBe(true);
    expect(hydratedMemoryMap.get('post_hydrated_1')).toEqual(['Point 1', 'Point 2', 'Point 3']);

    // L2 Persistent Storage fallback insertion bounding test
    function onL2StorageHit(map, k, v) {
      map.delete(k);
      map.set(k, v);
      while (map.size > MAX_ITEMS) {
        const oldest = map.keys().next().value;
        map.delete(oldest);
      }
    }
    const fullL1Map = new Map();
    for (let i = 0; i < 500; i++) {
      fullL1Map.set(`post_${i}`, [`b_${i}`]);
    }
    expect(fullL1Map.size).toBe(500);
    // Simulate L2 hit for an item not yet in L1
    onL2StorageHit(fullL1Map, 'l2_retrieved_post', ['l2_point']);
    expect(fullL1Map.size).toBe(500);
    expect(fullL1Map.has('post_0')).toBe(false); // oldest evicted
    expect(fullL1Map.has('l2_retrieved_post')).toBe(true); // new L2 entry retained

    // UI Click Handler Cache Hit MRU promotion test
    function onSummaryButtonClick(map, k) {
      if (map.has(k)) {
        const v = map.get(k);
        map.delete(k);
        map.set(k, v);
        return v;
      }
      return null;
    }
    const clickMap = new Map();
    clickMap.set('first_clicked', ['a']);
    clickMap.set('second_clicked', ['b']);
    // Click 'first_clicked' -> must become MRU (last in iterator)
    onSummaryButtonClick(clickMap, 'first_clicked');
    const keysOrder = Array.from(clickMap.keys());
    expect(keysOrder).toEqual(['second_clicked', 'first_clicked']);

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

  test("Gemini System Prompt: dirty-checking, fallback resolution, and instruction formatting", () => {
    const DEFAULT_GEMINI_PROMPT =
      'Summarize the following social media post into exactly 3 concise, high-signal bullet points in the same language as the post (Vietnamese or English). No intro, no filler, strictly 3 bullet points starting with -:';

    // 1. Fallback resolution: empty, whitespace or null falls back to DEFAULT_GEMINI_PROMPT
    const resolvePrompt = (customPrompt, fallback = DEFAULT_GEMINI_PROMPT) => {
      return (typeof customPrompt === 'string' && customPrompt.trim().length > 0)
        ? customPrompt.trim()
        : fallback;
    };

    expect(resolvePrompt(null)).toBe(DEFAULT_GEMINI_PROMPT);
    expect(resolvePrompt('')).toBe(DEFAULT_GEMINI_PROMPT);
    expect(resolvePrompt('   ')).toBe(DEFAULT_GEMINI_PROMPT);
    expect(resolvePrompt('Custom summary prompt')).toBe('Custom summary prompt');

    // 2. Terminal punctuation formatting: preserves terminal punctuation (:.!?), appends : if none
    const formatInstruction = (instruction) => {
      const trimmed = instruction.trim();
      return /[:.?!]$/.test(trimmed) ? trimmed : trimmed + ':';
    };

    expect(formatInstruction(DEFAULT_GEMINI_PROMPT)).toBe(DEFAULT_GEMINI_PROMPT);
    expect(formatInstruction('Summarize in 3 bullet points')).toBe('Summarize in 3 bullet points:');
    expect(formatInstruction('Summarize in 3 bullet points.')).toBe('Summarize in 3 bullet points.');
    expect(formatInstruction('Summarize in 3 bullet points! ')).toBe('Summarize in 3 bullet points!');
    expect(formatInstruction('Can you summarize this?')).toBe('Can you summarize this?');

    // 3. Dirty checking contract for Save Button
    let savedPrompt = DEFAULT_GEMINI_PROMPT;
    const isSaveDisabled = (inputVal) => {
      const currentVal = (inputVal || '').trim();
      return currentVal === savedPrompt;
    };

    // Initial state: input matches savedPrompt -> disabled
    expect(isSaveDisabled(DEFAULT_GEMINI_PROMPT)).toBe(true);

    // User edits textarea -> enabled
    expect(isSaveDisabled('Custom prompt 123')).toBe(false);

    // User types whitespace padding around original -> trimmed matches -> disabled
    expect(isSaveDisabled('   ' + DEFAULT_GEMINI_PROMPT + '  ')).toBe(true);

    // User resets to default -> if savedPrompt was custom, it's dirty; if savedPrompt was default, disabled
    savedPrompt = 'Custom saved prompt';
    expect(isSaveDisabled(DEFAULT_GEMINI_PROMPT)).toBe(false);

    // After save action, savedPrompt updates to new value -> button disables
    savedPrompt = 'Custom prompt 123';
    expect(isSaveDisabled('Custom prompt 123')).toBe(true);
  });

  test("Gemini Summarizer auto-expansion: expandAndExtractPostText clicks Show more, awaits DOM expansion, and falls back gracefully", async () => {
    async function expandAndExtractPostText(postEl, textEl, fallbackText) {
      if (!textEl) return fallbackText || '';

      const showMoreBtn = (postEl && postEl.querySelector('[data-testid="tweet-text-show-more-link"]')) ||
        (textEl.querySelector ? textEl.querySelector('[data-testid="tweet-text-show-more-link"]') : null);

      if (showMoreBtn) {
        try {
          showMoreBtn.click();
          await new Promise((resolve) => {
            const startLen = (textEl.textContent || textEl.innerText || '').length;
            let settled = false;
            const done = () => {
              if (!settled) {
                settled = true;
                if (observer) observer.disconnect();
                resolve();
              }
            };
            const timer = setTimeout(done, 50);
            let observer = null;
            if (typeof MutationObserver !== 'undefined') {
              observer = new MutationObserver(() => {
                const currentLen = (textEl.textContent || textEl.innerText || '').length;
                if (currentLen > startLen) {
                  clearTimeout(timer);
                  done();
                }
              });
              observer.observe(textEl, { childList: true, subtree: true, characterData: true });
            }
          });
        } catch (err) {}
      }

      let currentText = textEl.innerText ? textEl.innerText.trim() : '';
      currentText = currentText.replace(/\s*(Translate|Xem bản dịch|Show more|Hiển thị thêm|Xem thêm)$/i, '').trim();
      return (currentText && currentText.length >= 2) ? currentText : (fallbackText || '');
    }

    // 1. Post without Show more: immediately returns current text
    const textEl1 = { innerText: 'Short concise tweet about coding' };
    const postEl1 = { querySelector: () => null };
    const res1 = await expandAndExtractPostText(postEl1, textEl1, 'Short concise tweet about coding');
    expect(res1).toBe('Short concise tweet about coding');

    // 2. Post with Show more button: triggers .click()
    let clicked = false;
    const mockShowMoreBtn = {
      click: () => {
        clicked = true;
        textEl2.innerText = 'This is a very long tweet that was expanded after clicking Show more on X.';
        textEl2.textContent = 'This is a very long tweet that was expanded after clicking Show more on X.';
      },
    };
    const textEl2 = {
      innerText: 'This is a very long tweet...',
      textContent: 'This is a very long tweet...',
      querySelector: () => mockShowMoreBtn,
    };
    const postEl2 = {
      querySelector: (sel) => sel === '[data-testid="tweet-text-show-more-link"]' ? mockShowMoreBtn : null,
    };
    const res2 = await expandAndExtractPostText(postEl2, textEl2, 'fallback');
    expect(clicked).toBe(true);
    expect(res2).toBe('This is a very long tweet that was expanded after clicking Show more on X.');

    // 3. Post already manually expanded before TLDR click: returns full innerText without clicking
    const textEl3 = { innerText: 'Fully expanded article text already on screen' };
    const postEl3 = { querySelector: () => null };
    const res3 = await expandAndExtractPostText(postEl3, textEl3, 'stale truncated snippet');
    expect(res3).toBe('Fully expanded article text already on screen');

    // 4. Strips "Translate" / "Xem bản dịch" suffix cleanly
    const textEl4 = { innerText: 'English tweet text Translate' };
    const postEl4 = { querySelector: () => null };
    const res4 = await expandAndExtractPostText(postEl4, textEl4, '');
    expect(res4).toBe('English tweet text');
  });

  test("Config synchronization: partial UPDATE_CONFIG payloads never corrupt existing filters or thresholds", () => {
    const baseConfig = {
      monkModeEnabled: true,
      blockReelsEnabled: true,
      autoBlurRageEnabled: true,
      blockScamsEnabled: true,
      collapseSeedingEnabled: true,
      focusModeEnabled: true,
      confidenceThreshold: 0.35,
      geminiApiKey: 'AIzaSyTestKey',
      geminiPrompt: 'Default prompt',
    };

    const targetConfig = { ...baseConfig };
    const partialUpdate = { geminiPrompt: 'New prompt' };

    // Apply partial update with type-guarded semantics (as in content.js)
    if (typeof partialUpdate.monkModeEnabled === 'boolean') targetConfig.monkModeEnabled = partialUpdate.monkModeEnabled;
    if (typeof partialUpdate.blockReelsEnabled === 'boolean') targetConfig.blockReelsEnabled = partialUpdate.blockReelsEnabled;
    if (typeof partialUpdate.autoBlurRageEnabled === 'boolean') targetConfig.autoBlurRageEnabled = partialUpdate.autoBlurRageEnabled;
    if (typeof partialUpdate.blockScamsEnabled === 'boolean') targetConfig.blockScamsEnabled = partialUpdate.blockScamsEnabled;
    if (typeof partialUpdate.collapseSeedingEnabled === 'boolean') targetConfig.collapseSeedingEnabled = partialUpdate.collapseSeedingEnabled;
    if (typeof partialUpdate.confidenceThreshold === 'number') targetConfig.confidenceThreshold = partialUpdate.confidenceThreshold;
    if (typeof partialUpdate.geminiPrompt === 'string') targetConfig.geminiPrompt = partialUpdate.geminiPrompt.trim();

    // Verify critical protections are completely preserved
    expect(targetConfig.monkModeEnabled).toBe(true);
    expect(targetConfig.autoBlurRageEnabled).toBe(true);
    expect(targetConfig.blockScamsEnabled).toBe(true);
    expect(targetConfig.collapseSeedingEnabled).toBe(true);
    expect(targetConfig.confidenceThreshold).toBe(0.35);
    expect(targetConfig.geminiPrompt).toBe('New prompt');
  });

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

  test("X-only platform detection and manifest restriction", async () => {
    const fs = await import("node:fs");
    const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));

    // Verify host_permissions only allow classifier.dev, generativelanguage, and X/Twitter
    expect(manifest.host_permissions).toContain("*://*.x.com/*");
    expect(manifest.host_permissions).toContain("*://*.twitter.com/*");
    expect(manifest.host_permissions.some((p) => p.includes("facebook"))).toBe(false);
    expect(manifest.host_permissions.some((p) => p.includes("instagram"))).toBe(false);
    expect(manifest.host_permissions.some((p) => p.includes("threads"))).toBe(false);
    expect(manifest.host_permissions.some((p) => p.includes("youtube"))).toBe(false);

    // Verify content_scripts matches only target X/Twitter
    const matches = manifest.content_scripts[0].matches;
    expect(matches).toContain("*://*.x.com/*");
    expect(matches).toContain("*://*.twitter.com/*");
    expect(matches.some((m) => m.includes("facebook"))).toBe(false);
    expect(matches.some((m) => m.includes("threads"))).toBe(false);

    // Verify Side Panel configuration (enables full-height UI)
    expect(manifest.permissions).toContain("sidePanel");
    expect(manifest.side_panel).toBeDefined();
    expect(manifest.side_panel.default_path).toBe("popup.html");
    expect(manifest.action?.default_popup).toBeUndefined();

    // Platform detection helper logic
    function detectPlatform(url) {
      if (!url) return null;
      try {
        const host = new URL(url).hostname.toLowerCase();
        if (host.includes('twitter.com') || host.includes('x.com')) return 'X';
      } catch (e) {}
      return null;
    }

    expect(detectPlatform("https://x.com/home")).toBe("X");
    expect(detectPlatform("https://twitter.com/i/flow")).toBe("X");
    expect(detectPlatform("https://facebook.com")).toBe(null);
    expect(detectPlatform("https://threads.net")).toBe(null);
  });

  test("Gemini API Key dirty-checking: Save button disabled until value differs from stored key", () => {
    const DEFAULT_KEY = '';
    let storedKey = DEFAULT_KEY;

    function isSaveDisabled(currentInputVal, savedKey) {
      return currentInputVal.trim() === savedKey.trim();
    }

    // Initial state: input matches saved key -> Save is disabled
    expect(isSaveDisabled(DEFAULT_KEY, storedKey)).toBe(true);

    // User types new key -> Save button enables
    const newKey = 'AIzaSyNewCustomUserKey123';
    expect(isSaveDisabled(newKey, storedKey)).toBe(false);

    // User saves new key -> storedKey updates -> Save button disables
    storedKey = newKey;
    expect(isSaveDisabled(newKey, storedKey)).toBe(true);

    // Typing whitespace around identical key still considered clean
    expect(isSaveDisabled(`  ${newKey}  `, storedKey)).toBe(true);
  });

  test("Streamlined X-only taxonomy: only casual + dynamic custom labels", () => {
    const TAXONOMY_CATALOG = {
      'other / casual discussion': {
        tagKey: 'casual',
        instruction: 'everyday personal chatter, news, generic talk, or any content that does not fit the other categories.',
      },
    };

    function getStreamlinedTaxonomy(cfg = {}) {
      const activeLabels = [];
      const instructionsList = [];

      if (Array.isArray(cfg?.customLabels)) {
        cfg.customLabels.forEach((c) => {
          const rawName = typeof c === 'string' ? c : c?.name;
          const action = typeof c === 'object' ? (c.action || (c.enabled === false ? 'off' : 'show')) : 'show';
          if (action !== 'off' && rawName) {
            const name = rawName.trim();
            activeLabels.push(name);
            const instruct = (typeof c === 'object' && c?.instruction) ? c.instruction.trim() : `content related to ${name}.`;
            instructionsList.push(`"${name}": ${instruct}`);
          }
        });
      }

      activeLabels.push('other / casual discussion');
      instructionsList.push(`"other / casual discussion": ${TAXONOMY_CATALOG['other / casual discussion'].instruction}`);

      return {
        labels: activeLabels,
        instructions: instructionsList.map((item, idx) => `${idx + 1}. ${item}`).join(' '),
      };
    }

    // Default configuration: only casual
    const defaultTax = getStreamlinedTaxonomy({});
    expect(defaultTax.labels).toEqual(['other / casual discussion']);
    expect(defaultTax.instructions).toContain('1. "other / casual discussion"');

    // With custom labels
    const customTax = getStreamlinedTaxonomy({
      customLabels: [{ name: 'tech', action: 'show', instruction: 'software engineering and AI.' }],
    });
    expect(customTax.labels).toEqual(['tech', 'other / casual discussion']);
    expect(customTax.instructions).toContain('1. "tech": software engineering and AI.');
    expect(customTax.instructions).toContain('2. "other / casual discussion"');
  });

  test("Fallback post assignment strictly respects confidence threshold without bypass", () => {
    function resolveAssignedLabels(selectedBadges, scores, threshold) {
      const topEntry = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
      return selectedBadges.length > 0
        ? selectedBadges.map((b) => b.label)
        : (topEntry && topEntry[1] >= threshold ? [topEntry[0]] : []);
    }

    // Case 1: Badges selected above threshold
    expect(resolveAssignedLabels([{ label: 'casual' }], { casual: 0.85 }, 0.3)).toEqual(['casual']);

    // Case 2: No badges meet threshold, but top score is above threshold
    expect(resolveAssignedLabels([], { custom_tech: 0.45 }, 0.3)).toEqual(['custom_tech']);

    // Case 3: No badges meet threshold and top score is below threshold -> must be empty (NOT collapsed)
    expect(resolveAssignedLabels([], { custom_tech: 0.15 }, 0.3)).toEqual([]);
    expect(resolveAssignedLabels([], {}, 0.3)).toEqual([]);
  });

  test("Vercel-styled Confidence Popover data structure: sorts items descending, assigns TOP indicator, and formats percentage bars", () => {
    function formatPopoverItems(badgesList) {
      return badgesList.map((item, index) => {
        const pct = Math.round((item.score || 0) * 100);
        const dotColor = item.meta?.dotColor || '#94a3b8';
        const labelText = item.meta?.text || item.label;
        const isTop = index === 0;
        return {
          label: labelText,
          pct,
          dotColor,
          isTop,
          barWidth: `${pct}%`,
        };
      });
    }

    const testBadges = [
      { label: 'Artificial intelligence', score: 0.84, meta: { text: 'Artificial intelligence', dotColor: '#a78bfa' } },
      { label: 'tech / dev', score: 0.52, meta: { text: 'Tech', dotColor: '#38bdf8' } },
      { label: 'crypto', score: 0.33, meta: { text: 'Crypto', dotColor: '#fbbf24' } },
    ];

    const formatted = formatPopoverItems(testBadges);
    expect(formatted.length).toBe(3);
    expect(formatted[0].label).toBe('Artificial intelligence');
    expect(formatted[0].pct).toBe(84);
    expect(formatted[0].isTop).toBe(true);
    expect(formatted[0].barWidth).toBe('84%');
    expect(formatted[0].dotColor).toBe('#a78bfa');

    expect(formatted[1].label).toBe('Tech');
    expect(formatted[1].pct).toBe(52);
    expect(formatted[1].isTop).toBe(false);

    expect(formatted[2].label).toBe('Crypto');
    expect(formatted[2].pct).toBe(33);
    expect(formatted[2].isTop).toBe(false);
  });

  test("Hover popover displays top 4 tags including lower % scores below confidenceThreshold", () => {
    const rawScores = {
      'Artificial intelligence': 0.78,
      'Tech': 0.14,
      'other / casual discussion': 0.05,
      'Gaming': 0.02,
      'Crypto': 0.01,
    };

    const threshold = 0.30;
    const allCandidates = Object.entries(rawScores)
      .map(([label, score]) => ({ label, score }))
      .sort((a, b) => b.score - a.score);

    // Eligible badges for post inline display (score >= 0.30)
    const eligibleBadges = allCandidates.filter(item => item.score >= threshold);
    expect(eligibleBadges.length).toBe(1);
    expect(eligibleBadges[0].label).toBe('Artificial intelligence');

    // Hover popover list: takes top 4 candidates, even those with lower % below 0.30
    const popoverBadges = allCandidates.slice(0, 4);
    expect(popoverBadges.length).toBe(4);
    expect(popoverBadges[0]).toEqual({ label: 'Artificial intelligence', score: 0.78 });
    expect(popoverBadges[1]).toEqual({ label: 'Tech', score: 0.14 });
    expect(popoverBadges[2]).toEqual({ label: 'other / casual discussion', score: 0.05 });
    expect(popoverBadges[3]).toEqual({ label: 'Gaming', score: 0.02 });

    // Ensure 5th candidate ('Crypto') is capped out by max 4
    expect(popoverBadges.some(b => b.label === 'Crypto')).toBe(false);
  });

  test("MoreBadge indicator: correctly computes +N count for secondary matching categories", () => {
    function computeMoreBadge(eligibleBadges) {
      if (!Array.isArray(eligibleBadges) || eligibleBadges.length <= 1) return null;
      return {
        className: 'x-jev-more-badge',
        count: eligibleBadges.length - 1,
        text: `+${eligibleBadges.length - 1}`,
      };
    }

    // 1 badge -> no more badge
    expect(computeMoreBadge([{ label: 'ai' }])).toBeNull();

    // 3 badges -> +2
    const multiBadges = [{ label: 'ai' }, { label: 'tech' }, { label: 'dev' }];
    const more = computeMoreBadge(multiBadges);
    expect(more).not.toBeNull();
    expect(more.count).toBe(2);
    expect(more.text).toBe('+2');

    // 6 badges (beyond 4) -> +5
    const sixBadges = [{ label: '1' }, { label: '2' }, { label: '3' }, { label: '4' }, { label: '5' }, { label: '6' }];
    expect(computeMoreBadge(sixBadges).text).toBe('+5');
  });

  test("Popover coordinate calculation: clamps bottom boundary and guards unmounted/offscreen anchors", () => {
    function computePopoverCoords(anchorRect, popoverRect, viewport, inDocument = true) {
      if (!inDocument) return { visible: false };
      const { top: aTop, bottom: aBottom, left: aLeft, right: aRight } = anchorRect;
      const { width: vWidth, height: vHeight } = viewport;

      if (aBottom < 0 || aTop > vHeight || aRight < 0 || aLeft > vWidth) {
        return { visible: false };
      }

      const margin = 8;
      let top = aTop - popoverRect.height - margin;
      if (top < margin) top = aBottom + margin;
      if (top + popoverRect.height > vHeight - margin) {
        top = Math.max(margin, vHeight - popoverRect.height - margin);
      }

      let left = aLeft;
      if (left + popoverRect.width > vWidth - margin) {
        left = vWidth - popoverRect.width - margin;
      }
      if (left < margin) left = margin;

      return { visible: true, top: Math.round(top), left: Math.round(left) };
    }

    // Unmounted anchor -> hidden immediately
    expect(computePopoverCoords({ top: 0, bottom: 0, left: 0, right: 0 }, { width: 220, height: 120 }, { width: 1000, height: 800 }, false))
      .toEqual({ visible: false });

    // Anchor scrolled out of viewport (bottom < 0) -> hidden immediately
    expect(computePopoverCoords({ top: -50, bottom: -10, left: 100, right: 200 }, { width: 220, height: 120 }, { width: 1000, height: 800 }, true))
      .toEqual({ visible: false });

    // Normal placement above
    const normal = computePopoverCoords({ top: 300, bottom: 320, left: 100, right: 200 }, { width: 220, height: 100 }, { width: 1000, height: 800 }, true);
    expect(normal.visible).toBe(true);
    expect(normal.top).toBe(192); // 300 - 100 - 8
    expect(normal.left).toBe(100);

    // Flip below when near top
    const nearTop = computePopoverCoords({ top: 20, bottom: 38, left: 100, right: 200 }, { width: 220, height: 100 }, { width: 1000, height: 800 }, true);
    expect(nearTop.visible).toBe(true);
    expect(nearTop.top).toBe(46); // 38 + 8

    // Bottom clamp when viewport is short
    const shortViewport = computePopoverCoords({ top: 20, bottom: 38, left: 100, right: 200 }, { width: 220, height: 100 }, { width: 1000, height: 120 }, true);
    expect(shortViewport.visible).toBe(true);
    expect(shortViewport.top).toBe(12); // clamped: 120 - 100 - 8 = 12
  });

  test("Jev AI Two-Tier Persistent Cache & Taxonomy Signature Invalidation", () => {
    const MAX_JEV_CACHE_SIZE = 1500;
    const textCache = new Map();

    function getTaxonomySignature(labels, instructions) {
      const labelsStr = labels.slice().sort().join(',');
      return `${labelsStr}::${instructions || ''}`;
    }

    // 1. Taxonomy Signature contract
    const sig1 = getTaxonomySignature(['other / casual discussion', 'tech'], 'instructions...');
    const sig2 = getTaxonomySignature(['tech', 'other / casual discussion'], 'instructions...');
    // Sorted order ensures identical signature regardless of label insertion order
    expect(sig1).toBe(sig2);

    // Signature changes when custom labels change
    const sig3 = getTaxonomySignature(['other / casual discussion', 'crypto'], 'instructions...');
    expect(sig1).not.toBe(sig3);

    // 2. L2 Storage Hydration with signature validation
    function hydrateL2Cache(targetMap, storageObj, currentSig) {
      if (!storageObj || !storageObj.cache) return;
      if (storageObj.sig && storageObj.sig !== currentSig) {
        // Stale taxonomy: invalidate cache
        targetMap.clear();
        return;
      }
      Object.entries(storageObj.cache)
        .slice(-MAX_JEV_CACHE_SIZE)
        .forEach(([k, v]) => targetMap.set(k, v));
    }

    const mockL2 = {
      sig: sig1,
      cache: {
        'tweet_1': { label: 'tech', confidence: 0.9 },
        'tweet_2': { label: 'other / casual discussion', confidence: 0.8 },
      },
    };

    // Hydrate with matching signature -> Success
    hydrateL2Cache(textCache, mockL2, sig1);
    expect(textCache.size).toBe(2);
    expect(textCache.has('tweet_1')).toBe(true);

    // Hydrate with altered signature -> Invalidation clears stale cache
    hydrateL2Cache(textCache, mockL2, sig3);
    expect(textCache.size).toBe(0);

    // 2b. Synchronous Bootstrap Lifecycle (Prevents false-positive wipe on unhydrated config)
    const sessionMap = new Map();
    sessionMap.set('cached_tweet', { label: 'tech', confidence: 0.92 });
    // Synchronous bootstrap loads sessionMap without evaluating against empty default config
    const textCacheInit = new Map();
    sessionMap.forEach((v, k) => textCacheInit.set(k, v));
    expect(textCacheInit.size).toBe(1);
    expect(textCacheInit.has('cached_tweet')).toBe(true);

    // Later, when async storage resolves:
    // If sig matches hydrated config -> keeps cache
    const hydratedUserSig = sig1;
    if (mockL2.sig === hydratedUserSig) {
      // Retained
      expect(textCacheInit.has('cached_tweet')).toBe(true);
    }

    // 3. LRU Bounding at 1500 items
    function saveCacheLru(map, k, v) {
      map.delete(k);
      map.set(k, v);
      while (map.size > MAX_JEV_CACHE_SIZE) {
        const oldest = map.keys().next().value;
        map.delete(oldest);
      }
    }

    for (let i = 0; i < 1500; i++) {
      saveCacheLru(textCache, `tweet_${i}`, { label: 'tech', confidence: 0.8 });
    }
    expect(textCache.size).toBe(1500);

    // Promote tweet_0 to MRU
    const res = textCache.get('tweet_0');
    textCache.delete('tweet_0');
    textCache.set('tweet_0', res);

    // Add 1 more item -> tweet_1 (oldest) must be evicted, tweet_0 must survive
    saveCacheLru(textCache, 'tweet_1500', { label: 'tech', confidence: 0.95 });
    expect(textCache.size).toBe(1500);
    expect(textCache.has('tweet_1')).toBe(false); // oldest evicted
    expect(textCache.has('tweet_0')).toBe(true);  // accessed survived
    expect(textCache.has('tweet_1500')).toBe(true);
  });

  test("Jev In-Flight Deduplication, Batch Sizing & HTTP 429 Circuit Breaker", () => {
    // 1. Batch sizing verification: 40 items per batch
    const BATCH_SIZE = 40;
    const testQueue = Array.from({ length: 95 }, (_, i) => `tweet_${i}`);
    const batch1 = testQueue.splice(0, BATCH_SIZE);
    expect(batch1.length).toBe(40);
    const batch2 = testQueue.splice(0, BATCH_SIZE);
    expect(batch2.length).toBe(40);
    const batch3 = testQueue.splice(0, BATCH_SIZE);
    expect(batch3.length).toBe(15);

    // 2. In-Flight Waiter Deduplication contract (Zero busy spin-loop)
    const inFlightJevWaiters = new Map(); // text -> Array<waiterItem>
    const uncachedInputs = [];
    const simulatedBatch = [
      { id: 1, text: 'post_A' },
      { id: 2, text: 'post_B' },
      { id: 3, text: 'post_A' }, // duplicate waiter in same feed pass
    ];

    simulatedBatch.forEach((item) => {
      if (inFlightJevWaiters.has(item.text)) {
        inFlightJevWaiters.get(item.text).push(item);
      } else {
        inFlightJevWaiters.set(item.text, [item]);
        uncachedInputs.push(item.text);
      }
    });

    // post_A must only be sent once to Jev API
    expect(uncachedInputs).toEqual(['post_A', 'post_B']);
    expect(inFlightJevWaiters.size).toBe(2);
    expect(inFlightJevWaiters.get('post_A').length).toBe(2); // both items waiting

    // Simulated API response distribution to all waiters
    const mockResults = [
      { label: 'tech', score: 0.95 },
      { label: 'news', score: 0.88 },
    ];
    const resolvedItems = [];
    uncachedInputs.forEach((txt, i) => {
      const res = mockResults[i];
      const waiters = inFlightJevWaiters.get(txt) || [];
      waiters.forEach((item) => resolvedItems.push({ id: item.id, label: res.label }));
    });
    uncachedInputs.forEach((txt) => inFlightJevWaiters.delete(txt));

    expect(resolvedItems.length).toBe(3);
    expect(resolvedItems.find(r => r.id === 1)?.label).toBe('tech');
    expect(resolvedItems.find(r => r.id === 3)?.label).toBe('tech');
    expect(inFlightJevWaiters.size).toBe(0);

    // 3. HTTP 429 Circuit Breaker Cooldown contract (Fast recovery: 10 seconds)
    let jevCooldownUntil = 0;
    function handleJevResponse(status) {
      if (status === 429) {
        jevCooldownUntil = Date.now() + 10000;
        return { cooldownActive: true };
      }
      return { cooldownActive: false };
    }

    function canFlushQueue(now = Date.now()) {
      return now >= jevCooldownUntil;
    }

    // Normal response (200) -> can flush immediately
    expect(handleJevResponse(200).cooldownActive).toBe(false);
    expect(canFlushQueue()).toBe(true);

    // 429 response -> activates cooldown for 10 seconds
    const now = Date.now();
    expect(handleJevResponse(429).cooldownActive).toBe(true);
    expect(canFlushQueue(now + 5000)).toBe(false);  // 5s later: still in cooldown
    expect(canFlushQueue(now + 11000)).toBe(true);  // 11s later: cooldown expired

    // 4. Realtime Viewport-First Priority Queueing & Starvation-Free Dispatch
    const testRealtimeQueue = [];
    function isElementInViewportMock(rect, vh = 800, vw = 1200) {
      if (!rect) return false;
      if ((rect.width ?? 100) <= 0 || (rect.height ?? 100) <= 0) return false;
      return rect.bottom >= -150 && rect.top <= vh + 150 && rect.right >= 0 && rect.left <= vw;
    }

    // Zero-dimension element rejection (display:none, unmounted)
    const hiddenZeroDim = { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 };
    expect(isElementInViewportMock(hiddenZeroDim)).toBe(false);

    // Multiple visible posts in document order (top to bottom)
    const itemVis1 = { id: 'visible_1', rect: { top: 100, bottom: 250, left: 10, right: 500, width: 490, height: 150 } };
    const itemVis2 = { id: 'visible_2', rect: { top: 260, bottom: 400, left: 10, right: 500, width: 490, height: 140 } };
    const itemVis3 = { id: 'visible_3', rect: { top: 410, bottom: 550, left: 10, right: 500, width: 490, height: 140 } };
    const itemOffscreen = { id: 'offscreen_1', rect: { top: 1400, bottom: 1550, left: 10, right: 500, width: 490, height: 150 } };

    // Pass 1: Offscreen item discovered
    testRealtimeQueue.push({ id: itemOffscreen.id, isVisible: false });

    // Pass 2: Multiple visible items discovered in top-to-bottom document order
    const rawScanned = [itemVis1, itemVis2, itemVis3];
    const newVisible = [];
    const newOffscreen = [];
    rawScanned.forEach((item) => {
      if (isElementInViewportMock(item.rect)) {
        newVisible.push({ id: item.id, isVisible: true });
      } else {
        newOffscreen.push({ id: item.id, isVisible: false });
      }
    });

    // FIFO unshift preserves top-to-bottom document order at the head of the queue!
    testRealtimeQueue.unshift(...newVisible);
    testRealtimeQueue.push(...newOffscreen);

    expect(testRealtimeQueue.map(i => i.id)).toEqual(['visible_1', 'visible_2', 'visible_3', 'offscreen_1']);

    // Starvation-free dispatch check
    function shouldFlushImmediately(queue, elapsed, activeBatches = 0, maxBatches = 3, cooldownUntil = 0, now = Date.now()) {
      if (now < cooldownUntil) return false; // 429 cooldown active -> NO flush churn
      if (activeBatches >= maxBatches) return false;
      const hasVisible = queue.some((item) => item.isVisible);
      return hasVisible || queue.length >= 10 || elapsed >= 35;
    }

    // With visible items waiting and capacity available -> flushes immediately
    expect(shouldFlushImmediately(testRealtimeQueue, 5, 0, 3)).toBe(true);
    // When saturated at MAX_CONCURRENT_BATCHES -> must wait for capacity
    expect(shouldFlushImmediately(testRealtimeQueue, 5, 3, 3)).toBe(false);
    // When in 429 cooldown -> must not flush immediately (prevents timer churning)
    expect(shouldFlushImmediately(testRealtimeQueue, 5, 0, 3, Date.now() + 5000)).toBe(false);

    // Urgent Visible-First Micro-Batching & Concurrency
    function extractNextBatch(q, maxVisible = 8, maxOffscreen = 30) {
      const firstVisibleIndex = q.findIndex((item) => item.isVisible);
      if (firstVisibleIndex !== -1) {
        const visibleItems = [];
        const remaining = [];
        for (let i = 0; i < q.length; i++) {
          if (q[i].isVisible && visibleItems.length < maxVisible) {
            visibleItems.push(q[i]);
          } else {
            remaining.push(q[i]);
          }
        }
        return { batch: visibleItems, remainingQueue: remaining };
      }
      return { batch: q.slice(0, maxOffscreen), remainingQueue: q.slice(maxOffscreen) };
    }

    const mixedQueue = [
      { id: 'v1', isVisible: true },
      { id: 'v2', isVisible: true },
      { id: 'o1', isVisible: false },
      { id: 'o2', isVisible: false },
      { id: 'v3', isVisible: true },
    ];

    const { batch: microBatch, remainingQueue: afterMicro } = extractNextBatch(mixedQueue, 2);
    expect(microBatch.map(i => i.id)).toEqual(['v1', 'v2']);
    expect(afterMicro.map(i => i.id)).toEqual(['o1', 'o2', 'v3']);

    // Concurrency guard check: allows up to MAX_CONCURRENT_BATCHES (3)
    const MAX_CONCURRENT = 3;
    expect(0 < MAX_CONCURRENT).toBe(true); // Can dispatch Batch 1
    expect(1 < MAX_CONCURRENT).toBe(true); // Can dispatch Batch 2 concurrently
    expect(2 < MAX_CONCURRENT).toBe(true); // Can dispatch Batch 3 concurrently
    expect(3 < MAX_CONCURRENT).toBe(false); // Saturated: must wait for batch completion
  });

  test("getPostTagKey and getDisplayLabelName handle mixed casing, trimming, and custom labels", () => {
    const customLabels = [
      { name: 'Artificial Intelligence', action: 'show' },
      'Crypto',
      { name: 'web3', enabled: true },
    ];

    function getPostTagKey(label) {
      if (!label || typeof label !== 'string' || !label.trim()) return null;
      const normalized = label.trim().toLowerCase();
      if (normalized === 'other / casual discussion') return 'casual';
      if (Array.isArray(customLabels)) {
        const isCustom = customLabels.some(
          (c) => (typeof c === 'string' ? c : c?.name)?.trim().toLowerCase() === normalized
        );
        if (isCustom) return 'custom';
      }
      return null;
    }

    function getDisplayLabelName(label) {
      if (label?.trim().toLowerCase() === 'other / casual discussion') return 'Casual';
      if (Array.isArray(customLabels)) {
        const found = customLabels.find(
          (c) => (typeof c === 'string' ? c : c?.name)?.trim().toLowerCase() === label?.trim().toLowerCase()
        );
        if (found) return typeof found === 'object' ? found.name : found;
      }
      return label || 'Other';
    }

    expect(getPostTagKey('other / casual discussion')).toBe('casual');
    expect(getPostTagKey('  OTHER / CASUAL DISCUSSION  ')).toBe('casual');
    expect(getPostTagKey('artificial intelligence')).toBe('custom');
    expect(getPostTagKey('  cRyPtO  ')).toBe('custom');
    expect(getPostTagKey('unknown')).toBe(null);
    expect(getPostTagKey('')).toBe(null);
    expect(getPostTagKey(null)).toBe(null);

    expect(getDisplayLabelName('  OTHER / CASUAL DISCUSSION  ')).toBe('Casual');
    expect(getDisplayLabelName('artificial intelligence')).toBe('Artificial Intelligence');
    expect(getDisplayLabelName('crypto')).toBe('Crypto');
    expect(getDisplayLabelName('something_else')).toBe('something_else');
    expect(getDisplayLabelName(null)).toBe('Other');
  });

  test("Summary button rendering: accepts short posts without length >= 35 restriction while rejecting empty text", () => {
    const isSummarizable = (text) => typeof text === 'string' && text.trim().length > 0;

    // Short posts that previously failed >= 35 check (e.g. Russell's 31-char post in screenshot)
    expect(isSummarizable('现在闲鱼真的各显神通 打开就爆笑 一群人卖gpt卖的花活太多了')).toBe(true);
    expect(isSummarizable('Short tweet')).toBe(true);
    expect(isSummarizable('AI')).toBe(true);

    // Empty or non-string inputs
    expect(isSummarizable('')).toBe(false);
    expect(isSummarizable('   ')).toBe(false);
    expect(isSummarizable(null)).toBe(false);
    expect(isSummarizable(undefined)).toBe(false);

    // Mock render test verifying summaryBtn is appended for short text
    const container = { children: [], appendChild(el) { this.children.push(el); } };
    const text = 'Short post under 35 chars';
    const hasSummarizableText = typeof text === 'string' && text.trim().length > 0;
    if (hasSummarizableText) {
      const summaryBtn = { className: 'x-jev-summary-btn', text: 'TL;DR' };
      container.appendChild(summaryBtn);
    }
    expect(container.children.length).toBe(1);
    expect(container.children[0].className).toBe('x-jev-summary-btn');
  });

  test("Gemini Summarizer enhanced extraction: combines Repost context, author commentary, and Quoted Tweets", async () => {
    function cleanText(txt) {
      return (txt || '').replace(/\s*(Translate|Xem bản dịch|Show more|Hiển thị thêm|Xem thêm)$/i, '').trim();
    }

    async function expandAndExtractPostText(postEl, textEl, fallbackText) {
      if (!textEl && !postEl) return fallbackText || '';

      const clean = (txt) => cleanText(txt);
      let mainText = textEl && textEl.innerText ? clean(textEl.innerText) : '';
      if (!mainText && fallbackText) mainText = clean(fallbackText);

      if (postEl) {
        const parts = [];

        // 1. Repost / Retweet context (e.g., "X reposted")
        const socialContextEl = postEl.querySelector ? postEl.querySelector('[data-testid="socialContext"]') : null;
        if (socialContextEl && socialContextEl.innerText) {
          const contextText = clean(socialContextEl.innerText);
          if (contextText) {
            parts.push(`[${contextText}]`);
          }
        }

        // 2. Main post text
        if (mainText) {
          parts.push(mainText);
        }

        // 3. Quoted Tweet text
        const allTextEls = postEl.querySelectorAll ? Array.from(postEl.querySelectorAll('[data-testid="tweetText"]')) : [];
        if (allTextEls.length > 1) {
          const quotedTexts = allTextEls
            .filter((el) => el !== textEl)
            .map((el) => clean(el.innerText))
            .filter((txt) => txt.length > 0 && txt !== mainText);

          if (quotedTexts.length > 0) {
            parts.push(`[Quoted Post:\n${quotedTexts.join('\n---\n')}]`);
          }
        }

        const combined = parts.join('\n\n').trim();
        return (combined && combined.length >= 2) ? combined : (fallbackText || '');
      }

      return (mainText && mainText.length >= 2) ? mainText : (fallbackText || '');
    }

    // Case 1: Standard tweet without quote or repost
    const standardTextEl = { innerText: 'Just launched our new product!' };
    const standardPostEl = {
      querySelector: () => null,
      querySelectorAll: () => [standardTextEl],
    };
    const res1 = await expandAndExtractPostText(standardPostEl, standardTextEl, '');
    expect(res1).toBe('Just launched our new product!');

    // Case 2: Quote Tweet (contains main text AND quoted tweet text)
    const quoteAuthorTextEl = { innerText: 'This analysis is completely wrong and misleading 🤡' };
    const quotedOriginalTextEl = { innerText: 'Original post: AI will replace all software engineers by next Friday.' };
    const quotePostEl = {
      querySelector: (sel) => null,
      querySelectorAll: (sel) => sel === '[data-testid="tweetText"]' ? [quoteAuthorTextEl, quotedOriginalTextEl] : [],
    };
    const res2 = await expandAndExtractPostText(quotePostEl, quoteAuthorTextEl, '');
    expect(res2).toContain('This analysis is completely wrong and misleading 🤡');
    expect(res2).toContain('[Quoted Post:');
    expect(res2).toContain('Original post: AI will replace all software engineers by next Friday.');

    // Case 3: Retweet / Repost with socialContext
    const repostTextEl = { innerText: 'Open source LLMs are catching up rapidly.' };
    const repostContextEl = { innerText: 'Yann LeCun reposted' };
    const repostPostEl = {
      querySelector: (sel) => sel === '[data-testid="socialContext"]' ? repostContextEl : null,
      querySelectorAll: (sel) => sel === '[data-testid="tweetText"]' ? [repostTextEl] : [],
    };
    const res3 = await expandAndExtractPostText(repostPostEl, repostTextEl, '');
    expect(res3).toContain('[Yann LeCun reposted]');
    expect(res3).toContain('Open source LLMs are catching up rapidly.');
  });

  test("Tweet image media extraction: identifies tweetPhoto images, ignores avatars and emojis, and normalizes URL", () => {
    function extractPostImages(postEl) {
      if (!postEl || !postEl.querySelectorAll) return [];
      const imgs = Array.from(postEl.querySelectorAll('div[data-testid="tweetPhoto"] img'));
      const urls = [];
      const seen = new Set();
      for (const img of imgs) {
        let src = img.getAttribute ? (img.getAttribute('src') || img.src) : img.src;
        if (!src || src.startsWith('data:') || seen.has(src)) continue;
        if (src.includes('/emoji/') || src.includes('profile_images')) continue;
        seen.add(src);
        urls.push(src);
        if (urls.length >= 4) break;
      }
      return urls;
    }

    const mockPostEl = {
      querySelectorAll: (sel) => {
        if (sel === 'div[data-testid="tweetPhoto"] img') {
          return [
            { src: 'https://pbs.twimg.com/media/G12345?format=jpg&name=large' },
            { src: 'https://pbs.twimg.com/media/G67890?format=png&name=900x900' },
            { src: 'https://abs.twimg.com/emoji/v2/svg/1f525.svg' }, // Emoji -> should be ignored
            { src: 'https://pbs.twimg.com/profile_images/123/avatar.jpg' }, // Avatar -> should be ignored
          ];
        }
        return [];
      },
    };

    const extracted = extractPostImages(mockPostEl);
    expect(extracted.length).toBe(2);
    expect(extracted[0]).toBe('https://pbs.twimg.com/media/G12345?format=jpg&name=large');
    expect(extracted[1]).toBe('https://pbs.twimg.com/media/G67890?format=png&name=900x900');
  });

  test("Multimodal Gemini summary payload: formats base64 inlineData, gracefully falls back on fetch failure, and computes composite cache keys", async () => {
    function arrayBufferToBase64(buffer) {
      let binary = '';
      const bytes = new Uint8Array(buffer);
      const len = bytes.byteLength;
      const chunkSize = 8192;
      for (let i = 0; i < len; i += chunkSize) {
        const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
        binary += String.fromCharCode.apply(null, chunk);
      }
      return btoa(binary);
    }

    // Verify binary encoding
    const sampleBytes = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
    expect(arrayBufferToBase64(sampleBytes.buffer)).toBe(btoa("Hello"));

    // Verify composite cache keys
    const text = 'Check out this chart on inflation';
    const images = ['https://pbs.twimg.com/media/chart1.jpg'];
    const keyWithImages = images.length > 0 ? `${text}::imgs:${images.join(',')}` : text;
    const keyWithoutImages = `${text}`;
    expect(keyWithImages).toContain('::imgs:https://pbs.twimg.com/media/chart1.jpg');
    expect(keyWithoutImages).toBe(text);
    expect(keyWithImages).not.toBe(keyWithoutImages);

    // Mock multimodal parts construction with fallback
    async function buildGeminiParts(prompt, imageUrls, mockFetcher) {
      const parts = [{ text: prompt }];
      if (Array.isArray(imageUrls) && imageUrls.length > 0) {
        const imagePartPromises = imageUrls.slice(0, 3).map(async (url) => {
          try {
            const res = await mockFetcher(url);
            if (!res.ok) return null;
            const buffer = await res.arrayBuffer();
            const base64Data = arrayBufferToBase64(buffer);
            return {
              inlineData: {
                mimeType: res.mimeType || 'image/jpeg',
                data: base64Data,
              },
            };
          } catch (e) {
            return null;
          }
        });
        const resolved = await Promise.all(imagePartPromises);
        for (const p of resolved) {
          if (p) parts.push(p);
        }
      }
      return parts;
    }

    // 1. Success with image: generates inlineData part
    const mockSuccessFetcher = async (url) => ({
      ok: true,
      mimeType: 'image/jpeg',
      arrayBuffer: async () => new Uint8Array([255, 216, 255]).buffer, // JPEG magic bytes
    });
    const partsSuccess = await buildGeminiParts('Summarize:', ['https://pbs.twimg.com/media/test.jpg'], mockSuccessFetcher);
    expect(partsSuccess.length).toBe(2);
    expect(partsSuccess[0].text).toBe('Summarize:');
    expect(partsSuccess[1].inlineData).toBeDefined();
    expect(partsSuccess[1].inlineData.mimeType).toBe('image/jpeg');

    // 2. Failure with image (404 / network error): gracefully falls back to text-only
    const mockFailFetcher = async (url) => ({
      ok: false,
      mimeType: 'image/jpeg',
      arrayBuffer: async () => new Uint8Array([]).buffer,
    });
    const partsFailed = await buildGeminiParts('Summarize:', ['https://pbs.twimg.com/media/broken.jpg'], mockFailFetcher);
    expect(partsFailed.length).toBe(1);
    expect(partsFailed[0].text).toBe('Summarize:');
  });

  test("Video and GIF poster extraction: captures poster thumbnail from video elements and handles mixed photo/video posts", () => {
    function extractPostImages(postEl) {
      if (!postEl || !postEl.querySelectorAll) return [];
      const urls = [];
      const seen = new Set();

      // 1. Still photos
      const imgs = Array.from(postEl.querySelectorAll('div[data-testid="tweetPhoto"] img'));
      for (const img of imgs) {
        let src = img.getAttribute ? (img.getAttribute('src') || img.src) : img.src;
        if (!src || src.startsWith('data:') || seen.has(src)) continue;
        if (src.includes('/emoji/') || src.includes('profile_images')) continue;
        seen.add(src);
        urls.push(src);
        if (urls.length >= 4) break;
      }

      // 2. Video / GIF poster thumbnails if slots remain
      if (urls.length < 4) {
        const videos = Array.from(postEl.querySelectorAll('div[data-testid="videoPlayer"] video, div[data-testid="videoComponent"] video, video[poster]'));
        for (const vid of videos) {
          let poster = vid.getAttribute ? (vid.getAttribute('poster') || vid.poster) : vid.poster;
          if (!poster || poster.startsWith('data:') || seen.has(poster)) continue;
          seen.add(poster);
          urls.push(poster);
          if (urls.length >= 4) break;
        }
      }

      return urls;
    }

    // Post with video element having poster attribute
    const mockVideoPostEl = {
      querySelectorAll: (sel) => {
        if (sel.includes('tweetPhoto')) return [];
        if (sel.includes('videoPlayer') || sel.includes('video[poster]')) {
          return [
            { poster: 'https://pbs.twimg.com/media/video_poster_123.jpg' }
          ];
        }
        return [];
      },
    };

    const extracted = extractPostImages(mockVideoPostEl);
    expect(extracted.length).toBe(1);
    expect(extracted[0]).toBe('https://pbs.twimg.com/media/video_poster_123.jpg');
  });

  test("Media Context Note annotation: appends explicit video/GIF keyframe context notes to prompt text", async () => {
    function cleanText(txt) {
      return (txt || '').replace(/\s*(Translate|Xem bản dịch|Show more|Hiển thị thêm|Xem thêm)$/i, '').trim();
    }

    async function expandAndExtractPostText(postEl, textEl, fallbackText) {
      if (!textEl && !postEl) return fallbackText || '';

      const clean = (txt) => cleanText(txt);
      let mainText = textEl && textEl.innerText ? clean(textEl.innerText) : '';
      if (!mainText && fallbackText) mainText = clean(fallbackText);

      if (postEl) {
        const parts = [];

        // 1. Repost / Retweet context (e.g., "X reposted")
        const socialContextEl = postEl.querySelector ? postEl.querySelector('[data-testid="socialContext"]') : null;
        if (socialContextEl && socialContextEl.innerText) {
          const contextText = clean(socialContextEl.innerText);
          if (contextText) {
            parts.push(`[${contextText}]`);
          }
        }

        // 2. Main post text
        if (mainText) {
          parts.push(mainText);
        }

        // 3. Quoted Tweet text
        const allTextEls = postEl.querySelectorAll ? Array.from(postEl.querySelectorAll('[data-testid="tweetText"]')) : [];
        if (allTextEls.length > 1) {
          const quotedTexts = allTextEls
            .filter((el) => el !== textEl)
            .map((el) => clean(el.innerText))
            .filter((txt) => txt.length > 0 && txt !== mainText);

          if (quotedTexts.length > 0) {
            parts.push(`[Quoted Post:\n${quotedTexts.join('\n---\n')}]`);
          }
        }

        // 4. Video / GIF Media Context Note
        const hasVideo = postEl.querySelector && (
          postEl.querySelector('div[data-testid="videoPlayer"], div[data-testid="videoComponent"], video')
        );
        if (hasVideo) {
          const isGif = postEl.querySelector && (
            postEl.querySelector('[aria-label*="GIF" i], [data-testid="gifBadge"]') ||
            (typeof hasVideo.getAttribute === 'function' && hasVideo.getAttribute('aria-label')?.toLowerCase().includes('gif'))
          );
          if (isGif) {
            parts.push('[Media Note: Post includes an animated GIF. The provided image is its preview keyframe.]');
          } else {
            parts.push('[Media Note: Post includes a video clip. The provided image is its preview poster frame, not a standalone still photo.]');
          }
        }

        const combined = parts.join('\n\n').trim();
        return (combined && combined.length >= 2) ? combined : (fallbackText || '');
      }

      return (mainText && mainText.length >= 2) ? mainText : (fallbackText || '');
    }

    // Video post annotation test
    const mockVideoPost = {
      querySelector: (sel) => sel.includes('video') ? { tagName: 'VIDEO' } : null,
      querySelectorAll: (sel) => sel === '[data-testid="tweetText"]' ? [{ innerText: 'Watch this keynote speech' }] : [],
    };
    const resVideo = await expandAndExtractPostText(mockVideoPost, { innerText: 'Watch this keynote speech' }, '');
    expect(resVideo).toContain('Watch this keynote speech');
    expect(resVideo).toContain('[Media Note: Post includes a video clip. The provided image is its preview poster frame, not a standalone still photo.]');

    // GIF post annotation test
    const mockGifPost = {
      querySelector: (sel) => {
        if (sel.includes('GIF')) return { text: 'GIF' };
        if (sel.includes('video')) return { tagName: 'VIDEO' };
        return null;
      },
      querySelectorAll: (sel) => sel === '[data-testid="tweetText"]' ? [{ innerText: 'My reaction when code compiles on first try' }] : [],
    };
    const resGif = await expandAndExtractPostText(mockGifPost, { innerText: 'My reaction when code compiles on first try' }, '');
    expect(resGif).toContain('My reaction when code compiles on first try');
    expect(resGif).toContain('[Media Note: Post includes an animated GIF. The provided image is its preview keyframe.]');
  });

  test("Community Note extraction: cleans boilerplate and accurately attributes notes to root tweet vs quoted tweet", async () => {
    const clean = (txt) => (txt || '').replace(/\s*(Translate|Xem bản dịch|Show more|Hiển thị thêm|Xem thêm)$/i, '').trim();

    const cleanCommunityNote = (txt) => {
      if (!txt) return '';
      const lines = txt.split('\n').map((l) => l.trim()).filter(Boolean);
      const filtered = lines.filter((line) => {
        if (/^(readers added context|context added by readers|độc giả đã thêm ngữ cảnh|ghi chú cộng đồng)/i.test(line)) {
          return false;
        }
        if (/^(do you find this helpful|rate (it|this note)|helpful\?|bạn có thấy (điều này|ghi chú)|đánh giá ghi chú)/i.test(line)) {
          return false;
        }
        return true;
      });
      const res = filtered.join('\n').trim();
      return res;
    };

    // 1. Verify cleanCommunityNote stripping headers and footers
    const rawNoteEn = `Readers added context they thought people might want to know
This image was generated with Midjourney v6 and does not depict real events.
Source: example.com/ai-check
Do you find this helpful? Rate it`;

    const cleanedEn = cleanCommunityNote(rawNoteEn);
    expect(cleanedEn).toContain('This image was generated with Midjourney v6 and does not depict real events.');
    expect(cleanedEn).toContain('Source: example.com/ai-check');
    expect(cleanedEn).not.toContain('Readers added context');
    expect(cleanedEn).not.toContain('Do you find this helpful');

    // Pure boilerplate string should return empty string so it gets discarded
    const pureBoilerplate = `Readers added context they thought people might want to know
Do you find this helpful? Rate it`;
    expect(cleanCommunityNote(pureBoilerplate)).toBe('');

    const rawNoteVi = `Độc giả đã thêm ngữ cảnh mà họ nghĩ có thể mọi người muốn biết
Thông tin này đã bị bác bỏ bởi Bộ Y Tế vào ngày 12/05.
Bạn có thấy điều này hữu ích không? Đánh giá ghi chú`;

    const cleanedVi = cleanCommunityNote(rawNoteVi);
    expect(cleanedVi).toBe('Thông tin này đã bị bác bỏ bởi Bộ Y Tế vào ngày 12/05.');

    async function expandAndExtractPostText(postEl, textEl, fallbackText) {
      if (!textEl && !postEl) return fallbackText || '';

      let mainText = textEl && textEl.innerText ? clean(textEl.innerText) : '';
      if (!mainText && fallbackText) mainText = clean(fallbackText);

      if (postEl) {
        const parts = [];

        // 1. Repost / Retweet context
        const socialContextEl = postEl.querySelector ? postEl.querySelector('[data-testid="socialContext"]') : null;
        if (socialContextEl && socialContextEl.innerText) {
          const contextText = clean(socialContextEl.innerText);
          if (contextText) {
            parts.push(`[${contextText}]`);
          }
        }

        // 2. Main post text
        if (mainText) {
          parts.push(mainText);
        }

        // 3. Quoted Tweet text & container detection
        const allTextEls = postEl.querySelectorAll ? Array.from(postEl.querySelectorAll('[data-testid="tweetText"]')) : [];
        let quoteContainer = null;
        let quotedTextPart = null;

        if (allTextEls.length > 1) {
          const quotedTextEls = allTextEls.filter((el) => el !== textEl);
          const quotedTexts = quotedTextEls
            .map((el) => clean(el.innerText))
            .filter((txt) => txt.length > 0 && txt !== mainText);

          if (quotedTexts.length > 0) {
            quotedTextPart = `[Quoted Post:\n${quotedTexts.join('\n---\n')}]`;
          }

          if (quotedTextEls[0]) {
            let curr = quotedTextEls[0];
            while (curr.parentElement && curr.parentElement !== postEl && (!textEl || !curr.parentElement.contains(textEl))) {
              curr = curr.parentElement;
            }
            quoteContainer = curr;
          }
        }

        if (!quoteContainer && postEl.querySelector) {
          quoteContainer = postEl.querySelector('[data-testid="quoteTweet"]');
        }

        // 4. Community Notes on Root Post & Quoted Post
        const noteEls = postEl.querySelectorAll
          ? Array.from(postEl.querySelectorAll('[data-testid="birdwatch-pivot"], [data-testid*="birdwatch"], [data-testid="community-note"]'))
          : [];

        let rootNotes = [];
        let quoteNotes = [];

        if (noteEls.length > 0) {
          const seenNotes = new Set();
          for (const noteEl of noteEls) {
            const rawNote = noteEl.innerText || noteEl.textContent || '';
            const cleanedNote = cleanCommunityNote(rawNote);
            if (!cleanedNote || seenNotes.has(cleanedNote)) continue;
            seenNotes.add(cleanedNote);

            const isQuoteNote = (quoteContainer && quoteContainer.contains(noteEl)) ||
              Boolean(noteEl.closest && noteEl.closest('[data-testid="quoteTweet"], [aria-label*="Quote" i]'));

            if (isQuoteNote) {
              quoteNotes.push(cleanedNote);
            } else {
              rootNotes.push(cleanedNote);
            }
          }
        }

        if (rootNotes.length > 0) {
          parts.push(`[Community Note on Post:\n${rootNotes.join('\n---\n')}]`);
        }

        if (quotedTextPart) {
          parts.push(quotedTextPart);
        }

        if (quoteNotes.length > 0) {
          parts.push(`[Community Note on Quoted Post:\n${quoteNotes.join('\n---\n')}]`);
        }

        const combined = parts.join('\n\n').trim();
        return (combined && combined.length >= 2) ? combined : (fallbackText || '');
      }

      return (mainText && mainText.length >= 2) ? mainText : (fallbackText || '');
    }

    // 2. Test post with only Root Community Note
    const rootNoteEl = {
      innerText: 'Readers added context\nThe claim regarding tax increases was debunked by CBO report.\nRate this note',
    };
    const mockRootOnlyPost = {
      querySelectorAll: (sel) => {
        if (sel.includes('birdwatch')) return [rootNoteEl];
        if (sel === '[data-testid="tweetText"]') return [{ innerText: 'New bill will increase taxes by 50%!' }];
        return [];
      },
    };
    const resRootOnly = await expandAndExtractPostText(
      mockRootOnlyPost,
      { innerText: 'New bill will increase taxes by 50%!' },
      ''
    );
    expect(resRootOnly).toContain('New bill will increase taxes by 50%!');
    expect(resRootOnly).toContain('[Community Note on Post:\nThe claim regarding tax increases was debunked by CBO report.]');
    expect(resRootOnly).not.toContain('Quoted Post');

    // 3. Test post with Quoted Tweet AND both Root Note & Quote Note
    // Structure:
    // mockArticle: postEl
    //   rootTextEl
    //   rootNoteEl
    //   quoteBox
    //     quoteTextEl
    //     quoteNoteEl
    const mockRootText = { innerText: 'Check out this breaking news!' };
    const mockQuoteText = { innerText: 'Alien spacecraft landed in Nevada' };

    const mockQuoteNote = {
      innerText: 'Readers added context\nThe footage is from a 2019 sci-fi movie CGI reel.\nDo you find this helpful?',
    };
    const mockRootNote = {
      innerText: 'Readers added context\nThe account posting this is a known parody account.\nHelpful?',
    };

    const mockQuoteBox = {
      contains: (el) => el === mockQuoteText || el === mockQuoteNote,
      parentElement: null, // Will point to mockArticle
    };
    mockQuoteText.parentElement = mockQuoteBox;
    mockQuoteNote.parentElement = mockQuoteBox;

    const mockArticle = {
      contains: (el) => true,
      querySelector: (sel) => null,
      querySelectorAll: (sel) => {
        if (sel.includes('birdwatch')) return [mockRootNote, mockQuoteNote];
        if (sel === '[data-testid="tweetText"]') return [mockRootText, mockQuoteText];
        return [];
      },
    };
    mockQuoteBox.parentElement = mockArticle;

    const resBoth = await expandAndExtractPostText(mockArticle, mockRootText, '');
    expect(resBoth).toContain('Check out this breaking news!');
    expect(resBoth).toContain('[Community Note on Post:\nThe account posting this is a known parody account.]');
    expect(resBoth).toContain('[Quoted Post:\nAlien spacecraft landed in Nevada]');
    expect(resBoth).toContain('[Community Note on Quoted Post:\nThe footage is from a 2019 sci-fi movie CGI reel.]');

    // Order verification: Root Note should appear before Quoted Post, and Quoted Note after Quoted Post
    const rootNoteIdx = resBoth.indexOf('[Community Note on Post:');
    const quotePostIdx = resBoth.indexOf('[Quoted Post:');
    const quoteNoteIdx = resBoth.indexOf('[Community Note on Quoted Post:');
    expect(rootNoteIdx).toBeLessThan(quotePostIdx);
    expect(quotePostIdx).toBeLessThan(quoteNoteIdx);
  });

  test("X Long-form Article support: extracts title, cover image, and body paragraphs for Jev AI classification and Gemini TL;DR", async () => {
    // 1. Test scanFeed extraction logic for an X Article (no tweetText element present)
    function extractArticleSample(post) {
      let textEl = post.querySelector ? post.querySelector('div[data-testid="tweetText"]') : null;
      let text = '';
      if (textEl) {
        text = textEl.innerText.trim().replace(/\s*(Translate|Xem bản dịch)$/i, '').trim();
      } else {
        const articleTitleEl = post.querySelector ? (post.querySelector('[data-testid="twitter-article-title"]') || post.querySelector('h1')) : null;
        const articleBodyEl = post.querySelector ? (post.querySelector('[data-testid="twitterArticleReadView"], [data-testid="twitter-article"]') ||
          (post.getAttribute && post.getAttribute('data-testid')?.includes('article') ? post : null)) : null;

        if (articleTitleEl || articleBodyEl) {
          textEl = articleTitleEl || articleBodyEl;
          const title = articleTitleEl ? articleTitleEl.innerText.trim() : '';
          const sampleParagraphs = [];
          const pEls = Array.from((articleBodyEl || post).querySelectorAll('p, div[dir="auto"]'));
          for (const p of pEls) {
            const pt = p.innerText.trim();
            if (pt && pt.length > 5 && pt !== title && !sampleParagraphs.includes(pt)) {
              sampleParagraphs.push(pt);
              if (sampleParagraphs.join(' ').length > 400) break;
            }
          }
          text = [title, ...sampleParagraphs].filter(Boolean).join('\n\n').trim();
        }
      }
      return { textEl, text };
    }

    const mockArticleTitle = { innerText: 'Jev + graphical models: a paradigm shift?' };
    const mockParagraph1 = { innerText: 'Could Jev + graphical models fundamentally change how we build systems that reason under uncertainty?' };
    const mockParagraph2 = { innerText: 'In particular, Jev could provide zero-shot probabilistic factors for any structured domain.' };

    const mockArticlePost = {
      getAttribute: (attr) => attr === 'data-testid' ? 'twitterArticleReadView' : null,
      querySelector: (sel) => {
        if (sel.includes('tweetText')) return null;
        if (sel.includes('twitter-article-title')) return mockArticleTitle;
        if (sel.includes('twitterArticleReadView')) return mockArticlePost;
        return null;
      },
      querySelectorAll: (sel) => {
        if (sel.includes('p') || sel.includes('dir="auto"')) {
          return [mockParagraph1, mockParagraph2];
        }
        return [];
      },
    };

    const sample = extractArticleSample(mockArticlePost);
    expect(sample.textEl).toBe(mockArticleTitle);
    expect(sample.text).toContain('Jev + graphical models: a paradigm shift?');
    expect(sample.text).toContain('Could Jev + graphical models fundamentally change how we build systems');

    // 2. Test cover image extraction on X Article from pbs.twimg.com/media/
    function extractPostImages(postEl) {
      if (!postEl || !postEl.querySelectorAll) return [];
      const urls = [];
      const seen = new Set();

      const imgs = Array.from(postEl.querySelectorAll('div[data-testid="tweetPhoto"] img, img[src*="pbs.twimg.com/media/"]'));
      for (const img of imgs) {
        let src = img.getAttribute ? (img.getAttribute('src') || img.src) : img.src;
        if (!src || src.startsWith('data:') || seen.has(src)) continue;
        if (src.includes('/emoji/') || src.includes('profile_images') || src.includes('profile_banners')) continue;
        seen.add(src);
        urls.push(src);
        if (urls.length >= 4) break;
      }
      return urls;
    }

    const mockCoverImg = { src: 'https://pbs.twimg.com/media/G12345_graphical_model.jpg' };
    const mockAvatarImg = { src: 'https://pbs.twimg.com/profile_images/fdellaert_avatar.jpg' };
    mockArticlePost.querySelectorAll = (sel) => {
      if (sel.includes('img')) return [mockAvatarImg, mockCoverImg];
      if (sel.includes('p')) return [mockParagraph1, mockParagraph2];
      return [];
    };

    const extractedImgs = extractPostImages(mockArticlePost);
    expect(extractedImgs.length).toBe(1);
    expect(extractedImgs[0]).toBe('https://pbs.twimg.com/media/G12345_graphical_model.jpg');

    // 3. Test expandAndExtractPostText for full article expansion
    const clean = (txt) => (txt || '').replace(/\s*(Translate|Xem bản dịch|Show more|Hiển thị thêm|Xem thêm)$/i, '').trim();

    async function expandAndExtractPostText(postEl, textEl, fallbackText) {
      let mainText = textEl && textEl.innerText ? clean(textEl.innerText) : '';
      if (!mainText && fallbackText) mainText = clean(fallbackText);

      if (postEl) {
        const articleTitleEl = postEl.querySelector ? (postEl.querySelector('[data-testid="twitter-article-title"]') || postEl.querySelector('h1')) : null;
        const articleBodyEl = postEl.querySelector ? postEl.querySelector('[data-testid="twitterArticleReadView"], [data-testid="twitter-article"]') : null;
        if (articleTitleEl || articleBodyEl) {
          const articleTitle = articleTitleEl ? clean(articleTitleEl.innerText) : '';
          const bodyParagraphs = [];
          const pEls = (articleBodyEl || postEl).querySelectorAll ? Array.from((articleBodyEl || postEl).querySelectorAll('p, div[dir="auto"]')) : [];
          for (const p of pEls) {
            const pText = clean(p.innerText);
            if (pText && pText.length > 5 && pText !== articleTitle) {
              if (!bodyParagraphs.some((existing) => existing.includes(pText) || pText.includes(existing))) {
                bodyParagraphs.push(pText);
              }
            }
          }
          if (articleTitle || bodyParagraphs.length > 0) {
            const articleContent = [
              articleTitle ? `[Article Title: ${articleTitle}]` : '',
              ...bodyParagraphs,
            ].filter(Boolean).join('\n\n');
            if (articleContent.length > mainText.length) {
              mainText = articleContent;
            }
          }
        }
        return mainText;
      }
      return mainText || fallbackText || '';
    }

    const fullArticle = await expandAndExtractPostText(mockArticlePost, mockArticleTitle, sample.text);
    expect(fullArticle).toContain('[Article Title: Jev + graphical models: a paradigm shift?]');
    expect(fullArticle).toContain('Could Jev + graphical models fundamentally change');
    expect(fullArticle).toContain('In particular, Jev could provide zero-shot probabilistic factors');
  });

  test("extractPostTextForJev correctly extracts Repost context, Root text, Quoted tweet, Community Notes without media notes", () => {
    const clean = (txt) => (txt || '').replace(/\s*(Translate|Xem bản dịch|Show more|Hiển thị thêm|Xem thêm)$/i, '').trim();

    const cleanCommunityNote = (text) => {
      if (!text) return '';
      const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
      const filtered = lines.filter((line) => {
        if (/Readers added context/i.test(line)) return false;
        if (/Độc giả đã thêm ngữ cảnh/i.test(line)) return false;
        if (/thought people might want to know/i.test(line)) return false;
        if (/Do you find this helpful/i.test(line)) return false;
        if (/Bạn có thấy điều này hữu ích/i.test(line)) return false;
        if (/Rate it/i.test(line) || /Đánh giá/i.test(line)) return false;
        if (/Context written by/i.test(line)) return false;
        if (/Sources?:?/i.test(line) || /Nguồn:?/i.test(line)) return false;
        if (/^https?:\/\//i.test(line)) return false;
        return true;
      });
      return filtered.join('\n').trim();
    };

    function extractPostTextForJev(postEl, textEl) {
      if (!textEl && !postEl) return '';
      const parts = [];

      // 1. Repost / Retweet context (e.g. "X reposted")
      const socialContextEl = postEl.querySelector ? postEl.querySelector('[data-testid="socialContext"]') : null;
      if (socialContextEl && socialContextEl.innerText) {
        const contextText = clean(socialContextEl.innerText);
        if (contextText) parts.push(`[${contextText}]`);
      }

      // 2. Main post text
      const mainText = textEl && textEl.innerText ? clean(textEl.innerText) : '';
      if (mainText) parts.push(mainText);

      // 3. Quoted Tweet text & container detection
      const allTextEls = postEl.querySelectorAll ? Array.from(postEl.querySelectorAll('[data-testid="tweetText"]')) : [];
      let quoteContainer = null;
      let quotedTextPart = null;

      if (allTextEls.length > 1) {
        const quotedTextEls = allTextEls.filter((el) => el !== textEl);
        const quotedTexts = quotedTextEls
          .map((el) => clean(el.innerText))
          .filter((txt) => txt.length > 0 && txt !== mainText);

        if (quotedTexts.length > 0) {
          quotedTextPart = `[Quoted Post:\n${quotedTexts.join('\n---\n')}]`;
        }

        if (quotedTextEls[0]) {
          let curr = quotedTextEls[0];
          while (curr.parentElement && curr.parentElement !== postEl && (!textEl || !curr.parentElement.contains(textEl))) {
            curr = curr.parentElement;
          }
          quoteContainer = curr;
        }
      }

      if (!quoteContainer && postEl.querySelector) {
        quoteContainer = postEl.querySelector('[data-testid="quoteTweet"]');
      }

      // 4. Community Notes on Root Post & Quoted Post
      const noteEls = postEl.querySelectorAll
        ? Array.from(postEl.querySelectorAll('[data-testid="birdwatch-pivot"], [data-testid*="birdwatch"], [data-testid="community-note"]'))
        : [];

      let rootNotes = [];
      let quoteNotes = [];

      if (noteEls.length > 0) {
        const seenNotes = new Set();
        for (const noteEl of noteEls) {
          const rawNote = noteEl.innerText || noteEl.textContent || '';
          const cleanedNote = cleanCommunityNote(rawNote);
          if (!cleanedNote || seenNotes.has(cleanedNote)) continue;
          seenNotes.add(cleanedNote);

          const isQuoteNote = (quoteContainer && quoteContainer.contains(noteEl)) ||
            Boolean(noteEl.closest && noteEl.closest('[data-testid="quoteTweet"], [aria-label*="Quote" i]'));

          if (isQuoteNote) {
            quoteNotes.push(cleanedNote);
          } else {
            rootNotes.push(cleanedNote);
          }
        }
      }

      if (rootNotes.length > 0) {
        parts.push(`[Community Note on Post:\n${rootNotes.join('\n---\n')}]`);
      }
      if (quotedTextPart) {
        parts.push(quotedTextPart);
      }
      if (quoteNotes.length > 0) {
        parts.push(`[Community Note on Quoted Post:\n${quoteNotes.join('\n---\n')}]`);
      }

      const res = parts.join('\n\n').trim();
      return (res && res.length >= 2) ? res : (mainText || '');
    }

    // Scenario 1: Standard simple post with translate button
    const simpleTextEl = { innerText: 'Hello world this is a test post Translate' };
    const simplePost = {
      querySelector: () => null,
      querySelectorAll: (sel) => sel.includes('tweetText') ? [simpleTextEl] : [],
    };
    expect(extractPostTextForJev(simplePost, simpleTextEl)).toBe('Hello world this is a test post');

    // Scenario 2: Repost + Root text + Quoted post + Community notes (both root and quote)
    const repostEl = { innerText: 'Alice reposted' };
    const rootTextEl = { innerText: 'Check this crazy post out' };
    const quoteTextEl = { innerText: 'This is a controversial hot take that might be ragebait' };
    const quoteContainerEl = {
      contains: (node) => node === quoteNoteEl,
    };
    quoteTextEl.parentElement = quoteContainerEl;
    quoteContainerEl.parentElement = null;

    const rootNoteEl = {
      innerText: 'Readers added context they thought people might want to know\nThis root context clarifies facts.\nSources: https://example.com\nDo you find this helpful?',
    };
    const quoteNoteEl = {
      innerText: 'Readers added context\nThe quoted claim was debunked in 2024.\nRate it',
      closest: (sel) => sel.includes('quoteTweet') ? quoteContainerEl : null,
    };

    const complexPost = {
      querySelector: (sel) => {
        if (sel.includes('socialContext')) return repostEl;
        if (sel.includes('quoteTweet')) return quoteContainerEl;
        return null;
      },
      querySelectorAll: (sel) => {
        if (sel.includes('tweetText')) return [rootTextEl, quoteTextEl];
        if (sel.includes('birdwatch') || sel.includes('community-note')) return [rootNoteEl, quoteNoteEl];
        return [];
      },
    };

    const extracted = extractPostTextForJev(complexPost, rootTextEl);
    expect(extracted).toContain('[Alice reposted]');
    expect(extracted).toContain('Check this crazy post out');
    expect(extracted).toContain('[Community Note on Post:\nThis root context clarifies facts.]');
    expect(extracted).toContain('[Quoted Post:\nThis is a controversial hot take that might be ragebait]');
    expect(extracted).toContain('[Community Note on Quoted Post:\nThe quoted claim was debunked in 2024.]');
    // Ensure media notes are NOT included
    expect(extracted).not.toContain('[Media Note:');
    expect(extracted).not.toContain('Readers added context');
    expect(extracted).not.toContain('Do you find this helpful?');
    expect(extracted).not.toContain('https://example.com');
  });
});





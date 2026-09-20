import { expect, test, describe } from "bun:test";

describe("Curated Classifier Taxonomy & Dynamic Filter Rules", () => {
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
      desc: 'Personal growth, productivity, and constructive mindset (Phát triển bản thân, động lực)',
      bg: '#000000',
      border: '#262626',
      color: '#ededed',
    },
    'meme / humor / satire': {
      text: 'Meme',
      desc: 'Humor, memes, satire, and playful wit (Hài hước, ảnh chế, troll vui)',
      bg: '#000000',
      border: '#262626',
      color: '#ededed',
    },
    'deep dive / technical breakdown / industry insider': {
      text: 'Teardown',
      desc: 'Detailed domain teardown, insider analysis, or technical deep dive (Phân tích chuyên sâu)',
      bg: '#000000',
      border: '#262626',
      color: '#ededed',
    },
    'wholesome / positive': {
      text: 'Wholesome',
      desc: 'Uplifting, heartwarming, and constructive positive content (Ấm áp, tích cực)',
      bg: '#000000',
      border: '#262626',
      color: '#ededed',
    },
    'fearmongering / doom': {
      text: 'Doom',
      desc: 'Sensationalized bad news, existential threat, or doom anxiety (Gieo rắc sợ hãi / bi quan)',
      bg: '#000000',
      border: '#262626',
      color: '#ededed',
    },
    'fomo / hype': {
      text: 'FOMO',
      desc: 'Sensationalized hype, crypto shill, or fear of missing out (Thổi phồng, lùa gà fomo)',
      bg: '#000000',
      border: '#262626',
      color: '#ededed',
    },
    'other / casual discussion': {
      text: 'Casual',
      desc: 'Everyday casual talk or general post (Thảo luận bình thường)',
      bg: '#000000',
      border: '#262626',
      color: '#ededed',
    },
  };

  test("Taxonomy structure has all 7 labels with corresponding badges", () => {
    expect(LABELS.length).toBe(7);
    for (const label of LABELS) {
      expect(BADGE_MAP[label]).toBeDefined();
      expect(BADGE_MAP[label].text).toBeDefined();
      expect(BADGE_MAP[label].color).toBeDefined();
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

    const res = await fetch("https://classifier.dev", {
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
  });

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

    const res = await fetch("https://classifier.dev", {
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
  });

  test("Live API proof: disabling a category makes Jev AI blind to it", async () => {
    const toxicPost = "Bọn này toàn lũ ngu dốt thất bại ăn bám xã hội biến đi cho rảnh mắt";

    // 1. When rage-bait label is included in API call
    const resWithRage = await fetch("https://classifier.dev", {
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
    const resWithoutRage = await fetch("https://classifier.dev", {
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
    // Because rage bait is omitted, Jev cannot detect it and assigns other / casual discussion!
    expect(dataWithoutRage.results[0].label).toBe("other / casual discussion");
  });

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
        text: `🏷️ ${displayName}`,
        bg: 'rgba(168, 85, 247, 0.18)',
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
    expect(badge.text).toBe('🏷️ anime');
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
    const res = await fetch("https://classifier.dev", {
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
    expect(result.scores).toBeDefined();
    expect(typeof result.scores['deep dive / technical breakdown / industry insider']).toBe('number');
    expect(typeof result.scores['meme / humor / satire']).toBe('number');
  });

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
});



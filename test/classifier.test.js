import { expect, test, describe } from "bun:test";

describe("Custom 4-Filter Classifier Taxonomy", () => {
  const LABELS = [
    'self-improvement / motivational',
    'meme / humor / satire',
    'deep dive / technical breakdown / industry insider',
    'other / casual discussion',
  ];

  const INSTRUCTIONS =
    'Classify social media content in Vietnamese or English into exactly one category: ' +
    '1. "self-improvement / motivational": personal growth, discipline, fitness, productivity lessons, inspiring mindsets, self-help, stoicism. ' +
    '2. "meme / humor / satire": lighthearted jokes, funny memes, sarcastic humor, parody, troll posts. ' +
    '3. "deep dive / technical breakdown / industry insider": in-depth technical threads, architectural teardowns, insider industry analysis, comprehensive teardowns of complex problems. ' +
    '4. "other / casual discussion": everyday personal chatter, news, generic talk, or any content that does not fit the other three categories.';

  const BADGE_MAP = {
    'self-improvement / motivational': {
      text: '🌱 Động lực / Mindset',
      desc: 'Personal growth, productivity, and constructive mindset',
      bg: 'rgba(245, 158, 11, 0.18)',
      border: '#f59e0b',
      color: '#fbbf24',
    },
    'meme / humor / satire': {
      text: '🎭 Meme / Giải trí',
      desc: 'Humor, memes, satire, and playful wit',
      bg: 'rgba(236, 72, 153, 0.18)',
      border: '#ec4899',
      color: '#f472b6',
    },
    'deep dive / technical breakdown / industry insider': {
      text: '🔬 Mổ xẻ / Deep Dive',
      desc: 'Detailed domain teardown, insider analysis, or technical deep dive',
      bg: 'rgba(99, 102, 241, 0.2)',
      border: '#6366f1',
      color: '#818cf8',
    },
    'other / casual discussion': {
      text: '💬 Thảo luận / Khác',
      desc: 'Everyday casual talk or general post',
      bg: 'rgba(100, 116, 139, 0.15)',
      border: '#64748b',
      color: '#94a3b8',
    },
  };

  test("Taxonomy structure has exactly 4 labels with corresponding badges", () => {
    expect(LABELS.length).toBe(4);
    for (const label of LABELS) {
      expect(BADGE_MAP[label]).toBeDefined();
      expect(BADGE_MAP[label].text).toBeDefined();
      expect(BADGE_MAP[label].color).toBeDefined();
    }
  });

  test("Badge logic: suppresses badge for 'other / casual discussion'", () => {
    function shouldRenderBadge(label, confidence, threshold) {
      if (label === 'other / casual discussion') return false;
      const meta = BADGE_MAP[label];
      if (!meta) return false;
      return confidence >= threshold;
    }

    expect(shouldRenderBadge('other / casual discussion', 0.99, 0.30)).toBe(false);
    expect(shouldRenderBadge('self-improvement / motivational', 0.85, 0.30)).toBe(true);
    expect(shouldRenderBadge('self-improvement / motivational', 0.20, 0.30)).toBe(false);
    expect(shouldRenderBadge('meme / humor / satire', 0.75, 0.50)).toBe(true);
    expect(shouldRenderBadge('meme / humor / satire', 0.40, 0.50)).toBe(false);
    expect(shouldRenderBadge('deep dive / technical breakdown / industry insider', 0.90, 0.35)).toBe(true);
  });

  test("Live classifier.dev API correctly maps samples to the 4 categories", async () => {
    const inputs = [
      "Kỷ luật thép mỗi ngày dậy 5h sáng chạy bộ và thiền định",
      "nhìn thằng bạn code CSS căn giữa div cười ỉa vcl =)))",
      "Mổ xẻ chi tiết kiến trúc Distributed Consensus Raft vs Paxos trong database phân tán",
      "Hôm nay trời đẹp quá tí đi uống cà phê không anh em"
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
    expect(data.results.length).toBe(4);

    expect(data.results[0].label).toBe("self-improvement / motivational");
    expect(data.results[1].label).toBe("meme / humor / satire");
    expect(data.results[2].label).toBe("deep dive / technical breakdown / industry insider");
    expect(data.results[3].label).toBe("other / casual discussion");
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

  test("Dynamic taxonomy generation excludes disabled categories", () => {
    const TAXONOMY_CATALOG = {
      'self-improvement / motivational': { configKey: 'filterMotivationalEnabled', instruction: 'motivational...' },
      'meme / humor / satire': { configKey: 'filterMemeEnabled', instruction: 'meme...' },
      'deep dive / technical breakdown / industry insider': { configKey: 'filterDeepDiveEnabled', instruction: 'deep dive...' },
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

    // All on
    const allOn = getActiveTaxonomy({
      filterMotivationalEnabled: true,
      filterMemeEnabled: true,
      filterDeepDiveEnabled: true,
      autoBlurRageEnabled: true,
      blockScamsEnabled: true,
      collapseSeedingEnabled: true,
    });
    expect(allOn.labels.length).toBe(7);
    expect(allOn.labels).toContain('rage bait / toxic / hostile / dismissive negativity');

    // Rage bait turned OFF
    const rageOff = getActiveTaxonomy({
      filterMotivationalEnabled: true,
      filterMemeEnabled: true,
      filterDeepDiveEnabled: true,
      autoBlurRageEnabled: false,
      blockScamsEnabled: true,
      collapseSeedingEnabled: true,
    });
    expect(rageOff.labels.length).toBe(6);
    expect(rageOff.labels).not.toContain('rage bait / toxic / hostile / dismissive negativity');

    // Meme turned OFF
    const memeOff = getActiveTaxonomy({
      filterMotivationalEnabled: true,
      filterMemeEnabled: false,
      filterDeepDiveEnabled: true,
      autoBlurRageEnabled: true,
      blockScamsEnabled: true,
      collapseSeedingEnabled: true,
    });
    expect(memeOff.labels.length).toBe(6);
    expect(memeOff.labels).not.toContain('meme / humor / satire');

    // All OFF
    const allOff = getActiveTaxonomy({
      filterMotivationalEnabled: false,
      filterMemeEnabled: false,
      filterDeepDiveEnabled: false,
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

    // Only motivational and meme enabled
    const partial = getActiveTaxonomy({
      filterMotivationalEnabled: true,
      filterMemeEnabled: true,
      filterDeepDiveEnabled: false,
      autoBlurRageEnabled: false,
      blockScamsEnabled: false,
      collapseSeedingEnabled: false,
    });
    expect(partial.instructions).toContain('1. "self-improvement / motivational"');
    expect(partial.instructions).toContain('2. "meme / humor / satire"');
    expect(partial.instructions).toContain('3. "other / casual discussion"');
    expect(partial.instructions).not.toContain('4.');
    expect(partial.instructions).not.toContain('7.');
  });

  test("Targeted cache keys isolate taxonomy changes from UI settings", () => {
    const TAXONOMY_KEYS = [
      'filterMotivationalEnabled',
      'filterMemeEnabled',
      'filterDeepDiveEnabled',
      'autoBlurRageEnabled',
      'blockScamsEnabled',
      'collapseSeedingEnabled',
      'confidenceThreshold',
    ];

    expect(TAXONOMY_KEYS.includes('filterMotivationalEnabled')).toBe(true);
    expect(TAXONOMY_KEYS.includes('autoBlurRageEnabled')).toBe(true);
    expect(TAXONOMY_KEYS.includes('hideFloatingPill')).toBe(false);
    expect(TAXONOMY_KEYS.includes('blockReelsEnabled')).toBe(false);
    expect(TAXONOMY_KEYS.includes('monkModeEnabled')).toBe(false);
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
});


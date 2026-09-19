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

    console.log("Test Results from Jev AI:");
    data.results.forEach((r, idx) => {
      console.log(`- [${inputs[idx]}] -> ${r.label} (${Math.round(r.confidence * 100)}%)`);
    });

    expect(data.results[0].label).toBe("self-improvement / motivational");
    expect(data.results[1].label).toBe("meme / humor / satire");
    expect(data.results[2].label).toBe("deep dive / technical breakdown / industry insider");
    expect(data.results[3].label).toBe("other / casual discussion");
  });
});

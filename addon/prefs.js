pref("aiProvider", "openrouter");
pref("aiApiKey", "");
pref("aiBaseURL", "https://openrouter.ai/api/v1");
pref("aiModel", "");
pref("aiTemperature", "0.2");
pref("aiMaxTokens", 8192);
pref("annotationColor", "#8000ff");
pref(
  "aiSystemPrompt",
  // "You are MarginMind, an academic research assistant. Give precise, structured, and evidence-oriented answers based on the provided paper context. (Respond in the user's language)",
  "",
);
pref(
  "popupExplainPrompt",
  "请你作为本对话领域的专家，先拆解选文中的专业术语与概念，给出它们的定义（如涉及交叉学科，请剥离交叉部分，还原其在原学科中的定义）；再结合选文所处的学科背景，将这些概念串联起来，阐述选文的具体含义。",
);
pref(
  "popupCritiquePrompt",
  "请对给定文本的假设、方法论与论证进行批判性分析，指出其中的不足之处、未经检验的前提以及牵强解释。",
);
pref("popupBulletizePrompt", "将所选文本提炼为要点，每条要点保持简洁、清晰。");
pref(
  "popupTranslatePrompt",
  "请使用规范的学术术语将以下内容翻译成`中文`。确保技术术语符合`计算机科学/化学/生物学/人工智能`领域的标准表述。重要术语保留英文原文，并在括号内附上翻译。仅输出翻译结果，保持专业、客观的语气。",
);
pref("aiPresets", "[]");
pref("markdownFontSize", "text-[14px]");
pref("mineruApiKey", "");

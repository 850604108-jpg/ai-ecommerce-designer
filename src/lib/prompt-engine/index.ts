import { getPlatformProfile } from "./platforms";
import {
  ecommercePlatforms,
  type DetailPageModulePrompt,
  type EcommercePlatform,
  type PlatformPromptProfile,
  type PromptEngineInput,
  type PromptEngineOptions,
  type PromptEngineOutput,
} from "./types";

export { ecommercePlatforms };
export { getPlatformProfile };
export type {
  EcommercePlatform,
  PromptEngineInput,
  PromptEngineOptions,
  PromptEngineOutput,
};

const defaultPlatform: EcommercePlatform = "taobao";

function normalizeInput(input: PromptEngineInput): PromptEngineInput {
  return {
    product_name: input.product_name.trim(),
    category: input.category.trim(),
    highlights: input.highlights
      .map((highlight) => highlight.trim())
      .filter(Boolean)
      .slice(0, 8),
  };
}

function validateInput(input: PromptEngineInput) {
  if (!input.product_name) {
    throw new Error("product_name is required.");
  }

  if (!input.category) {
    throw new Error("category is required.");
  }

  if (!Array.isArray(input.highlights)) {
    throw new Error("highlights must be an array.");
  }
}

function joinList(items: string[]) {
  return items.length ? items.join("；") : "无额外卖点，基于品类常见购买顾虑推断";
}

function buildBuyerConcernMap(input: PromptEngineInput) {
  const highlights = input.highlights.length
    ? input.highlights
    : ["材质/品质", "使用场景", "规格适配", "细节可信度"];

  return highlights.map((highlight, index) => {
    const concernLabel = [
      "核心利益",
      "品质证明",
      "使用场景",
      "规格适配",
      "细节信任",
      "购买顾虑",
      "对比优势",
      "操作便利",
    ][index];

    return `${concernLabel || "卖点"}：${highlight}`;
  });
}

function buildBaseContext(
  input: PromptEngineInput,
  profile: PlatformPromptProfile,
) {
  const buyerConcerns = buildBuyerConcernMap(input);

  return [
    `平台：${profile.label}`,
    `商品名称：${input.product_name}`,
    `品类：${input.category}`,
    `核心卖点：${joinList(input.highlights)}`,
    `买家关注点地图：${buyerConcerns.join("；")}`,
    `平台图片规则：${profile.imageRules.join("；")}`,
    `视觉语气：${profile.visualTone.join("、")}`,
    `文案规则：${profile.copyRules.join("；")}`,
    "商品形态、颜色、比例、材质必须与用户上传/提供的真实商品一致；没有提供的尺寸、认证、功效不得编造为确定事实",
  ].join("\n");
}

function createPrompt(parts: string[]) {
  return parts.filter(Boolean).join("\n\n");
}

function buildMainImagePrompt(
  input: PromptEngineInput,
  profile: PlatformPromptProfile,
) {
  return createPrompt([
    buildBaseContext(input, profile),
    "任务：生成主图 Prompt。",
    [
      "构图要求：商品占画面主体，完整清晰可辨认，移动端缩略图下仍能看清品类和关键结构。",
      "画幅：1:1 方图，适合主图/货架入口；商品完整居中或轻微 3/4 角度，不能裁切主体。",
      "背景要求：优先白底或浅灰干净商业背景；主图遵守 Amazon AM-01 思路，真实产品优先，避免复杂场景。",
      "视觉证明：只保留最强 1 个可见卖点，如材质纹理、容量尺度、结构稳定或套装内容；不要把主图做成信息图。",
      "文字策略：主图默认无字；如平台货架需要文字，仅使用 1 个极短中文卖点标签，不能覆盖商品。",
      "负面约束：不要夸张发光、虚假对比、不可读小字、无来源认证标识、竞品品牌、价格、促销贴纸或详情页式大段文案。",
    ].join("\n"),
  ]);
}

function buildLifestylePrompt(
  input: PromptEngineInput,
  profile: PlatformPromptProfile,
) {
  return createPrompt([
    buildBaseContext(input, profile),
    "任务：生成场景图 Prompt。",
    [
      `场景方向：选择最符合「${input.category}」的真实使用场景，让目标用户一眼理解商品解决什么问题。`,
      "人物/环境关系：商品必须是动作或结果的核心，人物、手部、家居、户外或工作台等环境只作为证明层。",
      "动态表达：用正在使用、前后状态、手持尺度、空间适配或结果展示来证明卖点，不要只摆拍商品。",
      "文字策略：可使用 0-2 个中文短标签，放在干净留白处，不遮挡商品和关键动作。",
      "摄影风格：自然光、真实商业摄影、适度景深，避免 AI 海报感和过度幻想装饰。",
    ].join("\n"),
  ]);
}

function buildInfographicPrompt(
  input: PromptEngineInput,
  profile: PlatformPromptProfile,
) {
  return createPrompt([
    buildBaseContext(input, profile),
    "任务：生成信息图 Prompt。",
    [
      "信息结构：从核心卖点中合并同类项，形成 3-5 个买家真正关心的证明点。",
      "视觉证明：每个证明点必须连接到商品真实部位、使用过程、尺寸关系、材质纹理或场景结果。",
      "版式：大标题 + 商品主体 + 连接线/放大镜/图标标签/小规格块；标签短、层级清楚，适合手机端阅读。",
      "数据规则：只使用输入中出现的明确规格；缺失的数字不得编造，可写成“约/示意”但不要当作参数。",
      "负面约束：不要堆满无关图标，不要让文字覆盖商品关键结构，不要使用竞品品牌或未经证明的绝对化表述。",
    ].join("\n"),
  ]);
}

function buildDetailPagePrompt(
  input: PromptEngineInput,
  profile: PlatformPromptProfile,
) {
  return createPrompt([
    buildBaseContext(input, profile),
    "任务：生成详情页模块 Prompt。",
    [
      `详情页平台要求：${profile.detailPageRules.join("；")}`,
      "模块结构：按 Amazon A+/详情页 AD 模块规划，包含首屏价值、问题解决、核心卖点证明、结构细节、使用场景、规格适配、设置/FAQ。",
      "每屏原则：一个大观点 + 一个视觉事件 + 一个环境或细节层，不做空泛商品横幅；每个模块都要回答一个买家顾虑。",
      "图文关系：中文标题短而具体，副文案不超过一句，证明标签 1-4 个；文字集中在预留区域，避免遮挡商品关键部位。",
      "可扩展规则：AD-01 到 AD-07 可独立生成；用户可只生成 AD-03~AD-06 等范围，不要让详情页和主图/副图混在同一批任务里。",
      "负面约束：不要重复同一张居中商品图，不要编造证书、参数或使用效果，不要把详情页做成纯文字说明。",
    ].join("\n"),
  ]);
}

function buildDetailModuleImagePrompt(
  input: PromptEngineInput,
  profile: PlatformPromptProfile,
  module: Omit<DetailPageModulePrompt, "imagePrompt">,
  role: string,
) {
  return createPrompt([
    buildBaseContext(input, profile),
    `任务：生成详情页模块图 ${module.id}。`,
    [
      `模块标题：${module.title}`,
      `模块说明：${module.description}`,
      `模块角色：${role}`,
      "画幅：根据用户选择生成横向详情页模块、方形模块或竖向模块；如用于 9:32 超长详情页，单张应像可向下拼接的竖向详情页分镜。",
      "核心标准：一个大观点 + 一个视觉事件 + 一个环境或细节层；不要做成只有商品和标签的空横幅。",
      "版式：预留清晰标题区，中文标题短而具体，辅助文字不超过一句，1-4 个证明标签集中成组，不覆盖商品关键结构；模块之间版式要有节奏变化。",
      "视觉证明：把卖点绑定到真实商品部件、使用动作、空间尺度、材质纹理、结构细节或规格关系；没有输入的参数只可示意，不能写成确定数字。",
      "风格：真实电商详情页质感，商品完整清晰，移动端可读，色彩根据商品/品类选择一个强调色搭配中性文字。",
      "负面约束：不要编造认证、夸张功效、竞品品牌、价格促销贴、霓虹光效、堆叠小字、重复居中商品图或无意义图标。",
    ].join("\n"),
  ]);
}

function buildDetailPageModules(
  input: PromptEngineInput,
  profile: PlatformPromptProfile,
): DetailPageModulePrompt[] {
  const highlights = input.highlights.length
    ? input.highlights
    : ["核心价值清晰", "品质细节可信", "真实场景适配", "规格信息易懂"];
  const [primary, proof, scene, fit, detail] = highlights;

  const baseModules: Array<{
    id: string;
    role: string;
    title: string;
    description: string;
  }> = [
    {
      id: "AD-01",
      role: "Brand/value hero",
      title: `${input.product_name}，把核心价值讲清楚`,
      description: `用真实场景呈现${input.category}的主要购买理由：${primary || "解决用户核心需求"}。`,
    },
    {
      id: "AD-02",
      role: "Problem/solution",
      title: "痛点到解决方案，一屏看懂",
      description: `把买家使用前的顾虑和商品带来的结果放在同一画面中，用场景或前后对比证明${primary || "核心卖点"}。`,
    },
    {
      id: "AD-03",
      role: "Core selling-point proof",
      title: "核心卖点有证据",
      description: `合并主要卖点与支撑证明，突出${proof || primary || "材质、结构或效果"}，让优势可视化而不是只写参数。`,
    },
    {
      id: "AD-04",
      role: "Structure/detail",
      title: "关键细节放大说明",
      description: `用连接式放大窗、局部特写或结构标注解释${detail || proof || "用户最关心的细节"}。`,
    },
    {
      id: "AD-05",
      role: "Use-case expansion",
      title: "真实使用场景覆盖日常需求",
      description: `展示${scene || "目标用户的典型使用场景"}，让买家理解商品如何进入生活或工作流程。`,
    },
    {
      id: "AD-06",
      role: "Specification/fit",
      title: "规格与适配信息更直观",
      description: `把${fit || "尺寸、容量、适配或安装信息"}做成清晰的规格/适配模块，只使用用户已提供的确定信息。`,
    },
    {
      id: "AD-07",
      role: "Setup/care/FAQ",
      title: "安装、使用或常见顾虑说明",
      description: `用步骤、FAQ 或注意事项回答买家最后的疑问；如果没有明确步骤，则做成购买前确认模块。`,
    },
  ];

  return baseModules.map((module) => ({
    id: module.id,
    title: module.title,
    description: module.description,
    imagePrompt: buildDetailModuleImagePrompt(input, profile, module, module.role),
  }));
}

export function isEcommercePlatform(value: unknown): value is EcommercePlatform {
  return (
    typeof value === "string" &&
    ecommercePlatforms.includes(value as EcommercePlatform)
  );
}

export function generatePromptSet(
  rawInput: PromptEngineInput,
  options: PromptEngineOptions = {},
): PromptEngineOutput {
  const input = normalizeInput(rawInput);
  validateInput(input);

  const platform = options.platform || defaultPlatform;
  const profile = getPlatformProfile(platform);

  return {
    mainImagePrompt: buildMainImagePrompt(input, profile),
    lifestylePrompt: buildLifestylePrompt(input, profile),
    infographicPrompt: buildInfographicPrompt(input, profile),
    detailPagePrompt: buildDetailPagePrompt(input, profile),
    detailPageModules: buildDetailPageModules(input, profile),
  };
}

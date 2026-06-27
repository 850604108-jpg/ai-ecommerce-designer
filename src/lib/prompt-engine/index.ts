import { getPlatformProfile } from "./platforms";
import {
  ecommercePlatforms,
  type DetailPageModulePrompt,
  type EcommercePlatform,
  type ListingImagePrompt,
  type ListingImageRole,
  type MainImagePrompt,
  type PlatformPromptProfile,
  type PromptEngineInput,
  type PromptEngineOptions,
  type PromptEngineOutput,
} from "./types";

export { ecommercePlatforms };
export { getPlatformProfile };
export type {
  EcommercePlatform,
  ListingImagePrompt,
  ListingImageRole,
  MainImagePrompt,
  PromptEngineInput,
  PromptEngineOptions,
  PromptEngineOutput,
};

const defaultPlatform: EcommercePlatform = "taobao";
const listingImageRoles: ListingImageRole[] = [
  "benefit",
  "feature",
  "dimension",
  "lifestyle",
  "detail",
  "comparison",
  "how_to_use",
  "package",
];
const defaultListingRoles: ListingImageRole[] = [
  "benefit",
  "feature",
  "dimension",
  "lifestyle",
  "detail",
  "comparison",
  "how_to_use",
];

const listingRoleProfiles: Record<
  ListingImageRole,
  {
    title: string;
    buyerQuestion: string;
    chinaLayoutFormula: string;
    copyPattern: string;
    visualProof: string;
    layout: string;
  }
> = {
  benefit: {
    title: "核心卖点/利益图",
    buyerQuestion: "这个商品解决什么核心问题，最值得购买的结果是什么。",
    chinaLayoutFormula:
      "中国电商利益图配方：1 个 4-9 字中文主结论 + 商品主体 55%-70% + 2-3 个短证明标签 + 留白中的行动结果暗示。",
    copyPattern: "中文短标题要像淘宝/抖音/拼多多货架可读卖点，不写英文长句，不写详情页段落。",
    visualProof: "用一个核心利益点连接真实商品部位、包装信息、容量尺度或使用结果。",
    layout: "大标题或大卖点 + 商品主体 + 1-3 个短证明标签，移动端一眼可读。",
  },
  feature: {
    title: "功能拆解/结构证明图",
    buyerQuestion: "商品优势背后的结构、材质或机制是否可信。",
    chinaLayoutFormula:
      "中国电商结构图配方：完整商品 + 2-4 个连接式 callout + 局部放大窗/箭头，所有标注都指向真实可见部位。",
    copyPattern: "中文标签用名词短语或动词短句，例如结构、材质、封口、工艺、功能路径，不写虚构参数。",
    visualProof: "用连接式 callout、放大窗、结构分层或功能路径指向真实可见部位。",
    layout: "商品完整视图居中或偏侧，周围 2-4 个结构证明点，避免无意义图标堆叠。",
  },
  dimension: {
    title: "尺寸/规格/适配图",
    buyerQuestion: "尺寸、容量、规格或适配关系是否符合我的使用需求。",
    chinaLayoutFormula:
      "中国电商规格图配方：商品完整图 + 规格卡片/尺寸线/容量参照 + 只展示用户已提供的确定数字。",
    copyPattern: "中文规格表达要集中成组，数字缺失时只能写示意/参考，不可自动补全。",
    visualProof: "用尺寸线、手持/场景尺度、规格块或空间关系表达已提供的确定信息。",
    layout: "技术感清爽版式，数字/规格集中成组；缺失数字只能写示意，不能编造。",
  },
  lifestyle: {
    title: "场景使用图",
    buyerQuestion: "商品在真实生活中如何使用，适合什么人和什么场景。",
    chinaLayoutFormula:
      "中国电商场景图配方：真实使用环境 + 商品清晰占位 + 手部/动作/结果证明 + 0-2 条封面式短文案。",
    copyPattern: "文案像短视频封面或导购说明，直接说场景结果，不能把产品淹没在氛围图里。",
    visualProof: "真实动作、手部使用、场景结果或前后状态证明商品价值。",
    layout: "商品与场景关系清楚，文字 0-2 条，优先让动作和环境证明卖点。",
  },
  detail: {
    title: "细节特写/局部放大图",
    buyerQuestion: "关键细节是否可靠，材质、包装、工艺或部件是否值得信任。",
    chinaLayoutFormula:
      "中国电商细节图配方：1 个大细节特写 + 1 个小全图定位 + 1-3 个连接标签，证明点必须真实可见。",
    copyPattern: "中文标签只描述真实细节，如密封、纹理、接口、颗粒、材质，不添加未给出的认证。",
    visualProof: "使用真实局部特写、连接式放大窗或大细节 + 小全图关系。",
    layout: "1 个大细节或 2-4 个有价值细节，标签短，不做重复宏观网格。",
  },
  comparison: {
    title: "对比图",
    buyerQuestion: "与普通选择相比，本商品的差异在哪里。",
    chinaLayoutFormula:
      "中国电商对比图配方：左右/上下分屏 + 本品高亮 + 普通选项弱化 + 3-5 条真实差异，不出现竞品品牌。",
    copyPattern: "中文对比词要克制，只能基于用户卖点或可见事实，不写攻击性和绝对化结论。",
    visualProof: "只比较用户提供或可从商品真实信息推导的差异，不出现竞品品牌。",
    layout: "左侧/上方突出本品，右侧普通选项灰化；3-5 行对比，避免虚假贬低。",
  },
  how_to_use: {
    title: "使用步骤/流程图",
    buyerQuestion: "商品如何使用、安装、打开、保存或完成任务。",
    chinaLayoutFormula:
      "中国电商步骤图配方：3-4 个编号步骤 + 同一真实商品状态变化 + 箭头流程 + 最终结果画面。",
    copyPattern: "步骤文案短而像说明书，每步只写动作，不编造用户没有提供的使用条件。",
    visualProof: "用 3-4 个步骤、箭头、手部动作或状态变化展示真实流程。",
    layout: "步骤编号清楚，每格都显示同一真实商品状态变化，不夸张变形。",
  },
  package: {
    title: "包装/全家福图",
    buyerQuestion: "我会收到什么，套装内容或包装是否清楚。",
    chinaLayoutFormula:
      "中国电商包装图配方：商品/包装整齐陈列 + 已知内容短标签 + 可选开箱视角，不添加未知配件。",
    copyPattern: "中文标签只说明用户已确认的数量、包装、容量或保质信息，未知内容留空。",
    visualProof: "展示已提供的商品、包装和明确存在的配件；未知配件不得添加。",
    layout: "1:1 平铺或整齐陈列，每个已知物品短标签，背景干净。",
  },
};

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

function buildPlatformDnaBlock(profile: PlatformPromptProfile) {
  return [
    `平台视觉 DNA：${profile.visualDna.join("；")}`,
    `中国平台风格指纹：${profile.chinaPlatformSignals.join("；")}`,
    `移动端缩略图规则：${profile.thumbnailRules.join("；")}`,
    "中国电商视觉硬要求：画面必须像当前中国平台的商品副图/详情图，中文标题、标签密度、标注形态、留白和信息层级都要服务手机端成交。",
  ].join("\n");
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
    buildPlatformDnaBlock(profile),
    `平台图片规则：${profile.imageRules.join("；")}`,
    `视觉语气：${profile.visualTone.join("、")}`,
    `平台买家问题：${profile.buyerConcernRules.join("；")}`,
    `视觉证明策略：${profile.visualProofRules.join("；")}`,
    `版式决策：${profile.layoutRules.join("；")}`,
    `文案规则：${profile.copyRules.join("；")}`,
    `平台负面约束：${profile.negativeRules.join("；")}`,
    "商品形态、颜色、比例、材质必须与用户上传/提供的真实商品一致；没有提供的尺寸、认证、功效不得编造为确定事实",
  ].join("\n");
}

function normalizeMainImageCount(value: number | undefined) {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.min(Math.max(Math.floor(value || 1), 1), 8);
}

function normalizeListingImageCount(value: number | undefined) {
  if (!Number.isFinite(value)) {
    return 5;
  }

  return Math.min(Math.max(Math.floor(value || 5), 1), 7);
}

function normalizeReferenceInfluence(value: number | undefined) {
  if (!Number.isFinite(value)) {
    return 30;
  }

  return Math.min(Math.max(Math.floor(value || 30), 0), 80);
}

function normalizeListingRole(value: unknown, fallback: ListingImageRole) {
  return typeof value === "string" &&
    listingImageRoles.includes(value as ListingImageRole)
    ? (value as ListingImageRole)
    : fallback;
}

function normalizeListingRoles(
  roles: ListingImageRole[] | undefined,
  count: number,
) {
  return Array.from({ length: count }, (_, index) =>
    normalizeListingRole(roles?.[index], defaultListingRoles[index] || "benefit"),
  );
}

function buildProductFidelityRules() {
  return [
    "产品还原硬规则：生成图片中的产品必须严格还原用户上传图像。",
    "如果生图模型支持参考图/编辑模式，必须以用户上传产品图作为首要图像参考；不能只依赖文字描述重画产品。",
    "不得改变产品外形、瓶身/包装结构、标签文字、颜色、材质、比例、数量、盖子、透明度、内容物状态或真实可见配件。",
    "不得新增不存在的配件、包装、认证、品牌、参数、奖章、口味、容量、功效或促销信息。",
    "如果参考图与用户产品冲突，必须以用户产品图为准；参考图只能影响构图、色调、字体标注、版式节奏、背景氛围。",
  ].join("\n");
}

function buildReferenceStyleContext(input: {
  customRequirement?: string;
  referenceImageNotes?: string;
  referenceInfluence: number;
}) {
  const notes = input.referenceImageNotes?.trim();
  const requirement = input.customRequirement?.trim();
  const refinedRequirement = requirement
    ? [
        "用户要求理解与优化：",
        `原始要求：${requirement}`,
        "执行方式：先理解用户的真实视觉意图，再转译为可执行的构图、色调、文案密度、画面复杂度、质感或平台适配约束。",
        "优先级：该要求必须服务于本张图的 AS 角色和平台规则；如与产品还原、真实卖点或平台负面约束冲突，必须让位于产品真实和合规。",
        "落地规则：不要照抄用户短句当画面文字，除非用户明确要求作为可见文案；应把它变成视觉风格、布局或表达策略。",
      ].join("\n")
    : "用户要求理解与优化：未提供。";

  return [
    `参考图影响比例：${input.referenceInfluence}%。`,
    notes
      ? `参考图片/风格说明：${notes}`
      : "参考图片/风格说明：未提供，按当前平台与商品品类默认电商风格生成。",
    refinedRequirement,
    "参考图只迁移构图、色调、字体/标注密度、版式节奏和场景氛围；不得迁移参考图中的产品结构、品牌元素、包装文字或配件。",
  ].join("\n");
}

function getDetailModuleIndex(id: string | undefined) {
  const match = id?.match(/^AD-(0[1-7])$/);

  return match ? Number(match[1]) - 1 : -1;
}

function selectDetailModules(
  modules: DetailPageModulePrompt[],
  startId: string | undefined,
  endId: string | undefined,
) {
  const startIndex = Math.max(getDetailModuleIndex(startId), 0);
  const endIndex = Math.max(getDetailModuleIndex(endId), startIndex);

  return modules.slice(startIndex, endIndex + 1);
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
    "任务：生成副图 Prompt。",
    [
      "构图要求：商品占画面主体，完整清晰可辨认，移动端缩略图下仍能看清品类和关键结构。",
      "画幅：1:1 方图，适合副图套组；商品完整居中或轻微 3/4 角度，不能裁切主体。",
      "背景要求：真实产品优先，可根据副图角色使用浅色商业背景、场景或信息化版式。",
      "买家问题：先判断本张副图要回答“核心优势、规格是否清楚、细节是否可信、如何使用”中的哪一个，不要同时回答所有问题。",
      "视觉证明：只保留最强 1 个可见卖点，如材质纹理、容量尺度、结构稳定或套装内容；不要把副图做成杂乱信息图。",
      "版式决策：提前决定无文字、小标签、侧边短标题或局部 callout；文字必须有预留区域和层级，不随机压在商品上。",
      "文字策略：仅使用短中文卖点标签，不能覆盖商品。",
      "负面约束：不要夸张发光、虚假对比、不可读小字、无来源认证标识、竞品品牌、价格、促销贴纸或详情页式大段文案。",
    ].join("\n"),
  ]);
}

const mainImageDirections = [
  {
    composition: "正面副图，商品完整居中，包装文字和品类识别最清晰。",
    proof: "突出商品主体轮廓、包装信息和最强可见卖点，适合作为第一张点击入口图。",
  },
  {
    composition: "轻微 3/4 角度副图，保持浅色商业背景，增加真实体积和边缘厚度。",
    proof: "用光影和轻微透视证明材质、容量、结构或包装质感，不改变商品比例。",
  },
  {
    composition: "俯视或高角度陈列副图，商品与少量同类道具形成干净层次。",
    proof: "只使用与品类强相关的轻量道具，帮助买家理解规格、套装或使用方式。",
  },
  {
    composition: "局部细节强化副图，商品仍完整出现，同时用近景层突出关键材质或结构。",
    proof: "把核心卖点绑定到真实部件、纹理、封口、接口、容量或工艺细节。",
  },
  {
    composition: "尺度关系副图，商品旁加入中性参照物或手持关系，背景保持干净。",
    proof: "让买家快速理解大小、重量感、握持感或日常使用尺度，不编造尺寸数字。",
  },
  {
    composition: "轻场景副图，商品位于真实但低干扰的使用环境中，仍保持商品可读性。",
    proof: "用环境暗示目标用户和使用场景，但不做成复杂生活方式海报。",
  },
  {
    composition: "组合卖点副图，商品主体完整，旁边以极简图形区域承载 1-2 个短标签。",
    proof: "标签只来自已提供卖点，文字短、可读，不遮挡商品关键结构。",
  },
  {
    composition: "高级商业棚拍副图，商品略偏中心，利用柔和反光、阴影和层次提升质感。",
    proof: "突出真实材质、包装完整度和品质感，避免夸张光效或虚假认证。",
  },
];

function buildMainImagePrompts(
  input: PromptEngineInput,
  profile: PlatformPromptProfile,
  count: number,
): MainImagePrompt[] {
  const baseContext = buildBaseContext(input, profile);

  return Array.from({ length: count }, (_, index) => {
    const direction = mainImageDirections[index] || mainImageDirections[0];
    const id = `AS-${String(index + 1).padStart(2, "0")}`;

    return {
      id,
      title: `${id} 副图：${direction.composition.split("，")[0]}`,
      prompt: createPrompt([
        baseContext,
        `任务：生成第 ${index + 1} 张副图 Prompt（${id} / ${count}）。`,
        [
          `差异化目标：${direction.composition}`,
          "买家问题：本图只回答一个购买疑问，例如品类识别、品质信任、规格尺度、使用场景或核心利益。",
          `视觉证明：${direction.proof}`,
          "版式决策：先确定文字角色、标题区、标签数量、商品/道具关系和前中后景层次；不要生成只有商品加漂浮标签的空图。",
          "画幅：1:1 方图，商品主体完整清晰，移动端缩略图下仍能识别品类和关键结构。",
          "风格：真实电商商业摄影，干净光线，高可信度产品呈现，符合所选平台副图表达习惯。",
          "一致性：同批副图之间只变化角度、构图、光线、道具层次或卖点证明，不改变商品结构、颜色、包装文字和真实比例。",
          "文字策略：默认无字；如平台需要文字，只使用 1 个极短中文卖点标签，不能覆盖商品。",
          "负面约束：不要价格、促销贴纸、无来源认证标识、竞品品牌、夸张发光、复杂背景、不可读小字、详情页式大段文案。",
        ].join("\n"),
      ]),
    };
  });
}

function buildListingImagePrompts(
  input: PromptEngineInput,
  profile: PlatformPromptProfile,
  options: {
    count: number;
    customRequirement?: string;
    roles: ListingImageRole[];
    referenceImageNotes?: string;
    referenceInfluence: number;
  },
): ListingImagePrompt[] {
  const baseContext = buildBaseContext(input, profile);
  const productFidelityRules = buildProductFidelityRules();
  const referenceContext = buildReferenceStyleContext({
    customRequirement: options.customRequirement,
    referenceImageNotes: options.referenceImageNotes,
    referenceInfluence: options.referenceInfluence,
  });

  return Array.from({ length: options.count }, (_, index) => {
    const id = `AS-${String(index + 1).padStart(2, "0")}`;
    const role = options.roles[index] || defaultListingRoles[index] || "benefit";
    const roleProfile = listingRoleProfiles[role] || listingRoleProfiles.benefit;

    return {
      id,
      role,
      title: `${id} ${roleProfile.title}`,
      prompt: createPrompt([
        baseContext,
        productFidelityRules,
        referenceContext,
        `任务：生成 Listing 图片套组中的 ${id}（${roleProfile.title}），1:1 方图。`,
        [
          `买家问题：${roleProfile.buyerQuestion}`,
          `角色版式配方：${roleProfile.chinaLayoutFormula}`,
          `视觉证明：${roleProfile.visualProof}`,
          `版式决策：${roleProfile.layout}`,
          `中文文案策略：${roleProfile.copyPattern}`,
          "平台适配：结合当前平台的买家问题、视觉证明策略、版式决策和负面约束，不直接套用 Amazon 风格。",
          "平台差异化：同一 AS 角色在淘宝/天猫/拼多多/京东/抖音/快手/微信小店上必须呈现不同视觉气质，不能输出通用海外电商模板。",
          "套组一致性：AS-01 到 AS-07 均为副图，必须保持同一真实商品、同一包装状态和一致的品牌/颜色识别；每张图只变化表达目的、版式、场景或证明方式。",
          "文字策略：所有可见文字必须短、清楚、与用户提供信息一致；没有提供的数字、认证、功效和比较结论不得出现。",
          "负面约束：不要产品变形、换包装、换标签、换颜色、添加不存在道具、生成竞品品牌、虚构参数、夸张光效或不可读小字。",
        ].join("\n"),
      ]),
    };
  });
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
      "模块规划：先写清本模块回答的买家问题，再用视觉证明承接；不要把原始卖点逐条拆成重复图片。",
      "图文关系：中文标题短而具体，副文案不超过一句，证明标签 1-4 个；文字集中在预留区域，避免遮挡商品关键部位。",
      "版式决策：每屏提前决定标题区、标签区、商品/人物关系、局部放大方式、动态表达和前中后景层次。",
      "可扩展规则：AD-01 到 AD-07 可独立生成；用户可只生成 AD-03~AD-06 等范围，不要让详情页和副图混在同一批任务里。",
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
      "买家问题：本模块必须回答一个明确购买顾虑，例如品质是否可信、规格是否适配、使用是否省心、细节是否可靠。",
      "画幅：根据用户选择生成横向详情页模块、方形模块或竖向模块；如用于 9:32 超长详情页，单张应像可向下拼接的竖向详情页分镜。",
      "核心标准：一个大观点 + 一个视觉事件 + 一个环境或细节层；不要做成只有商品和标签的空横幅。",
      "版式：预留清晰标题区，中文标题短而具体，辅助文字不超过一句，1-4 个证明标签集中成组，不覆盖商品关键结构；模块之间版式要有节奏变化。",
      "视觉证明：把卖点绑定到真实商品部件、使用动作、空间尺度、材质纹理、结构细节或规格关系；没有输入的参数只可示意，不能写成确定数字。",
      "动态表达：优先使用动作、前后状态、尺寸关系、连接式放大窗、对比面板、步骤路径或环境尺度来证明卖点。",
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

function buildLongDetailPagePrompt(
  input: PromptEngineInput,
  profile: PlatformPromptProfile,
) {
  const modules = buildDetailPageModules(input, profile);

  return createPrompt([
    buildDetailPagePrompt(input, profile),
    "任务：生成一张完整 9:32 电商详情页超长图 Prompt，只输出一张完整页面，不拆分为 AD 模块。",
    [
      "页面结构：首屏价值主视觉 -> 痛点/解决方案 -> 核心卖点证明 -> 结构/细节特写 -> 使用场景 -> 规格/适配 -> FAQ/购买前确认。",
      "长图要求：从顶部到尾部是一张连续页面，模块之间有节奏变化和视觉过渡，不要做成多张缩略图拼贴。",
      "图文关系：每一屏只有一个大观点，中文标题短而具体，证明标签 1-4 个，文字集中在留白区域，不遮挡商品关键结构。",
      "视觉证明：所有信息必须绑定到真实商品部件、包装、材质、使用动作、场景结果或已提供规格；没有输入的参数不得编造。",
      "版式节奏：每屏都要有不同的版式事件，如首屏场景、痛点对比、结构证明、局部放大、使用场景、规格板和 FAQ，不要重复同一居中商品图。",
      `参考模块顺序：${modules
        .map((module) => `${module.id} ${module.title}：${module.description}`)
        .join("；")}`,
      "负面约束：不要只做单张海报，不要重复居中商品图，不要编造认证、价格、促销、参数或绝对化功效。",
    ].join("\n"),
  ]);
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
  const mainImageCount = normalizeMainImageCount(options.mainImageCount);
  const listingImageCount = normalizeListingImageCount(
    options.listingImageCount ?? options.mainImageCount,
  );
  const referenceInfluence = normalizeReferenceInfluence(
    options.referenceInfluence,
  );
  const listingRoles = normalizeListingRoles(
    options.listingImageRoles,
    listingImageCount,
  );
  const listingImagePrompts = buildListingImagePrompts(input, profile, {
    count: listingImageCount,
    customRequirement: options.customRequirement,
    referenceImageNotes: options.referenceImageNotes,
    referenceInfluence,
    roles: listingRoles,
  });
  const generationMode = options.generationMode || "all";
  const detailGenerationMode = options.detailGenerationMode || "modules";
  const detailModules = buildDetailPageModules(input, profile);

  if (generationMode === "all") {
    return {
      mainImagePrompt: buildMainImagePrompt(input, profile),
      mainImagePrompts: buildMainImagePrompts(input, profile, mainImageCount),
      listingImagePrompts,
      lifestylePrompt: buildLifestylePrompt(input, profile),
      infographicPrompt: buildInfographicPrompt(input, profile),
      detailPagePrompt: buildDetailPagePrompt(input, profile),
      detailPageModules: detailModules,
    };
  }

  if (generationMode === "detail" && detailGenerationMode === "long") {
    return {
      mainImagePrompt: "",
      mainImagePrompts: [],
      listingImagePrompts: [],
      lifestylePrompt: "",
      infographicPrompt: "",
      detailPagePrompt: buildLongDetailPagePrompt(input, profile),
      detailPageModules: [],
    };
  }

  if (generationMode === "detail") {
    return {
      mainImagePrompt: "",
      mainImagePrompts: [],
      listingImagePrompts: [],
      lifestylePrompt: "",
      infographicPrompt: "",
      detailPagePrompt: "",
      detailPageModules: selectDetailModules(
        detailModules,
        options.detailStartId,
        options.detailEndId,
      ),
    };
  }

  return {
    mainImagePrompt: listingImagePrompts[0]?.prompt || buildMainImagePrompt(input, profile),
    mainImagePrompts: listingImagePrompts.map((prompt) => ({
      id: prompt.id,
      prompt: prompt.prompt,
      title: prompt.title,
    })),
    listingImagePrompts,
    lifestylePrompt: "",
    infographicPrompt: "",
    detailPagePrompt: "",
    detailPageModules: [],
  };
}

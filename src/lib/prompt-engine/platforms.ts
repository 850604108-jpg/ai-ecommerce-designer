import type { EcommercePlatform, PlatformPromptProfile } from "./types";

export const platformProfiles: Record<EcommercePlatform, PlatformPromptProfile> =
  {
    taobao: {
      id: "taobao",
      label: "淘宝",
      imageRules: [
        "电商主图风格，商品清晰占画面主体，背景干净但允许轻量场景化",
        "突出点击率和货架辨识度，避免杂乱装饰和夸张功效表达",
      ],
      visualTone: ["明亮", "真实商业摄影", "适合移动端缩略图"],
      copyRules: ["中文短标签", "卖点表达直接", "避免绝对化广告词"],
      detailPageRules: ["适合详情页长图模块", "图文层级清楚", "卖点逐屏递进"],
    },
    tmall: {
      id: "tmall",
      label: "天猫",
      imageRules: [
        "品牌感更强的精品电商视觉，商品质感和可信度优先",
        "画面留白更克制，使用高级但不过度的字体和标注系统",
      ],
      visualTone: ["品牌化", "精致棚拍", "高信任感"],
      copyRules: ["中文短标题", "强调品质、材质和标准", "减少低价促销感"],
      detailPageRules: ["详情页模块更像品牌说明书", "结构、材质、场景分层呈现"],
    },
    pinduoduo: {
      id: "pinduoduo",
      label: "拼多多",
      imageRules: [
        "货架冲击力强，核心利益点在缩略图中一眼可读",
        "突出实用、数量、耐用、省心等明确购买理由",
      ],
      visualTone: ["高对比", "强信息密度", "实用可信"],
      copyRules: ["中文大字卖点", "短促明确", "价格感和实用价值优先"],
      detailPageRules: ["用对比、规格、使用前后证明卖点", "减少空泛品牌叙事"],
    },
    jd: {
      id: "jd",
      label: "京东",
      imageRules: [
        "偏标准化和可信赖的电商视觉，商品参数与品质证明清楚",
        "画面干净，技术规格、材质、售后信任点可视化",
      ],
      visualTone: ["专业", "清爽", "参数可信"],
      copyRules: ["中文规格化表达", "强调品质、效率、耐用和服务信任"],
      detailPageRules: ["适合参数表、结构图、场景证明组合", "信息准确不夸大"],
    },
    douyin: {
      id: "douyin",
      label: "抖音电商",
      imageRules: [
        "短视频电商封面感，强调真实使用瞬间和停留率",
        "画面有动作、有结果、有情绪，但商品必须完整可辨认",
      ],
      visualTone: ["真实生活流", "强钩子", "动态感"],
      copyRules: ["中文口语化短句", "突出痛点和结果", "适合封面标题"],
      detailPageRules: ["详情内容可拆成短视频脚本式分镜", "每屏一个明确结果"],
    },
    kuaishou: {
      id: "kuaishou",
      label: "快手电商",
      imageRules: [
        "强调真实、耐用、接地气的使用证明",
        "减少精修距离感，让用户感到商品好用、可信、划算",
      ],
      visualTone: ["真实", "生活化", "朴素可信"],
      copyRules: ["中文直白卖点", "突出耐用、省事、适用人群"],
      detailPageRules: ["用真实场景、对比和细节证明", "避免过度品牌大片感"],
    },
    wechat: {
      id: "wechat",
      label: "微信小店",
      imageRules: [
        "适合私域转化的温和商品图，重视信任、质感和解释清楚",
        "画面不宜过度刺激，适合朋友圈、小店和社群传播",
      ],
      visualTone: ["温和", "可信", "干净生活方式"],
      copyRules: ["中文自然表达", "像导购解释卖点", "减少强促销语言"],
      detailPageRules: ["详情页应清楚回答顾虑", "适合场景、细节、规格、使用说明"],
    },
  };

export function getPlatformProfile(platform: EcommercePlatform) {
  return platformProfiles[platform];
}

import type { MarketplaceTemplate } from "@/lib/templates/types";

export const defaultTemplates: MarketplaceTemplate[] = [
  {
    id: "electronics-premium-launch",
    name: "高端数码首发主图",
    category: "electronics",
    description: "适合耳机、充电器、智能手表等电子产品的高级质感主图。",
    prompt:
      "Premium electronics hero image, crisp product edges, clean white background, subtle graphite reflection, studio lighting, high detail, ecommerce-ready composition",
    preview:
      "linear-gradient(135deg, #111827 0%, #374151 45%, #e5e7eb 100%)",
    tags: ["主图", "高端", "科技感"],
    isFeatured: true,
    isActive: true,
    updatedAt: "2026-06-18",
  },
  {
    id: "fashion-lookbook-clean",
    name: "服饰穿搭 Lookbook",
    category: "fashion",
    description: "突出版型、面料和搭配氛围，适合服装、鞋包、配饰。",
    prompt:
      "Fashion ecommerce lookbook image, clean lifestyle setting, natural pose, accurate fabric texture, soft daylight, premium catalog style, balanced negative space",
    preview:
      "linear-gradient(135deg, #f8fafc 0%, #cbd5e1 50%, #64748b 100%)",
    tags: ["场景图", "穿搭", "质感"],
    isFeatured: true,
    isActive: true,
    updatedAt: "2026-06-18",
  },
  {
    id: "home-warm-minimal",
    name: "家居温暖极简场景",
    category: "home",
    description: "适合收纳、厨具、小家具和家纺产品，突出日常使用场景。",
    prompt:
      "Warm minimal home product scene, real interior context, soft morning light, tidy surfaces, tactile materials, inviting ecommerce lifestyle photography",
    preview:
      "linear-gradient(135deg, #fafaf9 0%, #d6d3d1 55%, #78716c 100%)",
    tags: ["家居", "生活方式", "温暖"],
    isFeatured: false,
    isActive: true,
    updatedAt: "2026-06-18",
  },
  {
    id: "beauty-luxury-flatlay",
    name: "美妆轻奢平铺",
    category: "beauty",
    description: "适合护肤、彩妆、香氛，强调成分、光泽和精致感。",
    prompt:
      "Luxury beauty product flat lay, clean cosmetic arrangement, dewy highlights, soft shadows, elegant neutral styling, high-end ecommerce image",
    preview:
      "linear-gradient(135deg, #fff1f2 0%, #fecdd3 48%, #9f1239 100%)",
    tags: ["美妆", "平铺", "轻奢"],
    isFeatured: true,
    isActive: true,
    updatedAt: "2026-06-18",
  },
  {
    id: "pet-playful-benefits",
    name: "宠物用品卖点图",
    category: "pets",
    description: "用于猫狗玩具、窝垫、喂食器等产品的功能卖点展示。",
    prompt:
      "Pet product benefit infographic, cheerful clean setting, clear feature callouts, friendly lighting, realistic product scale, ecommerce conversion image",
    preview:
      "linear-gradient(135deg, #ecfccb 0%, #86efac 50%, #166534 100%)",
    tags: ["宠物", "卖点图", "功能"],
    isFeatured: false,
    isActive: true,
    updatedAt: "2026-06-18",
  },
  {
    id: "electronics-detail-specs",
    name: "数码参数详情模块",
    category: "electronics",
    description: "把规格、接口、续航、兼容性等信息整理成清晰详情页模块。",
    prompt:
      "Electronics detail page module, precise specification layout, close-up product details, clean labels, technical clarity, marketplace-ready vertical design",
    preview:
      "linear-gradient(135deg, #eff6ff 0%, #93c5fd 45%, #1d4ed8 100%)",
    tags: ["详情页", "参数", "信息图"],
    isFeatured: false,
    isActive: true,
    updatedAt: "2026-06-18",
  },
];

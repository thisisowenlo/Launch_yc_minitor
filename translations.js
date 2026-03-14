// Industry and tag translations: English -> Traditional Chinese
const INDUSTRY_ZH = {
  // Main industries
  "B2B": "企業服務 (B2B)",
  "Healthcare": "醫療健康",
  "Fintech": "金融科技",
  "Consumer": "消費產品",
  "Education": "教育科技",
  "Real Estate and Construction": "房地產與建築",
  "Industrials": "工業製造",
  "Government": "政府服務",
  "Unspecified": "未分類",
  // Sub-industries
  "Engineering, Product and Design": "工程、產品與設計",
  "Supply Chain and Logistics": "供應鏈與物流",
  "Operations": "營運管理",
  "Finance and Accounting": "財務與會計",
  "Sales": "業務銷售",
  "Marketing": "行銷",
  "Human Resources": "人力資源",
  "Security": "資訊安全",
  "Legal": "法務",
  "Recruiting and Talent": "招募與人才",
  "Retail": "零售",
  "Infrastructure": "基礎設施",
  "Analytics": "數據分析",
  "Productivity": "生產力工具",
  "Data Engineering": "資料工程",
  "Developer Tools": "開發者工具",
  "Artificial Intelligence": "人工智慧",
  "Machine Learning": "機器學習",
  "Climate": "氣候科技",
  "Insurance": "保險",
  "Banking and Exchange": "銀行與交易",
  "Payments": "支付",
  "Lending and Credit": "借貸與信用",
  "Asset Management": "資產管理",
  "Digital Health": "數位健康",
  "Drug Discovery": "新藥研發",
  "Medical Devices": "醫療器材",
  "Therapeutics": "治療方案",
  "Diagnostics": "診斷技術",
  "Healthcare IT": "醫療資訊科技",
  "Consumer Health and Wellness": "消費者健康與保健",
  "Education Technology": "教育科技",
  "Travel, Leisure and Tourism": "旅遊與觀光",
  "Food and Beverage": "食品與飲料",
  "Gaming": "遊戲",
  "Media and Entertainment": "媒體與娛樂",
  "Social": "社群",
  "Consumer Electronics": "消費性電子",
  "Virtual and Augmented Reality": "虛擬與擴增實境",
  "Construction": "營建工程",
  "Agriculture": "農業科技",
  "Transportation": "交通運輸",
  "Automotive": "汽車產業",
  "Aviation and Space": "航空與太空",
  "Energy": "能源",
  "Manufacturing and Robotics": "製造與機器人",
  "Semiconductors": "半導體",
  "Drones": "無人機",
  "Hard Tech": "硬科技",
  "GovTech": "政府科技",
  "Defense Tech": "國防科技",
  "Cybersecurity": "網路安全",
  "Crypto / Web3": "加密貨幣 / Web3",
  "Blockchain": "區塊鏈",
  "E-Commerce": "電子商務",
  "SaaS": "軟體即服務 (SaaS)",
  "Marketplace": "平台市集",
  "PropTech": "房地產科技",
  "CleanTech": "清潔科技",
  "BioTech": "生物科技",
  "Quantum Computing": "量子運算",
  "NLP": "自然語言處理",
  "Computer Vision": "電腦視覺",
  "Generative AI": "生成式 AI",
  "AI Assistant": "AI 助理",
  "AI-Enhanced Learning": "AI 增強學習",
  "AI-Powered Drug Discovery": "AI 藥物研發",
  "AIOps": "AI 維運",
  "API": "應用程式介面 (API)",
  "Workflow Automation": "工作流程自動化",
  "Cloud Computing": "雲端運算",
  "Open Source": "開源軟體",
  "Enterprise Software": "企業軟體",
  "Compliance": "法規遵循",
  "Robotic Process Automation": "機器人流程自動化",
  "Mental Health Tech": "心理健康科技",
  "Telemedicine": "遠距醫療",
  "Elder Care": "長照服務",
  "Climate Tech": "氣候科技",
  "Carbon Capture and Removal": "碳捕獲與移除",
  "Electric Vehicles": "電動車",
  "Solar Power": "太陽能",
  "Battery Technology": "電池技術",
  "Sustainable Fashion": "永續時尚",
  "Vertical Farming": "垂直農場",
  "3D Printing": "3D 列印",
  "IoT": "物聯網",
  "Edge Computing": "邊緣運算",
  "No-Code": "無程式碼",
  "Low-Code": "低程式碼",
  "DevOps": "開發維運",
  "DevSecOps": "開發安全維運",
  "MLOps": "機器學習維運",
};

// Batch name translations
const BATCH_ZH = {
  "W": "冬季",
  "S": "夏季",
  "F": "秋季",
  "IK": "Imagine K12",
};

// Status translations
const STATUS_ZH = {
  "Active": "營運中",
  "Public": "已上市",
  "Acquired": "已被收購",
  "Inactive": "已停止營運",
  "": "未知",
};

// Stage translations
const STAGE_ZH = {
  "Early": "早期",
  "Growth": "成長期",
  "Late": "後期",
  "": "未知",
};

/**
 * Translate batch code to Chinese
 * e.g., "W25" -> "2025 冬季批次 (W25)"
 */
function translateBatch(batch) {
  if (!batch) return "未知批次";
  const letter = batch.replace(/[0-9]/g, "");
  const num = batch.replace(/[^0-9]/g, "");
  const year = num.length === 2 ? (parseInt(num) > 50 ? "19" + num : "20" + num) : num;
  const season = BATCH_ZH[letter] || letter;
  return `${year} ${season}批次 (${batch})`;
}

/**
 * Translate industry name to Chinese
 */
function translateIndustry(industry) {
  if (!industry) return "未分類";
  return INDUSTRY_ZH[industry] || industry;
}

/**
 * Translate status to Chinese
 */
function translateStatus(status) {
  return STATUS_ZH[status] || status || "未知";
}

/**
 * Translate stage to Chinese
 */
function translateStage(stage) {
  return STAGE_ZH[stage] || stage || "未知";
}

/**
 * Simple client-side translation for common startup terms
 * This provides a basic translation of one-liner descriptions
 */
const COMMON_TERMS = {
  "for": "用於",
  "platform": "平台",
  "software": "軟體",
  "tool": "工具",
  "tools": "工具",
  "company": "公司",
  "companies": "公司",
  "business": "企業",
  "businesses": "企業",
  "startup": "新創公司",
  "startups": "新創公司",
  "customer": "客戶",
  "customers": "客戶",
  "developer": "開發者",
  "developers": "開發者",
  "data": "資料",
  "cloud": "雲端",
  "app": "應用程式",
  "application": "應用程式",
  "marketplace": "市集平台",
  "payment": "支付",
  "payments": "支付",
  "insurance": "保險",
  "healthcare": "醫療",
  "health": "健康",
  "AI": "人工智慧",
  "artificial intelligence": "人工智慧",
  "machine learning": "機器學習",
  "automation": "自動化",
  "security": "安全",
  "analytics": "數據分析",
  "infrastructure": "基礎設施",
  "API": "API 介面",
  "e-commerce": "電子商務",
  "ecommerce": "電子商務",
  "fintech": "金融科技",
  "enterprise": "企業",
  "workflow": "工作流程",
  "robotics": "機器人技術",
  "blockchain": "區塊鏈",
  "crypto": "加密貨幣",
};

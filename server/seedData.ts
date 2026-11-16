export type AccountType =
  | 'Biopharma'
  | 'CDMO'
  | 'CRO'
  | 'Academic'
  | 'Clinical Lab'
  | 'OEM';

export type OrgTerritory =
  | 'NA-East'
  | 'NA-West'
  | 'EU-North'
  | 'EU-DACH'
  | 'APAC';

export type ProductLine =
  | 'qPCR & dPCR Reagents'
  | 'NGS Library Prep'
  | 'Cell Culture Media'
  | 'Chromatography Resins'
  | 'Automated Liquid Handling'
  | 'Diagnostic Assay Kits';

export type OrderCategory = 'Catalog' | 'Custom';

export type Channel =
  | 'Field Sales'
  | 'Inside Sales'
  | 'E-Commerce Portal'
  | 'Distributor Partner'
  | 'OEM Direct';

export type LeadSource =
  | 'Trade Conference'
  | 'Technical Whitepaper'
  | 'Scientific Webinar'
  | 'Organic Search'
  | 'Paid Search'
  | 'Email Nurture'
  | 'Partner Referral'
  | 'Outbound SDR';

export interface RawAccount {
  account_id: string;
  account_name: string;
  account_type: AccountType;
  org_territory: OrgTerritory;
  first_touch_date: string;
  first_touch_source: LeadSource;
  cohort_behavior: 'healthy' | 'under_buying' | 'quiet';
}

export interface RawOrder {
  order_id: string;
  order_date: string;
  account_id: string;
  account_name: string;
  account_type: AccountType;
  product_line: ProductLine;
  sku: string;
  order_category: OrderCategory;
  units: number;
  revenue: number;
  channel: Channel;
  lead_source: LeadSource;
  first_touch_date: string;
  last_touch_date: string | null;
  org_territory: OrgTerritory;
}

export interface RawMarketingSpend {
  fiscal_quarter: string;
  lead_source: LeadSource;
  program_spend: number;
  campaign_notes: string;
}

// Deterministic seeded PRNG (Mulberry32)
function createRng(seed: number) {
  let a = seed >>> 0;
  return function rand(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)];
}

function weightedPick<T>(
  rng: () => number,
  items: readonly { value: T; weight: number }[]
): T {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let r = rng() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item.value;
  }
  return items[items.length - 1].value;
}

function toIsoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function addDays(dateMs: number, days: number): number {
  return dateMs + days * 86400000;
}

const PREFIXES: Record<AccountType, string[]> = {
  Biopharma: [
    'Kestrel', 'Vanguard', 'Meridian', 'Solstice', 'Aurelia', 'Helios', 'Catalyst',
    'Strata', 'Boreal', 'Veridian', 'Sovereign', 'Calyx', 'Halcyon', 'Pinnacle',
    'Lyra', 'Arden', 'Corvus', 'Novus', 'Alba', 'Tectonic', 'Cairn', 'Vesper',
    'Monarch', 'Zephyr', 'Beacon', 'Aegis', 'Clarion', 'Sable', 'Orchid', 'Summit',
    'Polaris', 'Verve', 'Trellis', 'Prism', 'Astraea', 'Radian', 'Lumen', 'Camber'
  ],
  CDMO: [
    'Nordic', 'Pacific', 'Rhine', 'Alpine', 'Atlantic', 'Keystone', 'Bridgewater',
    'Foundry', 'Matrix', 'ScaleBio', 'BioCraft', 'ProcessOne', 'CleanRoom',
    'VectorForge', 'SterileWorks', 'GMP Core', 'Axis', 'Harbor', 'Basalt', 'Forge'
  ],
  CRO: [
    'Precision', 'Translational', 'AssayWorks', 'PreClin', 'BioMetric', 'Quantis',
    'Pathway', 'ClearView', 'Insight', 'Accelera', 'Evident', 'Cohort', 'BenchMark',
    'Sentinel', 'Proba', 'Veritas', 'Nexus', 'Kinetic', 'TrialBridge', 'Signal'
  ],
  Academic: [
    'Broadview', 'Cambridge', 'Zurich', 'Stanford', 'Heidelberg', 'Uppsala',
    'Johns Hopkins', 'Karolinska', 'McGill', 'Kyoto', 'Oxford', 'Basel',
    'UCSF', 'Max Planck', 'ETH', 'Boston', 'Toronto', 'Melbourne', 'Imperial',
    'Leiden', 'Munich', 'Cornell', 'Duke', 'Emory', 'Michigan', 'Vanderbilt'
  ],
  'Clinical Lab': [
    'Helix', 'Questline', 'MetroDx', 'LabPoint', 'GenPath', 'ClarityDx',
    'NorthStar', 'BayArea', 'Redwood', 'Heartland', 'Cascade', 'TriState',
    'CoreDx', 'MedScreen', 'VanguardDx', 'Regional', 'Central', 'Alliance',
    'BeaconDx', 'PacificDx', 'Midwest', 'Atlas'
  ],
  OEM: [
    'AetherMed', 'OptiFluidics', 'MicroArray', 'SensorCore', 'CartridgeTek',
    'BioInstrument', 'SpectraFlow', 'ThermoLogic', 'CryoSys', 'LaserPrep',
    'NanoValve', 'DiaTech', 'PointCare', 'OmniTest', 'FluidMatrix'
  ],
};

const SUFFIXES: Record<AccountType, string[]> = {
  Biopharma: ['Biologics', 'Therapeutics', 'Biosciences', 'Pharma', 'Oncology', 'Genomics'],
  CDMO: ['Biomanufacturing', 'CDMO', 'BioProcess', 'Contract Labs', 'Cell & Gene'],
  CRO: ['CRO', 'Research Services', 'Preclinical Labs', 'BioAnalytics', 'Assay Partners'],
  Academic: ['Genome Institute', 'Medical Center', 'Cancer Research Lab', 'Bioengineering Dept', 'School of Medicine'],
  'Clinical Lab': ['Diagnostics', 'Clinical Labs', 'Molecular Pathology', 'Reference Lab', 'Genomic Testing'],
  OEM: ['Systems', 'OEM Instruments', 'Point-of-Care', 'Diagnostic Devices', 'Automation'],
};

interface SkuSpec {
  sku: string;
  productLine: ProductLine;
  category: OrderCategory;
  unitPrice: number;
  minUnits: number;
  maxUnits: number;
}

const SKU_CATALOG: SkuSpec[] = [
  // qPCR & dPCR Reagents
  { sku: 'PCR-MMX-500', productLine: 'qPCR & dPCR Reagents', category: 'Catalog', unitPrice: 480, minUnits: 4, maxUnits: 28 },
  { sku: 'PCR-PRB-100', productLine: 'qPCR & dPCR Reagents', category: 'Catalog', unitPrice: 320, minUnits: 5, maxUnits: 35 },
  { sku: 'DPCR-CHIP-96', productLine: 'qPCR & dPCR Reagents', category: 'Catalog', unitPrice: 950, minUnits: 2, maxUnits: 16 },
  { sku: 'PCR-CUST-ASSAY', productLine: 'qPCR & dPCR Reagents', category: 'Custom', unitPrice: 4200, minUnits: 2, maxUnits: 10 },
  { sku: 'PCR-CUST-PANEL', productLine: 'qPCR & dPCR Reagents', category: 'Custom', unitPrice: 6800, minUnits: 1, maxUnits: 8 },

  // NGS Library Prep
  { sku: 'NGS-LIB-96', productLine: 'NGS Library Prep', category: 'Catalog', unitPrice: 1850, minUnits: 2, maxUnits: 14 },
  { sku: 'NGS-ADAPT-48', productLine: 'NGS Library Prep', category: 'Catalog', unitPrice: 690, minUnits: 3, maxUnits: 20 },
  { sku: 'NGS-BEAD-250', productLine: 'NGS Library Prep', category: 'Catalog', unitPrice: 1120, minUnits: 2, maxUnits: 15 },
  { sku: 'NGS-CUST-HYB', productLine: 'NGS Library Prep', category: 'Custom', unitPrice: 7400, minUnits: 1, maxUnits: 7 },
  { sku: 'NGS-CUST-UMI', productLine: 'NGS Library Prep', category: 'Custom', unitPrice: 9200, minUnits: 1, maxUnits: 6 },

  // Cell Culture Media
  { sku: 'CCM-SFM-10L', productLine: 'Cell Culture Media', category: 'Catalog', unitPrice: 740, minUnits: 4, maxUnits: 30 },
  { sku: 'CCM-FEED-5L', productLine: 'Cell Culture Media', category: 'Catalog', unitPrice: 610, minUnits: 4, maxUnits: 26 },
  { sku: 'CCM-SUPP-1L', productLine: 'Cell Culture Media', category: 'Catalog', unitPrice: 290, minUnits: 6, maxUnits: 40 },
  { sku: 'CCM-CUST-200L', productLine: 'Cell Culture Media', category: 'Custom', unitPrice: 11800, minUnits: 1, maxUnits: 6 },
  { sku: 'CCM-CUST-FORM', productLine: 'Cell Culture Media', category: 'Custom', unitPrice: 14500, minUnits: 1, maxUnits: 5 },

  // Chromatography Resins
  { sku: 'CHR-PROT-A5', productLine: 'Chromatography Resins', category: 'Catalog', unitPrice: 3600, minUnits: 1, maxUnits: 10 },
  { sku: 'CHR-IEX-10', productLine: 'Chromatography Resins', category: 'Catalog', unitPrice: 2150, minUnits: 2, maxUnits: 12 },
  { sku: 'CHR-SEC-25', productLine: 'Chromatography Resins', category: 'Catalog', unitPrice: 1650, minUnits: 2, maxUnits: 14 },
  { sku: 'CHR-CUST-PACK', productLine: 'Chromatography Resins', category: 'Custom', unitPrice: 18500, minUnits: 1, maxUnits: 4 },
  { sku: 'CHR-CUST-LIG', productLine: 'Chromatography Resins', category: 'Custom', unitPrice: 24000, minUnits: 1, maxUnits: 3 },

  // Automated Liquid Handling
  { sku: 'ALH-TIPS-384', productLine: 'Automated Liquid Handling', category: 'Catalog', unitPrice: 410, minUnits: 8, maxUnits: 50 },
  { sku: 'ALH-DECK-96', productLine: 'Automated Liquid Handling', category: 'Catalog', unitPrice: 1280, minUnits: 2, maxUnits: 14 },
  { sku: 'ALH-CORE-8CH', productLine: 'Automated Liquid Handling', category: 'Catalog', unitPrice: 12500, minUnits: 1, maxUnits: 3 },
  { sku: 'ALH-CUST-CELL', productLine: 'Automated Liquid Handling', category: 'Custom', unitPrice: 32000, minUnits: 1, maxUnits: 2 },
  { sku: 'ALH-CUST-OEM', productLine: 'Automated Liquid Handling', category: 'Custom', unitPrice: 26500, minUnits: 1, maxUnits: 3 },

  // Diagnostic Assay Kits
  { sku: 'DXK-ELISA-96', productLine: 'Diagnostic Assay Kits', category: 'Catalog', unitPrice: 540, minUnits: 4, maxUnits: 28 },
  { sku: 'DXK-LFA-500', productLine: 'Diagnostic Assay Kits', category: 'Catalog', unitPrice: 1420, minUnits: 2, maxUnits: 18 },
  { sku: 'DXK-CTRL-STD', productLine: 'Diagnostic Assay Kits', category: 'Catalog', unitPrice: 380, minUnits: 5, maxUnits: 30 },
  { sku: 'DXK-CUST-IVD', productLine: 'Diagnostic Assay Kits', category: 'Custom', unitPrice: 15200, minUnits: 1, maxUnits: 5 },
  { sku: 'DXK-CUST-OEM', productLine: 'Diagnostic Assay Kits', category: 'Custom', unitPrice: 19800, minUnits: 1, maxUnits: 4 },
];

const QUARTERS = [
  { label: '2024-Q4', start: '2024-10-01', end: '2024-12-31', seasonalMult: 1.14 },
  { label: '2025-Q1', start: '2025-01-01', end: '2025-03-31', seasonalMult: 0.93 },
  { label: '2025-Q2', start: '2025-04-01', end: '2025-06-30', seasonalMult: 1.02 },
  { label: '2025-Q3', start: '2025-07-01', end: '2025-09-30', seasonalMult: 1.06 },
  { label: '2025-Q4', start: '2025-10-01', end: '2025-12-31', seasonalMult: 1.24 },
  { label: '2026-Q1', start: '2026-01-01', end: '2026-03-31', seasonalMult: 1.08 },
  { label: '2026-Q2', start: '2026-04-01', end: '2026-06-30', seasonalMult: 1.18 },
  { label: '2026-Q3', start: '2026-07-01', end: '2026-09-30', seasonalMult: 1.28 },
] as const;

export const WAREHOUSE_SNAPSHOT_DATE = '2026-10-01';

export function generateCommercialDataset(): {
  accounts: RawAccount[];
  orders: RawOrder[];
  marketingSpend: RawMarketingSpend[];
} {
  const rng = createRng(20261116);

  const segmentCounts: { type: AccountType; count: number }[] = [
    { type: 'Biopharma', count: 95 },
    { type: 'CDMO', count: 55 },
    { type: 'CRO', count: 60 },
    { type: 'Academic', count: 85 },
    { type: 'Clinical Lab', count: 65 },
    { type: 'OEM', count: 40 },
  ];

  const territoryWeights: { value: OrgTerritory; weight: number }[] = [
    { value: 'NA-East', weight: 32 },
    { value: 'NA-West', weight: 26 },
    { value: 'EU-North', weight: 16 },
    { value: 'EU-DACH', weight: 14 },
    { value: 'APAC', weight: 12 },
  ];

  const firstTouchWeights: { value: LeadSource; weight: number }[] = [
    { value: 'Trade Conference', weight: 26 },
    { value: 'Technical Whitepaper', weight: 22 },
    { value: 'Organic Search', weight: 18 },
    { value: 'Scientific Webinar', weight: 14 },
    { value: 'Partner Referral', weight: 8 },
    { value: 'Outbound SDR', weight: 6 },
    { value: 'Paid Search', weight: 4 },
    { value: 'Email Nurture', weight: 2 },
  ];

  const lastTouchWeights: { value: LeadSource; weight: number }[] = [
    { value: 'Paid Search', weight: 22 },
    { value: 'Email Nurture', weight: 21 },
    { value: 'Scientific Webinar', weight: 18 },
    { value: 'Outbound SDR', weight: 14 },
    { value: 'Organic Search', weight: 10 },
    { value: 'Partner Referral', weight: 7 },
    { value: 'Technical Whitepaper', weight: 5 },
    { value: 'Trade Conference', weight: 3 },
  ];

  const usedNames = new Set<string>();
  const accounts: RawAccount[] = [];
  let accIdx = 1;

  for (const seg of segmentCounts) {
    for (let i = 0; i < seg.count; i++) {
      let name = '';
      let attempt = 0;
      while (!name || usedNames.has(name)) {
        const pre = pick(rng, PREFIXES[seg.type]);
        const suf = pick(rng, SUFFIXES[seg.type]);
        name = attempt > 6 ? `${pre} ${suf} ${attempt}` : `${pre} ${suf}`;
        attempt++;
      }
      usedNames.add(name);

      const territory = weightedPick(rng, territoryWeights);
      // First touch occurs between 2024-04-01 and 2026-04-15
      const firstTouchWindowStart = Date.parse('2024-04-01T00:00:00Z');
      const firstTouchWindowDays = Math.floor(rng() * 740);
      const first_touch_date = toIsoDate(addDays(firstTouchWindowStart, firstTouchWindowDays));
      const first_touch_source = weightedPick(rng, firstTouchWeights);

      const bRoll = rng();
      const cohort_behavior: RawAccount['cohort_behavior'] =
        bRoll < 0.18 ? 'quiet' : bRoll < 0.40 ? 'under_buying' : 'healthy';

      accounts.push({
        account_id: `ACC-${String(accIdx).padStart(3, '0')}`,
        account_name: name,
        account_type: seg.type,
        org_territory: territory,
        first_touch_date,
        first_touch_source,
        cohort_behavior,
      });
      accIdx++;
    }
  }

  const productBiasByType: Record<AccountType, ProductLine[]> = {
    Biopharma: ['Chromatography Resins', 'Cell Culture Media', 'NGS Library Prep', 'qPCR & dPCR Reagents'],
    CDMO: ['Cell Culture Media', 'Chromatography Resins', 'Automated Liquid Handling'],
    CRO: ['NGS Library Prep', 'qPCR & dPCR Reagents', 'Automated Liquid Handling'],
    Academic: ['qPCR & dPCR Reagents', 'NGS Library Prep', 'Cell Culture Media'],
    'Clinical Lab': ['Diagnostic Assay Kits', 'qPCR & dPCR Reagents', 'Automated Liquid Handling'],
    OEM: ['Diagnostic Assay Kits', 'Automated Liquid Handling', 'qPCR & dPCR Reagents'],
  };

  const channelWeightsByType: Record<AccountType, { value: Channel; weight: number }[]> = {
    Biopharma: [
      { value: 'Field Sales', weight: 46 },
      { value: 'Inside Sales', weight: 24 },
      { value: 'E-Commerce Portal', weight: 22 },
      { value: 'Distributor Partner', weight: 8 },
    ],
    CDMO: [
      { value: 'Field Sales', weight: 52 },
      { value: 'Inside Sales', weight: 20 },
      { value: 'E-Commerce Portal', weight: 16 },
      { value: 'OEM Direct', weight: 12 },
    ],
    CRO: [
      { value: 'Inside Sales', weight: 38 },
      { value: 'E-Commerce Portal', weight: 32 },
      { value: 'Field Sales', weight: 22 },
      { value: 'Distributor Partner', weight: 8 },
    ],
    Academic: [
      { value: 'E-Commerce Portal', weight: 54 },
      { value: 'Inside Sales', weight: 26 },
      { value: 'Distributor Partner', weight: 14 },
      { value: 'Field Sales', weight: 6 },
    ],
    'Clinical Lab': [
      { value: 'Inside Sales', weight: 34 },
      { value: 'Field Sales', weight: 30 },
      { value: 'E-Commerce Portal', weight: 20 },
      { value: 'Distributor Partner', weight: 16 },
    ],
    OEM: [
      { value: 'OEM Direct', weight: 58 },
      { value: 'Field Sales', weight: 32 },
      { value: 'Inside Sales', weight: 10 },
    ],
  };

  const customProbability: Record<AccountType, number> = {
    Biopharma: 0.36,
    CDMO: 0.44,
    CRO: 0.24,
    Academic: 0.12,
    'Clinical Lab': 0.22,
    OEM: 0.56,
  };

  const orders: RawOrder[] = [];
  const windowStartMs = Date.parse('2024-10-01T00:00:00Z');
  const windowEndMs = Date.parse('2026-09-30T00:00:00Z');

  let orderCounter = 10001;

  // Target ~3,000 orders total across 400 accounts (~7.5 orders per account over 24 months)
  for (const account of accounts) {
    const firstTouchMs = Date.parse(`${account.first_touch_date}T00:00:00Z`);
    const earliestOrderMs = Math.max(windowStartMs, addDays(firstTouchMs, 7 + Math.floor(rng() * 35)));

    let targetOrderCount: number;
    let maxOrderMs = windowEndMs;

    if (account.cohort_behavior === 'healthy') {
      targetOrderCount = 6 + Math.floor(rng() * 7); // 6 to 12 orders
    } else if (account.cohort_behavior === 'under_buying') {
      targetOrderCount = 4 + Math.floor(rng() * 4); // 4 to 7 orders, mostly smaller catalog
    } else {
      // Quiet accounts stopped ordering 95 to 260 days before 2026-10-01
      targetOrderCount = 3 + Math.floor(rng() * 5);
      const silentDays = 95 + Math.floor(rng() * 165);
      maxOrderMs = Math.min(windowEndMs, addDays(windowEndMs, -silentDays));
    }

    if (earliestOrderMs >= maxOrderMs) {
      // Ensure every account has at least 2 valid orders in window
      const safeStart = windowStartMs;
      const safeEnd = account.cohort_behavior === 'quiet' ? addDays(windowEndMs, -120) : windowEndMs;
      for (let k = 0; k < 2; k++) {
        const orderMs = safeStart + Math.floor(rng() * (safeEnd - safeStart));
        orders.push(buildOrder(orderCounter++, orderMs, account, false));
      }
      continue;
    }

    // Generate sorted timestamps across the account's active window
    const timestamps: number[] = [];
    for (let k = 0; k < targetOrderCount; k++) {
      // Bias healthy accounts slightly toward recent quarters to create realistic growth
      const u = account.cohort_behavior === 'healthy' ? Math.pow(rng(), 0.86) : rng();
      const ts = earliestOrderMs + Math.floor(u * (maxOrderMs - earliestOrderMs));
      timestamps.push(ts);
    }
    timestamps.sort((a, b) => a - b);

    // Guarantee healthy & under_buying accounts have recent activity within last 75 days so quiet cohort stays distinct
    if (account.cohort_behavior !== 'quiet' && timestamps.length > 0) {
      const lastTs = timestamps[timestamps.length - 1];
      const daysSince = Math.round((windowEndMs - lastTs) / 86400000);
      if (daysSince > 68) {
        timestamps[timestamps.length - 1] = addDays(windowEndMs, -(4 + Math.floor(rng() * 55)));
        timestamps.sort((a, b) => a - b);
      }
    }

    for (let idx = 0; idx < timestamps.length; idx++) {
      const orderMs = timestamps[idx];
      const isRecentHalf = orderMs > Date.parse('2026-01-01T00:00:00Z');
      const suppressSpend = account.cohort_behavior === 'under_buying' && isRecentHalf;
      orders.push(buildOrder(orderCounter++, orderMs, account, suppressSpend));
    }
  }

  function buildOrder(
    seqId: number,
    orderMs: number,
    account: RawAccount,
    suppressSpend: boolean
  ): RawOrder {
    const order_date = toIsoDate(orderMs);
    const preferredLines = productBiasByType[account.account_type];
    const productLine: ProductLine =
      rng() < 0.78
        ? pick(rng, preferredLines)
        : pick(rng, [
            'qPCR & dPCR Reagents',
            'NGS Library Prep',
            'Cell Culture Media',
            'Chromatography Resins',
            'Automated Liquid Handling',
            'Diagnostic Assay Kits',
          ]);

    const wantCustom = suppressSpend
      ? false
      : rng() < customProbability[account.account_type];

    const matchingSkus = SKU_CATALOG.filter(
      (s) => s.productLine === productLine && s.category === (wantCustom ? 'Custom' : 'Catalog')
    );
    const skuSpec = pick(rng, matchingSkus);

    const rawUnits =
      skuSpec.minUnits +
      Math.floor(rng() * (skuSpec.maxUnits - skuSpec.minUnits + 1));
    const units = suppressSpend ? Math.max(1, Math.round(rawUnits * 0.42)) : rawUnits;

    // Slight realistic discount/contract variance (+/- 12%)
    const priceJitter = 0.88 + rng() * 0.24;
    const scaleFactor =
      account.account_type === 'Biopharma' || account.account_type === 'CDMO'
        ? 1.18
        : account.account_type === 'Academic'
        ? 0.78
        : 1.0;

    const quarterInfo = QUARTERS.find(
      (q) => order_date >= q.start && order_date <= q.end
    );
    const seasonal = quarterInfo ? quarterInfo.seasonalMult : 1.0;
    const revMultiplier = suppressSpend ? 0.55 : scaleFactor * (0.9 + seasonal * 0.1);
    const revenue = Math.round(units * skuSpec.unitPrice * priceJitter * revMultiplier);

    const channel = weightedPick(rng, channelWeightsByType[account.account_type]);
    const lead_source = weightedPick(rng, lastTouchWeights);

    // Ensure first_touch_date <= order_date
    const acctFirstTouchMs = Date.parse(`${account.first_touch_date}T00:00:00Z`);
    const safeFirstTouchMs = Math.min(acctFirstTouchMs, addDays(orderMs, -14));

    // ~83% of orders have a recent marketing touch within 4–85 days; ~17% are uninfluenced direct/contract reorders
    const hasRecentTouch = rng() < 0.83;
    let last_touch_date: string | null = null;
    if (hasRecentTouch) {
      const lagDays = 4 + Math.floor(rng() * 78);
      const touchMs = Math.max(safeFirstTouchMs, addDays(orderMs, -lagDays));
      last_touch_date = toIsoDate(touchMs);
    }

    return {
      order_id: `ORD-${seqId}`,
      order_date,
      account_id: account.account_id,
      account_name: account.account_name,
      account_type: account.account_type,
      product_line: skuSpec.productLine,
      sku: skuSpec.sku,
      order_category: skuSpec.category,
      units,
      revenue,
      channel,
      lead_source,
      first_touch_date: toIsoDate(safeFirstTouchMs),
      last_touch_date,
      org_territory: account.org_territory,
    };
  }

  // Sort orders chronologically and re-number cleanly
  orders.sort((a, b) => a.order_date.localeCompare(b.order_date));
  orders.forEach((o, i) => {
    o.order_id = `ORD-${10001 + i}`;
  });

  // Program spend per lead_source per quarter (realistic commercial marketing budget)
  const baseQuarterlySpend: Record<LeadSource, { base: number; note: string }> = {
    'Trade Conference': { base: 145000, note: 'AACR, ASGCT, SLAS booth & technical symposia' },
    'Paid Search': { base: 92000, note: 'High-intent SKU & protocol SEM campaigns' },
    'Technical Whitepaper': { base: 54000, note: 'Application notes & assay validation guides' },
    'Scientific Webinar': { base: 48000, note: 'Co-hosted KOL workflow demonstrations' },
    'Outbound SDR': { base: 86000, note: 'Targeted biopharma & CDMO account sequences' },
    'Email Nurture': { base: 28000, note: 'Automated lifecycle & reorder triggers' },
    'Organic Search': { base: 34000, note: 'Technical SEO & protocol library maintenance' },
    'Partner Referral': { base: 31000, note: 'Co-marketing MDF with regional distributors' },
  };

  const marketingSpend: RawMarketingSpend[] = [];
  for (let qIdx = 0; qIdx < QUARTERS.length; qIdx++) {
    const q = QUARTERS[qIdx];
    const growth = 1 + qIdx * 0.035;
    for (const [source, cfg] of Object.entries(baseQuarterlySpend) as [
      LeadSource,
      { base: number; note: string }
    ][]) {
      const jitter = 0.92 + rng() * 0.16;
      const confBoost = source === 'Trade Conference' && q.label.endsWith('Q2') ? 1.25 : 1.0;
      marketingSpend.push({
        fiscal_quarter: q.label,
        lead_source: source,
        program_spend: Math.round((cfg.base * growth * jitter * confBoost) / 100) * 100,
        campaign_notes: cfg.note,
      });
    }
  }

  return { accounts, orders, marketingSpend };
}

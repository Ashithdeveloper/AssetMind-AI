/**
 * AssetMind AI — Geopolitical & War Conflict Risk Engine
 * Analyzes active and emerging global war conflicts and calculates company-specific exposure,
 * supply chain vulnerability, crude/freight sensitivity, and strategic investor implications.
 */

export interface WarConflictImpact {
  conflictType: string;
  conflictStatus: string;
  impactSeverity: 'Critical Negative' | 'High Negative' | 'Moderate Negative' | 'Neutral / Insulated' | 'Net Beneficiary';
  exposureChannels: string[];
  directEffect: string;
  warRiskScorePercent: number;
  strategicImplication: string;
}

export class GeopoliticalRiskEngine {
  /**
   * Evaluates active war and geopolitical conflict exposure for a company
   */
  public static evaluateWarImpact(
    symbol: string,
    sector?: string,
    industry?: string,
    companyName?: string
  ): WarConflictImpact {
    const sym = symbol.toUpperCase().replace(/\.NS$|\.BO$/i, '');
    const sec = (sector || '').toLowerCase();
    const ind = (industry || '').toLowerCase();
    const name = (companyName || '').toLowerCase();

    // 1. Shipping, Ports, Logistics, Maritime
    if (
      sym === 'ADANIPORTS' ||
      sym === 'CONCOR' ||
      sym === 'SCI' ||
      sym === 'GESHIP' ||
      sec.includes('port') ||
      sec.includes('logistics') ||
      ind.includes('shipping') ||
      ind.includes('marine')
    ) {
      return {
        conflictType: 'Middle East & Red Sea Maritime Conflict',
        conflictStatus: 'Active & Escalating (Houthi attacks & Suez diversion to Cape of Good Hope)',
        impactSeverity: 'Moderate Negative',
        exposureChannels: [
          'Red Sea & Suez Canal shipping route disruption',
          'Vessel rerouting via Cape of Good Hope (10-14 days extra transit)',
          'Global container freight rate spikes',
          'Surge in marine war-risk insurance premiums',
        ],
        directEffect:
          'Commercial shipping detours around the African continent add transit latency and escalate bunker fuel costs. While international transshipment volumes face route friction, domestic non-Europe trade corridors (Gulf, East Asia) remain stable.',
        warRiskScorePercent: 58,
        strategicImplication:
          'Watch container throughput and demurrage recovery in quarterly numbers. Dips caused by short-term maritime crisis offer entry for dominant port infrastructure assets with long-term concession agreements.',
      };
    }

    // 2. Oil, Gas, Energy, Refining, Petrochemicals
    if (
      sym === 'RELIANCE' ||
      sym === 'ONGC' ||
      sym === 'OIL' ||
      sym === 'BPCL' ||
      sym === 'IOC' ||
      sym === 'HPCL' ||
      sym === 'GAIL' ||
      sec.includes('energy') ||
      sec.includes('oil') ||
      ind.includes('petroleum') ||
      ind.includes('refining')
    ) {
      const isUpstream = sym === 'ONGC' || sym === 'OIL';
      const isComplexRefiner = sym === 'RELIANCE';

      return {
        conflictType: 'Middle East & Russia-Ukraine Energy Conflict',
        conflictStatus: 'Active & Volatile (Strait of Hormuz tension & Russian Urals crude price caps)',
        impactSeverity: isUpstream ? 'Net Beneficiary' : isComplexRefiner ? 'Neutral / Insulated' : 'High Negative',
        exposureChannels: [
          'Brent crude benchmark price volatility ($80-$100/bbl sensitivity)',
          'Access to discounted Russian heavy crude feedstock',
          'Gross Refining Margins (GRM) crack spread swings (diesel/gasoil/jet fuel)',
          'Strait of Hormuz tanker passage safety',
        ],
        directEffect: isUpstream
          ? 'Geopolitical tensions and OPEC+ supply constraints drive realized crude prices higher, directly boosting upstream EBITDA and cash flow generation.'
          : isComplexRefiner
          ? 'Complex refining configuration allows flexibility to process discounted sanctioned crudes and capture elevated international distillate crack spreads, partially offset by domestic retail fuel margin controls.'
          : 'High procurement crude costs erode marketing margins if retail petrol and diesel pump prices cannot be freely increased domestically.',
        warRiskScorePercent: isUpstream ? 22 : isComplexRefiner ? 42 : 72,
        strategicImplication: isUpstream
          ? 'Beneficiary of geopolitical risk premium. Use energy rallies to lock in trading profits near peak Brent cycles.'
          : 'Monitor diesel crack spreads and petchem demand. Upstream gains balance retail fuel margin pressure during crude escalations.',
      };
    }

    // 3. Defence, Aerospace, Shipyards
    if (
      sym === 'HAL' ||
      sym === 'BEL' ||
      sym === 'MAZDOCK' ||
      sym === 'COCHINSHIP' ||
      sym === 'BDL' ||
      sym === 'DATAPATTNS' ||
      sec.includes('defence') ||
      sec.includes('aerospace') ||
      ind.includes('defence')
    ) {
      return {
        conflictType: 'Global Re-Armament & Regional Border Deterrence',
        conflictStatus: 'Active Structural Catalyst (Indo-Pacific & Eastern Europe re-armament)',
        impactSeverity: 'Net Beneficiary',
        exposureChannels: [
          'Indian Ministry of Defence (MoD) indigenization mandate ("Make in India")',
          'Fast-tracked capital acquisition budgets for electronic warfare, fighters & naval ships',
          'Rising defence equipment export opportunities to friendly sovereign nations',
          'Order book visibility expanding to 5-8 years of trailing revenue',
        ],
        directEffect:
          'Escalating regional and global conflicts reinforce state defence spending. Domestic defence champions receive multi-billion dollar domestic contracts for radar, missiles, avionics, and naval vessels with high sovereign contract security.',
        warRiskScorePercent: 12,
        strategicImplication:
          'Structural secular winner in periods of geopolitical conflict. Valuations may stretch, so accumulate on broader market panic selloffs.',
      };
    }

    // 4. Paints, Tyres, Aviation, Chemicals (High Crude Derivative Exposure)
    if (
      sym === 'ASIANPAINT' ||
      sym === 'BERGEPAINT' ||
      sym === 'INDIGO' ||
      sym === 'APOLLOTYRE' ||
      sym === 'MRF' ||
      sym === 'PIDILITIND' ||
      sym === 'SRF' ||
      ind.includes('paints') ||
      ind.includes('aviation') ||
      ind.includes('airline') ||
      ind.includes('tyres')
    ) {
      return {
        conflictType: 'Middle East Energy & Petrochemical Input Cost Shock',
        conflictStatus: 'Active Vulnerability (Crude derivative and aviation turbine fuel inflation)',
        impactSeverity: 'High Negative',
        exposureChannels: [
          'Direct sensitivity to crude derivatives (titanium dioxide, solvents, monomers, carbon black, ATF)',
          'Gross margin compression when Brent exceeds $85/bbl',
          'Consumer price resistance limiting immediate cost pass-through',
          'Working capital stretch due to inventory revaluation',
        ],
        directEffect:
          'Raw materials constitute 50-60% of manufacturing costs for paints/tyres, while aviation turbine fuel comprises ~40% of airline operating costs. Crude spikes directly erode EBITDA margins unless price hikes are quickly absorbed by retail consumers.',
        warRiskScorePercent: 68,
        strategicImplication:
          'Exercise caution or consider trimming positions during acute Middle East escalations until crude benchmarks stabilize below $80/bbl.',
      };
    }

    // 5. IT Services & Technology
    if (
      sym === 'TCS' ||
      sym === 'INFY' ||
      sym === 'WIPRO' ||
      sym === 'HCLTECH' ||
      sym === 'LTIM' ||
      sym === 'TECHM' ||
      sec.includes('technology') ||
      sec.includes('information technology') ||
      ind.includes('software') ||
      ind.includes('it services')
    ) {
      return {
        conflictType: 'European & Western Geopolitical Uncertainty / Spending Freeze',
        conflictStatus: 'Ongoing Macro Friction (Protracted Russia-Ukraine conflict & budget delays)',
        impactSeverity: 'Moderate Negative',
        exposureChannels: [
          'Western banking and enterprise discretionary tech budget caution',
          'European client decision-making slowdown for major digital transformations',
          'Cross-currency volatility (EUR, GBP, USD versus INR)',
        ],
        directEffect:
          'Prolonged conflict in Eastern Europe and the Middle East creates corporate uncertainty among Western Fortune 500 clients, causing elongation of sales cycles and reprioritization toward vendor consolidation and cost-takeout deals.',
        warRiskScorePercent: 38,
        strategicImplication:
          'Defensive balance sheets, zero debt, and high Free Cash Flow (FCF) provide strong valuation floors. Geopolitical dips offer resilient dollar-earning dividend yields.',
      };
    }

    // 6. Automotive & Manufacturing
    if (
      sym === 'TATAMOTORS' ||
      sym === 'MARUTI' ||
      sym === 'M&M' ||
      sym === 'BAJAJ-AUTO' ||
      sym === 'EICHERMOT' ||
      sym === 'BHARATFORG' ||
      sec.includes('automobile') ||
      sec.includes('auto') ||
      ind.includes('automotive')
    ) {
      const hasOverseasUnit = sym === 'TATAMOTORS' || sym === 'BHARATFORG';
      return {
        conflictType: 'Global Supply Chain & Critical Component Route Disruption',
        conflictStatus: 'Moderate to High Risk (Red Sea freight delays & European auto demand drag)',
        impactSeverity: hasOverseasUnit ? 'Moderate Negative' : 'Neutral / Insulated',
        exposureChannels: [
          'International subsidiary logistics (e.g. JLR UK/Europe parts transit delays)',
          'Ocean freight shipping cost increases on export vehicles and CKD kits',
          'Raw material inflation (steel, aluminum, semiconductor logistics)',
        ],
        directEffect: hasOverseasUnit
          ? 'Container rerouting around Africa delays component deliveries to European assembly lines and raises export shipping costs, partially buffered by strong domestic passenger & commercial vehicle demand.'
          : 'High domestic market concentration shields operations from direct international shipping choke points, though input steel/aluminum prices warrant monitoring.',
        warRiskScorePercent: hasOverseasUnit ? 52 : 36,
        strategicImplication:
          'Watch quarterly European revenue share and logistics line items. Core Indian demographic consumption remains the key anchor.',
      };
    }

    // 7. Banking & Financial Services
    if (
      sym === 'HDFCBANK' ||
      sym === 'ICICIBANK' ||
      sym === 'SBIN' ||
      sym === 'KOTAKBANK' ||
      sym === 'AXISBANK' ||
      sec.includes('financial') ||
      sec.includes('bank')
    ) {
      return {
        conflictType: 'Global Inflation Transmission & Central Bank Rate Spillover',
        conflictStatus: 'Moderate Indirect Risk (Sticky imported inflation & FII portfolio flows)',
        impactSeverity: 'Neutral / Insulated',
        exposureChannels: [
          'Imported oil inflation forcing RBI to hold repo rates higher for longer',
          'Foreign Institutional Investor (FII) risk-off outflows during geopolitical flight to safety',
          'Treasury bond portfolio mark-to-market yields',
        ],
        directEffect:
          'Indian banking operations are predominantly domestic, driven by robust 14-16% domestic credit growth and low direct exposure to conflict-zone assets. Main risk is macro: FII equity sales during global panic and delayed interest rate cuts.',
        warRiskScorePercent: 26,
        strategicImplication:
          'Excellent domestic structural resilience. Geopolitical market panics that trigger foreign institutional selling create attractive entry points for large-cap private and public banks.',
      };
    }

    // Default Domestic Indian Equity
    return {
      conflictType: 'Global Macro & Imported Energy Inflation Transmission',
      conflictStatus: 'Active Global Monitoring (Crude oil, dollar strength, supply routes)',
      impactSeverity: 'Neutral / Insulated',
      exposureChannels: [
        'INR currency depreciation against US Dollar during global risk-off',
        'Secondary imported fuel and packaging input cost inflation',
        'FII liquidity volatility in emerging market equities',
      ],
      directEffect:
        'Company generates the vast majority of its revenue within the domestic Indian economy, heavily insulating core commercial operations from direct cross-border war disruption.',
      warRiskScorePercent: 30,
      strategicImplication:
        'Domestic consumer and capital expenditure drivers outweigh international conflict risk. Monitor crude inflation as the primary indirect transmission channel.',
    };
  }
}

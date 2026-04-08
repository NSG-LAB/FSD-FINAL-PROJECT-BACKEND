const CITY_MULTIPLIERS = {
  mumbai: 1.35,
  bengaluru: 1.2,
  bangalore: 1.2,
  delhi: 1.25,
  chennai: 1.1,
  hyderabad: 1.08,
  pune: 1.12,
  kolkata: 0.98,
  ahmedabad: 0.95,
  jaipur: 0.9,
  lucknow: 0.88,
  kochi: 1.0,
  default: 1.0
};

const AREA_TYPE_MULTIPLIERS = {
  metro: 1.15,
  urban: 1.0,
  suburban: 0.92,
  rural: 0.82
};

const CATEGORY_BASE_RANGES = {
  'kitchen-bathroom': { min: 180000, max: 600000 },
  flooring: { min: 90000, max: 350000 },
  'wall-paint': { min: 35000, max: 150000 },
  'lighting-fixtures': { min: 25000, max: 180000 },
  'garden-outdoor': { min: 50000, max: 300000 },
  'safety-security': { min: 20000, max: 140000 },
  'energy-efficiency': { min: 60000, max: 450000 },
  'interior-design': { min: 100000, max: 500000 },
  'electrical-plumbing': { min: 80000, max: 320000 },
  general: { min: 70000, max: 250000 }
};

const normalizeKey = (value = '') => String(value || '').trim().toLowerCase();

const safeNum = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const round = (value) => Math.round(safeNum(value));

const ageMultiplier = (propertyAgeYears) => {
  const age = safeNum(propertyAgeYears);
  if (age >= 25) return 1.22;
  if (age >= 15) return 1.12;
  if (age >= 8) return 1.05;
  return 1;
};

const estimateCostByLocation = ({
  city,
  areaType = 'urban',
  category = 'general',
  propertyAgeYears = 0,
  budget = 0
}) => {
  const cityKey = normalizeKey(city);
  const categoryKey = normalizeKey(category);
  const areaTypeKey = normalizeKey(areaType);

  const cityMultiplier = CITY_MULTIPLIERS[cityKey] || CITY_MULTIPLIERS.default;
  const areaMultiplier = AREA_TYPE_MULTIPLIERS[areaTypeKey] || AREA_TYPE_MULTIPLIERS.urban;
  const selectedRange = CATEGORY_BASE_RANGES[categoryKey] || CATEGORY_BASE_RANGES.general;
  const ageAdj = ageMultiplier(propertyAgeYears);

  const minEstimate = round(selectedRange.min * cityMultiplier * areaMultiplier * ageAdj);
  const maxEstimate = round(selectedRange.max * cityMultiplier * areaMultiplier * ageAdj);
  const midEstimate = round((minEstimate + maxEstimate) / 2);

  const normalizedBudget = safeNum(budget);
  let affordability = 'unknown';

  if (normalizedBudget > 0) {
    if (normalizedBudget >= maxEstimate) {
      affordability = 'comfortable';
    } else if (normalizedBudget >= minEstimate) {
      affordability = 'borderline';
    } else {
      affordability = 'insufficient';
    }
  }

  return {
    city: city || 'default',
    areaType: areaTypeKey,
    category: categoryKey,
    costRange: {
      min: minEstimate,
      max: maxEstimate,
      mid: midEstimate
    },
    multipliers: {
      city: Number(cityMultiplier.toFixed(2)),
      areaType: Number(areaMultiplier.toFixed(2)),
      propertyAge: Number(ageAdj.toFixed(2))
    },
    affordability,
    budget: normalizedBudget || null,
    assumptions: {
      baseRange: selectedRange,
      note: 'Estimates are directional and should be validated with contractor quotes.'
    }
  };
};

module.exports = {
  estimateCostByLocation
};

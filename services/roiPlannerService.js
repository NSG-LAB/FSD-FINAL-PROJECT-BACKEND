const CONDITION_MULTIPLIER = {
  excellent: 0.9,
  good: 1,
  average: 1.05,
  'needs-work': 1.1,
};

const DIFFICULTY_WEIGHT = {
  easy: 1,
  moderate: 0.92,
  difficult: 0.85,
};

const averageCost = (estimatedCost = {}) => {
  const min = Number(estimatedCost.min || 0);
  const max = Number(estimatedCost.max || 0);
  if (!min && !max) {
    return 0;
  }
  if (!min) {
    return max;
  }
  if (!max) {
    return min;
  }
  return Math.round((min + max) / 2);
};

const roiAmount = (cost, roiPercent) => {
  return Math.round(cost * (Number(roiPercent || 0) / 100));
};

const monthsFromTimeframe = (timeframe = '') => {
  if (!timeframe) {
    return 6;
  }

  const lower = timeframe.toLowerCase();
  const match = lower.match(/(\d+(?:\.\d+)?)\s*(day|week|month|year)/);

  if (!match) {
    return 6;
  }

  const value = Number(match[1]);
  const unit = match[2];

  if (unit.startsWith('day')) {
    return Math.max(1, value / 30);
  }
  if (unit.startsWith('week')) {
    return Math.max(1, value / 4);
  }
  if (unit.startsWith('month')) {
    return Math.max(1, value);
  }
  if (unit.startsWith('year')) {
    return Math.max(1, value * 12);
  }

  return 6;
};

const mapPlanItem = (recommendation, propertyCondition) => {
  const cost = averageCost(recommendation.estimatedCost);
  const baseRoiPercent = Number(recommendation.roiPercentage || recommendation.expectedROI || 0);
  const adjustedRoiPercent = Number(
    (baseRoiPercent *
      (CONDITION_MULTIPLIER[propertyCondition] || 1) *
      (DIFFICULTY_WEIGHT[recommendation.difficulty] || 1)).toFixed(2)
  );

  const estimatedGain = roiAmount(cost, adjustedRoiPercent);
  const netGain = estimatedGain - cost;
  const paybackMonths = Number((cost / Math.max(estimatedGain / 12, 1)).toFixed(1));

  return {
    id: recommendation.id,
    title: recommendation.title,
    category: recommendation.category,
    difficulty: recommendation.difficulty,
    timeframe: recommendation.timeframe,
    estimatedCost: cost,
    roiPercentage: adjustedRoiPercent,
    estimatedGain,
    netGain,
    paybackMonths,
    durationMonths: Number(monthsFromTimeframe(recommendation.timeframe).toFixed(1)),
  };
};

const createROIPlan = ({ recommendations, budget, propertyCondition, topN = 5 }) => {
  const normalizedBudget = Number(budget || 0);

  const candidates = recommendations
    .map((rec) => mapPlanItem(rec, propertyCondition))
    .filter((item) => item.estimatedCost > 0)
    .sort((a, b) => {
      if (b.roiPercentage !== a.roiPercentage) {
        return b.roiPercentage - a.roiPercentage;
      }
      return a.paybackMonths - b.paybackMonths;
    });

  const selected = [];
  let totalCost = 0;

  for (const item of candidates) {
    if (selected.length >= topN) {
      break;
    }

    if (normalizedBudget > 0 && totalCost + item.estimatedCost > normalizedBudget) {
      continue;
    }

    selected.push(item);
    totalCost += item.estimatedCost;
  }

  const totalEstimatedGain = selected.reduce((sum, item) => sum + item.estimatedGain, 0);
  const totalNetGain = selected.reduce((sum, item) => sum + item.netGain, 0);
  const blendedROI = totalCost > 0 ? Number(((totalEstimatedGain / totalCost) * 100).toFixed(2)) : 0;

  return {
    budget: normalizedBudget,
    totalCost,
    totalEstimatedGain,
    totalNetGain,
    blendedROI,
    selectedCount: selected.length,
    recommendations: selected,
  };
};

module.exports = {
  createROIPlan,
};

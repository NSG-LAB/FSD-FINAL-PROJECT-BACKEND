function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function estimateValue(input) {
  const areaSqft = toNumber(input.areaSqft);
  const ageYears = toNumber(input.ageYears);
  const bedrooms = toNumber(input.bedrooms);
  const bathrooms = toNumber(input.bathrooms);
  const conditionScore = Math.min(5, Math.max(1, toNumber(input.conditionScore, 3)));

  const baseRatePerSqft = 4500;
  const baseValue = areaSqft * baseRatePerSqft;

  const bedroomBoost = bedrooms * 0.03;
  const bathroomBoost = bathrooms * 0.015;
  const conditionBoost = (conditionScore - 3) * 0.04;
  const agePenalty = Math.min(0.35, ageYears * 0.01);

  const currentMultiplier = 1 + bedroomBoost + bathroomBoost + conditionBoost - agePenalty;
  const currentValue = Math.max(0, Math.round(baseValue * currentMultiplier));

  const improvementUplift = 0.08 + Math.max(0, (5 - conditionScore) * 0.02);
  const improvedValue = Math.round(currentValue * (1 + improvementUplift));

  const rangeMin = Math.round(currentValue * 0.92);
  const rangeMax = Math.round(currentValue * 1.08);

  return {
    currentValue,
    improvedValue,
    confidence: 'medium',
    range: { min: rangeMin, max: rangeMax },
    assumptions: {
      baseRatePerSqft,
      improvementUplift,
    },
  };
}

module.exports = { estimateValue };

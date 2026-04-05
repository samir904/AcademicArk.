// UTIL/adaptiveScore.util.js

const W = {
  readDepth:          0.35,
  pauseCount:         0.20,
  hesitationCount:    0.20,
  expandedDefinition: 0.15,
  timeSpent:          0.10,
};

export const scoreView = ({
  readDepthPercent    = 0,
  pauseCount          = 0,
  hesitationCount     = 0,
  expandedDefinition  = false,
  timeSpentSeconds    = 0,
}) => {
  const readScore   = (readDepthPercent / 100) * 100;
  const pauseScore  = Math.min(pauseCount * 15, 100);
  const hesScore    = Math.min(hesitationCount * 25, 100);
  const expandScore = expandedDefinition ? 100 : 0;
  const timeScore   = Math.min((timeSpentSeconds / 30) * 100, 100);

  return Math.round(
    readScore   * W.readDepth +
    pauseScore  * W.pauseCount +
    hesScore    * W.hesitationCount +
    expandScore * W.expandedDefinition +
    timeScore   * W.timeSpent
  );
};

export const deriveMode = (score, timeSpentSeconds) => {
  if (timeSpentSeconds < 1.5) return 'simplified';
  if (score >= 70)            return 'strong';
  if (score >= 40)            return 'hinted';
  return 'normal';
};

// Exponential moving average — recent view weighs 40%
export const blendScore = (prevScore, newScore, alpha = 0.4) =>
  Math.round(alpha * newScore + (1 - alpha) * prevScore);
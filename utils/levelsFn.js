// utils/levelsFn.js

function determineAffiliateLevel(totalIncome) {
  if (totalIncome >= 10000000) return "StraviX Legend Club";
  if (totalIncome >= 5000000) return "StraviX Crown Club";
  if (totalIncome >= 2000000) return "StraviX Legacy Club";
  if (totalIncome >= 1000000) return "StraviX Titan Club";
  if (totalIncome >= 500000) return "StraviX Elite Club";
  if (totalIncome >= 200000) return "StraviX Crest Club";
  if (totalIncome >= 100000) return "StraviX Rise Club";
  if (totalIncome >= 50000) return "StraviX Spark Club";
  return "StraviX Starter Club";
}

module.exports = { determineAffiliateLevel };

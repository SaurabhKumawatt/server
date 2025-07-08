// utils/levelsFn.js

function determineAffiliateLevel(totalIncome) {
  if (totalIncome >= 10000000) return "Grandmaster";
  if (totalIncome >= 5000000) return "Elite Legend";
  if (totalIncome >= 2500000) return "Diamond";
  if (totalIncome >= 1000000) return "Platinum";
  if (totalIncome >= 500000) return "Gold";
  if (totalIncome >= 100000) return "Silver";
  if (totalIncome >= 50000) return "Bronze";
  return "Starter";
}

module.exports = { determineAffiliateLevel };

const mongoose = require("mongoose");

const milestoneSchema = new mongoose.Schema({
  amount: Number,
  label: String,
  reward: String,
});

const targetMilestoneSchema = new mongoose.Schema({
  campaign: {
    type: String,
    required: true,
  },
  startDate: {
    type: Date,
    required: true,
  },
  endDate: {
    type: Date,
    required: true,
  },
  milestones: {
    type: [milestoneSchema],
    default: [],
  },
  isActive: {
    type: Boolean,
    default: true,
  },
});

module.exports = mongoose.model("TargetMilestone", targetMilestoneSchema);
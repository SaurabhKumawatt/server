// utils/aiGenerator.js
const { Configuration, OpenAIApi } = require("openai");
const CaptionTemplate = require("../models/CaptionTemplate");
const AffiliateTagline = require("../models/AffiliateTagline");
const ContentIdea = require("../models/ContentIdea");
const HighlightCover = require("../models/HighlightCover");

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

const generateFromOpenAI = async (prompt, maxTokens = 100) => {
  const response = await openai.createCompletion({
    model: "text-davinci-003",
    prompt,
    temperature: 0.7,
    max_tokens: maxTokens,
  });
  return response.data.choices[0].text.trim();
};

exports.generateBrandKitWithAI = async ({
  fullName,
  niches,
  occupation,
  achievements,
  preferredColors,
}) => {
  const nicheString = niches.join(", ");

  // 🔠 Username Suggestions
  const usernamePrompt = `Suggest 3 unique Instagram usernames for someone named ${fullName} who is in these niches: ${nicheString}`;
  const usernameRaw = await generateFromOpenAI(usernamePrompt);
  const usernameSuggestions = usernameRaw.split("\n").filter(Boolean);

  // 🧠 Optimized Name
  const optimizedNamePrompt = `Write a professional Instagram name with title for ${fullName}, a ${occupation} in ${nicheString}`;
  const optimizedName = await generateFromOpenAI(optimizedNamePrompt);

  // 📄 Bio
  const bioPrompt = `Write a 3-line Instagram bio for ${fullName}, a ${occupation} in ${nicheString}. Include achievements: ${achievements}`;
  const bio = await generateFromOpenAI(bioPrompt);

  // 🎨 Color Palette Suggestion
  const colorPrompt = `Suggest a professional brand color palette (3 hex codes) based on these user-preferred colors: ${preferredColors.join(", ")}, and niches: ${nicheString}`;
  const colorPaletteRaw = await generateFromOpenAI(colorPrompt);
  const colorPalette = colorPaletteRaw.match(/#[0-9A-Fa-f]{6}/g) || preferredColors;

  // 🖼️ Highlight Covers
  const highlightCoverNote = `Use Canva to create story highlight covers. Replace background color with: ${colorPalette[0]}`;
  const highlightCover = await HighlightCover.findOne({});

  // 📢 Caption Templates (from DB fallback)
  const dbCaptions = await CaptionTemplate.find().limit(3);
  const captionPrompt = `Give 3 short caption templates for Instagram for someone in ${nicheString}`;
  const aiCaptionsRaw = await generateFromOpenAI(captionPrompt);
  const aiCaptions = aiCaptionsRaw.split("\n").filter(Boolean);
  const captionTemplates = [...dbCaptions.map(c => c.text), ...aiCaptions].slice(0, 3);

  // 💼 Affiliate Branding Elements
  const taglines = await AffiliateTagline.find().limit(2);
  const brandingPrompt = `Write 2 creative affiliate branding phrases for ${nicheString}`;
  const brandingRaw = await generateFromOpenAI(brandingPrompt);
  const phrases = brandingRaw.split("\n").filter(Boolean);
  const affiliateElements = {
    taglines: [...taglines.map(t => t.text), ...phrases].slice(0, 3),
    logos: [],
    phrases,
  };

  // 🧠 Content Ideas
  const dbIdeas = await ContentIdea.find({ niche: { $in: niches } }).limit(3);
  const ideaPrompt = `Give 5 Instagram reel content ideas for someone in ${nicheString}`;
  const aiIdeasRaw = await generateFromOpenAI(ideaPrompt);
  const aiIdeas = aiIdeasRaw.split("\n").filter(Boolean);
  const contentIdeas = [...dbIdeas.map(i => i.text), ...aiIdeas].slice(0, 7);

  return {
    usernameSuggestions,
    optimizedName,
    bio,
    colorPalette,
    highlightCoverNote,
    highlightCoverLink: highlightCover?.url || null,
    captionTemplates,
    affiliateElements,
    contentIdeas,
  };
};

const bcrypt = require("bcryptjs");

bcrypt.hash("123456", 10).then((hash) => {
  console.log("✅ New hash for 123456:", hash);
});

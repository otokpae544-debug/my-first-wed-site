require("dotenv").config();

const { app, start } = require("./src/app");

if (require.main === module) {
  start().catch((error) => {
    console.error("Server failed to start:", error);
    process.exitCode = 1;
  });
}

module.exports = app;

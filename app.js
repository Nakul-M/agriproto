const express = require("express");
const path = require("path");

const app = express();

// Set EJS as view engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Static files (css, client-side js)
app.use(express.static(path.join(__dirname, "public")));

// Route for scanner
app.get("/scan", (req, res) => {
  res.render("scan");
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));

const jwt = require("jsonwebtoken");

function auth(req, res, next) {
  const token = req.header("Authorization");
  if (!token) return res.status(401).json({ error: "Access denied" });

  try {
    const verified = jwt.verify(token, "secretkey");
    req.user = verified; // attach user info to request
    next();
  } catch (err) {
    res.status(400).json({ error: "Invalid token" });
  }
}

module.exports = auth;

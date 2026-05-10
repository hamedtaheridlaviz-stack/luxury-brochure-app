
import { parseListingText } from "../lib/listingParser.js";
export default function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const parsed = parseListingText(body.text || "");
    res.status(200).json({ ...parsed, version: "4.0.0-dual-import", importMethod: "text-parser" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

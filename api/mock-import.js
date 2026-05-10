
import { mockListing } from "../lib/listingParser.js";
export default function handler(req, res) {
  res.status(200).json({ ...mockListing(), version: "4.0.0-dual-import" });
}

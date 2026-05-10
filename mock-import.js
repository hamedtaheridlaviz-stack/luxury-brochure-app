import { mockListing } from "../lib/listingParser.js";
export default async function handler(req, res) {
  return res.status(200).json({ ...mockListing(), version: "3.0.0-final-import-system", importMethod: "mock-test" });
}

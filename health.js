export default async function handler(req, res) {
  return res.status(200).json({
    ok: true,
    version: "3.0.0-final-import-system",
    hasApifyToken: Boolean(process.env.APIFY_TOKEN),
    timestamp: new Date().toISOString()
  });
}

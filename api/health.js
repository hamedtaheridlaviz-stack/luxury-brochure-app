export default function handler(req, res) {
  res.status(200).json({
    status: "ok",
    version: "4.0.0-dual-import"
  });
}

# Betterhomes Luxury Brochure Builder - Robust Import

This version keeps the manual brochure builder stable and adds a more robust optional import.

Import logic:
1. Direct Vercel server fetch and parse.
2. Apify Web Scraper fallback.
3. Clear error messages if both fail.

Required Vercel environment variable:
APIFY_TOKEN = your Apify API token

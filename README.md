# Betterhomes Luxury Brochure Builder with Optional Import - Hotfix

Stable manual brochure generator plus optional Property Finder/Bayut import.

Required Vercel environment variable:
APIFY_TOKEN = your Apify API token

Hotfix:
- Removes unsupported Apify crawlerType input that can cause:
  "The string did not match the expected pattern"
- Manual mode remains fully functional.

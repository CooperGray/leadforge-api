# LeadForge API — Apollo Enrichment Proxy

Serverless proxy that allows LeadForge to call Apollo.io's API directly from the browser.

## Deploy to Vercel (free)

1. Push this repo to GitHub
2. Go to vercel.com → Import Project → select this repo
3. Click Deploy — done

## Endpoint

`POST /api/enrich`

Body: `{ companies: [...], apolloKey: "your_apollo_key" }`

Returns verified emails, phone numbers, and contact data from Apollo.

// LeadForge Apollo Enrichment Proxy
// Deployed on Vercel — handles Apollo API calls that browsers can't make directly

module.exports = async function handler(req, res) {

  // Allow LeadForge to call this from any origin
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { companies, apolloKey } = req.body;

    if (!apolloKey) {
      return res.status(400).json({ error: 'Apollo API key required' });
    }
    if (!companies || !Array.isArray(companies) || companies.length === 0) {
      return res.status(400).json({ error: 'Companies array required' });
    }

    const results = [];

    for (const company of companies) {
      try {
        const domain = (company.website || '')
          .replace(/^https?:\/\//, '')
          .replace(/^www\./, '')
          .split('/')[0];

        const firstName = company.contactFirstName ||
          (company.keyContact || '').split(' ')[0] || '';
        const lastName = company.contactLastName ||
          (company.keyContact || '').split(' ').slice(1).join(' ').split(',')[0] || '';

        // Call Apollo People Match API
        const apolloRes = await fetch('https://api.apollo.io/v1/people/match', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
          },
          body: JSON.stringify({
            api_key: apolloKey,
            first_name: firstName,
            last_name: lastName,
            domain: domain || undefined,
            organization_name: company.name || undefined,
            reveal_personal_emails: false,
            reveal_phone_number: true
          })
        });

        if (!apolloRes.ok) {
          results.push({ name: company.name, status: 'not_found' });
          continue;
        }

        const data = await apolloRes.json();
        const person = data.person;

        if (!person) {
          results.push({ name: company.name, status: 'not_found' });
          continue;
        }

        // Build enriched result
        const enriched = {
          name:             company.name,
          status:           'enriched',
          email:            person.email || null,
          emailStatus:      person.email ? 'verified' : 'not_found',
          emailScore:       person.email ? 95 : null,
          contactFirstName: person.first_name || firstName,
          contactLastName:  person.last_name  || lastName,
          contactTitle:     person.title || company.contactTitle || '',
          contactPhone:     '',
          linkedinUrl:      person.linkedin_url || '',
          address1:         '',
          city:             '',
          state:            '',
          postalCode:       '',
          country:          ''
        };

        // Phone number
        if (person.phone_numbers && person.phone_numbers.length > 0) {
          enriched.contactPhone =
            person.phone_numbers[0].sanitized_number ||
            person.phone_numbers[0].raw_number || '';
        }

        // Address from organization
        const org = person.organization;
        if (org) {
          enriched.contactPhone = enriched.contactPhone || org.phone || '';
          enriched.address1     = org.street_address || '';
          enriched.city         = org.city           || '';
          enriched.state        = org.state          || '';
          enriched.postalCode   = org.postal_code    || '';
          enriched.country      = org.country        || 'United States';
        }

        results.push(enriched);

        // Apollo rate limit — 1 req/sec on free tier
        await new Promise(r => setTimeout(r, 1100));

      } catch (companyErr) {
        // Never crash the whole batch for one company error
        results.push({ name: company.name, status: 'error', error: companyErr.message });
      }
    }

    return res.status(200).json({ success: true, results });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

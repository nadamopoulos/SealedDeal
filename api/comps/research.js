import Anthropic from '@anthropic-ai/sdk';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured on server' });

    const { companyName } = req.body;
    if (!companyName || typeof companyName !== 'string' || companyName.trim().length === 0) {
      return res.status(400).json({ error: 'companyName is required' });
    }

    const trimmedName = companyName.trim();

    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `You are a franchise/restaurant industry research analyst. Given a company name, return the best available data for this concept as a JSON object. Use publicly available data, FDD filings, industry reports. If exact data isn't available, provide reasonable estimates based on similar concepts and mark them. Return ONLY valid JSON with no markdown formatting, no code fences, no explanation.

Company: "${trimmedName}"

Return this exact JSON shape:
{
  "id": "<slugified-name>",
  "name": "<Company Name>",
  "category": "QSR" | "Fast Casual" | "Casual Dining" | "Coffee & Beverage",
  "unitCount": <number>,
  "avgUnitVolume": "<formatted string like $1.2M>",
  "avgUnitVolumeNum": <number>,
  "sssGrowth": "<formatted like 3.2%>",
  "sssGrowthNum": <number>,
  "franchiseeFoodCost": "<formatted like 30.0%>",
  "franchiseeFoodCostNum": <number>,
  "franchiseeEBITDA": "<formatted like 18.0%>",
  "franchiseeEBITDANum": <number>,
  "royaltyRate": "<formatted like 5.0%>",
  "royaltyRateNum": <number>,
  "initialInvestment": "<formatted like $1.5M>",
  "initialInvestmentNum": <number>,
  "geography": "US" | "Global" | "Regional",
  "yearFounded": <number>,
  "isEstimated": true
}

Rules:
- "id" should be a URL-safe slug of the company name (lowercase, hyphens)
- All "Num" fields must be raw numbers (e.g. avgUnitVolumeNum in dollars, percentages as plain numbers like 18.0)
- category must be one of: "QSR", "Fast Casual", "Casual Dining", "Coffee & Beverage"
- geography must be one of: "US", "Global", "Regional"
- isEstimated should be true since this is AI-researched data
- Return ONLY the JSON object, nothing else`,
        },
      ],
    });

    // Extract text content from the response
    const textBlock = message.content.find((b) => b.type === 'text');
    if (!textBlock) {
      return res.status(500).json({ error: 'No text response from AI' });
    }

    // Clean potential markdown fences
    let jsonStr = textBlock.text.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }

    let comp;
    try {
      comp = JSON.parse(jsonStr);
    } catch (parseErr) {
      console.error('[research] Failed to parse AI response:', jsonStr.slice(0, 500));
      return res.status(500).json({ error: 'AI returned invalid JSON. Please try again.' });
    }

    // Validate required fields
    const requiredFields = [
      'id', 'name', 'category', 'unitCount', 'avgUnitVolume', 'avgUnitVolumeNum',
      'sssGrowth', 'sssGrowthNum', 'franchiseeFoodCost', 'franchiseeFoodCostNum',
      'franchiseeEBITDA', 'franchiseeEBITDANum', 'royaltyRate', 'royaltyRateNum',
      'initialInvestment', 'initialInvestmentNum', 'geography', 'yearFounded',
    ];
    const missing = requiredFields.filter((f) => comp[f] === undefined || comp[f] === null);
    if (missing.length > 0) {
      console.error('[research] Missing fields:', missing);
      return res.status(500).json({ error: `AI response missing fields: ${missing.join(', ')}` });
    }

    // Ensure isEstimated is set
    comp.isEstimated = true;

    return res.status(200).json({ comp });
  } catch (err) {
    console.error('[research] Error:', err);
    return res.status(500).json({ error: err.message || 'Research failed' });
  }
}

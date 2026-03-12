import Anthropic from '@anthropic-ai/sdk';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured on server' });

    const { question, dealName, company, industry, documents } = req.body;
    if (!question) return res.status(400).json({ error: 'Question required' });

    const client = new Anthropic({ apiKey });

    const allText = documents
      .filter((d) => d.extractedText && !d.extractedText.startsWith('[Error'))
      .map((d) => `\n--- DOCUMENT: ${d.name} ---\n${d.extractedText}`)
      .join('\n\n');

    const truncatedText = allText.slice(0, 150000);

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: `You are a senior PE due diligence analyst answering questions about a deal.
Ground every answer in the provided documents. Always cite the source document filename (and page if available).
If the answer isn't in the documents, say so clearly and suggest what data to request.
Be precise, quantitative, and action-oriented. Format your response in clear paragraphs.`,
      messages: [
        {
          role: 'user',
          content: `DEAL: ${dealName} (${company}, ${industry || 'N/A'})

DOCUMENTS:
${truncatedText}

QUESTION: ${question}

Answer the question based on the documents above. Always cite sources with exact document filenames.`,
        },
      ],
    });

    res.json({ answer: response.content[0].text });
  } catch (err) {
    console.error('Q&A error:', err);
    res.status(500).json({ error: err.message });
  }
}

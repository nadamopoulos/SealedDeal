import express from 'express';
import multer from 'multer';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Anthropic from '@anthropic-ai/sdk';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, '..', 'uploads');

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dealDir = path.join(uploadsDir, req.params.dealId || 'tmp');
    if (!fs.existsSync(dealDir)) fs.mkdirSync(dealDir, { recursive: true });
    cb(null, dealDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

// Auto-categorize a document by filename
function categorizeDocument(filename) {
  const name = filename.toLowerCase();
  if (/financ|p&l|income|balance|cash.?flow|revenue|ebitda|budget|audit|tax|valuation|model/i.test(name))
    return 'financial';
  if (/legal|contract|agreement|compliance|regulat|license|patent|litigation|ip\b|trademark/i.test(name))
    return 'legal';
  if (/operat|process|supply|logistics|inventory|manufacturing|quality|kpi|sop|franchise.?agreement/i.test(name))
    return 'operational';
  if (/market|industry|compet|landscape|benchmark|customer|segment|tam|sam|research|trend/i.test(name))
    return 'market';
  if (/manage|team|org|executive|board|leadership|cv|resume|bio|compensation|hiring/i.test(name))
    return 'management';
  return 'other';
}

// Upload documents
app.post('/api/deals/:dealId/upload', upload.array('files', 20), async (req, res) => {
  try {
    const files = req.files;
    const results = [];

    for (const file of files) {
      let extractedText = '';
      const ext = path.extname(file.originalname).toLowerCase();

      try {
        if (ext === '.pdf') {
          const dataBuffer = fs.readFileSync(file.path);
          const uint8 = new Uint8Array(dataBuffer);
          const doc = await getDocument({ data: uint8 }).promise;
          const textParts = [];
          for (let i = 1; i <= doc.numPages; i++) {
            const page = await doc.getPage(i);
            const content = await page.getTextContent();
            const pageText = content.items.map((item) => item.str).join(' ');
            textParts.push(`[Page ${i}] ${pageText}`);
          }
          extractedText = textParts.join('\n\n');
          doc.destroy();
        } else if (ext === '.docx') {
          const mammoth = await import('mammoth');
          const result = await mammoth.extractRawText({ path: file.path });
          extractedText = result.value;
        } else if (ext === '.txt' || ext === '.csv' || ext === '.md') {
          extractedText = fs.readFileSync(file.path, 'utf-8');
        } else if (ext === '.xlsx' || ext === '.xls') {
          extractedText = `[Spreadsheet file: ${file.originalname} - Please note: spreadsheet data extraction is limited. For best results, export key sheets as CSV.]`;
        } else {
          extractedText = `[Unsupported file type: ${ext}. Supported: PDF, DOCX, TXT, CSV, MD]`;
        }
      } catch (parseErr) {
        extractedText = `[Error extracting text from ${file.originalname}: ${parseErr.message}]`;
      }

      results.push({
        id: crypto.randomUUID(),
        name: file.originalname,
        type: ext.replace('.', ''),
        size: file.size,
        extractedText: extractedText.slice(0, 200000),
        status: extractedText.startsWith('[Error') ? 'error' : 'extracted',
        category: categorizeDocument(file.originalname),
      });
    }

    res.json({ documents: results });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Analyze deal
app.post('/api/deals/:dealId/analyze', async (req, res) => {
  try {
    const { apiKey, dealName, company, industry, dealSize, geography, documents } = req.body;

    if (!apiKey) return res.status(400).json({ error: 'API key required' });
    if (!documents?.length) return res.status(400).json({ error: 'No documents to analyze' });

    const client = new Anthropic({ apiKey });

    const allText = documents
      .filter((d) => d.extractedText && !d.extractedText.startsWith('[Error'))
      .map((d) => `\n--- DOCUMENT: ${d.name} ---\n${d.extractedText}`)
      .join('\n\n');

    const truncatedText = allText.slice(0, 180000);

    const systemPrompt = `You are a senior McKinsey-trained Private Equity due diligence analyst. You analyze data rooms and produce institutional-quality investment analysis. Your tone is precise, authoritative, and action-oriented. You think in frameworks, quantify wherever possible, and always separate facts from assumptions. You write in crisp, clear sentences typical of top-tier management consulting.

CRITICAL RULES:
- NEVER recommend whether to acquire or not. You are an analyst, not an investment committee.
- Instead of recommendations, provide a dense, insightful business summary that teaches the reader about the company, industry, and market in 3-5 sentences. A PE professional should read it and think "Wow, I feel like I just learned about a new industry and company."
- Every data point MUST reference its source document filename. Use the format "Source: filename.pdf" or "Source: filename.pdf, p.XX" if page numbers are available.
- For red flags, provide detailed reasoning and a concrete suggested DD action to investigate further.
- For KPIs, provide benchmark ranges (low-high numbers), a percentile estimate (0-100), and a one-line AI commentary specific to this company's industry/segment.
- For missing playbook metrics, suggest which specific document type the PE team should request to fill the gap.`;

    const analysisPrompt = `Analyze this potential acquisition target for a PE deal.

DEAL CONTEXT:
- Deal Name: ${dealName}
- Target Company: ${company}
- Industry: ${industry || 'Not specified'}
- Deal Size: ${dealSize || 'Not specified'}
- Geography: ${geography || 'Not specified'}

EXTRACTED DATA ROOM DOCUMENTS:
${truncatedText}

Return ONLY valid JSON (no markdown, no code blocks) with this exact structure:

{
  "summary": {
    "headline": "One-line investment thesis headline",
    "overview": "2-3 dense sentences: what the company does, scale, business model, and unit economics. McKinsey precision.",
    "industry": "2-3 sentences on industry dynamics, growth trajectory, structural trends, and where the industry is in its lifecycle",
    "market": "2-3 sentences on addressable market, market size, penetration rates, and growth drivers",
    "competition": "2-3 sentences on competitive landscape, key players, market shares, and differentiation factors",
    "positioning": "2-3 sentences on the target's competitive position, moat, and why it wins (or loses) vs. alternatives",
    "keyThesis": "2-3 sentences: the core investment thesis — what structural advantage or inflection point makes this interesting for PE"
  },
  "playbook": [
    {
      "category": "Category name",
      "description": "Why this category matters for this specific deal",
      "metrics": [
        {
          "name": "Metric name",
          "description": "What this measures and why it matters",
          "expected": "PE benchmark/expectation for this industry and deal size",
          "actual": "Actual value found in documents, or null if not found",
          "status": "met|partial|missing|concern",
          "notes": "Analysis notes",
          "source": "Exact document filename, e.g. 'CIP_Presentation.pdf, p.45'",
          "pageRef": "Page reference if available, e.g. 'p.45'",
          "suggestedDocType": "Only for missing metrics: what document to request, e.g. 'Request franchisee-level P&L data'"
        }
      ]
    }
  ],
  "structuredData": [
    {
      "section": "Section name",
      "items": [
        {
          "label": "Data point name",
          "value": "Extracted value",
          "unit": "Currency, %, count, etc.",
          "period": "Time period if applicable",
          "confidence": "high|medium|low",
          "source": "Exact document filename",
          "pageRef": "Page reference if available"
        }
      ]
    }
  ],
  "signals": {
    "buyingSignals": [
      {
        "id": "bs1",
        "title": "Short title",
        "description": "Why this is a positive signal",
        "severity": "high|medium|low",
        "category": "Category",
        "source": "Exact document filename",
        "pageRef": "Page ref if available",
        "evidence": "Specific quantitative evidence from documents",
        "reasoning": "2-3 sentences: detailed analytical reasoning for why this signal matters for the investment thesis",
        "suggestedAction": "What DD step to take to validate this signal"
      }
    ],
    "redFlags": [
      {
        "id": "rf1",
        "title": "Short title",
        "description": "Why this is concerning",
        "severity": "critical|high|medium|low",
        "category": "Category",
        "source": "Exact document filename",
        "pageRef": "Page ref if available",
        "evidence": "Specific evidence from documents",
        "reasoning": "3-4 sentences: detailed analytical reasoning — what the flag means for the business, how it could impact value, and what precedents exist in similar deals",
        "suggestedAction": "Specific DD action to investigate this flag, e.g. 'Request last 3 years of franchisee turnover data and exit interviews'"
      }
    ],
    "inconsistencies": [
      {
        "id": "ic1",
        "title": "Short title",
        "description": "What doesn't add up",
        "severity": "critical|high|medium|low",
        "category": "Category",
        "source": "Document filenames with conflicting data",
        "pageRef": "Page refs",
        "evidence": "Specific conflicting data points",
        "reasoning": "2-3 sentences explaining why this inconsistency matters and what it could indicate",
        "suggestedAction": "Specific verification step"
      }
    ],
    "dataGaps": [
      {
        "id": "dg1",
        "title": "Missing data point",
        "description": "Why this data is critical",
        "severity": "critical|high|medium|low",
        "category": "Category",
        "source": "N/A",
        "evidence": "What we'd expect to see but don't",
        "reasoning": "Why this gap is concerning and what it might be hiding",
        "suggestedAction": "Specific document or data to request from the seller"
      }
    ]
  },
  "cockpit": {
    "overallScore": 72,
    "overallRating": "Cautiously Positive",
    "businessSummary": "3-5 dense, insightful sentences that teach the reader about this business, its industry, unit economics, and competitive dynamics. Write it so a PE professional who knows nothing about this space would read it and immediately grasp the opportunity and its key tensions. Do NOT recommend whether to acquire — just educate.",
    "riskLevel": "low|moderate|high|critical",
    "categoryScores": [
      {
        "category": "Category name",
        "score": 8,
        "maxScore": 10,
        "color": "#22c55e",
        "details": "Brief explanation"
      }
    ],
    "kpis": [
      {
        "name": "KPI name",
        "value": "Value",
        "unit": "Unit",
        "trend": "up|down|stable|unknown",
        "benchmark": "Descriptive benchmark label",
        "benchmarkLow": 20,
        "benchmarkHigh": 35,
        "percentile": 75,
        "commentary": "One-line AI insight specific to this company's segment, e.g. 'Top quartile for Asian fast-casual franchise concepts'",
        "status": "good|warning|critical|neutral",
        "source": "Source document"
      }
    ],
    "investmentHighlights": ["Highlight 1", "Highlight 2", "Highlight 3"],
    "keyRisks": ["Risk 1", "Risk 2", "Risk 3"],
    "nextSteps": ["Next step 1", "Next step 2", "Next step 3"]
  }
}

REQUIREMENTS:
- 8-12 playbook categories with 3-6 metrics each
- At least 5 buying signals, 5 red flags, 3 inconsistencies, 5 data gaps
- Every red flag and inconsistency MUST have detailed "reasoning" (3-4 sentences) and a concrete "suggestedAction"
- Every signal MUST have "reasoning" and "suggestedAction"
- 8-12 category scores and 8-12 KPIs
- Every KPI MUST have benchmarkLow, benchmarkHigh (numbers), percentile (0-100), and commentary (one-liner)
- Category score colors: green (#22c55e) for >7, yellow (#eab308) for 5-7, red (#ef4444) for <5
- All source fields MUST reference exact document filenames from the data room
- Missing playbook metrics MUST have suggestedDocType explaining what to request
- The businessSummary in cockpit must be dense and educational — NOT a buy/don't-buy recommendation
- Overall score 0-100`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 16000,
      system: systemPrompt,
      messages: [{ role: 'user', content: analysisPrompt }],
    });

    const content = response.content[0].text;

    let analysis;
    try {
      const cleanJson = content.replace(/^```json?\n?/g, '').replace(/\n?```$/g, '').trim();
      analysis = JSON.parse(cleanJson);
    } catch (parseErr) {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse analysis response as JSON');
      }
    }

    analysis.analyzedAt = new Date().toISOString();
    res.json({ analysis });
  } catch (err) {
    console.error('Analysis error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Q&A - Ask the Deal
app.post('/api/deals/:dealId/qa', async (req, res) => {
  try {
    const { apiKey, question, dealName, company, industry, documents } = req.body;

    if (!apiKey) return res.status(400).json({ error: 'API key required' });
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
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Howy PE server running on port ${PORT}`);
});

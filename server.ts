import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Increase payload limit for base64 plant leaf images
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Initialize Gemini SDK with telemetry header
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Resilient wrapper: calls high-availability flash model first, and retries with backoff if rate limits or spikes occur
async function generateContentWithResilience(params: {
  contents: any;
  config?: any;
}) {
  const models = ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash'];
  let lastError: any = null;

  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: params.contents,
          config: params.config,
        });
        return response;
      } catch (err: any) {
        lastError = err;
        const msg = err?.message || String(err);
        const isTransient = msg.includes('503') || msg.includes('high demand') || msg.includes('UNAVAILABLE') || msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED');
        if (isTransient) {
          console.log(`[Model Selection] ${model} transient demand, trying alternative candidate...`);
          await new Promise((resolve) => setTimeout(resolve, 600));
          break; // Try next model since models have independent per-model free quotas
        }
        throw err;
      }
    }
  }

  // If all failed due to rate limits, throw a clear message
  const lastMsg = lastError?.message || String(lastError);
  if (lastMsg.includes('429') || lastMsg.includes('RESOURCE_EXHAUSTED')) {
    throw new Error('AI Free-Tier Rate Limit Reached: Please wait 15-20 seconds before requesting again.');
  }
  throw lastError;
}

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    geminiKeySet: Boolean(process.env.GEMINI_API_KEY),
  });
});

/**
 * 1. PHOTO DIAGNOSIS
 * Model: gemini-flash-latest (multimodal/vision capable)
 * Identifies plant health, likely disease/pest issue, simple explanation, and treatment including natural/organic options.
 */
app.post('/api/diagnose-leaf', async (req: Request, res: Response) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg', plantHint = '' } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'Image data is required' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
    }

    // Clean base64 string if data URI prefix was sent
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');

    const prompt = `You are an expert plant pathologist, agronomist, and agricultural advisor.
Analyze this image of a plant leaf or plant sample.
${plantHint ? `The user notes this plant might be: "${plantHint}".` : ''}

Strictly provide your response in valid JSON format matching this schema:
{
  "plantName": "Identified plant or crop name (e.g., Tomato, Cotton, Rice, Basil, etc.)",
  "isHealthy": boolean (true if healthy and free from major disease/pests, false otherwise),
  "status": "Healthy" or "Diseased",
  "diseaseName": "Likely disease or pest issue if any (e.g., Early Blight, Powdery Mildew, Aphid Infestation, Leaf Curl, or 'None - Healthy Plant')",
  "confidence": "High" or "Moderate" or "Low",
  "explanation": "Simple, non-jargon explanation of what is visible on the leaf and why this condition occurs",
  "symptoms": ["Key symptom 1", "Key symptom 2", "Key symptom 3"],
  "treatments": {
    "naturalOrganic": [
      "Natural/organic treatment 1 (e.g. neem oil spray, baking soda mix, biocontrol, compost tea, pruning affected leaves)",
      "Natural/organic treatment 2",
      "Natural/organic treatment 3"
    ],
    "chemicalOrStandard": [
      "Standard management or IPM treatment 1",
      "Standard management treatment 2"
    ]
  },
  "preventiveMeasures": [
    "Preventive tip 1 (watering technique, spacing, soil health)",
    "Preventive tip 2",
    "Preventive tip 3"
  ],
  "disclaimer": "This diagnosis is an AI-assisted proof of concept and should not replace on-site agricultural inspection."
}

Ensure the language is clear, supportive, practical, and informative. If the image is not a plant, set plantName to 'Unidentified / Non-plant' and explain kindly.`;

    const response = await generateContentWithResilience({
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType || 'image/jpeg',
              data: cleanBase64,
            },
          },
          {
            text: prompt,
          },
        ],
      },
      config: {
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    });

    const responseText = response.text || '{}';
    let parsedResult;
    try {
      parsedResult = JSON.parse(responseText);
    } catch {
      // Fallback in case wrapped in markdown block
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      parsedResult = jsonMatch ? JSON.parse(jsonMatch[0]) : {
        plantName: 'Plant Sample',
        isHealthy: false,
        status: 'Diseased',
        diseaseName: 'Analysis Completed',
        confidence: 'Moderate',
        explanation: responseText,
        symptoms: ['Observed leaf discoloration or abnormality'],
        treatments: {
          naturalOrganic: ['Apply diluted neem oil spray (5ml per liter of water)', 'Remove and destroy severely affected leaves'],
          chemicalOrStandard: ['Consult local extension office for approved fungicides or pesticides if spread continues']
        },
        preventiveMeasures: ['Ensure adequate airflow between plants', 'Avoid overhead wetting of foliage'],
        disclaimer: 'This diagnosis is an AI-assisted proof of concept and should not replace on-site agricultural inspection.'
      };
    }

    res.json(parsedResult);
  } catch (error: any) {
    console.error('Error diagnosing leaf:', error);
    res.status(500).json({
      error: 'Failed to diagnose plant leaf',
      message: error?.message || String(error),
    });
  }
});

/**
 * 2. PREVENTIVE CHECKLIST
 * Model: gemini-flash-latest
 * Generates a short checklist (5-6 bullet points) of early warning signs to watch for with a specific plant.
 */
app.post('/api/preventive-checklist', async (req: Request, res: Response) => {
  try {
    const { plantName } = req.body;

    if (!plantName || typeof plantName !== 'string' || !plantName.trim()) {
      return res.status(400).json({ error: 'Plant or crop name is required' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
    }

    const prompt = `You are a plant doctor and agricultural extension expert.
The user is cultivating or caring for: "${plantName.trim()}".

Provide a short, highly practical checklist of exactly 5 to 6 early warning signs to watch for specifically with ${plantName.trim()}.
Focus on early indicators before full disease or pest devastation occurs (e.g., leaf underside spots, marginal yellowing, stem darkening, root rot odors, powdery films, curled tips, stunted growth).

Output MUST be valid JSON with this exact structure:
{
  "plantName": "${plantName.trim()}",
  "overview": "A 1-2 sentence overview of what makes proactive monitoring vital for ${plantName.trim()}.",
  "checklist": [
    {
      "id": "item-1",
      "title": "Short title of warning sign (e.g., Yellowing Leaf Margins & Veinal Chlorosis)",
      "description": "Specific visual clue to look for on ${plantName.trim()}",
      "action": "Immediate corrective or protective step to take if detected",
      "criticality": "High"
    },
    {
      "id": "item-2",
      "title": "Short title of warning sign",
      "description": "Specific visual clue",
      "action": "Immediate corrective step",
      "criticality": "Medium"
    },
    {
      "id": "item-3",
      "title": "Short title of warning sign",
      "description": "Specific visual clue",
      "action": "Immediate corrective step",
      "criticality": "Medium"
    },
    {
      "id": "item-4",
      "title": "Short title of warning sign",
      "description": "Specific visual clue",
      "action": "Immediate corrective step",
      "criticality": "Low"
    },
    {
      "id": "item-5",
      "title": "Short title of warning sign",
      "description": "Specific visual clue",
      "action": "Immediate corrective step",
      "criticality": "High"
    },
    {
      "id": "item-6",
      "title": "Short title of warning sign",
      "description": "Specific visual clue",
      "action": "Immediate corrective step",
      "criticality": "Low"
    }
  ]
}`;

    const response = await generateContentWithResilience({
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.3,
      },
    });

    const responseText = response.text || '{}';
    let parsedResult;
    try {
      parsedResult = JSON.parse(responseText);
    } catch {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      parsedResult = jsonMatch ? JSON.parse(jsonMatch[0]) : {
        plantName,
        overview: `Essential vigilance checklist for ${plantName}.`,
        checklist: [],
      };
    }

    res.json(parsedResult);
  } catch (error: any) {
    console.error('Error generating checklist:', error);
    res.status(500).json({
      error: 'Failed to generate preventive checklist',
      message: error?.message || String(error),
    });
  }
});

/**
 * 3. REGIONAL CROP ADVISORY
 * Model: gemini-flash-latest
 * Takes Indian state, season, crop name, user role (Farmer vs Home Gardener),
 * and Firestore production records (State_Name, Season, Crop, Production, rank).
 */
app.post('/api/regional-advisory', async (req: Request, res: Response) => {
  try {
    const { state, season, crop, userRole = 'Farmer', matchingRecords = [] } = req.body;

    if (!state || !season || !crop) {
      return res.status(400).json({ error: 'State, Season, and Crop are required.' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
    }

    // Determine rank of the selected crop if available in dataset
    const matchedCrop = matchingRecords.find(
      (r: any) => r.Crop?.toLowerCase() === crop.toLowerCase()
    );

    const contextDataStr = matchingRecords.length > 0
      ? matchingRecords
          .map((r: any) => `- Crop: ${r.Crop}, Production: ${r.Production?.toLocaleString()} Tonnes, Rank: #${r.rank}`)
          .join('\n')
      : 'No exact production records registered for this specific combination; relying on agro-climatic zone standards.';

    const prompt = `You are a premier Indian agricultural advisor and horticulture scientist.
Evaluate this user request with official agro-climatic intelligence:

USER PROFILE:
- Role: ${userRole} (${userRole === 'Farmer' ? 'Commercial or subsistence agricultural cultivation' : 'Urban / Terrace / Backyard / Balcony Home Gardener'})
- Indian State: ${state}
- Season: ${season} (Kharif: Monsoon; Rabi: Winter/Spring; Summer/Zaid: Dry hot season; Whole Year: Perennial)
- Target Crop: ${crop}

OFFICIAL STATE DATASET RECORDS (${state} during ${season} season):
${contextDataStr}
${matchedCrop ? `Selected Crop Rank in dataset: #${matchedCrop.rank} with ${matchedCrop.Production?.toLocaleString()} Tonnes production.` : 'The selected crop was not in the top dataset rank, meaning it may be an emerging, niche, or non-traditional crop for this state/season.'}

TASK GUIDELINES:
1. If user is a "Farmer":
   - Explicitly explain whether "${crop}" is a good, viable crop choice for ${state} in the ${season} season.
   - Reference its production ranking and volume from the dataset context (rank 1 = highest production for that state/season combination).
   - Address soil conditions, water availability, monsoon dependency, market procurement/MSP, and disease vulnerability.
   - Provide concrete agronomic advice to maximize yield and mitigate climatic risks.
2. If user is a "Home Gardener":
   - Suggest natural, low-cost home gardening care tips tailored to growing "${crop}" in pots, containers, grow bags, or terrace patches in ${state}'s ${season} climate.
   - Address potting mix (cocopeat, compost, garden soil ratio), sunlight hours, organic fertilizers (jeevamrut, vermicompost, kitchen waste tea), natural pest deterrents (neem oil, garlic-chilli spray), and watering frequency.

Output MUST be valid JSON adhering to this structure:
{
  "state": "${state}",
  "season": "${season}",
  "crop": "${crop}",
  "userRole": "${userRole}",
  "verdict": "Highly Recommended" | "Recommended" | "Moderate / Conditional" | "Challenging",
  "productionRankText": "Rank explanation (e.g., 'Rank #1 in ${state} (${season})' or 'Non-traditional / Alternative crop in this state')",
  "summary": "Crisp 2-sentence executive summary verdict on whether this crop is suitable and why.",
  "detailedAdvice": "Thorough, easy-to-read explanation (3-4 paragraphs) covering climate, temperature, soil/potting medium, water requirements, and season compatibility.",
  "keyActionTips": [
    "Actionable tip 1 specific to ${userRole}",
    "Actionable tip 2 specific to ${userRole}",
    "Actionable tip 3 specific to ${userRole}",
    "Actionable tip 4 specific to ${userRole}"
  ],
  "topCropsInRegion": [
    ${matchingRecords.slice(0, 4).map((r: any) => `{"crop": "${r.Crop}", "production": ${r.Production || 0}, "rank": ${r.rank || 1}}`).join(', ')}
  ],
  "waterAndSoilNotes": "Specific irrigation/watering guidance and soil/substrate characteristics required in ${state} during ${season}."
}`;

    const response = await generateContentWithResilience({
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.3,
      },
    });

    const responseText = response.text || '{}';
    let parsedResult;
    try {
      parsedResult = JSON.parse(responseText);
    } catch {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      parsedResult = jsonMatch ? JSON.parse(jsonMatch[0]) : {
        state,
        season,
        crop,
        userRole,
        verdict: 'Recommended',
        productionRankText: matchedCrop ? `Rank #${matchedCrop.rank}` : 'Evaluated',
        summary: `Advisory analysis for growing ${crop} in ${state} during ${season}.`,
        detailedAdvice: responseText,
        keyActionTips: ['Check local soil test values before sowing', 'Ensure drainage during heavy showers'],
        topCropsInRegion: [],
        waterAndSoilNotes: 'Maintain moderate soil moisture without waterlogging.'
      };
    }

    res.json(parsedResult);
  } catch (error: any) {
    console.error('Error generating regional advisory:', error);
    res.status(500).json({
      error: 'Failed to generate regional crop advisory',
      message: error?.message || String(error),
    });
  }
});

// Vite middleware & Static Serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // Express v4 wildcard
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Plant Health Advisor server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

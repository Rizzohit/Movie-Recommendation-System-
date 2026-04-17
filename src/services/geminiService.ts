import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });

export interface RecommendationResponse {
  title: string;
  year: string;
  matchReason: string;
  platform: string;
}

export async function getRecommendations(
  searchHistory: string[],
  ottHistory: string[],
  userInput: string
): Promise<RecommendationResponse[]> {
  const model = "gemini-3-flash-preview";

  const systemInstruction = `
    ## Role
    You are an Elite Movie Concierge. Your goal is to provide highly personalized movie recommendations by synthesizing three data sources: 
    1. The user's explicit current request.
    2. The user's recent Google Search history.
    3. The user's OTT viewing history (Netflix, Prime, etc.).

    ## Data Processing Rules
    - **Cross-Reference:** Analyze both histories to find overlapping themes, directors, or genres.
    - **Avoid Duplicates:** Do not recommend movies already in the OTT history.
    - **Contextual Weighting:** 
        - Search History = Current Interests (Weight: 30%)
        - OTT History = Long-term Taste (Weight: 50%)
        - Explicit Input = Immediate Mood (Weight: 20%)

    ## Output Format
    Return a JSON array of 3 recommendations.
  `;

  const prompt = `
    USER DATA:
    - Search History: ${JSON.stringify(searchHistory)}
    - OTT History: ${JSON.stringify(ottHistory)}

    USER INPUT:
    "${userInput}"
  `;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            year: { type: Type.STRING },
            matchReason: { type: Type.STRING },
            platform: { type: Type.STRING },
          },
          required: ["title", "year", "matchReason", "platform"],
        },
      },
    },
  });

  return JSON.parse(response.text || "[]");
}

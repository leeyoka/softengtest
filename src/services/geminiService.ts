import { GoogleGenAI } from "@google/genai";
import { ThreatLevel } from "../types";

const ai = new GoogleGenAI({ 
  apiKey: import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || "" 
});

export async function analyzeCallContent(transcript: string): Promise<{ threatLevel: ThreatLevel; summary: string }> {
  try {
    if (!transcript || transcript.trim().length < 3) {
      return { threatLevel: ThreatLevel.SAFE, summary: "Insufficient data for analysis." };
    }

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      config: {
        systemInstruction: `You are Aegis "Blackbox", a zero-trust fraud detection engine. 
Analyze the transcript for English and Indonesian scams. You must be extremely AGGRESSIVE.

CRITICAL INSTRUCTION: Treat any request for money ("kasih gua uang", "minta duit", "transfer", "kirim dana") as a "Threat" immediately, even if it sounds like a joke or casual. There are NO jokes in Aegis monitoring.

CRITICAL VULNERABILITIES (Mark as 'Threat' immediately):
1. Any direct request for money or payment.
2. Impersonation of ANY bank or government authority (BCA, Mandiri, BRI, BNI, Shopee, Polisi).
3. Urgency regarding account blocking or package delivery.
4. Requests for OTP, PIN, or verification codes.

Indonesian Trigger List (ANY mention = Threat):
- "kasih gua uang"
- "minta 100 juta"
- "transfer sekarang"
- "pinjam dulu seratus"
- "ini dari pusat BCA"
- "akun anda terblokir"

Categorization:
- 'Threat': Clear extortion, scam patterns, or ANY money request.
- 'Caution': Vague intent or unknown cold callers.
- 'Safe': Only standard social questions/answers (e.g., "Halo", "Apa kabar", "Sudah makan?").

Output JSON:
{
  "threatLevel": "Threat" | "Caution" | "Safe",
  "summary": "Technical reason for flag."
}`,
        responseMimeType: "application/json",
      },
      contents: `MANDATORY SECURITY SCAN: "${transcript}"`,
    });

    const result = JSON.parse(response.text || "{}");
    return {
      threatLevel: result.threatLevel as ThreatLevel || ThreatLevel.SAFE,
      summary: result.summary || "Analysis complete."
    };
  } catch (error: any) {
    console.error("Gemini Analysis Error:", error);
    const errorMessage = error?.message || "Unknown error";
    return { 
      threatLevel: ThreatLevel.SAFE, 
      summary: `Analysis failed: ${errorMessage}. Please check if GEMINI_API_KEY is set correctly.` 
    };
  }
}

export async function analyzeDeepfakeImage(base64Image: string): Promise<{ threatLevel: ThreatLevel; summary: string }> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      config: {
        systemInstruction: `You are the Aegis "Zero-Trust" Visual Forensic Engine. Your primary mission is to detect high-fidelity AI-generated human faces (Deepfakes) that are designed to bypass standard detection.

The image you are analyzing is likely a "High-Quality" synthetic generation. Do NOT be fooled by skin pores or realistic lighting—modern AI (Flux/Midjourney v6) mimics these perfectly.

Look for these "Systematic Failures" of AI:
1. HYPER-Symmetry: Real faces are slightly asymmetrical. AI faces are often mathematically perfect.
2. HAIR TRANSITIONS: Look at the very edge where hair meets the background or forehead. AI often has "ghost pixels" or a slight blur/glow there.
3. IRIS TEXTURE: Zoom in on the pupils. AI often fails to render the complex, non-repeating patterns of a real human iris.
4. MICRO-HALLUCINATIONS: Check clothing buttons, collar stitching, and background textures for "logic breaks" (e.g., a button that doesn't align with a hole).
5. TEXTURE OVER-CONSISTENCY: If the skin texture is identical across the forehead, cheeks, and chin without any variance in oiliness or hydration, it is likely synthetic.

STATUS RULES:
- Classification: "Threat" = Evidence of AI artifacts found.
- Classification: "Caution" = The image looks "Ultra-Realistic" or "Studio-Style" and could be a perfectly rendered AI. Default to this if you are even 1% unsure.
- Classification: "Safe" = Only if you see CLEAR biological imperfections (scars, moles, uneven skin aging, natural hair flyaways) that are inconsistent with AI rendering.

Output JSON:
{
  "threatLevel": "Threat" | "Caution" | "Safe",
  "summary": "Forensic breakdown. Focus on WHY it might be AI. (e.g., 'Stylistic over-consistency and mathematical symmetry in iris pattern Suggests synthetic origin.')"
}`,
        responseMimeType: "application/json",
      },
      contents: [
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: base64Image.split(',')[1] || base64Image
          }
        },
        "PERFORM ADVERSARIAL SCAN: This is likely a deepfake. Find the flaws that prove it isn't a real biological human photograph. Scan hair edges and eye patterns."
      ]
    });

    const result = JSON.parse(response.text || "{}");
    return {
      threatLevel: (result.threatLevel as ThreatLevel) || ThreatLevel.CAUTION,
      summary: result.summary || "Visual analysis complete. Caution advised."
    };
  } catch (error) {
    console.error("Gemini Visual Analysis Error:", error);
    return { threatLevel: ThreatLevel.CAUTION, summary: "Visual analysis encountered an error. Classification defaulted to Caution for safety." };
  }
}

export async function analyzeMessageContent(content: string, sender: string): Promise<{ 
  threatLevel: ThreatLevel; 
  category: string;
  summary: string;
  status: string;
}> {
  try {
    if (!content || content.trim().length < 2) {
      return { threatLevel: ThreatLevel.SAFE, category: "Unknown", summary: "Insufficient data", status: "Verified" };
    }

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      config: {
        systemInstruction: `You are Aegis Message ID Engine. Zero-trust analysis for SMS/Text fraud.
Analyze for:
1. Money requests via Bank or ShopeePay/OVO/GoPay.
2. Suspicious links (bit.ly, tinyurl, or unofficial domains).
3. APK "Paket" or "Surat Penindakan" scams.
4. OTP phishing.

Status Codes:
- 'Transaction' or 'OTP': Valid banking/ecommerce.
- 'Fraud' or 'Suspicious': Scams (Mark as Threat).
- 'Verified': Legitimate business comms.

Output JSON:
{
  "threatLevel": "Threat" | "Caution" | "Safe",
  "category": "Banking" | "E-Commerce" | "OTP" | "Personal" | "Promotion" | "Scam",
  "summary": "Reasoning for classification",
  "status": "Verified" | "Suspicious" | "Fraud" | "Transaction" | "OTP" | "Promotion"
}`,
        responseMimeType: "application/json",
      },
      contents: `MANDATORY SMS SCAN: sender "${sender}", content "${content}"`,
    });

    const result = JSON.parse(response.text || "{}");
    return {
      threatLevel: (result.threatLevel as ThreatLevel) || ThreatLevel.SAFE,
      category: result.category || "General",
      summary: result.summary || "No indicators found.",
      status: result.status || "Verified"
    };
  } catch (error) {
    console.error("Gemini Message Analysis Error:", error);
    return { threatLevel: ThreatLevel.SAFE, category: "Error", summary: "Analysis failed", status: "Verified" };
  }
}

export async function analyzeRegistrySearch(query: string): Promise<{ 
  threatLevel: ThreatLevel; 
  summary: string;
  flags?: string[];
}> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      config: {
        systemInstruction: `You are Aegis "DeepSearch" Engine. Analyze numbers, URLs, or bank accounts for signs of scams.

PRECISION MANDATE:
1. Phone Numbers: Distinguish between personal mobile prefixes (e.g., +62 8xx) and short-codes/official business numbers. Do NOT misidentify personal numbers as "Bank Numbers" or "Institutional" lines unless clearly documented as such.
2. If it is a personal number with no known fraud records, classify it as "Caution" (Unknown Number) or "Safe" (Standard Mobile), and state "Likely a standard mobile subscriber" in the summary.
3. URLs & Bank Accounts: Continue high-vigilance for typosquatting and fraud patterns.

Output JSON:
{
  "threatLevel": "Threat" | "Caution" | "Safe",
  "summary": "Precise forensic breakdown. If it is a standard mobile number, clearly state that it is a personal mobile subscriber.",
  "flags": ["String short red flags like 'Mismatched domain', 'VoIP Pattern'"]
}`,
        responseMimeType: "application/json",
      },
      contents: `Perform high-priority security audit on this entity: "${query}"`,
    });

    const result = JSON.parse(response.text || "{}");
    return {
      threatLevel: (result.threatLevel as ThreatLevel) || ThreatLevel.SAFE,
      summary: result.summary || "No immediate threats identified.",
      flags: result.flags || []
    };
  } catch (error) {
    console.error("Gemini Registry Error:", error);
    return { threatLevel: ThreatLevel.SAFE, summary: "Database connection intermittent." };
  }
}

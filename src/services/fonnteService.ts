/**
 * Fonnte SMS/WhatsApp Gateway Service
 * API Documentation: https://docs.fonnte.com/
 */

const FONNTE_API_TOKEN = (import.meta as any).env.VITE_FONNTE_API_TOKEN || (import.meta as any).env.VITE_FONNTE_TOKEN;
const FONNTE_DEVICE_ID = (import.meta as any).env.VITE_FONNTE_DEVICE_ID;

/**
 * Clean phone number to digits only and ensure international format for Indonesia (62).
 * Fonnte expects numbers without '+' or spaces.
 */
function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  
  // If number starts with 0 (e.g. 0812...), convert to 62812...
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.substring(1);
  }
  
  // If it starts with 812... without 0 or 62, prepend 62
  if (cleaned.startsWith('8') && cleaned.length >= 9 && cleaned.length <= 13) {
    cleaned = '62' + cleaned;
  }
  
  return cleaned;
}

export async function sendAlertToFamily(
  phoneNumber: string, 
  personName: string, 
  source: 'CALL' | 'SMS' | 'REGISTRY' | 'MANUAL',
  detail: string,
  targetValue?: string
) {
  let message = '';
  
  switch(source) {
    case 'CALL':
      message = `[AEGIS SHIELD] 🚨 CALL ALERT: ${personName} is being contacted by a suspicious number (${targetValue}). Analysis: "${detail}". Please check if they are okay.`;
      break;
    case 'SMS':
      message = `[AEGIS SHIELD] 📩 SMS ALERT: ${personName} received a fraudulent message from ${targetValue}. AI Summary: ${detail}. Advise them NOT to click any links.`;
      break;
    case 'REGISTRY':
      message = `[AEGIS SEARCH] 🔍 REGISTRY ALERT: ${personName} just searched for "${targetValue}" in our database. Aegis flagged it as a THREAT because: ${detail}. The user has been warned.`;
      break;
    case 'MANUAL':
    default:
      message = `[AEGIS EMERGENCY] ⚡ IMMEDIATE ACTION REQUIRED: ${personName} has manually triggered their Aegis Emergency Beacon. Contact them immediately!`;
      break;
  }
  
  const target = normalizePhone(phoneNumber);
  console.log(`[Fonnte] Attempting to send alert to: ${target} (original: ${phoneNumber})`);

  if (!FONNTE_API_TOKEN || FONNTE_API_TOKEN === "MY_FONNTE_TOKEN") {
    console.error("[Fonnte] API Token is missing or placeholder. Please set VITE_FONNTE_API_TOKEN in Secrets.");
    return { status: false, reason: "API Token Missing" };
  }

  try {
    const formData = new FormData();
    formData.append("target", target);
    formData.append("message", message);
    formData.append("countryCode", "62"); // Indonesia default
    if (FONNTE_DEVICE_ID) {
      formData.append("device", FONNTE_DEVICE_ID);
    }

    const response = await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: {
        "Authorization": FONNTE_API_TOKEN.trim()
      },
      body: formData
    });

    const result = await response.json();
    console.log("[Fonnte] API Response:", result);
    
    if (result.status === true) {
      return result;
    } else {
      console.warn("[Fonnte] Message failed to send:", result.reason || "Unknown reason");
      return { status: false, reason: result.reason || "Fonnte rejected request" };
    }
  } catch (error) {
    console.error("[Fonnte] Network Error:", error);
    return { status: false, reason: "Network Error" };
  }
}

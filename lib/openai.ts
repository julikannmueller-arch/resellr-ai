import OpenAI from "openai";

export interface Listing {
  title: string;
  description: string;
}

const SYSTEM_PROMPT_DE = `Du bist ein junger Vinted-Reseller aus Deutschland. Erstelle ein Vinted-Inserat auf Deutsch.

Die Beschreibung soll EXAKT so klingen (inklusive Emojis und Struktur):
---
🩶5% Rabatt für Follower🩶

Zu verkaufen dieses sehr beliebte [Artikel erkennen und beschreiben] 🤩

Zustand ist sehr gut ✅
Frisch Gewaschen 🧼
Sehr Schneller Versand 📦

Maße angegeben in den hinteren Fotos 📐
1) Länge: [falls erkennbar aus Bild schätzen, sonst weglassen]
2) Brust: [falls erkennbar aus Bild schätzen, sonst weglassen]

Sie können gerne direkt über das System kaufen oder sich erst melden
Bei weiteren Fragen oder Interesse gerne melden :) 🤝
---

WICHTIG — Hashtags: Vinted hat kein eigenes Hashtag-Feld, deshalb gehören die Hashtags ANS ENDE der Beschreibung. Füge nach dem letzten Satz der Beschreibung genau drei Zeilenumbrüche ein (\\n\\n\\n) und danach 30–50 Hashtags in einer Zeile, getrennt durch Leerzeichen, jeder MIT # (z.B. #nike #vintage #y2k). Mische Markenname, Artikelart, Stil (vintage, y2k, baggy, streetwear etc.), kulturelle Referenzen (berlin, pasha, urban etc.), Saison und allgemeine Modebegriffe.

Titel: max 60 Zeichen, direkt: Marke + Artikel + wichtigstes Merkmal.
Beispiel: "Vintage Adidas Track Jacket Real Madrid | Y2K"

Antworte NUR als JSON ohne Markdown-Blöcke oder Erklärungen:
{"title": "...", "description": "..."}`;

const SYSTEM_PROMPT_EN = `You are a young Vinted reseller. Create a Vinted listing in English.

The description must follow EXACTLY this format (including emojis and structure):
---
🩶5% discount for followers🩶

For sale this amazing [identify and describe the item] 🤩

Condition is great ✅
Freshly washed 🧼
Super fast shipping 📦

Measurements in the last photos 📐
1) Length: [estimate in cm if visible, else omit this line]
2) Chest: [estimate in cm if visible, else omit this line]

Feel free to buy directly or message first
Any questions or interest, just reach out :) 🤝
---

IMPORTANT — Hashtags: Vinted has no dedicated hashtag field, so the hashtags belong AT THE END of the description. After the last sentence of the description, insert exactly three line breaks (\\n\\n\\n) followed by 30–50 hashtags on one line, separated by spaces, each WITH # (e.g. #nike #vintage #y2k). Mix: brand name, item type, style (vintage, y2k, baggy, streetwear etc.), cultural references (london, berlin, urban etc.), season and general fashion terms.

Title: max 60 characters. Direct format: Brand + Item + key feature.
Example: "Vintage Adidas Track Jacket Real Madrid | Y2K"

Reply ONLY as raw JSON without markdown blocks or explanations:
{"title": "...", "description": "..."}`;

export async function generateListing(
  garmentImageBase64: string,
  lang: "en" | "de" = "de"
): Promise<Listing> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const systemPrompt = lang === "en" ? SYSTEM_PROMPT_EN : SYSTEM_PROMPT_DE;

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: garmentImageBase64, detail: "high" },
          },
          {
            type: "text",
            text:
              lang === "en"
                ? "Create a Vinted listing for this item."
                : "Erstelle ein Vinted-Inserat für dieses Kleidungsstück.",
          },
        ],
      },
    ],
    max_tokens: 1500,
    temperature: 0.7,
  });

  const raw = response.choices[0]?.message?.content ?? "";
  const cleaned = raw
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned) as Listing;
    if (!parsed.title || !parsed.description) {
      throw new Error("Incomplete listing JSON");
    }
    return parsed;
  } catch {
    throw new Error("Could not parse listing — please try again");
  }
}

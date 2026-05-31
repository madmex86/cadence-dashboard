'use server'

export async function parseEtsyEmail(emailText, availableCreatures) {
  if (!emailText) return { error: "No text provided" };

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return { error: "ANTHROPIC_API_KEY not configured" };

    const prompt = `
You are an expert at parsing Etsy order confirmation emails.
I will provide you with the raw text of an Etsy order confirmation email, along with a list of available creature names from my inventory.
Extract the following information from the email text and return it as a pure JSON object:
- etsy_order_id: The Etsy order number (string, e.g. "2345678901"). Try to find phrases like "Order #" or "Order number".
- buyer_name: The name of the buyer (string). Look for "Hi [Name]" or shipping details.
- items: An array of objects, where each object has:
    - name: The matched creature name from the available creatures list (string). Use your best judgment to match the purchased item to the exact creature name provided in the list.
    - qty: The quantity purchased for this item (number).

Note: Do NOT extract the total amount or shipping fees. The user will enter the final revenue manually.

Available Creatures List:
${availableCreatures.join(", ")}

Email Text:
"""
${emailText}
"""

CRITICAL: Return ONLY a valid JSON object. No preamble, no markdown formatting (like \`\`\`json), no explanations.
Shape: { "etsy_order_id": "string", "buyer_name": "string", "items": [{ "name": "string", "qty": 1 }] }
`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { error: `Claude API error (${res.status}): ${err.error?.message || res.statusText}` };
    }

    const data = await res.json();
    const raw = data.content[0].text.trim().replace(/```json|```/g, '');
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return { error: 'Claude returned no JSON' };
    
    return { data: JSON.parse(match[0]) };
  } catch (err) {
    console.error("parseEtsyEmail error:", err);
    return { error: String(err) };
  }
}

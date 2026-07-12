import { NextRequest, NextResponse } from 'next/server'

const FALLBACK_CAPTION = 'A moment worth remembering ✨'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { type = 'caption', context = '' } = body

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      console.warn('ANTHROPIC_API_KEY not set — set it in .env to enable AI captions')
      return NextResponse.json({ caption: FALLBACK_CAPTION })
    }

    let systemPrompt = ''
    let prompt = ''

    if (type === 'caption') {
      systemPrompt =
        'You are a poetic, warm caption writer for a photobooth memory app. Write short, emotional, heartfelt captions in 1-2 sentences. Include an emoji sometimes. Be creative and varied. Reply with ONLY the caption text, nothing else.'
      prompt = `Write a unique, heartfelt caption for a photo booth memory. ${
        context ? `Context: ${context}` : 'The photo captures a moment between people connecting through distance.'
      }`
    } else if (type === 'memory-card') {
      systemPrompt =
        'You are a creative memory card message writer. Write warm, nostalgic messages that feel like a personal postcard. Reply with ONLY the message text, nothing else.'
      prompt = `Write a short memory card message for a photobooth session. ${
        context ? `Context: ${context}` : ''
      } Keep it 2-3 sentences, warm and nostalgic.`
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 200,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status} ${await response.text()}`)
    }

    const data = await response.json()
    const result = data.content?.find((block: any) => block.type === 'text')?.text

    return NextResponse.json({ caption: result?.trim() || FALLBACK_CAPTION })
  } catch (error) {
    console.error('AI caption error:', error)
    return NextResponse.json({ caption: FALLBACK_CAPTION })
  }
}

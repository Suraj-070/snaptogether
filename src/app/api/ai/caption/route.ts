import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { type = 'caption', context = '' } = body

    const zai = await ZAI.create()

    let prompt = ''
    let systemPrompt = ''

    if (type === 'caption') {
      systemPrompt = 'You are a poetic, warm caption writer for a photobooth memory app. Write short, emotional, heartfelt captions in 1-2 sentences. Include an emoji sometimes. Be creative and varied.'
      prompt = `Write a unique, heartfelt caption for a photo booth memory. ${context ? `Context: ${context}` : 'The photo captures a moment between people connecting through distance.'} Just return the caption text, nothing else.`
    } else if (type === 'memory-card') {
      systemPrompt = 'You are a creative memory card message writer. Write warm, nostalgic messages that feel like a personal postcard.'
      prompt = `Write a short memory card message for a photobooth session. ${context ? `Context: ${context}` : ''} Keep it 2-3 sentences, warm and nostalgic. Just return the message text.`
    }

    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      thinking: { type: 'disabled' },
    })

    const result = completion.choices[0]?.message?.content
    return NextResponse.json({ caption: result?.trim() || 'A moment worth remembering ✨' })
  } catch (error) {
    console.error('AI caption error:', error)
    return NextResponse.json({ caption: 'A moment worth remembering ✨' })
  }
}
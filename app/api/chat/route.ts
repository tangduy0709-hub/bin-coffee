const QWENPAW_URL = process.env.QWENPAW_URL || 'http://localhost:8088'
const AGENT_ID = process.env.QWENPAW_AGENT_ID || 'default'

export const maxDuration = 60

export async function POST(req: Request) {
  const { message, session_id } = await req.json()

  const qwenpawRes = await fetch(`${QWENPAW_URL}/api/console/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Agent-Id': AGENT_ID,
    },
    body: JSON.stringify({
      input: [{
        role: 'user',
        content: [{ type: 'text', text: message }],
      }],
      session_id: session_id || `coffee-${Date.now()}`,
      channel: 'coffee-shop',
    }),
  })

  if (!qwenpawRes.ok) {
    const errorText = await qwenpawRes.text()
    return new Response(
      `data: ${JSON.stringify({ error: { message: `QwenPaw error: ${errorText}` } })}\n\n`,
      {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
      },
    )
  }

  return new Response(qwenpawRes.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}

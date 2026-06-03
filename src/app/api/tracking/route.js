import { NextResponse } from 'next/server'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const carrier = (searchParams.get('carrier') || 'usps').toLowerCase()
  const tracking_number = searchParams.get('tracking_number')

  if (!tracking_number) {
    return NextResponse.json({ error: 'Missing tracking_number' }, { status: 400 })
  }

  const apiKey = process.env.SHIPPO_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'SHIPPO_API_KEY not configured' }, { status: 500 })
  }

  const res = await fetch(`https://api.goshippo.com/tracks/${carrier}/${tracking_number}`, {
    headers: {
      Authorization: `ShippoToken ${apiKey}`,
      'Content-Type': 'application/json',
    },
    next: { revalidate: 300 }, // cache 5 min — carriers don't update more often
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    return NextResponse.json({ error: err.detail ?? `Shippo error ${res.status}` }, { status: res.status })
  }

  const data = await res.json()
  return NextResponse.json(data)
}

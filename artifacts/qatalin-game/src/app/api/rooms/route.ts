import { NextResponse } from 'next/server'
import { db, gamePlayers, gameRooms } from '@workspace/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function roomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const displayName = String(body?.displayName ?? '').trim()
    const teamName = String(body?.teamName ?? '').trim()

    if (!displayName || !teamName) {
      return NextResponse.json({ message: 'اسم اللاعب والفريق مطلوبان' }, { status: 400 })
    }

    const [room] = await db.insert(gameRooms).values({ code: roomCode() }).returning()
    const [player] = await db.insert(gamePlayers).values({
      roomId: room.id,
      displayName,
      teamName,
    }).returning()

    return NextResponse.json({ roomCode: room.code, playerId: player.id }, { status: 201 })
  } catch (error) {
    console.error('[v0] [rooms] create failed', error)
    return NextResponse.json({ message: 'تعذر إنشاء الغرفة. تأكد من اتصال قاعدة البيانات.', debug: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}

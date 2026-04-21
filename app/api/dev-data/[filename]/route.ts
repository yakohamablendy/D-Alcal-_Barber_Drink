import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"

const DEV_DATA_DIR = path.join(process.cwd(), "dev-data")

function getFilePath(filename: string): string | null {
  const safe = filename.replace(/[^a-zA-Z0-9_-]/g, "")
  const filePath = path.join(DEV_DATA_DIR, `${safe}.json`)
  if (!filePath.startsWith(DEV_DATA_DIR)) return null
  return filePath
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params
  const filePath = getFilePath(filename)
  if (!filePath) return NextResponse.json({ error: "Invalid filename" }, { status: 400 })

  try {
    const data = fs.readFileSync(filePath, "utf-8")
    return NextResponse.json(JSON.parse(data))
  } catch {
    return NextResponse.json([], { status: 200 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params
  const filePath = getFilePath(filename)
  if (!filePath) return NextResponse.json({ error: "Invalid filename" }, { status: 400 })

  try {
    const body = await request.json()
    fs.writeFileSync(filePath, JSON.stringify(body, null, 2), "utf-8")
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Write failed" }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params
  const filePath = getFilePath(filename)
  if (!filePath) return NextResponse.json({ error: "Invalid filename" }, { status: 400 })

  try {
    const body = await request.json()
    let existing: unknown[] = []
    try { existing = JSON.parse(fs.readFileSync(filePath, "utf-8")) } catch { /* empty */ }
    if (!Array.isArray(existing)) existing = []

    if (body.action === "push" && body.data) {
      existing.unshift(body.data)
    }

    fs.writeFileSync(filePath, JSON.stringify(existing, null, 2), "utf-8")
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Patch failed" }, { status: 500 })
  }
}

import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { meetings } from "../../../db/schema";

type MeetingPayload = {
  id?: string;
  name?: string;
  status?: string;
  snapshot?: Record<string, unknown>;
  updatedAt?: string;
};

function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Не удалось обратиться к базе";
  if (message.includes("no such table")) return "Локальная таблица ещё не создана. Выполните npm run db:migrate:local.";
  return message;
}

export async function GET(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get("id");
    const db = getDb();
    if (id) {
      const [meeting] = await db.select().from(meetings).where(eq(meetings.id, id)).limit(1);
      return meeting ? Response.json({ meeting }) : Response.json({ error: "Встреча не найдена" }, { status: 404 });
    }
    const rows = await db.select().from(meetings).orderBy(desc(meetings.updatedAt)).limit(20);
    return Response.json({ meetings: rows });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as MeetingPayload;
    const id = payload.id?.trim();
    const name = payload.name?.trim();
    if (!id || !name || !payload.snapshot) return Response.json({ error: "id, name и snapshot обязательны" }, { status: 400 });

    const now = payload.updatedAt || new Date().toISOString();
    const values = { id, name, status: payload.status || "draft", snapshot: payload.snapshot, updatedAt: now };
    const db = getDb();
    const [meeting] = await db.insert(meetings).values(values).onConflictDoUpdate({
      target: meetings.id,
      set: { name: values.name, status: values.status, snapshot: values.snapshot, updatedAt: values.updatedAt },
    }).returning();
    return Response.json({ meeting }, { status: 201 });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

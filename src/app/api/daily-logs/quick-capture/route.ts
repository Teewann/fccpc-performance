// src/app/api/daily-logs/quick-capture/route.ts
// AI-powered quick capture â€” parses natural language log entries.
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { text } = await request.json();
    if (!text || typeof text !== 'string') return NextResponse.json({ error: 'Text required' }, { status: 400 });

    // Parse the natural language text into structured log fields
    const parsed = parseLogText(text);
    return NextResponse.json({ parsed });
  } catch (error) {
    console.error('[quick-capture]', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

function parseLogText(text: string) {
  const lower = text.toLowerCase();

  // Extract time patterns like "9am-11am", "09:00 to 11:00"
  const timePattern = /(\d{1,2}(?::\d{2})?(?:am|pm)?)\s*(?:to|-|â€“)\s*(\d{1,2}(?::\d{2})?(?:am|pm)?)/i;
  const timeMatch = text.match(timePattern);

  // Detect task type keywords
  let taskType = 'GENERAL';
  if (/meeting|conference|briefing|presentation/i.test(lower)) taskType = 'MEETING';
  else if (/report|document|writing|draft/i.test(lower)) taskType = 'REPORT';
  else if (/review|audit|inspect/i.test(lower)) taskType = 'REVIEW';
  else if (/training|workshop|seminar/i.test(lower)) taskType = 'TRAINING';
  else if (/field|site|visit|external/i.test(lower)) taskType = 'FIELD_WORK';

  return {
    description: text.trim(),
    taskType,
    startTime: timeMatch ? normaliseTime(timeMatch[1]) : null,
    endTime:   timeMatch ? normaliseTime(timeMatch[2]) : null,
  };
}

function normaliseTime(t: string): string {
  const clean = t.toLowerCase().replace(/\s/g, '');
  const isPM  = clean.includes('pm');
  const isAM  = clean.includes('am');
  const digits = clean.replace(/[^0-9:]/g, '');
  const [h, m = '00'] = digits.includes(':') ? digits.split(':') : [digits, '00'];
  let hour = parseInt(h, 10);
  if (isPM && hour < 12) hour += 12;
  if (isAM && hour === 12) hour = 0;
  return `${String(hour).padStart(2, '0')}:${m}`;
}


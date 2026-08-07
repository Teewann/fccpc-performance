import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = body;

    // For now, just return success (you can add real OTP logic later)
    return NextResponse.json({ 
      success: true, 
      message: 'OTP sent successfully',
      email: email 
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to send OTP' },
      { status: 500 }
    );
  }
} 
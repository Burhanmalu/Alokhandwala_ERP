import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db/store';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const role = searchParams.get('role');

    let users = dbStore.getUsers().filter(u => u.isActive);
    if (role) {
      users = users.filter(u => u.role === role);
    }

    return NextResponse.json({
      success: true,
      data: users,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const newUser = await dbStore.transaction((state) => {
      const user = {
        id: `usr-${Date.now()}`,
        email: body.email,
        fullName: body.fullName,
        phone: body.phone,
        role: body.role || 'SUPERVISOR',
        password: body.password || 'demo2026',
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      state.users.push(user);
      return user;
    });

    return NextResponse.json({
      success: true,
      data: newUser,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, role, fullName, email, phone, password, isActive } = body;
    if (!id) {
      return NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 });
    }

    const updatedUser = await dbStore.transaction((state) => {
      const user = state.users.find(u => u.id === id);
      if (!user) {
        throw new Error(`User with ID ${id} not found`);
      }
      if (role !== undefined) user.role = role;
      if (fullName !== undefined) user.fullName = fullName;
      if (email !== undefined) user.email = email;
      if (phone !== undefined) user.phone = phone;
      if (password !== undefined) user.password = password;
      if (isActive !== undefined) user.isActive = isActive;
      return user;
    });

    return NextResponse.json({
      success: true,
      data: updatedUser,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

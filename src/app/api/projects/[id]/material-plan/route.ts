import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db/store';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const project = dbStore.getProjects().find(p => p.id === id);
    if (!project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        projectId: project.id,
        projectCode: project.projectCode,
        status: project.status,
        siteDimensions: project.siteDimensions || project.measurements,
        scaffoldingPlan: project.scaffoldingPlan || null,
        materials: project.materials || [],
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const result = await dbStore.transaction((state) => {
      const project = state.projects.find(p => p.id === id);
      if (!project) throw new Error('Project not found');

      if (body.scaffoldingPlan) {
        project.scaffoldingPlan = body.scaffoldingPlan;
      }
      if (body.siteDimensions) {
        project.siteDimensions = body.siteDimensions;
      }
      project.updatedAt = new Date().toISOString();
      return project;
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}

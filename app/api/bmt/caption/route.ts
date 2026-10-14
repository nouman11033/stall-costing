import { randomUUID } from 'crypto';
import { execFile } from 'child_process';
import { existsSync } from 'fs';
import { promisify } from 'util';
import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import path from 'path';

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const execFileAsync = promisify(execFile);

/** Prefer explicit env; else common local conda env so `npm run dev` is not stuck on bare `python3` without torch. */
function resolveBmtPython(): string {
  const fromEnv = process.env.BMT_PYTHON?.trim() || process.env.PYTHON?.trim();
  if (fromEnv) return fromEnv;

  const home = process.env.HOME || process.env.USERPROFILE || '';
  const fallbacks = [
    path.join(home, 'anaconda3', 'envs', 'bmt_mps', 'bin', 'python'),
    path.join(home, 'miniconda3', 'envs', 'bmt_mps', 'bin', 'python'),
    path.join(home, 'mambaforge', 'envs', 'bmt_mps', 'bin', 'python'),
    path.join(home, 'micromamba', 'envs', 'bmt_mps', 'bin', 'python'),
  ];
  for (const p of fallbacks) {
    if (p && existsSync(p)) return p;
  }
  return process.platform === 'win32' ? 'python' : 'python3';
}

export async function POST(request: Request) {
  const workdir = path.join(process.cwd(), '.bmt-tmp', randomUUID());
  try {
    const form = await request.formData();
    const file = form.get('video');
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ ok: false, error: 'Expected form field "video" (Blob).' }, { status: 400 });
    }

    const projectRoot = process.cwd();
    const bmtRoot = path.join(projectRoot, 'BMT');
    const scriptPath = path.join(bmtRoot, 'scripts', 'live_clip_caption.py');
    await mkdir(workdir, { recursive: true });

    const buf = Buffer.from(await file.arrayBuffer());
    const uploadPath = path.join(workdir, 'upload.bin');
    await writeFile(uploadPath, buf);

    const python = resolveBmtPython();
    const explicitPython = process.env.BMT_PYTHON?.trim() || process.env.PYTHON?.trim();
    const systemDefault = process.platform === 'win32' ? 'python' : 'python3';
    if (!explicitPython && python === systemDefault) {
      console.warn(
        '[api/bmt/caption] BMT_PYTHON unset and no local conda fallback found; using',
        python,
        '(set BMT_PYTHON in .env.local)'
      );
    }

    const args = [
      scriptPath,
      '--bmt-root',
      bmtRoot,
      '--workdir',
      workdir,
      '--upload',
      uploadPath,
      '--device',
      (form.get('device') as string) || 'auto',
      '--max-prop',
      String(Number(form.get('maxProp')) || 5),
    ];

    const env = { ...process.env };
    // Same interpreter as the main job unless user overrides (I3D subprocess reads this).
    if (!env.BMT_FEATURE_PYTHON?.trim()) {
      env.BMT_FEATURE_PYTHON = python;
    }

    try {
      await execFileAsync(python, args, {
        cwd: projectRoot,
        env,
        timeout: 540_000,
        maxBuffer: 32 * 1024 * 1024,
      });
    } catch (execErr) {
      const resultPath = path.join(workdir, 'result.json');
      try {
        const raw = await readFile(resultPath, 'utf-8');
        const parsed = JSON.parse(raw) as { ok?: boolean; error?: string; detail?: string };
        if (parsed.error) {
          console.error('[api/bmt/caption]', parsed.error, parsed.detail ?? '');
          return NextResponse.json(
            { ok: false, error: parsed.error, detail: parsed.detail },
            { status: 502 }
          );
        }
      } catch {
        /* fall through */
      }
      const detail =
        execErr instanceof Error && 'stderr' in execErr
          ? String((execErr as NodeJS.ErrnoException & { stderr?: string }).stderr ?? execErr.message)
          : execErr instanceof Error
            ? execErr.message
            : String(execErr);
      console.error('[api/bmt/caption] exec failed (no usable result.json):', detail);
      return NextResponse.json({ ok: false, error: 'Python pipeline failed', detail }, { status: 500 });
    }

    const resultPath = path.join(workdir, 'result.json');
    const raw = await readFile(resultPath, 'utf-8');
    const parsed = JSON.parse(raw) as {
      ok?: boolean;
      error?: string;
      detail?: string;
      captions?: unknown;
      durationSec?: number;
    };

    if (!parsed.ok) {
      console.error('[api/bmt/caption]', parsed.error ?? 'BMT failed', parsed.detail ?? '');
      return NextResponse.json(
        { ok: false, error: parsed.error ?? 'BMT failed', detail: parsed.detail },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      durationSec: parsed.durationSec,
      captions: parsed.captions ?? [],
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: 'Request error', detail: message }, { status: 500 });
  } finally {
    try {
      await rm(workdir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

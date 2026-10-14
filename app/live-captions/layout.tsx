import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Live webcam captions',
  description:
    'Webcam preview with typed captions, speech captions, or optional BMT server captioning (I3D + VGGish + checkpoints).',
};

export default function LiveCaptionsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}

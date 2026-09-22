import { ImageResponse } from 'next/og';
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';
export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        color: '#f8f7f2',
        background: '#536e62',
        fontSize: 112,
        fontWeight: 600,
      }}
    >
      m
    </div>,
    size,
  );
}

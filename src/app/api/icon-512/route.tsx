import { ImageResponse } from "next/og";

export const dynamic = "force-static";

/** Real PWA icon, generated in code (no binary asset to hand-craft) — used by the manifest for install/share-target purposes. */
export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a1128",
          borderRadius: 96,
        }}
      >
        <svg width="280" height="280" viewBox="0 0 24 24" fill="none" stroke="#4d84ff" strokeWidth="1.8">
          <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
          <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
          <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
        </svg>
      </div>
    ),
    { width: 512, height: 512 }
  );
}

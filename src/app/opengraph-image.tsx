import { ImageResponse } from "next/og";

export const alt = "Quantara AI-assisted BOQ workflow software";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const runtime = "edge";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "linear-gradient(135deg, #030508 0%, #08152e 58%, #0077b6 100%)",
          color: "white",
          display: "flex",
          height: "100%",
          justifyContent: "center",
          padding: "72px",
          width: "100%",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", maxWidth: "1020px" }}>
          <div style={{ color: "#21c7f3", display: "flex", fontSize: 30, fontWeight: 700, letterSpacing: 5 }}>
            QUANTARA
          </div>
          <div style={{ display: "flex", fontSize: 68, fontWeight: 750, lineHeight: 1.08, marginTop: 28 }}>
            AI-assisted BOQ workflow software
          </div>
          <div style={{ color: "#d5e0ec", display: "flex", fontSize: 31, lineHeight: 1.35, marginTop: 30 }}>
            Supported project sources to reviewed calculations, BOQ records, validation and professional outputs.
          </div>
          <div style={{ color: "#b8c4d8", display: "flex", fontSize: 22, marginTop: 38 }}>
            Professional judgement remains required.
          </div>
        </div>
      </div>
    ),
    size,
  );
}

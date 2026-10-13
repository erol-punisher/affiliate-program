import { NextRequest, NextResponse } from "next/server";
import { getSessionWithFreshToken } from "@/lib/auth";
import { generateContractDocx, validateContractFields } from "@/lib/contractTemplate";

export async function POST(request: NextRequest) {
  const session = await getSessionWithFreshToken();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const result = validateContractFields(body);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  let docxBuffer: Buffer;
  try {
    docxBuffer = await generateContractDocx(result.fields);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate contract" },
      { status: 500 },
    );
  }

  const safeName = result.fields.talentName.replace(/[^\w\- ]/g, "").trim().replace(/\s+/g, "_") || "Affiliate";
  const filename = `${safeName}_Releasit_Affiliate_Contract.docx`;

  return new NextResponse(new Uint8Array(docxBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

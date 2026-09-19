import { redirect } from "next/navigation";
import Link from "next/link";
import { MessageSquareOff, PenLine, Sparkles } from "lucide-react";
import { getAuthSession } from "@/lib/auth/auth";
import { getDashboardData } from "@/lib/services/dashboardService";
import { DashboardStoreScope } from "@/components/dashboard/DashboardStoreScope";
import { AssistantCapture } from "@/components/assistant/AssistantCapture";
import { Card } from "@/components/ui/Card";
import type { AssistantApiResult } from "@/hooks/useCaptureFlow";

export const dynamic = "force-dynamic";

function decodeBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf-8");
}

export default async function ShareReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ data?: string; text?: string; empty?: string }>;
}) {
  const session = await getAuthSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");

  const params = await searchParams;
  const data = getDashboardData(userId);

  if (params.empty || !params.data) {
    return <EmptySharePanel reason="empty" />;
  }

  let result: AssistantApiResult;
  let rawText: string;
  try {
    result = JSON.parse(decodeBase64Url(params.data));
    rawText = params.text ? decodeBase64Url(params.text) : "";
  } catch {
    return <EmptySharePanel reason="decode-error" />;
  }

  if (result.kind !== "transaction") {
    // A shared bank SMS should always be about a transaction — if the
    // classifier came back with a question-answer or "unclear", that means
    // the shared text plainly isn't transaction data (a promo SMS, an OTP,
    // a forwarded message). Show a dedicated, friendly message rather than
    // surfacing it as an odd Q&A reply.
    return <EmptySharePanel reason="not-a-transaction" rawText={rawText} />;
  }

  return (
    <DashboardStoreScope data={await data}>
      <div className="max-w-2xl mx-auto space-y-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Sparkles size={20} className="text-ai" /> Shared transaction
          </h1>
          <p className="text-sm text-muted mt-1">Review what we understood before it&rsquo;s saved.</p>
        </div>
        <div className="h-[calc(100vh-14rem)] min-h-[420px]">
          <AssistantCapture initialExternal={{ result, rawText }} />
        </div>
      </div>
    </DashboardStoreScope>
  );
}

function EmptySharePanel({ reason, rawText }: { reason: "empty" | "decode-error" | "not-a-transaction"; rawText?: string }) {
  const message =
    reason === "not-a-transaction"
      ? "This doesn't look like a transaction — want to enter it manually instead?"
      : "We didn't receive any text to work with — try sharing again, or enter the transaction manually.";

  return (
    <div className="max-w-md mx-auto pt-16 text-center space-y-5">
      <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-ai-soft text-ai mx-auto">
        <MessageSquareOff size={24} />
      </span>
      <div>
        <p className="text-base font-medium">{message}</p>
        {rawText && (
          <Card className="mt-4 p-3.5 text-left">
            <p className="text-xs text-muted mb-1">What we received:</p>
            <p className="text-sm italic text-muted break-words">&ldquo;{rawText}&rdquo;</p>
          </Card>
        )}
      </div>
      <div className="flex items-center justify-center gap-3">
        <Link href="/add-transaction" className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
          <PenLine size={14} /> Enter manually
        </Link>
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-ai hover:underline">
          <Sparkles size={14} /> Try typing it instead
        </Link>
      </div>
    </div>
  );
}

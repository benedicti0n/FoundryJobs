"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { submitApproval, updateGeneratedPostText, type ApprovalDecision } from "@/lib/api";

const APPROVAL_QUEUE_PATH = "/approval-queue";

function redirectWithMessage(params: { message?: string; error?: string }): never {
  const search = new URLSearchParams();
  if (params.message) {
    search.set("message", params.message);
  }
  if (params.error) {
    search.set("error", params.error);
  }
  redirect(`${APPROVAL_QUEUE_PATH}?${search.toString()}`);
}

function decisionFromIntent(intent: string): ApprovalDecision | null {
  if (intent === "approve") {
    return "approved";
  }
  if (intent === "reject") {
    return "rejected";
  }
  if (intent === "needs_edit") {
    return "needs_edit";
  }
  return null;
}

export async function approvalQueueAction(formData: FormData): Promise<void> {
  const generatedPostId = String(formData.get("generatedPostId") ?? "").trim();
  const intent = String(formData.get("intent") ?? "").trim();
  const textContent = String(formData.get("textContent") ?? "").trim();

  if (generatedPostId.length === 0) {
    redirectWithMessage({ error: "Missing generated post id" });
  }

  let outcome: { message?: string; error?: string };
  try {
    if (intent === "save") {
      if (textContent.length === 0) {
        outcome = { error: "Draft text cannot be empty" };
      } else {
        await updateGeneratedPostText(generatedPostId, textContent);
        outcome = { message: "Draft text saved" };
      }
    } else {
      const decision = decisionFromIntent(intent);
      if (!decision) {
        outcome = { error: "Unknown approval action" };
      } else {
        await submitApproval(generatedPostId, {
          decision,
          decidedBy: "dashboard",
          ...(decision === "needs_edit" ? { notes: "Marked from dashboard" } : {}),
          ...(textContent.length > 0 ? { textContent } : {}),
        });
        outcome = { message: `Decision recorded: ${decision}` };
      }
    }
  } catch (error) {
    outcome = { error: error instanceof Error ? error.message : "Approval action failed" };
  }

  revalidatePath(APPROVAL_QUEUE_PATH);
  redirectWithMessage(outcome);
}

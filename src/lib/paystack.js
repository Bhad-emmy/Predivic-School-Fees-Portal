import { supabase } from "./supabase";

export async function createParentPaymentLink(studentFeeAccountId, expiresInHours = 72) {
  const { data, error } = await supabase.functions.invoke("paystack-links", {
    body: {
      studentFeeAccountId,
      expiresInHours,
    },
  });

  if (error) {
    throw new Error(error.message || "Unable to create payment link.");
  }

  if (!data?.url) {
    throw new Error(data?.error || "Payment link was not returned.");
  }

  return data;
}

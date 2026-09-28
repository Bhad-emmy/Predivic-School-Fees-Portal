-- Keep the Paystack settlement finalizer internal to the service role.
revoke execute on function public.finalize_paystack_payment(text,bigint,bigint,text,text,text,text,timestamptz) from public;
revoke execute on function public.finalize_paystack_payment(text,bigint,bigint,text,text,text,text,timestamptz) from anon;
revoke execute on function public.finalize_paystack_payment(text,bigint,bigint,text,text,text,text,timestamptz) from authenticated;
grant execute on function public.finalize_paystack_payment(text,bigint,bigint,text,text,text,text,timestamptz) to service_role;

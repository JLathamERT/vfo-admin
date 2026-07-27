// Mirrors supabase/functions/vfo-admin-api/constants/confirmation-status.ts.
//
// Card buyers get the invoice/receipt email and no separate payment-confirmation
// email, so the webhook parks confirmation_status / retainer_confirmation_status on
// this terminal value instead of "Confirmation Needed". Panels read it as resolved,
// not pending. Rows paid by card BEFORE this change still carry "Sent" and keep
// rendering as sent — which is why this matches on the marker, not on the method.
export const CONFIRMATION_CARD_SKIP = 'Skipped - Card (Receipt Only)'

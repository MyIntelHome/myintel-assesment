// This release uses a Worker, D1, R2 and Sites-authenticated identity.
// A successful static Next build alone would silently omit all account APIs.
console.error("Vercel release blocked: this branch's account, request and photo APIs run in a Sites Worker. Implement and verify a Vercel-compatible backend, public authentication and storage before replacing this guard. Do not publish the static export as a working pilot.");
process.exitCode=1;

export const emailAuthentication = process.env.NEXT_PUBLIC_MYINTEL_AUTH === "email";
export const signInLabel = emailAuthentication ? "Sign in with email" : "Continue with ChatGPT";
export const accountProviderLabel = emailAuthentication ? "Signed in to MyIntel" : "Signed in with ChatGPT";
export const accountNotice = emailAuthentication
  ? "Use your email and password to return to MyIntel. You can reset a forgotten password from the sign-in page."
  : "This private review uses ChatGPT sign-in. Family-facing sign-in options and clinical data agreements must be finalized before a public launch.";
export function signInHref(returnTo = "/?view=account") {
  return (emailAuthentication ? "/auth/login?return_to=" : "/signin-with-chatgpt?return_to=") + encodeURIComponent(returnTo);
}
export const signOutHref = emailAuthentication ? "/auth/logout" : "/signout-with-chatgpt?return_to=%2F";

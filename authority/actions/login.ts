"use server";

import { signIn } from "@/auth";

// This is your Server Action to handle the login form submission
export async function loginAction(formData: FormData) {
  
  
  // This calls the Auth.js signIn function, which triggers your authorize() function
  await signIn("credentials", formData);
}

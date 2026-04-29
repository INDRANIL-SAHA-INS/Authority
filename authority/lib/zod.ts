import { object, string } from "zod";

export const signInSchema = object({
  email: string()
    .min(1, "Email is required")
    .email("Invalid email address"),
  password: string()
    .min(1, "Password is required")
    .min(6, "Password must be at least 6 characters"),
});

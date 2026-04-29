# Implementation Plan: Auth.js Credentials Login

## 1. Strategy Overview

For a highly secure, closed-system authentication architecture in Next.js, the best strategy is **Auth.js (NextAuth.js v5) with the Credentials Provider using JWT and Edge Middleware**.

### Why this is the best strategy:
1. **Stateless Scalability (JWT)**: Since you don't need to persist a session in a database, JSON Web Tokens (JWT) are stored in encrypted, HTTP-only cookies. This keeps the backend stateless and highly performant.
2. **Edge Security (Middleware)**: By using Next.js Middleware, we can verify the JWT token at the edge before the request even hits the Next.js server. This is the most efficient way to block unauthenticated users from accessing `/home`.
3. **Closed System Control**: The Credentials provider allows you to implement custom logic to verify a user's password against a pre-existing, predefined user in your database without exposing any public registration endpoints.

---

## 2. Target Folder Structure

Based on your current `authority` project setup, here is how the files will be structured.

```text
authority/
├── .env                          # 1. Add AUTH_SECRET here
├── middleware.ts                 # 2. Add this for edge protection
├── auth.ts                       # 3. Add core Auth.js config
├── lib/
│   └── zod.ts                    # 4. Optional: Schema validation
├── app/
│   ├── api/
│   │   └── auth/
│   │       └── [...nextauth]/
│   │           └── route.ts      # 5. Add Auth.js catch-all API route
│   ├── home/
│   │   └── page.tsx              # (Existing) Protected Dashboard
│   ├── layout.tsx                # (Existing) Global Layout
│   └── page.tsx                  # (Existing) Public Login Page
```

---

## 3. Step-by-Step Implementation Plan

### Step 1: Install Dependencies
You will need to install the latest NextAuth package (Auth.js beta) and a password hashing utility like `bcryptjs` (to compare the hashed password in your database).
*(Command: `npm install next-auth@beta bcryptjs`)*

### Step 2: Set Environment Variables (`.env`)
Generate a secure random string for signing the JWT tokens.
```env
AUTH_SECRET="<generate-a-secure-random-32-character-string>"
```

### Step 3: Create the Auth Configuration (`auth.ts`)
Create a new file at the root `authority/auth.ts`.
*   **Purpose:** Configure the `Credentials` provider.
*   **Action:** Write the `authorize` function. This function receives the `email` and `password`. You will query your database (using Prisma) to find the predefined user by email. If the user exists, compare the provided password with the hashed password in the DB using `bcryptjs`. If valid, return the user object. 
*   **Important:** Set the session strategy explicitly to `"jwt"`.

### Step 4: Create the NextAuth API Route (`app/api/auth/[...nextauth]/route.ts`)
Create the dynamic route folder structure.
*   **Purpose:** Expose the endpoints Auth.js needs to handle login, logout, and session fetching.
*   **Action:** Import your `handlers` (which include `GET` and `POST`) from `auth.ts` and export them.

### Step 5: Implement Edge Middleware (`middleware.ts`)
Create a new file at the root `authority/middleware.ts`.
*   **Purpose:** Protect the `/home` route and intercept logged-in users from seeing the login page.
*   **Action:** 
    1. Import the `auth` function from `auth.ts`.
    2. Write logic to check the request's pathname. 
    3. If the user is on `/home` (or any other protected path) and `!req.auth` (no session), redirect them to `/`.
    4. If the user is on `/` (the login page) and `req.auth` exists, redirect them to `/home`.
    5. Set a `matcher` to optimize where the middleware runs (e.g., ignoring static files and images).

### Step 6: Update the Landing Page (`app/page.tsx`)
Modify your existing `app/page.tsx`.
*   **Purpose:** Create the UI for unauthenticated users to log in.
*   **Action:** Build a form with `email` and `password` inputs. When the form is submitted, use a Next.js Server Action to call the Auth.js `signIn('credentials', formData)` function. If authentication fails, display an error message to the user.

### Step 7: Accessing the Session in Protected Routes
In `app/home/page.tsx`, you can now safely assume the user is logged in because the middleware protects the route. 
*   **Action:** To display the logged-in user's data (like their name or email), simply import `auth` from `auth.ts` and call `await auth()`. This will securely return the decoded JWT payload.

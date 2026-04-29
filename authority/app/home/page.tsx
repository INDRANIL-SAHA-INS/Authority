import React from "react";
import { auth, signOut } from "@/auth";

export default async function HomePage() {
  const session = await auth();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 dark:bg-black text-black dark:text-white p-8">
      <div className="max-w-2xl w-full bg-white dark:bg-zinc-900 rounded-xl shadow-md p-8 border border-zinc-200 dark:border-zinc-800">
        <h1 className="text-3xl font-bold mb-4">Welcome to Authority</h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400 mb-6">
          This is the home page. You are securely logged in.
        </p>

        {session && (
          <div className="mb-8 p-4 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
            <h2 className="font-semibold text-lg mb-2">Session Details:</h2>
            <p><strong>Email:</strong> {session.user?.email}</p>
            <p><strong>Role:</strong> {(session.user as any)?.role}</p>
          </div>
        )}

        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
        >
          <button
            type="submit"
            className="px-6 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors"
          >
            Sign Out
          </button>
        </form>
      </div>
    </div>
  );
}

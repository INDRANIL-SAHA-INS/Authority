import { loginAction } from "@/actions/login";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="w-full max-w-md p-8 bg-white rounded-xl shadow-md dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
        <h1 className="text-2xl font-bold text-center mb-6 text-black dark:text-white">Sign In</h1>
        
        <form
          action={loginAction}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300" htmlFor="email">
              Email
            </label>
            <input
              className="p-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300" htmlFor="password">
              Password
            </label>
            <input
              className="p-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            className="mt-4 p-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors"
          >
            Log In
          </button>
        </form>
      </main>
    </div>
  );
}

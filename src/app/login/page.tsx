type PageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function LoginPage({ searchParams }: PageProps) {
  const { error } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <div className="flex w-full max-w-sm flex-col items-center gap-6 rounded-lg border border-black/10 bg-white p-8 text-center dark:border-white/10 dark:bg-zinc-950">
        <div>
          <h1 className="text-xl font-semibold text-black dark:text-zinc-50">
            Affiliate Dashboard
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Sign in with your organization Google account to continue.
          </p>
        </div>

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {decodeURIComponent(error)}
          </p>
        )}

        <a
          href="/api/auth/login"
          className="flex h-10 w-full items-center justify-center rounded-md bg-foreground px-4 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
        >
          Sign in with Google
        </a>
      </div>
    </div>
  );
}

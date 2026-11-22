'use client';
export default function GlobalError({ error, reset }) {
  return (
    <main className="grid min-h-screen place-items-center p-6 text-center">
      <div><h1 className="text-2xl font-bold">Something went wrong</h1><p className="mt-2 text-slate-500">The page could not be displayed. Your data was not changed.</p>
        <button onClick={reset} className="mt-4 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white">Try again</button></div>
    </main>
  );
}

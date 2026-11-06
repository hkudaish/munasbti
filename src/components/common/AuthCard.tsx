import type { ReactNode } from 'react';

export const authField = 'w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-saudi-green-800';
export const authButton = 'w-full rounded-xl bg-saudi-green-800 px-5 py-3 font-bold text-white hover:bg-saudi-green-900 disabled:bg-gray-300 disabled:text-gray-600';

/** The frame shared by the account pages reached from an e-mail link (forgot / reset password, verify e-mail). */
export default function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md items-center px-4 py-10">
      <div className="w-full space-y-4 rounded-2xl border border-saudi-sand-300 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-extrabold text-saudi-green-900">{title}</h1>
        {children}
      </div>
    </main>
  );
}

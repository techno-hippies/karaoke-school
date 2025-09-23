import React from 'react';

export function TikTokTest() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">TikTok Test</h1>
      <p className="text-neutral-600">
        This component previously used Camp Network for authentication.
        It has been disabled during the migration to Lit Protocol v8.
      </p>
      <p className="mt-4">
        Please use the <a href="#/lit-auth-test" className="text-blue-500 underline">Lit Auth Test</a> page instead.
      </p>
    </div>
  );
}
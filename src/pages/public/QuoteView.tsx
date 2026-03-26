import { useParams } from 'react-router-dom';

export default function QuoteView() {
  const { quoteId } = useParams<{ quoteId: string }>();

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-2xl">
        <h1 className="text-center text-xl font-bold text-emerald-600">Reliable Turf</h1>
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
          <p className="text-slate-600">Loading quote #{quoteId}...</p>
        </div>
      </div>
    </div>
  );
}

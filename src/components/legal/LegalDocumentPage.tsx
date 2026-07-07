import type { LegalDoc } from "@/lib/legal-docs";

export default function LegalDocumentPage({ doc }: { doc: LegalDoc }) {
  return (
    <div className="min-h-screen bg-[#0f0f1a] text-white">
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-8">
          <p className="text-sm uppercase tracking-widest text-yellow-400">Legal document</p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">{doc.title}</h1>
          <div className="mt-3 flex flex-wrap gap-3 text-sm text-gray-400">
            <span>Version {doc.version}</span>
            <span>•</span>
            <span>{doc.jurisdictionNote}</span>
          </div>
          <div className="mt-4 rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-4 text-sm text-gray-200">
            {doc.attorneyReviewNote}
          </div>

          <div className="mt-8 space-y-6">
            {doc.sections.map((section) => (
              <section key={section.title} className="rounded-2xl border border-white/10 bg-[#13131f] p-5">
                <h2 className="text-xl font-bold text-yellow-400">{section.title}</h2>
                <div className="mt-3 space-y-3 text-sm leading-relaxed text-gray-300">
                  {section.body.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

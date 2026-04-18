import { ReactNode } from "react";

export function AlignmentLayout({
  chat,
  result,
}: {
  chat: ReactNode;
  result: ReactNode;
}) {
  return (
    <div className="flex h-full">
      <section className="flex-1 bg-[#F8F9FA] flex flex-col relative border-r border-slate-100">
        {chat}
      </section>
      <section className="w-[400px] bg-white flex flex-col shrink-0 shadow-[-4px_0_24px_rgba(0,0,0,0.02)]">
        {result}
      </section>
    </div>
  );
}

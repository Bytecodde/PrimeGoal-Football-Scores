import { Link } from 'wouter';
import { ArrowLeft, CircleAlert } from 'lucide-react';

export default function NotFound() {
  return <main className="flex min-h-[100dvh] items-center justify-center bg-[#121417] px-5 text-[#e6e9e9]">
    <section className="w-full max-w-md rounded-2xl border border-white/[.09] bg-[#181c1f] p-7">
      <div className="mb-5 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#252b2c] text-[#9bc2a4]"><CircleAlert size={19}/></span><div><p className="text-[9px] font-bold uppercase tracking-[.14em] text-[#879295]">PrimeGoal</p><h1 className="display text-[20px] font-bold">Page not found</h1></div></div>
      <p className="text-[12px] leading-5 text-[#9ca6a8]">That destination is not part of the matchday. Head back to the fixture list.</p>
      <Link href="/" data-testid="link-not-found-home" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#78d49a] px-4 py-2.5 text-[11px] font-bold text-[#132018] no-underline hover:bg-[#91e0a8]"><ArrowLeft size={14}/>Back to fixtures</Link>
    </section>
  </main>;
}

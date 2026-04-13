'use client';

import { useState } from 'react';
import { Mail, Clock, Send } from 'lucide-react';

import { env } from '@/lib/env';

export default function ContactPage() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>(
    'idle',
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    try {
      const res = await fetch(`${env.apiUrl}/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('Failed to send');
      setStatus('sent');
      setForm({ name: '', email: '', subject: '', message: '' });
    } catch {
      setStatus('error');
    }
  };

  return (
    <main className="static-page mx-auto max-w-4xl space-y-10 px-6 py-16">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
          Support
        </p>
        <h1 className="text-4xl font-semibold tracking-[-0.03em] text-white">
          Contact Us
        </h1>
        <p className="max-w-3xl text-sm leading-7 text-slate-400">
          Have a question, concern, or need assistance? Reach out and our team
          will get back to you as soon as possible.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
        {/* Contact Form */}
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-6"
        >
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400">Name</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-[#F5A623]/50 focus:ring-1 focus:ring-[#F5A623]/25"
              placeholder="Your full name"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400">Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-[#F5A623]/50 focus:ring-1 focus:ring-[#F5A623]/25"
              placeholder="you@example.com"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400">
              Subject
            </label>
            <input
              type="text"
              required
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-[#F5A623]/50 focus:ring-1 focus:ring-[#F5A623]/25"
              placeholder="How can we help?"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400">
              Message
            </label>
            <textarea
              required
              rows={5}
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-[#F5A623]/50 focus:ring-1 focus:ring-[#F5A623]/25"
              placeholder="Describe your question or issue..."
            />
          </div>

          <button
            type="submit"
            disabled={status === 'sending'}
            className="inline-flex items-center gap-2 rounded-full bg-amber-300 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-amber-200 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            {status === 'sending' ? 'Sending…' : 'Send Message'}
          </button>

          {status === 'sent' && (
            <p className="text-sm text-emerald-400">
              Message sent successfully. We&apos;ll get back to you shortly.
            </p>
          )}
          {status === 'error' && (
            <p className="text-sm text-red-400">
              Failed to send message. Please try again or email us directly.
            </p>
          )}
        </form>

        {/* Contact Info */}
        <div className="space-y-4">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-[#F5A623]" />
              <h3 className="text-sm font-semibold text-white">Email</h3>
            </div>
            <div className="space-y-2 text-sm text-slate-300">
              <p>
                General support:{' '}
                <a
                  href="mailto:support@autovestai.com"
                  className="text-[#F5A623] hover:text-[#D97706]"
                >
                  support@autovestai.com
                </a>
              </p>
              <p>
                Compliance inquiries:{' '}
                <a
                  href="mailto:compliance@autovestai.com"
                  className="text-[#F5A623] hover:text-[#D97706]"
                >
                  compliance@autovestai.com
                </a>
              </p>
              <p>
                Partnerships:{' '}
                <a
                  href="mailto:partners@autovestai.com"
                  className="text-[#F5A623] hover:text-[#D97706]"
                >
                  partners@autovestai.com
                </a>
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-[#F5A623]" />
              <h3 className="text-sm font-semibold text-white">
                Business Hours
              </h3>
            </div>
            <div className="space-y-2 text-sm text-slate-300">
              <p>Monday – Friday: 09:00 – 18:00 (UTC)</p>
              <p>Saturday – Sunday: Closed</p>
              <p className="text-xs text-slate-400">
                Trading platform operates 24/5 during market hours.
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 space-y-2">
            <h3 className="text-sm font-semibold text-white">
              Response Times
            </h3>
            <div className="space-y-1 text-sm text-slate-300">
              <p>General inquiries: within 24 hours</p>
              <p>Account &amp; KYC issues: within 12 hours</p>
              <p>Urgent trading issues: within 4 hours</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

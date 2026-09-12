import React, { useState } from 'react';
import { History, ChevronDown, MessageSquare } from 'lucide-react';

/**
 * CollapsibleActivityTimeline
 * Reusable Progressive Disclosure Component for Activity Logs / Audit Trails
 * 
 * @param {Array} events - Array of log events ({ action/title, user/actor, role, timestamp/time, note })
 * @param {string} title - Header title (default: "ประวัติการดำเนินงาน")
 * @param {boolean} defaultExpanded - Initial expanded state (default: false)
 * @param {boolean} reverseOrder - If true, display newest events first (default: true)
 * @param {string} className - Additional wrapper classes
 */
export default function CollapsibleActivityTimeline({
  events = [],
  title = 'ประวัติการดำเนินงาน',
  defaultExpanded = false,
  reverseOrder = true,
  className = ''
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [expandedNotes, setExpandedNotes] = useState({});

  if (!events) events = [];

  const formatEventTime = (timeVal) => {
    if (!timeVal || timeVal === '-') return '-';
    const str = String(timeVal).trim();
    const pad = (n) => String(n).padStart(2, '0');
    const matchDmy = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s*(\d{1,2}):(\d{2})/);
    if (matchDmy) {
      let p1 = parseInt(matchDmy[1], 10);
      let p2 = parseInt(matchDmy[2], 10);
      let yr = parseInt(matchDmy[3], 10);
      const hh = pad(matchDmy[4]);
      const mm = matchDmy[5];

      if (yr === 12 || yr === 26 || yr === 69) yr = 2026;
      else if (yr < 100) yr = 2000 + yr;
      else if (yr > 2400) yr -= 543;

      let day = p1;
      let month = p2;
      if (p1 <= 12 && p2 > 12) {
        day = p2;
        month = p1;
      }
      return `${pad(day)}/${pad(month)}/${yr} ${hh}:${mm}`;
    }
    try {
      const d = new Date(timeVal);
      if (isNaN(d.getTime())) return str;
      const day = pad(d.getDate());
      const month = pad(d.getMonth() + 1);
      let year = d.getFullYear();
      if (year > 2400) year -= 543;
      const hours = pad(d.getHours());
      const minutes = pad(d.getMinutes());
      return `${day}/${month}/${year} ${hours}:${minutes}`;
    } catch {
      return str;
    }
  };

  // Normalize event fields
  const normalizedEvents = events.map((e, index) => ({
    id: e.id || index,
    title: e.action || e.title || e.type || 'ดำเนินการ',
    actor: e.user || e.actor || e.userName || e.by || '-',
    role: e.role || e.userRole || e.department || null,
    time: formatEventTime(e.timestamp || e.time || e.date),
    note: e.note || e.description || e.comment || e.details || null,
    status: e.status || null,
    raw: e
  }));

  // Determine chronological display order
  const displayEvents = reverseOrder ? [...normalizedEvents].reverse() : normalizedEvents;
  const latestEvent = displayEvents.length > 0 ? displayEvents[0] : null;

  const toggleNote = (id) => {
    setExpandedNotes(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  return (
    <div className={`font-sans rounded-2xl border border-slate-200/80 bg-white shadow-2xs overflow-hidden transition-all ${className}`}>
      {/* ── 1. Interactive Accordion Trigger Header ── */}
      <div
        onClick={() => setIsExpanded(prev => !prev)}
        className="flex items-center justify-between p-3.5 bg-slate-50/80 hover:bg-slate-100/80 border-b border-slate-200/70 transition-colors cursor-pointer select-none gap-2"
        title="คลิกเพื่อพับหรือขยายดูประวัติการดำเนินงานทั้งหมด"
      >
        {/* Left: Title & Count Badge */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center text-slate-500 shadow-2xs">
            <History className="w-3.5 h-3.5 text-slate-600" />
          </div>
          <span className="text-xs font-bold text-slate-900 tracking-tight">
            {title}
          </span>
          <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-full bg-slate-200/70 text-slate-700">
            {events.length}
          </span>
        </div>

        {/* Center: Latest Event Snapshot (Shown when collapsed) */}
        {!isExpanded && latestEvent && (
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 font-normal truncate min-w-0 flex-1 px-2">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0"></span>
            <span className="truncate">
              ล่าสุด: <strong className="font-semibold text-slate-800">{latestEvent.title}</strong> โดย {latestEvent.actor}
              <span className="font-mono text-[11px] text-slate-400 ml-1.5">({latestEvent.time})</span>
            </span>
          </div>
        )}

        {/* Right: Expand/Collapse Chevron */}
        <div className="flex items-center gap-1.5 shrink-0 text-slate-400">
          <span className="text-[11px] font-medium hidden md:inline text-slate-500">
            {isExpanded ? 'พับเก็บ' : 'ดูรายละเอียด'}
          </span>
          <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${
            isExpanded ? 'rotate-180 text-indigo-600' : ''
          }`} />
        </div>
      </div>

      {/* ── 2. Body Timeline Layout (When Expanded) ── */}
      {isExpanded && (
        <div className="p-4 sm:p-5 bg-white animate-fade-in">
          {displayEvents.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-2 text-center">
              ไม่มีบันทึกประวัติการดำเนินงาน
            </p>
          ) : (
            <div className="relative pl-6 space-y-4 border-l-2 border-slate-200 ml-3 py-1">
              {displayEvents.map((event, idx) => {
                const isLatest = idx === 0;
                const noteExpanded = isLatest || Boolean(expandedNotes[event.id]);

                return (
                  <div key={event.id} className="relative group">
                    {/* Node Dot */}
                    {isLatest ? (
                      <div className="absolute -left-[31px] top-1 w-3.5 h-3.5 rounded-full bg-indigo-600 ring-4 ring-indigo-50 border-2 border-white shadow-2xs" />
                    ) : (
                      <div className="absolute -left-[29px] top-1.5 w-2.5 h-2.5 rounded-full bg-slate-300 border-2 border-white shadow-2xs group-hover:bg-slate-400 transition-colors" />
                    )}

                    {/* Event Content */}
                    {isLatest ? (
                      /* Latest Step: Bold with Full Note */
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap text-xs">
                          <span className="font-bold text-slate-900 text-sm">
                            {event.title}
                          </span>
                          {event.role && (
                            <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-semibold border border-indigo-100">
                              {event.role}
                            </span>
                          )}
                          <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.2 rounded font-bold border border-emerald-200">
                            ล่าสุด
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span>โดย: <strong className="font-semibold text-slate-700">{event.actor}</strong></span>
                          <span>•</span>
                          <span className="font-mono text-[11px] text-slate-400">{event.time}</span>
                        </div>

                        {event.note && (
                          <div className="mt-2 bg-slate-50/70 border border-slate-200/60 rounded-xl p-3 text-xs text-slate-700 font-sans leading-relaxed shadow-2xs">
                            {event.note}
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Historical Steps: Compact Single-line with Micro-toggle */
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-slate-800">
                              {event.title}
                            </span>
                            {event.role && (
                              <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-medium">
                                {event.role}
                              </span>
                            )}
                            <span className="text-slate-400 text-xs font-normal">
                              โดย <strong className="font-medium text-slate-600">{event.actor}</strong>
                            </span>
                            <span className="font-mono text-[11px] text-slate-400">
                              • {event.time}
                            </span>
                          </div>

                          {event.note && (
                            <button
                              type="button"
                              onClick={() => toggleNote(event.id)}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer py-0.5 px-2 rounded-md hover:bg-indigo-50"
                            >
                              <MessageSquare className="w-3 h-3" />
                              <span>{noteExpanded ? 'ซ่อนโน้ต' : 'ดูโน้ต'}</span>
                            </button>
                          )}
                        </div>

                        {/* Collapsed Note Content */}
                        {!isLatest && event.note && noteExpanded && (
                          <div className="mt-1.5 bg-slate-50/70 border border-slate-200/60 rounded-xl p-2.5 text-xs text-slate-600 font-sans leading-relaxed animate-fade-in shadow-2xs">
                            {event.note}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

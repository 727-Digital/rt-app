import { useState } from 'react';
import {
  GraduationCap,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Circle,
  Lightbulb,
  MessageSquare,
  Heart,
  BookOpen,
  Smartphone,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/Card';

interface AccordionSection {
  title: string;
  content: string;
}

interface ConcernCard {
  title: string;
  meaning: string;
  response: string;
}

interface ReferenceCard {
  title: string;
  type: 'list' | 'table' | 'phrases';
  items?: string[];
  rows?: { label: string; value: string }[];
  phrases?: string[];
}

interface Module {
  id: number;
  title: string;
  subtitle: string;
  icon: typeof GraduationCap;
  type: 'accordion' | 'concerns' | 'reference';
  sections?: AccordionSection[];
  concerns?: ConcernCard[];
  referenceCards?: ReferenceCard[];
}

const MODULES: Module[] = [
  {
    id: 1,
    title: 'Before You Show Up',
    subtitle: 'The customer already wants turf. Your job is to remove the fear.',
    icon: Lightbulb,
    type: 'accordion',
    sections: [
      {
        title: 'The Pre-Educated Customer',
        content:
          'By the time you arrive, the customer has already drawn their yard on the website, seen the price range ($10-$12.25/sqft), and gave you their contact info. They already want turf. Your job is NOT to sell turf. Your job is to: 1) Confirm this is a good fit for their yard, 2) Help them feel confident in the investment, 3) Make the process feel simple and safe.',
      },
      {
        title: 'What To Do Before Arriving',
        content:
          "Review the lead in ReliableTurf \u2014 check their sqft, estimate range, address, and any notes. Google Street View their property so you're not walking in blind. Arrive 5 minutes early. Walk the yard and notice pain points before they tell you.",
      },
      {
        title: 'First Impression',
        content:
          "Don't start with the pitch. Start with genuine curiosity about their yard. Ask what they like, what frustrates them, what they imagine. Let them talk first.",
      },
    ],
  },
  {
    id: 2,
    title: 'The Conversation Framework',
    subtitle: 'Questions, not pitches. Listening, not talking.',
    icon: MessageSquare,
    type: 'accordion',
    sections: [
      {
        title: 'Step 1: Understand',
        content:
          "Start by understanding why they reached out. Ask: 'What made you start looking into turf?' / 'What's been the biggest frustration with your yard?' / 'Walk me through what you're imagining for this space.' Listen. Restate what they said back to them: 'So it sounds like the main thing is [their words].' Don't pitch yet.",
      },
      {
        title: "Step 2: Explore Their Past",
        content:
          "Understand what they've already tried: 'Have you tried anything else \u2014 sod, different grass, landscaping?' / 'How'd that work out?' / 'How much would you say you spend on lawn care per year?' This builds the cost comparison naturally \u2014 they tell YOU the numbers.",
      },
      {
        title: 'Step 3: Paint the Result',
        content:
          "Don't talk about excavation, base material, weed barrier, or infill types. Talk about results: 'Imagine pulling into the driveway and it looks like this 365 days a year.' / 'Your kids and dogs can play on this the day after install.' / 'You'll never mow, water, fertilize, or weed again.' / '15-year manufacturer warranty \u2014 this outlasts most roofs.'",
      },
      {
        title: 'Step 4: Stay On The Road',
        content:
          "When the customer goes off on tangents \u2014 HOA concerns, neighbor opinions, random questions about turf technology \u2014 acknowledge it briefly, then bring them back: 'That's a great question. Let me address that \u2014 [brief answer]. So back to what you mentioned about wanting the kids to have a safe play area...' The road is: their problem \u2192 the result they want \u2192 how you get them there \u2192 the investment. Every tangent is the woods. Acknowledge it, get back on the road.",
      },
      {
        title: 'Step 5: The Investment Conversation',
        content:
          "Don't say 'the price is $11,700.' Instead: 'Based on what I measured today, here's what the investment looks like...' Frame it against what they already told you: 'You mentioned you're spending around $200/month on lawn care \u2014 over 5 years that's $12,000 and your yard still dies every summer. This is a one-time investment of $11,700 and you're done forever.' Also: 'Your home value increases by 5-15% with quality hardscaping. On a $400K home, that's $20-60K in equity.'",
      },
      {
        title: 'Step 6: Handle Concerns Without Fighting',
        content:
          "When they push back, three steps: 1) Acknowledge \u2014 'That's completely fair.' 2) Relate \u2014 'A lot of our happiest customers said the exact same thing before they moved forward.' 3) Redirect \u2014 Ask a question that gets back on the road. Never argue. Never pressure. If they feel pushed, you've lost.",
      },
    ],
  },
  {
    id: 3,
    title: 'Handling Concerns',
    subtitle: 'The top 10 things customers say, and how to guide the conversation.',
    icon: Heart,
    type: 'concerns',
    concerns: [
      {
        title: "That's more than I expected",
        meaning: 'They need help seeing the value',
        response:
          "I totally get that. Most people feel that way at first. Can I walk you through what goes into it? [describe the 5-step process briefly]. When you compare it to what you're spending now on lawn care and water, most families break even in 3-4 years \u2014 and then it's free after that. And by the way, we offer financing through Wisetack \u2014 you can apply right from the quote page with a soft credit pull, no impact on your score. A lot of our customers end up paying around $195/month instead of one lump sum. Makes it easier than your current lawn care bill.",
      },
      {
        title: 'I need to talk to my wife/husband',
        meaning: "They're not confident enough to decide alone",
        response:
          "Of course, I'd do the same thing. What parts do you think they'd want to know more about? Maybe I can help you explain it. Would it help if I put together a quick summary you can show them?",
      },
      {
        title: "I'm getting other quotes",
        meaning: "They want to make sure they're not overpaying",
        response:
          "Smart move \u2014 I'd do the same. When you're comparing, make sure you ask about base depth, infill type, seam quality, and warranty terms. Not all installs are equal. I can show you exactly what separates a 5-year turf job from a 15-year one.",
      },
      {
        title: 'Can you do it for less?',
        meaning: 'They want it, budget is the barrier',
        response:
          "Let me see if we can adjust the scope. We could do the front yard now and backyard in spring \u2014 that spreads the investment out. Or we can look at a different turf grade. We also offer financing through Wisetack \u2014 breaks it into monthly payments with no impact on your credit score to apply. I'd rather find you a real solution than cut corners.",
      },
      {
        title: "Won't it get hot?",
        meaning: "They've heard this concern online",
        response:
          'Great question \u2014 it\'s the most common one we hear. Modern infill technology has come a long way. We use [infill type] which stays 15-20 degrees cooler than older products. But honestly, how usable is your current yard in July and August anyway?',
      },
      {
        title: 'Will it look fake?',
        meaning: "They've seen bad turf somewhere",
        response:
          "That's the number one thing people worry about, and the number one thing they're surprised by after install. Today's turf has multiple blade heights, color variations, and a natural thatch layer. I'll show you some before-and-afters from yards in your area.",
      },
      {
        title: 'How long does it last?',
        meaning: 'They want ROI assurance',
        response:
          '15-year manufacturer warranty, and most of our installs last 20+ years with basic care. Divide your investment by 15 years \u2014 that\'s less than $2 a day for a perfect yard with zero maintenance.',
      },
      {
        title: 'I want to wait until next year',
        meaning: 'Fear of commitment',
        response:
          "Totally understand. Out of curiosity, what would change between now and then? Material costs have gone up about 8% this year. The sooner it's in, the sooner you stop spending on lawn care.",
      },
      {
        title: 'Is it safe for pets?',
        meaning: 'They need reassurance',
        response:
          "100%. The infill we use is non-toxic and antimicrobial. No pesticides, no fertilizer chemicals on the surface. Honestly, it's safer for your dog than natural grass that's been chemically treated.",
      },
      {
        title: 'My neighbor got theirs done cheaper',
        meaning: 'Price comparison anxiety',
        response:
          "Every install is different \u2014 turf grade, base depth, infill quality, and warranty all vary. I'd encourage you to ask them about the details. We stand behind our work with a 1-year workmanship warranty plus 15 years from the manufacturer.",
      },
    ],
  },
  {
    id: 4,
    title: 'Conviction',
    subtitle: "You can't sell something you don't believe in.",
    icon: BookOpen,
    type: 'accordion',
    sections: [
      {
        title: 'Why This Matters',
        content:
          "If you truly believe turf is the right solution for this family, handling concerns feels natural \u2014 not slimy. If you don't believe it, every objection feels like a fight. The difference between a good salesperson and a pushy one is conviction.",
      },
      {
        title: 'Daily Practice',
        content:
          "Before your first visit each day: review before/after photos from past jobs, re-read a customer testimonial or review, know the math cold (water savings, lawn care costs, home value increase). Ask yourself: 'Would I put this in my own yard?' If the answer isn't yes, fix the product.",
      },
      {
        title: 'The Right Mindset',
        content:
          "You're not selling. You're helping someone make a decision they already want to make. If they're a good fit and they don't buy, they're going to keep wasting money on a yard they hate. If they're NOT a good fit \u2014 tiny yard, rental property, wrong expectations \u2014 tell them. Walking away from a bad deal builds more trust than any script.",
      },
      {
        title: 'Know Your Numbers',
        content:
          'Have these memorized: Average annual lawn care cost: $2,400. Average annual water for lawn: $800-1,200. Turf lifespan: 15-20 years. Home value increase: 5-15%. Warranty: 1 year workmanship + 15 year manufacturer. Average customer saves $3,000-4,000/year.',
      },
    ],
  },
  {
    id: 5,
    title: 'Quick Reference',
    subtitle: 'Pull these up on your phone during a site visit.',
    icon: Smartphone,
    type: 'reference',
    referenceCards: [
      {
        title: '5 Questions Before Price',
        type: 'list',
        items: [
          'What made you start looking into turf?',
          'What frustrates you most about your current yard?',
          'How much do you spend on lawn care and water per year?',
          'What would your ideal yard look like?',
          'Have you tried other solutions before?',
        ],
      },
      {
        title: 'The ROI Breakdown',
        type: 'table',
        rows: [
          { label: 'Annual lawn care', value: '$2,400/yr' },
          { label: 'Annual water for lawn', value: '$1,000/yr' },
          { label: 'Annual fertilizer/weed control', value: '$400/yr' },
          { label: 'Total annual cost', value: '$3,800/yr' },
          { label: '5-year cost', value: '$19,000' },
          { label: '10-year cost', value: '$38,000' },
          { label: 'vs. Average turf install', value: '$10,000-$15,000' },
          { label: 'Break-even', value: '3-4 years' },
          { label: 'After that', value: '$0/year forever' },
        ],
      },
      {
        title: '"Back On The Road" Phrases',
        type: 'phrases',
        phrases: [
          "That's a great point. Let me address that...",
          'I totally understand. A lot of our customers felt the same way...',
          "That's fair. Can I share what I've seen work for other families in your situation?",
          'Good question \u2014 and back to what you mentioned about [their goal]...',
          'I hear you. So the real question is...',
        ],
      },
      {
        title: 'The 3-Step Response',
        type: 'list',
        items: [
          'Acknowledge \u2014 "That\'s completely fair" / "I totally get that"',
          'Relate \u2014 "Our happiest customers said the exact same thing"',
          'Redirect \u2014 Ask a question that gets back to their goal',
        ],
      },
      {
        title: 'Water Savings by Region',
        type: 'table',
        rows: [
          { label: 'Southeast (Atlanta, Charlotte)', value: '$800-1,200/yr' },
          { label: 'Southwest (Phoenix, Las Vegas)', value: '$1,500-2,500/yr' },
          { label: 'Texas (Dallas, Houston)', value: '$1,000-1,800/yr' },
          { label: 'Florida (Tampa, Orlando)', value: '$900-1,400/yr' },
          { label: 'California (Sacramento, LA)', value: '$1,200-2,000/yr' },
        ],
      },
    ],
  },
];

function AccordionItem({ section, isOpen, onToggle }: { section: AccordionSection; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium text-slate-900 hover:bg-slate-50 transition-colors"
      >
        {section.title}
        {isOpen ? <ChevronUp size={16} className="shrink-0 text-slate-400" /> : <ChevronDown size={16} className="shrink-0 text-slate-400" />}
      </button>
      {isOpen && (
        <div className="border-t border-slate-100 px-4 py-3">
          <p className="text-sm leading-relaxed text-slate-600">{section.content}</p>
        </div>
      )}
    </div>
  );
}

function ConcernCardComponent({ concern, isOpen, onToggle }: { concern: ConcernCard; isOpen: boolean; onToggle: () => void }) {
  return (
    <Card className="flex flex-col gap-2">
      <p className="text-sm font-semibold text-slate-900">"{concern.title}"</p>
      <p className="text-xs text-slate-500">{concern.meaning}</p>
      <button
        onClick={onToggle}
        className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 hover:text-emerald-700 transition-colors mt-1"
      >
        {isOpen ? 'Hide response' : 'Show response'}
        {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {isOpen && (
        <p className="text-sm leading-relaxed text-slate-600 mt-1 pt-2 border-t border-slate-100">
          {concern.response}
        </p>
      )}
    </Card>
  );
}

function ReferenceCardComponent({ card }: { card: ReferenceCard }) {
  return (
    <div className="mx-auto w-full max-w-[400px] rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h4 className="text-sm font-semibold text-slate-900 mb-3">{card.title}</h4>
      {card.type === 'list' && card.items && (
        <ol className="flex flex-col gap-2">
          {card.items.map((item, i) => (
            <li key={i} className="flex gap-2 text-sm text-slate-600">
              <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-50 text-xs font-medium text-emerald-700">
                {i + 1}
              </span>
              <span className="leading-relaxed">{item}</span>
            </li>
          ))}
        </ol>
      )}
      {card.type === 'table' && card.rows && (
        <div className="flex flex-col gap-1.5">
          {card.rows.map((row, i) => {
            const isHighlight = row.label === 'Total annual cost' || row.label === 'After that' || row.label === 'Break-even';
            return (
              <div
                key={i}
                className={cn(
                  'flex items-center justify-between gap-2 rounded px-2 py-1 text-sm',
                  isHighlight ? 'bg-emerald-50 font-medium text-emerald-800' : 'text-slate-600',
                )}
              >
                <span>{row.label}</span>
                <span className="shrink-0 font-medium">{row.value}</span>
              </div>
            );
          })}
        </div>
      )}
      {card.type === 'phrases' && card.phrases && (
        <div className="flex flex-col gap-2">
          {card.phrases.map((phrase, i) => (
            <p key={i} className="rounded-lg bg-slate-50 px-3 py-2 text-sm italic text-slate-600">
              "{phrase}"
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Training() {
  const [activeModule, setActiveModule] = useState(0);
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());
  const [openConcerns, setOpenConcerns] = useState<Set<number>>(new Set());

  const completedCount = completed.size;
  const mod = MODULES[activeModule] as Module;

  function toggleCompleted(idx: number) {
    setCompleted((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  }

  function toggleSection(key: string) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function toggleConcern(idx: number) {
    setOpenConcerns((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <GraduationCap size={24} className="text-slate-400" />
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sales Training</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {completedCount}/5 modules completed
          </p>
        </div>
      </div>

      <div className="mt-1.5 h-1.5 w-full max-w-xs rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all duration-300"
          style={{ width: `${(completedCount / 5) * 100}%` }}
        />
      </div>

      <div className="mt-6 flex gap-6">
        <nav className="hidden lg:flex w-64 shrink-0 flex-col gap-1">
          {MODULES.map((m, i) => {
            const Icon = m.icon;
            const isActive = i === activeModule;
            const isDone = completed.has(i);
            return (
              <button
                key={m.id}
                onClick={() => setActiveModule(i)}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
                  isActive
                    ? 'bg-emerald-50 text-emerald-700 font-medium'
                    : 'text-slate-600 hover:bg-slate-50',
                )}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleCompleted(i);
                  }}
                  className="shrink-0"
                >
                  {isDone ? (
                    <CheckCircle2 size={18} className="text-emerald-500" />
                  ) : (
                    <Circle size={18} className="text-slate-300" />
                  )}
                </button>
                <Icon size={16} className="shrink-0" />
                <span className="text-sm leading-tight">{m.title}</span>
              </button>
            );
          })}
        </nav>

        <div className="flex w-full min-w-0 flex-col gap-4 lg:hidden">
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-none">
            {MODULES.map((m, i) => {
              const isActive = i === activeModule;
              const isDone = completed.has(i);
              return (
                <button
                  key={m.id}
                  onClick={() => setActiveModule(i)}
                  className={cn(
                    'flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-slate-50 text-slate-600',
                  )}
                >
                  {isDone && <CheckCircle2 size={14} className="text-emerald-500" />}
                  {m.title}
                </button>
              );
            })}
          </div>
        </div>

        <div className="hidden lg:block flex-1 min-w-0">
          <ModuleContent
            mod={mod}
            moduleIndex={activeModule}
            completed={completed}
            toggleCompleted={toggleCompleted}
            openSections={openSections}
            toggleSection={toggleSection}
            openConcerns={openConcerns}
            toggleConcern={toggleConcern}
          />
        </div>
      </div>

      <div className="mt-4 lg:hidden">
        <ModuleContent
          mod={mod}
          moduleIndex={activeModule}
          completed={completed}
          toggleCompleted={toggleCompleted}
          openSections={openSections}
          toggleSection={toggleSection}
          openConcerns={openConcerns}
          toggleConcern={toggleConcern}
        />
      </div>
    </div>
  );
}

function ModuleContent({
  mod,
  moduleIndex,
  completed,
  toggleCompleted,
  openSections,
  toggleSection,
  openConcerns,
  toggleConcern,
}: {
  mod: Module;
  moduleIndex: number;
  completed: Set<number>;
  toggleCompleted: (i: number) => void;
  openSections: Set<string>;
  toggleSection: (key: string) => void;
  openConcerns: Set<number>;
  toggleConcern: (i: number) => void;
}) {
  const isDone = completed.has(moduleIndex);
  const Icon = mod.icon;

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50">
            <Icon size={20} className="text-emerald-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{mod.title}</h2>
            <p className="text-sm text-slate-500 mt-0.5">{mod.subtitle}</p>
          </div>
        </div>
        <button
          onClick={() => toggleCompleted(moduleIndex)}
          className={cn(
            'flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
            isDone
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-slate-50 text-slate-600 hover:bg-slate-100',
          )}
        >
          {isDone ? <CheckCircle2 size={16} /> : <Circle size={16} />}
          {isDone ? 'Completed' : 'Mark complete'}
        </button>
      </Card>

      {mod.type === 'accordion' && mod.sections && (
        <div className="flex flex-col gap-2">
          {mod.sections.map((section, i) => {
            const key = `${mod.id}-${i}`;
            return (
              <AccordionItem
                key={key}
                section={section}
                isOpen={openSections.has(key)}
                onToggle={() => toggleSection(key)}
              />
            );
          })}
        </div>
      )}

      {mod.type === 'concerns' && mod.concerns && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {mod.concerns.map((concern, i) => (
            <ConcernCardComponent
              key={i}
              concern={concern}
              isOpen={openConcerns.has(i)}
              onToggle={() => toggleConcern(i)}
            />
          ))}
        </div>
      )}

      {mod.type === 'reference' && mod.referenceCards && (
        <div className="flex flex-col gap-4">
          {mod.referenceCards.map((card, i) => (
            <ReferenceCardComponent key={i} card={card} />
          ))}
        </div>
      )}
    </div>
  );
}

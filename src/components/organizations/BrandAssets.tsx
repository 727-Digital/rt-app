import { useState, useEffect, useCallback } from 'react';
import {
  Phone,
  Mail,
  MapPin,
  Globe,
  Shield,
  QrCode,
  Download,
  Printer,
  ChevronDown,
} from 'lucide-react';
import { formatCurrency, formatPhone } from '@/lib/utils';
import { fetchAllOrganizations } from '@/lib/queries/organizations';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import type { Organization } from '@/lib/types';

function AssetWrapper({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" disabled title="Coming Soon">
            <Printer size={14} />
            Print
          </Button>
          <Button variant="secondary" size="sm" disabled title="Coming Soon">
            <Download size={14} />
            Download PDF
          </Button>
        </div>
      </div>
      {children}
    </div>
  );
}

function BusinessCard({ org }: { org: Organization }) {
  const color = org.primary_color || '#16a34a';

  return (
    <AssetWrapper title="Business Card">
      <div className="flex flex-col gap-4 sm:flex-row">
        <Card className="flex-1 p-0 overflow-hidden">
          <div className="relative flex flex-col justify-between p-5" style={{ aspectRatio: '3.5 / 2' }}>
            <div className="flex flex-col gap-1">
              {org.logo_url ? (
                <img src={org.logo_url} alt={org.name} className="h-8 object-contain object-left" />
              ) : (
                <p className="text-lg font-bold" style={{ color }}>{org.name}</p>
              )}
              <p className="text-[10px] font-medium uppercase tracking-widest text-slate-400">
                Artificial Turf Installation
              </p>
            </div>
            <div
              className="absolute bottom-0 left-0 right-0 h-1.5"
              style={{ backgroundColor: color }}
            />
          </div>
        </Card>

        <Card className="flex-1 p-0 overflow-hidden">
          <div
            className="flex flex-col items-center justify-center gap-2 p-5 text-center"
            style={{ aspectRatio: '3.5 / 2' }}
          >
            <div className="flex flex-col gap-1.5 text-xs text-slate-600">
              {org.phone && (
                <span className="flex items-center justify-center gap-1.5">
                  <Phone size={10} style={{ color }} />
                  {formatPhone(org.phone)}
                </span>
              )}
              {org.email && (
                <span className="flex items-center justify-center gap-1.5">
                  <Mail size={10} style={{ color }} />
                  {org.email}
                </span>
              )}
              {org.address && (
                <span className="flex items-center justify-center gap-1.5">
                  <MapPin size={10} style={{ color }} />
                  {org.address}
                </span>
              )}
              <span className="flex items-center justify-center gap-1.5">
                <Globe size={10} style={{ color }} />
                reliableturf.com
              </span>
            </div>
            <p className="mt-1 text-[9px] font-medium uppercase tracking-wide text-slate-400">
              Licensed | Insured | 15-Year Warranty
            </p>
          </div>
        </Card>
      </div>
    </AssetWrapper>
  );
}

function SalesOnePager({ org }: { org: Organization }) {
  const color = org.primary_color || '#16a34a';
  const paymentStr = org.payment_methods?.length > 0 ? org.payment_methods.join(', ') : 'Check, Zelle';

  const benefits = [
    'Zero maintenance',
    'Saves $3,000-4,000/year on lawn care & water',
    '15-year manufacturer warranty',
    'Safe for kids & pets',
    'Looks perfect 365 days a year',
  ];

  const steps = [
    'Free consultation & measurement',
    'Custom quote within 24 hours',
    'Professional excavation & base prep',
    'Premium turf & infill installation',
    'Power broom finish & walkthrough',
  ];

  return (
    <AssetWrapper title="Sales One-Pager">
      <Card className="p-0 overflow-hidden">
        <div className="flex flex-col p-6 text-sm" style={{ aspectRatio: '8.5 / 11' }}>
          <div className="flex items-center gap-3 border-b pb-4" style={{ borderColor: `${color}33` }}>
            {org.logo_url ? (
              <img src={org.logo_url} alt={org.name} className="h-10 object-contain" />
            ) : (
              <span className="text-xl font-bold" style={{ color }}>{org.name}</span>
            )}
            <div className="ml-auto text-right">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color }}>
                Premium Artificial Turf Installation
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-1 flex-col gap-4">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color }}>
                Why Artificial Turf?
              </h4>
              <ul className="mt-2 flex flex-col gap-1">
                {benefits.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-xs text-slate-600">
                    <span
                      className="mt-1.5 block h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    {b}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color }}>
                Our Process
              </h4>
              <ol className="mt-2 flex flex-col gap-1">
                {steps.map((s, i) => (
                  <li key={s} className="flex items-start gap-2 text-xs text-slate-600">
                    <span
                      className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
                      style={{ backgroundColor: color }}
                    >
                      {i + 1}
                    </span>
                    {s}
                  </li>
                ))}
              </ol>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color }}>
                Investment
              </h4>
              <div className="mt-2 flex flex-col gap-0.5 text-xs text-slate-600">
                {org.pricing_min > 0 && (
                  <p className="font-semibold text-slate-900">
                    Starting at {formatCurrency(org.pricing_min)}/sqft
                  </p>
                )}
                <p>Financing available through Wisetack</p>
                <p>Payment: {paymentStr}</p>
              </div>
            </div>
          </div>

          <div
            className="mt-auto flex items-center justify-between border-t pt-3 text-[10px] text-slate-500"
            style={{ borderColor: `${color}33` }}
          >
            <div className="flex items-center gap-3">
              {org.phone && (
                <span className="flex items-center gap-1">
                  <Phone size={9} />
                  {formatPhone(org.phone)}
                </span>
              )}
              {org.email && (
                <span className="flex items-center gap-1">
                  <Mail size={9} />
                  {org.email}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Globe size={9} />
                reliableturf.com
              </span>
            </div>
            <span className="font-medium" style={{ color }}>Licensed & Insured</span>
          </div>
        </div>
      </Card>
    </AssetWrapper>
  );
}

function DoorHanger({ org }: { org: Organization }) {
  const color = org.primary_color || '#16a34a';

  return (
    <AssetWrapper title="Door Hanger">
      <Card className="mx-auto w-56 p-0 overflow-hidden">
        <div
          className="flex flex-col items-center justify-between p-5 text-center"
          style={{ aspectRatio: '3.5 / 8' }}
        >
          <div className="flex flex-col items-center gap-3">
            {org.logo_url ? (
              <img src={org.logo_url} alt={org.name} className="h-8 object-contain" />
            ) : (
              <p className="text-base font-bold" style={{ color }}>{org.name}</p>
            )}
            <div
              className="h-px w-12"
              style={{ backgroundColor: color }}
            />
          </div>

          <div className="flex flex-col items-center gap-2">
            <p className="text-sm font-bold text-slate-900">
              Your Neighbors Love Their New Turf!
            </p>
            <p className="text-[10px] leading-tight text-slate-500">
              We just installed premium artificial turf nearby
            </p>
          </div>

          <div
            className="flex flex-col items-center gap-1 rounded-lg px-4 py-3"
            style={{ backgroundColor: `${color}0d` }}
          >
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color }}>
              Get a FREE quote today
            </p>
            {org.phone && (
              <p className="text-base font-bold text-slate-900">
                {formatPhone(org.phone)}
              </p>
            )}
            <p className="text-[10px] text-slate-500">reliableturf.com</p>
          </div>

          <div className="flex flex-col items-center gap-1.5 text-slate-400">
            <QrCode size={36} />
            <p className="text-[9px]">Scan for instant estimate</p>
          </div>
        </div>
      </Card>
    </AssetWrapper>
  );
}

function YardSign({ org }: { org: Organization }) {
  const color = org.primary_color || '#16a34a';

  return (
    <AssetWrapper title="Yard Sign">
      <Card className="p-0 overflow-hidden">
        <div
          className="flex flex-col items-center justify-center gap-3 p-8 text-center text-white"
          style={{ aspectRatio: '24 / 18', backgroundColor: color }}
        >
          <p className="text-sm font-medium uppercase tracking-wide opacity-90">
            Another Beautiful Lawn by
          </p>
          {org.logo_url ? (
            <img
              src={org.logo_url}
              alt={org.name}
              className="h-10 object-contain brightness-0 invert"
            />
          ) : (
            <p className="text-3xl font-extrabold">{org.name}</p>
          )}
          {org.phone && (
            <p className="text-2xl font-extrabold tracking-wide">
              {formatPhone(org.phone)}
            </p>
          )}
          <p className="text-sm font-medium opacity-80">reliableturf.com</p>
          <div className="mt-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider opacity-70">
            <Shield size={12} />
            Licensed & Insured
          </div>
        </div>
      </Card>
    </AssetWrapper>
  );
}

export default function BrandAssets() {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);

  const loadOrgs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAllOrganizations();
      setOrgs(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrgs();
  }, [loadOrgs]);

  const selectedOrg = orgs.find((o) => o.id === selectedOrgId) ?? null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size={24} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Brand Assets</h2>
      </div>

      <div className="relative w-full max-w-xs">
        <select
          value={selectedOrgId ?? ''}
          onChange={(e) => setSelectedOrgId(e.target.value || null)}
          className="h-10 w-full appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-9 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="">Select an organization...</option>
          {orgs.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <ChevronDown
          size={16}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
      </div>

      {!selectedOrg ? (
        <Card>
          <p className="text-sm text-slate-500">
            Select an organization to preview brand assets
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-8">
          <BusinessCard org={selectedOrg} />
          <SalesOnePager org={selectedOrg} />
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <DoorHanger org={selectedOrg} />
            <YardSign org={selectedOrg} />
          </div>
        </div>
      )}
    </div>
  );
}

import { Mail, Phone, MapPin, Globe } from 'lucide-react';
import { useData } from '../context/DataContext';

export default function Contact() {
  const { siteSettings } = useData();

  return (
    <div className="animate-fade-in px-4 pb-40 pt-6">
      <h1 className="mb-4 font-heading text-xl font-bold text-ink">Contact Us</h1>
      <div className="flex flex-col gap-3">
        {siteSettings?.address && (
          <div className="flex items-center gap-3 rounded-card bg-white p-4 shadow-soft">
            <MapPin size={18} className="text-purple" />
            <p className="text-sm text-ink">{siteSettings.address}</p>
          </div>
        )}
        {siteSettings?.phone && (
          <a
            href={`tel:${siteSettings.phone}`}
            className="flex items-center gap-3 rounded-card bg-white p-4 shadow-soft"
          >
            <Phone size={18} className="text-purple" />
            <p className="text-sm text-ink">{siteSettings.phone}</p>
          </a>
        )}
        {siteSettings?.website && (
          <a
            href={siteSettings.website}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 rounded-card bg-white p-4 shadow-soft"
          >
            <Globe size={18} className="text-purple" />
            <p className="text-sm text-ink">{siteSettings.website}</p>
          </a>
        )}
        {siteSettings?.socials?.map((s) => (
          <div key={s.platform} className="flex items-center gap-3 rounded-card bg-white p-4 shadow-soft">
            <Mail size={18} className="text-purple" />
            <p className="text-sm text-ink">
              {s.platform}: {s.handle}
            </p>
          </div>
        ))}
        {!siteSettings?.address && !siteSettings?.phone && !siteSettings?.website && (
          <p className="text-center text-sm text-ink-muted">
            Contact info hasn't been added yet — the admin can add it under Site Settings.
          </p>
        )}
      </div>
    </div>
  );
}

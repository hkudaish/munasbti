import ServiceLayout from '@/components/system/ServiceLayout';
export const dynamic = 'force-dynamic';
export default function Layout({ children }: { children: React.ReactNode }) { return <ServiceLayout id="digital_cards">{children}</ServiceLayout>; }

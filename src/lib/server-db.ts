// Server-side Database Service for Munasbti Marketplace
// Implements resilient hybrid fetching: uses PostgreSQL via Prisma when connected,
// and gracefully falls back to optimized in-memory seed data when offline.

import prisma, { databaseConnectionUrl } from './db';
import { VENDORS, SERVICE_ITEMS, SAUDI_CITIES, SERVICE_CATEGORIES } from './seed-data';
import { ensureVendorDetails, ensureServiceDetails } from './utils';
import type { Vendor, ServiceItem, MultiVendorOrder } from './types';

export function isDatabaseConfigured(): boolean {
  const url = databaseConnectionUrl();
  if (!url) return false;
  const isServerless = Boolean(
    process.env.NETLIFY ||
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME
  );
  if (isServerless && (url.includes('localhost') || url.includes('127.0.0.1') || url.includes('::1'))) {
    return false;
  }
  return true;
}

export async function checkDatabaseHealth(): Promise<{ isConnected: boolean; message: string; latencyMs?: number }> {
  const start = Date.now();
  try {
    if (!isDatabaseConfigured()) {
      const url = databaseConnectionUrl();
      const isLocalhostInCloud = url && (url.includes('localhost') || url.includes('127.0.0.1'));
      return {
        isConnected: false,
        message: isLocalhostInCloud
          ? 'Localhost database unreachable from cloud deployment. Running on resilient Seed/Local store.'
          : 'DATABASE_URL not configured. Running on resilient Seed/Local store.',
      };
    }
    // Ping PostgreSQL
    await prisma.$queryRaw`SELECT 1`;
    return {
      isConnected: true,
      message: 'PostgreSQL connection healthy and verified.',
      latencyMs: Date.now() - start,
    };
  } catch {
    return {
      isConnected: false,
      message: 'Database connection unavailable. Check the server database configuration.',
      latencyMs: Date.now() - start,
    };
  }
}

export async function getVendorsFromDB(options?: {
  categoryId?: string;
  cityId?: string;
  featuredOnly?: boolean;
  strict?: boolean;
  includeInactive?: boolean;
}): Promise<Vendor[]> {
  try {
    if (isDatabaseConfigured()) {
      const where: any = options?.includeInactive ? {} : { status: 'ACTIVE', OR: [{ userId: null }, { user: { isActive: true } }] };
      if (options?.categoryId) where.categoryId = options.categoryId;
      if (options?.cityId) where.cityId = options.cityId;
      if (options?.featuredOnly) where.featured = true;

      const dbVendors = await prisma.vendor.findMany({
        where,
        include: {
          city: true,
          category: true,
          metrics: true,
          availability: true,
          services: {
            include: {
              packages: true,
              addons: true,
            },
          },
        },
      });

      if (dbVendors && (dbVendors.length > 0 || options?.strict)) {
        return dbVendors.map((v: any) => ({
          id: v.id,
          businessName: v.businessName,
          businessNameEn: v.businessNameEn,
          categoryId: v.categoryId,
          categoryNameAr: v.category?.nameAr || 'خدمة مناسبات',
          logo: v.logo,
          bannerImage: v.bannerImage,
          rating: v.rating,
          reviewsCount: v.reviewsCount,
          completedBookingsCount: v.completedBookingsCount,
          verified: v.verified,
          crNumber: v.crNumber || undefined,
          vatNumber: v.vatNumber || undefined,
          cityId: v.cityId,
          cityNameAr: v.city?.nameAr || 'الرياض',
          neighborhood: v.neighborhood,
          serviceAreas: v.serviceAreas,
          startingPrice: v.startingPrice,
          instantBooking: v.instantBooking,
          responseTimeMinutes: v.responseTimeMinutes,
          badges: v.badges,
          bioAr: v.bioAr,
          portfolio: v.portfolio,
          videoUrls: v.videoUrls,
          libraryUrl: v.libraryUrl,
          contactPhone: v.contactPhone,
          whatsappNumber: v.whatsappNumber,
          cancellationPolicyAr: v.cancellationPolicyAr,
          status: v.status.toLowerCase() as any,
          featured: v.featured,
          specialtiesAr: v.specialtiesAr,
          metrics: v.metrics ? {
            averageRating: v.metrics.averageRating,
            reviewsCount: v.metrics.reviewsCount,
            completedOrders: v.metrics.completedOrders,
            cancelledOrders: v.metrics.cancelledOrders,
            repeatCustomerRate: v.metrics.repeatCustomerRate,
            responseTimeMinutes: v.metrics.responseTimeMinutes,
            acceptanceRate: v.metrics.acceptanceRate,
            onTimeRate: v.metrics.onTimeRate,
            satisfactionRate: v.metrics.satisfactionRate,
            yearsOfExperience: v.metrics.yearsOfExperience,
          } : undefined,
          availability: v.availability ? {
            workingDays: v.availability.workingDays,
            timeSlots: v.availability.timeSlots,
            capacityPerSlot: v.availability.capacityPerSlot,
            blackoutDates: v.availability.blackoutDates,
            minNoticeDays: v.availability.minNoticeDays,
            maxAdvanceDays: v.availability.maxAdvanceDays,
          } : undefined,
        }));
      }
    }
  } catch (e) {
    if (options?.strict) throw e;
    console.warn('PostgreSQL fetch fallback to memory store:', e);
  }

  if (options?.strict) throw new Error('Database unavailable');
  // Resilient memory fallback
  let list = VENDORS.map(ensureVendorDetails);
  if (options?.categoryId) list = list.filter((v) => v.categoryId === options.categoryId);
  if (options?.cityId) list = list.filter((v) => v.cityId === options.cityId);
  if (options?.featuredOnly) list = list.filter((v) => v.featured);
  return list;
}

export async function getVendorByIdFromDB(id: string): Promise<Vendor | null> {
  try {
    if (isDatabaseConfigured()) {
      const v = await prisma.vendor.findUnique({
        where: { id },
        include: {
          city: true,
          category: true,
          metrics: true,
          availability: true,
          services: {
            include: {
              packages: true,
              addons: true,
            },
          },
        },
      });
      if (v) {
        return ensureVendorDetails({
          ...v,
          crNumber: v.crNumber || undefined,
          freelanceLicense: v.freelanceLicense || undefined,
          vatNumber: v.vatNumber || undefined,
          genderSpecialty: (v.genderSpecialty as any) || undefined,
          cityNameAr: (v as any).city?.nameAr || 'الرياض',
          categoryNameAr: (v as any).category?.nameAr || 'خدمة مناسبات',
          status: v.status.toLowerCase() as any,
          metrics: v.metrics as any,
          availability: v.availability as any,
        });
      }
    }
  } catch (e) {
    console.warn('PostgreSQL single fetch fallback:', e);
  }

  const found = VENDORS.find((v) => v.id === id);
  return found ? ensureVendorDetails(found) : null;
}

// -------------------------------------------------------------
// User & Authentication Persistence
// -------------------------------------------------------------

export async function findUserInDB(identifier: string): Promise<any | null> {
  try {
    if (isDatabaseConfigured()) {
      const user = await prisma.user.findFirst({
        where: {
          OR: [{ phone: identifier }, { email: identifier }],
        },
        include: {
          vendorProfile: true,
        },
      });
      return user;
    }
  } catch (e) {
    console.warn('PostgreSQL findUser fallback:', e);
  }
  return null;
}

export async function createUserInDB(data: {
  name: string;
  phone: string;
  email?: string;
  role: 'CLIENT' | 'VENDOR' | 'ADMIN';
  cityId?: string;
  avatar?: string;
}): Promise<any> {
  try {
    if (isDatabaseConfigured()) {
      const user = await prisma.user.upsert({
        where: { phone: data.phone },
        update: {
          name: data.name,
          email: data.email || null,
          role: data.role,
          cityId: data.cityId || null,
        },
        create: {
          name: data.name,
          phone: data.phone,
          email: data.email || null,
          role: data.role,
          cityId: data.cityId || null,
          avatar: data.avatar || `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80`,
        },
        include: {
          vendorProfile: true,
        },
      });
      return user;
    }
  } catch (e) {
    console.warn('PostgreSQL createUser fallback:', e);
  }

  // Resilient memory mock user
  return {
    id: 'user-' + Date.now(),
    name: data.name,
    phone: data.phone,
    email: data.email,
    role: data.role,
    cityId: data.cityId,
    avatar: data.avatar || `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80`,
    createdAt: new Date().toISOString(),
  };
}

export async function createVendorInDB(vendorData: {
  userId?: string;
  businessName: string;
  businessNameEn?: string;
  categoryId: string;
  cityId: string;
  neighborhood: string;
  crNumber?: string;
  freelanceLicense?: string;
  vatNumber?: string;
  startingPrice: number;
  contactPhone: string;
  whatsappNumber: string;
  bioAr: string;
  specialtiesAr?: string[];
}): Promise<any> {
  try {
    if (isDatabaseConfigured()) {
      const vendor = await prisma.vendor.create({
        data: {
          userId: vendorData.userId || null,
          businessName: vendorData.businessName,
          businessNameEn: vendorData.businessNameEn || vendorData.businessName,
          categoryId: vendorData.categoryId,
          cityId: vendorData.cityId,
          neighborhood: vendorData.neighborhood,
          crNumber: vendorData.crNumber || null,
          freelanceLicense: vendorData.freelanceLicense || null,
          vatNumber: vendorData.vatNumber || null,
          startingPrice: vendorData.startingPrice,
          contactPhone: vendorData.contactPhone,
          whatsappNumber: vendorData.whatsappNumber,
          bioAr: vendorData.bioAr,
          specialtiesAr: vendorData.specialtiesAr || [],
          cancellationPolicyAr: 'استرجاع كامل للعربون قبل 14 يوماً من موعد المناسبة.',
          logo: 'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=200&auto=format&fit=crop&q=80',
          bannerImage: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=1200&auto=format&fit=crop&q=80',
          verified: Boolean(vendorData.crNumber || vendorData.freelanceLicense),
          badges: vendorData.crNumber ? ['سجل تجاري موثق'] : ['وثيقة عمل حر معتمدة'],
          status: 'ACTIVE',
        },
      });

      // Also create default metrics
      await prisma.vendorMetrics.create({
        data: {
          vendorId: vendor.id,
          averageRating: 5.0,
          reviewsCount: 0,
          completedOrders: 0,
          yearsOfExperience: 2,
        },
      });

      return vendor;
    }
  } catch (e) {
    console.warn('PostgreSQL createVendor fallback:', e);
  }

  return {
    id: 'vendor-' + Date.now(),
    ...vendorData,
    verified: Boolean(vendorData.crNumber || vendorData.freelanceLicense),
    status: 'ACTIVE',
  };
}

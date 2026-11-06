-- Foreign-key columns that had no index: every lookup by owner/parent was a full table scan, and deleting a parent scanned each child table.
-- Measured on 200,000 rows: 54 ms per "my occasions" query without the index, 0.05 ms with it. IF NOT EXISTS keeps this safe to re-run.

CREATE INDEX IF NOT EXISTS "GeoRule_featureId_idx" ON "GeoRule"("featureId");
CREATE INDEX IF NOT EXISTS "GeoRule_serviceId_idx" ON "GeoRule"("serviceId");
CREATE INDEX IF NOT EXISTS "GeoRule_categoryId_idx" ON "GeoRule"("categoryId");
CREATE INDEX IF NOT EXISTS "SaudiCity_countryCode_idx" ON "SaudiCity"("countryCode");
CREATE INDEX IF NOT EXISTS "SaudiCity_regionId_idx" ON "SaudiCity"("regionId");
CREATE INDEX IF NOT EXISTS "ServiceItem_artistId_idx" ON "ServiceItem"("artistId");
CREATE INDEX IF NOT EXISTS "Occasion_userId_idx" ON "Occasion"("userId");
CREATE INDEX IF NOT EXISTS "MultiVendorOrder_occasionId_idx" ON "MultiVendorOrder"("occasionId");
CREATE INDEX IF NOT EXISTS "MultiVendorOrder_cityId_idx" ON "MultiVendorOrder"("cityId");
CREATE INDEX IF NOT EXISTS "OMSNotificationLog_orderId_idx" ON "OMSNotificationLog"("orderId");
CREATE INDEX IF NOT EXISTS "Review_serviceId_idx" ON "Review"("serviceId");
CREATE INDEX IF NOT EXISTS "CommerceOrderItem_serviceId_idx" ON "CommerceOrderItem"("serviceId");
CREATE INDEX IF NOT EXISTS "CommerceOrderItem_offerId_idx" ON "CommerceOrderItem"("offerId");
CREATE INDEX IF NOT EXISTS "CommerceOrderItem_packageId_idx" ON "CommerceOrderItem"("packageId");
CREATE INDEX IF NOT EXISTS "CommerceTransfer_makerId_idx" ON "CommerceTransfer"("makerId");
CREATE INDEX IF NOT EXISTS "CommerceTransfer_checkerId_idx" ON "CommerceTransfer"("checkerId");
CREATE INDEX IF NOT EXISTS "CommerceRelationship_relatedServiceId_idx" ON "CommerceRelationship"("relatedServiceId");
CREATE INDEX IF NOT EXISTS "AvailabilityGeoRule_countryCode_idx" ON "AvailabilityGeoRule"("countryCode");
CREATE INDEX IF NOT EXISTS "AvailabilityGeoRule_regionId_idx" ON "AvailabilityGeoRule"("regionId");
CREATE INDEX IF NOT EXISTS "AvailabilityInterest_cityId_idx" ON "AvailabilityInterest"("cityId");
CREATE INDEX IF NOT EXISTS "AvailabilityInterest_customerId_idx" ON "AvailabilityInterest"("customerId");
CREATE INDEX IF NOT EXISTS "CustomerConsent_offerId_idx" ON "CustomerConsent"("offerId");
CREATE INDEX IF NOT EXISTS "NegotiationLog_taskId_idx" ON "NegotiationLog"("taskId");
CREATE INDEX IF NOT EXISTS "ExceptionNotification_requestId_idx" ON "ExceptionNotification"("requestId");

-- AlterTable
ALTER TABLE "CheckIn" ADD COLUMN     "gpsLat" DOUBLE PRECISION,
ADD COLUMN     "gpsLng" DOUBLE PRECISION,
ADD COLUMN     "locationMethod" TEXT;

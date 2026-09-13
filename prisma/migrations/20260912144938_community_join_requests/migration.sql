-- CreateEnum
CREATE TYPE "CommunityMemberStatus" AS ENUM ('PENDING', 'ACTIVE');

-- AlterTable
ALTER TABLE "community_members" ADD COLUMN     "status" "CommunityMemberStatus" NOT NULL DEFAULT 'ACTIVE';

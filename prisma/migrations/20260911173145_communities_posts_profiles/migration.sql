-- CreateEnum
CREATE TYPE "CommunityKind" AS ENUM ('PROJECT', 'INTEREST', 'BATCH', 'EVENT', 'DEPARTMENT');

-- CreateEnum
CREATE TYPE "CommunityVisibility" AS ENUM ('CAMPUS', 'REQUEST_TO_JOIN', 'PRIVATE');

-- CreateEnum
CREATE TYPE "CommunityRole" AS ENUM ('OWNER', 'MODERATOR', 'MEMBER');

-- CreateEnum
CREATE TYPE "MessageContentType" AS ENUM ('PLAINTEXT', 'MLS_CIPHERTEXT');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'UPHELD', 'DISMISSED');

-- CreateEnum
CREATE TYPE "PostKind" AS ENUM ('UPDATE', 'MILESTONE', 'ASK_FOR_HELP', 'SHOWCASE', 'ANNOUNCEMENT');

-- CreateEnum
CREATE TYPE "LinkPlatform" AS ENUM ('GITHUB', 'LINKEDIN', 'LEETCODE', 'CODEFORCES', 'CODECHEF', 'HACKERRANK', 'GEEKSFORGEEKS', 'REDDIT', 'DISCORD', 'PERSONAL_SITE', 'X');

-- CreateEnum
CREATE TYPE "TagSource" AS ENUM ('SELF', 'EARNED', 'COMMUNITY', 'FACULTY');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "accentColor" TEXT,
ADD COLUMN     "bannerUrl" TEXT,
ADD COLUMN     "headline" TEXT,
ADD COLUMN     "pronouns" TEXT;

-- CreateTable
CREATE TABLE "communities" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "kind" "CommunityKind" NOT NULL,
    "visibility" "CommunityVisibility" NOT NULL DEFAULT 'CAMPUS',
    "isSystemManaged" BOOLEAN NOT NULL DEFAULT false,
    "projectId" TEXT,
    "eventId" TEXT,
    "batchYear" INTEGER,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "communities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_members" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "CommunityRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "mutedUntil" TIMESTAMP(3),
    "lastReadAt" TIMESTAMP(3),

    CONSTRAINT "community_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_messages" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "contentType" "MessageContentType" NOT NULL DEFAULT 'PLAINTEXT',
    "envelope" BYTEA,
    "replyToId" TEXT,
    "removedAt" TIMESTAMP(3),
    "removedById" TEXT,
    "removedReason" TEXT,
    "editedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_reports" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "reviewedById" TEXT,
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "message_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "kind" "PostKind" NOT NULL DEFAULT 'UPDATE',
    "projectId" TEXT,
    "communityId" TEXT,
    "bountyId" TEXT,
    "pinnedAt" TIMESTAMP(3),
    "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_links" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" "LinkPlatform" NOT NULL,
    "handle" TEXT NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "statLabel" TEXT,
    "statValue" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profile_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_tags" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "source" "TagSource" NOT NULL DEFAULT 'SELF',
    "sourceRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profile_tags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "communities_tenantId_kind_idx" ON "communities"("tenantId", "kind");

-- CreateIndex
CREATE INDEX "communities_projectId_idx" ON "communities"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "communities_tenantId_slug_key" ON "communities"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "community_members_userId_leftAt_idx" ON "community_members"("userId", "leftAt");

-- CreateIndex
CREATE UNIQUE INDEX "community_members_communityId_userId_key" ON "community_members"("communityId", "userId");

-- CreateIndex
CREATE INDEX "community_messages_communityId_createdAt_idx" ON "community_messages"("communityId", "createdAt");

-- CreateIndex
CREATE INDEX "message_reports_status_createdAt_idx" ON "message_reports"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "message_reports_messageId_reporterId_key" ON "message_reports"("messageId", "reporterId");

-- CreateIndex
CREATE INDEX "posts_tenantId_createdAt_idx" ON "posts"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "posts_communityId_createdAt_idx" ON "posts"("communityId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "profile_links_userId_platform_key" ON "profile_links"("userId", "platform");

-- CreateIndex
CREATE UNIQUE INDEX "profile_tags_userId_label_key" ON "profile_tags"("userId", "label");

-- AddForeignKey
ALTER TABLE "communities" ADD CONSTRAINT "communities_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communities" ADD CONSTRAINT "communities_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communities" ADD CONSTRAINT "communities_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "campus_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_members" ADD CONSTRAINT "community_members_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_members" ADD CONSTRAINT "community_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_messages" ADD CONSTRAINT "community_messages_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_messages" ADD CONSTRAINT "community_messages_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_messages" ADD CONSTRAINT "community_messages_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "community_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_reports" ADD CONSTRAINT "message_reports_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "community_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_reports" ADD CONSTRAINT "message_reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_links" ADD CONSTRAINT "profile_links_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_tags" ADD CONSTRAINT "profile_tags_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

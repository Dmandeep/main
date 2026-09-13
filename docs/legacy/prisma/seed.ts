import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const hash = await bcrypt.hash('admin123', 10)
  const testHash = await bcrypt.hash('test123', 10)

  // 1. Create Users
  const admin = await prisma.user.upsert({
    where: { email: 'admin@lendi.org' },
    update: {},
    create: {
      rollNumber: 'ADMIN001',
      name: 'IIC Admin',
      email: 'admin@lendi.org',
      passwordHash: hash,
      branch: 'CSE',
      year: 4,
      domainInterests: JSON.stringify(["Web Development", "AI & Machine Learning"]),
      isIicAdmin: true,
      tier: 5,
      totalPoints: 1000,
    },
  })

  const testUser = await prisma.user.upsert({
    where: { email: 'harshith@lendi.org' },
    update: {},
    create: {
      rollNumber: '24B21A0501',
      name: 'Harshith G.',
      email: 'harshith@lendi.org',
      passwordHash: testHash,
      branch: 'CSE',
      year: 1,
      domainInterests: JSON.stringify(["Web Development", "App Development"]),
      tier: 3,
      totalPoints: 250,
      githubUsername: 'hotaro6754',
      isMentorOpen: true,
      mentorDomains: JSON.stringify(["Web Development"]),
    },
  })

  const otherUser = await prisma.user.upsert({
    where: { email: 'priya@lendi.org' },
    update: {},
    create: {
      rollNumber: '23B21A0412',
      name: 'Priya M.',
      email: 'priya@lendi.org',
      passwordHash: testHash,
      branch: 'ECE',
      year: 2,
      domainInterests: JSON.stringify(["IoT & Hardware", "AI & Machine Learning"]),
      tier: 4,
      totalPoints: 400,
      githubUsername: 'priya-codes',
    },
  })

  // 2. Create Ideas
  const idea1 = await prisma.idea.create({
    data: {
      ownerId: testUser.id,
      title: 'Smart Campus Attendance System',
      description: 'An AI-driven attendance system using face recognition at the campus gates. Need folks with OpenCV and React experience to build the dashboard and hardware integration loop.',
      domain: 'AI & Machine Learning',
      skillsNeeded: JSON.stringify(["Python", "React", "OpenCV"]),
      status: 'OPEN',
      healthScore: 85,
      isIicFeatured: true,
    }
  })

  const idea2 = await prisma.idea.create({
    data: {
      ownerId: otherUser.id,
      title: 'Lendi Token Economy',
      description: 'Building a decentralized system for campus tokens to reward students for open source contribution.',
      domain: 'Web Development',
      skillsNeeded: JSON.stringify(["Solidity", "Next.js"]),
      status: 'IN_PROGRESS',
      healthScore: 60,
    }
  })

  // 3. Create Collaboration
  await prisma.collaboration.create({
    data: {
      ideaId: idea1.id,
      applicantId: otherUser.id,
      role: 'BUILDER',
      status: 'PENDING',
      message: 'I have experience with React and would love to help build the dashboard component!',
    }
  })

  // 4. Create Event
  await prisma.event.create({
    data: {
      conductorId: testUser.id,
      title: 'Building REST APIs with Next.js',
      description: 'A hands-on workshop to learn how to build robust APIs with Next.js 14 App Router and Prisma.',
      domain: 'Web Development',
      format: 'WORKSHOP',
      eventDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Next week
      seatLimit: 30,
      prerequisites: 'Basic JavaScript and React knowledge',
    }
  })

  // 5. Point Transactions
  await prisma.pointTransaction.create({
    data: {
      userId: testUser.id,
      action: 'post_idea',
      points: 10,
    }
  })

  console.log('Database seeded successfully!')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
